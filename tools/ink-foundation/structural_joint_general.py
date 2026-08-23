"""Exact non-contiguous glyph partitioning for Pri Ink Structural V4.

The first joint V4 decoder deliberately solved the most common case with an exact
contiguous draw-order dynamic program. Natural Pencil input can violate that
assumption: a writer may delay a crossbar, dot, or second mark of a glyph until
after beginning a neighbouring glyph.

This module removes that representational blind spot for tractable expressions.
It rewrites the all-pairs grouping likelihood as an all-different constant plus
an additive within-component log-odds gain. For each possible glyph count K,
that makes the joint grouping + group-symbol objective an exact weighted set
partition problem. A memoised anchor-first bitmask DP then recovers the global
best and runner-up partitions without enumerating Bell-number partitions.

The exact general search is intentionally bounded by ``general_max_strokes``.
Above that limit callers must use the scalable contiguous decoder or explicitly
choose an auto policy. This is research infrastructure only and does not relax
Pri Ink writer-disjoint production evidence requirements.
"""
from __future__ import annotations

from dataclasses import dataclass
from functools import lru_cache
from itertools import combinations
import math

import torch

from structural_decode import _build_ast, _glyphs, _relations
from structural_joint_decode import (
    JointPartitionCandidate,
    JointStructuralHypothesis,
    _decision_confidence,
    _safe_real_symbol,
    _symmetric_probabilities,
    decode_structural_output_joint,
)


@dataclass(frozen=True)
class _SetPartial:
    score: float
    pair_gain: float
    symbol_sum: float
    components: tuple[tuple[int, ...], ...]


def _rank_two(rows: list[_SetPartial]) -> tuple[_SetPartial, ...]:
    unique: dict[tuple[tuple[int, ...], ...], _SetPartial] = {}
    for row in rows:
        old = unique.get(row.components)
        if old is None or (row.score, row.symbol_sum, row.pair_gain) > (
            old.score, old.symbol_sum, old.pair_gain
        ):
            unique[row.components] = row
    return tuple(sorted(
        unique.values(),
        key=lambda row: (
            row.score,
            row.symbol_sum,
            row.pair_gain,
            tuple((-len(c),) + tuple(-i for i in c) for c in row.components),
        ),
        reverse=True,
    )[:2])


def _candidate_components(active: tuple[int, ...], max_group_size: int) -> list[tuple[int, ...]]:
    rows: list[tuple[int, ...]] = []
    for size in range(1, min(max_group_size, len(active)) + 1):
        rows.extend(tuple(group) for group in combinations(active, size))
    return rows


def _component_mask(component: tuple[int, ...], position: dict[int, int]) -> int:
    mask = 0
    for stroke in component:
        mask |= 1 << position[stroke]
    return mask


def _pair_terms(
    probability: torch.Tensor,
    active: tuple[int, ...],
    components: list[tuple[int, ...]],
) -> tuple[float, dict[tuple[int, ...], float], int]:
    """Return all-different baseline and additive same-component log-odds gains."""
    baseline = 0.0
    pair_count = 0
    for ai, left in enumerate(active):
        for right in active[ai + 1:]:
            p = min(1.0 - 1e-8, max(1e-8, float(probability[left, right])))
            baseline += math.log(max(1e-8, 1.0 - p))
            pair_count += 1

    gains: dict[tuple[int, ...], float] = {}
    for component in components:
        gain = 0.0
        for ai, left in enumerate(component):
            for right in component[ai + 1:]:
                p = min(1.0 - 1e-8, max(1e-8, float(probability[left, right])))
                gain += math.log(p) - math.log(max(1e-8, 1.0 - p))
        gains[component] = gain
    return baseline, gains, pair_count


def joint_partition_general(
    group_logits: torch.Tensor,
    glyph_stroke_embeddings: torch.Tensor,
    stroke_valid: torch.Tensor,
    model,
    *,
    max_group_size: int = 4,
    general_max_strokes: int = 14,
    grouping_temperature: float = 1.0,
    symbol_weight: float = 1.0,
) -> tuple[JointPartitionCandidate, JointPartitionCandidate | None, dict[tuple[int, ...], torch.Tensor]]:
    """Globally optimise a bounded non-contiguous glyph set partition.

    The method is exact within two explicit bounds: candidate glyphs contain at
    most ``max_group_size`` physical strokes and the expression contains at most
    ``general_max_strokes`` active strokes. It returns both the optimum and the
    globally distinct runner-up used for partition-margin abstention.
    """
    if max_group_size < 1:
        raise ValueError("max_group_size must be >= 1")
    if general_max_strokes < 1:
        raise ValueError("general_max_strokes must be >= 1")
    if symbol_weight < 0:
        raise ValueError("symbol_weight must be >= 0")
    if group_logits.ndim != 2:
        raise ValueError("joint_partition_general expects SxS group_logits")
    if glyph_stroke_embeddings.ndim != 2:
        raise ValueError("joint_partition_general expects SxD glyph_stroke_embeddings")
    if stroke_valid.ndim != 1:
        raise ValueError("joint_partition_general expects one-dimensional stroke_valid")
    if model is None or not hasattr(model, "classify_glyph_components"):
        raise ValueError("joint_partition_general requires the trained group-level glyph classifier")

    active = tuple(stroke_valid.bool().nonzero(as_tuple=False).flatten().tolist())
    if not active:
        empty = JointPartitionCandidate((), 0.0, 0.0, 0.0)
        return empty, None, {}
    if len(active) > general_max_strokes:
        raise ValueError(
            f"exact general partition search is bounded to {general_max_strokes} active strokes; "
            f"got {len(active)}. Use the contiguous or auto joint decoder rather than silently approximating."
        )

    probability = _symmetric_probabilities(group_logits, grouping_temperature)
    candidates = _candidate_components(active, max_group_size)
    # Classify all candidate components in one batched head invocation. The
    # model method pools each candidate then executes the MLP as one tensor batch.
    all_logits = model.classify_glyph_components(glyph_stroke_embeddings, candidates)
    if all_logits.ndim != 2 or all_logits.shape[0] != len(candidates):
        raise ValueError("group-level glyph classifier returned an invalid candidate batch")
    component_logits = {component: logits for component, logits in zip(candidates, all_logits)}
    component_logp = {
        component: _safe_real_symbol(logits)[2]
        for component, logits in component_logits.items()
    }

    baseline, pair_gain, pair_count = _pair_terms(probability, active, candidates)
    pair_denom = max(1, pair_count)
    position = {stroke: idx for idx, stroke in enumerate(active)}
    candidate_masks = {component: _component_mask(component, position) for component in candidates}
    by_anchor: dict[int, list[tuple[tuple[int, ...], int]]] = {i: [] for i in range(len(active))}
    for component in candidates:
        mask = candidate_masks[component]
        anchor = min(position[stroke] for stroke in component)
        by_anchor[anchor].append((component, mask))
    for rows in by_anchor.values():
        rows.sort(key=lambda item: (len(item[0]), item[0]))

    full_mask = (1 << len(active)) - 1
    min_groups = (len(active) + max_group_size - 1) // max_group_size
    global_rows: list[JointPartitionCandidate] = []

    for target_groups in range(min_groups, len(active) + 1):
        symbol_factor = symbol_weight / target_groups

        @lru_cache(maxsize=None)
        def solve(used_mask: int, groups_used: int) -> tuple[_SetPartial, ...]:
            if used_mask == full_mask:
                if groups_used == target_groups:
                    return (_SetPartial(0.0, 0.0, 0.0, ()),)
                return ()

            remaining_mask = full_mask ^ used_mask
            remaining_count = remaining_mask.bit_count()
            groups_left = target_groups - groups_used
            if groups_left <= 0:
                return ()
            if remaining_count < groups_left or remaining_count > groups_left * max_group_size:
                return ()

            lowest_bit = remaining_mask & -remaining_mask
            anchor = lowest_bit.bit_length() - 1
            rows: list[_SetPartial] = []
            for component, component_mask in by_anchor[anchor]:
                if component_mask & used_mask:
                    continue
                future = solve(used_mask | component_mask, groups_used + 1)
                if not future:
                    continue
                gain = pair_gain[component]
                symbol = component_logp[component]
                add = gain / pair_denom + symbol_factor * symbol
                for suffix in future:
                    rows.append(_SetPartial(
                        score=add + suffix.score,
                        pair_gain=gain + suffix.pair_gain,
                        symbol_sum=symbol + suffix.symbol_sum,
                        components=(component,) + suffix.components,
                    ))
            return _rank_two(rows)

        for partial in solve(0, 0):
            pair_total = baseline + partial.pair_gain
            global_rows.append(JointPartitionCandidate(
                components=partial.components,
                score=pair_total / pair_denom + symbol_weight * partial.symbol_sum / target_groups,
                pair_score=pair_total / pair_denom if pair_count else 0.0,
                symbol_score=partial.symbol_sum / target_groups,
            ))

    if not global_rows:
        raise RuntimeError("general joint partition search produced no valid partition")
    ranked = sorted(
        global_rows,
        key=lambda row: (row.score, row.symbol_score, row.pair_score, -len(row.components), row.components),
        reverse=True,
    )
    best = ranked[0]
    runner_up = next((row for row in ranked[1:] if row.components != best.components), None)
    return best, runner_up, component_logits


def _decode_from_partition(
    outputs: dict,
    stroke_geometry: torch.Tensor,
    stroke_valid: torch.Tensor,
    *,
    model,
    max_group_size: int,
    general_max_strokes: int,
    grouping_temperature: float,
    symbol_weight: float,
    relation_threshold: float,
    ambiguity_threshold: float,
    partition_margin_threshold: float,
) -> JointStructuralHypothesis:
    symbol_logits = outputs["symbol_logits"]
    group_logits = outputs["group_logits"]
    relation_logits = outputs["relation_logits"]
    glyph_strokes = outputs.get("glyph_stroke_embeddings")
    if glyph_strokes is None:
        raise ValueError("general joint decoder requires glyph_stroke_embeddings")
    if symbol_logits.ndim == 3:
        if symbol_logits.shape[0] != 1:
            raise ValueError("decode_structural_output_joint_general expects one example")
        symbol_logits = symbol_logits[0]
        group_logits = group_logits[0]
        relation_logits = relation_logits[0]
        glyph_strokes = glyph_strokes[0]
    if stroke_geometry.ndim == 3:
        stroke_geometry = stroke_geometry[0]
    if stroke_valid.ndim == 2:
        stroke_valid = stroke_valid[0]

    best, runner_up, component_cache = joint_partition_general(
        group_logits,
        glyph_strokes,
        stroke_valid,
        model,
        max_group_size=max_group_size,
        general_max_strokes=general_max_strokes,
        grouping_temperature=grouping_temperature,
        symbol_weight=symbol_weight,
    )
    components = list(best.components)
    component_logits = torch.stack([component_cache[c] for c in components]) if components else symbol_logits.new_zeros((0, symbol_logits.shape[-1]))
    glyphs = _glyphs(symbol_logits, stroke_geometry, components, component_logits)
    relations, relation_confidence = _relations(relation_logits, components, relation_threshold)
    ast, warnings = _build_ast(glyphs, relations)

    probability = _symmetric_probabilities(group_logits, grouping_temperature)
    active = tuple(stroke_valid.bool().nonzero(as_tuple=False).flatten().tolist())
    grouping_confidence = _decision_confidence(probability, active, best.components)
    symbol_confidence = min((glyph.symbol_confidence for glyph in glyphs), default=0.0)
    confidence = min(symbol_confidence, grouping_confidence, relation_confidence)
    margin = math.inf if runner_up is None else max(0.0, best.score - runner_up.score)
    if partition_margin_threshold > 0 and margin < partition_margin_threshold:
        warnings.append(
            f"joint partition margin {margin:.6f} below threshold {partition_margin_threshold:.6f}"
        )
    ambiguous = confidence < ambiguity_threshold or bool(warnings)
    return JointStructuralHypothesis(
        glyphs=glyphs,
        relations=relations,
        ast=ast,
        canonical=ast.canonical(),
        confidence=confidence,
        symbol_confidence=symbol_confidence,
        grouping_confidence=grouping_confidence,
        relation_confidence=relation_confidence,
        ambiguous=ambiguous,
        warnings=warnings,
        partition_score=best.score,
        partition_margin=margin,
        partition_pair_score=best.pair_score,
        partition_symbol_score=best.symbol_score,
        decoder="joint-general-v1",
    )


def decode_structural_output_joint_general(
    outputs: dict,
    stroke_geometry: torch.Tensor,
    stroke_valid: torch.Tensor,
    *,
    model,
    max_group_size: int = 4,
    general_max_strokes: int = 14,
    grouping_temperature: float = 1.0,
    symbol_weight: float = 1.0,
    relation_threshold: float = 0.60,
    ambiguity_threshold: float = 0.80,
    partition_margin_threshold: float = 0.0,
) -> JointStructuralHypothesis:
    """Decode with exact non-contiguous set partitioning within the stroke bound."""
    if partition_margin_threshold < 0:
        raise ValueError("partition_margin_threshold must be >= 0")
    return _decode_from_partition(
        outputs,
        stroke_geometry,
        stroke_valid,
        model=model,
        max_group_size=max_group_size,
        general_max_strokes=general_max_strokes,
        grouping_temperature=grouping_temperature,
        symbol_weight=symbol_weight,
        relation_threshold=relation_threshold,
        ambiguity_threshold=ambiguity_threshold,
        partition_margin_threshold=partition_margin_threshold,
    )


def decode_structural_output_joint_auto(
    outputs: dict,
    stroke_geometry: torch.Tensor,
    stroke_valid: torch.Tensor,
    *,
    model,
    max_group_size: int = 4,
    general_max_strokes: int = 14,
    grouping_temperature: float = 1.0,
    symbol_weight: float = 1.0,
    relation_threshold: float = 0.60,
    ambiguity_threshold: float = 0.80,
    partition_margin_threshold: float = 0.0,
) -> JointStructuralHypothesis:
    """Use exact general search when tractable, otherwise exact contiguous DP.

    The fallback is explicit in ``hypothesis.decoder`` so evaluation never mixes
    search regimes invisibly.
    """
    valid = stroke_valid[0] if stroke_valid.ndim == 2 else stroke_valid
    active_count = int(valid.bool().sum())
    if active_count <= general_max_strokes:
        hyp = decode_structural_output_joint_general(
            outputs,
            stroke_geometry,
            stroke_valid,
            model=model,
            max_group_size=max_group_size,
            general_max_strokes=general_max_strokes,
            grouping_temperature=grouping_temperature,
            symbol_weight=symbol_weight,
            relation_threshold=relation_threshold,
            ambiguity_threshold=ambiguity_threshold,
            partition_margin_threshold=partition_margin_threshold,
        )
        hyp.decoder = "joint-auto-v1:general"
        return hyp
    hyp = decode_structural_output_joint(
        outputs,
        stroke_geometry,
        stroke_valid,
        model=model,
        max_group_size=max_group_size,
        grouping_temperature=grouping_temperature,
        symbol_weight=symbol_weight,
        relation_threshold=relation_threshold,
        ambiguity_threshold=ambiguity_threshold,
        partition_margin_threshold=partition_margin_threshold,
    )
    hyp.decoder = "joint-auto-v1:contiguous"
    return hyp
