"""Writer-style domain randomisation for Pri Ink Foundation V4.

The V3 dataset sampled point-stream and raster augmentation independently. That
is useful as sensor noise, but it can also make the two modalities describe
slightly different handwriting. V4 first transforms the raw Pencil strokes once
and then renders *both* modalities from the same transformed ink.

These transforms are deliberately geometry-preserving at the expression level:
we vary slant, aspect, rotation, baseline curvature, speed, pressure, width and
point sampling, but never reorder strokes or move individual glyphs relative to
one another. Structural maths such as powers and fractions therefore remains
valid supervision.
"""
from __future__ import annotations

import copy
import math
import random
from dataclasses import dataclass


@dataclass(frozen=True)
class StyleAugmentConfig:
    rotation_deg: float = 6.0
    shear: float = 0.24
    x_scale_min: float = 0.78
    x_scale_max: float = 1.24
    y_scale_min: float = 0.80
    y_scale_max: float = 1.22
    baseline_curve: float = 0.035
    point_jitter: float = 0.0035
    pressure_gain_min: float = 0.72
    pressure_gain_max: float = 1.32
    width_gain_min: float = 0.78
    width_gain_max: float = 1.25
    time_gain_min: float = 0.72
    time_gain_max: float = 1.38
    interior_point_drop_max: float = 0.055


@dataclass(frozen=True)
class StyleTransform:
    rotation_rad: float
    shear: float
    x_scale: float
    y_scale: float
    baseline_curve: float
    pressure_gain: float
    width_gain: float
    time_gain: float
    point_jitter: float
    interior_point_drop: float


def sample_style_transform(rng: random.Random,
                           config: StyleAugmentConfig = StyleAugmentConfig()) -> StyleTransform:
    """Sample one plausible whole-expression handwriting style transform."""
    return StyleTransform(
        rotation_rad=math.radians(rng.uniform(-config.rotation_deg, config.rotation_deg)),
        shear=rng.uniform(-config.shear, config.shear),
        x_scale=rng.uniform(config.x_scale_min, config.x_scale_max),
        y_scale=rng.uniform(config.y_scale_min, config.y_scale_max),
        baseline_curve=rng.uniform(-config.baseline_curve, config.baseline_curve),
        pressure_gain=rng.uniform(config.pressure_gain_min, config.pressure_gain_max),
        width_gain=rng.uniform(config.width_gain_min, config.width_gain_max),
        time_gain=rng.uniform(config.time_gain_min, config.time_gain_max),
        point_jitter=config.point_jitter * rng.uniform(0.25, 1.0),
        interior_point_drop=rng.uniform(0.0, config.interior_point_drop_max),
    )


def _number(point: dict, key: str, default: float = 0.0) -> float:
    value = point.get(key, default)
    try:
        value = float(value)
    except (TypeError, ValueError):
        return default
    return value if math.isfinite(value) else default


def transform_strokes(strokes: list[dict], transform: StyleTransform,
                      rng: random.Random) -> list[dict]:
    """Return a transformed deep copy of Pencil strokes.

    Coordinates are transformed around the expression centre.  Pressure, width
    and timestamps are adjusted consistently.  Endpoints are always retained;
    sparse strokes therefore cannot disappear because of point-drop noise.
    """
    result = copy.deepcopy(strokes)
    points = [p for stroke in result for p in (stroke.get("points") or [])]
    if not points:
        return result

    xs = [_number(p, "x") for p in points]
    ys = [_number(p, "y") for p in points]
    x1, x2 = min(xs), max(xs)
    y1, y2 = min(ys), max(ys)
    cx = (x1 + x2) * 0.5
    cy = (y1 + y2) * 0.5
    span = max(x2 - x1, y2 - y1, 1.0)
    cos_r = math.cos(transform.rotation_rad)
    sin_r = math.sin(transform.rotation_rad)

    for stroke in result:
        pts = stroke.get("points") or []
        if len(pts) > 3 and transform.interior_point_drop > 0:
            kept = [pts[0]]
            kept.extend(
                p for p in pts[1:-1]
                if rng.random() >= transform.interior_point_drop
            )
            kept.append(pts[-1])
            stroke["points"] = pts = kept

        if not pts:
            continue
        t0 = _number(pts[0], "t", 0.0)
        for point in pts:
            x = (_number(point, "x") - cx) / span
            y = (_number(point, "y") - cy) / span

            # Writer morphology: independent aspect scaling, cursive slant,
            # gentle baseline bow, then small page rotation.
            x *= transform.x_scale
            y *= transform.y_scale
            x = x - transform.shear * y
            y = y + transform.baseline_curve * (x * x - 0.20)
            xr = cos_r * x - sin_r * y
            yr = sin_r * x + cos_r * y
            xr += rng.gauss(0.0, transform.point_jitter)
            yr += rng.gauss(0.0, transform.point_jitter)

            point["x"] = cx + xr * span
            point["y"] = cy + yr * span

            if "t" in point:
                point["t"] = t0 + (_number(point, "t") - t0) * transform.time_gain
            if "p" in point:
                point["p"] = max(0.0, min(2.0, _number(point, "p") * transform.pressure_gain))
            if "force" in point:
                point["force"] = max(0.0, min(2.0, _number(point, "force") * transform.pressure_gain))
            if "w" in point:
                point["w"] = max(0.25, _number(point, "w", 3.0) * transform.width_gain)

    return result


def augmented_strokes(strokes: list[dict], seed: int,
                      config: StyleAugmentConfig = StyleAugmentConfig()) -> list[dict]:
    """Deterministic convenience wrapper, useful for tests/evaluation."""
    rng = random.Random(int(seed))
    return transform_strokes(strokes, sample_style_transform(rng, config), rng)
