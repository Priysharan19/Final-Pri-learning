#!/usr/bin/env python3
"""Train the Pri Ink V4 candidate-component validity calibrator.

The base structural model is frozen. This isolates the scientific question:
can a contextual rejection head distinguish true complete glyph groups from the
malformed candidates explored by joint partition search? Because the base model
is unchanged, baseline and validity-aware decoding can be compared on the exact
same checkpoint.

Two protocols are supported:
  writer-disjoint  - uses explicit train/validation writers from the corpus;
  same-writer-dev  - recreates the frozen dev split stored in a dev checkpoint.

Neither protocol promotes a model. Synthetic writers and same-writer development
remain explicitly non-production evidence.
"""
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
from structural_component_validity import (
    COMPONENT_VALIDITY_OBJECTIVE,
    COMPONENT_VALIDITY_VERSION,
    ComponentValidityHead,
    balanced_validity_loss,
    checkpoint_sha256,
    score_supervised_components,
)
from structural_data import StructuralInkDataset, corpus_files, load_structural_examples


def seed_everything(seed: int):
    random.seed(seed)
    np.random.seed(seed)
    torch.manual_seed(seed)
    if torch.cuda.is_available():
        torch.cuda.manual_seed_all(seed)


def _device(name: str) -> torch.device:
    if name != "auto":
        return torch.device(name)
    return torch.device(
        "cuda" if torch.cuda.is_available() else
        "mps" if torch.backends.mps.is_available() else "cpu"
    )


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
    for parameter in model.parameters():
        parameter.requires_grad_(False)
    return ckpt, cfg, model


def _prepare_examples(raw, base_ckpt: dict, mode: str):
    if mode == "writer-disjoint":
        if base_ckpt.get("stage") != "structural-research":
            raise SystemExit(
                f"writer-disjoint validity training requires stage='structural-research', "
                f"got {base_ckpt.get('stage')!r}"
            )
        train_writers = {x.writer for x in raw if x.split == "train"}
        val_writers = {x.writer for x in raw if x.split == "validation"}
        if not train_writers or not val_writers:
            raise SystemExit("writer-disjoint validity training needs train and validation writers")
        overlap = train_writers & val_writers
        if overlap:
            raise SystemExit(f"writer leakage in component validity corpus: {sorted(overlap)[:5]}")
        protocol = {
            "protocol": "writer-disjoint",
            "writerDisjoint": True,
            "productionEvidence": False,
            "trainWriters": len(train_writers),
            "validationWriters": len(val_writers),
        }
        return raw, protocol

    if base_ckpt.get("stage") != "structural-research-dev":
        raise SystemExit(
            f"same-writer-dev validity training requires stage='structural-research-dev', "
            f"got {base_ckpt.get('stage')!r}"
        )
    frozen = base_ckpt.get("dev_split") or {}
    if frozen.get("protocol") != "same-writer-dev-holdout":
        raise SystemExit("base dev checkpoint has no frozen same-writer split metadata")
    if frozen.get("writerDisjoint") is not False or frozen.get("productionEvidence") is not False:
        raise SystemExit("unsafe base dev split metadata")
    try:
        examples, recreated = make_same_writer_dev_split(
            raw,
            seed=int(frozen["seed"]),
            fraction=float(frozen["fraction"]),
        )
    except (KeyError, ValueError) as exc:
        raise SystemExit(f"cannot recreate frozen base dev split: {exc}") from exc
    for key in ("writer", "trainSamples", "validationSamples", "seed", "fraction"):
        if recreated.get(key) != frozen.get(key):
            raise SystemExit(
                f"component validity dev split mismatch for {key}: "
                f"{recreated.get(key)!r} != {frozen.get(key)!r}"
            )
    return examples, recreated


def _binary_auc(positive: list[float], negative: list[float]) -> float:
    """Exact tie-aware binary AUC in O((P+N) log(P+N)) time.

    This is the Mann-Whitney rank formulation of the same probability measured
    by the old pairwise implementation: P(positive > negative) plus half credit
    for ties. Validation can therefore scale to large candidate corpora without
    changing the metric's semantics.
    """
    if not positive or not negative:
        return 0.0

    ranked = [(float(score), 1) for score in positive]
    ranked.extend((float(score), 0) for score in negative)
    if any(not math.isfinite(score) for score, _ in ranked):
        raise ValueError("binary AUC requires finite component-validity scores")
    ranked.sort(key=lambda item: item[0])

    positive_rank_sum = 0.0
    i = 0
    while i < len(ranked):
        j = i + 1
        while j < len(ranked) and ranked[j][0] == ranked[i][0]:
            j += 1
        # Sorted positions i..j-1 correspond to 1-indexed ranks i+1..j.
        average_rank = ((i + 1) + j) / 2.0
        positive_rank_sum += average_rank * sum(label for _, label in ranked[i:j])
        i = j

    n_pos = len(positive)
    n_neg = len(negative)
    mann_whitney_u = positive_rank_sum - n_pos * (n_pos + 1) / 2.0
    return mann_whitney_u / (n_pos * n_neg)


@torch.no_grad()
def evaluate_scorer(
    base_model,
    scorer,
    loader,
    device,
    *,
    max_group_size: int,
    max_negatives: int,
):
    base_model.eval(); scorer.eval()
    positive_scores: list[float] = []
    negative_scores: list[float] = []
    losses = []
    for batch in loader:
        outputs = base_model(
            batch["stroke_points"].to(device),
            batch["stroke_point_valid"].to(device),
            batch["stroke_valid"].to(device),
            batch["stroke_geometry"].to(device),
            batch["raster"].to(device),
        )
        scored = score_supervised_components(
            scorer, outputs, batch, device=device,
            max_group_size=max_group_size, max_negatives=max_negatives,
        )
        losses.append(float(balanced_validity_loss(scored)))
        positive_scores.extend(torch.sigmoid(scored.positive_logits).cpu().tolist())
        negative_scores.extend(torch.sigmoid(scored.negative_logits).cpu().tolist())

    positive_recall = sum(v >= 0.5 for v in positive_scores) / max(1, len(positive_scores))
    negative_reject = sum(v < 0.5 for v in negative_scores) / max(1, len(negative_scores))
    balanced = 0.5 * (positive_recall + negative_reject)
    return {
        "loss": sum(losses) / max(1, len(losses)),
        "positiveRecall": positive_recall,
        "hardNegativeRejectRate": negative_reject,
        "balancedAccuracy": balanced,
        "auc": _binary_auc(positive_scores, negative_scores),
        "positiveComponents": len(positive_scores),
        "hardNegativeComponents": len(negative_scores),
        "meanPositiveProbability": sum(positive_scores) / max(1, len(positive_scores)),
        "meanHardNegativeProbability": sum(negative_scores) / max(1, len(negative_scores)),
        "probabilitySeparation": (
            sum(positive_scores) / max(1, len(positive_scores)) -
            sum(negative_scores) / max(1, len(negative_scores))
        ),
    }


def _load_initial_validity(
    scorer: ComponentValidityHead,
    path: Path,
    *,
    current_base_hash: str,
    allow_base_transfer: bool,
):
    ckpt = torch.load(path, map_location="cpu", weights_only=False)
    if int(ckpt.get("component_validity_version", 0)) != COMPONENT_VALIDITY_VERSION:
        raise SystemExit("initial component-validity checkpoint version mismatch")
    if ckpt.get("objective") != COMPONENT_VALIDITY_OBJECTIVE:
        raise SystemExit("initial component-validity checkpoint objective mismatch")
    if int(ckpt.get("d_model", 0)) != scorer.d_model:
        raise SystemExit("initial component-validity d_model mismatch")
    source_hash = str(ckpt.get("base_checkpoint_sha256", ""))
    if source_hash != current_base_hash and not allow_base_transfer:
        raise SystemExit(
            "initial validity head belongs to a different base checkpoint; "
            "pass --allow-base-transfer only for deliberate synthetic->real fine-tuning"
        )
    scorer.load_state_dict(ckpt["model"], strict=True)
    return {
        "path": str(path),
        "baseCheckpointSha256": source_hash,
        "stage": ckpt.get("stage"),
        "evidence": ckpt.get("evidence"),
        "baseTransfer": source_hash != current_base_hash,
    }


def main():
    p = argparse.ArgumentParser()
    p.add_argument("base_checkpoint")
    p.add_argument("--corpus", required=True)
    p.add_argument("--out", default="tools/ink-foundation/runs/pri-ink-v4-component-validity.pt")
    p.add_argument("--mode", choices=["writer-disjoint", "same-writer-dev"], default="writer-disjoint")
    p.add_argument("--init-validity", default=None)
    p.add_argument("--allow-base-transfer", action="store_true")
    p.add_argument("--epochs", type=int, default=20)
    p.add_argument("--batch", type=int, default=8)
    p.add_argument("--lr", type=float, default=3e-4)
    p.add_argument("--weight-decay", type=float, default=0.02)
    p.add_argument("--seed", type=int, default=20260824)
    p.add_argument("--workers", type=int, default=0)
    p.add_argument("--device", default="auto")
    p.add_argument("--max-group-size", type=int, default=4)
    p.add_argument("--max-negatives", type=int, default=32)
    p.add_argument("--patience", type=int, default=6)
    args = p.parse_args()

    if args.epochs < 1 or args.batch < 1 or args.patience < 1:
        raise SystemExit("epochs, batch and patience must be >= 1")
    if args.max_group_size < 1 or args.max_negatives < 1:
        raise SystemExit("max-group-size and max-negatives must be >= 1")
    if args.allow_base_transfer and not args.init_validity:
        raise SystemExit("--allow-base-transfer requires --init-validity")

    seed_everything(args.seed)
    device = _device(args.device)
    base_path = Path(args.base_checkpoint)
    if not base_path.exists():
        raise SystemExit(f"base V4 checkpoint not found: {base_path}")
    base_ckpt, cfg, base_model = _load_base(base_path, device)
    base_hash = checkpoint_sha256(base_path)

    raw = load_structural_examples(corpus_files(args.corpus))
    examples, protocol = _prepare_examples(raw, base_ckpt, args.mode)
    train_rows = [x for x in examples if x.split == "train"]
    val_rows = [x for x in examples if x.split == "validation"]
    if not train_rows or not val_rows:
        raise SystemExit("component validity training requires non-empty train and validation splits")

    train_loader = DataLoader(
        StructuralInkDataset(examples, "train", cfg), batch_size=args.batch,
        shuffle=True, num_workers=args.workers,
    )
    val_loader = DataLoader(
        StructuralInkDataset(examples, "validation", cfg), batch_size=args.batch,
        shuffle=False, num_workers=args.workers,
    )

    scorer = ComponentValidityHead(cfg.d_model).to(device)
    init_meta = None
    if args.init_validity:
        init_meta = _load_initial_validity(
            scorer, Path(args.init_validity), current_base_hash=base_hash,
            allow_base_transfer=args.allow_base_transfer,
        )

    opt = torch.optim.AdamW(
        scorer.parameters(), lr=args.lr, weight_decay=args.weight_decay, betas=(0.9, 0.98)
    )
    total_steps = max(1, args.epochs * len(train_loader))
    warmup = max(5, total_steps // 20)

    def lr_factor(step: int):
        if step < warmup:
            return max(1e-3, (step + 1) / warmup)
        progress = (step - warmup) / max(1, total_steps - warmup)
        return 0.15 + 0.85 * 0.5 * (1 + math.cos(math.pi * progress))

    sched = torch.optim.lr_scheduler.LambdaLR(opt, lr_factor)
    out = Path(args.out); out.parent.mkdir(parents=True, exist_ok=True)
    best = -1.0; stale = 0

    all_writers = {x.writer for x in examples}
    synthetic_only = bool(all_writers) and all(w.startswith("SYN4_") for w in all_writers)
    if args.mode == "same-writer-dev":
        evidence = "same-writer development component-validity evaluation only; not production evidence"
        stage = "component-validity-research-dev"
    elif synthetic_only:
        evidence = "synthetic component-validity pretraining only; never real handwriting accuracy"
        stage = "component-validity-research"
    else:
        evidence = "writer-disjoint component-validity research only; release still requires full real-Pencil promotion gates"
        stage = "component-validity-research"

    print("\nPri Ink Structural V4 — COMPONENT VALIDITY TRAINING\n")
    print(f"mode={args.mode} device={device} train={len(train_rows)} validation={len(val_rows)}")
    print(f"base={base_path} sha256={base_hash[:16]}…")
    if init_meta:
        print(f"initial validity={init_meta['path']} base_transfer={init_meta['baseTransfer']}")
    print(f"synthetic-only={str(synthetic_only).lower()} production-ready=false")

    for epoch in range(1, args.epochs + 1):
        scorer.train(); running = 0.0; steps = pos_n = neg_n = 0
        for batch in train_loader:
            with torch.no_grad():
                outputs = base_model(
                    batch["stroke_points"].to(device),
                    batch["stroke_point_valid"].to(device),
                    batch["stroke_valid"].to(device),
                    batch["stroke_geometry"].to(device),
                    batch["raster"].to(device),
                )
            opt.zero_grad(set_to_none=True)
            scored = score_supervised_components(
                scorer, outputs, batch, device=device,
                max_group_size=args.max_group_size, max_negatives=args.max_negatives,
            )
            if scored.positive_count < 1 or scored.negative_count < 1:
                raise SystemExit(
                    "component validity batch has no positive or hard-negative supervision; "
                    "the structural corpus is too trivial for this objective"
                )
            loss = balanced_validity_loss(scored)
            loss.backward()
            torch.nn.utils.clip_grad_norm_(scorer.parameters(), 1.0)
            opt.step(); sched.step()
            running += float(loss.detach()); steps += 1
            pos_n += scored.positive_count; neg_n += scored.negative_count

        metrics = evaluate_scorer(
            base_model, scorer, val_loader, device,
            max_group_size=args.max_group_size, max_negatives=args.max_negatives,
        )
        if metrics["positiveComponents"] < 1 or metrics["hardNegativeComponents"] < 1:
            raise SystemExit("validation split has insufficient component-validity supervision")
        score = 0.55 * metrics["auc"] + 0.45 * metrics["balancedAccuracy"]
        print(
            f"epoch={epoch} train_loss={running/max(1,steps):.4f} "
            f"train_pos={pos_n} train_neg={neg_n} val_loss={metrics['loss']:.4f} "
            f"bal={metrics['balancedAccuracy']:.4f} auc={metrics['auc']:.4f} "
            f"pos_recall={metrics['positiveRecall']:.4f} neg_reject={metrics['hardNegativeRejectRate']:.4f} "
            f"separation={metrics['probabilitySeparation']:.4f}"
        )

        if score > best + 1e-6:
            best = score; stale = 0
            checkpoint = {
                "architecture_version": 4,
                "component_validity_version": COMPONENT_VALIDITY_VERSION,
                "stage": stage,
                "production_ready": False,
                "objective": COMPONENT_VALIDITY_OBJECTIVE,
                "d_model": cfg.d_model,
                "base_checkpoint_sha256": base_hash,
                "base_checkpoint_stage": base_ckpt.get("stage"),
                "base_config": cfg.to_dict(),
                "model": scorer.state_dict(),
                "validation": metrics,
                "validation_protocol": protocol,
                "initialisation": init_meta,
                "training": {
                    "maxGroupSize": args.max_group_size,
                    "maxNegatives": args.max_negatives,
                    "seed": args.seed,
                    "syntheticOnly": synthetic_only,
                },
                "evidence": evidence,
            }
            torch.save(checkpoint, out)
            out.with_suffix(".json").write_text(json.dumps({
                "architectureVersion": 4,
                "componentValidityVersion": COMPONENT_VALIDITY_VERSION,
                "stage": stage,
                "productionReady": False,
                "objective": COMPONENT_VALIDITY_OBJECTIVE,
                "baseCheckpointSha256": base_hash,
                "baseCheckpointStage": base_ckpt.get("stage"),
                "validation": metrics,
                "validationProtocol": protocol,
                "initialisation": init_meta,
                "training": checkpoint["training"],
                "evidence": evidence,
            }, indent=2) + "\n")
        else:
            stale += 1
            if stale >= args.patience:
                print(f"early stopping after {stale} stale epochs")
                break

    if not out.exists():
        raise SystemExit("component validity training did not produce a checkpoint")
    print(f"best component-validity checkpoint: {out} score={best:.4f}")
    print("production ready: false")


if __name__ == "__main__":
    main()