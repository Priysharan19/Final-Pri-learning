#!/usr/bin/env python3
"""Evaluate one frozen Pri Ink Foundation checkpoint on a writer-locked split.

`final-holdout` is intentionally opt-in. Running it spends release evidence even
if no individual errors are printed; do not use repeated aggregate scores as a
tuning loop.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from collections import defaultdict
from pathlib import Path

import torch
from torch.utils.data import DataLoader

from data import EOS_ID, PAD_ID, VOCAB, InkDataset, corpus_files, decode, load_examples
from model import ModelConfig, PriInkFoundation


RELEASE = {
    "exact": 0.97,
    "cer": 0.005,
    "worst_writer_exact": 0.95,
    "high_conf_wrong_rate": 0.005,
    "writers": 20,
    "min_samples_per_writer": 30,
}


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def edit_distance(a: str, b: str) -> int:
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(cur[-1] + 1, prev[j] + 1,
                           prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


def prediction_confidence(logits: torch.Tensor, ids: torch.Tensor) -> float:
    # Mirrors the native runtime's mean/weakest blend over emitted slots.
    probs = logits.softmax(-1)
    values = []
    for slot, token in enumerate(ids.tolist()):
        if token in (EOS_ID, PAD_ID):
            break
        values.append(float(probs[slot, token]))
    if not values:
        return 0.0
    return 0.65 * (sum(values) / len(values)) + 0.35 * min(values)


@torch.no_grad()
def score(model, loader, device):
    model.eval()
    total = exact = char_total = char_errors = high_conf_wrong = 0
    by_writer: dict[int, list[int]] = defaultdict(list)
    confidences = []

    for batch in loader:
        logits, _ = model(
            batch["points"].to(device), batch["point_valid"].to(device),
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
            total += 1; exact += ok
            char_total += max(1, len(truth)); char_errors += edit_distance(pred, truth)
            by_writer[int(writers[row])].append(ok)
            confidences.append(confidence)
            if not ok and confidence >= 0.90:
                high_conf_wrong += 1

    writer_exact = [sum(v) / len(v) for v in by_writer.values() if v]
    writer_counts = [len(v) for v in by_writer.values() if v]
    return {
        "samples": total,
        "writers": len(writer_exact),
        "min_samples_per_writer": min(writer_counts, default=0),
        "exact": exact / max(1, total),
        "cer": char_errors / max(1, char_total),
        "worst_writer_exact": min(writer_exact, default=0.0),
        "high_conf_wrong_rate": high_conf_wrong / max(1, total),
        "mean_confidence": sum(confidences) / max(1, len(confidences)),
    }


def passes(metrics: dict) -> bool:
    return (
        metrics["exact"] >= RELEASE["exact"]
        and metrics["cer"] <= RELEASE["cer"]
        and metrics["worst_writer_exact"] >= RELEASE["worst_writer_exact"]
        and metrics["high_conf_wrong_rate"] <= RELEASE["high_conf_wrong_rate"]
        and metrics["writers"] >= RELEASE["writers"]
        and metrics["min_samples_per_writer"] >= RELEASE["min_samples_per_writer"]
    )


def main():
    p = argparse.ArgumentParser()
    p.add_argument("checkpoint")
    p.add_argument("--corpus", default="client/test/ink-corpus")
    p.add_argument("--split", choices=["test", "final-holdout"], default="test")
    p.add_argument("--unlock-final-holdout", action="store_true")
    p.add_argument("--out", default=None)
    p.add_argument("--batch", type=int, default=16)
    p.add_argument("--device", default="auto")
    args = p.parse_args()

    if args.split == "final-holdout" and not args.unlock_final_holdout:
        raise SystemExit(
            "Refusing to read final-holdout. Re-run with --unlock-final-holdout only for a frozen release candidate."
        )
    if args.split == "final-holdout":
        print("WARNING: FINAL HOLDOUT IS NOW SPENT FOR THIS RELEASE CANDIDATE. Do not tune against this score.\n")

    checkpoint = Path(args.checkpoint)
    ckpt = torch.load(checkpoint, map_location="cpu", weights_only=False)
    if ckpt.get("stage") != "finetune":
        raise SystemExit("release evaluation requires a real-writer fine-tuned checkpoint, not synthetic pretraining")
    if ckpt.get("vocab") != VOCAB:
        raise SystemExit("checkpoint vocabulary does not match this evaluator")

    cfg = ModelConfig(**ckpt["config"])
    train_writers = ckpt.get("train_writers") or []
    model = PriInkFoundation(len(VOCAB), PAD_ID, cfg, writer_classes=len(train_writers))
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
    selected = [x for x in examples if x.split == args.split]
    if not selected:
        raise SystemExit(f"no {args.split!r} samples found under {args.corpus!r}")
    writers = sorted({x.writer for x in selected})
    writer_to_id = {w: i for i, w in enumerate(writers)}
    dataset = InkDataset(
        selected, args.split, cfg.max_points, cfg.max_tokens,
        cfg.raster_height, cfg.raster_width, writer_to_id,
    )
    loader = DataLoader(dataset, batch_size=args.batch, shuffle=False, num_workers=0)
    metrics = score(model, loader, device)
    passed = passes(metrics)

    report = {
        "format": "pri-ink-release-eval",
        "version": 1,
        "checkpointSha256": sha256(checkpoint),
        "checkpointStage": ckpt.get("stage"),
        "split": args.split,
        "metrics": metrics,
        "releaseTargets": RELEASE,
        "passesReleaseTargets": passed,
        "note": "Aggregate-only evaluation. Do not inspect final-holdout errors or tune against repeated final-holdout runs."
    }
    out = Path(args.out) if args.out else checkpoint.with_name(f"{checkpoint.stem}-{args.split}-report.json")
    out.write_text(json.dumps(report, indent=2), encoding="utf-8")

    print(f"split={args.split} samples={metrics['samples']} writers={metrics['writers']} "
          f"min/writer={metrics['min_samples_per_writer']}")
    print(f"exact={100*metrics['exact']:.2f}% CER={100*metrics['cer']:.3f}% "
          f"worst-writer={100*metrics['worst_writer_exact']:.2f}% "
          f"high-conf-wrong={100*metrics['high_conf_wrong_rate']:.3f}%")
    print(f"release targets: {'PASS' if passed else 'FAIL'}")
    print(f"report: {out}")
    raise SystemExit(0 if passed else 2)


if __name__ == "__main__":
    main()
