#!/usr/bin/env python3
"""Train Pri Ink Structural V4 with a same-writer development holdout.

This command is intentionally separate from the strict trainer. It is useful for
exercising V4 on one collected writer, but its validation numbers are not
writer-disjoint and are never production evidence.

When initialising from synthetic structural pretraining, an optional small
symbol-only replay stream can preserve rare glyph classes while the real writer
adapts the shared representation. Replay never contributes validation evidence
and never updates grouping/relation losses directly.
"""
from __future__ import annotations

import argparse
import json
import math
from pathlib import Path

import torch
from torch.utils.data import DataLoader

from data import TOKEN_TO_ID
from dev_split import make_same_writer_dev_split
from structural import PriInkStructuralV4, StructuralConfig
from structural_data import StructuralInkDataset, corpus_files, load_structural_examples
from train_structural import (
    evaluate,
    glyph_symbol_loss,
    seed_everything,
    structural_loss,
)


def _forward(model, batch, device):
    return model(
        batch["stroke_points"].to(device),
        batch["stroke_point_valid"].to(device),
        batch["stroke_valid"].to(device),
        batch["stroke_geometry"].to(device),
        batch["raster"].to(device),
    )


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--corpus", required=True)
    p.add_argument("--out", default="tools/ink-foundation/runs/pri-ink-structural-v4-dev.pt")
    p.add_argument("--init", default=None,
                   help="optional V4 checkpoint used only to initialise model weights")
    p.add_argument(
        "--replay-corpus", default=None,
        help="optional SYN4 train corpus used for symbol-only rehearsal during real fine-tuning",
    )
    p.add_argument(
        "--replay-weight", type=float, default=0.20,
        help="weight for synthetic glyph-level symbol rehearsal; grouping/relation are not replayed",
    )
    p.add_argument("--epochs", type=int, default=30)
    p.add_argument("--batch", type=int, default=8)
    p.add_argument("--lr", type=float, default=2e-4)
    p.add_argument("--weight-decay", type=float, default=0.02)
    p.add_argument("--seed", type=int, default=20260824)
    p.add_argument("--holdout-fraction", type=float, default=0.20)
    p.add_argument("--workers", type=int, default=0)
    p.add_argument("--device", default="auto")
    p.add_argument("--d-model", type=int, default=256)
    p.add_argument("--point-layers", type=int, default=2)
    p.add_argument("--stroke-layers", type=int, default=4)
    p.add_argument("--max-strokes", type=int, default=64)
    p.add_argument("--max-points-per-stroke", type=int, default=96)
    p.add_argument("--patience", type=int, default=8)
    args = p.parse_args()

    if not 0.0 <= args.replay_weight <= 1.0:
        raise SystemExit("--replay-weight must be between 0 and 1")

    seed_everything(args.seed)
    raw_examples = load_structural_examples(corpus_files(args.corpus))
    try:
        examples, split_meta = make_same_writer_dev_split(
            raw_examples, seed=args.seed, fraction=args.holdout_fraction
        )
    except ValueError as exc:
        raise SystemExit(str(exc)) from exc

    if args.device == "auto":
        device = torch.device(
            "cuda" if torch.cuda.is_available() else
            "mps" if torch.backends.mps.is_available() else "cpu"
        )
    else:
        device = torch.device(args.device)

    train_examples = [x for x in examples if x.split == "train"]
    val_examples = [x for x in examples if x.split == "validation"]
    multi_groups = sum(
        len(g.get("strokes") or []) > 1
        for x in train_examples for g in (x.structure.get("groups") or [])
    )
    positive_relations = sum(len(x.structure.get("relations") or []) for x in train_examples)
    if multi_groups < 1:
        raise SystemExit("dev training split has no multi-stroke glyph groups")
    if positive_relations < 1:
        raise SystemExit("dev training split has no positive structural relations")

    cfg = StructuralConfig(
        d_model=args.d_model,
        point_layers=args.point_layers,
        stroke_layers=args.stroke_layers,
        max_strokes=args.max_strokes,
        max_points_per_stroke=args.max_points_per_stroke,
    )
    train_ds = StructuralInkDataset(examples, "train", cfg)
    val_ds = StructuralInkDataset(examples, "validation", cfg)
    train_loader = DataLoader(train_ds, batch_size=args.batch, shuffle=True, num_workers=args.workers)
    val_loader = DataLoader(val_ds, batch_size=args.batch, shuffle=False, num_workers=args.workers)

    replay_loader = None
    replay_meta = None
    if args.replay_corpus:
        replay_all = load_structural_examples(corpus_files(args.replay_corpus))
        replay_examples = [
            x for x in replay_all
            if x.split == "train" and x.writer.startswith("SYN4_T_")
        ]
        if not replay_examples:
            raise SystemExit(
                "replay corpus has no SYN4_T_ training examples; refusing an unverified replay source"
            )
        replay_ds = StructuralInkDataset(replay_examples, "train", cfg)
        replay_loader = DataLoader(
            replay_ds,
            batch_size=args.batch,
            shuffle=True,
            num_workers=args.workers,
        )
        replay_meta = {
            "corpus": str(args.replay_corpus),
            "samples": len(replay_examples),
            "writers": len({x.writer for x in replay_examples}),
            "weight": args.replay_weight,
            "objective": "glyph-symbol-only",
            "evidence": False,
        }

    model = PriInkStructuralV4(len(TOKEN_TO_ID), cfg).to(device)
    init_meta = None
    if args.init:
        init_path = Path(args.init)
        if not init_path.exists():
            raise SystemExit(f"initialisation checkpoint not found: {init_path}")
        init_ckpt = torch.load(init_path, map_location="cpu", weights_only=False)
        if int(init_ckpt.get("architecture_version", 0)) != 4:
            raise SystemExit("initialisation checkpoint is not V4")
        if init_ckpt.get("production_ready") is not False:
            raise SystemExit("refusing unsafe initialisation checkpoint claiming production readiness")
        if (init_ckpt.get("vocab") or []) != list(TOKEN_TO_ID.keys()):
            raise SystemExit("initialisation checkpoint vocabulary mismatch")
        init_cfg = StructuralConfig(**init_ckpt["config"])
        if init_cfg.to_dict() != cfg.to_dict():
            raise SystemExit("initialisation checkpoint V4 config does not match fine-tune config")
        model.load_state_dict(init_ckpt["model"], strict=True)
        init_meta = {
            "path": str(init_path),
            "stage": init_ckpt.get("stage"),
            "evidence": init_ckpt.get("evidence"),
            "symbolObjective": init_ckpt.get("symbol_objective"),
        }

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

    print("\nPri Ink Structural V4 — SAME-WRITER DEV MODE")
    print("NOT writer-disjoint · NOT production evidence")
    print(
        f"device={device} writer={split_meta['writer']} train={len(train_examples)} "
        f"validation={len(val_examples)} holdout={split_meta['fraction']:.2f}"
    )
    if init_meta:
        print(f"initialised from: {init_meta['path']} stage={init_meta['stage']}")
    if replay_meta:
        print(
            f"synthetic glyph replay: samples={replay_meta['samples']} "
            f"writers={replay_meta['writers']} weight={replay_meta['weight']:.2f}"
        )
    print(f"parameters={sum(p.numel() for p in model.parameters()):,}")

    for epoch in range(1, args.epochs + 1):
        model.train()
        running = 0.0
        replay_running = 0.0
        steps = 0
        replay_iter = iter(replay_loader) if replay_loader is not None else None

        for batch in train_loader:
            opt.zero_grad(set_to_none=True)
            outputs = _forward(model, batch, device)
            real_loss, _ = structural_loss(outputs, batch, device)
            loss = real_loss

            if replay_iter is not None and args.replay_weight > 0:
                try:
                    replay_batch = next(replay_iter)
                except StopIteration:
                    replay_iter = iter(replay_loader)
                    replay_batch = next(replay_iter)
                replay_outputs = _forward(model, replay_batch, device)
                replay_symbol, _ = glyph_symbol_loss(replay_outputs, replay_batch, device)
                loss = loss + args.replay_weight * replay_symbol
                replay_running += float(replay_symbol.detach())

            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            opt.step(); sched.step()
            running += float(real_loss.detach())
            steps += 1

        metrics = evaluate(model, val_loader, device)
        score = (
            0.45 * metrics["glyph_symbol_accuracy"] +
            0.25 * metrics["group_balanced_accuracy"] +
            0.30 * metrics["relation_positive_accuracy"]
        )
        replay_text = (
            f" replay_symbol={replay_running/max(1, steps):.4f}"
            if replay_loader is not None else ""
        )
        print(
            f"epoch={epoch} train_loss={running/max(1, steps):.4f}{replay_text} "
            f"val_loss={metrics['loss']:.4f} glyph_symbol={metrics['glyph_symbol_accuracy']:.4f} "
            f"stroke_symbol={metrics['stroke_symbol_accuracy']:.4f} "
            f"group_bal={metrics['group_balanced_accuracy']:.4f} "
            f"relation_pos={metrics['relation_positive_accuracy']:.4f} "
            f"relation_none={metrics['relation_none_accuracy']:.4f}"
        )

        if score > best + 1e-5:
            best = score
            stale = 0
            checkpoint = {
                "architecture_version": 4,
                "stage": "structural-research-dev",
                "production_ready": False,
                "config": cfg.to_dict(),
                "vocab": list(TOKEN_TO_ID.keys()),
                "model": model.state_dict(),
                "validation": metrics,
                "dev_split": split_meta,
                "initialisation": init_meta,
                "symbol_objective": "annotated-glyph-group-logprob-v1",
                "synthetic_replay": replay_meta,
                "evidence": (
                    "same-writer development holdout only; not writer-disjoint and not valid "
                    "for production promotion"
                ),
            }
            torch.save(checkpoint, out)
            out.with_suffix(".json").write_text(json.dumps({
                "architectureVersion": 4,
                "stage": "structural-research-dev",
                "productionReady": False,
                "validationProtocol": split_meta,
                "validation": metrics,
                "initialisation": init_meta,
                "symbolObjective": checkpoint["symbol_objective"],
                "syntheticReplay": replay_meta,
                "multiStrokeGroups": multi_groups,
                "positiveRelations": positive_relations,
                "evidence": checkpoint["evidence"],
            }, indent=2) + "\n")
        else:
            stale += 1
            if stale >= args.patience:
                print(f"early stopping after {stale} stale epochs")
                break

    if not out.exists():
        raise SystemExit("V4 dev training did not produce a checkpoint")
    print(f"best DEV checkpoint: {out} score={best:.4f}")
    print("production ready: false")


if __name__ == "__main__":
    main()
