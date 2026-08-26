#!/usr/bin/env python3
"""Three-way same-base ablation: base glyph head vs local-control vs visual/context."""
from __future__ import annotations

import argparse
import json
from collections import defaultdict
from pathlib import Path

import torch
from torch.utils.data import DataLoader

from data import TOKEN_TO_ID
from evaluate_structural import edit_distance, is_critical_structure
from structural import PriInkStructuralV4, StructuralConfig
from structural_component_validity import checkpoint_sha256, recover_true_components
from structural_contextual_glyphs import (
    ContextualGlyphModel,
    contextual_glyph_metrics,
    group_symbol_targets,
    load_contextual_glyph_checkpoint,
)
from structural_data import StructuralInkDataset, corpus_files, load_structural_examples
from structural_decoder_registry import DECODER_NAMES, decode_structural_selected
from train_contextual_glyphs import prepare_examples


def _device(name):
    if name != "auto": return torch.device(name)
    return torch.device("cuda" if torch.cuda.is_available() else "mps" if torch.backends.mps.is_available() else "cpu")


def _load_base(path, device):
    ckpt = torch.load(path, map_location="cpu", weights_only=False)
    if int(ckpt.get("architecture_version", 0)) != 4 or ckpt.get("production_ready") is not False:
        raise SystemExit("invalid/release-unsafe V4 base checkpoint")
    cfg = StructuralConfig(**ckpt["config"]); model = PriInkStructuralV4(len(TOKEN_TO_ID), cfg)
    model.load_state_dict(ckpt["model"], strict=True); model.to(device).eval(); return ckpt, cfg, model


def _summary(rows):
    total = len(rows); exact = sum(r["ok"] for r in rows); chars = sum(max(1, len(r["target"])) for r in rows)
    critical = [r for r in rows if is_critical_structure(r["target"])]; accepted = [r for r in rows if not r["ambiguous"]]
    by_writer = defaultdict(list)
    for r in rows: by_writer[r["writer"]].append(r["ok"])
    writer_exact = {w: sum(v)/len(v) for w,v in sorted(by_writer.items())}
    return {"samples": total, "exactExpressionAccuracy": exact/max(1,total),
            "characterErrorRate": sum(r["edit"] for r in rows)/max(1,chars),
            "criticalStructureExact": sum(r["ok"] for r in critical)/max(1,len(critical)),
            "coverage": len(accepted)/max(1,total), "safePrecision": sum(r["ok"] for r in accepted)/max(1,len(accepted)),
            "meanDecisionConfidence": sum(r["confidence"] for r in rows)/max(1,total),
            "worstWriterExact": min(writer_exact.values(), default=0.0), "writerExact": writer_exact}


def _snap(hyp, target, writer):
    return {"target": target, "writer": writer, "prediction": hyp.canonical, "ok": int(hyp.canonical == target),
            "edit": edit_distance(hyp.canonical, target), "ambiguous": bool(hyp.ambiguous), "confidence": float(hyp.confidence)}


def main():
    p = argparse.ArgumentParser(); p.add_argument("base_checkpoint"); p.add_argument("local_checkpoint"); p.add_argument("contextual_checkpoint")
    p.add_argument("--corpus", required=True); p.add_argument("--mode", choices=["writer-disjoint","same-writer-dev"], default="writer-disjoint")
    p.add_argument("--decoder", choices=list(DECODER_NAMES), default="joint-auto"); p.add_argument("--device", default="auto")
    p.add_argument("--out", required=True); args = p.parse_args()
    device = _device(args.device); base_path = Path(args.base_checkpoint); base_ckpt,cfg,model = _load_base(base_path, device)
    raw = load_structural_examples(corpus_files(args.corpus)); examples, protocol = prepare_examples(raw, base_ckpt, args.mode)
    loader = DataLoader(StructuralInkDataset(examples,"validation",cfg), batch_size=1, shuffle=False, num_workers=0)
    if len(loader.dataset) < 1: raise SystemExit("no validation examples for contextual glyph ablation")
    try:
        local_head, local_ckpt = load_contextual_glyph_checkpoint(Path(args.local_checkpoint), base_checkpoint_path=base_path, d_model=cfg.d_model, vocab_size=len(TOKEN_TO_ID), device=device)
        context_head, context_ckpt = load_contextual_glyph_checkpoint(Path(args.contextual_checkpoint), base_checkpoint_path=base_path, d_model=cfg.d_model, vocab_size=len(TOKEN_TO_ID), device=device)
    except ValueError as exc: raise SystemExit(str(exc)) from exc
    if local_ckpt.get("feature_mode") != "local-control" or context_ckpt.get("feature_mode") != "local-plus-visual":
        raise SystemExit("contextual glyph ablation requires local-control and local-plus-visual checkpoints")
    for ckpt in (local_ckpt, context_ckpt):
        if ckpt.get("validation_protocol") != protocol: raise SystemExit("contextual glyph validation protocol mismatch")

    oracle_logits = {"base": [], "localControl": [], "localPlusVisual": []}; oracle_targets=[]; oracle_sizes=[]
    expr = {"base": [], "localControl": [], "localPlusVisual": []}
    with torch.inference_mode():
        for batch in loader:
            geom=batch["stroke_geometry"].to(device); valid=batch["stroke_valid"].to(device)
            outputs=model(batch["stroke_points"].to(device),batch["stroke_point_valid"].to(device),valid,geom,batch["raster"].to(device))
            symbols=batch["symbol_targets"].to(device)[0]; groups=batch["group_targets"].to(device)[0]
            components=recover_true_components(symbols,groups); targets,sizes=group_symbol_targets(symbols,components)
            oracle_logits["base"].append(model.classify_glyph_components(outputs["glyph_stroke_embeddings"][0],components).cpu())
            oracle_logits["localControl"].append(local_head(outputs["glyph_stroke_embeddings"][0],outputs["stroke_embeddings"][0],geom[0],components,feature_mode="local-control").cpu())
            oracle_logits["localPlusVisual"].append(context_head(outputs["glyph_stroke_embeddings"][0],outputs["stroke_embeddings"][0],geom[0],components,feature_mode="local-plus-visual").cpu())
            oracle_targets.append(targets.cpu()); oracle_sizes.append(sizes.cpu())

            target=str(batch["target_text"][0]); writer=str(batch["writer"][0])
            models={
                "base": model,
                "localControl": ContextualGlyphModel(model,local_head,outputs["stroke_embeddings"],geom,feature_mode="local-control"),
                "localPlusVisual": ContextualGlyphModel(model,context_head,outputs["stroke_embeddings"],geom,feature_mode="local-plus-visual"),
            }
            for name,decode_model in models.items():
                hyp=decode_structural_selected(args.decoder,outputs,geom,valid,model=decode_model)
                expr[name].append(_snap(hyp,target,writer))

    targets=torch.cat(oracle_targets); sizes=torch.cat(oracle_sizes)
    oracle={name:contextual_glyph_metrics(torch.cat(parts),targets,sizes) for name,parts in oracle_logits.items()}
    expression={name:_summary(rows) for name,rows in expr.items()}
    report={
        "architectureVersion":4,"comparison":"base-vs-local-control-vs-local-plus-visual-group-symbols","productionReady":False,
        "baseCheckpointSha256":checkpoint_sha256(base_path),"localCheckpointSha256":checkpoint_sha256(Path(args.local_checkpoint)),
        "contextualCheckpointSha256":checkpoint_sha256(Path(args.contextual_checkpoint)),"contextualGlyphVersion":context_ckpt["contextual_glyph_version"],
        "decoder":args.decoder,"validationProtocol":protocol,"oracleGrouping":oracle,"expression":expression,
        "evidence":"research-only same-base glyph fusion ablation; synthetic and same-writer results are not production handwriting evidence",
    }
    out=Path(args.out);out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps(report,indent=2)+"\n")
    print("\nPri Ink Structural V4 — CONTEXTUAL GLYPH ABLATION\n")
    for name in ("base","localControl","localPlusVisual"):
        o=oracle[name];e=expression[name]
        print(f"{name}: oracle={100*o['accuracy']:.2f}% macro={100*o['macroClassRecall']:.2f}% multi={100*o['multiStrokeAccuracy']:.2f}% exact={100*e['exactExpressionAccuracy']:.2f}% CER={100*e['characterErrorRate']:.2f}%")
    print(f"writer-disjoint: {str(bool(protocol.get('writerDisjoint'))).lower()}")
    print("production ready: false");print(f"report: {out}")


if __name__=="__main__": main()
