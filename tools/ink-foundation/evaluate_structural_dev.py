#!/usr/bin/env python3
"""Evaluate a Pri Ink Structural V4 same-writer development checkpoint.

The frozen P0001 holdout is diagnostic only and never production evidence. The
oracle-group metric supplies true stroke groups to the same group-level glyph
classifier used by live decoding, cleanly separating symbol and grouping errors.
"""
from __future__ import annotations

import argparse
import json
from collections import defaultdict
from pathlib import Path

import torch
import torch.nn.functional as F
from torch.utils.data import DataLoader

from data import ID_TO_TOKEN, SPECIAL, TOKEN_TO_ID
from dev_split import make_same_writer_dev_split
from evaluate_structural import checkpoint_sha256, edit_distance, is_critical_structure
from structural import PriInkStructuralV4, StructuralConfig
from structural_data import StructuralInkDataset, corpus_files, load_structural_examples
from structural_decode import decode_structural_output


def _best_real_symbol(logits: torch.Tensor) -> tuple[str, float]:
    probs = F.softmax(logits, dim=-1)
    for idx in probs.argsort(descending=True).tolist():
        token = ID_TO_TOKEN.get(int(idx), "<unk>")
        if token not in SPECIAL:
            return token, float(probs[idx])
    return "<unk>", 0.0


def _oracle_group_symbol_diagnostic(model: PriInkStructuralV4, outputs: dict, structure: dict):
    embeddings = outputs["glyph_stroke_embeddings"]
    if embeddings.ndim == 3:
        embeddings = embeddings[0]
    groups = []
    for group in structure.get("groups") or []:
        strokes = [int(i) for i in (group.get("strokes") or [])]
        if strokes:
            groups.append((group, strokes))
    if not groups:
        return [], 0, 0
    logits = model.classify_glyph_components(embeddings, [strokes for _, strokes in groups])
    rows = []; correct = 0
    for (group, strokes), token_logits in zip(groups, logits):
        pred, confidence = _best_real_symbol(token_logits)
        target = str(group.get("symbol", "")); ok = pred == target
        correct += int(ok)
        rows.append({
            "id": str(group.get("id", "")), "strokes": strokes,
            "target": target, "prediction": pred, "correct": ok, "confidence": confidence,
        })
    return rows, correct, len(groups)


def main():
    p = argparse.ArgumentParser()
    p.add_argument("checkpoint")
    p.add_argument("--corpus", required=True)
    p.add_argument("--device", default="auto")
    p.add_argument("--group-threshold", type=float, default=0.65)
    p.add_argument("--relation-threshold", type=float, default=0.60)
    p.add_argument("--ambiguity-threshold", type=float, default=0.80)
    p.add_argument("--out", default=None)
    args = p.parse_args()

    checkpoint = Path(args.checkpoint)
    ckpt = torch.load(checkpoint, map_location="cpu", weights_only=False)
    if int(ckpt.get("architecture_version", 0)) != 4:
        raise SystemExit("checkpoint is not Pri Ink Structural V4")
    if ckpt.get("stage") != "structural-research-dev":
        raise SystemExit(f"expected structural-research-dev checkpoint, got {ckpt.get('stage')!r}")
    if ckpt.get("production_ready") is not False:
        raise SystemExit("dev checkpoint must never claim production readiness")
    if (ckpt.get("vocab") or []) != list(TOKEN_TO_ID.keys()):
        raise SystemExit("V4 checkpoint vocabulary does not match current runtime vocabulary")

    split_meta = ckpt.get("dev_split") or {}
    if split_meta.get("protocol") != "same-writer-dev-holdout":
        raise SystemExit("checkpoint has no valid same-writer dev split metadata")
    if split_meta.get("writerDisjoint") is not False or split_meta.get("productionEvidence") is not False:
        raise SystemExit("unsafe dev split metadata")

    examples = load_structural_examples(corpus_files(args.corpus))
    try:
        examples, recreated = make_same_writer_dev_split(examples, seed=int(split_meta["seed"]), fraction=float(split_meta["fraction"]))
    except (ValueError, KeyError) as exc:
        raise SystemExit(str(exc)) from exc
    for key in ("writer", "trainSamples", "validationSamples"):
        if recreated.get(key) != split_meta.get(key):
            raise SystemExit(f"dev split reproduction mismatch for {key}: {recreated.get(key)!r} != {split_meta.get(key)!r}")

    validation_rows = [x for x in examples if x.split == "validation"]
    cfg = StructuralConfig(**ckpt["config"])
    dataset = StructuralInkDataset(examples, "validation", cfg)
    if len(dataset) < 1 or len(validation_rows) != len(dataset):
        raise SystemExit("invalid recreated dev validation split")
    loader = DataLoader(dataset, batch_size=1, shuffle=False, num_workers=0)

    if args.device == "auto":
        device = torch.device("cuda" if torch.cuda.is_available() else "mps" if torch.backends.mps.is_available() else "cpu")
    else:
        device = torch.device(args.device)
    model = PriInkStructuralV4(len(TOKEN_TO_ID), cfg)
    model.load_state_dict(ckpt["model"], strict=True); model.to(device).eval()

    total = exact = char_errors = char_total = accepted = accepted_exact = 0
    critical_total = critical_exact = 0; confidence_sum = 0.0
    oracle_symbol_ok = oracle_symbol_n = 0
    by_writer: dict[str, list[int]] = defaultdict(list)
    warning_counts: dict[str, int] = defaultdict(int); sample_diagnostics = []

    with torch.inference_mode():
        for sample_number, (batch, row) in enumerate(zip(loader, validation_rows), 1):
            outputs = model(
                batch["stroke_points"].to(device), batch["stroke_point_valid"].to(device),
                batch["stroke_valid"].to(device), batch["stroke_geometry"].to(device), batch["raster"].to(device),
            )
            hyp = decode_structural_output(
                outputs, batch["stroke_geometry"].to(device), batch["stroke_valid"].to(device),
                group_threshold=args.group_threshold, relation_threshold=args.relation_threshold,
                ambiguity_threshold=args.ambiguity_threshold, model=model,
            )
            target = str(batch["target_text"][0]); writer = str(batch["writer"][0])
            ok = int(hyp.canonical == target); dist = edit_distance(hyp.canonical, target)
            total += 1; exact += ok; char_errors += dist; char_total += max(1, len(target)); confidence_sum += hyp.confidence
            by_writer[writer].append(ok)
            if is_critical_structure(target): critical_total += 1; critical_exact += ok
            if not hyp.ambiguous: accepted += 1; accepted_exact += ok
            for warning in hyp.warnings: warning_counts[warning.split(":", 1)[0]] += 1

            oracle_rows, oracle_ok, oracle_n = _oracle_group_symbol_diagnostic(model, outputs, row.structure)
            oracle_symbol_ok += oracle_ok; oracle_symbol_n += oracle_n
            sample_diagnostics.append({
                "sample": sample_number, "target": target, "prediction": hyp.canonical, "exact": bool(ok),
                "editDistance": dist, "ambiguous": hyp.ambiguous, "confidence": hyp.confidence,
                "symbolConfidence": hyp.symbol_confidence, "groupingConfidence": hyp.grouping_confidence,
                "relationConfidence": hyp.relation_confidence,
                "truthGlyphCount": len(row.structure.get("groups") or []), "predictedGlyphCount": len(hyp.glyphs),
                "oracleGroupSymbolCorrect": oracle_ok, "oracleGroupSymbolTotal": oracle_n,
                "oracleGroupSymbolAccuracy": oracle_ok / max(1, oracle_n), "oracleGroupSymbols": oracle_rows,
                "predictedGlyphs": [{"id": g.id, "strokes": list(g.strokes), "symbol": g.symbol, "confidence": g.symbol_confidence, "cx": g.cx, "cy": g.cy} for g in hyp.glyphs],
                "predictedRelations": [{"from": r.source, "to": r.target, "type": r.kind, "confidence": r.confidence} for r in hyp.relations],
                "warnings": list(hyp.warnings),
            })

    writer_exact = {w: sum(v) / len(v) for w, v in sorted(by_writer.items())}
    metrics = {
        "architectureVersion": 4, "stage": "structural-research-dev", "productionReady": False,
        "validationProtocol": recreated, "checkpointSha256": checkpoint_sha256(checkpoint),
        "samples": total, "writers": len(by_writer), "exactExpressionAccuracy": exact / max(1, total),
        "characterErrorRate": char_errors / max(1, char_total),
        "criticalStructureExact": critical_exact / max(1, critical_total), "criticalStructureSamples": critical_total,
        "coverage": accepted / max(1, total), "safePrecision": accepted_exact / max(1, accepted),
        "acceptedSamples": accepted, "meanDecisionConfidence": confidence_sum / max(1, total),
        "oracleGroupingGlyphSymbolAccuracy": oracle_symbol_ok / max(1, oracle_symbol_n),
        "oracleGroupingGlyphSymbolsCorrect": oracle_symbol_ok, "oracleGroupingGlyphSymbolsTotal": oracle_symbol_n,
        "worstWriterExact": min(writer_exact.values(), default=0.0), "writerExact": writer_exact,
        "warningCounts": dict(sorted(warning_counts.items())),
        "thresholds": {"group": args.group_threshold, "relation": args.relation_threshold, "ambiguity": args.ambiguity_threshold},
        "sampleDiagnostics": sample_diagnostics,
        "evidence": "same-writer development evaluation only; not writer-disjoint and not production evidence",
    }

    print("\nPri Ink Structural V4 — SAME-WRITER DEV EVALUATION\n")
    print(f"writer: {recreated['writer']} · samples: {total}")
    print(f"exact expression: {100*metrics['exactExpressionAccuracy']:.2f}%")
    print(f"CER: {100*metrics['characterErrorRate']:.2f}%")
    print(f"oracle-group glyph symbol accuracy: {100*metrics['oracleGroupingGlyphSymbolAccuracy']:.2f}% ({oracle_symbol_ok}/{oracle_symbol_n})")
    print(f"critical structure exact: {100*metrics['criticalStructureExact']:.2f}% ({critical_total} samples)")
    print(f"abstention coverage: {100*metrics['coverage']:.2f}%")
    print(f"safe precision among accepted: {100*metrics['safePrecision']:.2f}%")
    print("\nPer-sample diagnostics:")
    for item in sample_diagnostics:
        print(
            f"  #{item['sample']} target={item['target']!r} pred={item['prediction']!r} edit={item['editDistance']} "
            f"conf={item['confidence']:.3f} sym={item['symbolConfidence']:.3f} group={item['groupingConfidence']:.3f} "
            f"rel={item['relationConfidence']:.3f} glyphs={item['predictedGlyphCount']}/{item['truthGlyphCount']} "
            f"oracle_sym={item['oracleGroupSymbolCorrect']}/{item['oracleGroupSymbolTotal']}"
        )
    print("writer-disjoint: false"); print("production ready: false")
    if args.out:
        out = Path(args.out); out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(metrics, indent=2) + "\n"); print(f"report: {out}")


if __name__ == "__main__":
    main()
