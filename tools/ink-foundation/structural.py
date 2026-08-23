"""Pri Ink V4 structural handwriting model (research path).

V4 does not replace the promoted V3 runtime until it wins the locked real-writer
benchmark. It changes the recognition abstraction from flat OCR to:

    points -> physical strokes -> symbol evidence -> spatial relations -> maths graph

The module is intentionally Core-ML-independent for now. It is trained and
benchmarked beside V3; promotion requires separate export/runtime work after the
writer-disjoint evidence gate passes.
"""
from __future__ import annotations

from dataclasses import dataclass, asdict

import torch
from torch import nn

from model import RasterEncoder


RELATIONS = (
    "NONE",
    "RIGHT",
    "SUPERSCRIPT",
    "SUBSCRIPT",
    "ABOVE",
    "BELOW",
    "NUMERATOR",
    "DENOMINATOR",
    "INSIDE_ROOT",
)
RELATION_TO_ID = {name: i for i, name in enumerate(RELATIONS)}


@dataclass(frozen=True)
class StructuralConfig:
    feature_dim: int = 14
    geometry_dim: int = 8
    d_model: int = 256
    nhead: int = 8
    point_layers: int = 2
    stroke_layers: int = 4
    ff_dim: int = 1024
    dropout: float = 0.10
    max_strokes: int = 64
    max_points_per_stroke: int = 96
    raster_height: int = 128
    raster_width: int = 512
    architecture_version: int = 4

    def to_dict(self):
        return asdict(self)


class PointToStrokeEncoder(nn.Module):
    """Encode each physical Pencil stroke without destroying its local trajectory."""

    def __init__(self, cfg: StructuralConfig):
        super().__init__()
        self.cfg = cfg
        self.point_proj = nn.Sequential(
            nn.Linear(cfg.feature_dim, cfg.d_model),
            nn.LayerNorm(cfg.d_model),
            nn.GELU(),
        )
        self.point_pos = nn.Embedding(cfg.max_points_per_stroke, cfg.d_model)
        layer = nn.TransformerEncoderLayer(
            d_model=cfg.d_model,
            nhead=cfg.nhead,
            dim_feedforward=cfg.ff_dim,
            dropout=cfg.dropout,
            activation="gelu",
            batch_first=True,
            norm_first=True,
        )
        self.encoder = nn.TransformerEncoder(
            layer, cfg.point_layers, norm=nn.LayerNorm(cfg.d_model)
        )

    def forward(self, points: torch.Tensor, point_valid: torch.Tensor,
                stroke_valid: torch.Tensor) -> torch.Tensor:
        # points: B,S,P,F ; point_valid: B,S,P ; stroke_valid: B,S
        b, s, p, f = points.shape
        if s > self.cfg.max_strokes or p > self.cfg.max_points_per_stroke:
            raise ValueError(
                f"stroke tensor {s}x{p} exceeds configured "
                f"{self.cfg.max_strokes}x{self.cfg.max_points_per_stroke}"
            )
        if f != self.cfg.feature_dim:
            raise ValueError(f"expected feature_dim={self.cfg.feature_dim}, got {f}")

        flat_points = points.reshape(b * s, p, f)
        flat_valid = point_valid.reshape(b * s, p)
        active = stroke_valid.reshape(b * s)
        active_idx = active.nonzero(as_tuple=False).flatten()
        out = points.new_zeros((b * s, self.cfg.d_model))
        if active_idx.numel() == 0:
            return out.reshape(b, s, self.cfg.d_model)

        selected_points = flat_points.index_select(0, active_idx)
        valid = flat_valid.index_select(0, active_idx).clone()
        empty = ~valid.any(dim=1)
        if bool(empty.any()):
            valid[empty, 0] = True

        pos = torch.arange(p, device=points.device)
        x = self.point_proj(selected_points) + self.point_pos(pos)[None, :, :]
        x = self.encoder(x, src_key_padding_mask=~valid)
        weight = valid.to(x.dtype).unsqueeze(-1)
        pooled = (x * weight).sum(dim=1) / weight.sum(dim=1).clamp_min(1.0)
        out.index_copy_(0, active_idx, pooled)
        return out.reshape(b, s, self.cfg.d_model)


class PairwiseStructureHead(nn.Module):
    """Predict same-glyph grouping and directed mathematical spatial relations."""

    def __init__(self, d_model: int, relation_classes: int):
        super().__init__()
        pair_embed = max(64, d_model // 2)
        self.left_proj = nn.Linear(d_model, pair_embed)
        self.right_proj = nn.Linear(d_model, pair_embed)
        pair_dim = pair_embed * 4 + 8
        hidden = max(128, d_model)
        self.shared = nn.Sequential(
            nn.Linear(pair_dim, hidden),
            nn.GELU(),
            nn.LayerNorm(hidden),
        )
        self.group = nn.Linear(hidden, 1)
        self.relation = nn.Linear(hidden, relation_classes)

    @staticmethod
    def _pair_geometry(geometry: torch.Tensor) -> torch.Tensor:
        left = geometry[:, :, None, :]
        right = geometry[:, None, :, :]
        dx = right[..., 0] - left[..., 0]
        dy = right[..., 1] - left[..., 1]
        eps = 1e-4
        log_w_ratio = torch.log((right[..., 2] + eps) / (left[..., 2] + eps))
        log_h_ratio = torch.log((right[..., 3] + eps) / (left[..., 3] + eps))

        left_x1 = left[..., 0] - left[..., 2] * 0.5
        left_x2 = left[..., 0] + left[..., 2] * 0.5
        right_x1 = right[..., 0] - right[..., 2] * 0.5
        right_x2 = right[..., 0] + right[..., 2] * 0.5
        overlap_x = torch.minimum(left_x2, right_x2) - torch.maximum(left_x1, right_x1)
        overlap_x = overlap_x / torch.minimum(left[..., 2], right[..., 2]).clamp_min(eps)

        left_y1 = left[..., 1] - left[..., 3] * 0.5
        left_y2 = left[..., 1] + left[..., 3] * 0.5
        right_y1 = right[..., 1] - right[..., 3] * 0.5
        right_y2 = right[..., 1] + right[..., 3] * 0.5
        overlap_y = torch.minimum(left_y2, right_y2) - torch.maximum(left_y1, right_y1)
        overlap_y = overlap_y / torch.minimum(left[..., 3], right[..., 3]).clamp_min(eps)

        order_delta = right[..., 7] - left[..., 7]
        distance = torch.sqrt(dx.square() + dy.square() + eps)
        return torch.stack([
            dx, dy,
            log_w_ratio.clamp(-4.0, 4.0),
            log_h_ratio.clamp(-4.0, 4.0),
            overlap_x.clamp(-2.0, 2.0),
            overlap_y.clamp(-2.0, 2.0),
            order_delta,
            distance.clamp(0.0, 4.0),
        ], dim=-1)

    def forward(self, strokes: torch.Tensor,
                geometry: torch.Tensor) -> tuple[torch.Tensor, torch.Tensor]:
        l = self.left_proj(strokes)
        r = self.right_proj(strokes)
        left = l[:, :, None, :].expand(-1, -1, strokes.shape[1], -1)
        right = r[:, None, :, :].expand(-1, strokes.shape[1], -1, -1)
        pair_geo = self._pair_geometry(geometry)
        pair = torch.cat([left, right, left - right, left * right, pair_geo], dim=-1)
        h = self.shared(pair)
        return self.group(h).squeeze(-1), self.relation(h)


class PriInkStructuralV4(nn.Module):
    """Hierarchical multimodal encoder with explicit grouping/relation heads.

    Symbol recognition is group-aware. A physical trace by itself may be
    ambiguous (one bar of '=' looks exactly like '-'), so the grouping head is
    used to construct a soft neighbouring-stroke context before symbol
    classification. The symbol loss does not back-propagate through this context
    into grouping; grouping remains independently supervised and inspectable.
    """

    def __init__(self, vocab_size: int, cfg: StructuralConfig):
        super().__init__()
        self.cfg = cfg
        self.vocab_size = vocab_size
        self.local_stroke = PointToStrokeEncoder(cfg)
        self.geometry = nn.Sequential(
            nn.Linear(cfg.geometry_dim, cfg.d_model),
            nn.GELU(),
            nn.LayerNorm(cfg.d_model),
        )
        self.stroke_pos = nn.Embedding(cfg.max_strokes, cfg.d_model)

        layer = nn.TransformerEncoderLayer(
            d_model=cfg.d_model,
            nhead=cfg.nhead,
            dim_feedforward=cfg.ff_dim,
            dropout=cfg.dropout,
            activation="gelu",
            batch_first=True,
            norm_first=True,
        )
        self.stroke_context = nn.TransformerEncoder(
            layer, cfg.stroke_layers, norm=nn.LayerNorm(cfg.d_model)
        )

        self.raster_encoder = RasterEncoder(cfg.d_model)
        self.visual_cross_attention = nn.MultiheadAttention(
            cfg.d_model, cfg.nhead, dropout=cfg.dropout, batch_first=True
        )
        self.fusion = nn.Sequential(
            nn.Linear(cfg.d_model * 2, cfg.d_model),
            nn.GELU(),
            nn.LayerNorm(cfg.d_model),
        )

        # A glyph can span several physical strokes. Classify from the stroke
        # plus the high-confidence same-glyph context instead of requiring each
        # member stroke to identify the whole symbol independently.
        self.symbol_group_fusion = nn.Sequential(
            nn.Linear(cfg.d_model * 2, cfg.d_model),
            nn.GELU(),
            nn.LayerNorm(cfg.d_model),
        )
        self.symbol_head = nn.Linear(cfg.d_model, vocab_size)
        self.structure_head = PairwiseStructureHead(cfg.d_model, len(RELATIONS))

    def encode(self, stroke_points: torch.Tensor, stroke_point_valid: torch.Tensor,
               stroke_valid: torch.Tensor, stroke_geometry: torch.Tensor,
               raster: torch.Tensor) -> torch.Tensor:
        _, s, _, _ = stroke_points.shape
        local = self.local_stroke(stroke_points, stroke_point_valid, stroke_valid)
        pos = torch.arange(s, device=stroke_points.device)
        x = local + self.geometry(stroke_geometry) + self.stroke_pos(pos)[None, :, :]
        x = self.stroke_context(x, src_key_padding_mask=~stroke_valid)

        visual = self.raster_encoder(raster)
        attended, _ = self.visual_cross_attention(x, visual, visual, need_weights=False)
        fused = self.fusion(torch.cat([x, attended], dim=-1))
        return fused * stroke_valid.to(fused.dtype).unsqueeze(-1)

    @staticmethod
    def _group_context(strokes: torch.Tensor, group_logits: torch.Tensor,
                       stroke_valid: torch.Tensor) -> torch.Tensor:
        """Pool likely same-glyph strokes without letting symbol loss game grouping."""
        pair_valid = stroke_valid[:, :, None] & stroke_valid[:, None, :]
        symmetric = 0.5 * (group_logits + group_logits.transpose(1, 2))
        probability = symmetric.sigmoid()

        # Random group logits start near 0.5. Convert that undecided region to
        # zero context so early training does not average the whole expression.
        affinity = ((probability - 0.5) * 2.0).clamp(0.0, 1.0).detach()
        affinity = affinity * pair_valid.to(affinity.dtype)
        b, s, _ = affinity.shape
        eye = torch.eye(s, device=strokes.device, dtype=affinity.dtype)[None, :, :]
        eye = eye * stroke_valid.to(affinity.dtype)[:, :, None]
        weights = torch.maximum(affinity, eye)
        weights = weights / weights.sum(dim=-1, keepdim=True).clamp_min(1e-6)
        return torch.bmm(weights, strokes)

    def forward(self, stroke_points: torch.Tensor, stroke_point_valid: torch.Tensor,
                stroke_valid: torch.Tensor, stroke_geometry: torch.Tensor,
                raster: torch.Tensor):
        strokes = self.encode(
            stroke_points, stroke_point_valid, stroke_valid, stroke_geometry, raster
        )
        group_logits, relation_logits = self.structure_head(strokes, stroke_geometry)
        group_context = self._group_context(strokes, group_logits, stroke_valid)
        symbol_features = self.symbol_group_fusion(torch.cat([strokes, group_context], dim=-1))
        symbol_logits = self.symbol_head(symbol_features)

        pair_valid = stroke_valid[:, :, None] & stroke_valid[:, None, :]
        group_logits = group_logits.masked_fill(~pair_valid, -30.0)
        relation_logits = relation_logits.masked_fill(~pair_valid.unsqueeze(-1), -30.0)
        return {
            "symbol_logits": symbol_logits,
            "group_logits": group_logits,
            "relation_logits": relation_logits,
            "pair_valid": pair_valid,
            "stroke_embeddings": strokes,
        }
