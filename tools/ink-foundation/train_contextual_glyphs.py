#!/usr/bin/env python3
"""Train frozen-base local-control/contextual group-symbol heads for Pri Ink V4."""
from __future__ import annotations

import argparse
import json
import math
import random
from pathlib import Path

import numpy as np
import torch
from torch.utils.data import DataLoader

from data import TOKEN_TO_ID
from dev_split import make_same_writer_dev_split
from structural import PriInkStructuralV4, StructuralConfig
from structural_component_validity import checkpoint_sha256
from structural_contextual_glyphs import (
    CONTEXTUAL_GLYPH_MARGIN,
    CONTEXTUAL_GLYPH_MARGIN_WEIGHT,
    CONTEXTUAL_GLYPH_OBJECTIVE,
    CONTEXTUAL_GLYPH_VERSION,
    FEATURE_MODES,
    ContextualGlyphSymbolHead,
    contextual_glyph_loss,
    contextual_glyph_metrics,
    score_supervised_contextual_glyphs,
)
from structural_data import StructuralInkDataset, corpus_files, load_structural_examples


def seed_everything(seed: int):
    random.seed(seed); np.random.seed(seed); torch.manual_seed(seed)
    if torch.cuda.is_available(): torch.cuda.manual_seed_all(seed)


def _device(name: str) -> torch.device:
    if name != "auto": return torch.device(name)
    return torch.device("cuda" if torch.cuda.is_available() else "mps" if torch.backends.mps.is_available() else "cpu")


def _load_base(path: Path, device: torch.device):
    ckpt = torch.load(path, map_location="cpu", weights_only=False)
    if int(ckpt.get("architecture_version", 0)) != 4:
        raise SystemExit("base checkpoint is not Pri Ink Structural V4")
    if ckpt.get("production_ready") is not False:
        raise SystemExit("refusing base checkpoint that claims production readiness")
    if (ckpt.get("vocab") or []) != list(TOKEN_TO_ID.keys()):
        raise SystemExit("base checkpoint vocabulary does not match current V4 vocabulary")
    cfg = StructuralConfig(**ckpt["config"])
    model = PriInkStructuralV4(len(TOKEN_TO_ID), cfg)
    model.load_state_dict(ckpt["model"], strict=True)
    model.to(device).eval()
    for parameter in model.parameters(): parameter.requires_grad_(False)
    return ckpt, cfg, model


def _writer_disjoint_stage_ok(base_ckpt: dict) -> bool:
    if base_ckpt.get("stage") == "structural-research": return True
    if base_ckpt.get("stage") == "structural-synthetic-pretrain":
        if base_ckpt.get("synthetic_pretraining") is not True:
            raise SystemExit("tagged synthetic V4 base lacks synthetic_pretraining=true provenance")
        return True
    return False


def prepare_examples(raw, base_ckpt: dict, mode: str):
    if mode == "writer-disjoint":
        if not _writer_disjoint_stage_ok(base_ckpt):
            raise SystemExit("writer-disjoint contextual glyph training requires a research/synthetic-pretrain V4 base")
        train_writers = {x.writer for x in raw if x.split == "train"}
        val_writers = {x.writer for x in raw if x.split == "validation"}
        if not train_writers or not val_writers:
            raise SystemExit("contextual glyph training needs train and validation writers")
        overlap = train_writers & val_writers
        if overlap: raise SystemExit(f"writer leakage in contextual glyph corpus: {sorted(overlap)[:5]}")
        return raw, {"protocol": "writer-disjoint", "writerDisjoint": True, "productionEvidence": False,
                     "trainWriters": len(train_writers), "validationWriters": len(val_writers)}

    if base_ckpt.get("stage") != "structural-research-dev":
        raise SystemExit("same-writer contextual glyph training requires structural-research-dev base")
    frozen = base_ckpt.get("dev_split") or {}
    if frozen.get("protocol") != "same-writer-dev-holdout" or frozen.get("writerDisjoint") is not False or frozen.get("productionEvidence") is not False:
        raise SystemExit("unsafe or missing frozen dev split metadata")
    examples, recreated = make_same_writer_dev_split(raw, seed=int(frozen["seed"]), fraction=float(frozen["fraction"]))
    for key in ("writer", "trainSamples", "validationSamples", "seed", "fraction"):
        if recreated.get(key) != frozen.get(key):
            raise SystemExit(f"contextual glyph dev split mismatch for {key}")
    return examples, recreated


def _load_initial(head, path: Path, *, base_hash: str, feature_mode: str, allow_transfer: bool):
    ckpt = torch.load(path, map_location="cpu", weights_only=False)
    if int(ckpt.get("contextual_glyph_version", 0)) != CONTEXTUAL_GLYPH_VERSION or ckpt.get("objective") != CONTEXTUAL_GLYPH_OBJECTIVE:
        raise SystemExit("initial contextual glyph checkpoint version/objective mismatch")
    if ckpt.get("feature_mode") != feature_mode:
        raise SystemExit("cannot transfer contextual glyph weights across feature modes")
    source_hash = str(ckpt.get("base_checkpoint_sha256", ""))
    if source_hash != base_hash and not allow_transfer:
        raise SystemExit("initial contextual glyph head belongs to another base; use --allow-base-transfer only for deliberate synthetic->real fine-tuning")
    head.load_state_dict(ckpt["model"], strict=True)
    return {"path": str(path), "baseCheckpointSha256": source_hash, "stage": ckpt.get("stage"),
            "evidence": ckpt.get("evidence"), "baseTransfer": source_hash != base_hash}


@torch.no_grad()
def evaluate_head(base_model, head, loader, device, feature_mode):
    logits = []; targets = []; sizes = []; losses = []
    base_model.eval(); head.eval()
    for batch in loader:
        outputs = base_model(batch["stroke_points"].to(device), batch["stroke_point_valid"].to(device),
                             batch["stroke_valid"].to(device), batch["stroke_geometry"].to(device), batch["raster"].to(device))
        scored = score_supervised_contextual_glyphs(head, outputs, batch, device=device, feature_mode=feature_mode)
        if scored.groups:
            losses.append(float(contextual_glyph_loss(scored)))
            logits.append(scored.logits.cpu()); targets.append(scored.targets.cpu()); sizes.append(scored.group_sizes.cpu())
    if not logits: raise SystemExit("validation split has no glyph groups")
    metrics = contextual_glyph_metrics(torch.cat(logits), torch.cat(targets), torch.cat(sizes))
    metrics["loss"] = sum(losses) / max(1, len(losses))
    return metrics


def main():
    p = argparse.ArgumentParser()
    p.add_argument("base_checkpoint")
    p.add_argument("--corpus", required=True)
    p.add_argument("--out", required=True)
    p.add_argument("--mode", choices=["writer-disjoint", "same-writer-dev"], default="writer-disjoint")
    p.add_argument("--feature-mode", choices=list(FEATURE_MODES), required=True)
    p.add_argument("--init", default=None)
    p.add_argument("--allow-base-transfer", action="store_true")
    p.add_argument("--epochs", type=int, default=20)
    p.add_argument("--batch", type=int, default=8)
    p.add_argument("--lr", type=float, default=3e-4)
    p.add_argument("--weight-decay", type=float, default=0.02)
    p.add_argument("--seed", type=int, default=20260824)
    p.add_argument("--device", default="auto")
    p.add_argument("--patience", type=int, default=6)
    args = p.parse_args()
    if args.epochs < 1 or args.batch < 1 or args.patience < 1: raise SystemExit("epochs, batch and patience must be >=1")
    if args.allow_base_transfer and not args.init: raise SystemExit("--allow-base-transfer requires --init")

    seed_everything(args.seed); device = _device(args.device); base_path = Path(args.base_checkpoint)
    base_ckpt, cfg, base_model = _load_base(base_path, device); base_hash = checkpoint_sha256(base_path)
    raw = load_structural_examples(corpus_files(args.corpus)); examples, protocol = prepare_examples(raw, base_ckpt, args.mode)
    train_rows = [x for x in examples if x.split == "train"]; val_rows = [x for x in examples if x.split == "validation"]
    if not train_rows or not val_rows: raise SystemExit("contextual glyph training requires non-empty train/validation splits")
    train_loader = DataLoader(StructuralInkDataset(examples, "train", cfg), batch_size=args.batch, shuffle=True, num_workers=0)
    val_loader = DataLoader(StructuralInkDataset(examples, "validation", cfg), batch_size=args.batch, shuffle=False, num_workers=0)

    head = ContextualGlyphSymbolHead(cfg.d_model, len(TOKEN_TO_ID)).to(device)
    init_meta = None
    if args.init:
        init_meta = _load_initial(head, Path(args.init), base_hash=base_hash, feature_mode=args.feature_mode, allow_transfer=args.allow_base_transfer)
    opt = torch.optim.AdamW(head.parameters(), lr=args.lr, weight_decay=args.weight_decay, betas=(0.9, 0.98))
    total_steps = max(1, args.epochs * len(train_loader)); warmup = max(5, total_steps // 20)
    def lr_factor(step):
        if step < warmup: return max(1e-3, (step + 1) / warmup)
        progress = (step - warmup) / max(1, total_steps - warmup)
        return 0.15 + 0.85 * 0.5 * (1 + math.cos(math.pi * progress))
    sched = torch.optim.lr_scheduler.LambdaLR(opt, lr_factor)

    all_writers = {x.writer for x in examples}; synthetic_only = bool(all_writers) and all(w.startswith("SYN4_") for w in all_writers)
    if args.mode == "same-writer-dev":
        stage = "contextual-glyph-research-dev"; evidence = "same-writer development contextual glyph evaluation only; not production evidence"
    elif synthetic_only:
        stage = "contextual-glyph-research"; evidence = "synthetic contextual glyph pretraining only; never real handwriting accuracy"
    else:
        stage = "contextual-glyph-research"; evidence = "writer-disjoint contextual glyph research only; full real-Pencil promotion gates still apply"
    out = Path(args.out); out.parent.mkdir(parents=True, exist_ok=True); best = -1.0; stale = 0
    print("\nPri Ink Structural V4 — CONTEXTUAL GROUP GLYPH TRAINING\n")
    print(f"feature-mode={args.feature_mode} mode={args.mode} train={len(train_rows)} validation={len(val_rows)} device={device}")
    print(f"base={base_path} sha256={base_hash[:16]}… production-ready=false")

    for epoch in range(1, args.epochs + 1):
        head.train(); running = 0.0; steps = groups_seen = 0
        for batch in train_loader:
            with torch.no_grad():
                outputs = base_model(batch["stroke_points"].to(device), batch["stroke_point_valid"].to(device),
                                     batch["stroke_valid"].to(device), batch["stroke_geometry"].to(device), batch["raster"].to(device))
            scored = score_supervised_contextual_glyphs(head, outputs, batch, device=device, feature_mode=args.feature_mode)
            if not scored.groups: continue
            opt.zero_grad(set_to_none=True); loss = contextual_glyph_loss(scored)
            if not torch.isfinite(loss): raise SystemExit("non-finite contextual glyph loss")
            loss.backward(); torch.nn.utils.clip_grad_norm_(head.parameters(), 1.0); opt.step(); sched.step()
            running += float(loss.detach()); steps += 1; groups_seen += scored.groups
        if steps < 1: raise SystemExit("no contextual glyph supervision in training epoch")
        metrics = evaluate_head(base_model, head, val_loader, device, args.feature_mode)
        score = 0.55 * metrics["macroClassRecall"] + 0.25 * metrics["accuracy"] + 0.20 * metrics["multiStrokeAccuracy"]
        print(f"epoch={epoch} train_loss={running/steps:.4f} train_groups={groups_seen} val_loss={metrics['loss']:.4f} acc={metrics['accuracy']:.4f} macro={metrics['macroClassRecall']:.4f} single={metrics['singleStrokeAccuracy']:.4f} multi={metrics['multiStrokeAccuracy']:.4f}")
        if score > best + 1e-6:
            best = score; stale = 0
            checkpoint = {
                "architecture_version": 4, "contextual_glyph_version": CONTEXTUAL_GLYPH_VERSION,
                "stage": stage, "production_ready": False, "objective": CONTEXTUAL_GLYPH_OBJECTIVE,
                "feature_mode": args.feature_mode, "d_model": cfg.d_model, "vocab_size": len(TOKEN_TO_ID),
                "base_checkpoint_sha256": base_hash, "base_checkpoint_stage": base_ckpt.get("stage"),
                "base_config": cfg.to_dict(), "model": head.state_dict(), "validation": metrics,
                "validation_protocol": protocol, "initialisation": init_meta,
                "training": {"seed": args.seed, "syntheticOnly": synthetic_only,
                             "margin": CONTEXTUAL_GLYPH_MARGIN, "marginWeight": CONTEXTUAL_GLYPH_MARGIN_WEIGHT},
                "evidence": evidence,
            }
            torch.save(checkpoint, out)
            out.with_suffix(".json").write_text(json.dumps({
                "architectureVersion": 4, "contextualGlyphVersion": CONTEXTUAL_GLYPH_VERSION,
                "stage": stage, "productionReady": False, "objective": CONTEXTUAL_GLYPH_OBJECTIVE,
                "featureMode": args.feature_mode, "baseCheckpointSha256": base_hash,
                "validation": metrics, "validationProtocol": protocol, "initialisation": init_meta,
                "training": checkpoint["training"], "evidence": evidence,
            }, indent=2) + "\n")
        else:
            stale += 1
            if stale >= args.patience: print(f"early stopping after {stale} stale epochs"); break
    if not out.exists(): raise SystemExit("contextual glyph training produced no checkpoint")
    print(f"best contextual glyph checkpoint: {out} score={best:.4f}")
    print("production ready: false")


if __name__ == "__main__": main()
