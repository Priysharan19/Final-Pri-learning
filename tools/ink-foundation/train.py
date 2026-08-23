#!/usr/bin/env python3
"""Train Pri Learning's locally owned multimodal handwriting model."""
from __future__ import annotations

import argparse
import json
import math
import os
import random
from pathlib import Path

import numpy as np
import torch
import torch.nn.functional as F
from torch.utils.data import DataLoader

from data import (
    BOS_ID, EOS_ID, PAD_ID, VOCAB, InkDataset, corpus_files, decode, load_examples,
)
from model import ModelConfig, PriInkFoundation


def seed_everything(seed: int):
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)


def edit_distance(a: str, b: str) -> int:
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(cur[-1] + 1, prev[j] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


@torch.no_grad()
def greedy_batch(model, batch, device, max_tokens: int) -> list[str]:
    points = batch["points"].to(device)
    valid = batch["point_valid"].to(device)
    raster = batch["raster"].to(device)
    memory, memory_pad, _ = model.encode(points, valid, raster)
    ids = torch.full((points.shape[0], 1), BOS_ID, dtype=torch.long, device=device)
    finished = torch.zeros(points.shape[0], dtype=torch.bool, device=device)
    for _ in range(max_tokens - 1):
        logits = model.decode(memory, memory_pad, ids)
        nxt = logits[:, -1].argmax(-1)
        ids = torch.cat([ids, nxt[:, None]], dim=1)
        finished |= nxt.eq(EOS_ID)
        if bool(finished.all()):
            break
    return [decode(row.tolist()) for row in ids]


@torch.no_grad()
def evaluate(model, loader, device, max_tokens: int, decode_limit: int = 256):
    model.eval()
    total_loss = 0.0
    total_tokens = 0
    exact = 0
    chars_wrong = 0
    chars_total = 0
    decoded = 0
    worst_by_writer: dict[int, list[int]] = {}

    for batch in loader:
        tokens = batch["tokens"].to(device)
        inp, labels = tokens[:, :-1], tokens[:, 1:]
        logits, _ = model(
            batch["points"].to(device), batch["point_valid"].to(device),
            batch["raster"].to(device), inp,
        )
        loss_sum = F.cross_entropy(
            logits.reshape(-1, logits.shape[-1]), labels.reshape(-1),
            ignore_index=PAD_ID, reduction="sum",
        )
        count = int(labels.ne(PAD_ID).sum())
        total_loss += float(loss_sum)
        total_tokens += count

        if decoded < decode_limit:
            pred = greedy_batch(model, batch, device, max_tokens)
            truth = list(batch["target_text"])
            writers = batch["writer"].tolist()
            for p, t, w in zip(pred, truth, writers):
                if decoded >= decode_limit:
                    break
                ok = int(p == t)
                exact += ok
                d = edit_distance(p, t)
                chars_wrong += d
                chars_total += max(1, len(t))
                worst_by_writer.setdefault(int(w), []).append(ok)
                decoded += 1

    worst_writer = min((sum(v) / len(v) for v in worst_by_writer.values()), default=0.0)
    return {
        "loss": total_loss / max(total_tokens, 1),
        "exact": exact / max(decoded, 1),
        "cer": chars_wrong / max(chars_total, 1),
        "worst_writer_exact": worst_writer,
        "decoded": decoded,
    }


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--corpus", default="client/test/ink-corpus", help="corpus JSON file or directory")
    p.add_argument("--out", default="tools/ink-foundation/runs/pri-ink-foundation.pt")
    p.add_argument("--epochs", type=int, default=80)
    p.add_argument("--batch", type=int, default=16)
    p.add_argument("--lr", type=float, default=2e-4)
    p.add_argument("--weight-decay", type=float, default=0.02)
    p.add_argument("--seed", type=int, default=20260823)
    p.add_argument("--workers", type=int, default=min(8, os.cpu_count() or 1))
    p.add_argument("--device", default="auto")
    p.add_argument("--d-model", type=int, default=256)
    p.add_argument("--stroke-layers", type=int, default=8)
    p.add_argument("--decoder-layers", type=int, default=6)
    p.add_argument("--max-points", type=int, default=768)
    p.add_argument("--max-tokens", type=int, default=128)
    p.add_argument("--writer-loss", type=float, default=0.08)
    p.add_argument("--patience", type=int, default=12)
    args = p.parse_args()

    seed_everything(args.seed)
    if args.device == "auto":
        if torch.cuda.is_available():
            device = torch.device("cuda")
        elif torch.backends.mps.is_available():
            device = torch.device("mps")
        else:
            device = torch.device("cpu")
    else:
        device = torch.device(args.device)

    files = corpus_files(args.corpus)
    examples = load_examples(files)
    if not examples:
        raise SystemExit(f"No v2 real-ink samples found under {args.corpus!r}")

    counts = {s: sum(x.split == s for x in examples) for s in {x.split for x in examples}}
    if counts.get("train", 0) < 1 or counts.get("validation", 0) < 1:
        raise SystemExit("Need writer-separated train and validation samples before training.")

    writers = sorted({x.writer for x in examples})
    writer_to_id = {w: i for i, w in enumerate(writers)}
    cfg = ModelConfig(
        d_model=args.d_model,
        stroke_layers=args.stroke_layers,
        decoder_layers=args.decoder_layers,
        max_points=args.max_points,
        max_tokens=args.max_tokens,
    )

    train_ds = InkDataset(examples, "train", cfg.max_points, cfg.max_tokens,
                          cfg.raster_height, cfg.raster_width, writer_to_id)
    val_ds = InkDataset(examples, "validation", cfg.max_points, cfg.max_tokens,
                        cfg.raster_height, cfg.raster_width, writer_to_id)
    train_loader = DataLoader(train_ds, batch_size=args.batch, shuffle=True,
                              num_workers=args.workers, pin_memory=device.type == "cuda")
    val_loader = DataLoader(val_ds, batch_size=args.batch, shuffle=False,
                            num_workers=args.workers, pin_memory=device.type == "cuda")

    model = PriInkFoundation(len(VOCAB), PAD_ID, cfg, writer_classes=len(writers)).to(device)
    opt = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=args.weight_decay,
                            betas=(0.9, 0.98))
    total_steps = max(1, args.epochs * len(train_loader))
    warmup = max(50, total_steps // 20)

    def lr_factor(step: int):
        if step < warmup:
            return max(1e-3, (step + 1) / warmup)
        progress = (step - warmup) / max(1, total_steps - warmup)
        return 0.1 + 0.9 * 0.5 * (1 + math.cos(math.pi * progress))

    sched = torch.optim.lr_scheduler.LambdaLR(opt, lr_factor)
    scaler = torch.amp.GradScaler("cuda", enabled=device.type == "cuda")

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    manifest_path = out.with_suffix(".json")
    best_score = -1e9
    stale = 0
    step = 0

    print(f"device={device} files={len(files)} samples={len(examples)} splits={counts} writers={len(writers)}")
    print(f"parameters={sum(p.numel() for p in model.parameters()):,}")

    for epoch in range(1, args.epochs + 1):
        model.train()
        running = 0.0
        seen = 0
        for batch in train_loader:
            tokens = batch["tokens"].to(device)
            inp, labels = tokens[:, :-1], tokens[:, 1:]
            opt.zero_grad(set_to_none=True)
            autocast_enabled = device.type in {"cuda"}
            with torch.autocast(device_type=device.type, dtype=torch.float16,
                                enabled=autocast_enabled):
                logits, writer_logits = model(
                    batch["points"].to(device), batch["point_valid"].to(device),
                    batch["raster"].to(device), inp,
                )
                token_loss = F.cross_entropy(
                    logits.reshape(-1, logits.shape[-1]), labels.reshape(-1), ignore_index=PAD_ID,
                    label_smoothing=0.03,
                )
                if writer_logits is not None:
                    writer_loss = F.cross_entropy(writer_logits, batch["writer"].to(device))
                    loss = token_loss + args.writer_loss * writer_loss
                else:
                    loss = token_loss

            scaler.scale(loss).backward()
            scaler.unscale_(opt)
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            scaler.step(opt)
            scaler.update()
            sched.step()
            running += float(loss.detach())
            seen += 1
            step += 1

        val = evaluate(model, val_loader, device, cfg.max_tokens)
        # Exact expression match is primary. CER breaks ties, worst-writer score
        # prevents the old failure mode where average accuracy improved while one
        # handwriting style became unusable.
        score = val["exact"] - 0.35 * val["cer"] + 0.20 * val["worst_writer_exact"]
        print(
            f"epoch {epoch:03d} train={running/max(seen,1):.4f} "
            f"val={val['loss']:.4f} exact={100*val['exact']:.2f}% "
            f"CER={100*val['cer']:.2f}% worst-writer={100*val['worst_writer_exact']:.2f}%"
        )

        if score > best_score + 1e-5:
            best_score = score
            stale = 0
            payload = {
                "model": model.state_dict(),
                "config": cfg.to_dict(),
                "vocab": VOCAB,
                "pad_id": PAD_ID,
                "bos_id": BOS_ID,
                "eos_id": EOS_ID,
                "writers": writers,
                "epoch": epoch,
                "validation": val,
                "seed": args.seed,
            }
            torch.save(payload, out)
            manifest_path.write_text(json.dumps({
                "format": "pri-ink-foundation",
                "version": 1,
                "checkpoint": out.name,
                "config": cfg.to_dict(),
                "vocab": VOCAB,
                "validation": val,
                "counts": counts,
                "writerCount": len(writers),
                "seed": args.seed,
                "holdoutPolicy": "final-holdout is never read by train.py",
            }, indent=2), encoding="utf-8")
        else:
            stale += 1
            if stale >= args.patience:
                print(f"early stop after {stale} epochs without validation improvement")
                break

    print(f"best checkpoint: {out}")
    print("Do NOT inspect final-holdout errors while tuning this run.")


if __name__ == "__main__":
    main()
