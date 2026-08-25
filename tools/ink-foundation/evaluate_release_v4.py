#!/usr/bin/env python3
"""Run the existing Pri Ink production reliability gates on a frozen V4 model.

This intentionally reuses the V3 release metrics/thresholds rather than creating
a friendlier V4 scorecard. The only difference is model construction. The final
holdout remains explicit opt-in and must never be used for tuning.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import torch
from torch.utils.data import DataLoader

from data import PAD_ID, VOCAB, InkDataset, corpus_files, load_examples
from evaluate_release import RELEASE, passes, score, sha256
from model import ModelConfig
from model_v4 import PriInkFoundationV4


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("checkpoint")
    parser.add_argument("--corpus", default="client/test/ink-corpus")
    parser.add_argument("--split", choices=["test", "final-holdout"], default="test")
    parser.add_argument("--unlock-final-holdout", action="store_true")
    parser.add_argument("--out", default=None)
    parser.add_argument("--batch", type=int, default=16)
    parser.add_argument("--device", default="auto")
    args = parser.parse_args()

    if args.split == "final-holdout" and not args.unlock_final_holdout:
        raise SystemExit(
            "Refusing to read final-holdout. Re-run with --unlock-final-holdout only for a frozen release candidate."
        )
    if args.split == "final-holdout":
        print(
            "WARNING: FINAL HOLDOUT IS NOW SPENT FOR THIS RELEASE CANDIDATE. "
            "Do not tune against this score.\n"
        )

    checkpoint = Path(args.checkpoint)
    ckpt = torch.load(checkpoint, map_location="cpu", weights_only=False)
    if int(ckpt.get("architecture_version") or 0) != 4:
        raise SystemExit("evaluate_release_v4.py requires an architecture_version=4 checkpoint")
    if ckpt.get("stage") != "finetune":
        raise SystemExit(
            "release evaluation requires a real-writer fine-tuned checkpoint, not synthetic pretraining"
        )
    if ckpt.get("vocab") != VOCAB:
        raise SystemExit("checkpoint vocabulary does not match this evaluator")

    cfg = ModelConfig(**ckpt["config"])
    train_writers = ckpt.get("train_writers") or []
    model = PriInkFoundationV4(
        len(VOCAB),
        PAD_ID,
        cfg,
        writer_classes=len(train_writers),
        style_dropout=float(ckpt.get("style_dropout", 0.20)),
    )
    model.load_state_dict(ckpt["model"])

    if args.device == "auto":
        device = torch.device(
            "cuda" if torch.cuda.is_available() else
            "mps" if torch.backends.mps.is_available() else "cpu"
        )
    else:
        device = torch.device(args.device)
    model = model.to(device)

    examples = load_examples(corpus_files(args.corpus))
    selected = [example for example in examples if example.split == args.split]
    if not selected:
        raise SystemExit(f"no {args.split!r} samples found under {args.corpus!r}")

    # Release evidence must also be writer-disjoint from training. This check is
    # explicit here even though corpus loading already prevents one writer from
    # occupying two declared splits: a checkpoint may have been trained on an
    # older corpus snapshot.
    trained = set(train_writers)
    leaked = sorted({example.writer for example in selected} & trained)
    if leaked:
        raise SystemExit(
            f"writer-disjoint release evaluation violated; trained writers in {args.split}: {leaked[:8]}"
        )

    writers = sorted({example.writer for example in selected})
    writer_to_id = {writer: index for index, writer in enumerate(writers)}
    dataset = InkDataset(
        selected,
        args.split,
        cfg.max_points,
        cfg.max_tokens,
        cfg.raster_height,
        cfg.raster_width,
        writer_to_id,
    )
    loader = DataLoader(
        dataset, batch_size=args.batch, shuffle=False, num_workers=0
    )
    metrics = score(model, loader, device)
    passed = passes(metrics)

    report = {
        "format": "pri-ink-release-eval",
        "version": 2,
        "checkpointSha256": sha256(checkpoint),
        "checkpointStage": ckpt.get("stage"),
        "architectureVersion": 4,
        "split": args.split,
        "metrics": metrics,
        "releaseTargets": RELEASE,
        "passesReleaseTargets": passed,
        "note": (
            "Aggregate-only V4 evaluation using the unchanged production gates. "
            "Never tune against final-holdout errors or repeated final-holdout scores."
        ),
    }
    out = (
        Path(args.out)
        if args.out
        else checkpoint.with_name(f"{checkpoint.stem}-{args.split}-report.json")
    )
    out.write_text(json.dumps(report, indent=2), encoding="utf-8")

    print(
        f"split={args.split} samples={metrics['samples']} writers={metrics['writers']} "
        f"min/writer={metrics['min_samples_per_writer']}"
    )
    print(
        f"exact={100*metrics['exact']:.2f}% CER={100*metrics['cer']:.3f}% "
        f"worst-writer={100*metrics['worst_writer_exact']:.2f}%"
    )
    print(
        f"critical-structure={100*metrics['critical_structure_exact']:.2f}% "
        f"({metrics['critical_structure_samples']} samples)"
    )
    print(
        f"safe precision={100*metrics['safe_precision']:.3f}% at "
        f"{100*metrics['safe_coverage']:.1f}% coverage "
        f"(threshold={metrics['safe_threshold']:.2f})"
    )
    print(f"V4 release targets: {'PASS' if passed else 'FAIL'}")
    print(f"report: {out}")
    raise SystemExit(0 if passed else 2)


if __name__ == "__main__":
    main()
