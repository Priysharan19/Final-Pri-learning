#!/usr/bin/env python3
"""Export a trained Pri Ink Foundation checkpoint to an on-device Core ML model.

The network emits logits for a caller-provided decoder prefix. Swift owns the
beam/greedy loop, which keeps decoding policy outside the weights and allows
question grammar/personalisation to evolve without retraining the base model.
"""
from __future__ import annotations

import argparse
from pathlib import Path

import torch
from torch import nn

from model import ModelConfig, PriInkFoundation


class ExportWrapper(nn.Module):
    def __init__(self, model: PriInkFoundation):
        super().__init__()
        self.model = model

    def forward(self, points, point_valid_f32, raster, decoder_ids_i32):
        valid = point_valid_f32 > 0.5
        ids = decoder_ids_i32.to(torch.long)
        logits, _ = self.model(points, valid, raster, ids)
        return logits


def main():
    p = argparse.ArgumentParser()
    p.add_argument("checkpoint")
    p.add_argument("--out", default="ios/PriLearning.swiftpm/Resources/PriInkFoundation.mlpackage")
    args = p.parse_args()

    try:
        import coremltools as ct
    except ImportError as exc:
        raise SystemExit("Install coremltools on macOS: pip install coremltools") from exc

    ckpt = torch.load(args.checkpoint, map_location="cpu", weights_only=False)
    cfg = ModelConfig(**ckpt["config"])
    writers = ckpt.get("writers") or []
    model = PriInkFoundation(
        vocab_size=len(ckpt["vocab"]), pad_id=int(ckpt["pad_id"]),
        config=cfg, writer_classes=len(writers),
    )
    model.load_state_dict(ckpt["model"])
    model.eval()
    wrapper = ExportWrapper(model).eval()

    # Fixed maxima make memory use predictable on iPad. The actual validity mask
    # tells the network which point slots contain ink. Decoder slots are padded.
    points = torch.zeros(1, cfg.max_points, cfg.feature_dim, dtype=torch.float32)
    valid = torch.zeros(1, cfg.max_points, dtype=torch.float32)
    raster = torch.zeros(1, 1, cfg.raster_height, cfg.raster_width, dtype=torch.float32)
    ids = torch.zeros(1, cfg.max_tokens, dtype=torch.int32)

    traced = torch.jit.trace(wrapper, (points, valid, raster, ids), strict=False)
    mlmodel = ct.convert(
        traced,
        convert_to="mlprogram",
        minimum_deployment_target=ct.target.iOS17,
        inputs=[
            ct.TensorType(name="points", shape=points.shape, dtype=float),
            ct.TensorType(name="point_valid", shape=valid.shape, dtype=float),
            ct.TensorType(name="raster", shape=raster.shape, dtype=float),
            ct.TensorType(name="decoder_ids", shape=ids.shape, dtype=int),
        ],
        outputs=[ct.TensorType(name="logits")],
        compute_precision=ct.precision.FLOAT16,
    )

    # Metadata lets the native runtime reject a model/tokenizer mismatch instead
    # of silently decoding ids under the wrong vocabulary.
    mlmodel.author = "Pri Learning"
    mlmodel.short_description = "Pri Learning multimodal Apple Pencil maths recogniser"
    mlmodel.version = "1"
    mlmodel.user_defined_metadata["pri.model"] = "ink-foundation-v1"
    mlmodel.user_defined_metadata["pri.vocab"] = "|".join(ckpt["vocab"])
    mlmodel.user_defined_metadata["pri.pad"] = str(ckpt["pad_id"])
    mlmodel.user_defined_metadata["pri.bos"] = str(ckpt["bos_id"])
    mlmodel.user_defined_metadata["pri.eos"] = str(ckpt["eos_id"])
    mlmodel.user_defined_metadata["pri.maxPoints"] = str(cfg.max_points)
    mlmodel.user_defined_metadata["pri.maxTokens"] = str(cfg.max_tokens)

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    mlmodel.save(str(out))
    print(f"wrote {out}")


if __name__ == "__main__":
    main()
