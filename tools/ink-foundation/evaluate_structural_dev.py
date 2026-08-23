#!/usr/bin/env python3
"""Evaluate a Pri Ink Structural V4 same-writer development checkpoint.

This evaluator recreates the deterministic P0001 holdout stored in the checkpoint.
Its numbers are diagnostic only and are never writer-disjoint or production evidence.
"""
from __future__ import annotations

import argparse
import json
from collections import defaultdict
from pathlib import Path

import torch
from torch.utils.data import DataLoader

from data import TOKEN_TO_ID
from dev_split import make_same_writer_dev_split
from evaluate_structural import checkpoint_sha256, edit_distance, is_critical_structure
from structural import PriInkStructuralV4, StructuralConfig
from structural_data import StructuralInkDataset, corpus_files, load_structural_examples
from structural_decode import decode_structural_output


def main():
    p = argparse.ArgumentParser()
    p.add_argument("checkpoint")
    p.add_argument("--corpus", required=True)
    p.add_argument("--device", default="auto")
    p.add_argument("--group-threshold", type=float, default=0.65)
    p.add_argument("--relation-threshold", type=float, default=0.60)
    p.add_argument("--ambiguity-threshold", type=float, default=0.80)
    p.add_argument("--out", default=None)
    args = p.parse_args()

    checkpoint = Path(args.checkpoint)
    ckpt = torch.load(checkpoint, map_location="cpu", weights_only=False)
    if int(ckpt.get("architecture_version", 0)) != 4:
        raise SystemExit("checkpoint is not Pri Ink Structural V4")
    if ckpt.get("stage") != "structural-research-dev":
        raise SystemExit(f"expected structural-research-dev checkpoint, got {ckpt.get('stage')!r}")
    if ckpt.get("production_ready") is not False:
        raise SystemExit("dev checkpoint must never claim production readiness")
    if (ckpt.get("vocab") or []) != list(TOKEN_TO_ID.keys()):
        raise SystemExit("V4 checkpoint vocabulary does not match current runtime vocabulary")

    split_meta = ckpt.get("dev_split") or {}
    if split_meta.get("protocol") != "same-writer-dev-holdout":
        raise SystemExit("checkpoint has no valid same-writer dev split metadata")
    if split_meta.get("writerDisjoint") is not False or split_meta.get("productionEvidence") is not False:
        raise SystemExit("unsafe dev split metadata")

    examples = load_structural_examples(corpus_files(args.corpus))
    try:
        examples, recreated = make_same_writer_dev_split(
            examples,
            seed=int(split_meta["seed"]),
            fraction=float(split_meta["fraction"]),
        )
    except (ValueError, KeyError) as exc:
        raise SystemExit(str(exc)) from exc
    for key in ("writer", "trainSamples", "validationSamples"):
        if recreated.get(key) != split_meta.get(key):
            raise SystemExit(f"dev split reproduction mismatch for {key}: {recreated.get(key)!r} != {split_meta.get(key)!r}")

    cfg = StructuralConfig(**ckpt["config"])
    dataset = StructuralInkDataset(examples, "validation", cfg)
    if len(dataset) < 1:
        raise SystemExit("recreated dev validation split is empty")
    loader = DataLoader(dataset, batch_size=1, shuffle=False, num_workers=0)

    if args.device == "auto":
        device = torch.device(
            "cuda" if torch.cuda.is_available() else
            "mps" if torch.backends.mps.is_available() else "cpu"
        )
    else:
        device = torch.device(args.device)

    model = PriInkStructuralV4(len(TOKEN_TO_ID), cfg)
    model.load_state_dict(ckpt["model"], strict=True)
    model.to(device).eval()

    total = exact = char_errors = char_total = 0
    accepted = accepted_exact = 0
    critical_total = critical_exact = 0
    confidence_sum = 0.0
    by_writer: dict[str, list[int]] = defaultdict(list)
    warning_counts: dict[str, int] = defaultdict(int)

    with torch.inference_mode():
        for batch in loader:
            outputs = model(
                batch["stroke_points"].to(device),
                batch["stroke_point_valid"].to(device),
                batch["stroke_valid"].to(device),
                batch["stroke_geometry"].to(device),
                batch["raster"].to(device),
            )
            hyp = decode_structural_output(
                outputs,
                batch["stroke_geometry"].to(device),
                batch["stroke_valid"].to(device),
                group_threshold=args.group_threshold,
                relation_threshold=args.relation_threshold,
                ambiguity_threshold=args.ambiguity_threshold,
            )
            target = str(batch["target_text"][0])
            writer = str(batch["writer"][0])
            ok = int(hyp.canonical == target)
            total += 1; exact += ok
            char_errors += edit_distance(hyp.canonical, target)
            char_total += max(1, len(target))
            confidence_sum += hyp.confidence
            by_writer[writer].append(ok)
            if is_critical_structure(target):
                critical_total += 1; critical_exact += ok
            if not hyp.ambiguous:
                accepted += 1; accepted_exact += ok
            for warning in hyp.warnings:
                warning_counts[warning.split(":", 1)[0]] += 1

    writer_exact = {w: sum(v) / len(v) for w, v in sorted(by_writer.items())}
    metrics = {
        "architectureVersion": 4,
        "stage": "structural-research-dev",
        "productionReady": False,
        "validationProtocol": recreated,
        "checkpointSha256": checkpoint_sha256(checkpoint),
        "samples": total,
        "writers": len(by_writer),
        "exactExpressionAccuracy": exact / max(1, total),
        "characterErrorRate": char_errors / max(1, char_total),
        "criticalStructureExact": critical_exact / max(1, critical_total),
        "criticalStructureSamples": critical_total,
        "coverage": accepted / max(1, total),
        "safePrecision": accepted_exact / max(1, accepted),
        "acceptedSamples": accepted,
        "meanDecisionConfidence": confidence_sum / max(1, total),
        "worstWriterExact": min(writer_exact.values(), default=0.0),
        "writerExact": writer_exact,
        "warningCounts": dict(sorted(warning_counts.items())),
        "thresholds": {
            "group": args.group_threshold,
            "relation": args.relation_threshold,
            "ambiguity": args.ambiguity_threshold,
        },
        "evidence": "same-writer development evaluation only; not writer-disjoint and not production evidence",
    }

    print("\nPri Ink Structural V4 — SAME-WRITER DEV EVALUATION\n")
    print(f"writer: {recreated['writer']} · samples: {total}")
    print(f"exact expression: {100*metrics['exactExpressionAccuracy']:.2f}%")
    print(f"CER: {100*metrics['characterErrorRate']:.2f}%")
    print(f"critical structure exact: {100*metrics['criticalStructureExact']:.2f}% ({critical_total} samples)")
    print(f"abstention coverage: {100*metrics['coverage']:.2f}%")
    print(f"safe precision among accepted: {100*metrics['safePrecision']:.2f}%")
    print("writer-disjoint: false")
    print("production ready: false")

    if args.out:
        out = Path(args.out)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(metrics, indent=2) + "\n")
        print(f"report: {out}")


if __name__ == "__main__":
    main()
