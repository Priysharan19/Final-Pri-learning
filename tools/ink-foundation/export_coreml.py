#!/usr/bin/env python3
"""Export a Pri Ink Foundation V3 checkpoint to Core ML.

Development export is allowed for any compatible checkpoint, but it is marked
`pri.productionReady=false`. A release export requires the locked final-holdout
report produced by evaluate_release.py for the exact checkpoint and the report
must pass the production handwriting standard.

The normal PyTorch Transformer modules are ideal for training, but their
MultiheadAttention implementation traces through version-dependent helper code
that Core ML does not need and can fail to lower reliably. Export therefore
reconstructs the exact EVAL computation with explicit linear -> matmul ->
softmax -> matmul attention. Checkpoint weights are copied without retraining,
and the explicit graph is numerically compared with the training model before
conversion.
"""
from __future__ import annotations

import argparse
import copy
import hashlib
import json
import math
import sys
from pathlib import Path

import torch
import torch.nn.functional as F
from torch import nn

from model import ModelConfig, PriInkFoundation


def _frozen_parameter(t: torch.Tensor) -> nn.Parameter:
    return nn.Parameter(t.detach().clone(), requires_grad=False)


class ExplicitAttention(nn.Module):
    """Core ML-friendly equivalent of eval-mode nn.MultiheadAttention."""

    def __init__(self, source: nn.MultiheadAttention, q_len: int, kv_len: int):
        super().__init__()
        if not getattr(source, "_qkv_same_embed_dim", True):
            raise ValueError("Pri Ink export expects same-dimension Q/K/V attention")
        if source.in_proj_weight is None:
            raise ValueError("Pri Ink export requires packed Q/K/V projection weights")
        if source.bias_k is not None or source.bias_v is not None or source.add_zero_attn:
            raise ValueError("unsupported attention option in Pri Ink export graph")

        self.embed_dim = int(source.embed_dim)
        self.num_heads = int(source.num_heads)
        if self.embed_dim % self.num_heads:
            raise ValueError("attention embed_dim must be divisible by num_heads")
        self.head_dim = self.embed_dim // self.num_heads
        self.q_len = int(q_len)
        self.kv_len = int(kv_len)
        self.scale = 1.0 / math.sqrt(self.head_dim)

        qw, kw, vw = source.in_proj_weight.detach().chunk(3, dim=0)
        self.q_weight = _frozen_parameter(qw)
        self.k_weight = _frozen_parameter(kw)
        self.v_weight = _frozen_parameter(vw)
        if source.in_proj_bias is not None:
            qb, kb, vb = source.in_proj_bias.detach().chunk(3, dim=0)
            self.q_bias = _frozen_parameter(qb)
            self.k_bias = _frozen_parameter(kb)
            self.v_bias = _frozen_parameter(vb)
        else:
            self.register_parameter("q_bias", None)
            self.register_parameter("k_bias", None)
            self.register_parameter("v_bias", None)
        self.out_weight = _frozen_parameter(source.out_proj.weight)
        self.out_bias = (
            _frozen_parameter(source.out_proj.bias)
            if source.out_proj.bias is not None else None
        )

    def forward(self, query, key, value, key_valid_f32=None):
        q = F.linear(query, self.q_weight, self.q_bias)
        k = F.linear(key, self.k_weight, self.k_bias)
        v = F.linear(value, self.v_weight, self.v_bias)

        q = q.reshape(1, self.q_len, self.num_heads, self.head_dim).transpose(1, 2)
        k = k.reshape(1, self.kv_len, self.num_heads, self.head_dim).transpose(1, 2)
        v = v.reshape(1, self.kv_len, self.num_heads, self.head_dim).transpose(1, 2)

        scores = torch.matmul(q, k.transpose(-2, -1)) * self.scale
        if key_valid_f32 is not None:
            penalty = (1.0 - key_valid_f32).unsqueeze(1).unsqueeze(1) * -10000.0
            scores = scores + penalty
        probs = torch.softmax(scores, dim=-1)
        attended = torch.matmul(probs, v)
        attended = attended.transpose(1, 2).reshape(1, self.q_len, self.embed_dim)
        return F.linear(attended, self.out_weight, self.out_bias)


class ExplicitEncoderLayer(nn.Module):
    def __init__(self, source: nn.TransformerEncoderLayer, seq_len: int):
        super().__init__()
        if not source.norm_first:
            raise ValueError("Pri Ink export currently expects norm_first encoder layers")
        self.attn = ExplicitAttention(source.self_attn, seq_len, seq_len)
        self.norm1 = copy.deepcopy(source.norm1)
        self.norm2 = copy.deepcopy(source.norm2)
        self.linear1 = copy.deepcopy(source.linear1)
        self.linear2 = copy.deepcopy(source.linear2)

    def forward(self, x, valid_f32):
        n = self.norm1(x)
        x = x + self.attn(n, n, n, valid_f32)
        n = self.norm2(x)
        x = x + self.linear2(F.gelu(self.linear1(n)))
        return x


class ExplicitDecoderLayer(nn.Module):
    def __init__(self, source: nn.TransformerDecoderLayer, q_len: int, memory_len: int):
        super().__init__()
        if not source.norm_first:
            raise ValueError("Pri Ink export currently expects norm_first decoder layers")
        self.self_attn = ExplicitAttention(source.self_attn, q_len, q_len)
        self.cross_attn = ExplicitAttention(source.multihead_attn, q_len, memory_len)
        self.norm1 = copy.deepcopy(source.norm1)
        self.norm2 = copy.deepcopy(source.norm2)
        self.norm3 = copy.deepcopy(source.norm3)
        self.linear1 = copy.deepcopy(source.linear1)
        self.linear2 = copy.deepcopy(source.linear2)

    def forward(self, x, memory, memory_valid_f32):
        n = self.norm1(x)
        x = x + self.self_attn(n, n, n, None)
        n = self.norm2(x)
        x = x + self.cross_attn(n, memory, memory, memory_valid_f32)
        n = self.norm3(x)
        x = x + self.linear2(F.gelu(self.linear1(n)))
        return x


class CoreMLFriendlyFoundation(nn.Module):
    """Numerically equivalent fixed-shape inference graph for batch-1 iPad use."""

    def __init__(self, source: PriInkFoundation):
        super().__init__()
        cfg = source.config
        self.max_points = int(cfg.max_points)
        self.max_tokens = int(cfg.max_tokens)

        self.point_proj = copy.deepcopy(source.point_proj)
        self.point_pos_weight = _frozen_parameter(source.point_pos.weight)
        self.stroke_modality = _frozen_parameter(source.stroke_modality)
        self.raster_modality = _frozen_parameter(source.raster_modality)
        self.raster_encoder = copy.deepcopy(source.raster_encoder)
        self.style_encoder = copy.deepcopy(source.style_encoder)
        self.fusion_norm = copy.deepcopy(source.fusion_norm)

        with torch.no_grad():
            probe = torch.zeros(1, 1, cfg.raster_height, cfg.raster_width)
            visual_tokens = int(self.raster_encoder(probe).shape[1])
        self.visual_tokens = visual_tokens
        self.memory_tokens = self.max_points + visual_tokens
        self.register_buffer("visual_valid", torch.ones(1, visual_tokens), persistent=False)

        self.encoder_layers = nn.ModuleList([
            ExplicitEncoderLayer(layer, self.max_points)
            for layer in source.stroke_encoder.layers
        ])
        self.encoder_norm = copy.deepcopy(source.stroke_encoder.norm)

        self.output_query_weight = _frozen_parameter(source.output_queries.weight)
        self.output_pos_weight = _frozen_parameter(source.output_pos.weight)
        self.decoder_layers = nn.ModuleList([
            ExplicitDecoderLayer(layer, self.max_tokens, self.memory_tokens)
            for layer in source.decoder.layers
        ])
        self.decoder_norm = copy.deepcopy(source.decoder.norm)
        self.output = copy.deepcopy(source.output)

    def forward(self, points, point_valid_f32, raster):
        valid = (point_valid_f32 > 0.5).to(points.dtype)

        stroke = self.point_proj(points)
        stroke = stroke + self.point_pos_weight.unsqueeze(0) + self.stroke_modality
        for layer in self.encoder_layers:
            stroke = layer(stroke, valid)
        if self.encoder_norm is not None:
            stroke = self.encoder_norm(stroke)

        # Must mirror model.py exactly: style is cross-modal and is computed from
        # unconditioned stroke + 2-D visual tokens, then fed back to both paths.
        visual_base = self.raster_encoder(raster) + self.raster_modality
        weights = valid.unsqueeze(-1)
        pooled_stroke = (stroke * weights).sum(dim=1) / weights.sum(dim=1).clamp_min(1.0)
        pooled_visual = visual_base.mean(dim=1)
        style = self.style_encoder(torch.cat((pooled_stroke, pooled_visual), dim=-1))

        stroke = stroke + style.unsqueeze(1)
        visual = visual_base + style.unsqueeze(1)
        memory = self.fusion_norm(torch.cat((stroke, visual), dim=1))
        memory_valid = torch.cat((valid, self.visual_valid.to(valid.dtype)), dim=1)

        q = (self.output_query_weight + self.output_pos_weight).unsqueeze(0)
        for layer in self.decoder_layers:
            q = layer(q, memory, memory_valid)
        if self.decoder_norm is not None:
            q = self.decoder_norm(q)
        return self.output(q)


class NativeWrapper(nn.Module):
    def __init__(self, model: PriInkFoundation):
        super().__init__()
        self.model = model

    def forward(self, points, point_valid_f32, raster):
        logits, _ = self.model(points, point_valid_f32 > 0.5, raster)
        return logits


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def validate_release_report(checkpoint: Path, ckpt: dict, report_path: str | None) -> tuple[bool, dict | None]:
    if not report_path:
        return False, None
    report = json.loads(Path(report_path).read_text(encoding="utf-8"))
    if report.get("format") != "pri-ink-release-eval" or int(report.get("version", 0)) < 2:
        raise SystemExit("--release-report is not a current Pri Ink release evaluation report")
    if ckpt.get("stage") != "finetune":
        raise SystemExit("production export requires a real-writer fine-tuned checkpoint")
    if report.get("split") != "final-holdout":
        raise SystemExit("production export requires the locked final-holdout report")
    actual = sha256(checkpoint)
    if report.get("checkpointSha256") != actual:
        raise SystemExit("release report checkpoint SHA-256 does not match the checkpoint being exported")
    if report.get("checkpointStage") != "finetune":
        raise SystemExit("release report was not produced from a fine-tuned checkpoint")
    if report.get("passesReleaseTargets") is not True:
        raise SystemExit("release report does not pass Pri's production handwriting gates")
    metrics = report.get("metrics") or {}
    required = [
        "samples", "writers", "min_samples_per_writer", "exact", "cer",
        "worst_writer_exact", "critical_structure_exact", "safe_precision",
        "safe_coverage", "safe_threshold"
    ]
    if any(k not in metrics for k in required):
        raise SystemExit("release report is missing required production reliability metrics")
    return True, report


def make_trace_fixture(cfg: ModelConfig):
    points = torch.zeros(1, cfg.max_points, cfg.feature_dim, dtype=torch.float32)
    valid = torch.zeros(1, cfg.max_points, dtype=torch.float32)
    raster = torch.zeros(1, 1, cfg.raster_height, cfg.raster_width, dtype=torch.float32)

    n = min(32, cfg.max_points)
    valid[0, :n] = 1.0
    points[0, :n, 0] = torch.linspace(-0.45, 0.45, n)
    points[0, :n, 1] = 0.08 * torch.sin(torch.linspace(0, 3.14159, n))
    points[0, 1:n, 2] = points[0, 1:n, 0] - points[0, :n-1, 0]
    points[0, 1:n, 3] = points[0, 1:n, 1] - points[0, :n-1, 1]
    if cfg.feature_dim > 12:
        points[0, 0, 11] = 1.0
        points[0, n-1, 12] = 1.0
    if cfg.feature_dim > 9:
        points[0, :n, 9] = 1.0
    if cfg.feature_dim > 10:
        points[0, :n, 10] = 0.75

    y = cfg.raster_height // 2
    x1 = cfg.raster_width // 4
    x2 = 3 * cfg.raster_width // 4
    raster[0, 0, y-1:y+2, x1:x2] = 1.0
    return points, valid, raster


def main():
    p = argparse.ArgumentParser()
    p.add_argument("checkpoint")
    p.add_argument("--out", default="ios/PriLearning.swiftpm/Resources/Models/PriInkFoundation.mlpackage")
    p.add_argument("--release-report", default=None,
                   help="locked final-holdout report for this exact checkpoint")
    args = p.parse_args()

    if sys.version_info >= (3, 14):
        raise SystemExit(
            "Core ML export requires the dedicated supported export environment (Python 3.12). "
            "Run: npm run ink:bootstrap:export"
        )

    try:
        import coremltools as ct
    except ImportError as exc:
        raise SystemExit("Install coremltools in a supported macOS Python environment") from exc

    checkpoint = Path(args.checkpoint)
    if not checkpoint.exists():
        raise SystemExit(f"checkpoint not found: {checkpoint}")
    ckpt = torch.load(checkpoint, map_location="cpu", weights_only=False)
    production_ready, report = validate_release_report(checkpoint, ckpt, args.release_report)

    cfg = ModelConfig(**ckpt["config"])
    train_writers = ckpt.get("train_writers") or []
    native = PriInkFoundation(
        vocab_size=len(ckpt["vocab"]), pad_id=int(ckpt["pad_id"]),
        config=cfg, writer_classes=len(train_writers),
    )
    native.load_state_dict(ckpt["model"])
    native.eval()

    wrapper = CoreMLFriendlyFoundation(native).eval()
    native_wrapper = NativeWrapper(native).eval()
    points, valid, raster = make_trace_fixture(cfg)

    with torch.inference_mode():
        reference = native_wrapper(points, valid, raster)
        export_out = wrapper(points, valid, raster)
        if not bool(torch.isfinite(reference).all()) or not bool(torch.isfinite(export_out).all()):
            raise SystemExit("non-finite logits on export fixture; refusing Core ML conversion")
        max_abs = float((reference - export_out).abs().max())
        mean_abs = float((reference - export_out).abs().mean())
        print(f"explicit-attention parity: max_abs={max_abs:.7g} mean_abs={mean_abs:.7g}")
        if max_abs > 2e-4:
            raise SystemExit(
                f"explicit export graph differs from training model (max_abs={max_abs:.6g}); refusing export"
            )
        traced = torch.jit.trace(
            wrapper, (points, valid, raster), strict=True, check_trace=True
        )
        traced_out = traced(points, valid, raster)
        trace_abs = float((export_out - traced_out).abs().max())
        print(f"TorchScript parity: max_abs={trace_abs:.7g}")
        if not bool(torch.isfinite(traced_out).all()) or trace_abs > 2e-4:
            raise SystemExit("TorchScript graph failed numerical parity; refusing Core ML conversion")

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
    mlmodel.short_description = "Pri Learning V3 multimodal Apple Pencil maths recogniser"
    mlmodel.version = "3"
    meta = mlmodel.user_defined_metadata
    meta["pri.model"] = "ink-foundation-v3"
    meta["pri.architectureVersion"] = str(cfg.architecture_version)
    meta["pri.decoder"] = "parallel-output-queries+2d-visual+cross-modal-style"
    meta["pri.vocab"] = "|".join(ckpt["vocab"])
    meta["pri.pad"] = str(ckpt["pad_id"])
    meta["pri.bos"] = str(ckpt["bos_id"])
    meta["pri.eos"] = str(ckpt["eos_id"])
    meta["pri.maxPoints"] = str(cfg.max_points)
    meta["pri.maxTokens"] = str(cfg.max_tokens)
    meta["pri.featureDim"] = str(cfg.feature_dim)
    meta["pri.rasterHeight"] = str(cfg.raster_height)
    meta["pri.rasterWidth"] = str(cfg.raster_width)
    meta["pri.checkpointSha256"] = sha256(checkpoint)
    meta["pri.trainingStage"] = str(ckpt.get("stage") or "unknown")
    meta["pri.productionReady"] = "true" if production_ready else "false"

    if production_ready and report:
        metrics = report["metrics"]
        meta["pri.releaseSplit"] = str(report["split"])
        meta["pri.releaseSamples"] = str(metrics["samples"])
        meta["pri.releaseExact"] = str(metrics["exact"])
        meta["pri.releaseCER"] = str(metrics["cer"])
        meta["pri.releaseWorstWriter"] = str(metrics["worst_writer_exact"])
        meta["pri.releaseCriticalStructure"] = str(metrics["critical_structure_exact"])
        meta["pri.releaseSafePrecision"] = str(metrics["safe_precision"])
        meta["pri.releaseSafeCoverage"] = str(metrics["safe_coverage"])
        meta["pri.releaseSafeThreshold"] = str(metrics["safe_threshold"])
        meta["pri.releaseWriters"] = str(metrics["writers"])

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    mlmodel.save(str(out))
    print(f"wrote {out}")
    if production_ready:
        print("PRODUCTION READY — exact checkpoint matched a passing locked final-holdout report.")
    else:
        print("DEVELOPMENT MODEL ONLY — release builds refuse this asset until final-holdout release evidence passes.")


if __name__ == "__main__":
    main()
