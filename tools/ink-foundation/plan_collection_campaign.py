#!/usr/bin/env python3
"""Plan the next Pri Ink V17.1 real-writer collection wave.

This tool does not fabricate handwriting or count synthetic writers. It turns the
routine, holdout-opaque readiness audit into an actionable recruitment plan and
pre-allocates anonymous participant codes whose deterministic split is known.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

from audit_writer_diversity import POLICY, build_report


SPLITS = ("train", "validation", "test", "final-holdout")


def fnv1a32(text: str) -> int:
    h = 0x811C9DC5
    for ch in text:
        h ^= ord(ch)
        h = (h * 0x01000193) & 0xFFFFFFFF
    return h


def canonical_writer(value: str) -> str:
    return str(value or "").strip().upper()


def assigned_split(writer_id: str) -> str:
    bucket = fnv1a32("pri-ink-split-v1:" + canonical_writer(writer_id)) % 100
    if bucket < 70:
        return "train"
    if bucket < 80:
        return "validation"
    if bucket < 90:
        return "test"
    return "final-holdout"


def candidate_codes(existing: set[str], counts: dict[str, int],
                    prefix: str, width: int) -> dict[str, list[str]]:
    remaining = {split: max(0, int(counts.get(split, 0))) for split in SPLITS}
    result = {split: [] for split in SPLITS}
    n = 1
    max_needed = sum(remaining.values())
    if max_needed == 0:
        return result

    # With a 70/10/10/10 mapping this is ample for practical campaign sizes,
    # while still failing loudly instead of looping forever if policy changes.
    limit = max(10000, max_needed * 500)
    while any(remaining.values()) and n <= limit:
        code = f"{prefix}{n:0{width}d}"
        n += 1
        if canonical_writer(code) in existing:
            continue
        split = assigned_split(code)
        if remaining[split] <= 0:
            continue
        result[split].append(code)
        remaining[split] -= 1

    if any(remaining.values()):
        raise RuntimeError(f"could not allocate enough deterministic codes: {remaining}")
    return result


def build_campaign(corpus: str, preview: int | None = None,
                   prefix: str | None = None) -> dict:
    report = build_report(corpus)
    readiness = POLICY["readiness"]
    campaign = POLICY["campaign"]
    preview = int(preview or campaign["candidatePreviewPerSplit"])
    prefix = str(prefix or campaign["candidateCodePrefix"])
    width = int(campaign["candidateCodeWidth"])

    writer_targets = {
        "train": int(readiness["trainWriterTarget"]),
        "validation": int(readiness["validationWriterTarget"]),
        "test": int(readiness["evaluationMinWriters"]),
        "final-holdout": int(readiness["finalHoldoutWriterTarget"]),
    }
    current = {
        split: int(report["writersBySplit"].get(split, 0))
        for split in SPLITS
    }
    writers_needed = {
        split: max(0, writer_targets[split] - current[split])
        for split in SPLITS
    }

    samples_by_split = report.get("samplesBySplit") or {}
    preferred = int(campaign["preferredSamplesPerWriter"])
    sample_targets = {
        "trainMinimum": (
            int(readiness["trainWriterTarget"])
            * int(readiness["minSamplesPerTrainWriter"])
        ),
        "validationCampaign": (
            int(readiness["validationWriterTarget"])
            * int(readiness["preferredSamplesPerValidationWriter"])
        ),
        "testMinimum": int(readiness["evaluationMinSamples"]),
        "finalHoldout": None,
    }
    sample_deficits = {
        "trainMinimum": max(
            0, sample_targets["trainMinimum"] - int(samples_by_split.get("train", 0))
        ),
        "validationCampaign": max(
            0,
            sample_targets["validationCampaign"]
            - int(samples_by_split.get("validation", 0)),
        ),
        "testMinimum": max(
            0, sample_targets["testMinimum"] - int(samples_by_split.get("test", 0))
        ),
        "finalHoldout": None,
    }

    train_writer_deficits = []
    minimum_train = int(readiness["minSamplesPerTrainWriter"])
    for writer, row in sorted((report.get("byWriter") or {}).items()):
        if row.get("split") != "train":
            continue
        have = int(row.get("samples", 0))
        if have < minimum_train:
            train_writer_deficits.append({
                "writer": writer,
                "samples": have,
                "needs": minimum_train - have,
            })

    existing = {canonical_writer(writer) for writer in (report.get("byWriter") or {})}
    preview_counts = {
        split: min(preview, writers_needed[split]) for split in SPLITS
    }
    codes = candidate_codes(existing, preview_counts, prefix, width)

    thin = report.get("thinCoverage") or {}
    return {
        "format": "pri-ink-collection-campaign",
        "version": 1,
        "releaseLane": POLICY.get("releaseLane", "V17.1"),
        "corpus": str(Path(corpus)),
        "passesDataReadiness": bool(report.get("passesDataReadiness")),
        "writers": {
            "current": current,
            "targets": writer_targets,
            "needed": writers_needed,
        },
        "samples": {
            "current": {
                "train": int(samples_by_split.get("train", 0)),
                "validation": int(samples_by_split.get("validation", 0)),
                "test": int(samples_by_split.get("test", 0)),
                "final-holdout": None,
            },
            "targets": sample_targets,
            "deficits": sample_deficits,
            "preferredPerWriter": preferred,
            "trainWritersBelowMinimum": train_writer_deficits,
        },
        "coverage": {
            "trainTokensBelowWriterMinimum": thin.get(
                "trainTokensBelowWriterMinimum", []
            ),
            "testTokensBelowWriterMinimum": thin.get(
                "testTokensBelowWriterMinimum", []
            ),
            "testTokensBelowOccurrenceMinimum": thin.get(
                "testTokensBelowOccurrenceMinimum", []
            ),
        },
        "candidateCodes": codes,
        "evidenceFirewall": {
            "finalHoldoutContentInspected": False,
            "finalHoldoutSamplesReported": False,
            "note": (
                "Anonymous code assignment is safe to plan. Final-holdout targets, "
                "strokes, sample counts and failure details remain unread."
            ),
        },
    }


def render(plan: dict) -> str:
    writers = plan["writers"]
    samples = plan["samples"]
    lines = [
        "",
        f"Pri Ink {plan['releaseLane']} · next real-writer collection wave",
        "",
        "Writer recruitment",
    ]
    for split in SPLITS:
        lines.append(
            f"  {split:<13} {writers['current'][split]:>3}/{writers['targets'][split]}"
            f"  need {writers['needed'][split]:>3} more independent writer(s)"
        )

    lines.extend([
        "",
        "Expression collection",
        f"  train minimum      {samples['current']['train']:>4}/{samples['targets']['trainMinimum']}"
        f"  need {samples['deficits']['trainMinimum']}",
        f"  validation target  {samples['current']['validation']:>4}/{samples['targets']['validationCampaign']}"
        f"  need {samples['deficits']['validationCampaign']}",
        f"  test minimum       {samples['current']['test']:>4}/{samples['targets']['testMinimum']}"
        f"  need {samples['deficits']['testMinimum']}",
        "  final-holdout      opaque — routine planning does not read sample contents/counts",
    ])

    below = samples["trainWritersBelowMinimum"]
    if below:
        lines.extend(["", "Existing train writers below the per-writer minimum"])
        for row in below[:20]:
            lines.append(
                f"  {row['writer']}: {row['samples']} samples; collect {row['needs']} more"
            )
        if len(below) > 20:
            lines.append(f"  … plus {len(below) - 20} more writer(s)")
    else:
        lines.extend(["", "Existing train-writer minimum: no deficit among registered train writers."])

    coverage = plan["coverage"]
    lines.extend(["", "Token-coverage pressure"])
    lines.append(
        f"  train tokens below writer floor: {len(coverage['trainTokensBelowWriterMinimum'])}"
    )
    lines.append(
        f"  test tokens below writer floor:  {len(coverage['testTokensBelowWriterMinimum'])}"
    )
    lines.append(
        f"  test tokens below occurrence floor: {len(coverage['testTokensBelowOccurrenceMinimum'])}"
    )
    for key in (
        "trainTokensBelowWriterMinimum",
        "testTokensBelowWriterMinimum",
        "testTokensBelowOccurrenceMinimum",
    ):
        values = coverage[key]
        if values:
            lines.append(f"    {key}: {', '.join(values[:24])}"
                         + (" …" if len(values) > 24 else ""))

    lines.extend(["", "Next anonymous participant codes (deterministic split)"])
    for split in SPLITS:
        values = plan["candidateCodes"][split]
        lines.append(f"  {split:<13} " + (", ".join(values) if values else "none needed in preview"))

    lines.extend([
        "",
        "Assign exactly one anonymous code per real person and never reuse a code for another writer.",
        "Synthetic copies do not count. Final-holdout remains opaque until an explicitly unlocked frozen-release evaluation.",
        "",
    ])
    return "\n".join(lines)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--corpus", default="client/test/ink-corpus")
    parser.add_argument("--preview", type=int, default=None)
    parser.add_argument("--prefix", default=None)
    parser.add_argument("--json", action="store_true")
    parser.add_argument("--out", default=None)
    args = parser.parse_args()

    plan = build_campaign(args.corpus, preview=args.preview, prefix=args.prefix)
    text = json.dumps(plan, indent=2) if args.json else render(plan)
    if args.out:
        Path(args.out).write_text(text + ("\n" if not text.endswith("\n") else ""), encoding="utf-8")
    print(text)


if __name__ == "__main__":
    main()
