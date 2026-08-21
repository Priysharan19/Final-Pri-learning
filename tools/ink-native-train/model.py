"""Stroke-native PRI mathematical-ink model.

The network keeps one representation per real ink point, then learns global
context with a Transformer encoder. CTC supplies sequence supervision without
fabricated trace-to-token alignment; the count head is deliberately independent
of CTC decoding so it can catch dropped/duplicated symbols at inference time.
"""
from __future__ import annotations

import math

import torch
from torch import nn

from features import FEATURE_COUNT
from vocabulary import TOKENS


class SinusoidalPosition(nn.Module):
    def __init__(self, dim: int, max_length: int = 4096):
        super().__init__()
        position = torch.arange(max_length, dtype=torch.float32).unsqueeze(1)
        div = torch.exp(torch.arange(0, dim, 2, dtype=torch.float32) * (-math.log(10000.0) / dim))
        pe = torch.zeros(max_length, dim, dtype=torch.float32)
        pe[:, 0::2] = torch.sin(position * div)
        pe[:, 1::2] = torch.cos(position * div)
        self.register_buffer("pe", pe, persistent=False)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        if x.size(1) > self.pe.size(0):
            raise ValueError(f"sequence length {x.size(1)} exceeds positional capacity {self.pe.size(0)}")
        return x + self.pe[: x.size(1)].unsqueeze(0).to(dtype=x.dtype, device=x.device)


class PriInkOnlineTransformer(nn.Module):
    """Compact on-device-oriented online HMER encoder.

    Inputs:
      points: [batch, time, 20]
      padding_mask: [batch, time], True for padded points

    Outputs:
      token_logits: [batch, time, vocabulary]
      count_logits: [batch, max_symbols + 1]
      quality_logits: [batch, 3] (clean/review/clarify), used only when labelled
    """

    def __init__(
        self,
        *,
        input_dim: int = FEATURE_COUNT,
        model_dim: int = 192,
        heads: int = 6,
        layers: int = 6,
        feedforward_dim: int = 768,
        dropout: float = 0.10,
        max_symbols: int = 96,
    ):
        super().__init__()
        if model_dim % heads:
            raise ValueError("model_dim must be divisible by heads")
        self.input_dim = input_dim
        self.model_dim = model_dim
        self.max_symbols = max_symbols
        self.input_projection = nn.Sequential(
            nn.Linear(input_dim, model_dim),
            nn.LayerNorm(model_dim),
            nn.GELU(),
        )
        self.position = SinusoidalPosition(model_dim)
        layer = nn.TransformerEncoderLayer(
            d_model=model_dim,
            nhead=heads,
            dim_feedforward=feedforward_dim,
            dropout=dropout,
            activation="gelu",
            batch_first=True,
            norm_first=True,
        )
        self.encoder = nn.TransformerEncoder(layer, num_layers=layers, norm=nn.LayerNorm(model_dim))
        self.token_head = nn.Linear(model_dim, len(TOKENS))
        self.count_head = nn.Sequential(
            nn.LayerNorm(model_dim),
            nn.Linear(model_dim, model_dim // 2),
            nn.GELU(),
            nn.Dropout(dropout),
            nn.Linear(model_dim // 2, max_symbols + 1),
        )
        # This head is architecturally available but MUST NOT receive a loss
        # unless the dataset provides explicit trust labels. We do not derive
        # fake 'quality' labels from whether CTC happened to be correct.
        self.quality_head = nn.Linear(model_dim, 3)

    def forward(
        self,
        points: torch.Tensor,
        padding_mask: torch.Tensor | None = None,
    ) -> dict[str, torch.Tensor]:
        if points.ndim != 3 or points.size(-1) != self.input_dim:
            raise ValueError(f"expected [B,T,{self.input_dim}] points, got {tuple(points.shape)}")
        hidden = self.position(self.input_projection(points))
        hidden = self.encoder(hidden, src_key_padding_mask=padding_mask)
        token_logits = self.token_head(hidden)

        if padding_mask is None:
            pooled = hidden.mean(dim=1)
        else:
            valid = (~padding_mask).unsqueeze(-1).to(hidden.dtype)
            pooled = (hidden * valid).sum(dim=1) / valid.sum(dim=1).clamp_min(1.0)
        return {
            "token_logits": token_logits,
            "count_logits": self.count_head(pooled),
            "quality_logits": self.quality_head(pooled),
            "embedding": pooled,
        }

    def config(self) -> dict[str, int]:
        return {
            "input_dim": self.input_dim,
            "model_dim": self.model_dim,
            "max_symbols": self.max_symbols,
            "vocabulary_size": len(TOKENS),
        }
