"""Deterministic same-writer holdout for Pri Ink V4 development only.

This helper exists solely so a single collected writer can exercise the V4
training/evaluation pipeline. It must never be interpreted as writer-disjoint
validation or production evidence.
"""
from __future__ import annotations

from dataclasses import replace
import random


def _has_multi_stroke_group(example) -> bool:
    return any(len(g.get("strokes") or []) > 1 for g in (example.structure.get("groups") or []))


def _has_relation(example) -> bool:
    return bool(example.structure.get("relations") or [])


def make_same_writer_dev_split(examples, seed: int = 20260824, fraction: float = 0.20):
    if not 0.05 <= fraction <= 0.50:
        raise ValueError("dev holdout fraction must be between 0.05 and 0.50")

    train_pool = [x for x in examples if x.split == "train"]
    other = [x for x in examples if x.split != "train"]
    if other:
        raise ValueError(
            "same-writer dev holdout expects a train-only corpus; explicit validation/test "
            "splits already exist and should use the strict V4 trainer"
        )
    if len(train_pool) < 10:
        raise ValueError(
            f"same-writer dev holdout requires at least 10 annotated train samples; found {len(train_pool)}"
        )

    writers = sorted({x.writer for x in train_pool})
    if len(writers) != 1:
        raise ValueError(
            f"same-writer dev holdout is only for exactly one writer; found writers={writers}"
        )

    n = len(train_pool)
    n_val = min(max(5, int(round(n * fraction))), n - 5)
    rng = random.Random(seed)
    shuffled = list(range(n))
    rng.shuffle(shuffled)

    # Make the diagnostic holdout non-trivial when the corpus supports it.
    chosen: list[int] = []
    multi = next((i for i in shuffled if _has_multi_stroke_group(train_pool[i])), None)
    if multi is not None:
        chosen.append(multi)
    rel = next((i for i in shuffled if i not in chosen and _has_relation(train_pool[i])), None)
    if rel is not None and len(chosen) < n_val:
        chosen.append(rel)
    for i in shuffled:
        if len(chosen) >= n_val:
            break
        if i not in chosen:
            chosen.append(i)

    val_indices = set(chosen)
    out = [
        replace(x, split="validation" if i in val_indices else "train")
        for i, x in enumerate(train_pool)
    ]
    meta = {
        "protocol": "same-writer-dev-holdout",
        "seed": seed,
        "fraction": fraction,
        "writer": writers[0],
        "trainSamples": sum(x.split == "train" for x in out),
        "validationSamples": sum(x.split == "validation" for x in out),
        "writerDisjoint": False,
        "productionEvidence": False,
    }
    return out, meta
