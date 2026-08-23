"""Data pipeline for Pri Ink V4 structural research.

Structural samples use the existing pri-ink-corpus envelope and may add:

  "structure": {
    "groups": [
      {"id": "g0", "symbol": "x", "strokes": [0, 1]},
      {"id": "g1", "symbol": "2", "strokes": [2]}
    ],
    "relations": [
      {"from": "g0", "to": "g1", "type": "SUPERSCRIPT"}
    ]
  }

Unannotated corpus rows remain usable by V3 and are skipped by V4 structural
training. Annotated rows are strict: every physical stroke must belong to exactly
one glyph, every glyph symbol must be a real model token, and every relation must
reference existing groups. Bad supervision fails loudly instead of poisoning the
model silently.
"""
from __future__ import annotations

import json
import math
import random
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

import numpy as np
import torch
from torch.utils.data import Dataset

from data import SPECIAL, TOKEN_TO_ID, canonical_text, rasterize
from structural import RELATION_TO_ID, StructuralConfig

IGNORE_INDEX = -100


@dataclass
class StructuralExample:
    writer: str
    split: str
    target: str
    strokes: list[dict]
    structure: dict
    source: str


def corpus_files(root: str | Path) -> list[Path]:
    p = Path(root)
    if p.is_file():
        return [p]
    return sorted(p.rglob("*.json"))


def validate_structure(structure: dict, stroke_count: int, require_complete: bool = True):
    """Validate trace-to-glyph supervision before any tensor is created."""
    if not isinstance(structure, dict):
        raise ValueError("structure must be an object")
    groups = structure.get("groups") or []
    relations = structure.get("relations") or []
    if not isinstance(groups, list) or not groups:
        raise ValueError("structure.groups must be a non-empty list")
    if not isinstance(relations, list):
        raise ValueError("structure.relations must be a list")

    ids: set[str] = set()
    seen_strokes: set[int] = set()
    for gi, group in enumerate(groups):
        if not isinstance(group, dict):
            raise ValueError(f"group {gi} is not an object")
        gid = str(group.get("id", "")).strip()
        if not gid:
            raise ValueError(f"group {gi} has no id")
        if gid in ids:
            raise ValueError(f"duplicate structural group id {gid!r}")
        ids.add(gid)

        token = str(group.get("symbol", ""))
        if token not in TOKEN_TO_ID or token in SPECIAL:
            raise ValueError(f"group {gid!r} has unsupported canonical symbol {token!r}")

        indices = group.get("strokes")
        if not isinstance(indices, list) or not indices:
            raise ValueError(f"group {gid!r} has no physical strokes")
        local_seen: set[int] = set()
        for raw in indices:
            if not isinstance(raw, int):
                raise ValueError(f"group {gid!r} contains non-integer stroke index {raw!r}")
            i = int(raw)
            if i < 0 or i >= stroke_count:
                raise ValueError(
                    f"group {gid!r} references stroke {i}, but sample has {stroke_count} strokes"
                )
            if i in local_seen:
                raise ValueError(f"group {gid!r} repeats stroke {i}")
            if i in seen_strokes:
                raise ValueError(f"physical stroke {i} belongs to multiple glyph groups")
            local_seen.add(i); seen_strokes.add(i)

    if require_complete and len(seen_strokes) != stroke_count:
        missing = sorted(set(range(stroke_count)) - seen_strokes)
        raise ValueError(
            f"structural annotation covers {len(seen_strokes)}/{stroke_count} strokes; "
            f"missing={missing[:12]}"
        )

    relation_keys: set[tuple[str, str, str]] = set()
    for ri, rel in enumerate(relations):
        if not isinstance(rel, dict):
            raise ValueError(f"relation {ri} is not an object")
        src = str(rel.get("from", "")); dst = str(rel.get("to", ""))
        kind = str(rel.get("type", "")).upper()
        if src not in ids or dst not in ids:
            raise ValueError(f"relation {ri} references unknown group {src!r}->{dst!r}")
        if src == dst:
            raise ValueError(f"relation {ri} is a self-edge on {src!r}")
        if kind not in RELATION_TO_ID or kind == "NONE":
            raise ValueError(f"relation {ri} has unsupported explicit type {kind!r}")
        key = (src, dst, kind)
        if key in relation_keys:
            raise ValueError(f"duplicate structural relation {src}->{dst}:{kind}")
        relation_keys.add(key)


def load_structural_examples(paths: Iterable[Path]) -> list[StructuralExample]:
    rows: list[StructuralExample] = []
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
            raise RuntimeError(
                f"writer leakage: {writer!r} appears in both {prior!r} and {split!r}"
            )
        writer_split[writer] = split
        for sample_index, sample in enumerate(doc.get("samples") or []):
            target = canonical_text(sample.get("target") or "").strip()
            strokes = sample.get("strokes") or []
            structure = sample.get("structure") or {}
            if target and strokes and structure.get("groups"):
                try:
                    validate_structure(structure, len(strokes), require_complete=True)
                except ValueError as exc:
                    raise ValueError(f"{path} sample {sample_index}: {exc}") from exc
                rows.append(
                    StructuralExample(writer, split, target, strokes, structure, str(path))
                )
    return rows


def _num(p: dict, name: str, default: float = 0.0) -> float:
    value = p.get(name, default)
    if isinstance(value, (int, float)) and math.isfinite(float(value)):
        return float(value)
    return default


def _expression_bounds(strokes: list[dict]):
    points = [p for stroke in strokes for p in (stroke.get("points") or [])]
    if not points:
        return 0.0, 0.0, 1.0, 1.0, 1.0
    xs = [_num(p, "x") for p in points]
    ys = [_num(p, "y") for p in points]
    x1, x2, y1, y2 = min(xs), max(xs), min(ys), max(ys)
    scale = max(x2 - x1, y2 - y1, 1.0)
    return x1, y1, x2, y2, scale


def augment_structural_strokes(strokes: list[dict]) -> list[dict]:
    """Small geometry/device perturbations for train-only domain adaptation.

    Stroke order and count are preserved exactly, so structural labels remain
    valid. The same transformed points feed both online features and the raster,
    keeping the two modalities aligned.
    """
    if not strokes:
        return strokes
    x1, y1, x2, y2, span = _expression_bounds(strokes)
    cx, cy = (x1 + x2) * 0.5, (y1 + y2) * 0.5

    angle = math.radians(random.uniform(-4.0, 4.0))
    ca, sa = math.cos(angle), math.sin(angle)
    sx = random.uniform(0.92, 1.08)
    sy = random.uniform(0.90, 1.10)
    shear = random.uniform(-0.08, 0.08)
    tx = random.uniform(-0.025, 0.025) * span
    ty = random.uniform(-0.025, 0.025) * span
    jitter = 0.0018 * span
    time_gain = random.uniform(0.86, 1.16)
    pressure_gain = random.uniform(0.88, 1.12)
    width_gain = random.uniform(0.90, 1.10)

    out: list[dict] = []
    for stroke in strokes:
        copy_stroke = {k: v for k, v in stroke.items() if k != "points"}
        new_points = []
        for p in stroke.get("points") or []:
            q = dict(p)
            px = _num(p, "x") - cx
            py = _num(p, "y") - cy
            px = sx * (px + shear * py)
            py = sy * py
            rx = ca * px - sa * py
            ry = sa * px + ca * py
            q["x"] = rx + cx + tx + random.gauss(0.0, jitter)
            q["y"] = ry + cy + ty + random.gauss(0.0, jitter)
            if isinstance(p.get("t"), (int, float)):
                q["t"] = float(p["t"]) * time_gain
            if isinstance(p.get("p"), (int, float)):
                q["p"] = max(0.0, min(2.0, float(p["p"]) * pressure_gain))
            if isinstance(p.get("force"), (int, float)):
                q["force"] = max(0.0, min(2.0, float(p["force"]) * pressure_gain))
            if isinstance(p.get("w"), (int, float)):
                q["w"] = max(0.2, float(p["w"]) * width_gain)
            new_points.append(q)
        copy_stroke["points"] = new_points
        out.append(copy_stroke)
    return out


def hierarchical_stroke_features(strokes: list[dict], cfg: StructuralConfig):
    """Return per-stroke point tensors with expression + local shape channels."""
    out = np.zeros(
        (cfg.max_strokes, cfg.max_points_per_stroke, cfg.feature_dim), dtype=np.float32
    )
    point_valid = np.zeros(
        (cfg.max_strokes, cfg.max_points_per_stroke), dtype=np.bool_
    )
    stroke_valid = np.zeros(cfg.max_strokes, dtype=np.bool_)
    geometry = np.zeros((cfg.max_strokes, cfg.geometry_dim), dtype=np.float32)

    if cfg.feature_dim != 18:
        raise ValueError(
            f"Pri Ink V4 local-shape pipeline requires feature_dim=18, got {cfg.feature_dim}. "
            "Rebuild stale V4 checkpoints after this representation change."
        )
    if len(strokes) > cfg.max_strokes:
        raise ValueError(
            f"sample has {len(strokes)} physical strokes; max_strokes={cfg.max_strokes}. "
            "Do not silently truncate structure supervision."
        )

    x1, y1, x2, y2, scale = _expression_bounds(strokes)
    cx_expr, cy_expr = (x1 + x2) * 0.5, (y1 + y2) * 0.5

    for si, stroke in enumerate(strokes):
        pts = stroke.get("points") or []
        if not pts:
            raise ValueError(f"physical stroke {si} has no points")
        stroke_valid[si] = True

        if len(pts) > cfg.max_points_per_stroke:
            idx = np.linspace(0, len(pts) - 1, cfg.max_points_per_stroke).round().astype(int)
            pts = [pts[i] for i in idx]

        xs = np.asarray([_num(p, "x") for p in pts], dtype=np.float32)
        ys = np.asarray([_num(p, "y") for p in pts], dtype=np.float32)
        sx1, sx2, sy1, sy2 = float(xs.min()), float(xs.max()), float(ys.min()), float(ys.max())
        width, height = max(sx2 - sx1, 1e-4), max(sy2 - sy1, 1e-4)
        local_scale = max(width, height, 1e-3)
        local_cx, local_cy = (sx1 + sx2) * 0.5, (sy1 + sy2) * 0.5
        length = 0.0
        previous = None

        for pi, p in enumerate(pts):
            raw_x, raw_y = _num(p, "x"), _num(p, "y")
            x = (raw_x - cx_expr) / scale
            y = (raw_y - cy_expr) / scale
            lx = (raw_x - local_cx) / local_scale
            ly = (raw_y - local_cy) / local_scale
            t = _num(p, "t", pi / 120.0)
            pressure = max(0.0, min(2.0, _num(p, "p", _num(p, "force")))) / 2.0
            width_pen = max(0.0, min(16.0, _num(p, "w", 3.0))) / 8.0
            az = _num(p, "azimuth")
            alt = _num(p, "altitude", math.pi / 2)

            if previous is None:
                dx = dy = ldx = ldy = dt = speed = 0.0
            else:
                dx, dy = x - previous[0], y - previous[1]
                ldx, ldy = lx - previous[2], ly - previous[3]
                dt = max(0.0, min(0.2, t - previous[4]))
                dist = math.hypot(dx, dy)
                length += dist
                speed = min(8.0, dist / max(dt, 1e-3)) / 8.0

            out[si, pi] = [
                x, y, dx, dy,
                lx, ly, ldx, ldy,
                min(dt, 0.2) / 0.2, speed,
                pressure, width_pen, math.sin(az), math.cos(az),
                max(0.0, min(1.0, alt / (math.pi / 2))),
                1.0 if pi == 0 else 0.0,
                1.0 if pi == len(pts) - 1 else 0.0,
                min(si, cfg.max_strokes - 1) / max(1, cfg.max_strokes - 1),
            ]
            point_valid[si, pi] = True
            previous = (x, y, lx, ly, t)

        geometry[si] = [
            ((sx1 + sx2) * 0.5 - cx_expr) / scale,
            ((sy1 + sy2) * 0.5 - cy_expr) / scale,
            width / scale,
            height / scale,
            math.log1p(width / max(height, 1e-4)),
            min(length, 4.0) / 4.0,
            min(len(pts), cfg.max_points_per_stroke) / cfg.max_points_per_stroke,
            si / max(1, cfg.max_strokes - 1),
        ]

    return out, point_valid, stroke_valid, geometry


def structural_targets(structure: dict, max_strokes: int):
    symbol = np.full(max_strokes, IGNORE_INDEX, dtype=np.int64)
    grouping = np.full((max_strokes, max_strokes), IGNORE_INDEX, dtype=np.float32)
    relations = np.full((max_strokes, max_strokes), IGNORE_INDEX, dtype=np.int64)

    groups = structure.get("groups") or []
    parsed: list[tuple[str, list[int], int]] = []
    for gi, group in enumerate(groups):
        gid = str(group.get("id", f"g{gi}"))
        strokes = sorted(int(i) for i in (group.get("strokes") or []) if 0 <= int(i) < max_strokes)
        if not strokes:
            continue
        token = str(group.get("symbol", ""))
        if token not in TOKEN_TO_ID or token in SPECIAL:
            raise ValueError(f"group {gid!r} has unsupported canonical symbol {token!r}")
        token_id = TOKEN_TO_ID[token]
        parsed.append((gid, strokes, token_id))
        for si in strokes:
            symbol[si] = token_id

    for left_gid, left_strokes, _ in parsed:
        for right_gid, right_strokes, _ in parsed:
            same = left_gid == right_gid
            for i in left_strokes:
                for j in right_strokes:
                    if i == j:
                        continue
                    grouping[i, j] = 1.0 if same else 0.0

    group_by_id = {gid: strokes for gid, strokes, _ in parsed}
    roots = {gid: strokes[0] for gid, strokes, _ in parsed}
    labelled_roots = list(roots.values())
    for i in labelled_roots:
        for j in labelled_roots:
            if i == j:
                continue
            relations[i, j] = RELATION_TO_ID["NONE"]

    for rel in structure.get("relations") or []:
        src = str(rel.get("from", "")); dst = str(rel.get("to", ""))
        kind = str(rel.get("type", "NONE")).upper()
        if src not in group_by_id or dst not in group_by_id:
            raise ValueError(f"relation references unknown group: {src!r}->{dst!r}")
        if kind not in RELATION_TO_ID or kind == "NONE":
            raise ValueError(f"unknown structural relation {kind!r}")
        relations[roots[src], roots[dst]] = RELATION_TO_ID[kind]

    return symbol, grouping, relations


class StructuralInkDataset(Dataset):
    def __init__(self, examples: list[StructuralExample], split: str, cfg: StructuralConfig):
        self.rows = [x for x in examples if x.split == split]
        self.split = split
        self.cfg = cfg

    def __len__(self):
        return len(self.rows)

    def __getitem__(self, index: int):
        row = self.rows[index]
        validate_structure(row.structure, len(row.strokes), require_complete=True)
        work_strokes = augment_structural_strokes(row.strokes) if self.split == "train" else row.strokes
        points, point_valid, stroke_valid, geometry = hierarchical_stroke_features(
            work_strokes, self.cfg
        )
        symbol, grouping, relations = structural_targets(row.structure, self.cfg.max_strokes)
        raster = rasterize(
            work_strokes, self.cfg.raster_height, self.cfg.raster_width, augment=False
        )
        return {
            "stroke_points": torch.from_numpy(points),
            "stroke_point_valid": torch.from_numpy(point_valid),
            "stroke_valid": torch.from_numpy(stroke_valid),
            "stroke_geometry": torch.from_numpy(geometry),
            "raster": torch.from_numpy(raster),
            "symbol_targets": torch.from_numpy(symbol),
            "group_targets": torch.from_numpy(grouping),
            "relation_targets": torch.from_numpy(relations),
            "target_text": row.target,
            "writer": row.writer,
        }
