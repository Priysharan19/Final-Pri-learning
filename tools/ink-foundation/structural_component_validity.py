"""Context-aware candidate-component rejection for Pri Ink Structural V4.

Joint partition search deliberately scores many candidate stroke groups that were
never presented to the glyph classifier as positive training examples. A closed-
set symbol classifier can therefore be confidently wrong on malformed groups.

This module adds a separately trained validity calibrator rather than changing the
base V4 checkpoint. The calibrator sees local glyph-shape pooling, contextual
structural pooling, and an expression summary. It learns whether a proposed group
is a *complete glyph in this expression*.

V2 fixes a calibration failure exposed by the first end-to-end smoke. V1 multiplied
every candidate's real-symbol probability by raw validity, so even plausible groups
were unnecessarily suppressed. V2 is conservative: candidates with non-negative
validity logits are untouched; only explicit rejects are assigned <unk> mass. The
training loss also includes a pairwise margin-ranking term so true components must
outrank mined malformed candidates instead of merely landing on the correct side
of an independently calibrated binary threshold.

The auxiliary checkpoint is cryptographically tied to one base V4 checkpoint.
Transfer to a different fine-tuned base must be explicit during training, and an
evaluator must reject a mismatched base hash. Synthetic or same-writer results are
research evidence only and never promote handwriting to production.
"""
from __future__ import annotations

from dataclasses import dataclass
from itertools import combinations
import hashlib
from pathlib import Path

import torch
from torch import nn
import torch.nn.functional as F

from data import UNK_ID
from structural_data import IGNORE_INDEX


COMPONENT_VALIDITY_VERSION = 2
COMPONENT_VALIDITY_OBJECTIVE = "contextual-hard-negative-ranking-validity-v2"
VALIDITY_RANK_MARGIN = 0.75
VALIDITY_RANK_WEIGHT = 0.35
VALIDITY_REJECT_THRESHOLD_LOGIT = 0.0


def checkpoint_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def recover_true_components(
    symbol_targets: torch.Tensor,
    group_targets: torch.Tensor,
) -> list[tuple[int, ...]]:
    """Recover complete ground-truth glyph components from explicit pair labels."""
    active = [int(i) for i in symbol_targets.ne(IGNORE_INDEX).nonzero(as_tuple=False).flatten()]
    remaining = set(active)
    components: list[tuple[int, ...]] = []
    while remaining:
        seed = min(remaining)
        remaining.remove(seed)
        members = {seed}
        frontier = [seed]
        while frontier:
            left = frontier.pop()
            neighbours = []
            for right in list(remaining):
                same = bool(group_targets[left, right].gt(0.5)) or bool(
                    group_targets[right, left].gt(0.5)
                )
                if same:
                    neighbours.append(right)
            for right in neighbours:
                remaining.remove(right)
                members.add(right)
                frontier.append(right)
        components.append(tuple(sorted(members)))
    return sorted(components, key=lambda c: (min(c), len(c), c))


def _symmetric_group_probability(group_logits: torch.Tensor) -> torch.Tensor:
    prob = group_logits.sigmoid()
    return 0.5 * (prob + prob.transpose(0, 1))


def _mean_pair_probability(prob: torch.Tensor, component: tuple[int, ...]) -> float:
    values = [
        float(prob[left, right])
        for ai, left in enumerate(component)
        for right in component[ai + 1 :]
    ]
    return sum(values) / len(values) if values else 1.0


def _max_cross_probability(
    prob: torch.Tensor,
    left: tuple[int, ...],
    right: tuple[int, ...],
) -> float:
    values = [float(prob[i, j]) for i in left for j in right]
    return max(values, default=0.0)


def mine_invalid_components(
    true_components: list[tuple[int, ...]],
    group_logits: torch.Tensor,
    *,
    max_group_size: int = 4,
    max_negatives: int = 32,
) -> list[tuple[int, ...]]:
    """Mine deterministic context-dependent invalid glyph candidates.

    Negatives target the actual joint-search failure modes:
      * proper subsets of a multi-stroke true glyph (premature split),
      * full neighbouring glyph merges,
      * true glyph plus an intruder stroke,
      * high-scoring cross-glyph stroke pairs.

    Proper subsets are valid *shapes* in some other context (one line of '=' can
    look like '-'), which is why the validity head also consumes contextual
    structural embeddings. The label means "not a complete glyph here", not
    "this shape can never be a glyph".
    """
    if max_group_size < 1:
        raise ValueError("max_group_size must be >= 1")
    if max_negatives < 1:
        raise ValueError("max_negatives must be >= 1")
    if group_logits.ndim != 2:
        raise ValueError("mine_invalid_components expects SxS group_logits")

    truth = [tuple(sorted(int(i) for i in comp)) for comp in true_components if comp]
    positive = set(truth)
    owner = {stroke: gi for gi, comp in enumerate(truth) for stroke in comp}
    active = tuple(sorted(owner))
    probability = _symmetric_group_probability(group_logits)

    # candidate -> (semantic priority, model hardness)
    scored: dict[tuple[int, ...], tuple[float, float]] = {}

    def add(candidate, priority: float, hardness: float):
        key = tuple(sorted(set(int(i) for i in candidate)))
        if not key or len(key) > max_group_size or key in positive:
            return
        if any(i not in owner for i in key):
            return
        previous = scored.get(key)
        score = (priority, hardness)
        if previous is None or score > previous:
            scored[key] = score

    # 1) Premature splits: every proper subset of a true multi-stroke glyph.
    for comp in truth:
        if len(comp) <= 1:
            continue
        for size in range(1, min(len(comp) - 1, max_group_size) + 1):
            for subset in combinations(comp, size):
                add(subset, 4.0, _mean_pair_probability(probability, tuple(subset)))

    # 2) Whole-glyph false merges.
    for ai, left in enumerate(truth):
        for right in truth[ai + 1 :]:
            merged = tuple(sorted(left + right))
            if len(merged) <= max_group_size:
                add(merged, 3.0, _max_cross_probability(probability, left, right))

    # 3) A plausible glyph plus one foreign stroke. This catches delayed dots,
    # crossbars and false bridges without generating an exponential candidate set.
    for comp in truth:
        if len(comp) >= max_group_size:
            continue
        for stroke in active:
            if stroke in comp:
                continue
            intruder = (stroke,)
            add(comp + intruder, 2.5, _max_cross_probability(probability, comp, intruder))

    # 4) Highest model-scoring cross-glyph pairs provide online hard negatives.
    for ai, left in enumerate(active):
        for right in active[ai + 1 :]:
            if owner[left] == owner[right]:
                continue
            add((left, right), 2.0, float(probability[left, right]))

    ranked = sorted(
        scored.items(),
        key=lambda item: (item[1][0], item[1][1], -len(item[0]), tuple(-i for i in item[0])),
        reverse=True,
    )
    return [component for component, _ in ranked[:max_negatives]]


class ComponentValidityHead(nn.Module):
    """Score whether a proposed stroke set is a complete glyph in context."""

    def __init__(self, d_model: int):
        super().__init__()
        self.d_model = int(d_model)
        # local glyph mean/max + count = 2D+1
        # contextual structural mean/max + expression mean = 3D
        input_dim = self.d_model * 5 + 1
        hidden = max(128, self.d_model)
        tail = max(64, self.d_model // 2)
        self.net = nn.Sequential(
            nn.Linear(input_dim, hidden),
            nn.GELU(),
            nn.LayerNorm(hidden),
            nn.Dropout(0.10),
            nn.Linear(hidden, tail),
            nn.GELU(),
            nn.Linear(tail, 1),
        )

    def _features(
        self,
        glyph_strokes: torch.Tensor,
        structural_strokes: torch.Tensor,
        stroke_valid: torch.Tensor,
        components: list[tuple[int, ...] | list[int]],
    ) -> torch.Tensor:
        if glyph_strokes.ndim != 2 or structural_strokes.ndim != 2:
            raise ValueError("component validity expects SxD stroke embeddings")
        if glyph_strokes.shape != structural_strokes.shape:
            raise ValueError("glyph and structural embeddings must have identical shape")
        if glyph_strokes.shape[-1] != self.d_model:
            raise ValueError(
                f"component validity expected d_model={self.d_model}, got {glyph_strokes.shape[-1]}"
            )
        if stroke_valid.ndim != 1 or stroke_valid.shape[0] != glyph_strokes.shape[0]:
            raise ValueError("component validity expects one-dimensional stroke_valid")

        active = stroke_valid.bool().nonzero(as_tuple=False).flatten()
        if active.numel():
            expression_mean = structural_strokes.index_select(0, active).mean(dim=0)
        else:
            expression_mean = structural_strokes.new_zeros((self.d_model,))

        rows = []
        for component in components:
            members = [int(i) for i in component]
            if not members:
                raise ValueError("component validity candidate cannot be empty")
            if any(
                i < 0 or i >= glyph_strokes.shape[0] or not bool(stroke_valid[i])
                for i in members
            ):
                raise ValueError(f"component validity candidate references inactive stroke: {members}")
            idx = torch.tensor(members, device=glyph_strokes.device, dtype=torch.long)
            local = glyph_strokes.index_select(0, idx)
            context = structural_strokes.index_select(0, idx)
            local_mean = local.mean(dim=0)
            local_max = local.max(dim=0).values
            context_mean = context.mean(dim=0)
            context_max = context.max(dim=0).values
            count = glyph_strokes.new_tensor([min(len(members), 6) / 6.0])
            rows.append(torch.cat([
                local_mean,
                local_max,
                count,
                context_mean,
                context_max,
                expression_mean,
            ], dim=0))
        if not rows:
            return glyph_strokes.new_zeros((0, self.d_model * 5 + 1))
        return torch.stack(rows, dim=0)

    def forward(
        self,
        glyph_strokes: torch.Tensor,
        structural_strokes: torch.Tensor,
        stroke_valid: torch.Tensor,
        components: list[tuple[int, ...] | list[int]],
    ) -> torch.Tensor:
        features = self._features(
            glyph_strokes, structural_strokes, stroke_valid, components
        )
        if features.shape[0] == 0:
            return features.new_zeros((0,))
        return self.net(features).squeeze(-1)


@dataclass(frozen=True)
class ValidityBatch:
    positive_logits: torch.Tensor
    negative_logits: torch.Tensor
    positive_count: int
    negative_count: int


def score_supervised_components(
    scorer: ComponentValidityHead,
    outputs: dict,
    batch: dict,
    *,
    device: torch.device,
    max_group_size: int = 4,
    max_negatives: int = 32,
) -> ValidityBatch:
    """Score true and mined-invalid components for one training/eval batch."""
    symbols = batch["symbol_targets"].to(device)
    groups = batch["group_targets"].to(device)
    stroke_valid = batch["stroke_valid"].to(device)
    glyph_embeddings = outputs["glyph_stroke_embeddings"]
    structural_embeddings = outputs["stroke_embeddings"]
    group_logits = outputs["group_logits"]

    pos_parts = []
    neg_parts = []
    for bi in range(symbols.shape[0]):
        truth = recover_true_components(symbols[bi], groups[bi])
        if truth:
            pos_parts.append(scorer(
                glyph_embeddings[bi], structural_embeddings[bi], stroke_valid[bi], truth
            ))
        negatives = mine_invalid_components(
            truth,
            group_logits[bi].detach(),
            max_group_size=max_group_size,
            max_negatives=max_negatives,
        )
        if negatives:
            neg_parts.append(scorer(
                glyph_embeddings[bi], structural_embeddings[bi], stroke_valid[bi], negatives
            ))

    zero = glyph_embeddings.sum() * 0.0
    positive = torch.cat(pos_parts) if pos_parts else zero.reshape(1)[:0]
    negative = torch.cat(neg_parts) if neg_parts else zero.reshape(1)[:0]
    return ValidityBatch(
        positive_logits=positive,
        negative_logits=negative,
        positive_count=int(positive.numel()),
        negative_count=int(negative.numel()),
    )


def balanced_validity_loss(batch: ValidityBatch) -> torch.Tensor:
    """Balanced binary calibration plus a true-vs-hard-negative rank margin."""
    parts = []
    if batch.positive_count:
        parts.append(F.binary_cross_entropy_with_logits(
            batch.positive_logits, torch.ones_like(batch.positive_logits)
        ))
    if batch.negative_count:
        parts.append(F.binary_cross_entropy_with_logits(
            batch.negative_logits, torch.zeros_like(batch.negative_logits)
        ))
    if not parts:
        return batch.positive_logits.sum() + batch.negative_logits.sum()

    binary = sum(parts) / len(parts)
    if not batch.positive_count or not batch.negative_count:
        return binary

    # Smooth AUC surrogate: every true component should beat every mined hard
    # negative by a useful logit margin. Batch sizes are intentionally bounded by
    # max_negatives, so this dense comparison is small while directly optimizing
    # the ordering that joint partition search consumes.
    difference = (
        batch.positive_logits[:, None] - batch.negative_logits[None, :]
    )
    ranking = F.softplus(VALIDITY_RANK_MARGIN - difference).mean()
    return binary + VALIDITY_RANK_WEIGHT * ranking


def inject_invalid_probability_mass(
    symbol_logits: torch.Tensor,
    validity_logits: torch.Tensor,
    *,
    weight: float = 1.0,
) -> torch.Tensor:
    """Move only explicitly rejected candidate mass to <unk>.

    V2 uses a conservative reject-only policy. A candidate with validity logit
    >= 0 is left exactly unchanged. For a rejected candidate, real-symbol mass is
    multiplied by exp(weight * logit) (logit is negative), and the removed mass
    moves to <unk>. Therefore exact joint search receives the additive penalty
    ``weight * min(0, validity_logit)`` without depressing plausible candidates.
    Symbol ranking inside the base closed-set classifier is never changed.
    """
    if weight < 0:
        raise ValueError("component validity weight must be >= 0")
    if symbol_logits.ndim != 2 or validity_logits.ndim != 1:
        raise ValueError("invalid-mass injection expects NxV logits and N validity logits")
    if symbol_logits.shape[0] != validity_logits.shape[0]:
        raise ValueError("symbol and validity candidate counts do not match")
    if weight == 0 or symbol_logits.shape[0] == 0:
        return symbol_logits

    base = F.softmax(symbol_logits, dim=-1)
    rejection = F.relu(VALIDITY_REJECT_THRESHOLD_LOGIT - validity_logits)
    retained = torch.exp(-weight * rejection).clamp(1e-6, 1.0)
    calibrated = base * retained.unsqueeze(-1)
    calibrated[:, UNK_ID] = calibrated[:, UNK_ID] + (1.0 - retained)
    calibrated = calibrated / calibrated.sum(dim=-1, keepdim=True).clamp_min(1e-8)
    return calibrated.clamp_min(1e-8).log()


class ValidityAugmentedGlyphModel:
    """Per-expression adapter that injects learned validity into glyph evidence."""

    def __init__(
        self,
        base_model,
        scorer: ComponentValidityHead,
        structural_strokes: torch.Tensor,
        stroke_valid: torch.Tensor,
        *,
        validity_weight: float = 1.0,
    ):
        if structural_strokes.ndim == 3:
            if structural_strokes.shape[0] != 1:
                raise ValueError("validity adapter expects one expression")
            structural_strokes = structural_strokes[0]
        if stroke_valid.ndim == 2:
            if stroke_valid.shape[0] != 1:
                raise ValueError("validity adapter expects one expression")
            stroke_valid = stroke_valid[0]
        self.base_model = base_model
        self.scorer = scorer
        self.structural_strokes = structural_strokes
        self.stroke_valid = stroke_valid.bool()
        self.validity_weight = float(validity_weight)

    def classify_glyph_components(self, glyph_strokes, components):
        base_logits = self.base_model.classify_glyph_components(glyph_strokes, components)
        validity_logits = self.scorer(
            glyph_strokes,
            self.structural_strokes,
            self.stroke_valid,
            components,
        )
        return inject_invalid_probability_mass(
            base_logits, validity_logits, weight=self.validity_weight
        )


def load_component_validity_checkpoint(
    path: Path,
    *,
    base_checkpoint_path: Path,
    d_model: int,
    device: torch.device,
) -> tuple[ComponentValidityHead, dict]:
    """Load a validity calibrator only when it matches the exact base checkpoint."""
    ckpt = torch.load(path, map_location="cpu", weights_only=False)
    if int(ckpt.get("component_validity_version", 0)) != COMPONENT_VALIDITY_VERSION:
        raise ValueError(f"unsupported component validity checkpoint: {path}")
    if ckpt.get("production_ready") is not False:
        raise ValueError("component validity research checkpoint cannot claim production readiness")
    expected_hash = checkpoint_sha256(base_checkpoint_path)
    actual_hash = str(ckpt.get("base_checkpoint_sha256", ""))
    if actual_hash != expected_hash:
        raise ValueError(
            "component validity checkpoint is tied to a different base V4 checkpoint: "
            f"expected {expected_hash}, got {actual_hash or '<missing>'}"
        )
    if int(ckpt.get("d_model", 0)) != int(d_model):
        raise ValueError("component validity d_model does not match base V4 model")
    if ckpt.get("objective") != COMPONENT_VALIDITY_OBJECTIVE:
        raise ValueError("component validity objective metadata is missing or stale")
    scorer = ComponentValidityHead(d_model)
    scorer.load_state_dict(ckpt["model"], strict=True)
    scorer.to(device).eval()
    return scorer, ckpt
