"""Pri Ink V4 structural handwriting model (research path).

V4 does not replace the promoted V3 runtime until it wins the locked real-writer
benchmark. It changes the recognition abstraction from flat OCR to:

    points -> physical strokes -> glyph evidence -> spatial relations -> maths graph

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
    # 14 original online channels + four stroke-local shape channels
    # (local x/y/dx/dy). The local channels make a glyph's trajectory largely
    # invariant to expression width, absolute position and surrounding layout.
    feature_dim: int = 18
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
    glyph_representation_version: int = 2

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


class LocalGlyphStrokeEncoder(nn.Module):
    """Dedicated local-shape encoder for symbol discrimination.

    The expression Transformer is useful for layout, but its contextual embedding
    can make writer-specific glyph shapes less separable. This branch sees only
    stroke-local trajectory/device channels and uses temporal convolutions plus
    mean/max pooling. It therefore preserves local curvature and pen-direction
    evidence for confusable shapes such as 3/5/6/8/9, b/B, pi and radicals.
    """

    # local x/y/dx/dy, pressure, width, azimuth sin/cos, altitude, start/end
    CHANNELS = (4, 5, 6, 7, 10, 11, 12, 13, 14, 15, 16)

    def __init__(self, cfg: StructuralConfig):
        super().__init__()
        self.cfg = cfg
        hidden = max(64, cfg.d_model // 2)
        groups_hidden = 8 if hidden % 8 == 0 else 1
        groups_model = 8 if cfg.d_model % 8 == 0 else 1
        self.net = nn.Sequential(
            nn.Conv1d(len(self.CHANNELS), hidden, kernel_size=5, padding=2),
            nn.GroupNorm(groups_hidden, hidden),
            nn.GELU(),
            nn.Conv1d(hidden, hidden, kernel_size=5, padding=2),
            nn.GroupNorm(groups_hidden, hidden),
            nn.GELU(),
            nn.Conv1d(hidden, cfg.d_model, kernel_size=3, padding=1),
            nn.GroupNorm(groups_model, cfg.d_model),
            nn.GELU(),
        )
        self.pool = nn.Sequential(
            nn.Linear(cfg.d_model * 2, cfg.d_model),
            nn.GELU(),
            nn.LayerNorm(cfg.d_model),
        )

    def forward(self, points: torch.Tensor, point_valid: torch.Tensor,
                stroke_valid: torch.Tensor) -> torch.Tensor:
        b, s, p, _ = points.shape
        flat_valid = point_valid.reshape(b * s, p)
        active = stroke_valid.reshape(b * s)
        active_idx = active.nonzero(as_tuple=False).flatten()
        out = points.new_zeros((b * s, self.cfg.d_model))
        if active_idx.numel() == 0:
            return out.reshape(b, s, self.cfg.d_model)

        selected = points[..., list(self.CHANNELS)].reshape(
            b * s, p, len(self.CHANNELS)
        ).index_select(0, active_idx)
        valid = flat_valid.index_select(0, active_idx)
        mask = valid.to(selected.dtype).unsqueeze(1)
        x = selected.transpose(1, 2) * mask
        h = self.net(x) * mask

        denom = mask.sum(dim=-1).clamp_min(1.0)
        mean = h.sum(dim=-1) / denom
        neg = torch.finfo(h.dtype).min
        maximum = h.masked_fill(~valid.unsqueeze(1), neg).max(dim=-1).values
        maximum = torch.where(torch.isfinite(maximum), maximum, torch.zeros_like(maximum))
        pooled = self.pool(torch.cat([mean, maximum], dim=-1))
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

    Layout reasoning and glyph recognition now have related but distinct feature
    paths. The structural path may use full-expression context. The glyph path is
    deliberately dominated by stroke-local shape evidence, then a true group-level
    classifier pools all traces of one glyph before assigning a token.
    """

    def __init__(self, vocab_size: int, cfg: StructuralConfig):
        super().__init__()
        self.cfg = cfg
        self.vocab_size = vocab_size
        self.local_stroke = PointToStrokeEncoder(cfg)
        self.local_glyph_shape = LocalGlyphStrokeEncoder(cfg)

        self.geometry = nn.Sequential(
            nn.Linear(cfg.geometry_dim, cfg.d_model),
            nn.GELU(),
            nn.LayerNorm(cfg.d_model),
        )
        # Symbol geometry intentionally excludes absolute centre/order. Width,
        # height, aspect, path length and point density are useful shape cues.
        self.symbol_geometry = nn.Sequential(
            nn.Linear(5, cfg.d_model),
            nn.GELU(),
            nn.LayerNorm(cfg.d_model),
        )
        self.stroke_pos = nn.Embedding(cfg.max_strokes, cfg.d_model)
        self.structural_local_fusion = nn.Sequential(
            nn.Linear(cfg.d_model * 2, cfg.d_model),
            nn.GELU(),
            nn.LayerNorm(cfg.d_model),
        )
        self.symbol_local_fusion = nn.Sequential(
            nn.Linear(cfg.d_model * 2, cfg.d_model),
            nn.GELU(),
            nn.LayerNorm(cfg.d_model),
        )

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

        # Per-stroke logits are retained as a diagnostic only. The primary token
        # objective is `glyph_symbol_head` after explicit component pooling.
        self.symbol_head = nn.Linear(cfg.d_model, vocab_size)
        self.glyph_symbol_head = nn.Sequential(
            nn.Linear(cfg.d_model * 2 + 1, cfg.d_model),
            nn.GELU(),
            nn.LayerNorm(cfg.d_model),
            nn.Linear(cfg.d_model, vocab_size),
        )
        self.structure_head = PairwiseStructureHead(cfg.d_model, len(RELATIONS))

    def encode(self, stroke_points: torch.Tensor, stroke_point_valid: torch.Tensor,
               stroke_valid: torch.Tensor, stroke_geometry: torch.Tensor,
               raster: torch.Tensor) -> tuple[torch.Tensor, torch.Tensor]:
        _, s, _, _ = stroke_points.shape
        online = self.local_stroke(stroke_points, stroke_point_valid, stroke_valid)
        shape = self.local_glyph_shape(stroke_points, stroke_point_valid, stroke_valid)

        local_structural = self.structural_local_fusion(torch.cat([online, shape], dim=-1))
        glyph_strokes = self.symbol_local_fusion(torch.cat([online, shape], dim=-1))
        glyph_strokes = glyph_strokes + self.symbol_geometry(stroke_geometry[..., 2:7])
        glyph_strokes = glyph_strokes * stroke_valid.to(glyph_strokes.dtype).unsqueeze(-1)

        pos = torch.arange(s, device=stroke_points.device)
        x = local_structural + self.geometry(stroke_geometry) + self.stroke_pos(pos)[None, :, :]
        x = self.stroke_context(x, src_key_padding_mask=~stroke_valid)

        visual = self.raster_encoder(raster)
        attended, _ = self.visual_cross_attention(x, visual, visual, need_weights=False)
        fused = self.fusion(torch.cat([x, attended], dim=-1))
        structural = fused * stroke_valid.to(fused.dtype).unsqueeze(-1)
        return structural, glyph_strokes

    def classify_glyph_components(self, glyph_strokes: torch.Tensor,
                                  components: list[tuple[int, ...] | list[int]]) -> torch.Tensor:
        """Classify complete glyph components from pooled local-shape embeddings."""
        if glyph_strokes.ndim != 2:
            raise ValueError("classify_glyph_components expects SxD embeddings for one sample")
        features = []
        for component in components:
            members = [int(i) for i in component]
            if not members:
                raise ValueError("glyph component cannot be empty")
            idx = torch.tensor(members, device=glyph_strokes.device, dtype=torch.long)
            selected = glyph_strokes.index_select(0, idx)
            mean = selected.mean(dim=0)
            maximum = selected.max(dim=0).values
            count = glyph_strokes.new_tensor([min(len(members), 6) / 6.0])
            features.append(torch.cat([mean, maximum, count], dim=0))
        if not features:
            return glyph_strokes.new_zeros((0, self.vocab_size))
        return self.glyph_symbol_head(torch.stack(features, dim=0))

    def forward(self, stroke_points: torch.Tensor, stroke_point_valid: torch.Tensor,
                stroke_valid: torch.Tensor, stroke_geometry: torch.Tensor,
                raster: torch.Tensor):
        strokes, glyph_strokes = self.encode(
            stroke_points, stroke_point_valid, stroke_valid, stroke_geometry, raster
        )
        group_logits, relation_logits = self.structure_head(strokes, stroke_geometry)
        symbol_logits = self.symbol_head(glyph_strokes)

        pair_valid = stroke_valid[:, :, None] & stroke_valid[:, None, :]
        group_logits = group_logits.masked_fill(~pair_valid, -30.0)
        relation_logits = relation_logits.masked_fill(~pair_valid.unsqueeze(-1), -30.0)
        return {
            "symbol_logits": symbol_logits,
            "group_logits": group_logits,
            "relation_logits": relation_logits,
            "pair_valid": pair_valid,
            "stroke_embeddings": strokes,
            "glyph_stroke_embeddings": glyph_strokes,
        }
