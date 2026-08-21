"""PRI native online-ink feature contract.

This module intentionally mirrors ios/PriLearning.swiftpm/Ink/InkFeatureTensor.swift.
Changing either side requires bumping FEATURE_CONTRACT_VERSION and updating the
other side in the same change. Missing telemetry is represented with masks; it
is never fabricated as a real zero-valued hardware observation.
"""
from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Any, Iterable

FEATURE_CONTRACT_VERSION = "pri-ink-features-v1-20"
FEATURE_NAMES = (
    "x", "y", "dx", "dy", "dt120", "speed",
    "turnSin", "turnCos",
    "force", "forceMask",
    "azimuthSin", "azimuthCos", "altitude", "orientationMask",
    "width", "strokeStart", "strokeEnd", "strokeIndex", "pointProgress", "timeMask",
)
FEATURE_COUNT = len(FEATURE_NAMES)


@dataclass(frozen=True)
class FeatureTensor:
    rows: list[list[float]]
    stroke_ranges: list[tuple[int, int]]

    @property
    def point_count(self) -> int:
        return len(self.rows)


def _finite(value: float) -> float:
    return float(value) if math.isfinite(float(value)) else 0.0


def _clamp(value: float) -> float:
    return min(1.0, max(0.0, float(value)))


def _number(point: dict[str, Any], *names: str) -> float | None:
    for name in names:
        value = point.get(name)
        if isinstance(value, (int, float)) and math.isfinite(float(value)):
            return float(value)
    return None


def _points(stroke: Any) -> list[dict[str, Any]]:
    if not isinstance(stroke, dict):
        return []
    points = stroke.get("points")
    return [p for p in points if isinstance(p, dict)] if isinstance(points, list) else []


def build_feature_tensor(strokes: Iterable[dict[str, Any]]) -> FeatureTensor:
    live = [(source_index, _points(stroke)) for source_index, stroke in enumerate(strokes)]
    live = [(source_index, points) for source_index, points in live if points]
    if not live:
        return FeatureTensor([], [])

    all_points = [p for _, points in live for p in points]
    xs = [_number(p, "x") for p in all_points]
    ys = [_number(p, "y") for p in all_points]
    if any(v is None for v in xs + ys):
        raise ValueError("every ink point must contain finite x/y coordinates")
    x_values = [float(v) for v in xs if v is not None]
    y_values = [float(v) for v in ys if v is not None]
    min_x, max_x = min(x_values), max(x_values)
    min_y, max_y = min(y_values), max(y_values)
    width = max(max_x - min_x, 0.5)
    height = max(max_y - min_y, 0.5)
    diagonal = max(math.hypot(width, height), 1.0)
    mid_x, mid_y = (min_x + max_x) / 2.0, (min_y + max_y) / 2.0
    stroke_denominator = max(len(live) - 1, 1)

    rows: list[list[float]] = []
    ranges: list[tuple[int, int]] = []

    for live_position, (_, points) in enumerate(live):
        start = len(rows)
        point_denominator = max(len(points) - 1, 1)
        previous_vector: tuple[float, float] | None = None

        for point_index, point in enumerate(points):
            previous = points[point_index - 1] if point_index > 0 else point
            x = _number(point, "x")
            y = _number(point, "y")
            px = _number(previous, "x")
            py = _number(previous, "y")
            assert x is not None and y is not None and px is not None and py is not None

            dx = (x - px) / diagonal
            dy = (y - py) / diagonal
            distance = math.hypot(dx, dy)

            current_t = _number(point, "t")
            previous_t = _number(previous, "t")
            has_time = point_index > 0 and current_t is not None and previous_t is not None
            raw_dt = max(0.0, current_t - previous_t) if has_time else 0.0
            dt120 = _clamp(raw_dt * 30.0) if has_time else 0.0
            speed = _clamp((distance / raw_dt) / 8.0) if has_time and raw_dt > 0.0002 else 0.0

            vector = (dx, dy)
            turn_sin, turn_cos = 0.0, 1.0
            if previous_vector is not None:
                prior_len = math.hypot(*previous_vector)
                vector_len = math.hypot(*vector)
                if prior_len > 0.00001 and vector_len > 0.00001:
                    a = math.atan2(previous_vector[1], previous_vector[0])
                    b = math.atan2(vector[1], vector[0])
                    delta = b - a
                    turn_sin, turn_cos = math.sin(delta), math.cos(delta)
            if distance > 0.00001:
                previous_vector = vector

            force_raw = _number(point, "p", "force")
            force_mask = 1.0 if force_raw is not None else 0.0
            force = _clamp(force_raw or 0.0)

            azimuth = _number(point, "az", "azimuth")
            altitude = _number(point, "alt", "altitude")
            orientation_mask = 1.0 if azimuth is not None and altitude is not None else 0.0
            azimuth_sin = math.sin(azimuth or 0.0) if orientation_mask else 0.0
            azimuth_cos = math.cos(azimuth or 0.0) if orientation_mask else 0.0
            altitude_norm = _clamp((altitude or 0.0) / (math.pi / 2.0)) if orientation_mask else 0.0

            point_width = _number(point, "w")
            width_norm = _clamp(((point_width if point_width is not None else 3.0) / diagonal) * 20.0)

            row = [
                (x - mid_x) / diagonal,
                (y - mid_y) / diagonal,
                dx, dy, dt120, speed,
                turn_sin, turn_cos,
                force, force_mask,
                azimuth_sin, azimuth_cos, altitude_norm, orientation_mask,
                width_norm,
                1.0 if point_index == 0 else 0.0,
                1.0 if point_index == len(points) - 1 else 0.0,
                live_position / stroke_denominator,
                point_index / point_denominator,
                1.0 if has_time else 0.0,
            ]
            rows.append([_finite(v) for v in row])
        ranges.append((start, len(rows)))

    if any(len(row) != FEATURE_COUNT for row in rows):
        raise AssertionError("feature contract width drifted")
    return FeatureTensor(rows, ranges)


def tensor_summary(strokes: Iterable[dict[str, Any]]) -> dict[str, Any]:
    tensor = build_feature_tensor(strokes)
    return {
        "contract": FEATURE_CONTRACT_VERSION,
        "features": list(FEATURE_NAMES),
        "points": tensor.point_count,
        "strokes": len(tensor.stroke_ranges),
    }
