#!/usr/bin/env python3
"""Deterministically link source-provided JEE answer keys to canonical inventory.

Public outputs contain locators, hashes, classifications, and statuses only.
Source answer text is written only to the ignored work/ directory.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from collections import Counter
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
DEFAULT_MANIFEST = HERE / "source-manifest.json"
DEFAULT_RECONCILIATION = ROOT / "docs/jee-41y/SOURCE_RECONCILIATION.json"
DEFAULT_STATUS = ROOT / "docs/jee-41y/QUESTION_EXTRACTION_STATUS.json"
DEFAULT_INVENTORY = HERE / "work/question-inventory-final.jsonl"
DEFAULT_PDF = ROOT / ".source/41-years-iit-jee-mathematics.pdf"
DEFAULT_LOCATORS = ROOT / "docs/jee-41y/ANSWER_SOURCE_LOCATORS.json"
DEFAULT_LINK_STATUS = ROOT / "docs/jee-41y/ANSWER_LINKING_STATUS.json"
DEFAULT_RESTRICTED = HERE / "work/answer-links.jsonl"

ANSWER_STATES = (
    "ANSWER_LINKED_HIGH_CONFIDENCE",
    "ANSWER_LINKED_NEEDS_TRANSCRIPTION_REVIEW",
    "ANSWER_MAPPING_AMBIGUOUS",
    "ANSWER_SOURCE_NOT_PRESENT",
    "SOLUTION_ONLY",
)
ANSWER_TYPES = (
    "SINGLE_CORRECT_OPTION",
    "MULTIPLE_CORRECT_OPTIONS",
    "INTEGER",
    "NUMERICAL_VALUE",
    "FILL_IN_THE_BLANK",
    "TRUE_FALSE",
    "MATCH_THE_COLUMNS",
    "ASSERTION_REASON",
    "DESCRIPTIVE_SOURCE_ANSWER",
    "NO_SHORT_ANSWER_KEY",
    "UNKNOWN_REQUIRES_REVIEW",
)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def read_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def verify_inventory(status: dict, inventory: Path) -> str:
    expected = status["questionInventorySha256"]
    actual = sha256(inventory)
    if actual != expected:
        raise SystemExit(f"inventory SHA mismatch: expected {expected}, got {actual}")
    if status["sourceQuestionOccurrences"] != 2242:
        raise SystemExit("canonical inventory count is not 2,242")
    return actual
def discover_answer_regions(reconciliation: dict, manifest: dict) -> list[dict]:
    pages = {int(p["pdfPage"]): p for p in reconciliation["pages"]}
    regions = []
    for chapter in manifest["chapters"]:
        number = int(chapter["number"])
        answer_pdf = int(chapter["answerPage"]) + int(manifest["source"]["bookPageOffset"])
        page = pages[answer_pdf]
        if "answer-key" not in page["class"]:
            raise SystemExit(f"chapter {number} answer page {answer_pdf} is not answer-bearing")
        regions.append({
            "kind": "chapter",
            "chapter": number,
            "chapterTitle": chapter["title"],
            "pdfPage": answer_pdf,
            "printedPage": int(chapter["answerPage"]),
            "pageClass": page["class"],
            "regionBasis": "reconciled-answer-page",
        })

    for appendix in manifest.get("appendices", []):
        start = int(appendix["solutionPdfPageStart"])
        end = int(appendix["pdfPageEnd"])
        regions.append({
            "kind": "appendix",
            "appendixId": appendix["id"],
            "pdfPageStart": start,
            "pdfPageEnd": end,
            "pageClasses": [pages[n]["class"] for n in range(start, end + 1)],
            "regionBasis": "reconciled-appendix-solution-range",
        })
    return regions
def checkpoint_payload(inventory_sha: str, regions: list[dict], pdf: Path) -> dict:
    return {
        "schemaVersion": 1,
        "stage": "ANSWER_KEY_LINKING",
        "inventorySha256": inventory_sha,
        "sourcePdfSha256": sha256(pdf),
        "rights": {
            "rawSourceCommitted": False,
            "bulkAnswerTextIncluded": False,
            "restrictedAnswerDataset": str(DEFAULT_RESTRICTED.relative_to(ROOT)),
        },
        "regions": regions,
    }


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    ap.add_argument("--reconciliation", type=Path, default=DEFAULT_RECONCILIATION)
    ap.add_argument("--inventory-status", type=Path, default=DEFAULT_STATUS)
    ap.add_argument("--inventory", type=Path, default=DEFAULT_INVENTORY)
    ap.add_argument("--pdf", type=Path, default=DEFAULT_PDF)
    ap.add_argument("--locators-out", type=Path, default=DEFAULT_LOCATORS)
    ap.add_argument("--discover-only", action="store_true")
    args = ap.parse_args()

    manifest = read_json(args.manifest)
    reconciliation = read_json(args.reconciliation)
    status = read_json(args.inventory_status)
    inventory_sha = verify_inventory(status, args.inventory)
    regions = discover_answer_regions(reconciliation, manifest)
    write_json(args.locators_out, checkpoint_payload(inventory_sha, regions, args.pdf))
    print(json.dumps({
        "inventorySha256": inventory_sha,
        "answerBearingChapterRegions": sum(r["kind"] == "chapter" for r in regions),
        "appendixRegions": sum(r["kind"] == "appendix" for r in regions),
        "sourcePdfSha256": sha256(args.pdf),
    }, indent=2))


if __name__ == "__main__":
    main()
