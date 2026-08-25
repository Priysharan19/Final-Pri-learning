#!/usr/bin/env python3
"""Train Pri Ink Foundation V4 for unseen-writer generalisation.

This track is intentionally separate from V3 release training. It combines two
coherent views of the same Pencil expression, writer-style domain randomisation,
content invariance and style-aware adaptation. V4 also uses an append-only data
contract so calculus symbols already present in the collector can be learned
without invalidating V3 checkpoint token IDs.
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
from torch.utils.data import DataLoader, Dataset

from data_v4 import (
    BOS_ID,
    EOS_ID,
    PAD_ID,
    VOCAB,
    canonical_text,
    corpus_files,
    decode,
    encode,
    encode_physical,
    load_examples,
    physical_text,
    point_features,
    rasterize,
)
from model import ModelConfig
from model_v4 import PriInkFoundationV4
from style_augmentation import augmented_strokes
from train import _expanded_vocab_tensor, ctc_alignment_loss, edit_distance, seed_everything


class MultiViewInkDataset(Dataset):
    """Two coherent handwriting-style views with identical maths supervision."""

    def __init__(
        self,
        examples,
        split: str,
        config: ModelConfig,
        writer_to_id: dict[str, int],
        base_seed: int = 20260825,
    ):
        self.rows = [x for x in examples if x.split == split]
        self.split = split
        self.config = config
        self.writer_to_id = writer_to_id
        self.base_seed = int(base_seed)

    def __len__(self):
        return len(self.rows)

    def _view(self, strokes, seed: int, augment: bool):
        source = augmented_strokes(strokes, seed) if augment else strokes
        # Augmentation has already happened coherently on raw strokes. Do not
        # independently perturb point/raster modalities again here.
        points, valid = point_features(source, self.config.max_points, augment=False)
        raster = rasterize(
            source,
            self.config.raster_height,
            self.config.raster_width,
            augment=False,
        )
        return points, valid, raster

    def __getitem__(self, index: int):
        row = self.rows[index]
        train = self.split == "train"
        if train:
            # DataLoader workers receive independent Python RNG states; mixing in
            # the index makes accidental duplicate view seeds vanishingly rare.
            salt = random.getrandbits(48) ^ (index * 0x9E3779B1) ^ self.base_seed
            seed_a = salt & 0x7FFFFFFF
            seed_b = (salt ^ 0x5DEECE66D) & 0x7FFFFFFF
        else:
            seed_a = seed_b = self.base_seed + index

        pa, va, ra = self._view(row.strokes, seed_a, train)
        pb, vb, rb = self._view(row.strokes, seed_b, train)

        ids = encode(row.target, self.config.max_tokens)
        tokens = np.full(self.config.max_tokens, PAD_ID, dtype=np.int64)
        tokens[: len(ids)] = ids
        physical = encode_physical(row.target, self.config.max_tokens)
        ctc = np.full(self.config.max_tokens, PAD_ID, dtype=np.int64)
        ctc[: len(physical)] = physical

        return {
            "points_a": torch.from_numpy(pa),
            "valid_a": torch.from_numpy(va),
            "raster_a": torch.from_numpy(ra),
            "points_b": torch.from_numpy(pb),
            "valid_b": torch.from_numpy(vb),
            "raster_b": torch.from_numpy(rb),
            "tokens": torch.from_numpy(tokens),
            "ctc_tokens": torch.from_numpy(ctc),
            "ctc_length": torch.tensor(len(physical), dtype=torch.long),
            "writer": torch.tensor(self.writer_to_id[row.writer], dtype=torch.long),
            "target_text": canonical_text(row.target),
            "physical_text": physical_text(row.target),
        }


def _masked_token_kl(
    a: torch.Tensor, b: torch.Tensor, labels: torch.Tensor
) -> torch.Tensor:
    """Symmetric KL between two style views over supervised output positions."""
    mask = labels.ne(PAD_ID)
    if not bool(mask.any()):
        return a.sum() * 0.0
    log_a = F.log_softmax(a.float(), dim=-1)
    log_b = F.log_softmax(b.float(), dim=-1)
    prob_a = log_a.exp().detach()
    prob_b = log_b.exp().detach()
    kl_ab = F.kl_div(log_a, prob_b, reduction="none").sum(-1)
    kl_ba = F.kl_div(log_b, prob_a, reduction="none").sum(-1)
    return (0.5 * (kl_ab + kl_ba))[mask].mean()


def _content_consistency(a: torch.Tensor, b: torch.Tensor) -> torch.Tensor:
    return (1.0 - F.cosine_similarity(a.float(), b.float(), dim=-1)).mean()


def _transfer_v3_or_v4(model: PriInkFoundationV4, path: str) -> dict:
    """Seed V4 from V3/V4 while preserving append-only vocabulary rows.

    Old V3 token rows are copied by token NAME into V4. Newly added V4 symbols
    remain freshly initialized. Writer classifiers are corpus-specific and are
    always re-created.
    """
    checkpoint = torch.load(path, map_location="cpu", weights_only=False)
    prior_vocab = checkpoint.get("vocab") or []
    if not prior_vocab:
        raise SystemExit("V4 --init checkpoint has no vocabulary metadata")
    unknown_old = [token for token in prior_vocab if token not in VOCAB]
    if unknown_old:
        raise SystemExit(
            f"V4 --init checkpoint contains unsupported tokens: {unknown_old[:8]}"
        )

    incoming = checkpoint.get("model") or {}
    current = model.state_dict()
    transferable = {}
    skipped = []
    vocab_rows = {
        "output.weight",
        "output.bias",
        "ctc_output.weight",
        "ctc_output.bias",
    }

    for key, value in incoming.items():
        now = current.get(key)
        if now is None:
            skipped.append(key)
            continue
        if key.startswith("writer_head.") or key.startswith("content_writer_head."):
            skipped.append(key)
            continue
        if key in vocab_rows:
            compatible_tail = (
                value.ndim == now.ndim
                and tuple(value.shape[1:]) == tuple(now.shape[1:])
            )
            if not compatible_tail:
                skipped.append(key)
                continue
            transferable[key] = _expanded_vocab_tensor(
                now, value, prior_vocab, VOCAB
            )
            continue
        if tuple(now.shape) != tuple(value.shape):
            skipped.append(key)
            continue
        transferable[key] = value

    missing, unexpected = model.load_state_dict(transferable, strict=False)
    backbone_missing = [
        key
        for key in missing
        if not key.startswith("writer_head.")
        and not key.startswith("content_writer_head.")
        and not key.startswith("content_norm.")
    ]
    if int(checkpoint.get("architecture_version") or 0) >= 4 and backbone_missing:
        raise SystemExit(
            f"V4 -> V4 transfer unexpectedly lost tensors: {backbone_missing[:8]}"
        )
    return {
        "checkpoint": checkpoint,
        "transferred": len(transferable),
        "skipped": skipped,
        "new": missing,
        "unexpected": unexpected,
        "prior_vocab_size": len(prior_vocab),
        "v4_vocab_size": len(VOCAB),
    }


@torch.no_grad()
def evaluate(model, loader, device, decode_limit: int = 1024):
    model.eval()
    exact = wrong = chars = decoded = 0
    total_loss = total_tokens = 0.0
    by_writer: dict[int, list[int]] = {}
    for batch in loader:
        labels = batch["tokens"].to(device)
        logits, _ = model(
            batch["points_a"].to(device),
            batch["valid_a"].to(device),
            batch["raster_a"].to(device),
        )
        total_loss += float(
            F.cross_entropy(
                logits.reshape(-1, logits.shape[-1]),
                labels.reshape(-1),
                ignore_index=PAD_ID,
                reduction="sum",
            )
        )
        total_tokens += int(labels.ne(PAD_ID).sum())
        if decoded >= decode_limit:
            continue
        predictions = [decode(row.tolist()) for row in logits.argmax(-1).cpu()]
        for pred, truth, writer in zip(
            predictions,
            list(batch["target_text"]),
            batch["writer"].tolist(),
        ):
            if decoded >= decode_limit:
                break
            ok = int(pred == truth)
            exact += ok
            wrong += edit_distance(pred, truth)
            chars += max(1, len(truth))
            by_writer.setdefault(int(writer), []).append(ok)
            decoded += 1
    writer_scores = [sum(v) / len(v) for v in by_writer.values() if v]
    return {
        "loss": total_loss / max(total_tokens, 1),
        "exact": exact / max(decoded, 1),
        "cer": wrong / max(chars, 1),
        "worst_writer_exact": min(writer_scores, default=0.0),
        "decoded": decoded,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--corpus", default="client/test/ink-corpus")
    parser.add_argument(
        "--out", default="tools/ink-foundation/runs/pri-ink-foundation-v4.pt"
    )
    parser.add_argument("--init", default=None)
    parser.add_argument(
        "--stage", choices=["pretrain", "finetune"], default="finetune"
    )
    parser.add_argument("--epochs", type=int, default=80)
    parser.add_argument("--batch", type=int, default=12)
    parser.add_argument("--lr", type=float, default=1.5e-4)
    parser.add_argument("--weight-decay", type=float, default=0.03)
    parser.add_argument("--seed", type=int, default=20260825)
    parser.add_argument("--workers", type=int, default=min(8, os.cpu_count() or 1))
    parser.add_argument("--device", default="auto")
    parser.add_argument("--d-model", type=int, default=256)
    parser.add_argument("--stroke-layers", type=int, default=8)
    parser.add_argument("--decoder-layers", type=int, default=6)
    parser.add_argument("--max-points", type=int, default=768)
    parser.add_argument("--max-tokens", type=int, default=96)
    parser.add_argument("--style-dropout", type=float, default=0.20)
    parser.add_argument("--writer-style-loss", type=float, default=0.04)
    parser.add_argument("--content-adversary-loss", type=float, default=0.06)
    parser.add_argument("--ctc-loss", type=float, default=0.12)
    parser.add_argument("--view-consistency-loss", type=float, default=0.10)
    parser.add_argument("--content-consistency-loss", type=float, default=0.06)
    parser.add_argument("--patience", type=int, default=14)
    args = parser.parse_args()

    seed_everything(args.seed)
    if args.device == "auto":
        device = torch.device(
            "cuda"
            if torch.cuda.is_available()
            else "mps"
            if torch.backends.mps.is_available()
            else "cpu"
        )
    else:
        device = torch.device(args.device)

    examples = load_examples(corpus_files(args.corpus))
    if not examples:
        raise SystemExit(f"No v2 ink samples found under {args.corpus!r}")
    counts = {
        split: sum(x.split == split for x in examples)
        for split in {x.split for x in examples}
    }
    if counts.get("train", 0) < 1 or counts.get("validation", 0) < 1:
        raise SystemExit(
            "V4 training requires writer-separated train and validation samples"
        )

    train_writers = sorted({x.writer for x in examples if x.split == "train"})
    val_writers = sorted({x.writer for x in examples if x.split == "validation"})
    overlap = sorted(set(train_writers) & set(val_writers))
    if overlap:
        raise SystemExit(f"writer leakage between train and validation: {overlap[:8]}")
    train_writer_set = set(train_writers)
    all_writers = train_writers + [
        writer for writer in val_writers if writer not in train_writer_set
    ]
    writer_to_id = {writer: i for i, writer in enumerate(all_writers)}

    cfg = ModelConfig(
        d_model=args.d_model,
        stroke_layers=args.stroke_layers,
        decoder_layers=args.decoder_layers,
        max_points=args.max_points,
        max_tokens=args.max_tokens,
        architecture_version=4,
    )
    train_ds = MultiViewInkDataset(
        examples, "train", cfg, writer_to_id, args.seed
    )
    val_ds = MultiViewInkDataset(
        examples, "validation", cfg, writer_to_id, args.seed
    )
    train_loader = DataLoader(
        train_ds,
        batch_size=args.batch,
        shuffle=True,
        num_workers=args.workers,
        pin_memory=device.type == "cuda",
    )
    val_loader = DataLoader(
        val_ds,
        batch_size=args.batch,
        shuffle=False,
        num_workers=args.workers,
        pin_memory=device.type == "cuda",
    )

    model = PriInkFoundationV4(
        len(VOCAB),
        PAD_ID,
        cfg,
        writer_classes=len(train_writers),
        style_dropout=args.style_dropout,
    )
    transfer = None
    if args.init:
        transfer = _transfer_v3_or_v4(model, args.init)
    model = model.to(device)

    optimizer = torch.optim.AdamW(
        model.parameters(),
        lr=args.lr,
        weight_decay=args.weight_decay,
        betas=(0.9, 0.98),
    )
    total_steps = max(1, args.epochs * len(train_loader))
    warmup = max(25, total_steps // 20)

    def lr_factor(step: int):
        if step < warmup:
            return max(1e-3, (step + 1) / warmup)
        progress = (step - warmup) / max(1, total_steps - warmup)
        return 0.1 + 0.9 * 0.5 * (1.0 + math.cos(math.pi * progress))

    scheduler = torch.optim.lr_scheduler.LambdaLR(optimizer, lr_factor)
    scaler = torch.amp.GradScaler("cuda", enabled=device.type == "cuda")

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    manifest = out.with_suffix(".json")
    best_score = -1e9
    stale = 0
    step = 0

    print(
        f"Pri Ink V4 stage={args.stage} device={device} samples={len(examples)} "
        f"train-writers={len(train_writers)} validation-writers={len(val_writers)} "
        f"vocab={len(VOCAB)}"
    )
    print(f"parameters={sum(p.numel() for p in model.parameters()):,}")
    if transfer:
        print(
            f"seed transfer: {transfer['transferred']} tensors from {args.init} "
            f"({transfer['prior_vocab_size']} -> {transfer['v4_vocab_size']} tokens)"
        )

    for epoch in range(1, args.epochs + 1):
        model.train()
        sums = {
            "loss": 0.0,
            "token": 0.0,
            "ctc": 0.0,
            "view": 0.0,
            "content": 0.0,
            "style_writer": 0.0,
            "adversary": 0.0,
        }
        batches = 0
        for batch in train_loader:
            labels = batch["tokens"].to(device)
            writers = batch["writer"].to(device)
            ctc_tokens = batch["ctc_tokens"].to(device)
            ctc_lengths = batch["ctc_length"].to(device)
            valid_a = batch["valid_a"].to(device)
            valid_b = batch["valid_b"].to(device)
            progress = step / max(total_steps - 1, 1)
            adversary_strength = 2.0 / (1.0 + math.exp(-10.0 * progress)) - 1.0
            optimizer.zero_grad(set_to_none=True)

            with torch.autocast(
                device_type=device.type,
                dtype=torch.float16,
                enabled=device.type == "cuda",
            ):
                a = model.forward_with_aux(
                    batch["points_a"].to(device),
                    valid_a,
                    batch["raster_a"].to(device),
                    adversary_strength=adversary_strength,
                )
                b = model.forward_with_aux(
                    batch["points_b"].to(device),
                    valid_b,
                    batch["raster_b"].to(device),
                    adversary_strength=adversary_strength,
                )
                (
                    logits_a,
                    style_writer_a,
                    content_writer_a,
                    ctc_a,
                    _,
                    content_a,
                ) = a
                (
                    logits_b,
                    style_writer_b,
                    content_writer_b,
                    ctc_b,
                    _,
                    content_b,
                ) = b

                token_loss = 0.5 * (
                    F.cross_entropy(
                        logits_a.reshape(-1, logits_a.shape[-1]),
                        labels.reshape(-1),
                        ignore_index=PAD_ID,
                        label_smoothing=0.03,
                    )
                    + F.cross_entropy(
                        logits_b.reshape(-1, logits_b.shape[-1]),
                        labels.reshape(-1),
                        ignore_index=PAD_ID,
                        label_smoothing=0.03,
                    )
                )
                ctc_loss = 0.5 * (
                    ctc_alignment_loss(
                        ctc_a.float(), ctc_tokens, ctc_lengths, valid_a
                    )
                    + ctc_alignment_loss(
                        ctc_b.float(), ctc_tokens, ctc_lengths, valid_b
                    )
                )
                view_loss = _masked_token_kl(logits_a, logits_b, labels)
                content_loss = _content_consistency(content_a, content_b)

                zero = token_loss * 0.0
                style_writer_loss = zero
                adversary_loss = zero
                if style_writer_a is not None:
                    style_writer_loss = 0.5 * (
                        F.cross_entropy(style_writer_a, writers)
                        + F.cross_entropy(style_writer_b, writers)
                    )
                if content_writer_a is not None:
                    adversary_loss = 0.5 * (
                        F.cross_entropy(content_writer_a, writers)
                        + F.cross_entropy(content_writer_b, writers)
                    )

                loss = (
                    token_loss
                    + args.ctc_loss * ctc_loss
                    + args.view_consistency_loss * view_loss
                    + args.content_consistency_loss * content_loss
                    + args.writer_style_loss * style_writer_loss
                    + args.content_adversary_loss * adversary_loss
                )

            scaler.scale(loss).backward()
            scaler.unscale_(optimizer)
            torch.nn.utils.clip_grad_norm_(model.parameters(), 1.0)
            scaler.step(optimizer)
            scaler.update()
            scheduler.step()
            step += 1
            batches += 1
            for key, value in (
                ("loss", loss),
                ("token", token_loss),
                ("ctc", ctc_loss),
                ("view", view_loss),
                ("content", content_loss),
                ("style_writer", style_writer_loss),
                ("adversary", adversary_loss),
            ):
                sums[key] += float(value.detach())

        val = evaluate(model, val_loader, device)
        score_value = (
            val["exact"]
            - 0.35 * val["cer"]
            + 0.20 * val["worst_writer_exact"]
        )
        print(
            f"epoch {epoch:03d} train={sums['loss']/max(batches,1):.4f} "
            f"token={sums['token']/max(batches,1):.4f} "
            f"ctc={sums['ctc']/max(batches,1):.4f} "
            f"view={sums['view']/max(batches,1):.4f} "
            f"inv={sums['adversary']/max(batches,1):.4f} "
            f"val-exact={100*val['exact']:.2f}% "
            f"CER={100*val['cer']:.2f}% "
            f"worst-writer={100*val['worst_writer_exact']:.2f}%"
        )

        if score_value > best_score + 1e-5:
            best_score = score_value
            stale = 0
            payload = {
                "model": model.state_dict(),
                "config": cfg.to_dict(),
                "vocab": VOCAB,
                "pad_id": PAD_ID,
                "bos_id": BOS_ID,
                "eos_id": EOS_ID,
                "train_writers": train_writers,
                "epoch": epoch,
                "validation": val,
                "seed": args.seed,
                "stage": args.stage,
                "architecture_version": 4,
                "initialized_from": str(args.init) if args.init else None,
                "style_dropout": args.style_dropout,
                "auxiliary_losses": {
                    "ctc": args.ctc_loss,
                    "view_consistency": args.view_consistency_loss,
                    "content_consistency": args.content_consistency_loss,
                    "writer_style": args.writer_style_loss,
                    "content_adversary": args.content_adversary_loss,
                },
            }
            torch.save(payload, out)
            manifest.write_text(
                json.dumps(
                    {
                        "format": "pri-ink-foundation",
                        "version": 4,
                        "architectureVersion": 4,
                        "stage": args.stage,
                        "evidence": (
                            "synthetic/domain-randomised initialization only"
                            if args.stage == "pretrain"
                            else "writer-disjoint real validation"
                        ),
                        "decoder": (
                            "parallel-output-queries+2d-visual+physical-ctc+writer-invariance"
                        ),
                        "checkpoint": out.name,
                        "config": cfg.to_dict(),
                        "vocab": VOCAB,
                        "validation": val,
                        "counts": counts,
                        "trainWriterCount": len(train_writers),
                        "validationWriterCount": len(val_writers),
                        "seed": args.seed,
                        "initializedFrom": str(args.init) if args.init else None,
                        "styleDropout": args.style_dropout,
                        "auxiliaryLossWeights": payload["auxiliary_losses"],
                        "holdoutPolicy": (
                            "final-holdout is never evaluated by train_v4.py"
                        ),
                    },
                    indent=2,
                ),
                encoding="utf-8",
            )
        else:
            stale += 1
            if stale >= args.patience:
                print(
                    f"early stop after {stale} epochs without validation improvement"
                )
                break

    print(f"best V4 checkpoint: {out}")
    print(
        "V4 IS NOT PRODUCTION EVIDENCE until writer-disjoint release/generalisation gates pass."
    )


if __name__ == "__main__":
    main()
