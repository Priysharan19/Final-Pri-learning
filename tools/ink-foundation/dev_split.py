"""Deterministic same-writer holdout for Pri Ink V4 development only.

This helper exists solely so a single collected writer can exercise the V4
training/evaluation pipeline. It must never be interpreted as writer-disjoint
validation or production evidence.
"""
from __future__ import annotations

from collections import Counter
from dataclasses import replace
import random


def _has_multi_stroke_group(example) -> bool:
    return any(len(g.get("strokes") or []) > 1 for g in (example.structure.get("groups") or []))


def _has_relation(example) -> bool:
    return bool(example.structure.get("relations") or [])


def _symbol_counts(example) -> Counter[str]:
    return Counter(str(g.get("symbol", "")) for g in (example.structure.get("groups") or []))


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

    # Keep at least one real training occurrence of every validation glyph when
    # the tiny one-writer corpus permits it. A one-off symbol in validation would
    # otherwise measure an impossible zero-shot class rather than same-writer
    # generalisation. This rule is DEV-ONLY; strict writer-disjoint evaluation is
    # unchanged and may of course contain difficult rare classes.
    total_symbols = Counter()
    per_example = []
    for row in train_pool:
        counts = _symbol_counts(row)
        per_example.append(counts)
        total_symbols.update(counts)

    heldout_symbols = Counter()
    chosen: list[int] = []

    def safe_to_holdout(i: int) -> bool:
        candidate = per_example[i]
        for symbol, count in candidate.items():
            if total_symbols[symbol] - heldout_symbols[symbol] - count < 1:
                return False
        return True

    def choose_first(predicate) -> int | None:
        for i in shuffled:
            if i in chosen or not predicate(train_pool[i]) or not safe_to_holdout(i):
                continue
            return i
        return None

    def add(i: int | None):
        if i is None or i in chosen or len(chosen) >= n_val:
            return
        chosen.append(i)
        heldout_symbols.update(per_example[i])

    add(choose_first(_has_multi_stroke_group))
    add(choose_first(_has_relation))

    for i in shuffled:
        if len(chosen) >= n_val:
            break
        if i not in chosen and safe_to_holdout(i):
            add(i)

    # Extremely small/pathological corpora may not have enough coverage-safe
    # rows. Fill deterministically rather than silently changing holdout size,
    # and record any unsupported validation symbols in the metadata.
    if len(chosen) < n_val:
        for i in shuffled:
            if len(chosen) >= n_val:
                break
            if i not in chosen:
                add(i)

    val_indices = set(chosen)
    out = [
        replace(x, split="validation" if i in val_indices else "train")
        for i, x in enumerate(train_pool)
    ]

    train_symbol_counts = Counter()
    validation_symbol_counts = Counter()
    for row in out:
        if row.split == "train":
            train_symbol_counts.update(_symbol_counts(row))
        else:
            validation_symbol_counts.update(_symbol_counts(row))
    unsupported = sorted(
        symbol for symbol in validation_symbol_counts if train_symbol_counts[symbol] < 1
    )

    meta = {
        "protocol": "same-writer-dev-holdout",
        "seed": seed,
        "fraction": fraction,
        "writer": writers[0],
        "trainSamples": sum(x.split == "train" for x in out),
        "validationSamples": sum(x.split == "validation" for x in out),
        "coverageAware": True,
        "validationSymbols": sorted(validation_symbol_counts),
        "unsupportedValidationSymbols": unsupported,
        "writerDisjoint": False,
        "productionEvidence": False,
    }
    return out, meta
