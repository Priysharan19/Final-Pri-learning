"""Pri Ink Foundation V4: writer-adaptive *and* writer-invariant mathematics.

V3 deliberately learned a writer/style vector and fed it back into both
modalities.  That is useful for personalization, but a powerful recognizer also
needs a content pathway that is discouraged from encoding writer identity.

V4 keeps the V3 style route for adaptation and adds three generalisation tools:
  * a gradient-reversal writer adversary on pooled mathematical content;
  * stochastic style dropout, so decoding cannot depend on knowing the hand;
  * an explicit content embedding used for cross-view consistency training.

The adversarial/style heads are training-only.  Core ML inference remains one
call with the same three runtime inputs: point features, point mask and raster.
"""
from __future__ import annotations

import torch
from torch import nn
from torch.autograd import Function

from model import ModelConfig, RasterEncoder


class _GradientReverse(Function):
    @staticmethod
    def forward(ctx, x: torch.Tensor, strength: float):
        ctx.strength = float(strength)
        return x.view_as(x)

    @staticmethod
    def backward(ctx, grad_output: torch.Tensor):
        return -ctx.strength * grad_output, None


def gradient_reverse(x: torch.Tensor, strength: float = 1.0) -> torch.Tensor:
    return _GradientReverse.apply(x, float(strength))


class PriInkFoundationV4(nn.Module):
    def __init__(self, vocab_size: int, pad_id: int, config: ModelConfig,
                 writer_classes: int = 0, style_dropout: float = 0.20):
        super().__init__()
        self.config = config
        self.vocab_size = vocab_size
        self.pad_id = pad_id
        self.style_dropout = float(style_dropout)

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

        # Name/shape intentionally match V3 so a strong V3 checkpoint can seed
        # the style representation without throwing away learned morphology.
        self.style_encoder = nn.Sequential(
            nn.Linear(config.d_model * 2, config.style_dim), nn.GELU(),
            nn.Linear(config.style_dim, config.d_model), nn.LayerNorm(config.d_model),
        )
        self.content_norm = nn.LayerNorm(config.d_model)
        self.fusion_norm = nn.LayerNorm(config.d_model)

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
        self.ctc_output = nn.Linear(config.d_model, vocab_size)

        self.writer_head = (
            nn.Linear(config.d_model, writer_classes) if writer_classes > 1 else None
        )
        self.content_writer_head = (
            nn.Linear(config.d_model, writer_classes) if writer_classes > 1 else None
        )

        nn.init.normal_(self.stroke_modality, std=0.02)
        nn.init.normal_(self.raster_modality, std=0.02)
        nn.init.normal_(self.output_queries.weight, std=0.02)

    @staticmethod
    def _masked_mean(x: torch.Tensor, valid: torch.Tensor) -> torch.Tensor:
        weight = valid.to(x.dtype).unsqueeze(-1)
        return (x * weight).sum(1) / weight.sum(1).clamp_min(1.0)

    def _maybe_drop_style(self, style: torch.Tensor) -> torch.Tensor:
        if not self.training or self.style_dropout <= 0:
            return style
        keep = torch.rand((style.shape[0], 1), device=style.device) >= self.style_dropout
        # Scale retained samples so expected style magnitude stays stable.
        return style * keep.to(style.dtype) / max(1.0 - self.style_dropout, 1e-6)

    def encode(self, points: torch.Tensor, point_valid: torch.Tensor,
               raster: torch.Tensor):
        b, n, _ = points.shape
        if n > self.config.max_points:
            raise ValueError(f"point sequence {n} exceeds max_points={self.config.max_points}")

        positions = torch.arange(n, device=points.device)
        stroke = self.point_proj(points) + self.point_pos(positions)[None, :, :] + self.stroke_modality
        stroke = self.stroke_encoder(stroke, src_key_padding_mask=~point_valid)

        visual_base = self.raster_encoder(raster) + self.raster_modality
        pooled_stroke = self._masked_mean(stroke, point_valid)
        pooled_visual = visual_base.mean(dim=1)

        style = self.style_encoder(torch.cat([pooled_stroke, pooled_visual], dim=-1))
        # This representation is intentionally simple and directly connected to
        # both encoders.  Gradient reversal on it therefore teaches the encoders
        # to discard writer identity while the parallel style route is still free
        # to retain it for adaptation.
        content = self.content_norm(0.5 * (pooled_stroke + pooled_visual))

        applied_style = self._maybe_drop_style(style)
        styled_stroke = stroke + applied_style[:, None, :]
        styled_visual = visual_base + applied_style[:, None, :]
        visual_valid = torch.ones(
            (b, styled_visual.shape[1]), dtype=torch.bool, device=styled_visual.device
        )
        memory = self.fusion_norm(torch.cat([styled_stroke, styled_visual], dim=1))
        memory_valid = torch.cat([point_valid, visual_valid], dim=1)
        return memory, ~memory_valid, style, content, stroke

    def decode(self, memory: torch.Tensor, memory_pad: torch.Tensor) -> torch.Tensor:
        b = memory.shape[0]
        positions = torch.arange(self.config.max_tokens, device=memory.device)
        queries = self.output_queries(positions) + self.output_pos(positions)
        queries = queries.unsqueeze(0).expand(b, -1, -1)
        decoded = self.decoder(queries, memory, memory_key_padding_mask=memory_pad)
        return self.output(decoded)

    def forward_with_aux(self, points: torch.Tensor, point_valid: torch.Tensor,
                         raster: torch.Tensor, adversary_strength: float = 1.0):
        memory, memory_pad, style, content, stroke = self.encode(points, point_valid, raster)
        logits = self.decode(memory, memory_pad)
        style_writer_logits = self.writer_head(style) if self.writer_head is not None else None
        content_writer_logits = (
            self.content_writer_head(gradient_reverse(content, adversary_strength))
            if self.content_writer_head is not None else None
        )
        ctc_logits = self.ctc_output(stroke)
        return logits, style_writer_logits, content_writer_logits, ctc_logits, style, content

    def forward(self, points: torch.Tensor, point_valid: torch.Tensor,
                raster: torch.Tensor):
        memory, memory_pad, style, _, _ = self.encode(points, point_valid, raster)
        logits = self.decode(memory, memory_pad)
        writer_logits = self.writer_head(style) if self.writer_head is not None else None
        return logits, writer_logits


class CoreMLModelV4(nn.Module):
    """Inference-only wrapper; auxiliary generalisation heads are not exported."""
    def __init__(self, model: PriInkFoundationV4):
        super().__init__()
        self.model = model

    def forward(self, points: torch.Tensor, point_valid: torch.Tensor,
                raster: torch.Tensor) -> torch.Tensor:
        logits, _ = self.model(points, point_valid, raster)
        return logits
