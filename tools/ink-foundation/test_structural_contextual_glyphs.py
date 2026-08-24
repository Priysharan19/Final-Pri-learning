#!/usr/bin/env python3
"""Deterministic contracts for Pri Ink V4 contextual group-symbol fusion."""
from __future__ import annotations
import sys
import torch
sys.path.insert(0,"tools/ink-foundation")
from structural_contextual_glyphs import ContextualGlyphSymbolHead, ContextualGlyphBatch, contextual_glyph_loss, group_symbol_targets


def test_feature_mode_is_a_true_visual_context_ablation():
    torch.manual_seed(5); head=ContextualGlyphSymbolHead(8,12).eval()
    local=torch.randn(3,8); structural=torch.randn(3,8); geometry=torch.rand(3,8); comps=[(0,1),(2,)]
    local_a=head(local,structural,geometry,comps,feature_mode="local-control")
    local_b=head(local,structural+7.0,geometry,comps,feature_mode="local-control")
    context_a=head(local,structural,geometry,comps,feature_mode="local-plus-visual")
    context_b=head(local,structural+7.0,geometry,comps,feature_mode="local-plus-visual")
    assert torch.allclose(local_a,local_b)
    assert not torch.allclose(context_a,context_b)


def test_group_symbol_targets_require_consistent_complete_glyphs():
    symbols=torch.tensor([4,7,4])
    targets,sizes=group_symbol_targets(symbols,[(0,2),(1,)])
    assert targets.tolist()==[4,7] and sizes.tolist()==[2,1]
    try: group_symbol_targets(symbols,[(0,1)])
    except ValueError as exc: assert "inconsistent" in str(exc)
    else: raise AssertionError("accepted mixed-symbol component")


def test_margin_loss_pushes_true_token_above_best_wrong():
    logits=torch.zeros(2,6,requires_grad=True); targets=torch.tensor([2,4]); sizes=torch.tensor([1,2])
    with torch.no_grad(): logits[0,1]=2.0; logits[0,2]=0.0; logits[1,3]=2.0; logits[1,4]=0.0
    batch=ContextualGlyphBatch(logits,targets,sizes);loss=contextual_glyph_loss(batch);loss.backward()
    assert float(logits.grad[0,2])<0 and float(logits.grad[0,1])>0
    assert float(logits.grad[1,4])<0 and float(logits.grad[1,3])>0


def test_head_supports_noncontiguous_multistroke_group():
    torch.manual_seed(9);head=ContextualGlyphSymbolHead(8,10).eval();local=torch.randn(3,8);structural=torch.randn(3,8);geometry=torch.rand(3,8)
    logits=head(local,structural,geometry,[(0,2),(1,)],feature_mode="local-plus-visual")
    assert logits.shape==(2,10) and torch.isfinite(logits).all()


def main():
    test_feature_mode_is_a_true_visual_context_ablation();test_group_symbol_targets_require_consistent_complete_glyphs();test_margin_loss_pushes_true_token_above_best_wrong();test_head_supports_noncontiguous_multistroke_group()
    print("Pri Ink V4 contextual glyph fusion: 4/4 deterministic contracts PASS")
if __name__=="__main__":main()
