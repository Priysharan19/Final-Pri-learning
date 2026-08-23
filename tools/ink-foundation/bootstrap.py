#!/usr/bin/env python3
"""One-writer development bootstrap for Pri Ink Foundation V3.

Pipeline:
  V3 generic synthetic pretraining
    -> optional writer-specific synthetic replay made only from bootstrap-TRAIN
       glyphs
    -> replay-balanced real one-writer adaptation with a personalization-biased
       optimizer
    -> DEBUG Core ML

The same human appears in train/dev, so this is NEVER arbitrary-writer release
evidence. Personal synthetic replay is also never counted as real evidence.

Two safeguards matter for a 50-expression writer:
  * writer-derived replay may be large, but it must not drown out the scarce
    real Pencil samples; weighted sampling keeps a controlled real-data share;
  * the visual CNN/style path adapts more aggressively than the generic stroke
    backbone, which moves conservatively to reduce catastrophic forgetting.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import os
from pathlib import Path

import torch
import torch.nn.functional as F
from torch.utils.data import DataLoader, WeightedRandomSampler

from data import BOS_ID, EOS_ID, PAD_ID, VOCAB, Example, InkDataset, corpus_files, load_examples
from model import ModelConfig, PriInkFoundation
from train import ctc_alignment_loss, evaluate, load_initial_backbone, seed_everything


def bootstrap_validation_indices(examples: list[Example], seed: int, fraction: float) -> set[int]:
    """Stable cross-language split used by Python training and JS personal synth."""
    fraction = min(0.35, max(0.10, fraction))
    n_val = max(8, int(round(len(examples) * fraction)))
    n_val = min(n_val, len(examples) - 8)
    ranked = []
    for i, row in enumerate(examples):
        key = f"{seed}:{i}:{row.target}".encode("utf-8")
        ranked.append((hashlib.sha256(key).hexdigest(), i))
    ranked.sort()
    return {i for _, i in ranked[:n_val]}


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

    val_indices = bootstrap_validation_indices(examples, seed, fraction)
    rows: list[Example] = []
    for i, row in enumerate(examples):
        rows.append(Example(
            writer=row.writer,
            split="validation" if i in val_indices else "train",
            target=row.target,
            strokes=row.strokes,
            source=row.source,
        ))
    return rows, writers[0], len(examples) - len(val_indices), len(val_indices)


def load_personal_synthetic(root: str | None, writer: str) -> list[Example]:
    if not root:
        return []
    rows = load_examples(corpus_files(root))
    if not rows:
        raise SystemExit(f"--personal-synth contains no usable samples: {root}")
    if any(x.split != "train" for x in rows):
        raise SystemExit("personal synthetic replay must be train-only")
    writers = sorted({x.writer for x in rows})
    if writers != [writer]:
        raise SystemExit(f"personal synthetic replay writer mismatch: expected {writer}, found {writers}")
    return [Example(writer=x.writer, split="train", target=x.target, strokes=x.strokes, source=x.source) for x in rows]


def replay_sampling_weights(
    rows: list[Example], personal_sources: set[str], real_fraction: float
) -> tuple[torch.Tensor, int, int]:
    """Return per-row weights whose probability mass preserves real Pencil data.

    With 40 real bootstrap-train expressions and 1,600 personal replay rows,
    uniform sampling would make real data only ~2.4% of updates. The replay is a
    regularizer/curriculum, not a replacement for the real writer. We therefore
    assign a fixed probability mass to real rows and spread the remainder across
    writer-derived synthetic rows. Counts stay metadata-only and are never
    confused with release evidence.
    """
    real_fraction = min(0.75, max(0.10, float(real_fraction)))
    is_synth = [row.source in personal_sources for row in rows]
    real_count = sum(not x for x in is_synth)
    synth_count = sum(is_synth)
    if real_count < 1 or synth_count < 1:
        raise RuntimeError(
            f"replay-balanced sampling needs real and personal rows; real={real_count} synthetic={synth_count}"
        )
    real_weight = real_fraction / real_count
    synth_weight = (1.0 - real_fraction) / synth_count
    weights = torch.tensor(
        [synth_weight if synth else real_weight for synth in is_synth],
        dtype=torch.double,
    )
    return weights, real_count, synth_count


def personalization_parameter_groups(
    model: PriInkFoundation,
    base_lr: float,
    visual_multiplier: float,
    stroke_multiplier: float,
    decoder_multiplier: float,
):
    """Disjoint LR groups tuned for one-writer local adaptation."""
    visual_modules = (model.raster_encoder, model.style_encoder)
    decoder_modules = (model.decoder, model.output, model.output_queries, model.output_pos)

    visual_ids = {id(p) for module in visual_modules for p in module.parameters()}
    decoder_ids = {id(p) for module in decoder_modules for p in module.parameters()}
    overlap = visual_ids & decoder_ids
    if overlap:
        raise RuntimeError("personalization optimizer parameter groups overlap")

    visual_params = []
    decoder_params = []
    stroke_params = []
    for p in model.parameters():
        if not p.requires_grad:
            continue
        pid = id(p)
        if pid in visual_ids:
            visual_params.append(p)
        elif pid in decoder_ids:
            decoder_params.append(p)
        else:
            stroke_params.append(p)

    total = len(visual_params) + len(decoder_params) + len(stroke_params)
    trainable = sum(1 for p in model.parameters() if p.requires_grad)
    if total != trainable or not visual_params or not decoder_params or not stroke_params:
        raise RuntimeError(
            f"invalid personalization groups: visual={len(visual_params)} "
            f"decoder={len(decoder_params)} stroke={len(stroke_params)} trainable={trainable}"
        )

    return [
        {"params": visual_params, "lr": base_lr * visual_multiplier, "group_name": "writer-visual-cnn-style"},
        {"params": decoder_params, "lr": base_lr * decoder_multiplier, "group_name": "math-decoder"},
        {"params": stroke_params, "lr": base_lr * stroke_multiplier, "group_name": "generic-stroke-backbone"},
    ]


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--corpus", default="client/test/ink-corpus")
    p.add_argument("--personal-synth", default=None,
                   help="optional train-only corpus composed from this writer's bootstrap-training glyphs")
    p.add_argument("--init", required=True, help="compatible V3 synthetic pretraining checkpoint")
    p.add_argument("--out", default="tools/ink-foundation/runs/pri-ink-bootstrap.pt")
    p.add_argument("--epochs", type=int, default=50)
    p.add_argument("--batch", type=int, default=8)
    p.add_argument("--lr", type=float, default=4e-5)
    p.add_argument("--weight-decay", type=float, default=0.03)
    p.add_argument("--ctc-loss", type=float, default=0.16)
    p.add_argument("--real-replay-fraction", type=float, default=0.30,
                   help="expected share of adaptation draws coming from real Pencil rows when personal replay is used")
    p.add_argument("--visual-lr-multiplier", type=float, default=2.0,
                   help="writer-specific raster CNN/style adaptation multiplier")
    p.add_argument("--stroke-lr-multiplier", type=float, default=0.45,
                   help="conservative multiplier for the generic stroke backbone")
    p.add_argument("--decoder-lr-multiplier", type=float, default=1.0,
                   help="math sequence decoder adaptation multiplier")
    p.add_argument("--seed", type=int, default=20260823)
    p.add_argument("--validation-fraction", type=float, default=0.20)
    p.add_argument("--workers", type=int, default=min(4, os.cpu_count() or 1))
    p.add_argument("--device", default="auto")
    p.add_argument("--d-model", type=int, default=256)
    p.add_argument("--stroke-layers", type=int, default=8)
    p.add_argument("--decoder-layers", type=int, default=6)
    p.add_argument("--max-points", type=int, default=768)
    p.add_argument("--max-tokens", type=int, default=96)
    p.add_argument("--patience", type=int, default=10)
    args = p.parse_args()

    if min(args.visual_lr_multiplier, args.stroke_lr_multiplier, args.decoder_lr_multiplier) <= 0:
        raise SystemExit("all personalization LR multipliers must be positive")
    if not 0.10 <= args.real_replay_fraction <= 0.75:
        raise SystemExit("--real-replay-fraction must be between 0.10 and 0.75")

    seed_everything(args.seed)
    if args.device == "auto":
        device = torch.device(
            "cuda" if torch.cuda.is_available() else
            "mps" if torch.backends.mps.is_available() else "cpu"
        )
    else:
        device = torch.device(args.device)

    real_examples = load_examples(corpus_files(args.corpus))
    if not real_examples:
        raise SystemExit(f"No v2 real-ink samples found under {args.corpus!r}")

    examples, writer, real_train_count, val_count = make_bootstrap_split(
        real_examples, args.seed, args.validation_fraction
    )
    personal_synth = load_personal_synthetic(args.personal_synth, writer)
    examples.extend(personal_synth)
    writer_to_id = {writer: 0}

    cfg = ModelConfig(
        d_model=args.d_model,
        stroke_layers=args.stroke_layers,
        decoder_layers=args.decoder_layers,
        max_points=args.max_points,
        max_tokens=args.max_tokens,
        architecture_version=3,
    )
    train_ds = InkDataset(
        examples, "train", cfg.max_points, cfg.max_tokens,
        cfg.raster_height, cfg.raster_width, writer_to_id,
    )
    val_ds = InkDataset(
        examples, "validation", cfg.max_points, cfg.max_tokens,
        cfg.raster_height, cfg.raster_width, writer_to_id,
    )

    train_sampler = None
    effective_real_fraction = None
    if personal_synth:
        personal_sources = {row.source for row in personal_synth}
        weights, sampled_real_count, sampled_synth_count = replay_sampling_weights(
            train_ds.rows, personal_sources, args.real_replay_fraction
        )
        if sampled_real_count != real_train_count or sampled_synth_count != len(personal_synth):
            raise RuntimeError(
                "replay sampler provenance mismatch: "
                f"real {sampled_real_count}/{real_train_count}, "
                f"synthetic {sampled_synth_count}/{len(personal_synth)}"
            )
        generator = torch.Generator()
        generator.manual_seed(args.seed ^ 0x51A7E11)
        train_sampler = WeightedRandomSampler(
            weights,
            num_samples=len(train_ds),
            replacement=True,
            generator=generator,
        )
        effective_real_fraction = args.real_replay_fraction

    train_loader = DataLoader(
        train_ds, batch_size=args.batch,
        shuffle=train_sampler is None, sampler=train_sampler,
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

    parameter_groups = personalization_parameter_groups(
        model,
        args.lr,
        args.visual_lr_multiplier,
        args.stroke_lr_multiplier,
        args.decoder_lr_multiplier,
    )
    opt = torch.optim.AdamW(
        parameter_groups, weight_decay=args.weight_decay, betas=(0.9, 0.98)
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

    out = Path(args.out); out.parent.mkdir(parents=True, exist_ok=True)
    manifest_path = out.with_suffix(".json")
    best_score = -1e9; stale = 0

    print(
        f"stage=bootstrap architecture=v3 device={device} writer={writer} "
        f"real-train={real_train_count} personal-synth={len(personal_synth)} "
        f"same-writer-real-dev-val={val_count}"
    )
    print(f"initialized backbone from {args.init}")
    print(f"parameters={sum(p.numel() for p in model.parameters()):,}")
    if effective_real_fraction is not None:
        print(
            f"replay-balanced sampling: expected real Pencil share={100 * effective_real_fraction:.1f}% "
            f"(uniform would be {100 * real_train_count / max(real_train_count + len(personal_synth), 1):.1f}%)"
        )
    print(
        "personalization LRs: "
        f"visual-cnn/style={args.lr * args.visual_lr_multiplier:.3g} "
        f"decoder={args.lr * args.decoder_lr_multiplier:.3g} "
        f"stroke-backbone={args.lr * args.stroke_lr_multiplier:.3g}"
    )
    print("WARNING: same-writer validation is development-only; personal synthetic replay is not real evidence.")

    for epoch in range(1, args.epochs + 1):
        model.train()
        running = running_token = running_ctc = 0.0; seen = 0
        for batch in train_loader:
            labels = batch["tokens"].to(device)
            point_valid = batch["point_valid"].to(device)
            physical_tokens = batch["ctc_tokens"].to(device)
            physical_lengths = batch["ctc_length"].to(device)
            opt.zero_grad(set_to_none=True)
            with torch.autocast(
                device_type=device.type, dtype=torch.float16, enabled=device.type == "cuda"
            ):
                logits, _, ctc_logits, _ = model.forward_with_aux(
                    batch["points"].to(device), point_valid,
                    batch["raster"].to(device),
                )
                token_loss = F.cross_entropy(
                    logits.reshape(-1, logits.shape[-1]), labels.reshape(-1),
                    ignore_index=PAD_ID, label_smoothing=0.035,
                )
                ctc_loss = ctc_alignment_loss(
                    ctc_logits.float(), physical_tokens, physical_lengths, point_valid
                )
                loss = token_loss + args.ctc_loss * ctc_loss
            scaler.scale(loss).backward(); scaler.unscale_(opt)
            torch.nn.utils.clip_grad_norm_(model.parameters(), 0.8)
            scaler.step(opt); scaler.update(); sched.step()
            running += float(loss.detach()); running_token += float(token_loss.detach())
            running_ctc += float(ctc_loss.detach()); seen += 1

        val = evaluate(model, val_loader, device)
        score = val["exact"] - 0.40 * val["cer"]
        print(
            f"epoch {epoch:03d} train={running/max(seen,1):.4f} "
            f"token={running_token/max(seen,1):.4f} ctc={running_ctc/max(seen,1):.4f} "
            f"same-writer-real-dev-val={val['loss']:.4f} "
            f"exact={100*val['exact']:.2f}% CER={100*val['cer']:.2f}%"
        )

        if score > best_score + 1e-5:
            best_score = score; stale = 0
            torch.save({
                "model": model.state_dict(), "config": cfg.to_dict(), "vocab": VOCAB,
                "pad_id": PAD_ID, "bos_id": BOS_ID, "eos_id": EOS_ID,
                "train_writers": [writer], "epoch": epoch,
                "validation": val, "seed": args.seed, "stage": "bootstrap",
                "architecture_version": 3, "initialized_from": str(args.init),
                "release_eligible": False,
                "bootstrap_real_train_samples": real_train_count,
                "bootstrap_personal_synthetic_samples": len(personal_synth),
                "bootstrap_validation_samples": val_count,
                "auxiliary_losses": {"ctc": args.ctc_loss},
                "personalization": {
                    "visual_lr_multiplier": args.visual_lr_multiplier,
                    "stroke_lr_multiplier": args.stroke_lr_multiplier,
                    "decoder_lr_multiplier": args.decoder_lr_multiplier,
                    "real_replay_fraction": effective_real_fraction,
                    "strategy": "cross-modal writer CNN/style emphasis + replay-balanced real Pencil sampling + conservative stroke-backbone adaptation",
                },
            }, out)
            manifest_path.write_text(json.dumps({
                "format": "pri-ink-foundation", "version": 3,
                "architectureVersion": 3, "stage": "bootstrap",
                "evidence": "same-writer real development holdout — NOT generalisation evidence; personal synthetic replay excluded from evidence counts",
                "releaseEligible": False,
                "decoder": "parallel-output-queries+2d-visual+cross-modal-style+physical-ctc-aux",
                "checkpoint": out.name, "config": cfg.to_dict(), "vocab": VOCAB,
                "validation": val, "realWriterCount": 1,
                "realTrainSamples": real_train_count,
                "personalSyntheticReplaySamples": len(personal_synth),
                "sameWriterValidationSamples": val_count, "seed": args.seed,
                "initializedFrom": str(args.init),
                "auxiliaryLossWeights": {"ctc": args.ctc_loss},
                "personalization": {
                    "writerSpecificVisualCNNAdaptation": True,
                    "crossModalStyleEmbedding": True,
                    "visualLearningRateMultiplier": args.visual_lr_multiplier,
                    "strokeBackboneLearningRateMultiplier": args.stroke_lr_multiplier,
                    "decoderLearningRateMultiplier": args.decoder_lr_multiplier,
                    "expectedRealReplayFraction": effective_real_fraction,
                },
                "holdoutPolicy": "Real dev-val samples are excluded from personal glyph extraction/replay. No test/final-holdout data is read. Production release remains forbidden.",
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
