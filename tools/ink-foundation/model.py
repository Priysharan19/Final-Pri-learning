"""Pri Learning local handwriting foundation model.

V3 is deliberately built around the failure modes of handwritten mathematics,
not generic OCR:
  * original Pencil point stream -> stroke Transformer;
  * high-resolution raster -> a TRUE 2-D visual token grid (row + column position
    survive; superscripts/fractions are not vertically averaged away);
  * cross-modal writer/style representation from stroke AND 2-D visual evidence;
  * parallel whole-expression decoder for one-call Core ML inference;
  * training-only CTC alignment head over the online point sequence, so the
    encoder learns monotonic symbol evidence instead of relying only on a
    sequence-level loss.

The CTC head and writer/style supervision are training aids. Production still
uses one Core ML invocation and the parallel decoder, preserving low latency.
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
    architecture_version: int = 3

    def to_dict(self):
        return asdict(self)


class RasterEncoder(nn.Module):
    """2-D visual encoder that never collapses vertical layout.

    The previous implementation averaged H' after the CNN. That made an x² and
    an x with a low 2 much more alike than they should be and weakened stacked
    fractions for the same reason. V3 flattens the H'×W' map into tokens and
    attaches learned row/column coordinates before fusion.
    """

    def __init__(self, d_model: int):
        super().__init__()
        self.net = nn.Sequential(
            nn.Conv2d(1, 32, 5, stride=(2, 2), padding=2), nn.GELU(),
            nn.Conv2d(32, 64, 3, stride=(2, 2), padding=1), nn.GELU(),
            nn.Conv2d(64, 128, 3, stride=(2, 2), padding=1), nn.GELU(),
            nn.Conv2d(128, 192, 3, stride=(2, 1), padding=1), nn.GELU(),
            nn.Conv2d(192, d_model, 3, stride=(2, 1), padding=1), nn.GELU(),
        )
        # Current 128×512 input yields 4×64 tokens. These generous limits keep
        # checkpoints compatible with moderately larger future raster sizes.
        self.row_pos = nn.Embedding(32, d_model)
        self.col_pos = nn.Embedding(256, d_model)
        self.norm = nn.LayerNorm(d_model)

    def forward(self, image: torch.Tensor) -> torch.Tensor:
        x = self.net(image)                         # B,D,H',W'
        b, d, h, w = x.shape
        if h > self.row_pos.num_embeddings or w > self.col_pos.num_embeddings:
            raise ValueError(f"visual grid {h}x{w} exceeds positional capacity")
        rows = torch.arange(h, device=x.device).repeat_interleave(w)
        cols = torch.arange(w, device=x.device).repeat(h)
        tokens = x.permute(0, 2, 3, 1).reshape(b, h * w, d)
        tokens = tokens + self.row_pos(rows)[None, :, :] + self.col_pos(cols)[None, :, :]
        return self.norm(tokens)


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

        # Writer style must not be inferred from the point stream alone. V3
        # pools both encoded modalities and learns a shared representation. This
        # gives local CNN adaptation a direct route into writer/style conditioning
        # while preserving all 2-D visual tokens for the main decoder.
        self.style_encoder = nn.Sequential(
            nn.Linear(config.d_model * 2, config.style_dim), nn.GELU(),
            nn.Linear(config.style_dim, config.d_model), nn.LayerNorm(config.d_model),
        )
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

        # Training-only auxiliary alignment. PAD is used as the CTC blank; PAD
        # never occurs in target text, so no extra release vocabulary is needed.
        self.ctc_output = nn.Linear(config.d_model, vocab_size)

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
               raster: torch.Tensor) -> tuple[torch.Tensor, torch.Tensor, torch.Tensor, torch.Tensor]:
        """Return fused memory, padding mask, cross-modal style, and stroke tokens."""
        b, n, _ = points.shape
        if n > self.config.max_points:
            raise ValueError(f"point sequence {n} exceeds max_points={self.config.max_points}")

        pos = torch.arange(n, device=points.device)
        stroke = self.point_proj(points) + self.point_pos(pos)[None, :, :] + self.stroke_modality
        stroke = self.stroke_encoder(stroke, src_key_padding_mask=~point_valid)

        # Compute unconditioned visual tokens first so the style embedding can
        # actually learn writer-specific CNN morphology. Style is then fed back
        # into both modalities before whole-expression decoding.
        visual_base = self.raster_encoder(raster) + self.raster_modality
        pooled_stroke = self._masked_mean(stroke, point_valid)
        pooled_visual = visual_base.mean(dim=1)
        style = self.style_encoder(torch.cat([pooled_stroke, pooled_visual], dim=-1))

        styled_stroke = stroke + style[:, None, :]
        visual = visual_base + style[:, None, :]
        visual_valid = torch.ones((b, visual.shape[1]), dtype=torch.bool, device=visual.device)

        memory = self.fusion_norm(torch.cat([styled_stroke, visual], dim=1))
        memory_valid = torch.cat([point_valid, visual_valid], dim=1)
        return memory, ~memory_valid, style, stroke

    def decode(self, memory: torch.Tensor, memory_pad: torch.Tensor) -> torch.Tensor:
        b = memory.shape[0]
        positions = torch.arange(self.config.max_tokens, device=memory.device)
        q = self.output_queries(positions) + self.output_pos(positions)
        q = q.unsqueeze(0).expand(b, -1, -1)
        decoded = self.decoder(q, memory, memory_key_padding_mask=memory_pad)
        return self.output(decoded)

    def forward_with_aux(self, points: torch.Tensor, point_valid: torch.Tensor,
                         raster: torch.Tensor):
        memory, memory_pad, style, stroke = self.encode(points, point_valid, raster)
        logits = self.decode(memory, memory_pad)
        writer_logits = self.writer_head(style) if self.writer_head is not None else None
        ctc_logits = self.ctc_output(stroke)
        return logits, writer_logits, ctc_logits, style

    def forward(self, points: torch.Tensor, point_valid: torch.Tensor,
                raster: torch.Tensor):
        memory, memory_pad, style, _ = self.encode(points, point_valid, raster)
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
