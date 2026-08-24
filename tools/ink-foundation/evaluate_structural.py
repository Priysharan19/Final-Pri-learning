#!/usr/bin/env python3
"""Expression-level evaluation for Pri Ink Structural V4.

Head metrics are diagnostic only. This evaluator measures complete canonical
expression correctness and precision/coverage after uncertainty abstention.
Final-holdout access remains deliberately locked.

The legacy complete-link decoder remains the default so historical V4 reports do
not silently change meaning. Every newer search regime must be selected by name
and the report records the actual per-sample search implementation used.

An optional component-validity calibrator may augment only joint decoders. The
auxiliary checkpoint must be tied to the exact base V4 checkpoint hash, so its
impact can be compared against the unchanged base model without evidence drift.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
from collections import defaultdict
from pathlib import Path

import torch
from torch.utils.data import DataLoader

from data import TOKEN_TO_ID
from structural import PriInkStructuralV4, StructuralConfig
from structural_component_validity import (
    ValidityAugmentedGlyphModel,
    load_component_validity_checkpoint,
)
from structural_data import StructuralInkDataset, corpus_files, load_structural_examples
from structural_decoder_registry import DECODER_NAMES, decode_structural_selected, is_joint_decoder


def edit_distance(a: str, b: str) -> int:
    prev = list(range(len(b) + 1))
    for i, ca in enumerate(a, 1):
        cur = [i]
        for j, cb in enumerate(b, 1):
            cur.append(min(cur[-1] + 1, prev[j] + 1, prev[j - 1] + (ca != cb)))
        prev = cur
    return prev[-1]


def is_critical_structure(text: str) -> bool:
    return any(marker in text for marker in ("^(", "sqrt(", ")/(", "<=", ">=", "_"))


def checkpoint_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def _joint_search_contract(decoder: str, max_group_size: int, general_max_strokes: int) -> dict:
    if decoder == "joint":
        policy = "exact contiguous physical draw-order partition search"
    elif decoder == "joint-general":
        policy = "exact non-contiguous set partition search; fails loudly above generalMaxStrokes"
    elif decoder == "joint-auto":
        policy = "exact non-contiguous set partition search up to generalMaxStrokes; exact contiguous fallback above it"
    else:
        return {}
    return {
        "policy": policy,
        "maxGroupSize": max_group_size,
        "generalMaxStrokes": general_max_strokes,
    }


def main():
    p = argparse.ArgumentParser()
    p.add_argument("checkpoint")
    p.add_argument("--corpus", required=True)
    p.add_argument("--split", choices=["validation", "test", "final-holdout"], default="validation")
    p.add_argument("--device", default="auto")
    p.add_argument("--decoder", choices=list(DECODER_NAMES), default="complete-link")
    p.add_argument("--group-threshold", type=float, default=0.65)
    p.add_argument("--relation-threshold", type=float, default=0.60)
    p.add_argument("--ambiguity-threshold", type=float, default=0.80)
    p.add_argument("--max-group-size", type=int, default=4)
    p.add_argument("--general-max-strokes", type=int, default=14)
    p.add_argument("--grouping-temperature", type=float, default=1.0)
    p.add_argument("--symbol-weight", type=float, default=1.0)
    p.add_argument("--partition-margin-threshold", type=float, default=0.0)
    p.add_argument("--component-validity", default=None,
                   help="optional hash-bound V4 component-validity checkpoint for joint decoders")
    p.add_argument("--component-validity-weight", type=float, default=1.0,
                   help="exponent applied to learned component validity probability")
    p.add_argument("--unlock-final-holdout", action="store_true")
    p.add_argument("--out", default=None)
    args = p.parse_args()

    if args.split == "final-holdout" and not args.unlock_final_holdout:
        raise SystemExit("final-holdout is locked. Freeze the candidate first, then pass --unlock-final-holdout exactly once for release evidence.")
    for name, value in (("group-threshold", args.group_threshold), ("relation-threshold", args.relation_threshold), ("ambiguity-threshold", args.ambiguity_threshold)):
        if not 0.0 < value < 1.0:
            raise SystemExit(f"--{name} must be between 0 and 1")
    if args.max_group_size < 1:
        raise SystemExit("--max-group-size must be >= 1")
    if args.general_max_strokes < 1:
        raise SystemExit("--general-max-strokes must be >= 1")
    if args.grouping_temperature <= 0:
        raise SystemExit("--grouping-temperature must be > 0")
    if args.symbol_weight < 0:
        raise SystemExit("--symbol-weight must be >= 0")
    if args.partition_margin_threshold < 0:
        raise SystemExit("--partition-margin-threshold must be >= 0")
    if args.component_validity_weight < 0:
        raise SystemExit("--component-validity-weight must be >= 0")
    if args.component_validity and not is_joint_decoder(args.decoder):
        raise SystemExit("component validity is a joint-partition research feature; use a joint decoder")

    checkpoint = Path(args.checkpoint)
    ckpt = torch.load(checkpoint, map_location="cpu", weights_only=False)
    if int(ckpt.get("architecture_version", 0)) != 4:
        raise SystemExit("checkpoint is not Pri Ink Structural V4")
    if ckpt.get("stage") != "structural-research":
        raise SystemExit(f"unexpected V4 checkpoint stage: {ckpt.get('stage')!r}")
    if ckpt.get("production_ready") is not False:
        raise SystemExit("research V4 checkpoint must not claim production readiness")
    if (ckpt.get("vocab") or []) != list(TOKEN_TO_ID.keys()):
        raise SystemExit("V4 checkpoint vocabulary does not match current runtime vocabulary")
    cfg = StructuralConfig(**ckpt["config"])
    base_hash = checkpoint_sha256(checkpoint)

    if args.device == "auto":
        device = torch.device("cuda" if torch.cuda.is_available() else "mps" if torch.backends.mps.is_available() else "cpu")
    else:
        device = torch.device(args.device)

    examples = load_structural_examples(corpus_files(args.corpus))
    selected = [x for x in examples if x.split == args.split]
    if not selected:
        raise SystemExit(f"no structure-annotated {args.split!r} samples found")
    loader = DataLoader(StructuralInkDataset(examples, args.split, cfg), batch_size=1, shuffle=False, num_workers=0)
    model = PriInkStructuralV4(len(TOKEN_TO_ID), cfg)
    model.load_state_dict(ckpt["model"], strict=True); model.to(device).eval()

    validity_scorer = None
    validity_meta = None
    if args.component_validity:
        validity_path = Path(args.component_validity)
        if not validity_path.exists():
            raise SystemExit(f"component validity checkpoint not found: {validity_path}")
        try:
            validity_scorer, validity_ckpt = load_component_validity_checkpoint(
                validity_path,
                base_checkpoint_path=checkpoint,
                d_model=cfg.d_model,
                device=device,
            )
        except ValueError as exc:
            raise SystemExit(str(exc)) from exc
        validity_meta = {
            "componentValidityVersion": validity_ckpt["component_validity_version"],
            "checkpointSha256": checkpoint_sha256(validity_path),
            "baseCheckpointSha256": validity_ckpt["base_checkpoint_sha256"],
            "stage": validity_ckpt.get("stage"),
            "objective": validity_ckpt.get("objective"),
            "weight": args.component_validity_weight,
            "validationProtocol": validity_ckpt.get("validation_protocol"),
            "evidence": validity_ckpt.get("evidence"),
        }

    total = exact = char_errors = char_total = accepted = accepted_exact = 0
    critical_total = critical_exact = 0; confidence_sum = 0.0
    by_writer: dict[str, list[int]] = defaultdict(list); warning_counts: dict[str, int] = defaultdict(int)
    joint_margins: list[float] = []
    search_regimes: dict[str, int] = defaultdict(int)
    with torch.inference_mode():
        for batch in loader:
            device_valid = batch["stroke_valid"].to(device)
            outputs = model(
                batch["stroke_points"].to(device), batch["stroke_point_valid"].to(device),
                device_valid, batch["stroke_geometry"].to(device), batch["raster"].to(device),
            )
            decode_model = model
            if validity_scorer is not None:
                decode_model = ValidityAugmentedGlyphModel(
                    model,
                    validity_scorer,
                    outputs["stroke_embeddings"],
                    device_valid,
                    validity_weight=args.component_validity_weight,
                )
            hyp = decode_structural_selected(
                args.decoder,
                outputs,
                batch["stroke_geometry"].to(device),
                device_valid,
                model=decode_model,
                group_threshold=args.group_threshold,
                relation_threshold=args.relation_threshold,
                ambiguity_threshold=args.ambiguity_threshold,
                max_group_size=args.max_group_size,
                general_max_strokes=args.general_max_strokes,
                grouping_temperature=args.grouping_temperature,
                symbol_weight=args.symbol_weight,
                partition_margin_threshold=args.partition_margin_threshold,
            )
            if is_joint_decoder(args.decoder):
                search_regimes[getattr(hyp, "decoder", args.decoder)] += 1
                if math.isfinite(hyp.partition_margin):
                    joint_margins.append(hyp.partition_margin)
            target = str(batch["target_text"][0]); writer = str(batch["writer"][0]); ok = int(hyp.canonical == target)
            total += 1; exact += ok; char_errors += edit_distance(hyp.canonical, target); char_total += max(1, len(target))
            confidence_sum += hyp.confidence; by_writer[writer].append(ok)
            if is_critical_structure(target): critical_total += 1; critical_exact += ok
            if not hyp.ambiguous: accepted += 1; accepted_exact += ok
            for warning in hyp.warnings: warning_counts[warning.split(":", 1)[0]] += 1

    writer_exact = {w: sum(v) / len(v) for w, v in sorted(by_writer.items())}
    thresholds = {"relation": args.relation_threshold, "ambiguity": args.ambiguity_threshold}
    if is_joint_decoder(args.decoder):
        thresholds.update({
            "maxGroupSize": args.max_group_size,
            "generalMaxStrokes": args.general_max_strokes,
            "groupingTemperature": args.grouping_temperature,
            "symbolWeight": args.symbol_weight,
            "partitionMargin": args.partition_margin_threshold,
        })
        if validity_meta is not None:
            thresholds["componentValidityWeight"] = args.component_validity_weight
    else:
        thresholds["group"] = args.group_threshold

    metrics = {
        "architectureVersion": 4, "stage": "structural-research", "productionReady": False,
        "decoder": args.decoder,
        "split": args.split, "checkpointSha256": base_hash, "samples": total,
        "writers": len(by_writer), "exactExpressionAccuracy": exact / max(1, total),
        "characterErrorRate": char_errors / max(1, char_total),
        "criticalStructureExact": critical_exact / max(1, critical_total), "criticalStructureSamples": critical_total,
        "coverage": accepted / max(1, total), "safePrecision": accepted_exact / max(1, accepted),
        "acceptedSamples": accepted, "meanDecisionConfidence": confidence_sum / max(1, total),
        "worstWriterExact": min(writer_exact.values(), default=0.0), "writerExact": writer_exact,
        "warningCounts": dict(sorted(warning_counts.items())),
        "thresholds": thresholds,
        "componentValidity": validity_meta,
        "evidence": "research evaluation only; does not promote a V4 model",
    }
    if is_joint_decoder(args.decoder):
        metrics["jointPartition"] = {
            "finiteMarginSamples": len(joint_margins),
            "meanMargin": sum(joint_margins) / max(1, len(joint_margins)),
            "minMargin": min(joint_margins, default=0.0),
            "searchContract": _joint_search_contract(args.decoder, args.max_group_size, args.general_max_strokes),
            "actualSearchRegimes": dict(sorted(search_regimes.items())),
        }

    print("\nPri Ink Structural V4 expression evaluation\n")
    print(f"decoder: {args.decoder}")
    print(f"component validity: {'enabled' if validity_meta else 'disabled'}")
    print(f"split: {args.split} · writers: {len(by_writer)} · samples: {total}")
    print(f"exact expression: {100*metrics['exactExpressionAccuracy']:.2f}%")
    print(f"CER: {100*metrics['characterErrorRate']:.2f}%")
    print(f"critical structure exact: {100*metrics['criticalStructureExact']:.2f}% ({critical_total} samples)")
    print(f"abstention coverage: {100*metrics['coverage']:.2f}%")
    print(f"safe precision among accepted: {100*metrics['safePrecision']:.2f}%")
    print(f"worst writer exact: {100*metrics['worstWriterExact']:.2f}%")
    if is_joint_decoder(args.decoder):
        print(f"joint partition mean finite margin: {metrics['jointPartition']['meanMargin']:.6f}")
        print(f"actual joint search regimes: {metrics['jointPartition']['actualSearchRegimes']}")
    print("production ready: false")
    if args.out:
        out = Path(args.out); out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(metrics, indent=2) + "\n"); print(f"report: {out}")


if __name__ == "__main__":
    main()
