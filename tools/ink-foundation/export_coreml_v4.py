#!/usr/bin/env python3
"""Export Pri Ink Foundation V4 to Core ML with dual evidence gates.

Development export is always allowed for a compatible V4 checkpoint and is
marked `pri.productionReady=false`. A production export requires BOTH:

1. the existing locked final-holdout release report for the exact checkpoint;
2. a passing V17 unseen-writer generalisation report from the real writer-
   disjoint test split for that same exact checkpoint, including the embedded
   corpus-readiness gates.

The V4 inference graph intentionally matches V3 at the module interface: the
writer-adversarial/content heads are training-only. We therefore reuse the
numerically checked explicit-attention Core ML graph from export_coreml.py.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import torch

from export_coreml import (
    CoreMLFriendlyFoundation,
    NativeWrapper,
    make_trace_fixture,
    sha256,
    validate_release_report,
)
from model import ModelConfig
from model_v4 import PriInkFoundationV4


GENERALISATION_MINIMUMS = {
    "writers": 20,
    "samples": 1000,
    "baseExact": 0.98,
    "perturbedExact": 0.97,
    "robustExact": 0.95,
    "worstWriterBaseExact": 0.90,
    "worstWriterRobustExact": 0.90,
    "criticalRobustExact": 0.98,
}
GENERALISATION_MAXIMUMS = {"predictionFlipRate": 0.02}
REQUIRED_DATA_GATES = {
    "trainWriterTarget",
    "evaluationWriterMinimum",
    "evaluationSampleMinimum",
    "minimumSamplesPerTrainWriter",
    "trainTokenWriterCoverage",
    "testTokenWriterCoverage",
    "testTokenOccurrenceCoverage",
    "noUnknownTargetTokens",
    "noDuplicateSessionIds",
}


def validate_generalisation_report(
    checkpoint: Path, report_path: str | None
) -> tuple[bool, dict | None]:
    if not report_path:
        return False, None
    report = json.loads(Path(report_path).read_text(encoding="utf-8"))
    if report.get("format") != "pri-ink-writer-generalization":
        raise SystemExit(
            "--generalization-report is not a Pri Ink writer-generalisation report"
        )
    if int(report.get("version", 0)) < 2:
        raise SystemExit("production V4 export requires a V17 generalisation report (v2+)")
    if report.get("split") != "test":
        raise SystemExit(
            "production V4 export requires writer-generalisation evidence from the real test split"
        )
    if report.get("checkpointSha256") != sha256(checkpoint):
        raise SystemExit(
            "writer-generalisation report SHA-256 does not match the checkpoint being exported"
        )
    if report.get("passesMetricTargets") is not True:
        raise SystemExit("writer-generalisation report does not pass V17 metric targets")
    if report.get("passesDataReadiness") is not True:
        raise SystemExit("writer-generalisation report does not pass V17 corpus-readiness gates")
    if report.get("passesTargets") is not True:
        raise SystemExit("writer-generalisation report does not pass the complete V17 target set")

    evidence = report.get("dataReadiness") or {}
    if int(evidence.get("auditVersion") or 0) < 2:
        raise SystemExit("writer-generalisation report lacks the V17 corpus audit schema")
    policy = evidence.get("policy") or {}
    if policy.get("evaluationSplit") != "test":
        raise SystemExit("V17 corpus readiness must be measured on the test split")
    if policy.get("finalHoldoutCountsTowardReadiness") is not False:
        raise SystemExit("final-holdout cannot count toward V17 corpus readiness")
    if policy.get("finalHoldoutContentInspectedByAudit") is not False:
        raise SystemExit("routine V17 corpus readiness must not inspect final-holdout contents")
    gates = evidence.get("gates") or {}
    if set(gates) != REQUIRED_DATA_GATES or not all(gates.values()):
        raise SystemExit("writer-generalisation report has incomplete/failing V17 data gates")
    if evidence.get("passesDataReadiness") is not True:
        raise SystemExit("embedded V17 corpus evidence is not production-ready")

    metrics = report.get("metrics") or {}
    for key, threshold in GENERALISATION_MINIMUMS.items():
        value = metrics.get(key)
        if value is None or float(value) < threshold:
            raise SystemExit(
                f"writer-generalisation report fails required {key}>={threshold}: {value!r}"
            )
    for key, threshold in GENERALISATION_MAXIMUMS.items():
        value = metrics.get(key)
        if value is None or float(value) > threshold:
            raise SystemExit(
                f"writer-generalisation report fails required {key}<={threshold}: {value!r}"
            )
    if int(metrics.get("criticalSamples") or 0) < 1:
        raise SystemExit("writer-generalisation report contains no critical-structure samples")
    return True, report


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("checkpoint")
    parser.add_argument(
        "--out",
        default="ios/PriLearning.swiftpm/Resources/Models/PriInkFoundation.mlpackage",
    )
    parser.add_argument(
        "--release-report",
        default=None,
        help="locked final-holdout release report for this exact checkpoint",
    )
    parser.add_argument(
        "--generalization-report",
        default=None,
        help="passing writer-disjoint V17 test report for this exact checkpoint",
    )
    args = parser.parse_args()

    if sys.version_info >= (3, 14):
        raise SystemExit(
            "Core ML export requires the dedicated supported export environment (Python 3.12)."
        )

    try:
        import coremltools as ct
    except ImportError as exc:
        raise SystemExit(
            "Install coremltools in a supported macOS Python environment"
        ) from exc

    checkpoint = Path(args.checkpoint)
    if not checkpoint.exists():
        raise SystemExit(f"checkpoint not found: {checkpoint}")
    ckpt = torch.load(checkpoint, map_location="cpu", weights_only=False)
    if int(ckpt.get("architecture_version") or 0) != 4:
        raise SystemExit("export_coreml_v4.py requires an architecture_version=4 checkpoint")

    release_ready, release_report = validate_release_report(
        checkpoint, ckpt, args.release_report
    )
    generalisation_ready, generalisation_report = validate_generalisation_report(
        checkpoint, args.generalization_report
    )
    if release_ready != generalisation_ready:
        raise SystemExit(
            "V4 production export requires --release-report and --generalization-report together; "
            "omit both for a development-only export"
        )
    production_ready = release_ready and generalisation_ready

    cfg = ModelConfig(**ckpt["config"])
    train_writers = ckpt.get("train_writers") or []
    native = PriInkFoundationV4(
        vocab_size=len(ckpt["vocab"]),
        pad_id=int(ckpt["pad_id"]),
        config=cfg,
        writer_classes=len(train_writers),
        style_dropout=float(ckpt.get("style_dropout", 0.20)),
    )
    native.load_state_dict(ckpt["model"])
    native.eval()

    wrapper = CoreMLFriendlyFoundation(native).eval()
    native_wrapper = NativeWrapper(native).eval()
    points, valid, raster = make_trace_fixture(cfg)

    with torch.inference_mode():
        reference = native_wrapper(points, valid, raster)
        export_out = wrapper(points, valid, raster)
        if not bool(torch.isfinite(reference).all()) or not bool(
            torch.isfinite(export_out).all()
        ):
            raise SystemExit("non-finite logits on export fixture; refusing Core ML conversion")
        max_abs = float((reference - export_out).abs().max())
        mean_abs = float((reference - export_out).abs().mean())
        print(
            f"V4 explicit-attention parity: max_abs={max_abs:.7g} mean_abs={mean_abs:.7g}"
        )
        if max_abs > 2e-4:
            raise SystemExit(
                f"V4 export graph differs from training model (max_abs={max_abs:.6g}); refusing export"
            )
        traced = torch.jit.trace(
            wrapper, (points, valid, raster), strict=True, check_trace=True
        )
        traced_out = traced(points, valid, raster)
        trace_abs = float((export_out - traced_out).abs().max())
        print(f"V4 TorchScript parity: max_abs={trace_abs:.7g}")
        if not bool(torch.isfinite(traced_out).all()) or trace_abs > 2e-4:
            raise SystemExit("V4 TorchScript graph failed numerical parity; refusing Core ML conversion")

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
    mlmodel.short_description = (
        "Pri Learning V4 writer-generalising multimodal Apple Pencil maths recogniser"
    )
    mlmodel.version = "4"
    meta = mlmodel.user_defined_metadata
    meta["pri.model"] = "ink-foundation-v4"
    meta["pri.architectureVersion"] = "4"
    meta["pri.releaseLane"] = "V17"
    meta["pri.decoder"] = (
        "parallel-output-queries+2d-visual+cross-modal-style+writer-invariant-content"
    )
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
    meta["pri.writerGeneralizationRequired"] = "true"
    meta["pri.corpusReadinessRequired"] = "true"

    if production_ready and release_report and generalisation_report:
        release_metrics = release_report["metrics"]
        generalisation_metrics = generalisation_report["metrics"]
        meta["pri.releaseSplit"] = str(release_report["split"])
        meta["pri.releaseSamples"] = str(release_metrics["samples"])
        meta["pri.releaseExact"] = str(release_metrics["exact"])
        meta["pri.releaseCER"] = str(release_metrics["cer"])
        meta["pri.releaseWorstWriter"] = str(release_metrics["worst_writer_exact"])
        meta["pri.releaseCriticalStructure"] = str(
            release_metrics["critical_structure_exact"]
        )
        meta["pri.releaseSafePrecision"] = str(release_metrics["safe_precision"])
        meta["pri.releaseSafeCoverage"] = str(release_metrics["safe_coverage"])
        meta["pri.releaseSafeThreshold"] = str(release_metrics["safe_threshold"])
        meta["pri.releaseWriters"] = str(release_metrics["writers"])
        meta["pri.generalizationSplit"] = str(generalisation_report["split"])
        meta["pri.generalizationWriters"] = str(generalisation_metrics["writers"])
        meta["pri.generalizationSamples"] = str(generalisation_metrics["samples"])
        meta["pri.generalizationRobustExact"] = str(
            generalisation_metrics["robustExact"]
        )
        meta["pri.generalizationWorstWriterRobustExact"] = str(
            generalisation_metrics["worstWriterRobustExact"]
        )
        meta["pri.generalizationFlipRate"] = str(
            generalisation_metrics["predictionFlipRate"]
        )
        meta["pri.corpusAuditVersion"] = str(
            generalisation_report["dataReadiness"]["auditVersion"]
        )

    out = Path(args.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    mlmodel.save(str(out))
    print(f"wrote {out}")
    if production_ready:
        print(
            "PRODUCTION READY — exact V4 checkpoint passed final-holdout, V17 corpus-readiness and unseen-writer gates."
        )
    else:
        print(
            "DEVELOPMENT MODEL ONLY — V4 release requires final-holdout, V17 corpus-readiness and writer-generalisation evidence."
        )


if __name__ == "__main__":
    main()
