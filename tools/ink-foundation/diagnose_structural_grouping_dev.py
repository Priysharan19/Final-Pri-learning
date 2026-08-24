#!/usr/bin/env python3
"""Diagnose Pri Ink V4 grouping on the frozen same-writer development split.

This script does not train, promote, or tune on a production holdout. It reuses
one existing structural-research-dev checkpoint and asks whether the remaining
glyph-boundary errors can be repaired by calibrating one global pairwise grouping
threshold. If no threshold recovers the ground-truth partitions, the grouping
representation/decoder needs a stronger cluster objective rather than threshold
chasing.
"""
from __future__ import annotations

import argparse
from dataclasses import dataclass
from pathlib import Path

import torch
from torch.utils.data import DataLoader

from data import TOKEN_TO_ID
from dev_split import make_same_writer_dev_split
from evaluate_structural import edit_distance
from structural import PriInkStructuralV4, StructuralConfig
from structural_data import StructuralInkDataset, corpus_files, load_structural_examples
from structural_decode import decode_structural_output


DEFAULT_THRESHOLDS = tuple(round(0.25 + 0.05 * i, 2) for i in range(15))


@dataclass
class CachedSample:
    number: int
    row: object
    batch: dict
    outputs: dict


def _partition(components) -> tuple[tuple[int, ...], ...]:
    return tuple(sorted((tuple(sorted(int(i) for i in comp)) for comp in components), key=lambda x: (x[0], len(x), x)))


def _truth_partition(structure: dict) -> tuple[tuple[int, ...], ...]:
    return _partition(
        [g.get("strokes") or [] for g in (structure.get("groups") or []) if g.get("strokes")]
    )


def _pred_partition(hyp) -> tuple[tuple[int, ...], ...]:
    return _partition([g.strokes for g in hyp.glyphs])


def _symmetric_probability(group_logits: torch.Tensor, i: int, j: int) -> float:
    probs = group_logits.sigmoid()
    return 0.5 * (float(probs[i, j]) + float(probs[j, i]))


def _quantile_text(values: list[float]) -> str:
    if not values:
        return "n/a"
    t = torch.tensor(values, dtype=torch.float32)
    q = torch.quantile(t, torch.tensor([0.0, 0.1, 0.5, 0.9, 1.0]))
    return "min={:.3f} p10={:.3f} med={:.3f} p90={:.3f} max={:.3f}".format(*q.tolist())


def _balanced_pair_accuracy(pos: list[float], neg: list[float], threshold: float) -> float:
    pos_acc = sum(p >= threshold for p in pos) / max(1, len(pos))
    neg_acc = sum(p < threshold for p in neg) / max(1, len(neg))
    return 0.5 * (pos_acc + neg_acc)


def main():
    p = argparse.ArgumentParser()
    p.add_argument(
        "checkpoint",
        nargs="?",
        default="tools/ink-foundation/runs/pri-ink-structural-v4-dev.pt",
    )
    p.add_argument("--corpus", default="client/test/ink-corpus-structural")
    p.add_argument("--device", default="auto")
    p.add_argument("--relation-threshold", type=float, default=0.60)
    p.add_argument("--ambiguity-threshold", type=float, default=0.80)
    args = p.parse_args()

    checkpoint = Path(args.checkpoint)
    ckpt = torch.load(checkpoint, map_location="cpu", weights_only=False)
    if int(ckpt.get("architecture_version", 0)) != 4:
        raise SystemExit("checkpoint is not Pri Ink Structural V4")
    if ckpt.get("stage") != "structural-research-dev":
        raise SystemExit(f"expected structural-research-dev checkpoint, got {ckpt.get('stage')!r}")
    if ckpt.get("production_ready") is not False:
        raise SystemExit("development checkpoint must remain production_ready=false")
    if (ckpt.get("vocab") or []) != list(TOKEN_TO_ID.keys()):
        raise SystemExit("checkpoint vocabulary does not match runtime vocabulary")

    split_meta = ckpt.get("dev_split") or {}
    raw = load_structural_examples(corpus_files(args.corpus))
    examples, recreated = make_same_writer_dev_split(
        raw,
        seed=int(split_meta.get("seed", 20260824)),
        fraction=float(split_meta.get("fraction", 0.20)),
    )
    for key in ("writer", "trainSamples", "validationSamples"):
        if recreated.get(key) != split_meta.get(key):
            raise SystemExit(f"frozen dev split mismatch for {key}")

    validation_rows = [x for x in examples if x.split == "validation"]
    cfg = StructuralConfig(**ckpt["config"])
    dataset = StructuralInkDataset(examples, "validation", cfg)
    loader = DataLoader(dataset, batch_size=1, shuffle=False, num_workers=0)
    if len(validation_rows) != len(dataset) or not validation_rows:
        raise SystemExit("invalid frozen validation split")

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

    cached: list[CachedSample] = []
    positive_pairs: list[float] = []
    negative_pairs: list[float] = []
    sample_pair_details = []

    with torch.inference_mode():
        for number, (batch, row) in enumerate(zip(loader, validation_rows), 1):
            device_batch = {
                key: value.to(device) if torch.is_tensor(value) else value
                for key, value in batch.items()
            }
            outputs = model(
                device_batch["stroke_points"],
                device_batch["stroke_point_valid"],
                device_batch["stroke_valid"],
                device_batch["stroke_geometry"],
                device_batch["raster"],
            )
            cached.append(CachedSample(number, row, device_batch, outputs))

            truth = _truth_partition(row.structure)
            owner = {}
            for gi, component in enumerate(truth):
                for stroke in component:
                    owner[stroke] = gi
            active = sorted(owner)
            logits = outputs["group_logits"][0]
            local_pos = []
            local_neg = []
            for ai, left in enumerate(active):
                for right in active[ai + 1:]:
                    probability = _symmetric_probability(logits, left, right)
                    if owner[left] == owner[right]:
                        positive_pairs.append(probability)
                        local_pos.append((probability, left, right))
                    else:
                        negative_pairs.append(probability)
                        local_neg.append((probability, left, right))
            hardest_pos = min(local_pos, default=None)
            hardest_neg = max(local_neg, default=None)
            sample_pair_details.append((number, row.target, truth, hardest_pos, hardest_neg))

    print("\nPri Ink Structural V4 — P0001 GROUPING DIAGNOSTIC\n")
    print("same frozen writer holdout · no training · never production evidence")
    print(f"writer: {recreated['writer']} · samples: {len(cached)}")
    print(f"same-glyph pair probabilities: {_quantile_text(positive_pairs)}")
    print(f"different-glyph pair probabilities: {_quantile_text(negative_pairs)}")

    pair_best = max(
        DEFAULT_THRESHOLDS,
        key=lambda t: (_balanced_pair_accuracy(positive_pairs, negative_pairs, t), -abs(t - 0.65)),
    )
    print(
        f"best pair-balanced threshold in sweep: {pair_best:.2f} "
        f"({100*_balanced_pair_accuracy(positive_pairs, negative_pairs, pair_best):.2f}%)"
    )

    threshold_rows = []
    per_sample_partition_hits = {item.number: [] for item in cached}
    print("\nGlobal threshold sweep:")
    print("  threshold  exact_expr      CER   partition_exact  glyph_count_exact  pair_bal")

    for threshold in DEFAULT_THRESHOLDS:
        exact = char_errors = char_total = partition_exact = glyph_count_exact = 0
        for item in cached:
            hyp = decode_structural_output(
                item.outputs,
                item.batch["stroke_geometry"],
                item.batch["stroke_valid"],
                group_threshold=threshold,
                relation_threshold=args.relation_threshold,
                ambiguity_threshold=args.ambiguity_threshold,
                model=model,
            )
            target = str(item.row.target)
            exact += int(hyp.canonical == target)
            char_errors += edit_distance(hyp.canonical, target)
            char_total += max(1, len(target))
            truth = _truth_partition(item.row.structure)
            pred = _pred_partition(hyp)
            partition_ok = pred == truth
            partition_exact += int(partition_ok)
            glyph_count_exact += int(len(pred) == len(truth))
            if partition_ok:
                per_sample_partition_hits[item.number].append(threshold)

        n = len(cached)
        metrics = {
            "threshold": threshold,
            "exact": exact / n,
            "cer": char_errors / max(1, char_total),
            "partition": partition_exact / n,
            "glyph_count": glyph_count_exact / n,
            "pair_bal": _balanced_pair_accuracy(positive_pairs, negative_pairs, threshold),
        }
        threshold_rows.append(metrics)
        print(
            f"     {threshold:>4.2f}      {100*metrics['exact']:>6.2f}%  "
            f"{100*metrics['cer']:>6.2f}%       {100*metrics['partition']:>6.2f}%          "
            f"{100*metrics['glyph_count']:>6.2f}%       {100*metrics['pair_bal']:>6.2f}%"
        )

    best = max(
        threshold_rows,
        key=lambda m: (m["exact"], -m["cer"], m["partition"], m["glyph_count"], m["pair_bal"]),
    )
    print(
        "\nbest expression threshold in sweep: "
        f"{best['threshold']:.2f} · exact={100*best['exact']:.2f}% · CER={100*best['cer']:.2f}% · "
        f"partition={100*best['partition']:.2f}%"
    )

    print("\nPer-sample boundary evidence:")
    for number, target, truth, hardest_pos, hardest_neg in sample_pair_details:
        hits = per_sample_partition_hits[number]
        if hits:
            recovered = f"recoverable at {min(hits):.2f}..{max(hits):.2f}"
        else:
            recovered = "NOT recoverable by any swept global threshold"
        pos_text = "none"
        if hardest_pos is not None:
            pos_text = f"weakest same={hardest_pos[0]:.3f} pair={hardest_pos[1]}-{hardest_pos[2]}"
        neg_text = "none"
        if hardest_neg is not None:
            neg_text = f"strongest false-merge={hardest_neg[0]:.3f} pair={hardest_neg[1]}-{hardest_neg[2]}"
        print(f"  #{number} target={target!r} truth={truth} · {pos_text} · {neg_text} · {recovered}")

    unrecoverable = sum(not hits for hits in per_sample_partition_hits.values())
    print("\nInterpretation:")
    if unrecoverable:
        print(
            f"  {unrecoverable}/{len(cached)} truth partitions are not recoverable with one global threshold; "
            "the next decoder should jointly score pair evidence and group-level glyph likelihood."
        )
    elif best["threshold"] != 0.65:
        print(
            "  all truth partitions are threshold-recoverable; calibrate grouping before changing the model."
        )
    else:
        print("  grouping is already threshold-recoverable at the current operating point.")
    print("production ready: false")


if __name__ == "__main__":
    main()
