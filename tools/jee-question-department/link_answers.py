#!/usr/bin/env python3
"""Deterministically link source-provided JEE short answers.

Public artifacts contain only rights-safe metadata, hashes, statuses and
locators. Extracted answer representations remain under ignored work/.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
from collections import Counter
from pathlib import Path

import pymupdf as fitz

from answer_linking_core import (
    TYPE_ASSERTION,
    TYPE_DESC,
    TYPE_FILL,
    TYPE_INTEGER,
    TYPE_MATCH,
    TYPE_MULTI,
    TYPE_NUMERICAL,
    TYPE_SINGLE,
    TYPE_TF,
    TYPE_UNKNOWN,
    answer_marker_candidates,
    chapter_answer_regions,
    collapse,
    infer_chapter_answer_types,
    normalize_answer_fragment,
    parse_answer_key_regions,
    text_sha256,
)

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
DOCS = ROOT / "docs/jee-41y"
DEFAULT_MANIFEST = HERE / "source-manifest.json"
DEFAULT_RECONCILIATION = DOCS / "SOURCE_RECONCILIATION.json"
DEFAULT_INVENTORY_STATUS = DOCS / "QUESTION_EXTRACTION_STATUS.json"
DEFAULT_INVENTORY = HERE / "work/question-inventory-final.jsonl"
DEFAULT_PDF = ROOT / ".source/41-years-iit-jee-mathematics.pdf"
DEFAULT_LOCATORS = DOCS / "ANSWER_SOURCE_LOCATORS.json"
DEFAULT_STATUS = DOCS / "ANSWER_LINKING_STATUS.json"
DEFAULT_RESTRICTED = HERE / "work/answer-links.jsonl"

INVENTORY_SHA = (
    "351271cb135ff22e1998657921a409f176815f5ca012a3ab4219fa1d60fe359b"
)
BATCH_CHAPTERS = {
    "1-5": set(range(1, 6)),
    "6-10": set(range(6, 11)),
    "11-15": set(range(11, 16)),
    "16-20": set(range(16, 21)),
    "21-26": set(range(21, 27)),
}
FINAL_STATES = {
    "ANSWER_LINKED_HIGH_CONFIDENCE",
    "ANSWER_LINKED_NEEDS_TRANSCRIPTION_REVIEW",
    "ANSWER_MAPPING_AMBIGUOUS",
    "ANSWER_SOURCE_NOT_PRESENT",
    "SOLUTION_ONLY",
}
REPORT_TYPES = (
    TYPE_SINGLE,
    TYPE_MULTI,
    TYPE_INTEGER,
    TYPE_NUMERICAL,
    TYPE_FILL,
    TYPE_TF,
    TYPE_MATCH,
    TYPE_ASSERTION,
    TYPE_DESC,
    TYPE_UNKNOWN,
)


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def canonical_hash(value: object) -> str:
    encoded = json.dumps(
        value,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, value: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(value, ensure_ascii=False, sort_keys=True, indent=2)
        + "\n",
        encoding="utf-8",
    )


def load_jsonl(path: Path) -> list[dict]:
    if not path.exists():
        return []
    return [
        json.loads(line)
        for line in path.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]


def write_jsonl(path: Path, rows: list[dict]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        for row in rows:
            handle.write(
                json.dumps(
                    row,
                    ensure_ascii=False,
                    sort_keys=True,
                    separators=(",", ":"),
                )
                + "\n"
            )


def canonical_id(occurrence: dict) -> str:
    if occurrence["kind"] == "chapter":
        return occurrence["recordId"]
    return (
        f"arihant41-{occurrence['appendixId']}"
        f"-p{int(occurrence['paper']):02d}"
        f"-q{int(occurrence['question']):03d}"
    )


def verify_inventory(status: dict, inventory: Path) -> str:
    expected = status["questionInventorySha256"]
    actual = file_sha256(inventory)
    if expected != INVENTORY_SHA or actual != INVENTORY_SHA:
        raise SystemExit(
            "canonical question inventory SHA-256 invariant failed: "
            f"status={expected}, file={actual}"
        )
    if int(status["sourceQuestionOccurrences"]) != 2242:
        raise SystemExit("canonical source occurrence count is not 2,242")
    return actual


def public_identity(occurrence: dict) -> dict:
    if occurrence["kind"] == "chapter":
        return {
            "kind": "chapter",
            "canonicalQuestionId": occurrence["recordId"],
            "chapter": int(occurrence["chapter"]),
            "topic": int(occurrence["topic"]),
            "question": int(occurrence["question"]),
        }
    return {
        "kind": "appendix",
        "canonicalQuestionId": canonical_id(occurrence),
        "appendixId": occurrence["appendixId"],
        "paper": int(occurrence["paper"]),
        "question": int(occurrence["question"]),
    }


def answer_region_for_page(
    regions: list[dict],
    pdf_page: int,
) -> dict | None:
    for region in regions:
        if int(region["pdfPage"]) == int(pdf_page):
            return region
    return None


def chapter_record(
    pdf: fitz.Document,
    occurrence: dict,
    declared_type: str,
    parsed: dict[int, dict[int, dict]],
    regions: list[dict],
    chapter_meta: dict,
    offset: int,
) -> dict:
    identity = public_identity(occurrence)
    topic = int(occurrence["topic"])
    question = int(occurrence["question"])
    entry = parsed.get(topic, {}).get(question)
    record = {
        **identity,
        "answerType": declared_type,
        "mappingConfidence": "HIGH",
        "reviewStatus": "OK",
        "sourceAnswerSha256": None,
        "normalizedAnswerSha256": None,
        "source": {
            "chapter": int(occurrence["chapter"]),
            "topic": topic,
            "question": question,
        },
    }

    if entry is None:
        if declared_type == TYPE_DESC:
            record["answerLinkingState"] = "SOLUTION_ONLY"
            record["reviewStatus"] = "SOURCE_SHORT_ANSWER_NOT_PRESENT"
            record["solutionLocator"] = {
                "pdfPageStart": (
                    int(chapter_meta["solutionBookPageStart"]) + offset
                ),
                "locatorPrecision": "chapter-solution-section",
            }
        else:
            record["answerLinkingState"] = "ANSWER_SOURCE_NOT_PRESENT"
            record["reviewStatus"] = "SOURCE_SHORT_ANSWER_NOT_PRESENT"
        return record

    raw = entry["raw"]
    normalized, effective_type, needs_review = (
        normalize_answer_fragment(raw, declared_type)
    )
    record["answerType"] = effective_type
    record["sourceAnswerSha256"] = text_sha256(raw)
    record["normalizedAnswerSha256"] = canonical_hash(normalized)
    record["answerLinkingState"] = (
        "ANSWER_LINKED_NEEDS_TRANSCRIPTION_REVIEW"
        if needs_review
        else "ANSWER_LINKED_HIGH_CONFIDENCE"
    )
    record["reviewStatus"] = (
        "ANSWER_NEEDS_REVIEW" if needs_review else "OK"
    )

    answer_pdf = int(entry["pdfPage"])
    region = answer_region_for_page(regions, answer_pdf)
    if region is None:
        raise ValueError(
            f"answer page {answer_pdf} is outside chapter answer regions"
        )
    page = pdf[answer_pdf - 1]
    record["source"].update({
        "pdfPage": answer_pdf,
        "printedPage": answer_pdf - offset,
        "answerRegionBBox": region["bbox"],
        "answerRegionRole": region["role"],
        "markerCandidateBBoxes": answer_marker_candidates(
            page,
            region["bbox"],
            question,
        ),
    })
    record["_restricted"] = {
        "sourceAnswerRaw": raw,
        "normalizedAnswer": normalized,
    }
    return record
APPENDIX_OPTION_RE = re.compile(
    r"^\(\s*([a-dA-D](?:\s*,\s*[a-dA-D])*)\s*\)"
)


def appendix_answer_type(paper: int, question: int) -> str:
    if paper == 1:
        if question <= 4:
            return TYPE_SINGLE
        if question <= 12:
            return TYPE_MULTI
        return TYPE_NUMERICAL
    if question <= 8:
        return TYPE_MULTI
    if question <= 14:
        return TYPE_NUMERICAL
    return TYPE_SINGLE


def appendix_solution_starts(
    pdf: fitz.Document,
    start_page: int,
    end_page: int,
) -> dict[tuple[int, int], dict]:
    """Locate each appendix solution start without extracting solution bodies."""
    current_paper = 0
    expected = {1: 1, 2: 1}
    found: dict[tuple[int, int], dict] = {}
    for pdf_page in range(start_page, end_page + 1):
        page = pdf[pdf_page - 1]
        for block in page.get_text("dict")["blocks"]:
            for line in block.get("lines", []):
                text = collapse(
                    "".join(span["text"] for span in line["spans"])
                )
                y0 = float(line["bbox"][1])
                if text == "Paper 1" and y0 > 100:
                    current_paper = 1
                    continue
                if text == "Paper 2" and y0 > 100:
                    current_paper = 2
                    continue
                if current_paper not in (1, 2):
                    continue
                match = re.match(r"^(\d{1,2})\.\s*(.*)$", text)
                if not match:
                    continue
                question = int(match.group(1))
                if question != expected[current_paper]:
                    continue
                remainder = match.group(2).strip()
                answer_type = appendix_answer_type(
                    current_paper,
                    question,
                )
                source_answer = None
                if answer_type in (TYPE_SINGLE, TYPE_MULTI):
                    option = APPENDIX_OPTION_RE.match(remainder)
                    if option:
                        source_answer = option.group(0)
                found[(current_paper, question)] = {
                    "pdfPage": pdf_page,
                    "solutionStartBBox": [
                        round(float(value), 2)
                        for value in line["bbox"]
                    ],
                    "solutionStartTextSha256": text_sha256(remainder),
                    "sourceAnswerRaw": source_answer,
                }
                expected[current_paper] += 1
    return found


def appendix_record(
    occurrence: dict,
    solution_starts: dict[tuple[int, int], dict],
) -> dict:
    paper = int(occurrence["paper"])
    question = int(occurrence["question"])
    answer_type = appendix_answer_type(paper, question)
    start = solution_starts.get((paper, question))
    record = {
        **public_identity(occurrence),
        "answerType": answer_type,
        "mappingConfidence": "HIGH",
        "reviewStatus": "OK",
        "sourceAnswerSha256": None,
        "normalizedAnswerSha256": None,
        "source": {
            "questionPdfPage": int(occurrence["pdfPage"]),
            "questionMarkerBBox": occurrence["marker"]["bbox"],
        },
    }
    if start is None:
        record["answerLinkingState"] = "ANSWER_MAPPING_AMBIGUOUS"
        record["mappingConfidence"] = "AMBIGUOUS"
        record["reviewStatus"] = "SOLUTION_START_NOT_LOCATED"
        return record

    record["solutionLocator"] = {
        "pdfPage": int(start["pdfPage"]),
        "bbox": start["solutionStartBBox"],
        "solutionStartTextSha256": start["solutionStartTextSha256"],
    }
    raw = start["sourceAnswerRaw"]
    if raw is None:
        record["answerLinkingState"] = "SOLUTION_ONLY"
        record["reviewStatus"] = "NO_COMPACT_ANSWER_BEFORE_SOLUTION"
        return record

    normalized, effective_type, needs_review = (
        normalize_answer_fragment(raw, answer_type)
    )
    record["answerType"] = effective_type
    record["sourceAnswerSha256"] = text_sha256(raw)
    record["normalizedAnswerSha256"] = canonical_hash(normalized)
    record["answerLinkingState"] = (
        "ANSWER_LINKED_NEEDS_TRANSCRIPTION_REVIEW"
        if needs_review
        else "ANSWER_LINKED_HIGH_CONFIDENCE"
    )
    record["reviewStatus"] = (
        "ANSWER_NEEDS_REVIEW" if needs_review else "OK"
    )
    record["source"].update({
        "pdfPage": int(start["pdfPage"]),
        "answerBBox": start["solutionStartBBox"],
        "answerRepresentation": "solution-leading-option-only",
    })
    record["_restricted"] = {
        "sourceAnswerRaw": raw,
        "normalizedAnswer": normalized,
    }
    return record
def public_status_record(record: dict) -> dict:
    keys = (
        "kind",
        "canonicalQuestionId",
        "chapter",
        "topic",
        "appendixId",
        "paper",
        "question",
        "answerLinkingState",
        "answerType",
        "mappingConfidence",
        "reviewStatus",
        "sourceAnswerSha256",
        "normalizedAnswerSha256",
    )
    return {
        key: record[key]
        for key in keys
        if key in record
    }


def public_locator_record(record: dict) -> dict:
    out = {
        "canonicalQuestionId": record["canonicalQuestionId"],
        "answerLinkingState": record["answerLinkingState"],
        "answerType": record["answerType"],
        "sourceAnswerSha256": record["sourceAnswerSha256"],
    }
    if "source" in record:
        out["source"] = record["source"]
    if "solutionLocator" in record:
        out["solutionLocator"] = record["solutionLocator"]
    return out


def restricted_record(record: dict) -> dict:
    out = {
        key: value
        for key, value in record.items()
        if key != "_restricted"
    }
    out.update(record.get("_restricted", {}))
    return out


def build_regions(
    pdf: fitz.Document,
    reconciliation: dict,
    manifest: dict,
) -> list[dict]:
    offset = int(manifest["source"]["bookPageOffset"])
    pages = {
        int(page["pdfPage"]): page
        for page in reconciliation["pages"]
    }
    regions = []
    for chapter in reconciliation["chapters"]:
        chapter_regions = chapter_answer_regions(
            pdf,
            chapter,
            offset,
        )
        for region in chapter_regions:
            page_meta = pages[int(region["pdfPage"])]
            regions.append({
                "kind": "chapter",
                "chapter": int(chapter["number"]),
                "chapterTitle": chapter["title"],
                **region,
                "pageClass": page_meta["class"],
                "regionBasis": (
                    "source-layout-bounded-compact-answer-region"
                ),
            })
    for appendix in manifest.get("appendices", []):
        regions.append({
            "kind": "appendix",
            "appendixId": appendix["id"],
            "pdfPageStart": int(appendix["solutionPdfPageStart"]),
            "pdfPageEnd": int(appendix["pdfPageEnd"]),
            "regionBasis": (
                "solution-leading-option-locators-only;"
                " worked-solution bodies excluded"
            ),
        })
    return regions


def completed_batches(previous: dict | None, batch: str) -> list[str]:
    done = []
    if previous:
        done = list(
            previous.get("processing", {}).get(
                "completedBatches",
                [],
            )
        )
    if batch == "all":
        return [*BATCH_CHAPTERS.keys(), "appendix"]
    if batch not in done:
        done.append(batch)
    order = [*BATCH_CHAPTERS.keys(), "appendix"]
    return [name for name in order if name in done]


def build_summary(records: list[dict], total: int) -> dict:
    states = Counter(
        record["answerLinkingState"] for record in records
    )
    types = Counter(record["answerType"] for record in records)
    appendix = [
        record
        for record in records
        if record["kind"] == "appendix"
    ]
    appendix_linked = sum(
        record["answerLinkingState"]
        in {
            "ANSWER_LINKED_HIGH_CONFIDENCE",
            "ANSWER_LINKED_NEEDS_TRANSCRIPTION_REVIEW",
        }
        for record in appendix
    )
    explicit = (
        states["ANSWER_LINKED_HIGH_CONFIDENCE"]
        + states["ANSWER_LINKED_NEEDS_TRANSCRIPTION_REVIEW"]
    )
    return {
        "totalCanonicalQuestions": total,
        "processedOccurrences": len(records),
        "pendingOccurrences": total - len(records),
        "answerLinkedHighConfidence": (
            states["ANSWER_LINKED_HIGH_CONFIDENCE"]
        ),
        "answerLinkedNeedsReview": (
            states["ANSWER_LINKED_NEEDS_TRANSCRIPTION_REVIEW"]
        ),
        "answerAmbiguous": states["ANSWER_MAPPING_AMBIGUOUS"],
        "sourceShortAnswerUnavailable": (
            states["ANSWER_SOURCE_NOT_PRESENT"]
        ),
        "solutionOnly": states["SOLUTION_ONLY"],
        "questionsWithExplicitSourceAnswers": explicit,
        "questionsWithoutExplicitSourceShortAnswers": (
            len(records) - explicit
        ),
        "answerTypes": {
            answer_type: types[answer_type]
            for answer_type in REPORT_TYPES
        },
        "appendixAnswerLinked": appendix_linked,
        "appendixUnresolved": len(appendix) - appendix_linked,
    }
def process_chapters(
    pdf: fitz.Document,
    reconciliation: dict,
    inventory_status: dict,
    manifest: dict,
    chapters: set[int],
) -> list[dict]:
    offset = int(manifest["source"]["bookPageOffset"])
    output = []
    occurrences = inventory_status["occurrences"]
    for chapter_number in sorted(chapters):
        chapter = next(
            item
            for item in reconciliation["chapters"]
            if int(item["number"]) == chapter_number
        )
        chapter_occurrences = [
            occurrence
            for occurrence in occurrences
            if occurrence["kind"] == "chapter"
            and int(occurrence["chapter"]) == chapter_number
        ]
        expected = {
            int(topic): int(count)
            for topic, count
            in chapter["reconciledQuestionCounts"].items()
        }
        regions = chapter_answer_regions(
            pdf,
            chapter,
            offset,
        )
        parsed = parse_answer_key_regions(
            pdf,
            regions,
            expected,
        )
        declared_types = infer_chapter_answer_types(
            pdf,
            chapter_occurrences,
            [int(value) for value in chapter["questionPdfPages"]],
            int(chapter["answerBookPage"]) + offset,
        )
        for occurrence in chapter_occurrences:
            record_id = canonical_id(occurrence)
            declared = declared_types.get(
                record_id,
                TYPE_UNKNOWN,
            )
            output.append(
                chapter_record(
                    pdf,
                    occurrence,
                    declared,
                    parsed,
                    regions,
                    chapter,
                    offset,
                )
            )
    return output


def process_appendix(
    pdf: fitz.Document,
    inventory_status: dict,
    manifest: dict,
) -> list[dict]:
    appendix = manifest.get("appendices", [])[0]
    starts = appendix_solution_starts(
        pdf,
        int(appendix["solutionPdfPageStart"]),
        int(appendix["pdfPageEnd"]),
    )
    output = []
    for occurrence in inventory_status["occurrences"]:
        if occurrence["kind"] != "appendix":
            continue
        output.append(
            appendix_record(
                occurrence,
                starts,
            )
        )
    return output


def merge_records(
    existing: list[dict],
    updates: list[dict],
    inventory_status: dict,
) -> list[dict]:
    canonical_order = [
        canonical_id(occurrence)
        for occurrence in inventory_status["occurrences"]
    ]
    valid_ids = set(canonical_order)
    merged = {
        record["canonicalQuestionId"]: record
        for record in existing
        if record.get("canonicalQuestionId") in valid_ids
    }
    for record in updates:
        merged[record["canonicalQuestionId"]] = restricted_record(record)
    return [
        merged[record_id]
        for record_id in canonical_order
        if record_id in merged
    ]


def status_payload(
    records: list[dict],
    total: int,
    inventory_sha: str,
    pdf_sha: str,
    restricted_sha: str,
    batches: list[str],
) -> dict:
    summary = build_summary(records, total)
    is_complete = (
        len(records) == total
        and not summary["pendingOccurrences"]
        and all(
            record["answerLinkingState"] in FINAL_STATES
            for record in records
        )
    )
    return {
        "schemaVersion": 1,
        "stage": "ANSWER_KEY_LINKING",
        "status": "COMPLETE" if is_complete else "IN_PROGRESS",
        "inventorySha256": inventory_sha,
        "sourcePdfSha256": pdf_sha,
        "processing": {
            "completedBatches": batches,
            "batchOrder": [*BATCH_CHAPTERS.keys(), "appendix"],
        },
        "summary": summary,
        "rights": {
            "rawSourceCommitted": False,
            "bulkAnswerTextIncluded": False,
            "restrictedAnswerDataset": str(
                DEFAULT_RESTRICTED.relative_to(ROOT)
            ),
            "restrictedAnswerDatasetSha256": restricted_sha,
        },
        "occurrences": [
            public_status_record(record)
            for record in records
        ],
    }


def locator_payload(
    pdf: fitz.Document,
    reconciliation: dict,
    manifest: dict,
    records: list[dict],
    inventory_sha: str,
    pdf_sha: str,
    restricted_sha: str | None,
) -> dict:
    return {
        "schemaVersion": 2,
        "stage": "ANSWER_KEY_LINKING",
        "inventorySha256": inventory_sha,
        "sourcePdfSha256": pdf_sha,
        "rights": {
            "rawSourceCommitted": False,
            "bulkAnswerTextIncluded": False,
            "restrictedAnswerDataset": str(
                DEFAULT_RESTRICTED.relative_to(ROOT)
            ),
            "restrictedAnswerDatasetSha256": restricted_sha,
        },
        "regions": build_regions(
            pdf,
            reconciliation,
            manifest,
        ),
        "occurrenceLocators": [
            public_locator_record(record)
            for record in records
        ],
    }
def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--batch",
        choices=[*BATCH_CHAPTERS.keys(), "appendix", "all"],
        default="all",
    )
    parser.add_argument(
        "--manifest",
        type=Path,
        default=DEFAULT_MANIFEST,
    )
    parser.add_argument(
        "--reconciliation",
        type=Path,
        default=DEFAULT_RECONCILIATION,
    )
    parser.add_argument(
        "--inventory-status",
        type=Path,
        default=DEFAULT_INVENTORY_STATUS,
    )
    parser.add_argument(
        "--inventory",
        type=Path,
        default=DEFAULT_INVENTORY,
    )
    parser.add_argument("--pdf", type=Path, default=DEFAULT_PDF)
    parser.add_argument(
        "--locators-out",
        type=Path,
        default=DEFAULT_LOCATORS,
    )
    parser.add_argument(
        "--status-out",
        type=Path,
        default=DEFAULT_STATUS,
    )
    parser.add_argument(
        "--restricted-out",
        type=Path,
        default=DEFAULT_RESTRICTED,
    )
    parser.add_argument("--discover-only", action="store_true")
    args = parser.parse_args()

    manifest = load_json(args.manifest)
    reconciliation = load_json(args.reconciliation)
    inventory_status = load_json(args.inventory_status)
    inventory_sha = verify_inventory(
        inventory_status,
        args.inventory,
    )
    pdf_sha = file_sha256(args.pdf)
    if pdf_sha != reconciliation["source"]["sha256"]:
        raise SystemExit("source PDF SHA-256 does not match reconciliation")
    pdf = fitz.open(args.pdf)
    if len(pdf) != int(reconciliation["source"]["pdfPages"]):
        raise SystemExit("source PDF page count invariant failed")

    previous = (
        load_json(args.status_out)
        if args.status_out.exists()
        else None
    )
    existing = load_jsonl(args.restricted_out)

    if args.discover_only:
        write_json(
            args.locators_out,
            locator_payload(
                pdf,
                reconciliation,
                manifest,
                [],
                inventory_sha,
                pdf_sha,
                file_sha256(args.restricted_out)
                if args.restricted_out.exists()
                else None,
            ),
        )
        print(json.dumps({
            "inventorySha256": inventory_sha,
            "regions": len(
                build_regions(pdf, reconciliation, manifest)
            ),
        }, indent=2))
        return

    if args.batch == "all":
        updates = process_chapters(
            pdf,
            reconciliation,
            inventory_status,
            manifest,
            set(range(1, 27)),
        )
        updates.extend(
            process_appendix(
                pdf,
                inventory_status,
                manifest,
            )
        )
    elif args.batch == "appendix":
        updates = process_appendix(
            pdf,
            inventory_status,
            manifest,
        )
    else:
        updates = process_chapters(
            pdf,
            reconciliation,
            inventory_status,
            manifest,
            BATCH_CHAPTERS[args.batch],
        )

    records = merge_records(
        existing,
        updates,
        inventory_status,
    )
    write_jsonl(args.restricted_out, records)
    restricted_sha = file_sha256(args.restricted_out)
    batches = completed_batches(previous, args.batch)
    total = int(inventory_status["sourceQuestionOccurrences"])

    status = status_payload(
        records,
        total,
        inventory_sha,
        pdf_sha,
        restricted_sha,
        batches,
    )
    locators = locator_payload(
        pdf,
        reconciliation,
        manifest,
        records,
        inventory_sha,
        pdf_sha,
        restricted_sha,
    )
    write_json(args.status_out, status)
    write_json(args.locators_out, locators)

    print(json.dumps({
        "batch": args.batch,
        "processedOccurrences": len(records),
        "restrictedSha256": restricted_sha,
        "inventorySha256": inventory_sha,
        "summary": status["summary"],
    }, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
