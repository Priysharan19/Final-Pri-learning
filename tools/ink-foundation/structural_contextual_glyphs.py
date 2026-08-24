"""Contextual visual group-symbol research for Pri Ink Structural V4.

The V4 base model deliberately separated local glyph-shape embeddings from the
full-expression structural stream. That protected symbol classification from
layout overfitting, but it also meant the final group-level glyph classifier never
consumed the raster cross-attention representation. This module tests the missing
fusion directly without changing the frozen base checkpoint.

A hash-bound auxiliary head pools, for each complete glyph candidate:
  - local online/shape embeddings (mean + max),
  - structural embeddings that include expression context + 2-D visual attention
    (mean + max),
  - group union shape geometry and stroke count.

The exact same head architecture can run in `local-control` mode, where the
structural/visual channels are zeroed. Training a local control and contextual head
on the same frozen base separates "more head training" from genuine contextual /
visual signal. Research only; synthetic and same-writer metrics are not production
evidence.
"""
from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path

import torch
from torch import nn
import torch.nn.functional as F

from data import ID_TO_TOKEN, SPECIAL, TOKEN_TO_ID
from structural_component_validity import checkpoint_sha256, recover_true_components
from structural_group_relations import component_union_geometry


CONTEXTUAL_GLYPH_VERSION = 1
CONTEXTUAL_GLYPH_OBJECTIVE = "local-visual-context-group-symbol-v1"
CONTEXTUAL_GLYPH_MARGIN = 0.50
CONTEXTUAL_GLYPH_MARGIN_WEIGHT = 0.25
FEATURE_MODES = ("local-control", "local-plus-visual")


def _validate_mode(mode: str):
    if mode not in FEATURE_MODES:
        raise ValueError(f"unknown contextual glyph feature mode: {mode!r}")


def group_symbol_targets(
    symbol_targets: torch.Tensor,
    components: list[tuple[int, ...] | list[int]],
) -> tuple[torch.Tensor, torch.Tensor]:
    """Return one canonical token target and physical-stroke count per glyph."""
    targets = []
    sizes = []
    for component in components:
        members = [int(i) for i in component]
        if not members:
            raise ValueError("contextual glyph component cannot be empty")
        idx = torch.tensor(members, device=symbol_targets.device, dtype=torch.long)
        values = symbol_targets.index_select(0, idx)
        if bool(values.lt(0).any()):
            raise ValueError("contextual glyph target contains an ignored/unlabelled stroke")
        if int(values.min()) != int(values.max()):
            raise ValueError(f"glyph component has inconsistent symbol targets: {members}")
        targets.append(values[0])
        sizes.append(len(members))
    if not targets:
        return (
            torch.empty((0,), device=symbol_targets.device, dtype=torch.long),
            torch.empty((0,), device=symbol_targets.device, dtype=torch.long),
        )
    return torch.stack(targets).long(), torch.tensor(sizes, device=symbol_targets.device, dtype=torch.long)


class ContextualGlyphSymbolHead(nn.Module):
    """Classify complete glyph groups using controlled local + visual context fusion."""

    def __init__(self, d_model: int, vocab_size: int):
        super().__init__()
        self.d_model = int(d_model)
        self.vocab_size = int(vocab_size)
        hidden = max(256, self.d_model * 2)
        # local mean/max + structural mean/max + five shape features + count
        self.net = nn.Sequential(
            nn.Linear(self.d_model * 4 + 6, hidden),
            nn.GELU(),
            nn.LayerNorm(hidden),
            nn.Dropout(0.10),
            nn.Linear(hidden, self.d_model),
            nn.GELU(),
            nn.LayerNorm(self.d_model),
            nn.Linear(self.d_model, self.vocab_size),
        )

    @staticmethod
    def _pool(strokes: torch.Tensor, members: list[int]) -> tuple[torch.Tensor, torch.Tensor]:
        idx = torch.tensor(members, device=strokes.device, dtype=torch.long)
        selected = strokes.index_select(0, idx)
        return selected.mean(dim=0), selected.max(dim=0).values

    def forward(
        self,
        local_strokes: torch.Tensor,
        structural_strokes: torch.Tensor,
        stroke_geometry: torch.Tensor,
        components: list[tuple[int, ...] | list[int]],
        *,
        feature_mode: str,
    ) -> torch.Tensor:
        _validate_mode(feature_mode)
        if local_strokes.ndim != 2 or local_strokes.shape[-1] != self.d_model:
            raise ValueError(f"contextual glyph head expects Sx{self.d_model} local embeddings")
        if structural_strokes.shape != local_strokes.shape:
            raise ValueError("local and structural stroke embeddings must have identical SxD shape")
        geometry = component_union_geometry(stroke_geometry, components)
        rows = []
        for gi, component in enumerate(components):
            members = [int(i) for i in component]
            if not members:
                raise ValueError("contextual glyph component cannot be empty")
            local_mean, local_max = self._pool(local_strokes, members)
            structural_mean, structural_max = self._pool(structural_strokes, members)
            if feature_mode == "local-control":
                structural_mean = torch.zeros_like(structural_mean)
                structural_max = torch.zeros_like(structural_max)
            # Exclude absolute centre/order: symbol identity should not depend on
            # where the glyph happens to sit in an expression.
            shape = geometry[gi, [2, 3, 4, 5, 6]]
            count = local_strokes.new_tensor([min(len(members), 6) / 6.0])
            rows.append(torch.cat([
                local_mean, local_max,
                structural_mean, structural_max,
                shape, count,
            ], dim=0))
        if not rows:
            return local_strokes.new_zeros((0, self.vocab_size))
        return self.net(torch.stack(rows, dim=0))


@dataclass(frozen=True)
class ContextualGlyphBatch:
    logits: torch.Tensor
    targets: torch.Tensor
    group_sizes: torch.Tensor

    @property
    def groups(self) -> int:
        return int(self.targets.numel())


def score_supervised_contextual_glyphs(
    head: ContextualGlyphSymbolHead,
    outputs: dict,
    batch: dict,
    *,
    device: torch.device,
    feature_mode: str,
) -> ContextualGlyphBatch:
    symbols = batch["symbol_targets"].to(device)
    groups = batch["group_targets"].to(device)
    geometry = batch["stroke_geometry"].to(device)
    local = outputs["glyph_stroke_embeddings"]
    structural = outputs["stroke_embeddings"]
    logits_parts = []
    target_parts = []
    size_parts = []
    for bi in range(symbols.shape[0]):
        components = recover_true_components(symbols[bi], groups[bi])
        if not components:
            continue
        logits = head(
            local[bi], structural[bi], geometry[bi], components,
            feature_mode=feature_mode,
        )
        targets, sizes = group_symbol_targets(symbols[bi], components)
        logits_parts.append(logits)
        target_parts.append(targets)
        size_parts.append(sizes)
    if logits_parts:
        return ContextualGlyphBatch(
            torch.cat(logits_parts, dim=0),
            torch.cat(target_parts, dim=0),
            torch.cat(size_parts, dim=0),
        )
    return ContextualGlyphBatch(
        local.new_zeros((0, head.vocab_size)),
        torch.empty((0,), device=device, dtype=torch.long),
        torch.empty((0,), device=device, dtype=torch.long),
    )


def contextual_glyph_loss(batch: ContextualGlyphBatch) -> torch.Tensor:
    """Macro token CE + true-vs-best-alternative margin for complete glyphs."""
    if batch.groups == 0:
        return batch.logits.sum() * 0.0
    class_losses = []
    for token in torch.unique(batch.targets).tolist():
        mask = batch.targets.eq(int(token))
        class_losses.append(F.cross_entropy(
            batch.logits[mask], batch.targets[mask], label_smoothing=0.03
        ))
    macro_ce = sum(class_losses) / len(class_losses)

    true_logits = batch.logits.gather(1, batch.targets[:, None]).squeeze(1)
    wrong = batch.logits.clone()
    wrong.scatter_(1, batch.targets[:, None], torch.finfo(wrong.dtype).min)
    best_wrong = wrong.max(dim=-1).values
    ranking = F.softplus(CONTEXTUAL_GLYPH_MARGIN - (true_logits - best_wrong)).mean()
    return macro_ce + CONTEXTUAL_GLYPH_MARGIN_WEIGHT * ranking


def _real_predictions(logits: torch.Tensor) -> torch.Tensor:
    masked = logits.clone()
    for token in SPECIAL:
        idx = TOKEN_TO_ID.get(token)
        if idx is not None:
            masked[:, idx] = torch.finfo(masked.dtype).min
    return masked.argmax(dim=-1)


def contextual_glyph_metrics(
    logits: torch.Tensor,
    targets: torch.Tensor,
    group_sizes: torch.Tensor,
) -> dict:
    if targets.numel() == 0:
        return {
            "accuracy": 0.0,
            "singleStrokeAccuracy": 0.0,
            "multiStrokeAccuracy": 0.0,
            "macroClassRecall": 0.0,
            "worstClassRecall": 0.0,
            "groups": 0,
            "singleStrokeGroups": 0,
            "multiStrokeGroups": 0,
            "classes": 0,
            "perClass": {},
        }
    pred = _real_predictions(logits)
    correct = pred.eq(targets)
    single = group_sizes.eq(1)
    multi = group_sizes.gt(1)
    per_class = {}
    recalls = []
    for token_id in torch.unique(targets).tolist():
        mask = targets.eq(int(token_id))
        support = int(mask.sum())
        ok = int(correct[mask].sum())
        recall = ok / support
        name = ID_TO_TOKEN.get(int(token_id), "<unk>")
        per_class[name] = {"support": support, "correct": ok, "recall": recall}
        recalls.append(recall)
    return {
        "accuracy": float(correct.float().mean()),
        "singleStrokeAccuracy": float(correct[single].float().mean()) if bool(single.any()) else 0.0,
        "multiStrokeAccuracy": float(correct[multi].float().mean()) if bool(multi.any()) else 0.0,
        "macroClassRecall": sum(recalls) / max(1, len(recalls)),
        "worstClassRecall": min(recalls, default=0.0),
        "groups": int(targets.numel()),
        "singleStrokeGroups": int(single.sum()),
        "multiStrokeGroups": int(multi.sum()),
        "classes": len(recalls),
        "perClass": per_class,
    }


class ContextualGlyphModel:
    """Decoder adapter exposing contextual group logits through the base API."""

    def __init__(
        self,
        base_model,
        head: ContextualGlyphSymbolHead,
        structural_strokes: torch.Tensor,
        stroke_geometry: torch.Tensor,
        *,
        feature_mode: str,
    ):
        _validate_mode(feature_mode)
        self.base_model = base_model
        self.head = head
        self.feature_mode = feature_mode
        self.structural_strokes = structural_strokes[0] if structural_strokes.ndim == 3 else structural_strokes
        self.stroke_geometry = stroke_geometry[0] if stroke_geometry.ndim == 3 else stroke_geometry

    def classify_glyph_components(self, glyph_strokes, components):
        return self.head(
            glyph_strokes,
            self.structural_strokes,
            self.stroke_geometry,
            components,
            feature_mode=self.feature_mode,
        )


def load_contextual_glyph_checkpoint(
    path: Path,
    *,
    base_checkpoint_path: Path,
    d_model: int,
    vocab_size: int,
    device: torch.device,
) -> tuple[ContextualGlyphSymbolHead, dict]:
    ckpt = torch.load(path, map_location="cpu", weights_only=False)
    if int(ckpt.get("contextual_glyph_version", 0)) != CONTEXTUAL_GLYPH_VERSION:
        raise ValueError(f"unsupported contextual glyph checkpoint: {path}")
    if ckpt.get("production_ready") is not False:
        raise ValueError("contextual glyph research checkpoint cannot claim production readiness")
    if ckpt.get("objective") != CONTEXTUAL_GLYPH_OBJECTIVE:
        raise ValueError("contextual glyph objective metadata is missing or stale")
    feature_mode = str(ckpt.get("feature_mode", ""))
    _validate_mode(feature_mode)
    expected_hash = checkpoint_sha256(base_checkpoint_path)
    actual_hash = str(ckpt.get("base_checkpoint_sha256", ""))
    if actual_hash != expected_hash:
        raise ValueError(
            "contextual glyph checkpoint is tied to a different base V4 checkpoint: "
            f"expected {expected_hash}, got {actual_hash or '<missing>'}"
        )
    if int(ckpt.get("d_model", 0)) != int(d_model) or int(ckpt.get("vocab_size", 0)) != int(vocab_size):
        raise ValueError("contextual glyph dimensions do not match base V4 model")
    head = ContextualGlyphSymbolHead(d_model, vocab_size)
    head.load_state_dict(ckpt["model"], strict=True)
    head.to(device).eval()
    return head, ckpt
