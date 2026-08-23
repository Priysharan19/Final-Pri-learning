"""Pri Ink V4 structural handwriting model (research path).

V4 does not replace the promoted V3 runtime until it wins the locked real-writer
benchmark.  It changes the recognition abstraction from flat OCR to:

    points -> physical strokes -> symbol evidence -> spatial relations -> maths graph

The module is intentionally Core-ML-independent for now.  It is trained and
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

        flat = points.reshape(b * s, p, f)
        valid = point_valid.reshape(b * s, p).clone()
        active = stroke_valid.reshape(b * s)

        # PyTorch attention cannot consume an entirely masked row.  Padded stroke
        # slots get one harmless zero token, then are zeroed again after pooling.
        empty = ~valid.any(dim=1)
        valid[empty, 0] = True

        pos = torch.arange(p, device=points.device)
        x = self.point_proj(flat) + self.point_pos(pos)[None, :, :]
        x = self.encoder(x, src_key_padding_mask=~valid)
        weight = valid.to(x.dtype).unsqueeze(-1)
        pooled = (x * weight).sum(dim=1) / weight.sum(dim=1).clamp_min(1.0)
        pooled = pooled * active.to(pooled.dtype).unsqueeze(-1)
        return pooled.reshape(b, s, self.cfg.d_model)


class PairwiseStructureHead(nn.Module):
    """Predict stroke grouping and directed spatial/mathematical relations."""

    def __init__(self, d_model: int, relation_classes: int):
        super().__init__()
        pair_dim = d_model * 4
        hidden = max(128, d_model)
        self.shared = nn.Sequential(
            nn.Linear(pair_dim, hidden),
            nn.GELU(),
            nn.LayerNorm(hidden),
        )
        self.group = nn.Linear(hidden, 1)
        self.relation = nn.Linear(hidden, relation_classes)

    def forward(self, strokes: torch.Tensor) -> tuple[torch.Tensor, torch.Tensor]:
        # Pair representation keeps both order and symmetric similarity evidence.
        left = strokes[:, :, None, :]
        right = strokes[:, None, :, :]
        left = left.expand(-1, -1, strokes.shape[1], -1)
        right = right.expand(-1, strokes.shape[1], -1, -1)
        pair = torch.cat([left, right, left - right, left * right], dim=-1)
        h = self.shared(pair)
        return self.group(h).squeeze(-1), self.relation(h)


class PriInkStructuralV4(nn.Module):
    """Hierarchical multimodal encoder with explicit grouping/relation heads.

    Symbol logits are per physical stroke.  During decoding, high-probability
    group edges form glyph components; member-stroke symbol evidence is pooled
    before the structural parser resolves superscripts, fractions, roots, etc.
    This makes trace-to-symbol attribution observable rather than hidden inside a
    single flat sequence decoder.
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

        # Reuse V3's 2-D-preserving raster encoder.  Cross-attention allows each
        # physical stroke to query whole-expression visual evidence while the 2-D
        # row/column positions remain intact.
        self.raster_encoder = RasterEncoder(cfg.d_model)
        self.visual_cross_attention = nn.MultiheadAttention(
            cfg.d_model, cfg.nhead, dropout=cfg.dropout, batch_first=True
        )
        self.fusion = nn.Sequential(
            nn.Linear(cfg.d_model * 2, cfg.d_model),
            nn.GELU(),
            nn.LayerNorm(cfg.d_model),
        )

        self.symbol_head = nn.Linear(cfg.d_model, vocab_size)
        self.structure_head = PairwiseStructureHead(cfg.d_model, len(RELATIONS))

    def encode(self, stroke_points: torch.Tensor, stroke_point_valid: torch.Tensor,
               stroke_valid: torch.Tensor, stroke_geometry: torch.Tensor,
               raster: torch.Tensor) -> torch.Tensor:
        b, s, _, _ = stroke_points.shape
        local = self.local_stroke(stroke_points, stroke_point_valid, stroke_valid)
        pos = torch.arange(s, device=stroke_points.device)
        x = local + self.geometry(stroke_geometry) + self.stroke_pos(pos)[None, :, :]
        x = self.stroke_context(x, src_key_padding_mask=~stroke_valid)

        visual = self.raster_encoder(raster)
        attended, _ = self.visual_cross_attention(x, visual, visual, need_weights=False)
        fused = self.fusion(torch.cat([x, attended], dim=-1))
        return fused * stroke_valid.to(fused.dtype).unsqueeze(-1)

    def forward(self, stroke_points: torch.Tensor, stroke_point_valid: torch.Tensor,
                stroke_valid: torch.Tensor, stroke_geometry: torch.Tensor,
                raster: torch.Tensor):
        strokes = self.encode(
            stroke_points, stroke_point_valid, stroke_valid, stroke_geometry, raster
        )
        symbol_logits = self.symbol_head(strokes)
        group_logits, relation_logits = self.structure_head(strokes)

        pair_valid = stroke_valid[:, :, None] & stroke_valid[:, None, :]
        # Invalid pair slots are strongly suppressed for grouping. Relation loss
        # uses an explicit ignore mask in the training code.
        group_logits = group_logits.masked_fill(~pair_valid, -30.0)
        return {
            "stroke_embeddings": strokes,
            "symbol_logits": symbol_logits,
            "group_logits": group_logits,
            "relation_logits": relation_logits,
            "pair_valid": pair_valid,
        }
