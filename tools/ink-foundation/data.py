"""Dataset and feature pipeline for Pri Ink Foundation.

The release target is mathematical serialization, while the online auxiliary
alignment target is the sequence of marks that were physically drawn. Those are
not the same thing: x^(2) serializes layout using ^( ) even though the Pencil
contains only x and a raised 2. Keeping both targets explicit prevents CTC from
being trained to align invisible syntax to real strokes.
"""
from __future__ import annotations

import json
import math
import random
import re
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

import numpy as np
import torch
from PIL import Image, ImageDraw
from torch.utils.data import Dataset


SPECIAL = ["<pad>", "<bos>", "<eos>", "<unk>"]
WORDS = ["theta", "sqrt", "pi", "<=", ">=", "!="]
CHARS = list("0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ+-*/=().:^_<>!%,'") + ["±", "°"]
VOCAB = SPECIAL + WORDS + [c for c in CHARS if c not in WORDS]
TOKEN_TO_ID = {t: i for i, t in enumerate(VOCAB)}
ID_TO_TOKEN = {i: t for t, i in TOKEN_TO_ID.items()}
PAD_ID = TOKEN_TO_ID["<pad>"]
BOS_ID = TOKEN_TO_ID["<bos>"]
EOS_ID = TOKEN_TO_ID["<eos>"]
UNK_ID = TOKEN_TO_ID["<unk>"]


def canonical_text(text: str) -> str:
    return (str(text)
            .replace("×", "*")
            .replace("÷", "/")
            .replace("−", "-")
            .replace("′", "'")
            .replace("’", "'")
            .replace(" ", ""))


def tokenize(text: str) -> list[str]:
    text = canonical_text(text)
    out: list[str] = []
    i = 0
    longest = sorted(WORDS, key=len, reverse=True)
    while i < len(text):
        hit = next((w for w in longest if text.startswith(w, i)), None)
        if hit is not None:
            out.append(hit); i += len(hit)
        else:
            out.append(text[i]); i += 1
    return out


def encode(text: str, max_tokens: int) -> list[int]:
    ids = [TOKEN_TO_ID.get(t, UNK_ID) for t in tokenize(text)] + [EOS_ID]
    if len(ids) > max_tokens:
        raise ValueError(f"target has {len(ids)} tokens; max_tokens={max_tokens}: {text}")
    return ids


def physical_text(text: str) -> str:
    """Best deterministic physical-glyph sequence for online CTC supervision.

    Serialization-only wrappers are removed while genuinely drawn brackets are
    retained. The full decoder still sees the original target.
    """
    t = canonical_text(text)

    # Powers/subscripts: the raised/lowered glyph is real; ^, _, and the wrapper
    # parentheses are serialization. Apply repeatedly for multiple powers.
    old = None
    while old != t:
        old = t
        t = re.sub(r"\^\(([^()]*)\)", r"\1", t)
    t = re.sub(r"_([A-Za-z0-9])", r"\1", t)

    # sqrt is one physical radical glyph followed by the radicand. Its wrapper
    # parentheses are not written as ordinary brackets.
    old = None
    while old != t:
        old = t
        t = re.sub(r"sqrt\(([^()]*)\)", r"sqrt\1", t)

    # Canonical vertical fractions are serialized as (num)/(den). The grouping
    # parentheses are not Pencil marks; the fraction bar remains one physical
    # mark represented by '/'. Ordinary algebraic parentheses do not match this
    # complete fraction form and are preserved.
    fraction = re.fullmatch(r"\(([^()]*)\)/\(([^()]*)\)", t)
    if fraction:
        t = f"{fraction.group(1)}/{fraction.group(2)}"
    return t


def encode_physical(text: str, max_tokens: int) -> list[int]:
    ids = [TOKEN_TO_ID.get(t, UNK_ID) for t in tokenize(physical_text(text))]
    if len(ids) > max_tokens:
        raise ValueError(f"physical target has {len(ids)} tokens; max_tokens={max_tokens}: {text}")
    return ids


def decode(ids: Iterable[int]) -> str:
    out = []
    for i in ids:
        token = ID_TO_TOKEN.get(int(i), "<unk>")
        if token == "<eos>": break
        if token in SPECIAL: continue
        out.append(token)
    return "".join(out)


@dataclass
class Example:
    writer: str
    split: str
    target: str
    strokes: list[dict]
    source: str


def load_examples(paths: Iterable[Path]) -> list[Example]:
    rows: list[Example] = []
    writer_split: dict[str, str] = {}
    for path in paths:
        with path.open("r", encoding="utf-8") as f:
            doc = json.load(f)
        if doc.get("format") != "pri-ink-corpus" or int(doc.get("version", 0)) < 2:
            continue
        split = str(doc.get("split", "train"))
        writer = str((doc.get("writer") or {}).get("id") or "unknown")
        prior = writer_split.get(writer)
        if prior is not None and prior != split:
            raise RuntimeError(f"writer leakage: {writer!r} appears in both {prior!r} and {split!r}")
        writer_split[writer] = split
        for sample in doc.get("samples") or []:
            target = canonical_text(sample.get("target") or "").strip()
            strokes = sample.get("strokes") or []
            if target and strokes:
                rows.append(Example(writer, split, target, strokes, str(path)))
    return rows


def corpus_files(root: str | Path) -> list[Path]:
    p = Path(root)
    if p.is_file(): return [p]
    return sorted(p.rglob("*.json"))


def _point_num(p: dict, *names: str, default: float = 0.0) -> float:
    for name in names:
        value = p.get(name)
        if isinstance(value, (int, float)) and math.isfinite(float(value)):
            return float(value)
    return default


def point_features(strokes: list[dict], max_points: int, augment: bool = False) -> tuple[np.ndarray, np.ndarray]:
    raw = []
    for si, stroke in enumerate(strokes):
        pts = stroke.get("points") or []
        for pi, p in enumerate(pts): raw.append((si, pi, p, len(pts)))
    if not raw:
        return np.zeros((max_points, 14), np.float32), np.zeros(max_points, np.bool_)

    xs = np.array([_point_num(x[2], "x") for x in raw], dtype=np.float32)
    ys = np.array([_point_num(x[2], "y") for x in raw], dtype=np.float32)
    min_x, max_x = float(xs.min()), float(xs.max())
    min_y, max_y = float(ys.min()), float(ys.max())
    scale = max(max_x - min_x, max_y - min_y, 1.0)
    cx, cy = (min_x + max_x) * 0.5, (min_y + max_y) * 0.5

    shear = random.uniform(-0.10, 0.10) if augment else 0.0
    global_scale = random.uniform(0.92, 1.08) if augment else 1.0
    pressure_gain = random.uniform(0.90, 1.10) if augment else 1.0
    time_gain = random.uniform(0.85, 1.18) if augment else 1.0
    x_jitter = random.uniform(-0.015, 0.015) if augment else 0.0
    y_jitter = random.uniform(-0.015, 0.015) if augment else 0.0

    seq = []
    previous = None
    for si, pi, p, stroke_len in raw:
        x = ((_point_num(p, "x") - cx) / scale) * global_scale + x_jitter
        y = ((_point_num(p, "y") - cy) / scale) * global_scale + y_jitter
        x = x - shear * y
        t = _point_num(p, "t", default=pi / 120.0) * time_gain
        force = max(0.0, min(2.0, _point_num(p, "p", "force") * pressure_gain))
        width = max(0.0, min(16.0, _point_num(p, "w", default=3.0))) / 8.0

        az = _point_num(p, "azimuth")
        alt = _point_num(p, "altitude", default=math.pi / 2)
        if "azimuth" not in p and ("tiltX" in p or "tiltY" in p):
            tx = math.radians(_point_num(p, "tiltX")); ty = math.radians(_point_num(p, "tiltY"))
            az = math.atan2(ty, tx) if abs(tx) + abs(ty) > 1e-6 else 0.0
            alt = max(0.0, min(math.pi / 2, math.pi / 2 - math.hypot(tx, ty)))

        if previous is None or previous[0] != si:
            dx = dy = dt = speed = 0.0
        else:
            dx, dy = x - previous[1], y - previous[2]
            dt = max(0.0, min(0.2, t - previous[3]))
            speed = min(8.0, math.hypot(dx, dy) / max(dt, 1e-3)) / 8.0
        start = 1.0 if pi == 0 else 0.0
        end = 1.0 if pi == stroke_len - 1 else 0.0
        seq.append([
            x, y, dx, dy, min(dt, 0.2) / 0.2, speed,
            force / 2.0, width,
            math.sin(az), math.cos(az), alt / (math.pi / 2),
            start, end, min(si, 31) / 31.0,
        ])
        previous = (si, x, y, t)

    arr = np.asarray(seq, dtype=np.float32)
    if augment and len(arr) > 40:
        keep = np.ones(len(arr), dtype=bool)
        candidate = np.where((arr[:, 11] < 0.5) & (arr[:, 12] < 0.5))[0]
        n_drop = int(len(candidate) * random.uniform(0.0, 0.04))
        if n_drop:
            keep[np.random.choice(candidate, n_drop, replace=False)] = False
            arr = arr[keep]

    if len(arr) > max_points:
        idx = np.linspace(0, len(arr) - 1, max_points).round().astype(np.int64)
        arr = arr[idx]

    out = np.zeros((max_points, 14), dtype=np.float32)
    valid = np.zeros(max_points, dtype=np.bool_)
    out[:len(arr)] = arr; valid[:len(arr)] = True
    return out, valid


def rasterize(strokes: list[dict], height: int, width: int, augment: bool = False) -> np.ndarray:
    pts = [p for s in strokes for p in (s.get("points") or [])]
    if not pts: return np.zeros((1, height, width), dtype=np.float32)
    xs = [_point_num(p, "x") for p in pts]; ys = [_point_num(p, "y") for p in pts]
    x1, x2, y1, y2 = min(xs), max(xs), min(ys), max(ys)
    span_x, span_y = max(x2 - x1, 1.0), max(y2 - y1, 1.0)
    pad = 8
    scale = min((width - 2 * pad) / span_x, (height - 2 * pad) / span_y)
    ox = (width - span_x * scale) * 0.5 - x1 * scale
    oy = (height - span_y * scale) * 0.5 - y1 * scale

    image = Image.new("L", (width, height), 0); draw = ImageDraw.Draw(image)
    for stroke in strokes:
        points = stroke.get("points") or []
        if not points: continue
        xy = [(_point_num(p, "x") * scale + ox, _point_num(p, "y") * scale + oy) for p in points]
        avg_w = sum(_point_num(p, "w", default=3.0) for p in points) / len(points)
        pen = max(1, int(round(avg_w * max(scale, 0.5))))
        if len(xy) == 1:
            x, y = xy[0]; r = max(1, pen // 2); draw.ellipse((x-r, y-r, x+r, y+r), fill=255)
        else:
            draw.line(xy, fill=255, width=pen, joint="curve")
    arr = np.asarray(image, dtype=np.float32) / 255.0
    if augment:
        if random.random() < 0.25: arr = np.clip(arr * random.uniform(0.90, 1.08), 0, 1)
        if random.random() < 0.35:
            sx, sy = random.randint(-3, 3), random.randint(-2, 2)
            arr = np.roll(arr, shift=(sy, sx), axis=(0, 1))
            if sy > 0: arr[:sy, :] = 0
            elif sy < 0: arr[sy:, :] = 0
            if sx > 0: arr[:, :sx] = 0
            elif sx < 0: arr[:, sx:] = 0
    return arr[None, :, :]


class InkDataset(Dataset):
    def __init__(self, examples: list[Example], split: str, max_points: int,
                 max_tokens: int, raster_height: int, raster_width: int,
                 writer_to_id: dict[str, int]):
        self.rows = [x for x in examples if x.split == split]
        self.split = split; self.max_points = max_points; self.max_tokens = max_tokens
        self.raster_height = raster_height; self.raster_width = raster_width
        self.writer_to_id = writer_to_id

    def __len__(self): return len(self.rows)

    def __getitem__(self, index: int):
        row = self.rows[index]; augment = self.split == "train"
        points, valid = point_features(row.strokes, self.max_points, augment=augment)
        raster = rasterize(row.strokes, self.raster_height, self.raster_width, augment=augment)

        ids = encode(row.target, self.max_tokens)
        padded = np.full(self.max_tokens, PAD_ID, dtype=np.int64); padded[:len(ids)] = ids

        physical = encode_physical(row.target, self.max_tokens)
        ctc = np.full(self.max_tokens, PAD_ID, dtype=np.int64); ctc[:len(physical)] = physical
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
