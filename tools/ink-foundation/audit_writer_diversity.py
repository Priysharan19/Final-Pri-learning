#!/usr/bin/env python3
"""Audit whether the Pri Ink corpus represents genuinely different writers.

This tool intentionally measures the *data*, not model accuracy. Synthetic
augmentation is not counted as a writer. Promotion to a broadly generalising
model needs enough independent people, writer-disjoint splits, broad token
coverage and non-trivial variation in capture dynamics.

V17 deliberately evaluates data readiness on the public-to-engineering `test`
split only. The locked `final-holdout` must never be used to make an otherwise
under-sized test set look production-ready.
"""
from __future__ import annotations

import argparse
import json
import math
import statistics
from collections import Counter, defaultdict
from pathlib import Path

from data_v4 import VOCAB, canonical_text, corpus_files, tokenize


EVAL_MIN_WRITERS = 20
EVAL_MIN_SAMPLES = 1000
TRAIN_TARGET_WRITERS = 100
MIN_SAMPLES_PER_TRAIN_WRITER = 40
MIN_TRAIN_WRITERS_PER_TOKEN = 5
MIN_TEST_WRITERS_PER_TOKEN = 3
MIN_TEST_OCCURRENCES_PER_TOKEN = 5


def finite(value, default=0.0):
    try:
        value = float(value)
    except (TypeError, ValueError):
        return default
    return value if math.isfinite(value) else default


def quantiles(values):
    values = sorted(float(x) for x in values if math.isfinite(float(x)))
    if not values:
        return {
            "min": 0.0,
            "p10": 0.0,
            "median": 0.0,
            "p90": 0.0,
            "max": 0.0,
        }

    def pick(q):
        pos = q * (len(values) - 1)
        lo = int(math.floor(pos))
        hi = int(math.ceil(pos))
        if lo == hi:
            return values[lo]
        return values[lo] * (hi - pos) + values[hi] * (pos - lo)

    return {
        "min": values[0],
        "p10": pick(0.10),
        "median": pick(0.50),
        "p90": pick(0.90),
        "max": values[-1],
    }


def sample_signature(strokes):
    points = [point for stroke in strokes for point in (stroke.get("points") or [])]
    if not points:
        return None
    xs = [finite(point.get("x")) for point in points]
    ys = [finite(point.get("y")) for point in points]
    span_x = max(max(xs) - min(xs), 1.0)
    span_y = max(max(ys) - min(ys), 1.0)
    pressures = [
        finite(point.get("p", point.get("force", 0.0))) for point in points
    ]
    widths = [finite(point.get("w", 3.0), 3.0) for point in points]
    speeds = []
    gaps = []
    direction_angles = []
    for stroke in strokes:
        pts = stroke.get("points") or []
        for a, b in zip(pts, pts[1:]):
            dx = finite(b.get("x")) - finite(a.get("x"))
            dy = finite(b.get("y")) - finite(a.get("y"))
            dt = finite(b.get("t")) - finite(a.get("t"))
            if dt > 1e-5:
                speeds.append(math.hypot(dx, dy) / dt)
                gaps.append(dt)
            if abs(dx) + abs(dy) > 1e-6:
                direction_angles.append(math.atan2(dy, dx))

    # Circular concentration is a stable descriptor of how directional the
    # writing is without pretending it is a literal typographic slant angle.
    if direction_angles:
        sx = statistics.fmean(math.cos(angle) for angle in direction_angles)
        sy = statistics.fmean(math.sin(angle) for angle in direction_angles)
        directionality = math.hypot(sx, sy)
    else:
        directionality = 0.0

    return {
        "strokeCount": len(strokes),
        "pointsPerStroke": len(points) / max(1, len(strokes)),
        "aspect": span_x / span_y,
        "pressure": statistics.fmean(pressures) if pressures else 0.0,
        "width": statistics.fmean(widths) if widths else 0.0,
        "speed": statistics.median(speeds) if speeds else 0.0,
        "pointDt": statistics.median(gaps) if gaps else 0.0,
        "directionality": directionality,
    }


def load_corpus(root):
    writers = {}
    writer_splits = {}
    samples_by_split = Counter()
    token_by_split = defaultdict(Counter)
    unknown_targets = []
    duplicate_session_ids = Counter()

    for path in corpus_files(root):
        try:
            doc = json.loads(Path(path).read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        if doc.get("format") != "pri-ink-corpus" or int(doc.get("version", 0)) < 2:
            continue
        writer = str((doc.get("writer") or {}).get("id") or "unknown")
        split = str(doc.get("split") or "train")
        prior = writer_splits.get(writer)
        if prior is not None and prior != split:
            raise SystemExit(
                f"FAIL: writer leakage: {writer!r} occurs in {prior!r} and {split!r}"
            )
        writer_splits[writer] = split
        session = str(doc.get("sessionId") or doc.get("session") or "")
        if session:
            duplicate_session_ids[session] += 1
        row = writers.setdefault(
            writer,
            {
                "split": split,
                "samples": 0,
                "files": 0,
                "handedness": Counter(),
                "signatures": defaultdict(list),
                "tokens": Counter(),
            },
        )
        row["files"] += 1
        hand = str((doc.get("writer") or {}).get("handedness") or "unknown")
        row["handedness"][hand] += 1
        for sample in doc.get("samples") or []:
            target = canonical_text(sample.get("target") or "").strip()
            strokes = sample.get("strokes") or []
            if not target or not strokes:
                continue
            row["samples"] += 1
            samples_by_split[split] += 1
            tokens = tokenize(target)
            row["tokens"].update(tokens)
            token_by_split[split].update(tokens)
            if any(token not in VOCAB for token in tokens):
                unknown_targets.append(
                    {"writer": writer, "target": target, "source": str(path)}
                )
            signature = sample_signature(strokes)
            if signature:
                for key, value in signature.items():
                    row["signatures"][key].append(value)

    duplicates = sorted(
        session for session, count in duplicate_session_ids.items() if count > 1
    )
    return writers, samples_by_split, token_by_split, unknown_targets, duplicates


def _writer_token_counts(writers, split: str, required_tokens: list[str]) -> Counter:
    counts = Counter()
    for row in writers.values():
        if row["split"] != split:
            continue
        for token in required_tokens:
            if row["tokens"][token] > 0:
                counts[token] += 1
    return counts


def _coverage_row(token_counts: Counter, writer_counts: Counter,
                  required_tokens: list[str]) -> dict:
    missing = [token for token in required_tokens if token_counts[token] == 0]
    return {
        "uniqueTokens": len(required_tokens) - len(missing),
        "totalVocabularyTokens": len(required_tokens),
        "missingTokens": missing,
        "occurrences": {token: token_counts[token] for token in required_tokens},
        "writersPerToken": {token: writer_counts[token] for token in required_tokens},
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--corpus", default="client/test/ink-corpus")
    parser.add_argument("--out", default=None)
    parser.add_argument("--enforce", action="store_true")
    args = parser.parse_args()

    (
        writers,
        samples_by_split,
        token_by_split,
        unknown_targets,
        duplicates,
    ) = load_corpus(args.corpus)
    by_split = defaultdict(list)
    writer_rows = {}
    for writer, row in sorted(writers.items()):
        by_split[row["split"]].append(writer)
        writer_rows[writer] = {
            "split": row["split"],
            "samples": row["samples"],
            "files": row["files"],
            "handedness": dict(row["handedness"]),
            "style": {
                key: quantiles(values) for key, values in row["signatures"].items()
            },
            "uniqueTokens": len(row["tokens"]),
        }

    required_tokens = [token for token in VOCAB if not token.startswith("<")]
    writer_token_by_split = {
        split: _writer_token_counts(writers, split, required_tokens)
        for split in set(by_split) | {"train", "validation", "test", "final-holdout"}
    }
    coverage = {}
    for split in sorted(set(samples_by_split) | set(by_split)):
        coverage[split] = _coverage_row(
            token_by_split[split], writer_token_by_split[split], required_tokens
        )

    train_counts = [
        writers[writer]["samples"] for writer in by_split.get("train", [])
    ]
    train_writer_token_counts = writer_token_by_split["train"]
    test_writer_token_counts = writer_token_by_split["test"]
    test_token_counts = token_by_split["test"]

    thin_train_tokens = [
        token
        for token in required_tokens
        if train_writer_token_counts[token] < MIN_TRAIN_WRITERS_PER_TOKEN
    ]
    thin_test_writer_tokens = [
        token
        for token in required_tokens
        if test_writer_token_counts[token] < MIN_TEST_WRITERS_PER_TOKEN
    ]
    thin_test_occurrence_tokens = [
        token
        for token in required_tokens
        if test_token_counts[token] < MIN_TEST_OCCURRENCES_PER_TOKEN
    ]

    # Final-holdout is deliberately not allowed to satisfy these gates. The
    # test split is the repeatable engineering evaluation set; final-holdout is
    # consumed only by a frozen release candidate.
    gates = {
        "trainWriterTarget": len(by_split.get("train", [])) >= TRAIN_TARGET_WRITERS,
        "evaluationWriterMinimum": len(by_split.get("test", [])) >= EVAL_MIN_WRITERS,
        "evaluationSampleMinimum": samples_by_split["test"] >= EVAL_MIN_SAMPLES,
        "minimumSamplesPerTrainWriter": bool(train_counts)
        and min(train_counts) >= MIN_SAMPLES_PER_TRAIN_WRITER,
        "trainTokenWriterCoverage": not thin_train_tokens,
        "testTokenWriterCoverage": not thin_test_writer_tokens,
        "testTokenOccurrenceCoverage": not thin_test_occurrence_tokens,
        "noUnknownTargetTokens": not unknown_targets,
        "noDuplicateSessionIds": not duplicates,
    }
    report = {
        "format": "pri-ink-writer-diversity-audit",
        "version": 2,
        "vocabularyVersion": 4,
        "policy": {
            "trainWriterTarget": TRAIN_TARGET_WRITERS,
            "evaluationSplit": "test",
            "evaluationMinWriters": EVAL_MIN_WRITERS,
            "evaluationMinSamples": EVAL_MIN_SAMPLES,
            "minSamplesPerTrainWriter": MIN_SAMPLES_PER_TRAIN_WRITER,
            "minTrainWritersPerToken": MIN_TRAIN_WRITERS_PER_TOKEN,
            "minTestWritersPerToken": MIN_TEST_WRITERS_PER_TOKEN,
            "minTestOccurrencesPerToken": MIN_TEST_OCCURRENCES_PER_TOKEN,
            "syntheticAugmentationsCountAsWriters": False,
            "finalHoldoutCountsTowardReadiness": False,
        },
        "writers": len(writers),
        "writersBySplit": {
            split: len(ids) for split, ids in sorted(by_split.items())
        },
        "samplesBySplit": dict(samples_by_split),
        "vocabularyCoverage": coverage,
        "thinCoverage": {
            "trainTokensBelowWriterMinimum": thin_train_tokens,
            "testTokensBelowWriterMinimum": thin_test_writer_tokens,
            "testTokensBelowOccurrenceMinimum": thin_test_occurrence_tokens,
        },
        "unknownTargets": unknown_targets[:100],
        "duplicateSessionIds": duplicates,
        "gates": gates,
        "passesDataReadiness": all(gates.values()),
        "byWriter": writer_rows,
    }

    text = json.dumps(report, indent=2)
    if args.out:
        Path(args.out).write_text(text, encoding="utf-8")
    print(text)
    print(
        "\nDATA READINESS: "
        + ("PASS" if report["passesDataReadiness"] else "NOT YET")
        + " — augmented copies never count as independent writers; final-holdout never fills test gaps."
    )
    if args.enforce and not report["passesDataReadiness"]:
        raise SystemExit(2)


if __name__ == "__main__":
    main()
