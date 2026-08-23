"""Pri Learning local handwriting foundation model.

Production constraints matter as much as benchmark accuracy. The model is
multimodal but still executes in ONE neural pass on an iPad:
  * a Transformer reads the original Pencil point stream;
  * a CNN reads a high-resolution raster of the same expression;
  * a learned style vector captures the current writer's hand;
  * parallel learned output queries decode the full maths sequence at once.

The non-autoregressive output-query decoder avoids 10–100 repeated Core ML
invocations per expression. Pri's existing grammar/AST layer remains downstream
for structured mathematical consistency.
"""
from __future__ import annotations

from dataclasses import dataclass, asdict

import torch
from torch import nn


@dataclass(frozen=True)
class ModelConfig:
    feature_dim: int = 14
    d_model: int = 256
    nhead: int = 8
    stroke_layers: int = 8
    decoder_layers: int = 6
    ff_dim: int = 1024
    dropout: float = 0.10
    max_points: int = 768
    max_tokens: int = 96
    raster_height: int = 128
    raster_width: int = 512
    style_dim: int = 128

    def to_dict(self):
        return asdict(self)


class RasterEncoder(nn.Module):
    """Preserve horizontal order while collapsing only the vertical image axis."""

    def __init__(self, d_model: int):
        super().__init__()
        self.net = nn.Sequential(
            nn.Conv2d(1, 32, 5, stride=(2, 2), padding=2), nn.GELU(),
            nn.Conv2d(32, 64, 3, stride=(2, 2), padding=1), nn.GELU(),
            nn.Conv2d(64, 128, 3, stride=(2, 2), padding=1), nn.GELU(),
            nn.Conv2d(128, 192, 3, stride=(2, 1), padding=1), nn.GELU(),
            nn.Conv2d(192, d_model, 3, stride=(2, 1), padding=1), nn.GELU(),
        )
        self.norm = nn.LayerNorm(d_model)

    def forward(self, image: torch.Tensor) -> torch.Tensor:
        x = self.net(image)                 # B,D,H',W'
        x = x.mean(dim=2).transpose(1, 2)  # B,W',D
        return self.norm(x)


class PriInkFoundation(nn.Module):
    def __init__(self, vocab_size: int, pad_id: int, config: ModelConfig,
                 writer_classes: int = 0):
        super().__init__()
        self.config = config
        self.vocab_size = vocab_size
        self.pad_id = pad_id

        self.point_proj = nn.Sequential(
            nn.Linear(config.feature_dim, config.d_model),
            nn.LayerNorm(config.d_model),
            nn.GELU(),
        )
        self.point_pos = nn.Embedding(config.max_points, config.d_model)
        self.stroke_modality = nn.Parameter(torch.zeros(1, 1, config.d_model))
        self.raster_modality = nn.Parameter(torch.zeros(1, 1, config.d_model))

        stroke_layer = nn.TransformerEncoderLayer(
            d_model=config.d_model, nhead=config.nhead, dim_feedforward=config.ff_dim,
            dropout=config.dropout, activation="gelu", batch_first=True, norm_first=True,
        )
        self.stroke_encoder = nn.TransformerEncoder(
            stroke_layer, config.stroke_layers, norm=nn.LayerNorm(config.d_model)
        )
        self.raster_encoder = RasterEncoder(config.d_model)

        self.style_encoder = nn.Sequential(
            nn.Linear(config.d_model, config.style_dim), nn.GELU(),
            nn.Linear(config.style_dim, config.d_model), nn.LayerNorm(config.d_model),
        )
        self.fusion_norm = nn.LayerNorm(config.d_model)

        # DETR-style learned sequence slots. All positions are decoded together,
        # so self-attention can enforce line-level consistency without an
        # autoregressive loop at inference time.
        self.output_queries = nn.Embedding(config.max_tokens, config.d_model)
        self.output_pos = nn.Embedding(config.max_tokens, config.d_model)
        decoder_layer = nn.TransformerDecoderLayer(
            d_model=config.d_model, nhead=config.nhead, dim_feedforward=config.ff_dim,
            dropout=config.dropout, activation="gelu", batch_first=True, norm_first=True,
        )
        self.decoder = nn.TransformerDecoder(
            decoder_layer, config.decoder_layers, norm=nn.LayerNorm(config.d_model)
        )
        self.output = nn.Linear(config.d_model, vocab_size)

        # Training-only style supervision. It pressures the pooled stroke
        # representation to describe the writer rather than just the equation.
        self.writer_head = (
            nn.Linear(config.d_model, writer_classes) if writer_classes > 1 else None
        )

        nn.init.normal_(self.stroke_modality, std=0.02)
        nn.init.normal_(self.raster_modality, std=0.02)
        nn.init.normal_(self.output_queries.weight, std=0.02)

    @staticmethod
    def _masked_mean(x: torch.Tensor, valid: torch.Tensor) -> torch.Tensor:
        w = valid.to(x.dtype).unsqueeze(-1)
        return (x * w).sum(1) / w.sum(1).clamp_min(1.0)

    def encode(self, points: torch.Tensor, point_valid: torch.Tensor,
               raster: torch.Tensor) -> tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
        """Return fused memory, memory padding mask and current-hand style vector."""
        b, n, _ = points.shape
        if n > self.config.max_points:
            raise ValueError(f"point sequence {n} exceeds max_points={self.config.max_points}")

        pos = torch.arange(n, device=points.device)
        stroke = self.point_proj(points) + self.point_pos(pos)[None, :, :] + self.stroke_modality
        stroke = self.stroke_encoder(stroke, src_key_padding_mask=~point_valid)

        pooled = self._masked_mean(stroke, point_valid)
        style = self.style_encoder(pooled)
        stroke = stroke + style[:, None, :]

        visual = self.raster_encoder(raster) + self.raster_modality + style[:, None, :]
        visual_valid = torch.ones((b, visual.shape[1]), dtype=torch.bool, device=visual.device)

        memory = self.fusion_norm(torch.cat([stroke, visual], dim=1))
        memory_valid = torch.cat([point_valid, visual_valid], dim=1)
        return memory, ~memory_valid, style

    def decode(self, memory: torch.Tensor, memory_pad: torch.Tensor) -> torch.Tensor:
        b = memory.shape[0]
        positions = torch.arange(self.config.max_tokens, device=memory.device)
        q = self.output_queries(positions) + self.output_pos(positions)
        q = q.unsqueeze(0).expand(b, -1, -1)
        decoded = self.decoder(q, memory, memory_key_padding_mask=memory_pad)
        return self.output(decoded)

    def forward(self, points: torch.Tensor, point_valid: torch.Tensor,
                raster: torch.Tensor):
        memory, memory_pad, style = self.encode(points, point_valid, raster)
        logits = self.decode(memory, memory_pad)
        writer_logits = self.writer_head(style) if self.writer_head is not None else None
        return logits, writer_logits


class CoreMLModel(nn.Module):
    """Small export wrapper: one call in, complete token logits out."""

    def __init__(self, model: PriInkFoundation):
        super().__init__()
        self.model = model

    def forward(self, points: torch.Tensor, point_valid: torch.Tensor,
                raster: torch.Tensor) -> torch.Tensor:
        logits, _ = self.model(points, point_valid, raster)
        return logits
