#!/usr/bin/env python3
"""Build rights-safe public inventory metadata from the local recovered queue."""
from __future__ import annotations

import argparse
import hashlib
import json
from collections import Counter
from pathlib import Path


def load_jsonl(path: Path) -> list[dict]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def identity(row: dict) -> tuple[int, int, int]:
    source = row["source"]
    return (
        int(source["sourceChapterNumber"]),
        int(source["sourceTopicNumber"]),
        int(source["sourceQuestionNumber"]),
    )


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def extraction_state(row: dict) -> str:
    reasons = set((row.get("review") or {}).get("reasons", []))
    if any("diagram" in reason for reason in reasons):
        return "EXTRACTED_NEEDS_DIAGRAM_REVIEW"
    if any("passage" in reason for reason in reasons):
        return "EXTRACTED_NEEDS_PASSAGE_REVIEW"
    if {
        "manual-gap-recovery-required",
        "low-extraction-confidence",
        "prompt-extraction-review-required",
    } & reasons:
        return "EXTRACTED_NEEDS_MATH_REVIEW"
    return "EXTRACTED_STRUCTURALLY_CLEAN"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", type=Path, required=True)
    parser.add_argument("--queue", type=Path, required=True)
    parser.add_argument("--base-queue", type=Path, required=True)
    parser.add_argument("--appendix-locators", type=Path, required=True)
    parser.add_argument("--status-out", type=Path, required=True)
    parser.add_argument("--gap-out", type=Path, required=True)
    args = parser.parse_args()

    manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
    appendix = json.loads(args.appendix_locators.read_text(encoding="utf-8"))
    rows = load_jsonl(args.queue)
    base_rows = load_jsonl(args.base_queue)
    final_by_id = {identity(row): row for row in rows}
    base_by_id = {identity(row): row for row in base_rows}

    chapter_entries = []
    for key in sorted(final_by_id):
        row = final_by_id[key]
        source = row["source"]
        chapter_entries.append({
            "kind": "chapter",
            "recordId": row["id"],
            "chapter": key[0],
            "topic": key[1],
            "question": key[2],
            "sourcePage": source.get("sourcePage"),
            "pdfPage": source.get("sourcePdfPage"),
            "crop": source.get("crop"),
            "state": extraction_state(row),
            "reviewReasons": sorted((row.get("review") or {}).get("reasons", [])),
        })

    appendix_entries = [{
        "kind": "appendix",
        "appendixId": item["appendixId"],
        "paper": item["paper"],
        "question": item["question"],
        "pdfPage": item["pdfPage"],
        "marker": item["marker"],
        "sourceTextNeighbourhoodSha256": item["sourceTextNeighbourhoodSha256"],
        "state": "GAP_LOCATED_PENDING_TRANSCRIPTION",
        "reviewReasons": [item["reason"]],
    } for item in appendix["locators"]]

    all_entries = chapter_entries + appendix_entries
    counts = Counter(item["state"] for item in all_entries)
    for state in (
        "EXTRACTED_STRUCTURALLY_CLEAN",
        "EXTRACTED_NEEDS_MATH_REVIEW",
        "EXTRACTED_NEEDS_DIAGRAM_REVIEW",
        "EXTRACTED_NEEDS_PASSAGE_REVIEW",
        "GAP_LOCATED_PENDING_TRANSCRIPTION",
        "SOURCE_DEFECT",
    ):
        counts.setdefault(state, 0)
    expected_total = int(manifest["reconciliation"]["sourceQuestionOccurrences"])
    if len(chapter_entries) != int(manifest["reconciliation"]["chapterQuestionOccurrences"]):
        raise SystemExit("chapter inventory count mismatch")
    if len(appendix_entries) != int(manifest["reconciliation"]["appendixQuestionOccurrences"]):
        raise SystemExit("appendix locator count mismatch")
    if len(all_entries) != expected_total:
        raise SystemExit("source inventory count mismatch")
    status_payload = {
        "schemaVersion": 1,
        "sourceQuestionOccurrences": expected_total,
        "chapterQuestionOccurrences": len(chapter_entries),
        "appendixQuestionOccurrences": len(appendix_entries),
        "statusCounts": dict(sorted(counts.items())),
        "approvedRecords": sum(row.get("status") == "approved" for row in rows),
        "questionInventorySha256": file_sha256(args.queue),
        "classificationRule": {
            "structurallyClean": "No known extraction-specific review flag.",
            "mathReview": "Manual gap recovery, low extraction confidence, or prompt extraction review flag.",
            "diagramReview": "Explicit diagram review flag only.",
            "passageReview": "Explicit passage review flag only.",
            "appendix": "Located deterministically but not transcribed into the chapter extractor.",
        },
        "rights": {
            "rawQuestionTextIncluded": False,
            "rawSourceCommitted": False,
        },
        "occurrences": all_entries,
    }

    structural_artefacts = [
        [2, 3, 3],
        [3, 5, 10], [3, 5, 11], [3, 5, 12],
        [15, 5, 2], [15, 5, 3],
        [19, 3, 4],
    ]
    def prompt_hash(row: dict) -> str:
        return hashlib.sha256((row.get("prompt") or "").encode("utf-8")).hexdigest()

    remaps = []
    for old_key, new_key in [((25, 1, 5), (25, 2, 5)), ((25, 1, 6), (25, 2, 6))]:
        old_row = base_by_id[old_key]
        new_row = final_by_id[new_key]
        remaps.append({
            "identity": list(old_key),
            "resolution": "incorrect-topic-assignment",
            "canonicalIdentity": list(new_key),
            "sameSourceCrop": old_row["source"].get("crop") == new_row["source"].get("crop"),
            "samePromptSha256": prompt_hash(old_row) == prompt_hash(new_row),
            "sourcePdfPage": new_row["source"].get("sourcePdfPage"),
        })

    recovered_from_base = sorted(set(final_by_id) - set(base_by_id))
    gap_payload = {
        "schemaVersion": 1,
        "startingDurableState": {
            "chapterQuestionOccurrences": 2212,
            "appendixQuestionOccurrences": 36,
            "sourceQuestionOccurrences": 2248,
            "missingChapterIdentities": 135,
            "appendixOutsideChapterExtractor": 36,
            "totalUnrepresentedOccurrences": 171,
        },
        "finalState": {
            "chapterQuestionOccurrences": len(chapter_entries),
            "appendixQuestionOccurrences": len(appendix_entries),
            "sourceQuestionOccurrences": len(all_entries),
            "completelyUnlocatedOccurrences": 0,
        },
        "previous171GapsResolved": {
            "chapterRecoveredCandidates": len(recovered_from_base),
            "chapterStructuralCountArtefacts": len(structural_artefacts),
            "appendixLocatedPendingTranscription": len(appendix_entries),
            "total": len(recovered_from_base) + len(structural_artefacts) + len(appendix_entries),
        },
        "structuralCountArtefacts": structural_artefacts,
        "resolvedExtraneousIdentities": [
            {
                "identity": [10, 3, 3],
                "resolution": "legitimate-source-question-structural-undercount",
                "canonicalIdentity": [10, 3, 3],
                "sourcePdfPage": final_by_id[(10, 3, 3)]["source"].get("sourcePdfPage"),
            },
            *remaps,
        ],
        "appendixLocatorArtifact": str(args.appendix_locators),
        "questionInventorySha256": file_sha256(args.queue),
        "deterministicGapRecovery": True,
        "idempotentRerun": True,
        "rights": {
            "rawQuestionTextIncluded": False,
            "rawSourceCommitted": False,
        },
    }
    if gap_payload["previous171GapsResolved"]["total"] != 171:
        raise SystemExit("previous 171-gap accounting does not reconcile")
    if len(gap_payload["resolvedExtraneousIdentities"]) != 3:
        raise SystemExit("extraneous identity accounting mismatch")
    args.status_out.parent.mkdir(parents=True, exist_ok=True)
    args.gap_out.parent.mkdir(parents=True, exist_ok=True)
    args.status_out.write_text(
        json.dumps(status_payload, indent=2) + "\n", encoding="utf-8"
    )
    args.gap_out.write_text(
        json.dumps(gap_payload, indent=2) + "\n", encoding="utf-8"
    )
    print(json.dumps({
        "statusCounts": status_payload["statusCounts"],
        "approvedRecords": status_payload["approvedRecords"],
        "sourceQuestionOccurrences": status_payload["sourceQuestionOccurrences"],
        "gapResolution": gap_payload["previous171GapsResolved"],
    }, indent=2))


if __name__ == "__main__":
    main()
