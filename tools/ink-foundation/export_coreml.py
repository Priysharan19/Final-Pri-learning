#!/usr/bin/env python3
"""Export a Pri Ink Foundation checkpoint to Core ML.

Development export is allowed for any compatible checkpoint, but it is marked
`pri.productionReady=false`. A release export requires the locked final-holdout
report produced by evaluate_release.py for the exact checkpoint and the report
must pass the production handwriting standard.
"""
from __future__ import annotations

import argparse
import hashlib
import json
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


def main():
    p = argparse.ArgumentParser()
    p.add_argument("checkpoint")
    p.add_argument("--out", default="ios/PriLearning.swiftpm/Resources/Models/PriInkFoundation.mlpackage")
    p.add_argument("--release-report", default=None,
                   help="locked final-holdout report for this exact checkpoint")
    args = p.parse_args()

    try:
        import coremltools as ct
    except ImportError as exc:
        raise SystemExit("Install coremltools on macOS: pip install coremltools") from exc

    checkpoint = Path(args.checkpoint)
    ckpt = torch.load(checkpoint, map_location="cpu", weights_only=False)
    production_ready, report = validate_release_report(checkpoint, ckpt, args.release_report)

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

    out = Path(args.out); out.parent.mkdir(parents=True, exist_ok=True)
    mlmodel.save(str(out))
    print(f"wrote {out}")
    if production_ready:
        print("PRODUCTION READY — exact checkpoint matched a passing locked final-holdout report.")
    else:
        print("DEVELOPMENT MODEL ONLY — release builds refuse this asset until final-holdout release evidence passes.")


if __name__ == "__main__":
    main()
