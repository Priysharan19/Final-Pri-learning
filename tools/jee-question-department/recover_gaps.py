#!/usr/bin/env python3
"""Deterministically recover structurally expected JEE question identities.

The raw PDF and recovered text remain local/ignored. Public Git may contain
only this tooling plus metadata/count/hash reports. Recovery is fail-closed:
a broad marker is accepted only when it maps uniquely to an expected identity;
source-verified exceptional locators live in source-manifest.json.
"""
from __future__ import annotations

import argparse
import json
import re
from collections import defaultdict
from pathlib import Path

import fitz

from extract import answer_heading_y, crop_text, infer_exam, line_groups, target_for, write_jsonl
from reconcile_source import structural_question_counts

HERE = Path(__file__).resolve().parent
DEFAULT_MANIFEST = HERE / "source-manifest.json"


def load_jsonl(path: Path) -> list[dict]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def identity(row: dict) -> tuple[int, int, int]:
    source = row.get("source") or {}
    return (
        int(source.get("sourceChapterNumber") or 0),
        int(source.get("sourceTopicNumber") or 0),
        int(source.get("sourceQuestionNumber") or 0),
    )


def expected_identities(pdf, manifest: dict) -> set[tuple[int, int, int]]:
    overrides = {
        (int(item["chapter"]), int(item["topic"])): int(item["count"])
        for item in (manifest.get("reconciliation") or {}).get("verifiedQuestionCountOverrides", [])
    }
    out: set[tuple[int, int, int]] = set()
    for chapter in manifest["chapters"]:
        counts = structural_question_counts(pdf, manifest, chapter)
        chapter_number = int(chapter["number"])
        for (override_chapter, topic_number), count in overrides.items():
            if override_chapter == chapter_number:
                counts[topic_number] = count
        for topic_number, count in counts.items():
            out.update((chapter_number, int(topic_number), q) for q in range(1, int(count) + 1))
    return out


def page_topic_events(page, source_page: int) -> list[dict]:
    """Return topic headings in physical reading order: left column, then right."""
    width = float(page.rect.width)
    events: list[dict] = []
    for words in line_groups(page.get_text("words")).values():
        words = sorted(words, key=lambda word: float(word[0]))
        tokens = [str(word[4]) for word in words]
        for i, token in enumerate(tokens):
            if token.lower() != "topic" or i + 1 >= len(tokens) or not tokens[i + 1].isdigit():
                continue
            x = float(words[i][0])
            side = "left" if x < width / 2 else "right"
            events.append({
                "sourcePage": source_page,
                "side": side,
                "sideIndex": 0 if side == "left" else 1,
                "y": float(words[i][1]),
                "number": int(tokens[i + 1]),
                "title": " ".join(tokens[i + 2:]).strip(),
            })
    return sorted(events, key=lambda event: (event["sideIndex"], event["y"]))


def reading_key(source_page: int, side: str, y: float) -> tuple[int, int, float]:
    return (int(source_page), 0 if side == "left" else 1, float(y))


def broad_period_markers(pdf, manifest: dict, chapter: dict):
    offset = int(manifest["source"]["bookPageOffset"])
    start, answer = int(chapter["bookPageStart"]), int(chapter["answerPage"])
    headings: list[dict] = []
    for source_page in range(start, answer + 1):
        page = pdf[source_page + offset - 1]
        cutoff = answer_heading_y(page)
        for event in page_topic_events(page, source_page):
            if cutoff is None or event["y"] < cutoff:
                headings.append(event)
    headings.sort(key=lambda event: reading_key(event["sourcePage"], event["side"], event["y"]))
    if not headings:
        headings = [{"sourcePage": start, "side": "left", "sideIndex": 0, "y": 0.0,
                     "number": 1, "title": chapter["title"]}]

    markers = defaultdict(list)
    for source_page in range(start, answer + 1):
        page = pdf[source_page + offset - 1]
        cutoff = answer_heading_y(page)
        limit = cutoff if cutoff is not None else float("inf")
        width, height = float(page.rect.width), float(page.rect.height)
        for words in line_groups(page.get_text("words")).values():
            halves = (
                [word for word in words if float(word[0]) < width / 2],
                [word for word in words if float(word[0]) >= width / 2],
            )
            for side_index, half in enumerate(halves):
                if not half:
                    continue
                half = sorted(half, key=lambda word: float(word[0]))
                word = half[0]
                y = float(word[1])
                if y >= limit or y < height * 0.10:
                    continue
                match = re.fullmatch(r"(\d{1,3})\.", str(word[4]).strip())
                if not match:
                    continue
                x_ratio = float(word[0]) / width
                if not ((0.07 <= x_ratio <= 0.20) if side_index == 0 else (0.48 <= x_ratio <= 0.62)):
                    continue
                side = "left" if side_index == 0 else "right"
                key_here = reading_key(source_page, side, y)
                eligible = [
                    event for event in headings
                    if reading_key(event["sourcePage"], event["side"], event["y"]) <= key_here
                ]
                if not eligible:
                    continue
                topic = max(
                    eligible,
                    key=lambda event: reading_key(event["sourcePage"], event["side"], event["y"]),
                )
                identity_key = (int(chapter["number"]), int(topic["number"]), int(match.group(1)))
                markers[identity_key].append({
                    "sourcePage": source_page, "side": side, "y": y,
                    "topic": topic, "page": page, "cutoff": cutoff,
                })
    return markers


def recovered_row(manifest: dict, chapter: dict, key, marker, next_marker=None,
                  reason="gap-recovery-broad-marker"):
    _, topic_number, question_number = key
    raw_text, crop = crop_text(
        marker["page"], {"side": marker["side"], "y": marker["y"]},
        next_marker, y_limit=marker.get("cutoff"),
    )
    year, track, evidence = infer_exam(raw_text)
    target, target_reasons = target_for(chapter)
    reasons = list(target_reasons) + [reason, "manual-gap-recovery-required"]
    if not track:
        reasons.append("exam-track-review-required")
    if not raw_text or len(raw_text) < 12:
        reasons.append("prompt-extraction-review-required")
    return {
        "id": f"arihant41-c{chapter['number']:02d}-t{topic_number:02d}-q{question_number:03d}",
        "status": "draft",
        "source": {
            "book": manifest["source"]["title"], "edition": manifest["source"]["edition"],
            "sourceChapterNumber": chapter["number"], "sourceChapter": chapter["title"],
            "sourceTopicNumber": topic_number, "sourceTopic": marker["topic"].get("title") or "",
            "sourcePage": marker["sourcePage"],
            "sourcePdfPage": marker["sourcePage"] + int(manifest["source"]["bookPageOffset"]),
            "sourceQuestionNumber": question_number, "crop": crop,
        },
        "routing": {"part": chapter["part"], "targetChapter": target,
                    "allowedTargets": chapter.get("targets", [])},
        "exam": {"year": year, "track": track, "evidence": evidence},
        "difficulty": None, "answerType": "selfcheck", "prompt": raw_text,
        "answer": None, "mcqOptions": None, "hints": [], "steps": [],
        "review": {"extractionScore": 3, "reasons": sorted(set(reasons)),
                   "reviewedBy": None, "reviewedAt": None},
    }


def topic_title(canonical: dict, chapter_number: int, topic_number: int) -> str:
    for key, row in canonical.items():
        if key[0] == chapter_number and key[1] == topic_number:
            return str((row.get("source") or {}).get("sourceTopic") or "")
    return ""


def apply_verified_locators(pdf, manifest, canonical, chapter_by_number, selected_chapters):
    recovered = []
    offset = int(manifest["source"]["bookPageOffset"])
    for locator in (manifest.get("reconciliation") or {}).get("verifiedQuestionLocators", []):
        key = (int(locator["chapter"]), int(locator["topic"]), int(locator["question"]))
        if key[0] not in selected_chapters or key in canonical:
            continue
        chapter = chapter_by_number[key[0]]
        source_page = int(locator["sourcePage"])
        page = pdf[source_page + offset - 1]
        side, y, end_y = str(locator["side"]), float(locator["y"]), float(locator["endY"])
        marker = {
            "sourcePage": source_page, "side": side, "y": y, "page": page,
            "cutoff": answer_heading_y(page),
            "topic": {"number": key[1], "title": topic_title(canonical, key[0], key[1])},
        }
        row = recovered_row(
            manifest, chapter, key, marker, next_marker={"side": side, "y": end_y},
            reason="verified-source-locator",
        )
        row["review"]["reasons"].append("source-location-visually-verified")
        canonical[key] = row
        recovered.append(key)
    return recovered


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("pdf", type=Path)
    parser.add_argument("queue", type=Path)
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--report", type=Path, required=True)
    parser.add_argument("--start-chapter", type=int, default=1)
    parser.add_argument("--end-chapter", type=int, default=26)
    args = parser.parse_args()
    if not (1 <= args.start_chapter <= args.end_chapter <= 26):
        raise SystemExit("--start-chapter/--end-chapter must satisfy 1 <= start <= end <= 26")

    manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
    pdf = fitz.open(args.pdf)
    expected = expected_identities(pdf, manifest)
    rows = load_jsonl(args.queue)
    selected_chapters = set(range(args.start_chapter, args.end_chapter + 1))

    canonical = {}
    all_input_identities = {identity(row) for row in rows}
    for row in rows:
        key = identity(row)
        if key not in expected:
            continue
        old = canonical.get(key)
        score = int((row.get("review") or {}).get("extractionScore") or 0)
        old_score = int((old.get("review") or {}).get("extractionScore") or 0) if old else -1
        if old is None or score > old_score or (
            score == old_score and len(row.get("prompt") or "") > len(old.get("prompt") or "")
        ):
            canonical[key] = row

    chapter_by_number = {int(ch["number"]): ch for ch in manifest["chapters"]}
    missing_before = expected - set(canonical)
    recovered_broad, ambiguous, no_marker = [], [], []

    for chapter_number in sorted(selected_chapters & {key[0] for key in missing_before}):
        chapter = chapter_by_number[chapter_number]
        markers = broad_period_markers(pdf, manifest, chapter)
        all_page_markers = [marker for values in markers.values() for marker in values]
        for key in sorted(k for k in missing_before if k[0] == chapter_number):
            candidates = markers.get(key, [])
            if len(candidates) == 1:
                marker = candidates[0]
                same_side = sorted(
                    [m for m in all_page_markers
                     if m["sourcePage"] == marker["sourcePage"]
                     and m["side"] == marker["side"] and m["y"] > marker["y"]],
                    key=lambda item: item["y"],
                )
                next_marker = {"side": marker["side"], "y": same_side[0]["y"]} if same_side else None
                canonical[key] = recovered_row(manifest, chapter, key, marker, next_marker=next_marker)
                recovered_broad.append(key)
            elif candidates:
                ambiguous.append({"identity": list(key), "candidateMarkers": len(candidates)})
            else:
                no_marker.append(list(key))

    recovered_verified = apply_verified_locators(
        pdf, manifest, canonical, chapter_by_number, selected_chapters
    )

    remaining = sorted(expected - set(canonical))
    remaining_set = set(remaining)
    unresolved_no_marker = [key for key in no_marker if tuple(key) in remaining_set]
    output_rows = [canonical[key] for key in sorted(canonical)]
    write_jsonl(args.out, output_rows)

    report = {
        "schemaVersion": 2,
        "expectedChapterIdentities": len(expected),
        "inputRows": len(rows),
        "inputUniqueIdentities": len(all_input_identities),
        "inputExpectedIdentitiesCovered": len(all_input_identities & expected),
        "inputExtraneousIdentities": [list(key) for key in sorted(all_input_identities - expected)],
        "canonicalRowsBeforeRecovery": len(expected - missing_before),
        "recoveredByUniquePrintedMarker": len(recovered_broad),
        "recoveredByVerifiedLocator": len(recovered_verified),
        "recoveredVerifiedIdentities": [list(key) for key in sorted(recovered_verified)],
        "remainingExpectedIdentities": len(remaining),
        "remainingIdentities": [list(key) for key in remaining],
        "ambiguousMarkers": ambiguous,
        "noPrintedMarker": unresolved_no_marker,
        "outputRows": len(output_rows),
        "rule": "Recovered records remain draft and require explicit review before packing/publication.",
    }
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(
        json.dumps(report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(report, indent=2))
    if remaining or ambiguous:
        raise SystemExit(2)


if __name__ == "__main__":
    main()
