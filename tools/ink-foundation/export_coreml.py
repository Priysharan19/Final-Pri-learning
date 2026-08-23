#!/usr/bin/env python3
"""Export a trained Pri Ink Foundation checkpoint to Core ML.

One invocation returns logits for every output slot. No hosted service and no
per-token neural loop are required at runtime.
"""
from __future__ import annotations

import argparse
from pathlib import Path

import torch
from torch import nn

from model import ModelConfig, PriInkFoundation


class ExportWrapper(nn.Module):
    def __init__(self, model: PriInkFoundation):
        super().__init__(); self.model = model

    def forward(self, points, point_valid_f32, raster):
        logits, _ = self.model(points, point_valid_f32 > 0.5, raster)
        return logits


def main():
    p = argparse.ArgumentParser()
    p.add_argument("checkpoint")
    p.add_argument("--out", default="ios/PriLearning.swiftpm/Resources/Models/PriInkFoundation.mlpackage")
    args = p.parse_args()

    try:
        import coremltools as ct
    except ImportError as exc:
        raise SystemExit("Install coremltools on macOS: pip install coremltools") from exc

    ckpt = torch.load(args.checkpoint, map_location="cpu", weights_only=False)
    cfg = ModelConfig(**ckpt["config"])
    train_writers = ckpt.get("train_writers") or []
    model = PriInkFoundation(
        vocab_size=len(ckpt["vocab"]), pad_id=int(ckpt["pad_id"]),
        config=cfg, writer_classes=len(train_writers),
    )
    model.load_state_dict(ckpt["model"]); model.eval()
    wrapper = ExportWrapper(model).eval()

    points = torch.zeros(1, cfg.max_points, cfg.feature_dim, dtype=torch.float32)
    valid = torch.zeros(1, cfg.max_points, dtype=torch.float32)
    raster = torch.zeros(1, 1, cfg.raster_height, cfg.raster_width, dtype=torch.float32)
    traced = torch.jit.trace(wrapper, (points, valid, raster), strict=False)

    mlmodel = ct.convert(
        traced,
        convert_to="mlprogram",
        minimum_deployment_target=ct.target.iOS16,
        inputs=[
            ct.TensorType(name="points", shape=points.shape, dtype=float),
            ct.TensorType(name="point_valid", shape=valid.shape, dtype=float),
            ct.TensorType(name="raster", shape=raster.shape, dtype=float),
        ],
        outputs=[ct.TensorType(name="logits")],
        compute_precision=ct.precision.FLOAT16,
    )
    mlmodel.author = "Pri Learning"
    mlmodel.short_description = "Pri Learning multimodal Apple Pencil maths recogniser"
    mlmodel.version = "2"
    meta = mlmodel.user_defined_metadata
    meta["pri.model"] = "ink-foundation-v2"
    meta["pri.decoder"] = "parallel-output-queries"
    meta["pri.vocab"] = "|".join(ckpt["vocab"])
    meta["pri.pad"] = str(ckpt["pad_id"])
    meta["pri.bos"] = str(ckpt["bos_id"])
    meta["pri.eos"] = str(ckpt["eos_id"])
    meta["pri.maxPoints"] = str(cfg.max_points)
    meta["pri.maxTokens"] = str(cfg.max_tokens)
    meta["pri.featureDim"] = str(cfg.feature_dim)
    meta["pri.rasterHeight"] = str(cfg.raster_height)
    meta["pri.rasterWidth"] = str(cfg.raster_width)

    out = Path(args.out); out.parent.mkdir(parents=True, exist_ok=True)
    mlmodel.save(str(out))
    print(f"wrote {out}")


if __name__ == "__main__":
    main()
