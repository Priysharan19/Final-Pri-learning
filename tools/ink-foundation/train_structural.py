#!/usr/bin/env python3
"""Train the Pri Ink V4 structural research model.

This trainer intentionally refuses unannotated corpora.  V4 grouping/relation
metrics must come from explicit trace-to-glyph supervision rather than guessed
labels.  It runs beside the V3 release path until real writer-disjoint evidence
supports promotion.
"""
from __future__ import annotations

import argparse
import json
import math
import random
from pathlib import Path

import numpy as np
import torch
import torch.nn.functional as F
from torch.utils.data import DataLoader

from data import TOKEN_TO_ID
from structural import PriInkStructuralV4, StructuralConfig
from structural_data import (
    IGNORE_INDEX,
    StructuralInkDataset,
    corpus_files,
    load_structural_examples,
)


def seed_everything(seed: int):
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)


def structural_loss(outputs: dict, batch: dict, device: torch.device):
    symbol_targets = batch["symbol_targets"].to(device)
    group_targets = batch["group_targets"].to(device)
    relation_targets = batch["relation_targets"].to(device)
    pair_valid = outputs["pair_valid"]

    symbol_loss = F.cross_entropy(
        outputs["symbol_logits"].reshape(-1, outputs["symbol_logits"].shape[-1]),
        symbol_targets.reshape(-1),
        ignore_index=IGNORE_INDEX,
        label_smoothing=0.02,
    )

    group_mask = group_targets.ne(float(IGNORE_INDEX)) & pair_valid
    if bool(group_mask.any()):
        group_loss = F.binary_cross_entropy_with_logits(
            outputs["group_logits"][group_mask], group_targets[group_mask]
        )
    else:
        group_loss = outputs["group_logits"].sum() * 0.0

    relation_mask = relation_targets.ne(IGNORE_INDEX) & pair_valid
    if bool(relation_mask.any()):
        relation_loss = F.cross_entropy(
            outputs["relation_logits"][relation_mask], relation_targets[relation_mask]
        )
    else:
        relation_loss = outputs["relation_logits"].sum() * 0.0

    total = symbol_loss + 0.45 * group_loss + 0.55 * relation_loss
    return total, {
        "symbol": symbol_loss.detach(),
        "group": group_loss.detach(),
        "relation": relation_loss.detach(),
    }


@torch.no_grad()
def evaluate(model, loader, device):
    model.eval()
    symbol_ok = symbol_n = 0
    group_ok = group_n = 0
    relation_ok = relation_n = 0
    losses = []
    for batch in loader:
        outputs = model(
            batch["stroke_points"].to(device),
            batch["stroke_point_valid"].to(device),
            batch["stroke_valid"].to(device),
            batch["stroke_geometry"].to(device),
            batch["raster"].to(device),
        )
        loss, _ = structural_loss(outputs, batch, device)
        losses.append(float(loss))

        symbols = batch["symbol_targets"].to(device)
        mask = symbols.ne(IGNORE_INDEX)
        pred = outputs["symbol_logits"].argmax(-1)
        symbol_ok += int((pred[mask] == symbols[mask]).sum())
        symbol_n += int(mask.sum())

        groups = batch["group_targets"].to(device)
        gmask = groups.ne(float(IGNORE_INDEX)) & outputs["pair_valid"]
        gpred = outputs["group_logits"].sigmoid().ge(0.5)
        group_ok += int((gpred[gmask] == groups[gmask].bool()).sum())
        group_n += int(gmask.sum())

        relations = batch["relation_targets"].to(device)
        rmask = relations.ne(IGNORE_INDEX) & outputs["pair_valid"]
        rpred = outputs["relation_logits"].argmax(-1)
        relation_ok += int((rpred[rmask] == relations[rmask]).sum())
        relation_n += int(rmask.sum())

    return {
        "loss": sum(losses) / max(1, len(losses)),
        "symbol_accuracy": symbol_ok / max(1, symbol_n),
        "group_accuracy": group_ok / max(1, group_n),
        "relation_accuracy": relation_ok / max(1, relation_n),
        "symbol_labels": symbol_n,
        "group_labels": group_n,
        "relation_labels": relation_n,
    }


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--corpus", required=True)
    p.add_argument("--out", default="tools/ink-foundation/runs/pri-ink-structural-v4.pt")
    p.add_argument("--epochs", type=int, default=60)
    p.add_argument("--batch", type=int, default=8)
    p.add_argument("--lr", type=float, default=2e-4)
    p.add_argument("--weight-decay", type=float, default=0.02)
    p.add_argument("--seed", type=int, default=20260823)
    p.add_argument("--workers", type=int, default=0)
    p.add_argument("--device", default="auto")
    p.add_argument("--d-model", type=int, default=256)
    p.add_argument("--point-layers", type=int, default=2)
    p.add_argument("--stroke-layers", type=int, default=4)
    p.add_argument("--max-strokes", type=int, default=64)
    p.add_argument("--max-points-per-stroke", type=int, default=96)
    p.add_argument("--patience", type=int, default=10)
    args = p.parse_args()

    seed_everything(args.seed)
    if args.device == "auto":
        device = torch.device(
            "cuda" if torch.cuda.is_available() else
            "mps" if torch.backends.mps.is_available() else "cpu"
        )
    else:
        device = torch.device(args.device)

    examples = load_structural_examples(corpus_files(args.corpus))
    counts = {split: sum(x.split == split for x in examples) for split in {x.split for x in examples}}
    if counts.get("train", 0) < 1 or counts.get("validation", 0) < 1:
        raise SystemExit(
            "V4 requires explicitly structure-annotated train and validation samples; "
            f"found splits={counts}"
        )

    train_writers = {x.writer for x in examples if x.split == "train"}
    val_writers = {x.writer for x in examples if x.split == "validation"}
    overlap = train_writers & val_writers
    if overlap:
        raise SystemExit(f"writer leakage in V4 structural corpus: {sorted(overlap)[:5]}")

    cfg = StructuralConfig(
        d_model=args.d_model,
        point_layers=args.point_layers,
        stroke_layers=args.stroke_layers,
        max_strokes=args.max_strokes,
        max_points_per_stroke=args.max_points_per_stroke,
    )
    train_ds = StructuralInkDataset(examples, "train", cfg)
    val_ds = StructuralInkDataset(examples, "validation", cfg)
    train_loader = DataLoader(
        train_ds, batch_size=args.batch, shuffle=True, num_workers=args.workers
    )
    val_loader = DataLoader(
        val_ds, batch_size=args.batch, shuffle=False, num_workers=args.workers
    )

    model = PriInkStructuralV4(len(TOKEN_TO_ID), cfg).to(device)
    opt = torch.optim.AdamW(
        model.parameters(), lr=args.lr, weight_decay=args.weight_decay, betas=(0.9, 0.98)
    )
    total_steps = max(1, args.epochs * len(train_loader))
    warmup = max(10, total_steps // 20)

    def lr_factor(step: int):
        if step < warmup:
            return max(1e-3, (step + 1) / warmup)
        progress = (step - warmup) / max(1, total_steps - warmup)
        return 0.1 + 0.9 * 0.5 * (1 + math.cos(math.pi * progress))

    sched = torch.optim.lr_scheduler.LambdaLR(opt, lr_factor)
    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    best = -1.0
    stale = 0

    print(
        f"Pri Ink Structural V4 device={device} samples={len(examples)} splits={counts} "
        f"train_writers={len(train_writers)} val_writers={len(val_writers)}"
    )
    print(f"parameters={sum(p.numel() for p in model.parameters()):,}")

    for epoch in range(1, args.epochs + 1):
        model.train()
        running = 0.0
        steps = 0
        for batch in train_loader:
            opt.zero_grad(set_to_none=True)
            outputs = model(
                batch["stroke_points"].to(device),
                batch["stroke_point_valid"].to(device),
                batch["stroke_valid"].to(device),
                batch["stroke_geometry"].to(device),
                batch["raster"].to(device),
            )
            loss, parts = structural_loss(outputs, batch, device)
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            opt.step(); sched.step()
            running += float(loss.detach()); steps += 1

        metrics = evaluate(model, val_loader, device)
        # Structural relation correctness matters most, but grouping and symbol
        # identity must both be healthy before a checkpoint is useful.
        score = (
            0.35 * metrics["symbol_accuracy"] +
            0.30 * metrics["group_accuracy"] +
            0.35 * metrics["relation_accuracy"]
        )
        print(
            f"epoch={epoch} train_loss={running/max(1,steps):.4f} "
            f"val_loss={metrics['loss']:.4f} symbol={metrics['symbol_accuracy']:.4f} "
            f"group={metrics['group_accuracy']:.4f} relation={metrics['relation_accuracy']:.4f}"
        )

        if score > best + 1e-5:
            best = score; stale = 0
            checkpoint = {
                "architecture_version": 4,
                "stage": "structural-research",
                "production_ready": False,
                "config": cfg.to_dict(),
                "vocab": list(TOKEN_TO_ID.keys()),
                "model": model.state_dict(),
                "validation": metrics,
                "evidence": "research only; requires writer-disjoint real-Pencil promotion evidence",
            }
            torch.save(checkpoint, out)
            out.with_suffix(".json").write_text(json.dumps({
                "architectureVersion": 4,
                "stage": "structural-research",
                "productionReady": False,
                "validation": metrics,
                "trainWriters": len(train_writers),
                "validationWriters": len(val_writers),
                "evidence": checkpoint["evidence"],
            }, indent=2) + "\n")
        else:
            stale += 1
            if stale >= args.patience:
                print(f"early stopping after {stale} stale epochs")
                break

    if not out.exists():
        raise SystemExit("V4 training did not produce a checkpoint")
    print(f"best structural checkpoint: {out} score={best:.4f}")


if __name__ == "__main__":
    main()
