"""Symbol-aware joint glyph partitioning for Pri Ink Structural V4.

This research decoder fixes a concrete mismatch in the original V4 inference path:
training learns a true group-level glyph classifier, while the legacy decoder first
commits to pairwise complete-link grouping and only then asks what each group is.
A wrong pairwise boundary therefore cannot be repaired by strong symbol evidence.

The joint decoder searches bounded contiguous draw-order partitions and scores each
candidate with two independent model signals:

  1. calibrated same-glyph / different-glyph pair likelihood for every stroke pair;
  2. the trained group-level glyph likelihood for every proposed component.

For a fixed number of glyphs the objective factorises exactly, so dynamic
programming finds the global optimum without exponential partition enumeration.
The search is deterministic and inspectable. It remains a V4 research path: a
contiguous draw-order assumption is explicit, parameters are not production
calibration, and no result from this module can bypass writer-disjoint evidence.
"""
from __future__ import annotations

from dataclasses import dataclass
import math

import torch
import torch.nn.functional as F

from data import ID_TO_TOKEN, SPECIAL
from structural_decode import (
    StructuralHypothesis,
    _build_ast,
    _glyphs,
    _relations,
)


@dataclass(frozen=True)
class JointPartitionCandidate:
    """One fully-scored stroke partition."""

    components: tuple[tuple[int, ...], ...]
    score: float
    pair_score: float
    symbol_score: float


@dataclass
class JointStructuralHypothesis(StructuralHypothesis):
    """Structural hypothesis with inspectable joint-partition diagnostics."""

    partition_score: float = 0.0
    partition_margin: float = 0.0
    partition_pair_score: float = 0.0
    partition_symbol_score: float = 0.0
    decoder: str = "joint-contiguous-v1"


@dataclass(frozen=True)
class _Partial:
    score: float
    pair_sum: float
    symbol_sum: float
    components: tuple[tuple[int, ...], ...]


def _safe_real_symbol(logits: torch.Tensor) -> tuple[str, float, float]:
    probs = F.softmax(logits, dim=-1)
    for idx in probs.argsort(descending=True).tolist():
        token = ID_TO_TOKEN.get(int(idx), "<unk>")
        if token not in SPECIAL:
            probability = float(probs[idx])
            return token, probability, math.log(max(1e-8, probability))
    return "<unk>", 0.0, math.log(1e-8)


def _symmetric_probabilities(group_logits: torch.Tensor, temperature: float) -> torch.Tensor:
    if temperature <= 0:
        raise ValueError("grouping_temperature must be > 0")
    calibrated = torch.sigmoid(group_logits / temperature)
    return 0.5 * (calibrated + calibrated.transpose(0, 1))


def _top_two(candidates: list[_Partial]) -> list[_Partial]:
    """Keep the two highest-scoring distinct partitions deterministically."""
    best: dict[tuple[tuple[int, ...], ...], _Partial] = {}
    for row in candidates:
        previous = best.get(row.components)
        if previous is None or (row.score, row.pair_sum, row.symbol_sum) > (
            previous.score, previous.pair_sum, previous.symbol_sum
        ):
            best[row.components] = row
    return sorted(
        best.values(),
        key=lambda x: (x.score, x.symbol_sum, x.pair_sum, tuple(-i for c in x.components for i in c)),
        reverse=True,
    )[:2]


def _pair_increment(
    probability: torch.Tensor,
    active: tuple[int, ...],
    start: int,
    end: int,
) -> float:
    """Pair log-likelihood introduced by assigning active[start:end] one glyph.

    All earlier strokes are necessarily in previous glyphs, so their cross pairs
    contribute different-glyph likelihood. Internal pairs contribute same-glyph
    likelihood. Across a complete left-to-right partition this counts every
    unordered stroke pair exactly once.
    """
    component = active[start:end]
    previous = active[:start]
    total = 0.0
    for ai, left in enumerate(component):
        for right in component[ai + 1 :]:
            total += math.log(max(1e-8, float(probability[left, right])))
    for left in previous:
        for right in component:
            total += math.log(max(1e-8, 1.0 - float(probability[left, right])))
    return total


def _decision_confidence(
    probability: torch.Tensor,
    active: tuple[int, ...],
    components: tuple[tuple[int, ...], ...],
) -> float:
    owner = {stroke: gi for gi, component in enumerate(components) for stroke in component}
    decisions = []
    for ai, left in enumerate(active):
        for right in active[ai + 1 :]:
            p = float(probability[left, right])
            decisions.append(p if owner[left] == owner[right] else 1.0 - p)
    return min(decisions, default=1.0)


def joint_partition(
    group_logits: torch.Tensor,
    glyph_stroke_embeddings: torch.Tensor,
    stroke_valid: torch.Tensor,
    model,
    *,
    max_group_size: int = 4,
    grouping_temperature: float = 1.0,
    symbol_weight: float = 1.0,
) -> tuple[JointPartitionCandidate, JointPartitionCandidate | None, dict[tuple[int, ...], torch.Tensor]]:
    """Return the best and runner-up bounded contiguous partitions.

    The score exactly matches an average all-pairs grouping log-likelihood plus
    ``symbol_weight`` times average group-level symbol log-likelihood. The pair
    denominator is constant for a sample. For each possible glyph count K, the
    symbol denominator K is also fixed, allowing an exact DP rather than a beam
    approximation.
    """
    if max_group_size < 1:
        raise ValueError("max_group_size must be >= 1")
    if symbol_weight < 0:
        raise ValueError("symbol_weight must be >= 0")
    if group_logits.ndim != 2:
        raise ValueError("joint_partition expects SxS group_logits")
    if glyph_stroke_embeddings.ndim != 2:
        raise ValueError("joint_partition expects SxD glyph_stroke_embeddings")
    if stroke_valid.ndim != 1:
        raise ValueError("joint_partition expects one-dimensional stroke_valid")
    if model is None or not hasattr(model, "classify_glyph_components"):
        raise ValueError("joint_partition requires the trained group-level glyph classifier")

    active = tuple(stroke_valid.bool().nonzero(as_tuple=False).flatten().tolist())
    if not active:
        empty = JointPartitionCandidate((), 0.0, 0.0, 0.0)
        return empty, None, {}

    n = len(active)
    pair_count = n * (n - 1) // 2
    pair_denom = max(1, pair_count)
    probability = _symmetric_probabilities(group_logits, grouping_temperature).clamp(1e-8, 1 - 1e-8)

    component_logits: dict[tuple[int, ...], torch.Tensor] = {}
    component_logp: dict[tuple[int, ...], float] = {}
    pair_increment: dict[tuple[int, int], float] = {}
    for start in range(n):
        for end in range(start + 1, min(n, start + max_group_size) + 1):
            component = tuple(active[start:end])
            logits = model.classify_glyph_components(glyph_stroke_embeddings, [component])[0]
            component_logits[component] = logits
            _, _, logp = _safe_real_symbol(logits)
            component_logp[component] = logp
            pair_increment[(start, end)] = _pair_increment(probability, active, start, end)

    global_candidates: list[JointPartitionCandidate] = []
    min_groups = (n + max_group_size - 1) // max_group_size
    for target_groups in range(min_groups, n + 1):
        # dp[(end, groups_used)] -> two best partial partitions. Keeping two is
        # enough to recover a meaningful global runner-up for margin diagnostics.
        dp: dict[tuple[int, int], list[_Partial]] = {
            (0, 0): [_Partial(0.0, 0.0, 0.0, ())]
        }
        symbol_factor = symbol_weight / target_groups
        for end in range(1, n + 1):
            max_used = min(target_groups, end)
            for used in range(1, max_used + 1):
                rows: list[_Partial] = []
                for size in range(1, min(max_group_size, end) + 1):
                    start = end - size
                    previous_rows = dp.get((start, used - 1), ())
                    if not previous_rows:
                        continue
                    # Enough strokes must remain / have been consumed to realise
                    # exactly target_groups under max_group_size.
                    remaining = n - end
                    groups_left = target_groups - used
                    if remaining < groups_left or remaining > groups_left * max_group_size:
                        continue
                    component = tuple(active[start:end])
                    pair_add = pair_increment[(start, end)]
                    symbol_add = component_logp[component]
                    score_add = pair_add / pair_denom + symbol_factor * symbol_add
                    for previous in previous_rows:
                        rows.append(_Partial(
                            score=previous.score + score_add,
                            pair_sum=previous.pair_sum + pair_add,
                            symbol_sum=previous.symbol_sum + symbol_add,
                            components=previous.components + (component,),
                        ))
                if rows:
                    dp[(end, used)] = _top_two(rows)

        for partial in dp.get((n, target_groups), ()):
            global_candidates.append(JointPartitionCandidate(
                components=partial.components,
                score=partial.score,
                pair_score=partial.pair_sum / pair_denom if pair_count else 0.0,
                symbol_score=partial.symbol_sum / target_groups,
            ))

    if not global_candidates:
        raise RuntimeError("joint partition search produced no valid partition")

    ranked = sorted(
        global_candidates,
        key=lambda x: (x.score, x.symbol_score, x.pair_score, -len(x.components)),
        reverse=True,
    )
    best = ranked[0]
    runner_up = next((row for row in ranked[1:] if row.components != best.components), None)
    return best, runner_up, component_logits


def decode_structural_output_joint(
    outputs: dict,
    stroke_geometry: torch.Tensor,
    stroke_valid: torch.Tensor,
    *,
    model,
    max_group_size: int = 4,
    grouping_temperature: float = 1.0,
    symbol_weight: float = 1.0,
    relation_threshold: float = 0.60,
    ambiguity_threshold: float = 0.80,
    partition_margin_threshold: float = 0.0,
) -> JointStructuralHypothesis:
    """Decode one V4 output with joint grouping + glyph identity search."""
    if partition_margin_threshold < 0:
        raise ValueError("partition_margin_threshold must be >= 0")

    symbol_logits = outputs["symbol_logits"]
    group_logits = outputs["group_logits"]
    relation_logits = outputs["relation_logits"]
    glyph_strokes = outputs.get("glyph_stroke_embeddings")
    if glyph_strokes is None:
        raise ValueError("joint decoder requires glyph_stroke_embeddings")

    if symbol_logits.ndim == 3:
        if symbol_logits.shape[0] != 1:
            raise ValueError("decode_structural_output_joint expects one example")
        symbol_logits = symbol_logits[0]
        group_logits = group_logits[0]
        relation_logits = relation_logits[0]
        glyph_strokes = glyph_strokes[0]
    if stroke_geometry.ndim == 3:
        stroke_geometry = stroke_geometry[0]
    if stroke_valid.ndim == 2:
        stroke_valid = stroke_valid[0]

    best, runner_up, component_cache = joint_partition(
        group_logits,
        glyph_strokes,
        stroke_valid,
        model,
        max_group_size=max_group_size,
        grouping_temperature=grouping_temperature,
        symbol_weight=symbol_weight,
    )
    components = list(best.components)
    if components:
        logits = torch.stack([component_cache[c] for c in components])
    else:
        logits = symbol_logits.new_zeros((0, symbol_logits.shape[-1]))
    glyphs = _glyphs(symbol_logits, stroke_geometry, components, logits)
    relations, relation_confidence = _relations(relation_logits, components, relation_threshold)
    ast, warnings = _build_ast(glyphs, relations)
    canonical = ast.canonical()

    probability = _symmetric_probabilities(group_logits, grouping_temperature).clamp(1e-8, 1 - 1e-8)
    active = tuple(stroke_valid.bool().nonzero(as_tuple=False).flatten().tolist())
    grouping_confidence = _decision_confidence(probability, active, best.components)
    symbol_confidence = min((g.symbol_confidence for g in glyphs), default=0.0)
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
        canonical=canonical,
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
    )
