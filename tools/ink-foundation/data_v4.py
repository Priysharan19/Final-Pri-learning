"""Pri Ink Foundation V4 data contract.

V3's vocabulary is frozen because old checkpoints/Core ML assets depend on its
exact token IDs. V4 extends it *append-only* instead of mutating `data.py`.

The first extension is the integral sign. The live v8 real-Pencil collector
already records targets containing `∫`; under V3 that character becomes <unk>
and decode drops it, making correct integral recognition impossible. Keeping the
extension here lets V3 remain reproducible while V4 can actually learn the data
we collect.
"""
from __future__ import annotations

from typing import Iterable

import numpy as np
import torch
from torch.utils.data import Dataset

import data as v3


V4_EXTRA_TOKENS = ["∫"]
SPECIAL = v3.SPECIAL
WORDS = v3.WORDS
VOCAB = list(v3.VOCAB) + [token for token in V4_EXTRA_TOKENS if token not in v3.VOCAB]
TOKEN_TO_ID = {token: index for index, token in enumerate(VOCAB)}
ID_TO_TOKEN = {index: token for token, index in TOKEN_TO_ID.items()}
PAD_ID = TOKEN_TO_ID["<pad>"]
BOS_ID = TOKEN_TO_ID["<bos>"]
EOS_ID = TOKEN_TO_ID["<eos>"]
UNK_ID = TOKEN_TO_ID["<unk>"]

# Geometry/corpus primitives are intentionally shared with V3. Only the target
# serialization vocabulary changes.
Example = v3.Example
canonical_text = v3.canonical_text
corpus_files = v3.corpus_files
load_examples = v3.load_examples
point_features = v3.point_features
rasterize = v3.rasterize
physical_text = v3.physical_text
tokenize = v3.tokenize


def encode(text: str, max_tokens: int) -> list[int]:
    ids = [TOKEN_TO_ID.get(token, UNK_ID) for token in tokenize(text)] + [EOS_ID]
    if len(ids) > max_tokens:
        raise ValueError(
            f"target has {len(ids)} tokens; max_tokens={max_tokens}: {text}"
        )
    return ids


def encode_physical(text: str, max_tokens: int) -> list[int]:
    ids = [
        TOKEN_TO_ID.get(token, UNK_ID)
        for token in tokenize(physical_text(text))
    ]
    if len(ids) > max_tokens:
        raise ValueError(
            f"physical target has {len(ids)} tokens; max_tokens={max_tokens}: {text}"
        )
    return ids


def decode(ids: Iterable[int]) -> str:
    out = []
    for raw_id in ids:
        token = ID_TO_TOKEN.get(int(raw_id), "<unk>")
        if token == "<eos>":
            break
        if token in SPECIAL:
            continue
        out.append(token)
    return "".join(out)


class InkDatasetV4(Dataset):
    """Frozen-split dataset using V4's append-only target vocabulary."""

    def __init__(
        self,
        examples: list[Example],
        split: str,
        max_points: int,
        max_tokens: int,
        raster_height: int,
        raster_width: int,
        writer_to_id: dict[str, int],
    ):
        self.rows = [example for example in examples if example.split == split]
        self.split = split
        self.max_points = max_points
        self.max_tokens = max_tokens
        self.raster_height = raster_height
        self.raster_width = raster_width
        self.writer_to_id = writer_to_id

    def __len__(self):
        return len(self.rows)

    def __getitem__(self, index: int):
        row = self.rows[index]
        augment = self.split == "train"
        points, valid = point_features(row.strokes, self.max_points, augment=augment)
        raster = rasterize(
            row.strokes, self.raster_height, self.raster_width, augment=augment
        )

        ids = encode(row.target, self.max_tokens)
        padded = np.full(self.max_tokens, PAD_ID, dtype=np.int64)
        padded[: len(ids)] = ids

        physical = encode_physical(row.target, self.max_tokens)
        ctc = np.full(self.max_tokens, PAD_ID, dtype=np.int64)
        ctc[: len(physical)] = physical
        return {
            "points": torch.from_numpy(points),
            "point_valid": torch.from_numpy(valid),
            "raster": torch.from_numpy(raster),
            "tokens": torch.from_numpy(padded),
            "ctc_tokens": torch.from_numpy(ctc),
            "ctc_length": torch.tensor(len(physical), dtype=torch.long),
            "writer": torch.tensor(self.writer_to_id[row.writer], dtype=torch.long),
            "target_text": canonical_text(row.target),
            "physical_text": physical_text(row.target),
        }
