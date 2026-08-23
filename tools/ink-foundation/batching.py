"""Batch collation helpers for Pri Ink Foundation training.

The runtime/export graph intentionally keeps a fixed maximum point capacity, but
training does not need to run self-attention across zero padding. Each example is
still featurized at the checkpoint's configured max_points; this collator only
trims a batch to the longest *valid* point sequence in that batch. No real point
is dropped and target/raster tensors are unchanged.
"""
from __future__ import annotations

import torch
from torch.utils.data import default_collate


def trim_point_padding_collate(rows: list[dict]) -> dict:
    """Default-collate a batch, then remove point-stream padding on the right."""
    batch = default_collate(rows)
    points = batch.get("points")
    valid = batch.get("point_valid")
    if not isinstance(points, torch.Tensor) or not isinstance(valid, torch.Tensor):
        raise RuntimeError("Pri Ink batch is missing points/point_valid tensors")
    if points.ndim != 3 or valid.ndim != 2 or points.shape[:2] != valid.shape:
        raise RuntimeError(
            f"invalid Pri Ink point batch shapes: points={tuple(points.shape)} valid={tuple(valid.shape)}"
        )

    lengths = valid.to(torch.long).sum(dim=1)
    longest = max(1, int(lengths.max().item())) if lengths.numel() else 1
    if longest > points.shape[1]:
        raise RuntimeError(
            f"valid point length {longest} exceeds padded capacity {points.shape[1]}"
        )

    batch["points"] = points[:, :longest, :].contiguous()
    batch["point_valid"] = valid[:, :longest].contiguous()
    return batch
