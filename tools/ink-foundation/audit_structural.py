#!/usr/bin/env python3
"""Audit Pri Ink V4 trace-to-glyph annotation before training.

This is deliberately independent of model quality. It verifies that structural
labels are internally coherent and writer splits do not leak. Use --require-all
for a corpus directory intended specifically for V4 training.

Machine preannotation is allowed as a drafting aid, but a draft is not training
evidence. A machine-drafted sample must have been opened and validated by the
local V4 annotator, which stamps the structure with annotator + annotatedAt.
"""
from __future__ import annotations

import argparse
import json
from collections import Counter, defaultdict
from pathlib import Path

from structural_data import corpus_files, validate_structure


def main():
    p = argparse.ArgumentParser()
    p.add_argument("corpus")
    p.add_argument("--require-all", action="store_true")
    args = p.parse_args()

    files = corpus_files(args.corpus)
    if not files:
        raise SystemExit(f"no JSON files under {args.corpus!r}")

    writer_split: dict[str, str] = {}
    split_writers: dict[str, set[str]] = defaultdict(set)
    glyphs = Counter()
    relations = Counter()
    total = annotated = unannotated = 0
    machine_drafts = reviewed_machine_drafts = 0
    multi_stroke_groups = 0
    errors: list[str] = []

    for path in files:
        try:
            doc = json.loads(path.read_text())
        except Exception as exc:
            errors.append(f"{path}: invalid JSON: {exc}")
            continue
        if doc.get("format") != "pri-ink-corpus":
            continue
        split = str(doc.get("split", "train"))
        writer = str((doc.get("writer") or {}).get("id") or "unknown")
        prior = writer_split.get(writer)
        if prior is not None and prior != split:
            errors.append(f"{path}: writer {writer!r} leaks across {prior!r} and {split!r}")
        writer_split[writer] = split
        split_writers[split].add(writer)

        for sample_index, sample in enumerate(doc.get("samples") or []):
            total += 1
            strokes = sample.get("strokes") or []
            structure = sample.get("structure") or {}
            if not structure.get("groups"):
                unannotated += 1
                continue

            preannotation = structure.get("preannotation") or {}
            is_machine_draft = preannotation.get("status") == "machine-draft"
            if is_machine_draft:
                machine_drafts += 1
                reviewed = (
                    structure.get("annotator") == "pri-ink-structural-v4-v1"
                    and bool(structure.get("annotatedAt"))
                )
                if not reviewed:
                    errors.append(
                        f"{path} sample {sample_index}: machine preannotation has not been "
                        "human-reviewed in the V4 annotator"
                    )
                    continue
                reviewed_machine_drafts += 1

            try:
                validate_structure(structure, len(strokes), require_complete=True)
            except ValueError as exc:
                errors.append(f"{path} sample {sample_index}: {exc}")
                continue
            annotated += 1
            for group in structure.get("groups") or []:
                symbol = str(group.get("symbol"))
                glyphs[symbol] += 1
                if len(group.get("strokes") or []) > 1:
                    multi_stroke_groups += 1
            for rel in structure.get("relations") or []:
                relations[str(rel.get("type", "")).upper()] += 1

    if args.require_all and unannotated:
        errors.append(
            f"--require-all: {unannotated}/{total} corpus samples have no structural annotation"
        )
    if annotated == 0:
        errors.append("no valid structure-annotated samples found")

    print("\nPri Ink V4 structural corpus audit\n")
    print(f"files: {len(files)}")
    print(f"samples: {total} total · {annotated} annotated · {unannotated} unannotated")
    print(
        f"machine drafts: {machine_drafts} total · "
        f"{reviewed_machine_drafts} human-reviewed"
    )
    print("writers: " + ", ".join(
        f"{split}={len(writers)}" for split, writers in sorted(split_writers.items())
    ))
    print(f"glyph groups: {sum(glyphs.values())} · multi-stroke groups: {multi_stroke_groups}")
    print("relations: " + (", ".join(f"{k}={v}" for k, v in relations.most_common()) or "none"))
    print("top glyphs: " + (", ".join(f"{k}={v}" for k, v in glyphs.most_common(16)) or "none"))

    if errors:
        print(f"\nFAIL — {len(errors)} structural corpus problem(s)")
        for err in errors[:40]:
            print("  - " + err)
        if len(errors) > 40:
            print(f"  ... {len(errors)-40} more")
        raise SystemExit(1)

    print("\nPASS — structural labels are complete, reviewed, trace-addressable and writer-disjoint")


if __name__ == "__main__":
    main()
