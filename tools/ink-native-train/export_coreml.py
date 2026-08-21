#!/usr/bin/env python3
"""Export a trained PRI online-ink checkpoint as a Core ML package.

No uncalibrated checkpoint is exported as a production candidate. The exported
model remains an expert hypothesis source; selective acceptance and structural
fusion in Swift stay authoritative.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np
import torch
from torch import nn

from features import FEATURE_CONTRACT_VERSION, FEATURE_COUNT
from model import PriInkOnlineTransformer
from vocabulary import TOKENS


class CoreMLWrapper(nn.Module):
    def __init__(self, model: PriInkOnlineTransformer, token_temperature: float, count_temperature: float):
        super().__init__()
        self.model = model
        self.token_temperature = float(token_temperature)
        self.count_temperature = float(count_temperature)

    def forward(self, points: torch.Tensor, valid: torch.Tensor):
        # `valid` is [B,T] float32 (1 real, 0 padding) because that converts more
        # reliably across Core ML backends than exposing a boolean public input.
        mask = valid < 0.5
        out = self.model(points, mask)
        return (
            out["token_logits"] / self.token_temperature,
            out["count_logits"] / self.count_temperature,
            out["embedding"],
        )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("checkpoint")
    parser.add_argument("calibration")
    parser.add_argument("--output", default="ios/PriLearning.swiftpm/Resources/PriInkOnline.mlpackage")
    parser.add_argument("--max-points", type=int, default=1024)
    parser.add_argument("--minimum-ios", type=int, default=16)
    parser.add_argument("--compute-precision", choices=["float16", "float32"], default="float16")
    args = parser.parse_args()

    try:
        import coremltools as ct
    except ImportError as exc:
        raise SystemExit("coremltools is required for export; install tools/ink-native-train/requirements.txt") from exc

    checkpoint = torch.load(args.checkpoint, map_location="cpu", weights_only=False)
    calibration = json.loads(Path(args.calibration).read_text(encoding="utf-8"))
    if checkpoint.get("feature_contract") != FEATURE_CONTRACT_VERSION:
        raise SystemExit("checkpoint feature contract does not match Swift/Python V1 tensor")
    if calibration.get("schema") != "pri-ink-calibration-v1":
        raise SystemExit("missing locked-writer calibration metadata")
    if calibration.get("testDataUsed") is not False or calibration.get("finalHoldoutUsed") is not False:
        raise SystemExit("refusing export: calibration metadata says test/final-holdout was used")
    if int(calibration.get("calibrationExamples") or 0) <= 0:
        raise SystemExit("refusing export without real calibration examples")

    model = PriInkOnlineTransformer()
    model.load_state_dict(checkpoint["state_dict"])
    model.eval()
    wrapper = CoreMLWrapper(
        model,
        token_temperature=float(calibration["tokenTemperature"]),
        count_temperature=float(calibration["countTemperature"]),
    ).eval()

    points = torch.zeros(1, args.max_points, FEATURE_COUNT, dtype=torch.float32)
    valid = torch.zeros(1, args.max_points, dtype=torch.float32)
    valid[:, :8] = 1
    traced = torch.jit.trace(wrapper, (points, valid), strict=False)

    target_map = {
        16: ct.target.iOS16,
        17: ct.target.iOS17,
        18: ct.target.iOS18,
    }
    target = target_map.get(args.minimum_ios)
    if target is None:
        raise SystemExit("--minimum-ios must be 16, 17 or 18 for this exporter")
    precision = ct.precision.FLOAT16 if args.compute_precision == "float16" else ct.precision.FLOAT32

    mlmodel = ct.convert(
        traced,
        convert_to="mlprogram",
        minimum_deployment_target=target,
        compute_precision=precision,
        inputs=[
            ct.TensorType(name="points", shape=(1, args.max_points, FEATURE_COUNT), dtype=np.float32),
            ct.TensorType(name="valid", shape=(1, args.max_points), dtype=np.float32),
        ],
        outputs=[
            ct.TensorType(name="token_logits"),
            ct.TensorType(name="count_logits"),
            ct.TensorType(name="embedding"),
        ],
    )
    mlmodel.author = "PRI Learning"
    mlmodel.short_description = "Stroke-native mathematical handwriting expert; not a standalone marking authority."
    mlmodel.version = "1"
    mlmodel.user_defined_metadata.update({
        "pri.feature_contract": FEATURE_CONTRACT_VERSION,
        "pri.vocabulary": json.dumps(TOKENS, separators=(",", ":")),
        "pri.token_temperature": str(calibration["tokenTemperature"]),
        "pri.count_temperature": str(calibration["countTemperature"]),
        "pri.calibration_examples": str(calibration["calibrationExamples"]),
        "pri.calibration_participants": str(len(calibration.get("calibrationParticipants", []))),
        "pri.max_points": str(args.max_points),
        "pri.acceptance_authority": "false",
    })

    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    mlmodel.save(str(output))
    manifest = output.with_suffix(".manifest.json")
    manifest.write_text(json.dumps({
        "schema": "pri-ink-coreml-export-v1",
        "model": str(output),
        "featureContract": FEATURE_CONTRACT_VERSION,
        "features": FEATURE_COUNT,
        "maxPoints": args.max_points,
        "vocabulary": TOKENS,
        "calibration": calibration,
        "checkpointEpoch": checkpoint.get("epoch"),
        "corpusAudit": checkpoint.get("corpus_audit"),
        "productionAuthority": False,
    }, indent=2), encoding="utf-8")
    print("wrote", output)
    print("wrote", manifest)


if __name__ == "__main__":
    main()
