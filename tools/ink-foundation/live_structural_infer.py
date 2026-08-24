#!/usr/bin/env python3
"""Persistent Pri Ink Structural V4 inference worker for LAN development testing.

This is deliberately NOT a production runtime. It loads a research-only V4
same-writer checkpoint once, reads JSON-lines requests from stdin, and writes one
JSON response per request to stdout. `scripts/serve-lan.mjs --v4-dev` owns the
HTTP boundary and keeps this worker local to the developer Mac.

The worker exists so physical iPad testing can exercise the actual V4 research
model instead of silently falling back to the legacy browser recogniser.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import sys
import traceback
from pathlib import Path

import torch

from data import TOKEN_TO_ID, rasterize
from structural import PriInkStructuralV4, StructuralConfig
from structural_data import hierarchical_stroke_features
from structural_decoder_registry import DECODER_NAMES, decode_structural_selected

ENGINE = "pri-structural-v4-dev-lan"


def _device(name: str) -> torch.device:
    if name != "auto":
        return torch.device(name)
    if torch.cuda.is_available():
        return torch.device("cuda")
    if torch.backends.mps.is_available():
        return torch.device("mps")
    return torch.device("cpu")


def _num(value, default=0.0) -> float:
    try:
        x = float(value)
        return x if math.isfinite(x) else float(default)
    except (TypeError, ValueError):
        return float(default)


def _stroke_box(stroke: dict) -> dict:
    pts = stroke.get("points") or []
    if not pts:
        return {"x1": 0.0, "y1": 0.0, "x2": 0.0, "y2": 0.0, "w": 0.0, "h": 0.0, "cx": 0.0, "cy": 0.0}
    xs = [_num(p.get("x")) for p in pts]
    ys = [_num(p.get("y")) for p in pts]
    x1, x2, y1, y2 = min(xs), max(xs), min(ys), max(ys)
    return {
        "x1": x1, "y1": y1, "x2": x2, "y2": y2,
        "w": max(0.0, x2 - x1), "h": max(0.0, y2 - y1),
        "cx": (x1 + x2) * 0.5, "cy": (y1 + y2) * 0.5,
    }


def _union_box(boxes: list[dict]) -> dict:
    if not boxes:
        return {"x": 0.0, "y": 0.0, "w": 0.0, "h": 0.0, "x1": 0.0, "y1": 0.0, "x2": 0.0, "y2": 0.0}
    x1 = min(b["x1"] for b in boxes); y1 = min(b["y1"] for b in boxes)
    x2 = max(b["x2"] for b in boxes); y2 = max(b["y2"] for b in boxes)
    return {"x": x1, "y": y1, "w": x2 - x1, "h": y2 - y1, "x1": x1, "y1": y1, "x2": x2, "y2": y2}


def _median(values: list[float], fallback: float = 20.0) -> float:
    clean = sorted(v for v in values if math.isfinite(v) and v > 0)
    return clean[len(clean) // 2] if clean else fallback


def _line_partitions(strokes: list[dict]) -> list[list[int]]:
    """Conservative raw-stroke row clustering for multi-line working.

    V4 is expression-level, so each written row is decoded independently. The
    graph uses vertical band overlap plus a glyph-scale centre distance. Raised
    exponents remain attached to their baseline row, while genuinely separate
    working lines do not get fed to one expression decoder. A lone tiny speck far
    from all real writing is dropped as pointer/tap noise, not promoted to a row.
    """
    n = len(strokes)
    if n <= 1:
        return [list(range(n))] if n else []
    boxes = [_stroke_box(s) for s in strokes]
    scales = [max(b["h"], min(b["w"], max(1.0, b["h"] * 2.5))) for b in boxes]
    scale = max(8.0, _median(scales, 20.0))
    parent = list(range(n))

    def find(i: int) -> int:
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    def union(a: int, b: int):
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[rb] = ra

    for i in range(n):
        a = boxes[i]
        for j in range(i + 1, n):
            b = boxes[j]
            y_overlap = min(a["y2"], b["y2"]) - max(a["y1"], b["y1"])
            min_h = max(1.0, min(max(a["h"], 0.35 * a["w"]), max(b["h"], 0.35 * b["w"])))
            centre_dy = abs(a["cy"] - b["cy"])
            x_gap = max(a["x1"], b["x1"]) - min(a["x2"], b["x2"])
            band = y_overlap > 0.20 * min_h or centre_dy < 0.72 * scale
            nearby = x_gap < 1.35 * scale
            # Long horizontal bars connect numerator/denominator to the same row.
            bar_bridge = (
                max(a["w"], b["w"]) > 1.4 * scale
                and centre_dy < 1.55 * scale
                and x_gap < 0.45 * scale
            )
            if (band and nearby) or bar_bridge:
                union(i, j)

    groups: dict[int, list[int]] = {}
    for i in range(n):
        groups.setdefault(find(i), []).append(i)
    rows = list(groups.values())

    # Attach a tiny raised/sunken mark (prime, dot, exponent fragment) to the
    # nearest substantial row when geometry says it belongs there.
    substantial = [r for r in rows if len(r) > 1 or max(boxes[r[0]]["w"], boxes[r[0]]["h"]) >= 0.30 * scale]
    for row in list(rows):
        if row in substantial or len(row) != 1:
            continue
        i = row[0]; b = boxes[i]
        best = None
        for target in substantial:
            tb = _union_box([boxes[k] for k in target])
            dx = 0.0 if tb["x1"] <= b["cx"] <= tb["x2"] else min(abs(b["cx"] - tb["x1"]), abs(b["cx"] - tb["x2"]))
            dy = abs(b["cy"] - (tb["y1"] + tb["y2"]) * 0.5)
            score = dx + 0.7 * dy
            if dx < 0.9 * scale and dy < 1.05 * scale and (best is None or score < best[0]):
                best = (score, target)
        if best is not None:
            best[1].append(i)
            rows.remove(row)

    # A one-stroke speck that still lives by itself and is tiny relative to the
    # expression scale is tap noise. Decimal points inside a row were attached
    # above by proximity and are never discarded here.
    rows = [
        r for r in rows
        if not (len(r) == 1 and max(boxes[r[0]]["w"], boxes[r[0]]["h"]) < 0.14 * scale)
    ]
    rows.sort(key=lambda r: _median([boxes[i]["cy"] for i in r], 0.0))
    return [sorted(r) for r in rows]


class LiveV4:
    def __init__(self, checkpoint: Path, decoder: str, device_name: str,
                 grouping_temperature: float, symbol_weight: float,
                 max_group_size: int, general_max_strokes: int):
        self.checkpoint = checkpoint
        self.decoder = decoder
        self.device = _device(device_name)
        self.grouping_temperature = grouping_temperature
        self.symbol_weight = symbol_weight
        self.max_group_size = max_group_size
        self.general_max_strokes = general_max_strokes

        ckpt = torch.load(checkpoint, map_location="cpu", weights_only=False)
        if int(ckpt.get("architecture_version", 0)) != 4:
            raise ValueError("checkpoint is not Pri Ink Structural V4")
        if ckpt.get("stage") != "structural-research-dev":
            raise ValueError(f"LAN V4 testing requires structural-research-dev, got {ckpt.get('stage')!r}")
        if ckpt.get("production_ready") is not False:
            raise ValueError("research LAN runtime refuses a checkpoint claiming production readiness")
        if (ckpt.get("vocab") or []) != list(TOKEN_TO_ID.keys()):
            raise ValueError("V4 checkpoint vocabulary does not match this runtime")
        self.cfg = StructuralConfig(**ckpt["config"])
        self.model = PriInkStructuralV4(len(TOKEN_TO_ID), self.cfg)
        self.model.load_state_dict(ckpt["model"], strict=True)
        self.model.to(self.device).eval()
        self.sha = hashlib.sha256(checkpoint.read_bytes()).hexdigest()

    def _infer_row(self, row_strokes: list[dict], global_indices: list[int]) -> dict:
        points, point_valid, stroke_valid, geometry = hierarchical_stroke_features(row_strokes, self.cfg)
        raster = rasterize(row_strokes, self.cfg.raster_height, self.cfg.raster_width, augment=False)
        stroke_points = torch.from_numpy(points).unsqueeze(0).to(self.device)
        stroke_point_valid = torch.from_numpy(point_valid).unsqueeze(0).to(self.device)
        stroke_valid_t = torch.from_numpy(stroke_valid).unsqueeze(0).to(self.device)
        stroke_geometry = torch.from_numpy(geometry).unsqueeze(0).to(self.device)
        raster_t = torch.from_numpy(raster).unsqueeze(0).to(self.device)

        with torch.inference_mode():
            outputs = self.model(stroke_points, stroke_point_valid, stroke_valid_t, stroke_geometry, raster_t)
            hyp = decode_structural_selected(
                self.decoder,
                outputs,
                stroke_geometry,
                stroke_valid_t,
                model=self.model,
                group_threshold=0.65,
                relation_threshold=0.60,
                ambiguity_threshold=0.80,
                max_group_size=self.max_group_size,
                general_max_strokes=self.general_max_strokes,
                grouping_temperature=self.grouping_temperature,
                symbol_weight=self.symbol_weight,
                partition_margin_threshold=0.0,
            )

        boxes = [_stroke_box(s) for s in row_strokes]
        symbols = []
        for gi, glyph in enumerate(hyp.glyphs):
            local = [int(i) for i in glyph.strokes if 0 <= int(i) < len(row_strokes)]
            global_strokes = [global_indices[i] for i in local]
            gb = _union_box([boxes[i] for i in local])
            conf = max(0.0, min(1.0, float(glyph.symbol_confidence)))
            symbols.append({
                "id": f"v4_{global_indices[0] if global_indices else 0}_{gi}",
                "sym": str(glyph.symbol),
                "conf": conf,
                "alts": [{"sym": str(glyph.symbol), "conf": conf}],
                "strokeIdxs": global_strokes,
                "box": gb,
                "approx": True,
            })
        line_box = _union_box(boxes)
        min_conf = min((s["conf"] for s in symbols), default=max(0.0, min(1.0, float(hyp.confidence))))
        return {
            "text": str(hyp.canonical),
            "symbols": symbols,
            "box": line_box,
            "confidence": float(hyp.confidence),
            "ambiguous": bool(hyp.ambiguous),
            "minConf": min_conf,
            "decoder": getattr(hyp, "decoder", self.decoder),
            "warnings": list(hyp.warnings),
        }

    def infer(self, strokes: list[dict]) -> dict:
        if not isinstance(strokes, list) or not strokes:
            return {"engine": ENGINE, "available": True, "lines": [], "text": "", "minConf": 1.0, "margin": 1.0, "weakest": None}
        if any(not isinstance(s, dict) or not (s.get("points") or []) for s in strokes):
            raise ValueError("every physical stroke must contain points")

        partitions = _line_partitions(strokes)
        lines = []
        for indices in partitions:
            local = [strokes[i] for i in indices]
            if len(local) > self.cfg.max_strokes:
                raise ValueError(f"one written line has {len(local)} strokes; V4 max_strokes={self.cfg.max_strokes}")
            lines.append(self._infer_row(local, indices))

        text = "\n".join(line["text"] for line in lines if line["text"])
        all_symbols = [s for line in lines for s in line["symbols"]]
        min_conf = min((s["conf"] for s in all_symbols), default=1.0)
        weakest_index = None
        if all_symbols:
            weakest_index = min(range(len(all_symbols)), key=lambda i: all_symbols[i]["conf"])
        weakest = None if weakest_index is None else {
            "index": weakest_index,
            "sym": all_symbols[weakest_index]["sym"],
            "conf": all_symbols[weakest_index]["conf"],
            "alts": all_symbols[weakest_index]["alts"],
        }
        return {
            "engine": ENGINE,
            "available": True,
            "researchOnly": True,
            "productionReady": False,
            "checkpointSha256": self.sha,
            "decoder": self.decoder,
            "lines": lines,
            "text": text,
            "minConf": min_conf,
            "margin": 0.0 if any(line["ambiguous"] for line in lines) else min_conf,
            "weakest": weakest,
        }


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--checkpoint", required=True)
    p.add_argument("--decoder", choices=list(DECODER_NAMES), default="joint-auto")
    p.add_argument("--device", default="auto")
    p.add_argument("--grouping-temperature", type=float, default=1.0)
    p.add_argument("--symbol-weight", type=float, default=0.25)
    p.add_argument("--max-group-size", type=int, default=4)
    p.add_argument("--general-max-strokes", type=int, default=14)
    args = p.parse_args()

    checkpoint = Path(args.checkpoint)
    if not checkpoint.exists():
        raise SystemExit(f"checkpoint not found: {checkpoint}")
    worker = LiveV4(
        checkpoint, args.decoder, args.device, args.grouping_temperature,
        args.symbol_weight, args.max_group_size, args.general_max_strokes,
    )
    print(
        f"{ENGINE} ready device={worker.device} checkpoint={worker.sha[:12]} "
        f"decoder={worker.decoder} research-only productionReady=false",
        file=sys.stderr,
        flush=True,
    )

    for raw in sys.stdin:
        raw = raw.strip()
        if not raw:
            continue
        req_id = None
        try:
            request = json.loads(raw)
            req_id = request.get("id")
            result = worker.infer(request.get("strokes") or [])
            result["id"] = req_id
        except Exception as exc:  # keep worker alive so one bad page cannot kill the session
            result = {
                "id": req_id,
                "engine": ENGINE,
                "available": False,
                "researchOnly": True,
                "productionReady": False,
                "error": str(exc),
            }
            print(traceback.format_exc(), file=sys.stderr, flush=True)
        print(json.dumps(result, separators=(",", ":")), flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
