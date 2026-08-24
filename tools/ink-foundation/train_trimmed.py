#!/usr/bin/env python3
"""Run train.py with point-stream padding trimmed per batch.

This is behavior-preserving: InkDataset still constructs the configured maximum
point capacity, then batching.trim_point_padding_collate removes only the
right-hand slots whose point_valid value is false for every sample in the batch.
PriInkFoundation already supports n <= max_points, while exported Core ML keeps
its fixed checkpoint max_points shape.
"""
from __future__ import annotations

from torch.utils.data import DataLoader as TorchDataLoader

import train
from batching import trim_point_padding_collate


def _trimmed_loader(*args, **kwargs):
    if kwargs.get("collate_fn") is not None:
        raise RuntimeError("train.py unexpectedly supplied its own collate_fn")
    kwargs["collate_fn"] = trim_point_padding_collate
    return TorchDataLoader(*args, **kwargs)


if __name__ == "__main__":
    train.DataLoader = _trimmed_loader
    train.main()
