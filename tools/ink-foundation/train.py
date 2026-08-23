#!/usr/bin/env python3
"""Train Pri Learning's locally owned multimodal handwriting model.

Stages:
  pretrain  — Pri-owned synthetic whole-expression writers; initialization only.
  finetune  — consented, writer-separated real Pencil corpus; release evidence.

V3 optimizes four signals together:
  1. whole-expression token transcription;
  2. point-stream CTC alignment (training only);
  3. writer-ID style supervision;
  4. supervised contrastive style consistency across different expressions from
     the same writer.

Only (1) is required at inference. The auxiliary heads teach a much stronger
representation without adding another Core ML call on iPad.
"""
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

from data import BOS_ID, EOS_ID, PAD_ID, VOCAB, InkDataset, corpus_files, decode, load_examples
from model import ModelConfig, PriInkFoundation


def seed_everything(seed: int):
    random.seed(seed); np.random.seed(seed); torch.manual_seed(seed)
    if torch.cuda.is_available(): torch.cuda.manual_seed_all(seed)


def edit_distance(a: str, b: str) -> int:
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(cur[-1] + 1, prev[j] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


@torch.no_grad()
def evaluate(model, loader, device, decode_limit: int = 512):
    model.eval()
    total_loss = 0.0; total_tokens = 0
    exact = 0; chars_wrong = 0; chars_total = 0; decoded_n = 0
    by_writer: dict[int, list[int]] = {}
    for batch in loader:
        labels = batch["tokens"].to(device)
        logits, _ = model(
            batch["points"].to(device), batch["point_valid"].to(device),
            batch["raster"].to(device),
        )
        total_loss += float(F.cross_entropy(
            logits.reshape(-1, logits.shape[-1]), labels.reshape(-1),
            ignore_index=PAD_ID, reduction="sum",
        ))
        total_tokens += int(labels.ne(PAD_ID).sum())

        if decoded_n < decode_limit:
            pred = [decode(row.tolist()) for row in logits.argmax(-1).cpu()]
            for p, t, w in zip(pred, list(batch["target_text"]), batch["writer"].tolist()):
                if decoded_n >= decode_limit: break
                ok = int(p == t)
                exact += ok
                chars_wrong += edit_distance(p, t)
                chars_total += max(1, len(t))
                by_writer.setdefault(int(w), []).append(ok)
                decoded_n += 1

    worst_writer = min((sum(v) / len(v) for v in by_writer.values()), default=0.0)
    return {
        "loss": total_loss / max(total_tokens, 1),
        "exact": exact / max(decoded_n, 1),
        "cer": chars_wrong / max(chars_total, 1),
        "worst_writer_exact": worst_writer,
        "decoded": decoded_n,
    }


def supervised_contrastive_style_loss(style: torch.Tensor, writer: torch.Tensor,
                                      temperature: float = 0.12) -> torch.Tensor:
    """Pull different equations by the same writer together in style space.

    Batches that contain no repeated writer contribute zero rather than making a
    fake negative-only objective. Writer classification still supervises those.
    """
    if style.shape[0] < 2:
        return style.sum() * 0.0
    z = F.normalize(style, dim=-1)
    logits = (z @ z.transpose(0, 1)) / temperature
    eye = torch.eye(style.shape[0], dtype=torch.bool, device=style.device)
    positives = writer[:, None].eq(writer[None, :]) & ~eye
    anchors = positives.any(dim=1)
    if not bool(anchors.any()):
        return style.sum() * 0.0

    logits = logits - logits.max(dim=1, keepdim=True).values.detach()
    exp_logits = torch.exp(logits).masked_fill(eye, 0.0)
    log_prob = logits - torch.log(exp_logits.sum(dim=1, keepdim=True).clamp_min(1e-9))
    pos_count = positives.sum(dim=1).clamp_min(1)
    per_anchor = -(log_prob * positives.to(log_prob.dtype)).sum(dim=1) / pos_count
    return per_anchor[anchors].mean()


def ctc_alignment_loss(ctc_logits: torch.Tensor, labels: torch.Tensor,
                       point_valid: torch.Tensor) -> torch.Tensor:
    """Online point sequence -> token alignment, using PAD as the blank class."""
    target_mask = labels.ne(PAD_ID) & labels.ne(EOS_ID)
    target_lengths = target_mask.sum(dim=1).to(torch.long)
    input_lengths = point_valid.sum(dim=1).to(torch.long)
    if int(target_lengths.max()) == 0:
        return ctc_logits.sum() * 0.0
    targets = labels[target_mask].to(torch.long)
    log_probs = F.log_softmax(ctc_logits, dim=-1).transpose(0, 1)  # T,B,C
    return F.ctc_loss(
        log_probs, targets, input_lengths, target_lengths,
        blank=PAD_ID, reduction="mean", zero_infinity=True,
    )


def load_initial_backbone(model: PriInkFoundation, path: str):
    """Load compatible pretraining weights while allowing explicit V2 -> V3 migration.

    V3 adds 2-D raster position embeddings and a training-only CTC head. Those
    parameters do not exist in V2 and are intentionally initialized fresh. Every
    older tensor that should transfer still has to match exactly.
    """
    ckpt = torch.load(path, map_location="cpu", weights_only=False)
    prior_vocab = ckpt.get("vocab")
    if prior_vocab != VOCAB:
        raise SystemExit("--init checkpoint uses a different token vocabulary")

    current = model.state_dict()
    incoming = ckpt.get("model") or {}
    new_v3 = (
        "raster_encoder.row_pos.weight",
        "raster_encoder.col_pos.weight",
        "ctc_output.weight",
        "ctc_output.bias",
    )
    usable = {}
    mismatched = []
    for key, value_now in current.items():
        if key.startswith("writer_head.") or key in new_v3:
            continue
        value = incoming.get(key)
        if value is None or tuple(value.shape) != tuple(value_now.shape):
            mismatched.append(key)
        else:
            usable[key] = value
    if mismatched:
        preview = ", ".join(mismatched[:8])
        raise SystemExit(f"--init architecture mismatch in {len(mismatched)} backbone tensors: {preview}")

    missing, unexpected = model.load_state_dict(usable, strict=False)
    allowed_missing = set(new_v3) | {k for k in current if k.startswith("writer_head.")}
    bad_missing = [k for k in missing if k not in allowed_missing]
    bad_unexpected = [k for k in unexpected if not k.startswith("writer_head.")]
    if bad_missing or bad_unexpected:
        raise SystemExit(f"--init did not load cleanly: missing={bad_missing[:5]} unexpected={bad_unexpected[:5]}")
    return ckpt


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--corpus", default="client/test/ink-corpus")
    p.add_argument("--out", default="tools/ink-foundation/runs/pri-ink-foundation.pt")
    p.add_argument("--init", default=None, help="compatible pretraining checkpoint to fine-tune")
    p.add_argument("--stage", choices=["pretrain", "finetune"], default="finetune")
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
    p.add_argument("--max-tokens", type=int, default=96)
    p.add_argument("--writer-loss", type=float, default=0.08)
    p.add_argument("--ctc-loss", type=float, default=0.12)
    p.add_argument("--style-contrast", type=float, default=0.05)
    p.add_argument("--patience", type=int, default=12)
    args = p.parse_args()

    if args.stage == "pretrain" and args.init:
        raise SystemExit("pretrain starts from scratch; --init belongs to real-writer fine-tuning")

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
        raise SystemExit(f"No v2 ink samples found under {args.corpus!r}")
    counts = {s: sum(x.split == s for x in examples) for s in {x.split for x in examples}}
    if counts.get("train", 0) < 1 or counts.get("validation", 0) < 1:
        raise SystemExit("Need writer-separated train and validation samples before training.")

    train_writers = sorted({x.writer for x in examples if x.split == "train"})
    heldout_writers = sorted({x.writer for x in examples if x.writer not in set(train_writers)})
    writers = train_writers + heldout_writers
    writer_to_id = {w: i for i, w in enumerate(writers)}

    cfg = ModelConfig(
        d_model=args.d_model, stroke_layers=args.stroke_layers,
        decoder_layers=args.decoder_layers, max_points=args.max_points,
        max_tokens=args.max_tokens, architecture_version=3,
    )
    train_ds = InkDataset(examples, "train", cfg.max_points, cfg.max_tokens,
                          cfg.raster_height, cfg.raster_width, writer_to_id)
    val_ds = InkDataset(examples, "validation", cfg.max_points, cfg.max_tokens,
                        cfg.raster_height, cfg.raster_width, writer_to_id)
    train_loader = DataLoader(train_ds, batch_size=args.batch, shuffle=True,
                              num_workers=args.workers, pin_memory=device.type == "cuda")
    val_loader = DataLoader(val_ds, batch_size=args.batch, shuffle=False,
                            num_workers=args.workers, pin_memory=device.type == "cuda")

    model = PriInkFoundation(len(VOCAB), PAD_ID, cfg, writer_classes=len(train_writers))
    init_meta = None
    if args.init:
        init_meta = load_initial_backbone(model, args.init)
    model = model.to(device)

    opt = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=args.weight_decay, betas=(0.9, 0.98))
    total_steps = max(1, args.epochs * len(train_loader)); warmup = max(50, total_steps // 20)
    def lr_factor(step: int):
        if step < warmup: return max(1e-3, (step + 1) / warmup)
        progress = (step - warmup) / max(1, total_steps - warmup)
        return 0.1 + 0.9 * 0.5 * (1 + math.cos(math.pi * progress))
    sched = torch.optim.lr_scheduler.LambdaLR(opt, lr_factor)
    scaler = torch.amp.GradScaler("cuda", enabled=device.type == "cuda")

    out = Path(args.out); out.parent.mkdir(parents=True, exist_ok=True)
    manifest_path = out.with_suffix(".json")
    best_score = -1e9; stale = 0
    print(f"stage={args.stage} architecture=v{cfg.architecture_version} device={device} files={len(files)} samples={len(examples)} splits={counts} train-writers={len(train_writers)}")
    print(f"parameters={sum(p.numel() for p in model.parameters()):,}")
    if args.init:
        print(f"initialized transferable backbone from {args.init} (stage={init_meta.get('stage', 'unknown')})")

    for epoch in range(1, args.epochs + 1):
        model.train(); running = 0.0; seen = 0
        running_token = running_ctc = running_style = 0.0
        for batch in train_loader:
            labels = batch["tokens"].to(device)
            point_valid = batch["point_valid"].to(device)
            writers_batch = batch["writer"].to(device)
            opt.zero_grad(set_to_none=True)
            with torch.autocast(device_type=device.type, dtype=torch.float16, enabled=device.type == "cuda"):
                logits, writer_logits, ctc_logits, style = model.forward_with_aux(
                    batch["points"].to(device), point_valid,
                    batch["raster"].to(device),
                )
                token_loss = F.cross_entropy(
                    logits.reshape(-1, logits.shape[-1]), labels.reshape(-1),
                    ignore_index=PAD_ID, label_smoothing=0.03,
                )
                ctc_loss = ctc_alignment_loss(ctc_logits.float(), labels, point_valid)
                style_loss = supervised_contrastive_style_loss(style.float(), writers_batch)
                loss = token_loss + args.ctc_loss * ctc_loss + args.style_contrast * style_loss
                if writer_logits is not None:
                    writer_loss = F.cross_entropy(writer_logits, writers_batch)
                    loss = loss + args.writer_loss * writer_loss
            scaler.scale(loss).backward(); scaler.unscale_(opt)
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            scaler.step(opt); scaler.update(); sched.step()
            running += float(loss.detach());
            running_token += float(token_loss.detach());
            running_ctc += float(ctc_loss.detach());
            running_style += float(style_loss.detach());
            seen += 1

        val = evaluate(model, val_loader, device)
        score = val["exact"] - 0.35 * val["cer"] + 0.20 * val["worst_writer_exact"]
        label = "synthetic-val" if args.stage == "pretrain" else "real-val"
        print(
            f"epoch {epoch:03d} train={running/max(seen,1):.4f} "
            f"token={running_token/max(seen,1):.4f} ctc={running_ctc/max(seen,1):.4f} "
            f"style={running_style/max(seen,1):.4f} {label}={val['loss']:.4f} "
            f"exact={100*val['exact']:.2f}% CER={100*val['cer']:.2f}% "
            f"worst-writer={100*val['worst_writer_exact']:.2f}%"
        )

        if score > best_score + 1e-5:
            best_score = score; stale = 0
            torch.save({
                "model": model.state_dict(), "config": cfg.to_dict(), "vocab": VOCAB,
                "pad_id": PAD_ID, "bos_id": BOS_ID, "eos_id": EOS_ID,
                "train_writers": train_writers, "epoch": epoch,
                "validation": val, "seed": args.seed, "stage": args.stage,
                "initialized_from": str(args.init) if args.init else None,
                "architecture_version": cfg.architecture_version,
                "auxiliary_losses": {"ctc": args.ctc_loss, "style_contrast": args.style_contrast, "writer": args.writer_loss},
            }, out)
            manifest_path.write_text(json.dumps({
                "format": "pri-ink-foundation", "version": 3,
                "architectureVersion": cfg.architecture_version,
                "stage": args.stage,
                "evidence": "synthetic initialization only" if args.stage == "pretrain" else "writer-separated real validation",
                "decoder": "parallel-output-queries+2d-visual+ctc-aux", "checkpoint": out.name,
                "config": cfg.to_dict(), "vocab": VOCAB, "validation": val,
                "counts": counts, "trainWriterCount": len(train_writers), "seed": args.seed,
                "initializedFrom": str(args.init) if args.init else None,
                "auxiliaryLossWeights": {"ctc": args.ctc_loss, "styleContrast": args.style_contrast, "writer": args.writer_loss},
                "holdoutPolicy": "final-holdout is not evaluated by train.py",
            }, indent=2), encoding="utf-8")
        else:
            stale += 1
            if stale >= args.patience:
                print(f"early stop after {stale} epochs without validation improvement")
                break

    print(f"best checkpoint: {out}")
    if args.stage == "pretrain":
        print("PRETRAIN ONLY — do not report this checkpoint's score as real handwriting accuracy.")
    else:
        print("Real validation selected the checkpoint. Do NOT inspect final-holdout errors while tuning.")


if __name__ == "__main__":
    main()
