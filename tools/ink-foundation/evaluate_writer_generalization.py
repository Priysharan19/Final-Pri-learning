#!/usr/bin/env python3
"""Stress-test a frozen Pri Ink V4 checkpoint across handwriting styles.

This evaluator never changes labels and never tunes the model.  It measures how
often a correct expression survives plausible changes in slant, aspect, speed,
pressure, width, point density and page angle.  Real writer-disjoint evidence is
still mandatory: synthetic style perturbations are a robustness probe, not a
substitute for people.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from collections import defaultdict
from pathlib import Path

import torch

from data import EOS_ID, PAD_ID, VOCAB, corpus_files, decode, load_examples, point_features, rasterize
from evaluate_release import edit_distance, is_critical_structure, prediction_confidence
from model import ModelConfig
from model_v4 import PriInkFoundationV4
from style_augmentation import augmented_strokes


TARGETS = {
    "writers": 20,
    "samples": 1000,
    "base_exact": 0.98,
    "perturbed_exact": 0.97,
    "robust_exact": 0.95,
    "worst_writer_base_exact": 0.90,
    "worst_writer_robust_exact": 0.90,
    "prediction_flip_rate": 0.02,
    "critical_robust_exact": 0.98,
}


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as file:
        for chunk in iter(lambda: file.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def _device(name: str) -> torch.device:
    if name != "auto":
        return torch.device(name)
    return torch.device(
        "cuda" if torch.cuda.is_available() else
        "mps" if torch.backends.mps.is_available() else "cpu"
    )


@torch.no_grad()
def infer(model, strokes, config: ModelConfig, device: torch.device):
    points, valid = point_features(strokes, config.max_points, augment=False)
    raster = rasterize(strokes, config.raster_height, config.raster_width, augment=False)
    points_t = torch.from_numpy(points).unsqueeze(0).to(device)
    valid_t = torch.from_numpy(valid).unsqueeze(0).to(device)
    raster_t = torch.from_numpy(raster).unsqueeze(0).to(device)
    logits, _ = model(points_t, valid_t, raster_t)
    logits = logits[0].float().cpu()
    ids = logits.argmax(-1)
    return decode(ids.tolist()), prediction_confidence(logits, ids)


def evaluate(model, examples, config: ModelConfig, device: torch.device,
             perturbations: int, seed: int):
    model.eval()
    base_correct = 0
    base_char_errors = 0
    base_char_total = 0
    variant_correct = 0
    variant_total = 0
    robust_correct = 0
    flips = 0
    critical_total = 0
    critical_robust = 0
    confidence_drop = []
    by_writer = defaultdict(lambda: {"n": 0, "base": 0, "robust": 0, "flips": 0, "variants": 0})

    for index, example in enumerate(examples):
        truth = example.target
        base_pred, base_conf = infer(model, example.strokes, config, device)
        base_ok = base_pred == truth
        base_correct += int(base_ok)
        base_char_errors += edit_distance(base_pred, truth)
        base_char_total += max(1, len(truth))

        all_variants_ok = True
        writer_row = by_writer[example.writer]
        writer_row["n"] += 1
        writer_row["base"] += int(base_ok)

        for view in range(perturbations):
            view_seed = int(seed + index * 104729 + view * 1009)
            transformed = augmented_strokes(example.strokes, view_seed)
            pred, confidence = infer(model, transformed, config, device)
            ok = pred == truth
            variant_correct += int(ok)
            variant_total += 1
            all_variants_ok = all_variants_ok and ok
            changed = pred != base_pred
            flips += int(changed)
            writer_row["flips"] += int(changed)
            writer_row["variants"] += 1
            confidence_drop.append(base_conf - confidence)

        robust = base_ok and all_variants_ok
        robust_correct += int(robust)
        writer_row["robust"] += int(robust)
        if is_critical_structure(truth):
            critical_total += 1
            critical_robust += int(robust)

    writer_metrics = {}
    for writer, row in sorted(by_writer.items()):
        writer_metrics[writer] = {
            "samples": row["n"],
            "baseExact": row["base"] / max(1, row["n"]),
            "robustExact": row["robust"] / max(1, row["n"]),
            "flipRate": row["flips"] / max(1, row["variants"]),
        }

    metrics = {
        "samples": len(examples),
        "writers": len(writer_metrics),
        "perturbationsPerSample": perturbations,
        "baseExact": base_correct / max(1, len(examples)),
        "baseCER": base_char_errors / max(1, base_char_total),
        "perturbedExact": variant_correct / max(1, variant_total),
        "robustExact": robust_correct / max(1, len(examples)),
        "predictionFlipRate": flips / max(1, variant_total),
        "worstWriterBaseExact": min((m["baseExact"] for m in writer_metrics.values()), default=0.0),
        "worstWriterRobustExact": min((m["robustExact"] for m in writer_metrics.values()), default=0.0),
        "criticalSamples": critical_total,
        "criticalRobustExact": critical_robust / max(1, critical_total),
        "meanConfidenceDropUnderStyleShift": sum(confidence_drop) / max(1, len(confidence_drop)),
        "byWriter": writer_metrics,
    }
    return metrics


def passes(metrics: dict) -> bool:
    return (
        metrics["writers"] >= TARGETS["writers"]
        and metrics["samples"] >= TARGETS["samples"]
        and metrics["baseExact"] >= TARGETS["base_exact"]
        and metrics["perturbedExact"] >= TARGETS["perturbed_exact"]
        and metrics["robustExact"] >= TARGETS["robust_exact"]
        and metrics["worstWriterBaseExact"] >= TARGETS["worst_writer_base_exact"]
        and metrics["worstWriterRobustExact"] >= TARGETS["worst_writer_robust_exact"]
        and metrics["predictionFlipRate"] <= TARGETS["prediction_flip_rate"]
        and metrics["criticalSamples"] > 0
        and metrics["criticalRobustExact"] >= TARGETS["critical_robust_exact"]
    )


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("checkpoint")
    parser.add_argument("--corpus", default="client/test/ink-corpus")
    parser.add_argument("--split", choices=["validation", "test", "final-holdout"], default="test")
    parser.add_argument("--unlock-final-holdout", action="store_true")
    parser.add_argument("--perturbations", type=int, default=8)
    parser.add_argument("--seed", type=int, default=20260825)
    parser.add_argument("--device", default="auto")
    parser.add_argument("--out", default=None)
    parser.add_argument("--enforce", action="store_true", help="exit 2 when V16 targets are not met")
    args = parser.parse_args()

    if args.perturbations < 1:
        raise SystemExit("--perturbations must be >= 1")
    if args.split == "final-holdout" and not args.unlock_final_holdout:
        raise SystemExit("Refusing to inspect final-holdout without --unlock-final-holdout")

    checkpoint_path = Path(args.checkpoint)
    checkpoint = torch.load(checkpoint_path, map_location="cpu", weights_only=False)
    if int(checkpoint.get("architecture_version") or 0) != 4:
        raise SystemExit("writer-generalization evaluation requires an architecture_version=4 checkpoint")
    if checkpoint.get("vocab") != VOCAB:
        raise SystemExit("checkpoint vocabulary does not match evaluator vocabulary")

    config = ModelConfig(**checkpoint["config"])
    train_writers = checkpoint.get("train_writers") or []
    model = PriInkFoundationV4(
        len(VOCAB), PAD_ID, config, writer_classes=len(train_writers),
        style_dropout=float(checkpoint.get("style_dropout", 0.20)),
    )
    model.load_state_dict(checkpoint["model"])
    device = _device(args.device)
    model = model.to(device)

    all_examples = load_examples(corpus_files(args.corpus))
    selected = [example for example in all_examples if example.split == args.split]
    if not selected:
        raise SystemExit(f"no {args.split!r} samples found under {args.corpus!r}")
    train_writer_set = set(train_writers)
    leaked = sorted({example.writer for example in selected} & train_writer_set)
    if leaked:
        raise SystemExit(f"writer-disjoint evaluation violated; trained writers in {args.split}: {leaked[:8]}")

    metrics = evaluate(model, selected, config, device, args.perturbations, args.seed)
    passed = passes(metrics)
    report = {
        "format": "pri-ink-writer-generalization",
        "version": 1,
        "checkpointSha256": sha256(checkpoint_path),
        "split": args.split,
        "targets": TARGETS,
        "metrics": metrics,
        "passesTargets": passed,
        "note": (
            "Style perturbations are a stress test only. Production readiness still requires "
            "the real writer-disjoint sample/writer minimums and untouched final-holdout policy."
        ),
    }
    output = Path(args.out) if args.out else checkpoint_path.with_name(
        f"{checkpoint_path.stem}-{args.split}-writer-generalization.json"
    )
    output.write_text(json.dumps(report, indent=2), encoding="utf-8")

    print(
        f"writers={metrics['writers']} samples={metrics['samples']} "
        f"base={100*metrics['baseExact']:.2f}% perturbed={100*metrics['perturbedExact']:.2f}% "
        f"robust={100*metrics['robustExact']:.2f}%"
    )
    print(
        f"worst-writer base={100*metrics['worstWriterBaseExact']:.2f}% "
        f"robust={100*metrics['worstWriterRobustExact']:.2f}% "
        f"flip-rate={100*metrics['predictionFlipRate']:.2f}%"
    )
    print(f"V16 writer-generalization targets: {'PASS' if passed else 'NOT YET'}")
    print(f"report: {output}")
    if args.enforce and not passed:
        raise SystemExit(2)


if __name__ == "__main__":
    main()
