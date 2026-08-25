#!/usr/bin/env python3
"""Run Pri Ink production reliability gates on a frozen Foundation V4 model.

The thresholds are intentionally unchanged from V3. The scoring path is V4-
aware so append-only symbols such as the integral sign are decoded and counted
correctly rather than being silently treated as <unk>. The final holdout remains
explicit opt-in and must never be used for tuning.
"""
from __future__ import annotations

import argparse
import json
from collections import defaultdict
from pathlib import Path

import torch
from torch.utils.data import DataLoader

from data_v4 import (
    PAD_ID,
    VOCAB,
    InkDatasetV4,
    corpus_files,
    decode,
    load_examples,
)
from evaluate_release import (
    RELEASE,
    edit_distance,
    is_critical_structure,
    passes,
    prediction_confidence,
    sha256,
)
from model import ModelConfig
from model_v4 import PriInkFoundationV4


def _critical_v4(text: str) -> bool:
    return is_critical_structure(text) or "∫" in text


@torch.no_grad()
def score_v4(model, loader, device):
    model.eval()
    total = exact = char_total = char_errors = 0
    critical_total = critical_exact = 0
    safe_total = safe_correct = 0
    by_writer: dict[int, list[int]] = defaultdict(list)
    confidences = []

    for batch in loader:
        logits, _ = model(
            batch["points"].to(device),
            batch["point_valid"].to(device),
            batch["raster"].to(device),
        )
        ids = logits.argmax(-1).cpu()
        logits_cpu = logits.float().cpu()
        truths = list(batch["target_text"])
        writers = batch["writer"].tolist()
        for row in range(ids.shape[0]):
            pred = decode(ids[row].tolist())
            truth = truths[row]
            ok = int(pred == truth)
            confidence = prediction_confidence(logits_cpu[row], ids[row])

            total += 1
            exact += ok
            char_total += max(1, len(truth))
            char_errors += edit_distance(pred, truth)
            by_writer[int(writers[row])].append(ok)
            confidences.append(confidence)

            if _critical_v4(truth):
                critical_total += 1
                critical_exact += ok

            if confidence >= RELEASE["safe_confidence_threshold"]:
                safe_total += 1
                safe_correct += ok

    writer_exact = [sum(v) / len(v) for v in by_writer.values() if v]
    writer_counts = [len(v) for v in by_writer.values() if v]
    safe_precision = safe_correct / safe_total if safe_total else 0.0
    return {
        "samples": total,
        "writers": len(writer_exact),
        "min_samples_per_writer": min(writer_counts, default=0),
        "exact": exact / max(1, total),
        "cer": char_errors / max(1, char_total),
        "worst_writer_exact": min(writer_exact, default=0.0),
        "critical_structure_samples": critical_total,
        "critical_structure_exact": critical_exact / max(1, critical_total),
        "safe_threshold": RELEASE["safe_confidence_threshold"],
        "safe_samples": safe_total,
        "safe_coverage": safe_total / max(1, total),
        "safe_precision": safe_precision,
        "mean_confidence": sum(confidences) / max(1, len(confidences)),
    }


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
        raise SystemExit(
            "evaluate_release_v4.py requires an architecture_version=4 checkpoint"
        )
    if ckpt.get("stage") != "finetune":
        raise SystemExit(
            "release evaluation requires a real-writer fine-tuned checkpoint, not synthetic pretraining"
        )
    if ckpt.get("vocab") != VOCAB:
        raise SystemExit("checkpoint vocabulary does not match the V4 evaluator")

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
            "cuda"
            if torch.cuda.is_available()
            else "mps"
            if torch.backends.mps.is_available()
            else "cpu"
        )
    else:
        device = torch.device(args.device)
    model = model.to(device)

    examples = load_examples(corpus_files(args.corpus))
    selected = [example for example in examples if example.split == args.split]
    if not selected:
        raise SystemExit(f"no {args.split!r} samples found under {args.corpus!r}")

    trained = set(train_writers)
    leaked = sorted({example.writer for example in selected} & trained)
    if leaked:
        raise SystemExit(
            f"writer-disjoint release evaluation violated; trained writers in {args.split}: {leaked[:8]}"
        )

    writers = sorted({example.writer for example in selected})
    writer_to_id = {writer: index for index, writer in enumerate(writers)}
    dataset = InkDatasetV4(
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
    metrics = score_v4(model, loader, device)
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
