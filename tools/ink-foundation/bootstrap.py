#!/usr/bin/env python3
"""One-writer development bootstrap for Pri Ink Foundation.

This exists for the exact situation where Pri has only one consenting real
Apple-Pencil writer available. It is deliberately NOT release evidence.

Pipeline role:
  synthetic pretraining -> one-writer bootstrap adaptation -> DEBUG Core ML test

The script creates a deterministic expression-level holdout from the one real
writer only to detect gross overfitting while selecting a development
checkpoint. Because the same human appears on both sides, the resulting metric
is NOT writer-generalisation evidence and can never satisfy Pri's production
release gate.
"""
from __future__ import annotations

import argparse
import json
import math
import os
import random
from pathlib import Path

import torch
import torch.nn.functional as F
from torch.utils.data import DataLoader

from data import BOS_ID, EOS_ID, PAD_ID, VOCAB, Example, InkDataset, corpus_files, load_examples
from model import ModelConfig, PriInkFoundation
from train import evaluate, load_initial_backbone, seed_everything


def make_bootstrap_split(examples: list[Example], seed: int, fraction: float):
    writers = sorted({x.writer for x in examples})
    if len(writers) != 1:
        raise SystemExit(
            f"bootstrap.py requires exactly one real writer; observed {len(writers)}: {writers[:8]}"
        )
    if any(x.split != "train" for x in examples):
        raise SystemExit(
            "One-writer bootstrap consumes train-split data only. Do not reuse validation/test/final-holdout evidence."
        )
    if len(examples) < 20:
        raise SystemExit("Need at least 20 real expressions for a useful one-writer bootstrap; 50 is recommended.")

    fraction = min(0.35, max(0.10, fraction))
    n_val = max(8, int(round(len(examples) * fraction)))
    n_val = min(n_val, len(examples) - 8)
    order = list(range(len(examples)))
    random.Random(seed).shuffle(order)
    val_indices = set(order[:n_val])

    rows: list[Example] = []
    for i, row in enumerate(examples):
        rows.append(Example(
            writer=row.writer,
            split="validation" if i in val_indices else "train",
            target=row.target,
            strokes=row.strokes,
            source=row.source,
        ))
    return rows, writers[0], len(examples) - n_val, n_val


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--corpus", default="client/test/ink-corpus")
    p.add_argument("--init", required=True, help="compatible synthetic pretraining checkpoint")
    p.add_argument("--out", default="tools/ink-foundation/runs/pri-ink-bootstrap.pt")
    p.add_argument("--epochs", type=int, default=40)
    p.add_argument("--batch", type=int, default=8)
    p.add_argument("--lr", type=float, default=5e-5)
    p.add_argument("--weight-decay", type=float, default=0.03)
    p.add_argument("--seed", type=int, default=20260823)
    p.add_argument("--validation-fraction", type=float, default=0.20)
    p.add_argument("--workers", type=int, default=min(4, os.cpu_count() or 1))
    p.add_argument("--device", default="auto")
    p.add_argument("--d-model", type=int, default=192)
    p.add_argument("--stroke-layers", type=int, default=6)
    p.add_argument("--decoder-layers", type=int, default=4)
    p.add_argument("--max-points", type=int, default=768)
    p.add_argument("--max-tokens", type=int, default=96)
    p.add_argument("--patience", type=int, default=8)
    args = p.parse_args()

    seed_everything(args.seed)
    if args.device == "auto":
        device = torch.device(
            "cuda" if torch.cuda.is_available() else
            "mps" if torch.backends.mps.is_available() else "cpu"
        )
    else:
        device = torch.device(args.device)

    files = corpus_files(args.corpus)
    examples = load_examples(files)
    if not examples:
        raise SystemExit(f"No v2 real-ink samples found under {args.corpus!r}")

    examples, writer, train_count, val_count = make_bootstrap_split(
        examples, args.seed, args.validation_fraction
    )
    writer_to_id = {writer: 0}

    cfg = ModelConfig(
        d_model=args.d_model,
        stroke_layers=args.stroke_layers,
        decoder_layers=args.decoder_layers,
        max_points=args.max_points,
        max_tokens=args.max_tokens,
    )
    train_ds = InkDataset(
        examples, "train", cfg.max_points, cfg.max_tokens,
        cfg.raster_height, cfg.raster_width, writer_to_id,
    )
    val_ds = InkDataset(
        examples, "validation", cfg.max_points, cfg.max_tokens,
        cfg.raster_height, cfg.raster_width, writer_to_id,
    )
    train_loader = DataLoader(
        train_ds, batch_size=args.batch, shuffle=True,
        num_workers=args.workers, pin_memory=device.type == "cuda",
    )
    val_loader = DataLoader(
        val_ds, batch_size=args.batch, shuffle=False,
        num_workers=args.workers, pin_memory=device.type == "cuda",
    )

    model = PriInkFoundation(len(VOCAB), PAD_ID, cfg, writer_classes=1)
    init_meta = load_initial_backbone(model, args.init)
    if init_meta.get("stage") != "pretrain":
        raise SystemExit("bootstrap initialization must come from a synthetic pretrain checkpoint")
    model = model.to(device)

    opt = torch.optim.AdamW(
        model.parameters(), lr=args.lr, weight_decay=args.weight_decay, betas=(0.9, 0.98)
    )
    total_steps = max(1, args.epochs * len(train_loader))
    warmup = max(10, total_steps // 20)

    def lr_factor(step: int):
        if step < warmup:
            return max(1e-3, (step + 1) / warmup)
        progress = (step - warmup) / max(1, total_steps - warmup)
        return 0.15 + 0.85 * 0.5 * (1 + math.cos(math.pi * progress))

    sched = torch.optim.lr_scheduler.LambdaLR(opt, lr_factor)
    scaler = torch.amp.GradScaler("cuda", enabled=device.type == "cuda")

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    manifest_path = out.with_suffix(".json")
    best_score = -1e9
    stale = 0

    print(
        f"stage=bootstrap device={device} writer={writer} "
        f"real-train={train_count} same-writer-dev-val={val_count}"
    )
    print(f"initialized backbone from {args.init}")
    print(f"parameters={sum(p.numel() for p in model.parameters()):,}")
    print("WARNING: same-writer validation is a development signal only, NOT writer-generalisation evidence.")

    for epoch in range(1, args.epochs + 1):
        model.train()
        running = 0.0
        seen = 0
        for batch in train_loader:
            labels = batch["tokens"].to(device)
            opt.zero_grad(set_to_none=True)
            with torch.autocast(
                device_type=device.type, dtype=torch.float16, enabled=device.type == "cuda"
            ):
                logits, _ = model(
                    batch["points"].to(device),
                    batch["point_valid"].to(device),
                    batch["raster"].to(device),
                )
                loss = F.cross_entropy(
                    logits.reshape(-1, logits.shape[-1]),
                    labels.reshape(-1),
                    ignore_index=PAD_ID,
                    label_smoothing=0.04,
                )
            scaler.scale(loss).backward()
            scaler.unscale_(opt)
            torch.nn.utils.clip_grad_norm_(model.parameters(), 0.8)
            scaler.step(opt)
            scaler.update()
            sched.step()
            running += float(loss.detach())
            seen += 1

        val = evaluate(model, val_loader, device)
        score = val["exact"] - 0.40 * val["cer"]
        print(
            f"epoch {epoch:03d} train={running/max(seen,1):.4f} "
            f"same-writer-dev-val={val['loss']:.4f} "
            f"exact={100*val['exact']:.2f}% CER={100*val['cer']:.2f}%"
        )

        if score > best_score + 1e-5:
            best_score = score
            stale = 0
            torch.save({
                "model": model.state_dict(),
                "config": cfg.to_dict(),
                "vocab": VOCAB,
                "pad_id": PAD_ID,
                "bos_id": BOS_ID,
                "eos_id": EOS_ID,
                "train_writers": [writer],
                "epoch": epoch,
                "validation": val,
                "seed": args.seed,
                "stage": "bootstrap",
                "initialized_from": str(args.init),
                "release_eligible": False,
                "bootstrap_train_samples": train_count,
                "bootstrap_validation_samples": val_count,
            }, out)
            manifest_path.write_text(json.dumps({
                "format": "pri-ink-foundation",
                "version": 2,
                "stage": "bootstrap",
                "evidence": "same-writer development holdout — NOT generalisation evidence",
                "releaseEligible": False,
                "decoder": "parallel-output-queries",
                "checkpoint": out.name,
                "config": cfg.to_dict(),
                "vocab": VOCAB,
                "validation": val,
                "realWriterCount": 1,
                "realTrainSamples": train_count,
                "sameWriterValidationSamples": val_count,
                "seed": args.seed,
                "initializedFrom": str(args.init),
                "holdoutPolicy": "No test/final-holdout data is read. Production release remains forbidden.",
            }, indent=2), encoding="utf-8")
        else:
            stale += 1
            if stale >= args.patience:
                print(f"early stop after {stale} epochs without bootstrap validation improvement")
                break

    print(f"best bootstrap checkpoint: {out}")
    print("DEVELOPMENT ONLY — one real writer cannot validate arbitrary-user handwriting accuracy.")
    print("The checkpoint stage is 'bootstrap', so Pri's production release gate cannot promote it.")


if __name__ == "__main__":
    main()
