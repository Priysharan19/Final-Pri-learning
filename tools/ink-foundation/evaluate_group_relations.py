#!/usr/bin/env python3
"""Evidence-safe A/B of root-stroke vs pooled glyph relations for Pri Ink V4."""
from __future__ import annotations

import argparse
import json
from collections import defaultdict
from pathlib import Path

import torch
from torch.utils.data import DataLoader

from data import TOKEN_TO_ID
from evaluate_structural import edit_distance, is_critical_structure
from structural import PriInkStructuralV4, StructuralConfig, RELATION_TO_ID
from structural_component_validity import (
    ValidityAugmentedGlyphModel,
    checkpoint_sha256,
    load_component_validity_checkpoint,
    recover_true_components,
)
from structural_data import IGNORE_INDEX, StructuralInkDataset, corpus_files, load_structural_examples
from structural_decoder_registry import DECODER_NAMES, decode_structural_selected, is_joint_decoder
from structural_group_relations import (
    GROUP_RELATION_DECODER,
    apply_group_relation_head,
    group_relation_metrics,
    group_relation_targets,
    load_group_relation_checkpoint,
)
from train_group_relations import _prepare_examples


def _device(name: str) -> torch.device:
    if name != "auto":
        return torch.device(name)
    return torch.device(
        "cuda" if torch.cuda.is_available() else
        "mps" if torch.backends.mps.is_available() else "cpu"
    )


def _load_base(path: Path, device: torch.device):
    ckpt = torch.load(path, map_location="cpu", weights_only=False)
    if int(ckpt.get("architecture_version", 0)) != 4:
        raise SystemExit("checkpoint is not Pri Ink Structural V4")
    if ckpt.get("production_ready") is not False:
        raise SystemExit("research V4 checkpoint must not claim production readiness")
    if (ckpt.get("vocab") or []) != list(TOKEN_TO_ID.keys()):
        raise SystemExit("V4 checkpoint vocabulary does not match current runtime vocabulary")
    cfg = StructuralConfig(**ckpt["config"])
    model = PriInkStructuralV4(len(TOKEN_TO_ID), cfg)
    model.load_state_dict(ckpt["model"], strict=True)
    model.to(device).eval()
    return ckpt, cfg, model


def _expression_summary(rows: list[dict]) -> dict:
    total = len(rows)
    exact = sum(row["ok"] for row in rows)
    char_errors = sum(row["edit"] for row in rows)
    char_total = sum(max(1, len(row["target"])) for row in rows)
    critical = [row for row in rows if is_critical_structure(row["target"])]
    accepted = [row for row in rows if not row["ambiguous"]]
    writer_rows: dict[str, list[int]] = defaultdict(list)
    for row in rows:
        writer_rows[row["writer"]].append(row["ok"])
    writer_exact = {w: sum(v) / len(v) for w, v in sorted(writer_rows.items())}
    return {
        "samples": total,
        "exactExpressionAccuracy": exact / max(1, total),
        "characterErrorRate": char_errors / max(1, char_total),
        "criticalStructureExact": sum(row["ok"] for row in critical) / max(1, len(critical)),
        "criticalStructureSamples": len(critical),
        "coverage": len(accepted) / max(1, total),
        "safePrecision": sum(row["ok"] for row in accepted) / max(1, len(accepted)),
        "acceptedSamples": len(accepted),
        "meanDecisionConfidence": sum(row["confidence"] for row in rows) / max(1, total),
        "worstWriterExact": min(writer_exact.values(), default=0.0),
        "writerExact": writer_exact,
    }


def _snapshot(hyp, target: str, writer: str) -> dict:
    return {
        "target": target,
        "writer": writer,
        "prediction": hyp.canonical,
        "ok": int(hyp.canonical == target),
        "edit": edit_distance(hyp.canonical, target),
        "ambiguous": bool(hyp.ambiguous),
        "confidence": float(hyp.confidence),
        "relationConfidence": float(hyp.relation_confidence),
        "warnings": list(hyp.warnings),
    }


def _regressions(before: dict, after: dict) -> list[str]:
    rows = []
    if after["exactExpressionAccuracy"] < before["exactExpressionAccuracy"]:
        rows.append("exactExpressionAccuracy")
    if after["characterErrorRate"] > before["characterErrorRate"]:
        rows.append("characterErrorRate")
    if after["criticalStructureExact"] < before["criticalStructureExact"]:
        rows.append("criticalStructureExact")
    if after["safePrecision"] < before["safePrecision"]:
        rows.append("safePrecision")
    if after["worstWriterExact"] < before["worstWriterExact"]:
        rows.append("worstWriterExact")
    return rows


def main():
    p = argparse.ArgumentParser()
    p.add_argument("base_checkpoint")
    p.add_argument("group_relation_checkpoint")
    p.add_argument("--corpus", required=True)
    p.add_argument("--mode", choices=["writer-disjoint", "same-writer-dev"], default="writer-disjoint")
    p.add_argument("--decoder", choices=list(DECODER_NAMES), default="joint-auto")
    p.add_argument("--device", default="auto")
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
    p.add_argument("--out", default="tools/ink-foundation/runs/pri-ink-v4-group-relation-ab.json")
    args = p.parse_args()

    if not 0.0 < args.relation_threshold < 1.0 or not 0.0 < args.ambiguity_threshold < 1.0:
        raise SystemExit("relation/ambiguity thresholds must be between 0 and 1")
    if args.component_validity and not is_joint_decoder(args.decoder):
        raise SystemExit("component validity requires a joint decoder")

    device = _device(args.device)
    base_path = Path(args.base_checkpoint)
    relation_path = Path(args.group_relation_checkpoint)
    base_ckpt, cfg, model = _load_base(base_path, device)
    raw = load_structural_examples(corpus_files(args.corpus))
    examples, protocol = _prepare_examples(raw, base_ckpt, args.mode)
    loader = DataLoader(
        StructuralInkDataset(examples, "validation", cfg),
        batch_size=1,
        shuffle=False,
        num_workers=0,
    )
    if len(loader.dataset) < 1:
        raise SystemExit("no validation examples available for group-relation A/B")

    try:
        relation_head, relation_ckpt = load_group_relation_checkpoint(
            relation_path,
            base_checkpoint_path=base_path,
            d_model=cfg.d_model,
            device=device,
        )
    except ValueError as exc:
        raise SystemExit(str(exc)) from exc

    validity_scorer = None
    validity_meta = None
    if args.component_validity:
        validity_path = Path(args.component_validity)
        try:
            validity_scorer, validity_ckpt = load_component_validity_checkpoint(
                validity_path,
                base_checkpoint_path=base_path,
                d_model=cfg.d_model,
                device=device,
            )
        except ValueError as exc:
            raise SystemExit(str(exc)) from exc
        validity_meta = {
            "checkpointSha256": checkpoint_sha256(validity_path),
            "version": validity_ckpt.get("component_validity_version"),
            "stage": validity_ckpt.get("stage"),
        }

    before_rows = []
    after_rows = []
    legacy_oracle_logits = []
    group_oracle_logits = []
    oracle_targets = []
    search_regimes: dict[str, int] = defaultdict(int)

    with torch.inference_mode():
        for batch in loader:
            device_valid = batch["stroke_valid"].to(device)
            device_geometry = batch["stroke_geometry"].to(device)
            outputs = model(
                batch["stroke_points"].to(device),
                batch["stroke_point_valid"].to(device),
                device_valid,
                device_geometry,
                batch["raster"].to(device),
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
                device_geometry,
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
            target = str(batch["target_text"][0])
            writer = str(batch["writer"][0])
            before_rows.append(_snapshot(hyp, target, writer))

            symbols = batch["symbol_targets"].to(device)[0]
            groups = batch["group_targets"].to(device)[0]
            true_components = recover_true_components(symbols, groups)
            true_targets = group_relation_targets(
                batch["relation_targets"].to(device)[0], true_components
            )
            mask = true_targets.ne(IGNORE_INDEX)
            if bool(mask.any()):
                group_logits = relation_head(
                    outputs["stroke_embeddings"][0], device_geometry[0], true_components
                )
                legacy = outputs["relation_logits"][0]
                roots = [component[0] for component in true_components]
                legacy_group = legacy.new_zeros((len(roots), len(roots), legacy.shape[-1]))
                for si, src in enumerate(roots):
                    for ti, dst in enumerate(roots):
                        legacy_group[si, ti] = legacy[src, dst]
                legacy_oracle_logits.append(legacy_group[mask].cpu())
                group_oracle_logits.append(group_logits[mask].cpu())
                oracle_targets.append(true_targets[mask].cpu())

            apply_group_relation_head(
                hyp,
                outputs,
                device_geometry,
                relation_head,
                relation_threshold=args.relation_threshold,
                ambiguity_threshold=args.ambiguity_threshold,
            )
            after_rows.append(_snapshot(hyp, target, writer))

    if not oracle_targets:
        raise SystemExit("validation split has no oracle relation supervision")
    oracle_target = torch.cat(oracle_targets, dim=0)
    legacy_metrics = group_relation_metrics(torch.cat(legacy_oracle_logits, dim=0), oracle_target)
    group_metrics = group_relation_metrics(torch.cat(group_oracle_logits, dim=0), oracle_target)
    before = _expression_summary(before_rows)
    after = _expression_summary(after_rows)
    report = {
        "architectureVersion": 4,
        "comparison": "root-stroke-relations-vs-pooled-group-relations",
        "productionReady": False,
        "baseCheckpointSha256": checkpoint_sha256(base_path),
        "groupRelationCheckpointSha256": checkpoint_sha256(relation_path),
        "groupRelationVersion": relation_ckpt.get("group_relation_version"),
        "groupRelationDecoder": GROUP_RELATION_DECODER,
        "groupRelationStage": relation_ckpt.get("stage"),
        "decoder": args.decoder,
        "componentValidity": validity_meta,
        "validationProtocol": protocol,
        "oracleRelation": {
            "legacyRootStroke": legacy_metrics,
            "pooledGroup": group_metrics,
        },
        "expression": {
            "before": before,
            "after": after,
            "delta": {
                "exactExpressionAccuracy": after["exactExpressionAccuracy"] - before["exactExpressionAccuracy"],
                "characterErrorRate": after["characterErrorRate"] - before["characterErrorRate"],
                "criticalStructureExact": after["criticalStructureExact"] - before["criticalStructureExact"],
                "coverage": after["coverage"] - before["coverage"],
                "safePrecision": after["safePrecision"] - before["safePrecision"],
            },
            "regressions": _regressions(before, after),
        },
        "actualSearchRegimes": dict(sorted(search_regimes.items())),
        "evidence": (
            "research-only same-base relation A/B; synthetic and same-writer results are not production evidence"
        ),
    }
    out = Path(args.out); out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(report, indent=2) + "\n")

    print("\nPri Ink Structural V4 — POOLED GROUP RELATION A/B\n")
    print(f"decoder: {args.decoder} · samples: {before['samples']}")
    print(
        "oracle positive relation accuracy: "
        f"{100*legacy_metrics['positiveAccuracy']:.2f}% -> {100*group_metrics['positiveAccuracy']:.2f}%"
    )
    print(
        "oracle macro positive recall: "
        f"{100*legacy_metrics['macroPositiveRecall']:.2f}% -> {100*group_metrics['macroPositiveRecall']:.2f}%"
    )
    print(
        "exact expression: "
        f"{100*before['exactExpressionAccuracy']:.2f}% -> {100*after['exactExpressionAccuracy']:.2f}%"
    )
    print(
        "CER: "
        f"{100*before['characterErrorRate']:.2f}% -> {100*after['characterErrorRate']:.2f}%"
    )
    print("regressions: " + (", ".join(report["expression"]["regressions"]) or "none in reported metrics"))
    print(f"writer-disjoint: {str(bool(protocol.get('writerDisjoint'))).lower()}")
    print("production ready: false")
    print(f"report: {out}")


if __name__ == "__main__":
    main()
