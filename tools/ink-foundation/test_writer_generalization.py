#!/usr/bin/env python3
"""Fast CPU checks for Pri Ink V4 writer-generalization machinery."""
from __future__ import annotations

import math

import torch

from data import PAD_ID, VOCAB
from model import ModelConfig
from model_v4 import PriInkFoundationV4, gradient_reverse
from style_augmentation import augmented_strokes


def fixture_strokes():
    return [
        {"points": [
            {"x": 10.0, "y": 30.0, "t": 0.00, "p": 0.4, "w": 2.5},
            {"x": 20.0, "y": 15.0, "t": 0.04, "p": 0.5, "w": 2.8},
            {"x": 30.0, "y": 30.0, "t": 0.08, "p": 0.6, "w": 3.0},
        ]},
        {"points": [
            {"x": 36.0, "y": 18.0, "t": 0.10, "p": 0.5, "w": 2.7},
            {"x": 48.0, "y": 18.0, "t": 0.14, "p": 0.5, "w": 2.7},
        ]},
    ]


def test_augmentation():
    original = fixture_strokes()
    a = augmented_strokes(original, 12345)
    b = augmented_strokes(original, 12345)
    c = augmented_strokes(original, 54321)
    assert a == b, "same seed must produce identical writer transform"
    assert a != c, "different seeds should explore different handwriting styles"
    assert len(a) == len(original), "augmentation must never reorder/drop whole strokes"
    assert [len(s["points"]) for s in a] == [3, 2], "tiny fixture endpoints must survive"
    assert original[0]["points"][0]["x"] == 10.0, "augmentation must not mutate source corpus"
    for stroke in a:
        for point in stroke["points"]:
            assert math.isfinite(float(point["x"])) and math.isfinite(float(point["y"]))
            assert float(point.get("w", 1.0)) > 0


def test_gradient_reversal():
    x = torch.tensor([1.0, -2.0], requires_grad=True)
    gradient_reverse(x, 0.35).sum().backward()
    expected = torch.full_like(x, -0.35)
    assert torch.allclose(x.grad, expected), f"gradient reversal wrong: {x.grad}"


def test_model_shapes():
    cfg = ModelConfig(
        d_model=32, nhead=4, stroke_layers=1, decoder_layers=1, ff_dim=64,
        max_points=16, max_tokens=8, raster_height=32, raster_width=64,
        style_dim=16, architecture_version=4,
    )
    model = PriInkFoundationV4(
        len(VOCAB), PAD_ID, cfg, writer_classes=3, style_dropout=0.0
    )
    model.train()
    points = torch.randn(2, cfg.max_points, cfg.feature_dim)
    valid = torch.zeros(2, cfg.max_points, dtype=torch.bool)
    valid[:, :10] = True
    raster = torch.rand(2, 1, cfg.raster_height, cfg.raster_width)
    outputs = model.forward_with_aux(points, valid, raster, adversary_strength=0.5)
    logits, style_writer, content_writer, ctc, style, content = outputs
    assert logits.shape == (2, cfg.max_tokens, len(VOCAB))
    assert style_writer.shape == (2, 3)
    assert content_writer.shape == (2, 3)
    assert ctc.shape == (2, cfg.max_points, len(VOCAB))
    assert style.shape == content.shape == (2, cfg.d_model)

    model.eval()
    with torch.no_grad():
        inference, _ = model(points, valid, raster)
    assert inference.shape == logits.shape


def main():
    test_augmentation()
    test_gradient_reversal()
    test_model_shapes()
    print("PASS: Pri Ink V4 writer-generalization checks")


if __name__ == "__main__":
    main()
