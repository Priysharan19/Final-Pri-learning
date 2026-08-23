"""Pri Learning local handwriting foundation model.

The production model is deliberately multimodal:
  * a Transformer reads the original Pencil point stream;
  * a CNN reads a high-resolution raster of the same expression;
  * a learned style vector is extracted from the writer's stroke stream;
  * an autoregressive maths decoder fuses all three.

Nothing in this module depends on a hosted model or API. The trained checkpoint is
owned by Pri Learning and can be exported to Core ML for fully local inference.
"""
from __future__ import annotations

from dataclasses import dataclass, asdict
from typing import Optional

import torch
from torch import nn
import torch.nn.functional as F


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
    max_tokens: int = 128
    raster_height: int = 128
    raster_width: int = 512
    style_dim: int = 128

    def to_dict(self):
        return asdict(self)


class RasterEncoder(nn.Module):
    """Preserve horizontal order while collapsing the vertical image axis."""

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
        # B,C,H,W -> B,D,H',W'. Collapse H' only; W' stays a sequence.
        x = self.net(image)
        x = x.mean(dim=2).transpose(1, 2)
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
        self.stroke_encoder = nn.TransformerEncoder(stroke_layer, config.stroke_layers,
                                                    norm=nn.LayerNorm(config.d_model))
        self.raster_encoder = RasterEncoder(config.d_model)

        self.style_encoder = nn.Sequential(
            nn.Linear(config.d_model, config.style_dim), nn.GELU(),
            nn.Linear(config.style_dim, config.d_model), nn.LayerNorm(config.d_model),
        )
        self.fusion_norm = nn.LayerNorm(config.d_model)

        self.token_embed = nn.Embedding(vocab_size, config.d_model, padding_idx=pad_id)
        self.token_pos = nn.Embedding(config.max_tokens, config.d_model)
        decoder_layer = nn.TransformerDecoderLayer(
            d_model=config.d_model, nhead=config.nhead, dim_feedforward=config.ff_dim,
            dropout=config.dropout, activation="gelu", batch_first=True, norm_first=True,
        )
        self.decoder = nn.TransformerDecoder(decoder_layer, config.decoder_layers,
                                             norm=nn.LayerNorm(config.d_model))
        self.output = nn.Linear(config.d_model, vocab_size)

        # Auxiliary writer-ID supervision forces the pooled representation to
        # carry hand/style information. It is training-only; unknown students do
        # not need a writer ID at inference time.
        self.writer_head = (nn.Linear(config.d_model, writer_classes)
                            if writer_classes > 1 else None)

        nn.init.normal_(self.stroke_modality, std=0.02)
        nn.init.normal_(self.raster_modality, std=0.02)

    @staticmethod
    def _masked_mean(x: torch.Tensor, valid: torch.Tensor) -> torch.Tensor:
        w = valid.to(x.dtype).unsqueeze(-1)
        return (x * w).sum(1) / w.sum(1).clamp_min(1.0)

    @staticmethod
    def _causal_mask(length: int, device: torch.device) -> torch.Tensor:
        return torch.triu(torch.full((length, length), float("-inf"), device=device), diagonal=1)

    def encode(self, points: torch.Tensor, point_valid: torch.Tensor,
               raster: torch.Tensor) -> tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
        """Return fused memory, its padding mask, and current-hand style vector."""
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

    def decode(self, memory: torch.Tensor, memory_pad: torch.Tensor,
               decoder_ids: torch.Tensor) -> torch.Tensor:
        b, n = decoder_ids.shape
        if n > self.config.max_tokens:
            raise ValueError(f"token sequence {n} exceeds max_tokens={self.config.max_tokens}")
        pos = torch.arange(n, device=decoder_ids.device)
        x = self.token_embed(decoder_ids) + self.token_pos(pos)[None, :, :]
        x = self.decoder(
            x, memory,
            tgt_mask=self._causal_mask(n, decoder_ids.device),
            tgt_key_padding_mask=decoder_ids.eq(self.pad_id),
            memory_key_padding_mask=memory_pad,
        )
        return self.output(x)

    def forward(self, points: torch.Tensor, point_valid: torch.Tensor,
                raster: torch.Tensor, decoder_ids: torch.Tensor):
        memory, memory_pad, style = self.encode(points, point_valid, raster)
        logits = self.decode(memory, memory_pad, decoder_ids)
        writer_logits = self.writer_head(style) if self.writer_head is not None else None
        return logits, writer_logits


class CoreMLStep(nn.Module):
    """Core ML-friendly wrapper for one autoregressive decoder pass.

    Swift owns the beam/greedy loop. Keeping the loop outside the network makes
    export deterministic and lets Pri change decoding policy without retraining.
    """

    def __init__(self, model: PriInkFoundation):
        super().__init__()
        self.model = model

    def forward(self, points: torch.Tensor, point_valid: torch.Tensor,
                raster: torch.Tensor, decoder_ids: torch.Tensor) -> torch.Tensor:
        logits, _ = self.model(points, point_valid, raster, decoder_ids)
        return logits
