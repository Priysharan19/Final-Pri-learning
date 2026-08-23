"""Explicit Pri Ink Structural V4 decoder selection.

Evaluation code must name the decoder it is measuring. This registry prevents
silent changes of inference semantics while keeping complete-link, contiguous
joint, exact general joint and bounded auto search behind one inspected call.
"""
from __future__ import annotations

from structural_decode import decode_structural_output
from structural_joint_decode import decode_structural_output_joint
from structural_joint_general import (
    decode_structural_output_joint_auto,
    decode_structural_output_joint_general,
)

DECODER_NAMES = ("complete-link", "joint", "joint-general", "joint-auto")


def is_joint_decoder(name: str) -> bool:
    return name in {"joint", "joint-general", "joint-auto"}


def decode_structural_selected(
    name: str,
    outputs: dict,
    stroke_geometry,
    stroke_valid,
    *,
    model,
    group_threshold: float = 0.65,
    relation_threshold: float = 0.60,
    ambiguity_threshold: float = 0.80,
    max_group_size: int = 4,
    general_max_strokes: int = 14,
    grouping_temperature: float = 1.0,
    symbol_weight: float = 1.0,
    partition_margin_threshold: float = 0.0,
):
    if name == "complete-link":
        return decode_structural_output(
            outputs,
            stroke_geometry,
            stroke_valid,
            group_threshold=group_threshold,
            relation_threshold=relation_threshold,
            ambiguity_threshold=ambiguity_threshold,
            model=model,
        )
    common = dict(
        model=model,
        max_group_size=max_group_size,
        grouping_temperature=grouping_temperature,
        symbol_weight=symbol_weight,
        relation_threshold=relation_threshold,
        ambiguity_threshold=ambiguity_threshold,
        partition_margin_threshold=partition_margin_threshold,
    )
    if name == "joint":
        return decode_structural_output_joint(outputs, stroke_geometry, stroke_valid, **common)
    if name == "joint-general":
        return decode_structural_output_joint_general(
            outputs,
            stroke_geometry,
            stroke_valid,
            general_max_strokes=general_max_strokes,
            **common,
        )
    if name == "joint-auto":
        return decode_structural_output_joint_auto(
            outputs,
            stroke_geometry,
            stroke_valid,
            general_max_strokes=general_max_strokes,
            **common,
        )
    raise ValueError(f"unknown Structural V4 decoder {name!r}; expected one of {DECODER_NAMES}")
