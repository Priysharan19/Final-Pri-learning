"""Pooled glyph-to-glyph relation reasoning for Pri Ink Structural V4.

The base V4 relation head is stroke-pair based because grouping and relations were
introduced together. Structural annotations, however, define relations between
complete glyphs. Inference therefore used the first physical stroke of each
predicted glyph as a proxy relation node. That is an avoidable representation
mismatch for multi-stroke glyphs such as '=', 'x', radicals and delayed marks.

This module adds a separately trained, hash-bound group-relation head. It pools all
structural stroke embeddings in each proposed glyph, computes union glyph geometry,
and predicts directed mathematical relations between pooled glyph nodes. The base
V4 checkpoint is frozen and unchanged so root-stroke vs pooled-group relations can
be A/B tested on exactly the same grouping/symbol model.

Research only. Synthetic and same-writer results are never production evidence.
"""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import torch
from torch import nn
import torch.nn.functional as F

from structural import RELATIONS, RELATION_TO_ID
from structural_component_validity import checkpoint_sha256, recover_true_components
from structural_data import IGNORE_INDEX
from structural_decode import RelationHypothesis, _build_ast


GROUP_RELATION_VERSION = 1
GROUP_RELATION_OBJECTIVE = "pooled-glyph-directed-relations-v1"
GROUP_RELATION_DECODER = "pooled-group-relations-v1"


def component_union_geometry(
    stroke_geometry: torch.Tensor,
    components: list[tuple[int, ...] | list[int]],
) -> torch.Tensor:
    """Convert Sx8 stroke geometry into Gx8 complete-glyph geometry."""
    if stroke_geometry.ndim != 2 or stroke_geometry.shape[-1] != 8:
        raise ValueError("component_union_geometry expects Sx8 stroke geometry")
    rows = []
    for component in components:
        members = [int(i) for i in component]
        if not members:
            raise ValueError("group relation component cannot be empty")
        if any(i < 0 or i >= stroke_geometry.shape[0] for i in members):
            raise ValueError(f"group relation component references invalid stroke: {members}")
        idx = torch.tensor(members, device=stroke_geometry.device, dtype=torch.long)
        g = stroke_geometry.index_select(0, idx)
        left = (g[:, 0] - 0.5 * g[:, 2]).min()
        right = (g[:, 0] + 0.5 * g[:, 2]).max()
        top = (g[:, 1] - 0.5 * g[:, 3]).min()
        bottom = (g[:, 1] + 0.5 * g[:, 3]).max()
        width = (right - left).clamp_min(1e-4)
        height = (bottom - top).clamp_min(1e-4)
        cx = 0.5 * (left + right)
        cy = 0.5 * (top + bottom)
        aspect = torch.log1p(width / height.clamp_min(1e-4))
        path = g[:, 5].mean()
        density = g[:, 6].mean()
        order = g[:, 7].mean()
        rows.append(torch.stack([cx, cy, width, height, aspect, path, density, order]))
    if not rows:
        return stroke_geometry.new_zeros((0, 8))
    return torch.stack(rows, dim=0)


class GroupRelationHead(nn.Module):
    """Predict directed relations between complete pooled glyph components."""

    def __init__(self, d_model: int, relation_classes: int = len(RELATIONS)):
        super().__init__()
        self.d_model = int(d_model)
        self.relation_classes = int(relation_classes)
        hidden = max(128, self.d_model)
        pair_embed = max(64, self.d_model // 2)
        self.component_pool = nn.Sequential(
            nn.Linear(self.d_model * 2 + 1, self.d_model),
            nn.GELU(),
            nn.LayerNorm(self.d_model),
        )
        self.left_proj = nn.Linear(self.d_model, pair_embed)
        self.right_proj = nn.Linear(self.d_model, pair_embed)
        self.shared = nn.Sequential(
            nn.Linear(pair_embed * 4 + 8, hidden),
            nn.GELU(),
            nn.LayerNorm(hidden),
            nn.Dropout(0.10),
        )
        self.relation = nn.Linear(hidden, self.relation_classes)

    def _pool_components(
        self,
        structural_strokes: torch.Tensor,
        components: list[tuple[int, ...] | list[int]],
    ) -> torch.Tensor:
        if structural_strokes.ndim != 2 or structural_strokes.shape[-1] != self.d_model:
            raise ValueError(
                f"group relation head expects Sx{self.d_model} structural embeddings"
            )
        rows = []
        for component in components:
            members = [int(i) for i in component]
            if not members:
                raise ValueError("group relation component cannot be empty")
            if any(i < 0 or i >= structural_strokes.shape[0] for i in members):
                raise ValueError(f"group relation component references invalid stroke: {members}")
            idx = torch.tensor(members, device=structural_strokes.device, dtype=torch.long)
            selected = structural_strokes.index_select(0, idx)
            mean = selected.mean(dim=0)
            maximum = selected.max(dim=0).values
            count = structural_strokes.new_tensor([min(len(members), 6) / 6.0])
            rows.append(torch.cat([mean, maximum, count], dim=0))
        if not rows:
            return structural_strokes.new_zeros((0, self.d_model))
        return self.component_pool(torch.stack(rows, dim=0))

    @staticmethod
    def _pair_geometry(geometry: torch.Tensor) -> torch.Tensor:
        left = geometry[:, None, :]
        right = geometry[None, :, :]
        dx = right[..., 0] - left[..., 0]
        dy = right[..., 1] - left[..., 1]
        eps = 1e-4
        log_w_ratio = torch.log((right[..., 2] + eps) / (left[..., 2] + eps))
        log_h_ratio = torch.log((right[..., 3] + eps) / (left[..., 3] + eps))
        left_x1 = left[..., 0] - 0.5 * left[..., 2]
        left_x2 = left[..., 0] + 0.5 * left[..., 2]
        right_x1 = right[..., 0] - 0.5 * right[..., 2]
        right_x2 = right[..., 0] + 0.5 * right[..., 2]
        overlap_x = (
            torch.minimum(left_x2, right_x2) - torch.maximum(left_x1, right_x1)
        ) / torch.minimum(left[..., 2], right[..., 2]).clamp_min(eps)
        left_y1 = left[..., 1] - 0.5 * left[..., 3]
        left_y2 = left[..., 1] + 0.5 * left[..., 3]
        right_y1 = right[..., 1] - 0.5 * right[..., 3]
        right_y2 = right[..., 1] + 0.5 * right[..., 3]
        overlap_y = (
            torch.minimum(left_y2, right_y2) - torch.maximum(left_y1, right_y1)
        ) / torch.minimum(left[..., 3], right[..., 3]).clamp_min(eps)
        order_delta = right[..., 7] - left[..., 7]
        distance = torch.sqrt(dx.square() + dy.square() + eps)
        return torch.stack([
            dx,
            dy,
            log_w_ratio.clamp(-4.0, 4.0),
            log_h_ratio.clamp(-4.0, 4.0),
            overlap_x.clamp(-2.0, 2.0),
            overlap_y.clamp(-2.0, 2.0),
            order_delta,
            distance.clamp(0.0, 4.0),
        ], dim=-1)

    def forward(
        self,
        structural_strokes: torch.Tensor,
        stroke_geometry: torch.Tensor,
        components: list[tuple[int, ...] | list[int]],
    ) -> torch.Tensor:
        pooled = self._pool_components(structural_strokes, components)
        geometry = component_union_geometry(stroke_geometry, components)
        g = pooled.shape[0]
        if g == 0:
            return pooled.new_zeros((0, 0, self.relation_classes))
        left = self.left_proj(pooled)[:, None, :].expand(-1, g, -1)
        right = self.right_proj(pooled)[None, :, :].expand(g, -1, -1)
        pair = torch.cat([
            left,
            right,
            left - right,
            left * right,
            self._pair_geometry(geometry),
        ], dim=-1)
        return self.relation(self.shared(pair))


def group_relation_targets(
    relation_targets: torch.Tensor,
    components: list[tuple[int, ...] | list[int]],
) -> torch.Tensor:
    """Lift existing root-stroke labels to their true glyph-group nodes."""
    if relation_targets.ndim != 2:
        raise ValueError("group_relation_targets expects SxS relation targets")
    g = len(components)
    out = torch.full(
        (g, g),
        IGNORE_INDEX,
        device=relation_targets.device,
        dtype=torch.long,
    )
    roots = []
    for component in components:
        members = sorted(int(i) for i in component)
        if not members:
            raise ValueError("group relation target component cannot be empty")
        roots.append(members[0])
    for si, src in enumerate(roots):
        for ti, dst in enumerate(roots):
            if si == ti:
                continue
            target = int(relation_targets[src, dst])
            if target == IGNORE_INDEX:
                raise ValueError(
                    "true glyph roots are missing an explicit NONE/positive relation label: "
                    f"stroke {src}->{dst}"
                )
            out[si, ti] = target
    return out


@dataclass(frozen=True)
class GroupRelationBatch:
    logits: torch.Tensor
    targets: torch.Tensor
    pairs: int
    positive_pairs: int
    none_pairs: int


def score_supervised_group_relations(
    head: GroupRelationHead,
    outputs: dict,
    batch: dict,
    *,
    device: torch.device,
) -> GroupRelationBatch:
    symbols = batch["symbol_targets"].to(device)
    groups = batch["group_targets"].to(device)
    relations = batch["relation_targets"].to(device)
    geometry = batch["stroke_geometry"].to(device)
    structural = outputs["stroke_embeddings"]
    logits_parts = []
    target_parts = []
    for bi in range(symbols.shape[0]):
        components = recover_true_components(symbols[bi], groups[bi])
        if len(components) < 2:
            continue
        logits = head(structural[bi], geometry[bi], components)
        targets = group_relation_targets(relations[bi], components)
        mask = targets.ne(IGNORE_INDEX)
        if bool(mask.any()):
            logits_parts.append(logits[mask])
            target_parts.append(targets[mask])
    if logits_parts:
        logits = torch.cat(logits_parts, dim=0)
        targets = torch.cat(target_parts, dim=0)
    else:
        logits = structural.new_zeros((0, len(RELATIONS)))
        targets = torch.empty((0,), device=device, dtype=torch.long)
    none_id = RELATION_TO_ID["NONE"]
    positive = int(targets.ne(none_id).sum())
    none = int(targets.eq(none_id).sum())
    return GroupRelationBatch(logits, targets, int(targets.numel()), positive, none)


def balanced_group_relation_loss(batch: GroupRelationBatch) -> torch.Tensor:
    """Macro-balance positive relation classes, then balance them against NONE."""
    if batch.pairs == 0:
        return batch.logits.sum() * 0.0
    positive_losses = []
    for rid in range(1, len(RELATIONS)):
        mask = batch.targets.eq(rid)
        if bool(mask.any()):
            positive_losses.append(F.cross_entropy(batch.logits[mask], batch.targets[mask]))
    parts = []
    if positive_losses:
        parts.append(sum(positive_losses) / len(positive_losses))
    none_mask = batch.targets.eq(RELATION_TO_ID["NONE"])
    if bool(none_mask.any()):
        parts.append(F.cross_entropy(batch.logits[none_mask], batch.targets[none_mask]))
    if not parts:
        return batch.logits.sum() * 0.0
    return sum(parts) / len(parts)


def group_relation_metrics(logits: torch.Tensor, targets: torch.Tensor) -> dict:
    if targets.numel() == 0:
        return {
            "positiveAccuracy": 0.0,
            "noneAccuracy": 0.0,
            "balancedAccuracy": 0.0,
            "macroPositiveRecall": 0.0,
            "worstPositiveClassRecall": 0.0,
            "positivePairs": 0,
            "nonePairs": 0,
            "perClass": {},
        }
    pred = logits.argmax(dim=-1)
    none_id = RELATION_TO_ID["NONE"]
    pos_mask = targets.ne(none_id)
    none_mask = targets.eq(none_id)
    pos_ok = int((pred[pos_mask] == targets[pos_mask]).sum()) if bool(pos_mask.any()) else 0
    none_ok = int((pred[none_mask] == targets[none_mask]).sum()) if bool(none_mask.any()) else 0
    pos_n = int(pos_mask.sum())
    none_n = int(none_mask.sum())
    per_class = {}
    positive_recalls = []
    for rid, name in enumerate(RELATIONS):
        mask = targets.eq(rid)
        support = int(mask.sum())
        if support < 1:
            continue
        correct = int((pred[mask] == targets[mask]).sum())
        recall = correct / support
        per_class[name] = {"support": support, "correct": correct, "recall": recall}
        if rid != none_id:
            positive_recalls.append(recall)
    positive_accuracy = pos_ok / max(1, pos_n)
    none_accuracy = none_ok / max(1, none_n)
    macro = sum(positive_recalls) / max(1, len(positive_recalls))
    worst = min(positive_recalls, default=0.0)
    return {
        "positiveAccuracy": positive_accuracy,
        "noneAccuracy": none_accuracy,
        "balancedAccuracy": 0.5 * (positive_accuracy + none_accuracy),
        "macroPositiveRecall": macro,
        "worstPositiveClassRecall": worst,
        "positivePairs": pos_n,
        "nonePairs": none_n,
        "positiveClasses": len(positive_recalls),
        "perClass": per_class,
    }


def decode_group_relation_logits(
    logits: torch.Tensor,
    *,
    min_confidence: float,
) -> tuple[list[RelationHypothesis], float]:
    if not 0.0 < min_confidence < 1.0:
        raise ValueError("group relation min_confidence must be between 0 and 1")
    if logits.ndim != 3 or logits.shape[-1] != len(RELATIONS):
        raise ValueError("decode_group_relation_logits expects GxGxR logits")
    out: list[RelationHypothesis] = []
    decisions = []
    for source in range(logits.shape[0]):
        for target in range(logits.shape[1]):
            if source == target:
                continue
            probs = F.softmax(logits[source, target], dim=-1)
            rid = int(probs.argmax())
            confidence = float(probs[rid])
            decisions.append(confidence)
            kind = RELATIONS[rid]
            if kind != "NONE" and confidence >= min_confidence:
                out.append(RelationHypothesis(source, target, kind, confidence))
    return out, min(decisions, default=1.0)


def apply_group_relation_head(
    hypothesis,
    outputs: dict,
    stroke_geometry: torch.Tensor,
    head: GroupRelationHead,
    *,
    relation_threshold: float = 0.60,
    ambiguity_threshold: float = 0.80,
):
    """Replace only relation/AST evidence on an already decoded hypothesis."""
    structural = outputs["stroke_embeddings"]
    if structural.ndim == 3:
        if structural.shape[0] != 1:
            raise ValueError("group relation override expects one expression")
        structural = structural[0]
    if stroke_geometry.ndim == 3:
        if stroke_geometry.shape[0] != 1:
            raise ValueError("group relation override expects one expression geometry")
        stroke_geometry = stroke_geometry[0]
    components = [tuple(glyph.strokes) for glyph in hypothesis.glyphs]
    logits = head(structural, stroke_geometry, components)
    relations, relation_confidence = decode_group_relation_logits(
        logits, min_confidence=relation_threshold
    )
    ast, ast_warnings = _build_ast(hypothesis.glyphs, relations)
    preserved = [
        warning for warning in hypothesis.warnings
        if warning.startswith("joint partition margin")
    ]
    warnings = preserved + ast_warnings
    hypothesis.relations = relations
    hypothesis.ast = ast
    hypothesis.canonical = ast.canonical()
    hypothesis.relation_confidence = relation_confidence
    hypothesis.confidence = min(
        hypothesis.symbol_confidence,
        hypothesis.grouping_confidence,
        relation_confidence,
    )
    hypothesis.warnings = warnings
    hypothesis.ambiguous = hypothesis.confidence < ambiguity_threshold or bool(warnings)
    setattr(hypothesis, "relation_decoder", GROUP_RELATION_DECODER)
    return hypothesis


def load_group_relation_checkpoint(
    path: Path,
    *,
    base_checkpoint_path: Path,
    d_model: int,
    device: torch.device,
) -> tuple[GroupRelationHead, dict]:
    ckpt = torch.load(path, map_location="cpu", weights_only=False)
    if int(ckpt.get("group_relation_version", 0)) != GROUP_RELATION_VERSION:
        raise ValueError(f"unsupported group relation checkpoint: {path}")
    if ckpt.get("production_ready") is not False:
        raise ValueError("group relation research checkpoint cannot claim production readiness")
    if ckpt.get("objective") != GROUP_RELATION_OBJECTIVE:
        raise ValueError("group relation objective metadata is missing or stale")
    expected_hash = checkpoint_sha256(base_checkpoint_path)
    actual_hash = str(ckpt.get("base_checkpoint_sha256", ""))
    if actual_hash != expected_hash:
        raise ValueError(
            "group relation checkpoint is tied to a different base V4 checkpoint: "
            f"expected {expected_hash}, got {actual_hash or '<missing>'}"
        )
    if int(ckpt.get("d_model", 0)) != int(d_model):
        raise ValueError("group relation d_model does not match base V4 model")
    head = GroupRelationHead(d_model)
    head.load_state_dict(ckpt["model"], strict=True)
    head.to(device).eval()
    return head, ckpt
