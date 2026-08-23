#!/usr/bin/env python3
"""Expression-level evaluation for Pri Ink Structural V4.

Head metrics are diagnostic only. This evaluator measures what Pri Learning
actually needs: complete canonical mathematical-expression correctness and the
precision/coverage trade-off after uncertainty abstention.

Final-holdout access is deliberately locked, mirroring the V3 evidence policy.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from collections import defaultdict
from pathlib import Path

import torch
from torch.utils.data import DataLoader

from data import TOKEN_TO_ID
from structural import PriInkStructuralV4, StructuralConfig
from structural_data import StructuralInkDataset, corpus_files, load_structural_examples
from structural_decode import decode_structural_output


def edit_distance(a: str, b: str) -> int:
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(cur[-1] + 1, prev[j] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


def is_critical_structure(text: str) -> bool:
    return any(marker in text for marker in ("^(", "sqrt(", ")/(", "<=", ">=", "_"))


def checkpoint_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main():
    p = argparse.ArgumentParser()
    p.add_argument("checkpoint")
    p.add_argument("--corpus", required=True)
    p.add_argument("--split", choices=["validation", "test", "final-holdout"], default="validation")
    p.add_argument("--device", default="auto")
    p.add_argument("--group-threshold", type=float, default=0.65)
    p.add_argument("--relation-threshold", type=float, default=0.60)
    p.add_argument("--ambiguity-threshold", type=float, default=0.80)
    p.add_argument("--unlock-final-holdout", action="store_true")
    p.add_argument("--out", default=None)
    args = p.parse_args()

    if args.split == "final-holdout" and not args.unlock_final_holdout:
        raise SystemExit(
            "final-holdout is locked. Freeze the candidate first, then pass "
            "--unlock-final-holdout exactly once for release evidence."
        )
    for name, value in (
        ("group-threshold", args.group_threshold),
        ("relation-threshold", args.relation_threshold),
        ("ambiguity-threshold", args.ambiguity_threshold),
    ):
        if not 0.0 < value < 1.0:
            raise SystemExit(f"--{name} must be between 0 and 1")

    checkpoint = Path(args.checkpoint)
    ckpt = torch.load(checkpoint, map_location="cpu", weights_only=False)
    if int(ckpt.get("architecture_version", 0)) != 4:
        raise SystemExit("checkpoint is not Pri Ink Structural V4")
    if ckpt.get("stage") != "structural-research":
        raise SystemExit(f"unexpected V4 checkpoint stage: {ckpt.get('stage')!r}")
    if ckpt.get("production_ready") is not False:
        raise SystemExit("research V4 checkpoint must not claim production readiness")

    vocab = ckpt.get("vocab") or []
    if vocab != list(TOKEN_TO_ID.keys()):
        raise SystemExit("V4 checkpoint vocabulary does not match current runtime vocabulary")
    cfg = StructuralConfig(**ckpt["config"])

    if args.device == "auto":
        device = torch.device(
            "cuda" if torch.cuda.is_available() else
            "mps" if torch.backends.mps.is_available() else "cpu"
        )
    else:
        device = torch.device(args.device)

    examples = load_structural_examples(corpus_files(args.corpus))
    selected = [x for x in examples if x.split == args.split]
    if not selected:
        raise SystemExit(f"no structure-annotated {args.split!r} samples found")
    dataset = StructuralInkDataset(examples, args.split, cfg)
    loader = DataLoader(dataset, batch_size=1, shuffle=False, num_workers=0)
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
        "stage": "structural-research",
        "productionReady": False,
        "split": args.split,
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
        "evidence": "research evaluation only; does not promote a V4 model",
    }

    print("\nPri Ink Structural V4 expression evaluation\n")
    print(f"split: {args.split} · writers: {len(by_writer)} · samples: {total}")
    print(f"exact expression: {100*metrics['exactExpressionAccuracy']:.2f}%")
    print(f"CER: {100*metrics['characterErrorRate']:.2f}%")
    print(f"critical structure exact: {100*metrics['criticalStructureExact']:.2f}% ({critical_total} samples)")
    print(f"abstention coverage: {100*metrics['coverage']:.2f}%")
    print(f"safe precision among accepted: {100*metrics['safePrecision']:.2f}%")
    print(f"worst writer exact: {100*metrics['worstWriterExact']:.2f}%")
    print("production ready: false")

    if args.out:
        out = Path(args.out)
        out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(metrics, indent=2) + "\n")
        print(f"report: {out}")


if __name__ == "__main__":
    main()
