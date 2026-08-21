#!/usr/bin/env python3
"""Fit post-hoc temperatures on the locked calibration writers only.

Calibration is intentionally separate from training. Test/final-holdout examples
are never used to choose confidence temperatures or acceptance thresholds here.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import torch
import torch.nn.functional as F
from torch.utils.data import DataLoader

from dataset import InkExample, discover, load_corpus
from model import PriInkOnlineTransformer
from train import ExampleDataset, collate, device_for_training
from vocabulary import BLANK_ID


def losses_for_temperature(
    model: PriInkOnlineTransformer,
    examples: list[InkExample],
    device: torch.device,
    token_temperature: float,
    count_temperature: float,
    batch_size: int,
) -> tuple[float, float]:
    loader = DataLoader(ExampleDataset(examples), batch_size=batch_size, shuffle=False, collate_fn=collate)
    ctc = torch.nn.CTCLoss(blank=BLANK_ID, zero_infinity=True, reduction="sum")
    token_total = count_total = 0.0
    n = 0
    model.eval()
    with torch.no_grad():
        for batch in loader:
            points = batch["points"].to(device)
            mask = batch["padding_mask"].to(device)
            input_lengths = batch["input_lengths"].to(device)
            targets = batch["targets"].to(device)
            target_lengths = batch["target_lengths"].to(device)
            counts = batch["counts"].to(device)
            out = model(points, mask)
            token_lp = F.log_softmax(out["token_logits"] / token_temperature, -1).transpose(0, 1)
            token_total += float(ctc(token_lp, targets, input_lengths, target_lengths).cpu())
            count_total += float(F.cross_entropy(out["count_logits"] / count_temperature, counts, reduction="sum").cpu())
            n += points.size(0)
    return token_total / max(n, 1), count_total / max(n, 1)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("checkpoint")
    parser.add_argument("--corpus", default="client/test/ink-corpus")
    parser.add_argument("--output", default=None)
    parser.add_argument("--batch-size", type=int, default=24)
    args = parser.parse_args()

    examples = load_corpus(discover(args.corpus))
    calibration = [e for e in examples if e.split == "calibration"]
    if not calibration:
        raise SystemExit("No calibration-writer samples. Calibration cannot be fabricated from train/test data.")

    checkpoint = torch.load(args.checkpoint, map_location="cpu", weights_only=False)
    model = PriInkOnlineTransformer().to(device_for_training())
    model.load_state_dict(checkpoint["state_dict"])
    device = next(model.parameters()).device

    grid = [0.50 + i * 0.05 for i in range(51)]  # 0.50 ... 3.00
    token_scores: list[tuple[float, float]] = []
    count_scores: list[tuple[float, float]] = []
    # Optimize each head independently. This is slower than differentiating one
    # scalar but deterministic and avoids optimizer sensitivity on a small set.
    for temperature in grid:
        token_loss, _ = losses_for_temperature(model, calibration, device, temperature, 1.0, args.batch_size)
        token_scores.append((token_loss, temperature))
        _, count_loss = losses_for_temperature(model, calibration, device, 1.0, temperature, args.batch_size)
        count_scores.append((count_loss, temperature))

    token_loss, token_temperature = min(token_scores)
    count_loss, count_temperature = min(count_scores)
    output = Path(args.output) if args.output else Path(args.checkpoint).with_suffix(".calibration.json")
    payload = {
        "schema": "pri-ink-calibration-v1",
        "checkpoint": str(args.checkpoint),
        "featureContract": checkpoint.get("feature_contract"),
        "calibrationParticipants": sorted({e.participant_id for e in calibration}),
        "calibrationExamples": len(calibration),
        "tokenTemperature": token_temperature,
        "countTemperature": count_temperature,
        "tokenCTCNLLPerExample": token_loss,
        "countNLLPerExample": count_loss,
        "testDataUsed": False,
        "finalHoldoutUsed": False,
    }
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(json.dumps(payload, indent=2))
    print("wrote", output)


if __name__ == "__main__":
    main()
