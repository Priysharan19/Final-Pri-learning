#!/usr/bin/env python3
"""Deterministic contracts for pooled glyph relations in Pri Ink V4."""
from __future__ import annotations

import sys

import torch

sys.path.insert(0, "tools/ink-foundation")

from structural import RELATION_TO_ID, RELATIONS
from structural_decode import GlyphHypothesis, MathNode, StructuralHypothesis
from structural_group_relations import (
    GroupRelationHead,
    GroupRelationBatch,
    apply_group_relation_head,
    balanced_group_relation_loss,
    component_union_geometry,
    group_relation_metrics,
    group_relation_targets,
)


class StubRelationHead:
    def __call__(self, structural_strokes, stroke_geometry, components):
        g = len(components)
        logits = structural_strokes.new_full((g, g, len(RELATIONS)), -6.0)
        logits[..., RELATION_TO_ID["NONE"]] = 4.0
        if g >= 2:
            logits[0, 1, RELATION_TO_ID["NONE"]] = -4.0
            logits[0, 1, RELATION_TO_ID["SUPERSCRIPT"]] = 7.0
        return logits


def test_relation_targets_lift_true_noncontiguous_groups():
    relation = torch.full((4, 4), -100, dtype=torch.long)
    relation[0, 1] = RELATION_TO_ID["SUPERSCRIPT"]
    relation[1, 0] = RELATION_TO_ID["NONE"]
    components = [(0, 2), (1,)]
    lifted = group_relation_targets(relation, components)
    assert int(lifted[0, 1]) == RELATION_TO_ID["SUPERSCRIPT"]
    assert int(lifted[1, 0]) == RELATION_TO_ID["NONE"]
    assert int(lifted[0, 0]) == -100


def test_union_geometry_uses_all_member_strokes():
    geometry = torch.tensor([
        [-0.40, 0.00, 0.20, 0.10, 0, 0, 0, 0.00],
        [ 0.40, 0.00, 0.20, 0.10, 0, 0, 0, 0.10],
        [ 0.00, 0.20, 0.10, 0.10, 0, 0, 0, 0.20],
    ], dtype=torch.float32)
    pooled = component_union_geometry(geometry, [(0, 1), (2,)])
    assert pooled.shape == (2, 8)
    assert float(pooled[0, 2]) > 0.95, pooled[0]
    assert abs(float(pooled[0, 0])) < 1e-5


def test_group_relation_head_is_trainable():
    torch.manual_seed(11)
    head = GroupRelationHead(16)
    structural = torch.randn(4, 16)
    geometry = torch.randn(4, 8).abs()
    geometry[:, :2] = torch.randn(4, 2)
    logits = head(structural, geometry, [(0, 2), (1,), (3,)])
    assert logits.shape == (3, 3, len(RELATIONS))
    target = torch.tensor([
        RELATION_TO_ID["RIGHT"],
        RELATION_TO_ID["SUPERSCRIPT"],
        RELATION_TO_ID["NONE"],
        RELATION_TO_ID["RIGHT"],
    ])
    selected = torch.stack([logits[0, 1], logits[0, 2], logits[1, 0], logits[1, 2]])
    batch = GroupRelationBatch(selected, target, 4, 3, 1)
    loss = balanced_group_relation_loss(batch)
    loss.backward()
    assert torch.isfinite(loss)
    assert any(p.grad is not None and torch.isfinite(p.grad).all() for p in head.parameters())


def test_decomposed_loss_pushes_positive_away_from_none():
    none = RELATION_TO_ID["NONE"]
    superscript = RELATION_TO_ID["SUPERSCRIPT"]
    logits = torch.full((2, len(RELATIONS)), -2.0, requires_grad=True)
    with torch.no_grad():
        logits[0, none] = 3.0
        logits[0, superscript] = 0.0
        logits[1, none] = 3.0
    targets = torch.tensor([superscript, none])
    batch = GroupRelationBatch(logits, targets, 2, 1, 1)
    loss = balanced_group_relation_loss(batch)
    loss.backward()
    assert float(logits.grad[0, superscript]) < 0.0, logits.grad[0]
    assert float(logits.grad[0, none]) > 0.0, logits.grad[0]
    metrics = group_relation_metrics(logits.detach(), targets)
    assert metrics["positiveTypeAccuracy"] == 1.0
    assert metrics["positiveAccuracy"] == 0.0
    assert metrics["existencePositiveRecall"] == 0.0


def test_pooled_relation_override_repairs_multistroke_superscript():
    glyphs = [
        GlyphHypothesis(0, (0, 2), "x", 0.95, 0.0, 0.0, 0.5, 0.5),
        GlyphHypothesis(1, (1,), "2", 0.96, 0.5, -0.3, 0.2, 0.2),
    ]
    hyp = StructuralHypothesis(
        glyphs=glyphs,
        relations=[],
        ast=MathNode("sequence", children=(MathNode("symbol", value="x"), MathNode("symbol", value="2"))),
        canonical="x2",
        confidence=0.90,
        symbol_confidence=0.95,
        grouping_confidence=0.93,
        relation_confidence=0.90,
        ambiguous=False,
        warnings=[],
    )
    outputs = {"stroke_embeddings": torch.zeros(1, 3, 8)}
    geometry = torch.tensor([[[
        0.0, 0.0, 0.2, 0.2, 0, 0, 0, 0.0
    ], [
        0.5, -0.3, 0.1, 0.1, 0, 0, 0, 0.1
    ], [
        0.1, 0.1, 0.2, 0.2, 0, 0, 0, 0.2
    ]]], dtype=torch.float32)
    apply_group_relation_head(
        hyp,
        outputs,
        geometry,
        StubRelationHead(),
        relation_threshold=0.60,
        ambiguity_threshold=0.80,
    )
    assert hyp.canonical == "x^(2)", hyp.canonical
    assert len(hyp.relations) == 1
    assert hyp.relations[0].kind == "SUPERSCRIPT"
    assert getattr(hyp, "relation_decoder") == "pooled-group-relations-v2"


def main():
    test_relation_targets_lift_true_noncontiguous_groups()
    test_union_geometry_uses_all_member_strokes()
    test_group_relation_head_is_trainable()
    test_decomposed_loss_pushes_positive_away_from_none()
    test_pooled_relation_override_repairs_multistroke_superscript()
    print("Pri Ink V4 pooled group relations: 5/5 deterministic contracts PASS")


if __name__ == "__main__":
    main()
