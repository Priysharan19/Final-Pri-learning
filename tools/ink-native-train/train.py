#!/usr/bin/env python3
"""Train PRI's stroke-native mathematical handwriting model.

This script never trains on calibration/test/final_holdout writers. The final
holdout is sealed unless --unlock-final-holdout is passed explicitly after model
selection and calibration are frozen.
"""
from __future__ import annotations

import argparse
import json
import math
import random
import time
from dataclasses import asdict
from pathlib import Path

import numpy as np
import torch
import torch.nn.functional as F
from torch.nn.utils import clip_grad_norm_
from torch.utils.data import DataLoader, Dataset

from dataset import InkExample, audit, discover, load_corpus
from features import FEATURE_CONTRACT_VERSION, FEATURE_COUNT
from model import PriInkOnlineTransformer
from vocabulary import BLANK_ID, TOKENS, ctc_collapse, decode

SEED = 17021


class ExampleDataset(Dataset):
    def __init__(self, examples: list[InkExample]):
        self.examples = examples

    def __len__(self) -> int:
        return len(self.examples)

    def __getitem__(self, index: int) -> InkExample:
        return self.examples[index]


def collate(examples: list[InkExample]) -> dict[str, object]:
    batch = len(examples)
    max_points = max(len(e.features) for e in examples)
    points = torch.zeros(batch, max_points, FEATURE_COUNT, dtype=torch.float32)
    padding_mask = torch.ones(batch, max_points, dtype=torch.bool)
    input_lengths = torch.zeros(batch, dtype=torch.long)
    target_lengths = torch.tensor([len(e.token_ids) for e in examples], dtype=torch.long)
    targets = torch.tensor([token for e in examples for token in e.token_ids], dtype=torch.long)
    counts = torch.tensor([min(96, e.symbol_count) for e in examples], dtype=torch.long)
    for i, example in enumerate(examples):
        length = len(example.features)
        points[i, :length] = torch.tensor(example.features, dtype=torch.float32)
        padding_mask[i, :length] = False
        input_lengths[i] = length
    return {
        "points": points,
        "padding_mask": padding_mask,
        "input_lengths": input_lengths,
        "targets": targets,
        "target_lengths": target_lengths,
        "counts": counts,
        "examples": examples,
    }


def edit_distance(a: list[int], b: list[int]) -> int:
    previous = list(range(len(b) + 1))
    for i, x in enumerate(a, 1):
        current = [i]
        for j, y in enumerate(b, 1):
            current.append(min(current[-1] + 1, previous[j] + 1, previous[j - 1] + (x != y)))
        previous = current
    return previous[-1]


def device_for_training() -> torch.device:
    if torch.backends.mps.is_available():
        return torch.device("mps")
    if torch.cuda.is_available():
        return torch.device("cuda")
    return torch.device("cpu")


def evaluate(model: PriInkOnlineTransformer, examples: list[InkExample], device: torch.device, batch_size: int) -> dict[str, object]:
    if not examples:
        return {"examples": 0, "exact": None, "tokenErrorRate": None, "countAccuracy": None, "writers": {}}
    loader = DataLoader(ExampleDataset(examples), batch_size=batch_size, shuffle=False, collate_fn=collate)
    model.eval()
    exact = edits = tokens = count_correct = 0
    writer_stats: dict[str, dict[str, int]] = {}
    with torch.no_grad():
        for batch in loader:
            points = batch["points"].to(device)
            mask = batch["padding_mask"].to(device)
            out = model(points, mask)
            predicted = out["token_logits"].argmax(-1).cpu()
            count_pred = out["count_logits"].argmax(-1).cpu()
            lengths = batch["input_lengths"]
            batch_examples: list[InkExample] = batch["examples"]
            for i, example in enumerate(batch_examples):
                ids = ctc_collapse(predicted[i, : int(lengths[i])].tolist())
                target = example.token_ids
                distance = edit_distance(ids, target)
                ok = ids == target
                exact += int(ok)
                edits += distance
                tokens += len(target)
                count_correct += int(int(count_pred[i]) == example.symbol_count)
                stats = writer_stats.setdefault(example.participant_id, {"n": 0, "exact": 0, "edits": 0, "tokens": 0})
                stats["n"] += 1
                stats["exact"] += int(ok)
                stats["edits"] += distance
                stats["tokens"] += len(target)
    per_writer = {
        writer: {
            "examples": values["n"],
            "exact": values["exact"] / max(values["n"], 1),
            "tokenErrorRate": values["edits"] / max(values["tokens"], 1),
        }
        for writer, values in writer_stats.items()
    }
    writer_exact = [v["exact"] for v in per_writer.values()]
    return {
        "examples": len(examples),
        "exact": exact / len(examples),
        "tokenErrorRate": edits / max(tokens, 1),
        "countAccuracy": count_correct / len(examples),
        "worstWriterExact": min(writer_exact) if writer_exact else None,
        "medianWriterExact": float(np.median(writer_exact)) if writer_exact else None,
        "writers": per_writer,
    }


def train(args: argparse.Namespace) -> None:
    random.seed(SEED)
    np.random.seed(SEED)
    torch.manual_seed(SEED)

    paths = discover(args.corpus)
    examples = load_corpus(paths, include_finger=args.include_finger)
    corpus_audit = audit(examples)
    print(json.dumps(corpus_audit, indent=2))

    train_examples = [e for e in examples if e.split == "train"]
    calibration_examples = [e for e in examples if e.split == "calibration"]
    test_examples = [e for e in examples if e.split == "test"]
    final_examples = [e for e in examples if e.split == "final_holdout"]
    if not train_examples:
        raise SystemExit("No V2 train examples. Record/approve real writer-separated Pencil data first.")
    if len({e.participant_id for e in train_examples}) < args.min_train_writers:
        raise SystemExit(
            f"Need at least {args.min_train_writers} train writers before model training; "
            f"found {len({e.participant_id for e in train_examples})}."
        )

    device = device_for_training()
    print("device:", device)
    model = PriInkOnlineTransformer().to(device)
    optimizer = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=0.02)
    scaler = None  # MPS/CPU safe path; CUDA AMP can be added only with measured benefit.
    ctc_loss = torch.nn.CTCLoss(blank=BLANK_ID, zero_infinity=True)
    loader = DataLoader(
        ExampleDataset(train_examples), batch_size=args.batch_size, shuffle=True,
        collate_fn=collate, drop_last=False,
    )
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=max(args.epochs, 1))

    best_calibration = math.inf
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    history: list[dict[str, object]] = []

    for epoch in range(1, args.epochs + 1):
        model.train()
        started = time.time()
        total_loss = total_ctc = total_count = 0.0
        seen = 0
        for batch in loader:
            points = batch["points"].to(device)
            mask = batch["padding_mask"].to(device)
            input_lengths = batch["input_lengths"].to(device)
            targets = batch["targets"].to(device)
            target_lengths = batch["target_lengths"].to(device)
            counts = batch["counts"].to(device)

            out = model(points, mask)
            # CTC expects [time,batch,class]. Padded timesteps are excluded by input_lengths.
            log_probs = F.log_softmax(out["token_logits"], dim=-1).transpose(0, 1)
            loss_ctc = ctc_loss(log_probs, targets, input_lengths, target_lengths)
            loss_count = F.cross_entropy(out["count_logits"], counts, label_smoothing=0.02)
            loss = loss_ctc + args.count_weight * loss_count

            optimizer.zero_grad(set_to_none=True)
            loss.backward()
            clip_grad_norm_(model.parameters(), 1.0)
            optimizer.step()

            n = points.size(0)
            seen += n
            total_loss += float(loss.detach().cpu()) * n
            total_ctc += float(loss_ctc.detach().cpu()) * n
            total_count += float(loss_count.detach().cpu()) * n
        scheduler.step()

        calibration = evaluate(model, calibration_examples, device, args.eval_batch_size)
        test = evaluate(model, test_examples, device, args.eval_batch_size) if args.report_test_each_epoch else None
        cal_ter = calibration["tokenErrorRate"] if calibration["tokenErrorRate"] is not None else total_loss / max(seen, 1)
        row = {
            "epoch": epoch,
            "loss": total_loss / max(seen, 1),
            "ctcLoss": total_ctc / max(seen, 1),
            "countLoss": total_count / max(seen, 1),
            "calibration": calibration,
            "test": test,
            "seconds": time.time() - started,
        }
        history.append(row)
        print(json.dumps(row, indent=2))

        if float(cal_ter) < best_calibration:
            best_calibration = float(cal_ter)
            torch.save({
                "state_dict": model.state_dict(),
                "model_config": model.config(),
                "tokens": TOKENS,
                "feature_contract": FEATURE_CONTRACT_VERSION,
                "seed": SEED,
                "epoch": epoch,
                "corpus_audit": corpus_audit,
            }, output)
            print("saved", output)

    checkpoint = torch.load(output, map_location=device, weights_only=False)
    model.load_state_dict(checkpoint["state_dict"])
    calibration = evaluate(model, calibration_examples, device, args.eval_batch_size)
    test = evaluate(model, test_examples, device, args.eval_batch_size)
    report: dict[str, object] = {
        "checkpoint": str(output),
        "featureContract": FEATURE_CONTRACT_VERSION,
        "seed": SEED,
        "corpus": corpus_audit,
        "calibration": calibration,
        "test": test,
        "history": history,
        "finalHoldout": "SEALED",
    }
    if args.unlock_final_holdout:
        report["finalHoldout"] = evaluate(model, final_examples, device, args.eval_batch_size)
        report["finalHoldoutWarning"] = "This model/run may no longer be tuned after inspecting final-holdout failures."
    report_path = output.with_suffix(".evidence.json")
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print("wrote", report_path)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--corpus", default="client/test/ink-corpus")
    parser.add_argument("--output", default="artifacts/pri-ink-online.pt")
    parser.add_argument("--epochs", type=int, default=40)
    parser.add_argument("--batch-size", type=int, default=24)
    parser.add_argument("--eval-batch-size", type=int, default=32)
    parser.add_argument("--lr", type=float, default=3e-4)
    parser.add_argument("--count-weight", type=float, default=0.20)
    parser.add_argument("--min-train-writers", type=int, default=8)
    parser.add_argument("--include-finger", action="store_true")
    parser.add_argument("--report-test-each-epoch", action="store_true",
                        help="Not recommended: repeated test inspection turns test into development evidence.")
    parser.add_argument("--unlock-final-holdout", action="store_true",
                        help="Use only once after model selection/calibration are frozen.")
    return parser.parse_args()


if __name__ == "__main__":
    train(parse_args())
