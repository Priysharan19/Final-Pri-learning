#!/usr/bin/env python3
"""Deterministic regression contract for the V4 joint partition decoder."""
from __future__ import annotations

import math
import sys

import torch
import torch.nn.functional as F

sys.path.insert(0, "tools/ink-foundation")

from data import ID_TO_TOKEN, SPECIAL, TOKEN_TO_ID
from structural import RELATION_TO_ID
from structural_decode import decode_structural_output
from structural_joint_decode import decode_structural_output_joint, joint_partition


class StubGlyphModel:
    """Deterministic group classifier keyed by component membership."""

    def __init__(self, component_tokens: dict[tuple[int, ...], tuple[str, float]]):
        self.component_tokens = component_tokens

    def classify_glyph_components(self, glyph_strokes, components):
        rows = []
        vocab = len(TOKEN_TO_ID)
        for component in components:
            key = tuple(int(i) for i in component)
            logits = torch.zeros(vocab, dtype=glyph_strokes.dtype, device=glyph_strokes.device)
            token, strength = self.component_tokens.get(key, ("x", 0.0))
            if strength > 0:
                logits.fill_(-strength)
                logits[TOKEN_TO_ID[token]] = strength
            rows.append(logits)
        return torch.stack(rows) if rows else glyph_strokes.new_zeros((0, vocab))


def make_relation_logits(strokes: int):
    r = len(RELATION_TO_ID)
    relations = torch.full((1, strokes, strokes, r), -8.0)
    relations[..., RELATION_TO_ID["NONE"]] = 8.0
    return relations


def make_geometry(strokes: int):
    geometry = torch.zeros(1, strokes, 8)
    for i in range(strokes):
        geometry[0, i, 0] = -0.3 + i * 0.25
        geometry[0, i, 2] = 0.18
        geometry[0, i, 3] = 0.10
        geometry[0, i, 7] = i / max(1, strokes - 1)
    return geometry


def test_symbol_evidence_repairs_pair_boundary():
    # Two physical strokes form '='. Pairwise evidence alone is deliberately
    # below the legacy 0.65 merge threshold, while the true group classifier is
    # decisive for the two-stroke component. This is the failure mode that
    # motivated the joint decoder.
    strokes = 3
    vocab = len(TOKEN_TO_ID)
    symbols = torch.zeros(1, strokes, vocab)
    groups = torch.full((1, strokes, strokes), -8.0)
    p_same = 0.55
    weak_same_logit = math.log(p_same / (1.0 - p_same))
    groups[0, 0, 1] = groups[0, 1, 0] = weak_same_logit
    relations = make_relation_logits(strokes)
    relations[0, 0, 2, :] = -8.0
    relations[0, 0, 2, RELATION_TO_ID["RIGHT"]] = 8.0
    embeddings = torch.zeros(1, strokes, 8)
    outputs = {
        "symbol_logits": symbols,
        "group_logits": groups,
        "relation_logits": relations,
        "glyph_stroke_embeddings": embeddings,
    }
    geometry = make_geometry(strokes)
    valid = torch.ones(1, strokes, dtype=torch.bool)
    model = StubGlyphModel({
        (0, 1): ("=", 8.0),
        (2,): ("3", 8.0),
    })

    legacy = decode_structural_output(
        outputs, geometry, valid, group_threshold=0.65,
        relation_threshold=0.60, ambiguity_threshold=0.50, model=model,
    )
    assert len(legacy.glyphs) == 3, legacy.glyphs

    joint = decode_structural_output_joint(
        outputs, geometry, valid, model=model,
        max_group_size=3, grouping_temperature=1.0, symbol_weight=1.0,
        relation_threshold=0.60, ambiguity_threshold=0.50,
    )
    assert [g.strokes for g in joint.glyphs] == [(0, 1), (2,)], joint.glyphs
    assert [g.symbol for g in joint.glyphs] == ["=", "3"], joint.glyphs
    assert joint.canonical == "=3", joint.canonical
    assert joint.partition_margin > 0, joint.partition_margin
    assert joint.decoder == "joint-contiguous-v1"

    bounded = decode_structural_output_joint(
        outputs, geometry, valid, model=model,
        max_group_size=1, ambiguity_threshold=0.0,
    )
    assert len(bounded.glyphs) == 3, bounded.glyphs


def _segmentations(active, max_size):
    out = []
    def rec(start, parts):
        if start == len(active):
            out.append(tuple(parts))
            return
        for size in range(1, min(max_size, len(active) - start) + 1):
            parts.append(tuple(active[start:start + size]))
            rec(start + size, parts)
            parts.pop()
    rec(0, [])
    return out


def _best_real_logp(logits):
    probs = F.softmax(logits, dim=-1)
    for idx in probs.argsort(descending=True).tolist():
        if ID_TO_TOKEN[int(idx)] not in SPECIAL:
            return math.log(max(1e-8, float(probs[idx])))
    return math.log(1e-8)


def _brute_score(partition, logits, embeddings, model, temperature, symbol_weight):
    prob = torch.sigmoid(logits / temperature)
    prob = 0.5 * (prob + prob.T)
    owner = {stroke: gi for gi, comp in enumerate(partition) for stroke in comp}
    active = tuple(sorted(owner))
    pair_sum = 0.0
    pair_count = 0
    for ai, left in enumerate(active):
        for right in active[ai + 1:]:
            p = min(1 - 1e-8, max(1e-8, float(prob[left, right])))
            pair_sum += math.log(p if owner[left] == owner[right] else 1.0 - p)
            pair_count += 1
    component_logits = model.classify_glyph_components(embeddings, list(partition))
    symbol_sum = sum(_best_real_logp(row) for row in component_logits)
    return pair_sum / max(1, pair_count) + symbol_weight * symbol_sum / len(partition)


def test_dynamic_programming_matches_exhaustive_global_optimum():
    # The production-size search is dynamic programming, not an approximation.
    # Verify it against exhaustive enumeration on a tractable deterministic case.
    torch.manual_seed(17)
    strokes = 5
    logits = torch.randn(strokes, strokes) * 0.8
    logits.fill_diagonal_(-30.0)
    embeddings = torch.zeros(strokes, 8)
    valid = torch.ones(strokes, dtype=torch.bool)
    model = StubGlyphModel({
        (0, 1): ("=", 3.0),
        (2,): ("x", 2.0),
        (3, 4): ("+", 2.5),
        (0,): ("-", 1.0),
        (1,): ("-", 1.0),
        (3,): ("1", 0.8),
        (4,): ("1", 0.8),
    })
    temperature = 1.7
    symbol_weight = 0.9
    best, runner, _ = joint_partition(
        logits, embeddings, valid, model,
        max_group_size=3, grouping_temperature=temperature, symbol_weight=symbol_weight,
    )
    exhaustive = sorted(
        (
            (_brute_score(p, logits, embeddings, model, temperature, symbol_weight), p)
            for p in _segmentations(tuple(range(strokes)), 3)
        ),
        key=lambda row: row[0],
        reverse=True,
    )
    assert best.components == exhaustive[0][1], (best, exhaustive[:3])
    assert abs(best.score - exhaustive[0][0]) < 1e-6, (best.score, exhaustive[0][0])
    assert runner is not None
    assert runner.components == exhaustive[1][1], (runner, exhaustive[:3])


def test_margin_abstention_is_explicit_not_hidden():
    strokes = 2
    vocab = len(TOKEN_TO_ID)
    outputs = {
        "symbol_logits": torch.zeros(1, strokes, vocab),
        "group_logits": torch.zeros(1, strokes, strokes),
        "relation_logits": make_relation_logits(strokes),
        "glyph_stroke_embeddings": torch.zeros(1, strokes, 8),
    }
    model = StubGlyphModel({})
    hyp = decode_structural_output_joint(
        outputs, make_geometry(strokes), torch.ones(1, strokes, dtype=torch.bool),
        model=model, max_group_size=2, ambiguity_threshold=0.0,
        partition_margin_threshold=0.50,
    )
    assert hyp.ambiguous
    assert any("joint partition margin" in warning for warning in hyp.warnings), hyp.warnings


def main():
    test_symbol_evidence_repairs_pair_boundary()
    test_dynamic_programming_matches_exhaustive_global_optimum()
    test_margin_abstention_is_explicit_not_hidden()
    print("Pri Ink V4 joint partition decoder: 3/3 deterministic contracts PASS")


if __name__ == "__main__":
    main()
