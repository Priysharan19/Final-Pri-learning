#!/usr/bin/env python3
"""Train a frozen-base pooled glyph-relation head for Pri Ink Structural V4."""
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
from structural import PriInkStructuralV4, StructuralConfig, RELATIONS
from structural_component_validity import checkpoint_sha256
from structural_data import StructuralInkDataset, corpus_files, load_structural_examples
from structural_group_relations import (
    GROUP_RELATION_MARGIN,
    GROUP_RELATION_MARGIN_WEIGHT,
    GROUP_RELATION_OBJECTIVE,
    GROUP_RELATION_TYPE_WEIGHT,
    GROUP_RELATION_VERSION,
    GroupRelationHead,
    balanced_group_relation_loss,
    group_relation_metrics,
    score_supervised_group_relations,
)


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


def _writer_disjoint_stage_ok(base_ckpt: dict) -> bool:
    stage = base_ckpt.get("stage")
    if stage == "structural-research":
        return True
    if stage == "structural-synthetic-pretrain":
        if base_ckpt.get("synthetic_pretraining") is not True:
            raise SystemExit(
                "tagged synthetic V4 base is missing synthetic_pretraining=true provenance"
            )
        return True
    return False


def _prepare_examples(raw, base_ckpt: dict, mode: str):
    if mode == "writer-disjoint":
        if not _writer_disjoint_stage_ok(base_ckpt):
            raise SystemExit(
                "writer-disjoint group-relation training requires structural-research or "
                "provenance-tagged structural-synthetic-pretrain base; "
                f"got {base_ckpt.get('stage')!r}"
            )
        train_writers = {x.writer for x in raw if x.split == "train"}
        val_writers = {x.writer for x in raw if x.split == "validation"}
        if not train_writers or not val_writers:
            raise SystemExit("group-relation training needs train and validation writers")
        overlap = train_writers & val_writers
        if overlap:
            raise SystemExit(f"writer leakage in group-relation corpus: {sorted(overlap)[:5]}")
        return raw, {
            "protocol": "writer-disjoint",
            "writerDisjoint": True,
            "productionEvidence": False,
            "trainWriters": len(train_writers),
            "validationWriters": len(val_writers),
        }

    if base_ckpt.get("stage") != "structural-research-dev":
        raise SystemExit(
            f"same-writer-dev group-relation training requires structural-research-dev base; "
            f"got {base_ckpt.get('stage')!r}"
        )
    frozen = base_ckpt.get("dev_split") or {}
    if frozen.get("protocol") != "same-writer-dev-holdout":
        raise SystemExit("base dev checkpoint has no frozen same-writer split metadata")
    if frozen.get("writerDisjoint") is not False or frozen.get("productionEvidence") is not False:
        raise SystemExit("unsafe base dev split metadata")
    examples, recreated = make_same_writer_dev_split(
        raw,
        seed=int(frozen["seed"]),
        fraction=float(frozen["fraction"]),
    )
    for key in ("writer", "trainSamples", "validationSamples", "seed", "fraction"):
        if recreated.get(key) != frozen.get(key):
            raise SystemExit(
                f"group relation dev split mismatch for {key}: "
                f"{recreated.get(key)!r} != {frozen.get(key)!r}"
            )
    return examples, recreated


def _load_initial_head(
    head: GroupRelationHead,
    path: Path,
    *,
    current_base_hash: str,
    allow_base_transfer: bool,
):
    ckpt = torch.load(path, map_location="cpu", weights_only=False)
    if int(ckpt.get("group_relation_version", 0)) != GROUP_RELATION_VERSION:
        raise SystemExit("initial group-relation checkpoint version mismatch")
    if ckpt.get("objective") != GROUP_RELATION_OBJECTIVE:
        raise SystemExit("initial group-relation objective mismatch")
    if int(ckpt.get("d_model", 0)) != head.d_model:
        raise SystemExit("initial group-relation d_model mismatch")
    source_hash = str(ckpt.get("base_checkpoint_sha256", ""))
    if source_hash != current_base_hash and not allow_base_transfer:
        raise SystemExit(
            "initial group-relation head belongs to a different base checkpoint; "
            "pass --allow-base-transfer only for deliberate synthetic->real fine-tuning"
        )
    head.load_state_dict(ckpt["model"], strict=True)
    return {
        "path": str(path),
        "baseCheckpointSha256": source_hash,
        "stage": ckpt.get("stage"),
        "evidence": ckpt.get("evidence"),
        "baseTransfer": source_hash != current_base_hash,
    }


@torch.no_grad()
def evaluate_head(base_model, head, loader, device):
    base_model.eval(); head.eval()
    logits_parts = []
    target_parts = []
    losses = []
    for batch in loader:
        outputs = base_model(
            batch["stroke_points"].to(device),
            batch["stroke_point_valid"].to(device),
            batch["stroke_valid"].to(device),
            batch["stroke_geometry"].to(device),
            batch["raster"].to(device),
        )
        scored = score_supervised_group_relations(head, outputs, batch, device=device)
        if scored.pairs:
            losses.append(float(balanced_group_relation_loss(scored)))
            logits_parts.append(scored.logits.cpu())
            target_parts.append(scored.targets.cpu())
    if not logits_parts:
        raise SystemExit("validation split has no supervised glyph-relation pairs")
    logits = torch.cat(logits_parts, dim=0)
    targets = torch.cat(target_parts, dim=0)
    metrics = group_relation_metrics(logits, targets)
    metrics["loss"] = sum(losses) / max(1, len(losses))
    return metrics


def main():
    p = argparse.ArgumentParser()
    p.add_argument("base_checkpoint")
    p.add_argument("--corpus", required=True)
    p.add_argument("--out", default="tools/ink-foundation/runs/pri-ink-v4-group-relations.pt")
    p.add_argument("--mode", choices=["writer-disjoint", "same-writer-dev"], default="writer-disjoint")
    p.add_argument("--init-group-relations", default=None)
    p.add_argument("--allow-base-transfer", action="store_true")
    p.add_argument("--epochs", type=int, default=20)
    p.add_argument("--batch", type=int, default=8)
    p.add_argument("--lr", type=float, default=3e-4)
    p.add_argument("--weight-decay", type=float, default=0.02)
    p.add_argument("--seed", type=int, default=20260824)
    p.add_argument("--workers", type=int, default=0)
    p.add_argument("--device", default="auto")
    p.add_argument("--patience", type=int, default=6)
    args = p.parse_args()

    if args.epochs < 1 or args.batch < 1 or args.patience < 1:
        raise SystemExit("epochs, batch and patience must be >= 1")
    if args.allow_base_transfer and not args.init_group_relations:
        raise SystemExit("--allow-base-transfer requires --init-group-relations")

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
        raise SystemExit("group-relation training requires non-empty train and validation splits")
    if sum(len(x.structure.get("relations") or []) for x in train_rows) < 1:
        raise SystemExit("group-relation TRAIN split has no positive mathematical relations")
    if sum(len(x.structure.get("relations") or []) for x in val_rows) < 1:
        raise SystemExit("group-relation VALIDATION split has no positive mathematical relations")

    train_loader = DataLoader(
        StructuralInkDataset(examples, "train", cfg),
        batch_size=args.batch,
        shuffle=True,
        num_workers=args.workers,
    )
    val_loader = DataLoader(
        StructuralInkDataset(examples, "validation", cfg),
        batch_size=args.batch,
        shuffle=False,
        num_workers=args.workers,
    )
    head = GroupRelationHead(cfg.d_model).to(device)
    init_meta = None
    if args.init_group_relations:
        init_meta = _load_initial_head(
            head,
            Path(args.init_group_relations),
            current_base_hash=base_hash,
            allow_base_transfer=args.allow_base_transfer,
        )

    opt = torch.optim.AdamW(
        head.parameters(), lr=args.lr, weight_decay=args.weight_decay, betas=(0.9, 0.98)
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
        stage = "group-relation-research-dev"
        evidence = "same-writer development glyph-relation evaluation only; not production evidence"
    elif synthetic_only:
        stage = "group-relation-research"
        evidence = "synthetic glyph-relation pretraining only; never real handwriting accuracy"
    else:
        stage = "group-relation-research"
        evidence = "writer-disjoint glyph-relation research only; full real-Pencil promotion gates still apply"

    print("\nPri Ink Structural V4 — POOLED GROUP RELATION TRAINING V2\n")
    print(f"mode={args.mode} device={device} train={len(train_rows)} validation={len(val_rows)}")
    print(f"base={base_path} sha256={base_hash[:16]}…")
    if init_meta:
        print(f"initial group relations={init_meta['path']} base_transfer={init_meta['baseTransfer']}")
    print(f"synthetic-only={str(synthetic_only).lower()} production-ready=false")

    for epoch in range(1, args.epochs + 1):
        head.train(); running = 0.0; steps = pairs = positive = none = 0
        for batch in train_loader:
            with torch.no_grad():
                outputs = base_model(
                    batch["stroke_points"].to(device),
                    batch["stroke_point_valid"].to(device),
                    batch["stroke_valid"].to(device),
                    batch["stroke_geometry"].to(device),
                    batch["raster"].to(device),
                )
            scored = score_supervised_group_relations(head, outputs, batch, device=device)
            if scored.pairs < 1:
                continue
            opt.zero_grad(set_to_none=True)
            loss = balanced_group_relation_loss(scored)
            if not torch.isfinite(loss):
                raise SystemExit("non-finite group-relation loss")
            loss.backward()
            torch.nn.utils.clip_grad_norm_(head.parameters(), 1.0)
            opt.step(); sched.step()
            running += float(loss.detach()); steps += 1
            pairs += scored.pairs; positive += scored.positive_pairs; none += scored.none_pairs

        if steps < 1 or positive < 1 or none < 1:
            raise SystemExit(
                "group-relation epoch lacks positive and NONE supervision; corpus is not relation-diverse enough"
            )
        metrics = evaluate_head(base_model, head, val_loader, device)
        if metrics["positivePairs"] < 1 or metrics["nonePairs"] < 1:
            raise SystemExit("group-relation validation lacks positive/NONE supervision")
        score = (
            0.35 * metrics["macroPositiveRecall"]
            + 0.25 * metrics["macroPositiveTypeRecall"]
            + 0.25 * metrics["existenceBalancedAccuracy"]
            + 0.15 * metrics["noneAccuracy"]
        )
        print(
            f"epoch={epoch} train_loss={running/max(1,steps):.4f} train_pairs={pairs} "
            f"train_pos={positive} train_none={none} val_loss={metrics['loss']:.4f} "
            f"pos={metrics['positiveAccuracy']:.4f} type={metrics['positiveTypeAccuracy']:.4f} "
            f"exist_bal={metrics['existenceBalancedAccuracy']:.4f} none={metrics['noneAccuracy']:.4f} "
            f"macro_pos={metrics['macroPositiveRecall']:.4f} macro_type={metrics['macroPositiveTypeRecall']:.4f}"
        )
        if score > best + 1e-6:
            best = score; stale = 0
            checkpoint = {
                "architecture_version": 4,
                "group_relation_version": GROUP_RELATION_VERSION,
                "stage": stage,
                "production_ready": False,
                "objective": GROUP_RELATION_OBJECTIVE,
                "d_model": cfg.d_model,
                "relation_classes": len(RELATIONS),
                "base_checkpoint_sha256": base_hash,
                "base_checkpoint_stage": base_ckpt.get("stage"),
                "base_config": cfg.to_dict(),
                "model": head.state_dict(),
                "validation": metrics,
                "validation_protocol": protocol,
                "initialisation": init_meta,
                "training": {
                    "seed": args.seed,
                    "syntheticOnly": synthetic_only,
                    "loss": {
                        "existence": "balanced-any-positive-vs-none-bce",
                        "positiveType": "macro-balanced-positive-only-ce",
                        "positiveVsNoneMargin": GROUP_RELATION_MARGIN,
                        "typeWeight": GROUP_RELATION_TYPE_WEIGHT,
                        "marginWeight": GROUP_RELATION_MARGIN_WEIGHT,
                    },
                },
                "evidence": evidence,
            }
            torch.save(checkpoint, out)
            out.with_suffix(".json").write_text(json.dumps({
                "architectureVersion": 4,
                "groupRelationVersion": GROUP_RELATION_VERSION,
                "stage": stage,
                "productionReady": False,
                "objective": GROUP_RELATION_OBJECTIVE,
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
        raise SystemExit("group-relation training did not produce a checkpoint")
    print(f"best group-relation checkpoint: {out} score={best:.4f}")
    print("production ready: false")


if __name__ == "__main__":
    main()
