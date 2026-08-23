#!/usr/bin/env python3
"""Deterministic contracts for Pri Ink V4 component-validity rejection."""
from __future__ import annotations

import math
import sys

import torch

sys.path.insert(0, "tools/ink-foundation")

from data import ID_TO_TOKEN, SPECIAL, TOKEN_TO_ID
from structural_component_validity import (
    ComponentValidityHead,
    ValidityAugmentedGlyphModel,
    inject_invalid_probability_mass,
    mine_invalid_components,
)
from structural_joint_decode import joint_partition


class StubGlyphModel:
    def __init__(self, tokens):
        self.tokens = tokens

    def classify_glyph_components(self, glyph_strokes, components):
        rows = []
        for component in components:
            key = tuple(int(i) for i in component)
            token, strength = self.tokens.get(key, ("x", 0.5))
            logits = glyph_strokes.new_full((len(TOKEN_TO_ID),), -strength)
            logits[TOKEN_TO_ID[token]] = strength
            rows.append(logits)
        return torch.stack(rows) if rows else glyph_strokes.new_zeros((0, len(TOKEN_TO_ID)))


class MapValidityScorer:
    def __init__(self, probabilities):
        self.probabilities = probabilities

    def __call__(self, glyph_strokes, structural_strokes, stroke_valid, components):
        rows = []
        for component in components:
            p = self.probabilities.get(tuple(int(i) for i in component), 0.95)
            p = min(1 - 1e-6, max(1e-6, p))
            rows.append(math.log(p / (1 - p)))
        return glyph_strokes.new_tensor(rows)


def _best_real(logits):
    probs = logits.softmax(-1)
    for idx in probs.argsort(descending=True).tolist():
        token = ID_TO_TOKEN[int(idx)]
        if token not in SPECIAL:
            return token, float(probs[idx])
    raise AssertionError("no real symbol")


def test_invalid_mass_preserves_symbol_identity_but_reduces_confidence():
    logits = torch.full((1, len(TOKEN_TO_ID)), -4.0)
    logits[0, TOKEN_TO_ID["="]] = 5.0
    before_token, before_conf = _best_real(logits[0])
    calibrated = inject_invalid_probability_mass(
        logits, torch.tensor([-3.0]), weight=1.0
    )
    after_token, after_conf = _best_real(calibrated[0])
    assert before_token == after_token == "="
    assert after_conf < before_conf * 0.10, (before_conf, after_conf)
    assert calibrated.softmax(-1)[0, TOKEN_TO_ID["<unk>"]] > 0.90


def test_hard_negative_mining_targets_splits_and_false_merges():
    # True glyphs are a two-stroke '=' and a one-stroke '3'.
    truth = [(0, 1), (2,)]
    logits = torch.full((3, 3), -4.0)
    logits[0, 1] = logits[1, 0] = 4.0
    logits[0, 2] = logits[2, 0] = 1.2
    logits[1, 2] = logits[2, 1] = 0.7
    negatives = mine_invalid_components(
        truth, logits, max_group_size=3, max_negatives=16
    )
    assert (0, 1) not in negatives and (2,) not in negatives
    assert (0,) in negatives and (1,) in negatives, negatives
    assert (0, 1, 2) in negatives, negatives
    assert (0, 2) in negatives or (1, 2) in negatives, negatives


def test_contextual_head_is_trainable_and_finite():
    torch.manual_seed(7)
    d = 16
    head = ComponentValidityHead(d)
    glyph = torch.randn(4, d, requires_grad=False)
    structural = torch.randn(4, d, requires_grad=False)
    valid = torch.ones(4, dtype=torch.bool)
    logits = head(glyph, structural, valid, [(0,), (1, 3), (0, 2, 3)])
    assert logits.shape == (3,)
    assert torch.isfinite(logits).all()
    loss = logits.square().mean()
    loss.backward()
    assert any(p.grad is not None and torch.isfinite(p.grad).all() for p in head.parameters())


def test_validity_rejection_repairs_false_merge_without_changing_base_model():
    # Pair evidence prefers merging strokes 0 and 1. The closed-set glyph head is
    # also confident that the malformed merge is '='. A contextual validity head
    # rejects only that candidate, so exact joint search chooses two glyphs.
    p_same = 0.60
    pair_logit = math.log(p_same / (1 - p_same))
    groups = torch.tensor([[[-30.0, pair_logit], [pair_logit, -30.0]]])[0]
    glyph = torch.zeros(2, 8)
    structural = torch.zeros(2, 8)
    valid = torch.ones(2, dtype=torch.bool)
    base = StubGlyphModel({
        (0, 1): ("=", 5.0),
        (0,): ("1", 5.0),
        (1,): ("-", 5.0),
    })

    baseline, _, _ = joint_partition(
        groups, glyph, valid, base,
        max_group_size=2, grouping_temperature=1.0, symbol_weight=1.0,
    )
    assert baseline.components == ((0, 1),), baseline

    augmented = ValidityAugmentedGlyphModel(
        base,
        MapValidityScorer({(0, 1): 0.03, (0,): 0.98, (1,): 0.98}),
        structural,
        valid,
        validity_weight=1.0,
    )
    repaired, _, _ = joint_partition(
        groups, glyph, valid, augmented,
        max_group_size=2, grouping_temperature=1.0, symbol_weight=1.0,
    )
    assert repaired.components == ((0,), (1,)), repaired


def main():
    test_invalid_mass_preserves_symbol_identity_but_reduces_confidence()
    test_hard_negative_mining_targets_splits_and_false_merges()
    test_contextual_head_is_trainable_and_finite()
    test_validity_rejection_repairs_false_merge_without_changing_base_model()
    print("Pri Ink V4 component validity: 4/4 deterministic contracts PASS")


if __name__ == "__main__":
    main()
