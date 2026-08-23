#!/usr/bin/env python3
"""Evaluate a Pri Ink Structural V4 same-writer development checkpoint.

The frozen P0001 holdout is diagnostic only and never production evidence. The
oracle-group metric supplies true stroke groups to the same group-level glyph
classifier used by live decoding, cleanly separating symbol and grouping errors.

Complete-link remains the historical baseline. Joint search variants run on the
identical frozen split and record their actual per-sample search regime so a
comparison cannot silently change its inference semantics. An optional component-
validity checkpoint must be hash-bound to this exact dev base checkpoint.
"""
from __future__ import annotations

import argparse
import json
import math
from collections import defaultdict
from pathlib import Path

import torch
import torch.nn.functional as F
from torch.utils.data import DataLoader

from data import ID_TO_TOKEN, SPECIAL, TOKEN_TO_ID
from dev_split import make_same_writer_dev_split
from evaluate_structural import checkpoint_sha256, edit_distance, is_critical_structure, _joint_search_contract
from structural import PriInkStructuralV4, StructuralConfig
from structural_component_validity import (
    ValidityAugmentedGlyphModel,
    load_component_validity_checkpoint,
)
from structural_data import StructuralInkDataset, corpus_files, load_structural_examples
from structural_decoder_registry import DECODER_NAMES, decode_structural_selected, is_joint_decoder


def _best_real_symbol(logits: torch.Tensor) -> tuple[str, float]:
    probs = F.softmax(logits, dim=-1)
    for idx in probs.argsort(descending=True).tolist():
        token = ID_TO_TOKEN.get(int(idx), "<unk>")
        if token not in SPECIAL:
            return token, float(probs[idx])
    return "<unk>", 0.0


def _oracle_group_symbol_diagnostic(model: PriInkStructuralV4, outputs: dict, structure: dict):
    embeddings = outputs["glyph_stroke_embeddings"]
    if embeddings.ndim == 3:
        embeddings = embeddings[0]
    groups = []
    for group in structure.get("groups") or []:
        strokes = [int(i) for i in (group.get("strokes") or [])]
        if strokes:
            groups.append((group, strokes))
    if not groups:
        return [], 0, 0
    logits = model.classify_glyph_components(embeddings, [strokes for _, strokes in groups])
    rows = []; correct = 0
    for (group, strokes), token_logits in zip(groups, logits):
        pred, confidence = _best_real_symbol(token_logits)
        target = str(group.get("symbol", "")); ok = pred == target
        correct += int(ok)
        rows.append({
            "id": str(group.get("id", "")), "strokes": strokes,
            "target": target, "prediction": pred, "correct": ok, "confidence": confidence,
        })
    return rows, correct, len(groups)


def main():
    p = argparse.ArgumentParser()
    p.add_argument("checkpoint")
    p.add_argument("--corpus", required=True)
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
    p.add_argument("--component-validity", default=None)
    p.add_argument("--component-validity-weight", type=float, default=1.0)
    p.add_argument("--out", default=None)
    args = p.parse_args()

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
        raise SystemExit("component validity is available only for joint decoder evaluation")

    checkpoint = Path(args.checkpoint)
    ckpt = torch.load(checkpoint, map_location="cpu", weights_only=False)
    if int(ckpt.get("architecture_version", 0)) != 4:
        raise SystemExit("checkpoint is not Pri Ink Structural V4")
    if ckpt.get("stage") != "structural-research-dev":
        raise SystemExit(f"expected structural-research-dev checkpoint, got {ckpt.get('stage')!r}")
    if ckpt.get("production_ready") is not False:
        raise SystemExit("dev checkpoint must never claim production readiness")
    if (ckpt.get("vocab") or []) != list(TOKEN_TO_ID.keys()):
        raise SystemExit("V4 checkpoint vocabulary does not match current runtime vocabulary")

    split_meta = ckpt.get("dev_split") or {}
    if split_meta.get("protocol") != "same-writer-dev-holdout":
        raise SystemExit("checkpoint has no valid same-writer dev split metadata")
    if split_meta.get("writerDisjoint") is not False or split_meta.get("productionEvidence") is not False:
        raise SystemExit("unsafe dev split metadata")

    examples = load_structural_examples(corpus_files(args.corpus))
    try:
        examples, recreated = make_same_writer_dev_split(examples, seed=int(split_meta["seed"]), fraction=float(split_meta["fraction"]))
    except (ValueError, KeyError) as exc:
        raise SystemExit(str(exc)) from exc
    for key in ("writer", "trainSamples", "validationSamples"):
        if recreated.get(key) != split_meta.get(key):
            raise SystemExit(f"dev split reproduction mismatch for {key}: {recreated.get(key)!r} != {split_meta.get(key)!r}")

    validation_rows = [x for x in examples if x.split == "validation"]
    cfg = StructuralConfig(**ckpt["config"])
    dataset = StructuralInkDataset(examples, "validation", cfg)
    if len(dataset) < 1 or len(validation_rows) != len(dataset):
        raise SystemExit("invalid recreated dev validation split")
    loader = DataLoader(dataset, batch_size=1, shuffle=False, num_workers=0)

    if args.device == "auto":
        device = torch.device("cuda" if torch.cuda.is_available() else "mps" if torch.backends.mps.is_available() else "cpu")
    else:
        device = torch.device(args.device)
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
        validity_protocol = validity_ckpt.get("validation_protocol") or {}
        if validity_ckpt.get("stage") != "component-validity-research-dev":
            raise SystemExit("same-writer dev evaluation requires a dev component-validity checkpoint")
        for key in ("writer", "trainSamples", "validationSamples"):
            if validity_protocol.get(key) != recreated.get(key):
                raise SystemExit(f"component validity frozen dev split mismatch for {key}")
        validity_meta = {
            "componentValidityVersion": validity_ckpt["component_validity_version"],
            "checkpointSha256": checkpoint_sha256(validity_path),
            "baseCheckpointSha256": validity_ckpt["base_checkpoint_sha256"],
            "stage": validity_ckpt.get("stage"),
            "objective": validity_ckpt.get("objective"),
            "weight": args.component_validity_weight,
            "validationProtocol": validity_protocol,
            "evidence": validity_ckpt.get("evidence"),
        }

    total = exact = char_errors = char_total = accepted = accepted_exact = 0
    critical_total = critical_exact = 0; confidence_sum = 0.0
    oracle_symbol_ok = oracle_symbol_n = 0
    by_writer: dict[str, list[int]] = defaultdict(list)
    warning_counts: dict[str, int] = defaultdict(int); sample_diagnostics = []
    joint_margins: list[float] = []
    search_regimes: dict[str, int] = defaultdict(int)

    with torch.inference_mode():
        for sample_number, (batch, row) in enumerate(zip(loader, validation_rows), 1):
            device_valid = batch["stroke_valid"].to(device)
            outputs = model(
                batch["stroke_points"].to(device), batch["stroke_point_valid"].to(device),
                device_valid, batch["stroke_geometry"].to(device), batch["raster"].to(device),
            )
            decode_model = model
            if validity_scorer is not None:
                decode_model = ValidityAugmentedGlyphModel(
                    model, validity_scorer, outputs["stroke_embeddings"], device_valid,
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
            target = str(batch["target_text"][0]); writer = str(batch["writer"][0])
            ok = int(hyp.canonical == target); dist = edit_distance(hyp.canonical, target)
            total += 1; exact += ok; char_errors += dist; char_total += max(1, len(target)); confidence_sum += hyp.confidence
            by_writer[writer].append(ok)
            if is_critical_structure(target): critical_total += 1; critical_exact += ok
            if not hyp.ambiguous: accepted += 1; accepted_exact += ok
            for warning in hyp.warnings: warning_counts[warning.split(":", 1)[0]] += 1

            oracle_rows, oracle_ok, oracle_n = _oracle_group_symbol_diagnostic(model, outputs, row.structure)
            oracle_symbol_ok += oracle_ok; oracle_symbol_n += oracle_n
            diagnostic = {
                "sample": sample_number, "target": target, "prediction": hyp.canonical, "exact": bool(ok),
                "editDistance": dist, "ambiguous": hyp.ambiguous, "confidence": hyp.confidence,
                "symbolConfidence": hyp.symbol_confidence, "groupingConfidence": hyp.grouping_confidence,
                "relationConfidence": hyp.relation_confidence,
                "truthGlyphCount": len(row.structure.get("groups") or []), "predictedGlyphCount": len(hyp.glyphs),
                "oracleGroupSymbolCorrect": oracle_ok, "oracleGroupSymbolTotal": oracle_n,
                "oracleGroupSymbolAccuracy": oracle_ok / max(1, oracle_n), "oracleGroupSymbols": oracle_rows,
                "predictedGlyphs": [{"id": g.id, "strokes": list(g.strokes), "symbol": g.symbol, "confidence": g.symbol_confidence, "cx": g.cx, "cy": g.cy} for g in hyp.glyphs],
                "predictedRelations": [{"from": r.source, "to": r.target, "type": r.kind, "confidence": r.confidence} for r in hyp.relations],
                "warnings": list(hyp.warnings),
            }
            if is_joint_decoder(args.decoder):
                diagnostic["jointPartition"] = {
                    "searchRegime": getattr(hyp, "decoder", args.decoder),
                    "score": hyp.partition_score,
                    "margin": hyp.partition_margin if math.isfinite(hyp.partition_margin) else None,
                    "pairScore": hyp.partition_pair_score,
                    "symbolScore": hyp.partition_symbol_score,
                }
            sample_diagnostics.append(diagnostic)

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
        "architectureVersion": 4, "stage": "structural-research-dev", "productionReady": False,
        "decoder": args.decoder,
        "validationProtocol": recreated, "checkpointSha256": checkpoint_sha256(checkpoint),
        "samples": total, "writers": len(by_writer), "exactExpressionAccuracy": exact / max(1, total),
        "characterErrorRate": char_errors / max(1, char_total),
        "criticalStructureExact": critical_exact / max(1, critical_total), "criticalStructureSamples": critical_total,
        "coverage": accepted / max(1, total), "safePrecision": accepted_exact / max(1, accepted),
        "acceptedSamples": accepted, "meanDecisionConfidence": confidence_sum / max(1, total),
        "oracleGroupingGlyphSymbolAccuracy": oracle_symbol_ok / max(1, oracle_symbol_n),
        "oracleGroupingGlyphSymbolsCorrect": oracle_symbol_ok, "oracleGroupingGlyphSymbolsTotal": oracle_symbol_n,
        "worstWriterExact": min(writer_exact.values(), default=0.0), "writerExact": writer_exact,
        "warningCounts": dict(sorted(warning_counts.items())),
        "thresholds": thresholds,
        "componentValidity": validity_meta,
        "sampleDiagnostics": sample_diagnostics,
        "evidence": "same-writer development evaluation only; not writer-disjoint and not production evidence",
    }
    if is_joint_decoder(args.decoder):
        metrics["jointPartition"] = {
            "finiteMarginSamples": len(joint_margins),
            "meanMargin": sum(joint_margins) / max(1, len(joint_margins)),
            "minMargin": min(joint_margins, default=0.0),
            "searchContract": _joint_search_contract(args.decoder, args.max_group_size, args.general_max_strokes),
            "actualSearchRegimes": dict(sorted(search_regimes.items())),
        }

    print("\nPri Ink Structural V4 — SAME-WRITER DEV EVALUATION\n")
    print(f"decoder: {args.decoder}")
    print(f"component validity: {'enabled' if validity_meta else 'disabled'}")
    print(f"writer: {recreated['writer']} · samples: {total}")
    print(f"exact expression: {100*metrics['exactExpressionAccuracy']:.2f}%")
    print(f"CER: {100*metrics['characterErrorRate']:.2f}%")
    print(f"oracle-group glyph symbol accuracy: {100*metrics['oracleGroupingGlyphSymbolAccuracy']:.2f}% ({oracle_symbol_ok}/{oracle_symbol_n})")
    print(f"critical structure exact: {100*metrics['criticalStructureExact']:.2f}% ({critical_total} samples)")
    print(f"abstention coverage: {100*metrics['coverage']:.2f}%")
    print(f"safe precision among accepted: {100*metrics['safePrecision']:.2f}%")
    if is_joint_decoder(args.decoder):
        print(f"joint partition mean finite margin: {metrics['jointPartition']['meanMargin']:.6f}")
        print(f"actual joint search regimes: {metrics['jointPartition']['actualSearchRegimes']}")
    print("\nPer-sample diagnostics:")
    for item in sample_diagnostics:
        text = (
            f"  #{item['sample']} target={item['target']!r} pred={item['prediction']!r} edit={item['editDistance']} "
            f"conf={item['confidence']:.3f} sym={item['symbolConfidence']:.3f} group={item['groupingConfidence']:.3f} "
            f"rel={item['relationConfidence']:.3f} glyphs={item['predictedGlyphCount']}/{item['truthGlyphCount']} "
            f"oracle_sym={item['oracleGroupSymbolCorrect']}/{item['oracleGroupSymbolTotal']}"
        )
        if is_joint_decoder(args.decoder):
            part = item["jointPartition"]
            text += f" search={part['searchRegime']} joint_margin={part['margin'] if part['margin'] is not None else 'inf'}"
        print(text)
    print("writer-disjoint: false"); print("production ready: false")
    if args.out:
        out = Path(args.out); out.parent.mkdir(parents=True, exist_ok=True)
        out.write_text(json.dumps(metrics, indent=2) + "\n"); print(f"report: {out}")


if __name__ == "__main__":
    main()
