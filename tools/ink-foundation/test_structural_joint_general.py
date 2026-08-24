#!/usr/bin/env python3
"""Deterministic contracts for Pri Ink V4 exact general joint grouping."""
from __future__ import annotations

import math
import sys

import torch
import torch.nn.functional as F

sys.path.insert(0, "tools/ink-foundation")

from data import ID_TO_TOKEN, SPECIAL, TOKEN_TO_ID
from structural import RELATION_TO_ID
from structural_joint_decode import decode_structural_output_joint
from structural_joint_general import (
    decode_structural_output_joint_auto,
    decode_structural_output_joint_general,
    joint_partition_general,
)


class StubGlyphModel:
    def __init__(self, component_tokens: dict[tuple[int, ...], tuple[str, float]]):
        self.component_tokens = component_tokens

    def classify_glyph_components(self, glyph_strokes, components):
        vocab = len(TOKEN_TO_ID)
        rows = []
        for component in components:
            key = tuple(int(i) for i in component)
            token, strength = self.component_tokens.get(key, ("x", 0.0))
            logits = torch.zeros(vocab, dtype=glyph_strokes.dtype, device=glyph_strokes.device)
            if strength > 0:
                logits.fill_(-strength)
                logits[TOKEN_TO_ID[token]] = strength
            rows.append(logits)
        return torch.stack(rows) if rows else glyph_strokes.new_zeros((0, vocab))


def relation_logits(strokes: int):
    rows = torch.full((1, strokes, strokes, len(RELATION_TO_ID)), -8.0)
    rows[..., RELATION_TO_ID["NONE"]] = 8.0
    return rows


def geometry(strokes: int):
    rows = torch.zeros(1, strokes, 8)
    for i in range(strokes):
        rows[0, i, 0] = -0.35 + i * 0.28
        rows[0, i, 2] = 0.18
        rows[0, i, 3] = 0.10
        rows[0, i, 7] = i / max(1, strokes - 1)
    return rows


def outputs_for(group_logits: torch.Tensor):
    strokes = group_logits.shape[0]
    vocab = len(TOKEN_TO_ID)
    return {
        "symbol_logits": torch.zeros(1, strokes, vocab),
        "group_logits": group_logits.unsqueeze(0),
        "relation_logits": relation_logits(strokes),
        "glyph_stroke_embeddings": torch.zeros(1, strokes, 8),
    }


def test_non_contiguous_glyph_is_recoverable():
    # Delayed second mark: stroke 0 and stroke 2 are one '=' glyph, while stroke
    # 1 belongs to the neighbouring '3'. No contiguous partition can represent
    # the truth, so this directly tests the new search class rather than tuning.
    strokes = 3
    logits = torch.full((strokes, strokes), -6.0)
    p_same = 0.90
    same_logit = math.log(p_same / (1.0 - p_same))
    logits[0, 2] = logits[2, 0] = same_logit
    model = StubGlyphModel({(0, 2): ("=", 8.0), (1,): ("3", 8.0)})
    out = outputs_for(logits)
    out["relation_logits"][0, 0, 1, :] = -8.0
    out["relation_logits"][0, 0, 1, RELATION_TO_ID["RIGHT"]] = 8.0
    valid = torch.ones(1, strokes, dtype=torch.bool)

    contiguous = decode_structural_output_joint(
        out, geometry(strokes), valid, model=model,
        max_group_size=3, ambiguity_threshold=0.0,
    )
    assert [g.strokes for g in contiguous.glyphs] != [(0, 2), (1,)], contiguous.glyphs

    general = decode_structural_output_joint_general(
        out, geometry(strokes), valid, model=model,
        max_group_size=3, general_max_strokes=6, ambiguity_threshold=0.0,
    )
    assert [g.strokes for g in general.glyphs] == [(0, 2), (1,)], general.glyphs
    assert [g.symbol for g in general.glyphs] == ["=", "3"], general.glyphs
    assert general.canonical == "=3", general.canonical
    assert general.partition_margin > 0
    assert general.decoder == "joint-general-v1"


def _set_partitions(items: tuple[int, ...], max_group_size: int):
    if not items:
        yield ()
        return
    first, rest = items[0], items[1:]
    # Choose every possible group containing the smallest remaining item. This
    # canonical anchor rule emits every set partition exactly once.
    for extra_count in range(0, min(max_group_size - 1, len(rest)) + 1):
        for extras in __import__("itertools").combinations(rest, extra_count):
            component = (first,) + tuple(extras)
            chosen = set(component)
            remaining = tuple(i for i in items if i not in chosen)
            for suffix in _set_partitions(remaining, max_group_size):
                yield (component,) + suffix


def _best_real_logp(logits: torch.Tensor) -> float:
    probs = F.softmax(logits, dim=-1)
    for idx in probs.argsort(descending=True).tolist():
        if ID_TO_TOKEN[int(idx)] not in SPECIAL:
            return math.log(max(1e-8, float(probs[idx])))
    return math.log(1e-8)


def _brute_score(partition, logits, embeddings, model, temperature, symbol_weight):
    probability = torch.sigmoid(logits / temperature)
    probability = 0.5 * (probability + probability.T)
    owner = {stroke: gi for gi, component in enumerate(partition) for stroke in component}
    active = tuple(sorted(owner))
    pair_total = 0.0
    pair_count = 0
    for ai, left in enumerate(active):
        for right in active[ai + 1:]:
            p = min(1.0 - 1e-8, max(1e-8, float(probability[left, right])))
            pair_total += math.log(p if owner[left] == owner[right] else 1.0 - p)
            pair_count += 1
    component_logits = model.classify_glyph_components(embeddings, list(partition))
    symbol_sum = sum(_best_real_logp(row) for row in component_logits)
    return pair_total / max(1, pair_count) + symbol_weight * symbol_sum / len(partition)


def test_general_dp_matches_exhaustive_set_partition_optimum():
    torch.manual_seed(41)
    strokes = 5
    logits = torch.randn(strokes, strokes) * 0.7
    logits.fill_diagonal_(-30.0)
    embeddings = torch.zeros(strokes, 8)
    valid = torch.ones(strokes, dtype=torch.bool)
    model = StubGlyphModel({
        (0, 3): ("=", 3.5),
        (1,): ("x", 2.0),
        (2, 4): ("+", 2.8),
        (0, 1): ("7", 1.2),
    })
    temperature = 1.35
    symbol_weight = 0.85
    best, runner, _ = joint_partition_general(
        logits, embeddings, valid, model,
        max_group_size=3, general_max_strokes=8,
        grouping_temperature=temperature, symbol_weight=symbol_weight,
    )
    exhaustive = sorted(
        (
            (_brute_score(partition, logits, embeddings, model, temperature, symbol_weight), partition)
            for partition in _set_partitions(tuple(range(strokes)), 3)
        ),
        key=lambda row: row[0],
        reverse=True,
    )
    assert best.components == exhaustive[0][1], (best, exhaustive[:3])
    assert abs(best.score - exhaustive[0][0]) < 1e-6, (best.score, exhaustive[0][0])
    assert runner is not None
    assert runner.components == exhaustive[1][1], (runner, exhaustive[:3])
    assert abs(runner.score - exhaustive[1][0]) < 1e-6


def test_bound_is_explicit_and_auto_falls_back():
    strokes = 4
    logits = torch.full((strokes, strokes), -4.0)
    model = StubGlyphModel({(0,): ("1", 4.0), (1,): ("2", 4.0), (2,): ("3", 4.0), (3,): ("4", 4.0)})
    out = outputs_for(logits)
    valid = torch.ones(1, strokes, dtype=torch.bool)
    try:
        decode_structural_output_joint_general(
            out, geometry(strokes), valid, model=model,
            general_max_strokes=3, ambiguity_threshold=0.0,
        )
    except ValueError as exc:
        assert "bounded to 3 active strokes" in str(exc)
    else:
        raise AssertionError("general decoder silently exceeded exact-search bound")

    auto = decode_structural_output_joint_auto(
        out, geometry(strokes), valid, model=model,
        general_max_strokes=3, ambiguity_threshold=0.0,
    )
    assert auto.decoder == "joint-auto-v1:contiguous", auto.decoder


def main():
    test_non_contiguous_glyph_is_recoverable()
    test_general_dp_matches_exhaustive_set_partition_optimum()
    test_bound_is_explicit_and_auto_falls_back()
    print("Pri Ink V4 general joint partition decoder: 3/3 deterministic contracts PASS")


if __name__ == "__main__":
    main()
