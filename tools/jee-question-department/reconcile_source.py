#!/usr/bin/env python3
"""Build a durable, non-content JEE source reconciliation report.

The report intentionally contains page classes, counts and hashes only. It never
serialises source question/solution text, so it is safe to commit while the
user-provided source PDF and extracted corpus remain local/restricted.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
from collections import Counter, defaultdict
from pathlib import Path

try:
    import fitz  # PyMuPDF
except ImportError as exc:
    raise SystemExit("PyMuPDF is required; install tools/jee-question-department/requirements.txt") from exc

HERE = Path(__file__).resolve().parent
DEFAULT_MANIFEST = HERE / "source-manifest.json"
DEFAULT_QUEUE = HERE / "work" / "review-queue.jsonl"


def sha256(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def normalise(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip().lower().replace("&", "and")


def page_lines(page) -> list[str]:
    return [normalise(line) for line in page.get_text("text", sort=True).splitlines() if line.strip()]


def has_heading(page, kind: str) -> bool:
    lines = page_lines(page)
    if kind == "answers":
        return any(line == "answers" for line in lines)
    if kind == "solutions":
        return any(("hints" in line and "solutions" in line) for line in lines)
    raise ValueError(kind)


def load_queue(path: Path) -> list[dict]:
    if not path.exists():
        return []
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def chapter_page_plan(pdf, manifest: dict, chapter: dict) -> tuple[list[dict], int | None]:
    off = int(manifest["source"]["bookPageOffset"])
    answer = int(chapter["answerPage"])
    end = int(chapter["bookPageEnd"])
    solution_start = None
    for book_page in range(answer, end + 1):
        if has_heading(pdf[book_page + off - 1], "solutions"):
            solution_start = book_page
            break

    out = []
    for book_page in range(int(chapter["bookPageStart"]), end + 1):
        pdf_page = book_page + off
        page = pdf[pdf_page - 1]
        if book_page < answer:
            kind = "questions"
        elif solution_start is None or book_page < solution_start:
            kind = "answer-key"
        elif book_page == solution_start and has_heading(page, "answers"):
            kind = "answer-key+solutions"
        else:
            kind = "solutions"
        out.append({"pdfPage": pdf_page, "bookPage": book_page, "class": kind})
    return out, solution_start


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("pdf", type=Path)
    ap.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    ap.add_argument("--queue", type=Path, default=DEFAULT_QUEUE)
    ap.add_argument("--out", type=Path, required=True)
    args = ap.parse_args()

    manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
    rows = load_queue(args.queue)
    pdf = fitz.open(args.pdf)
    expected_pages = int(manifest["source"]["pdfPages"])
    if len(pdf) != expected_pages:
        raise SystemExit(f"PDF page count mismatch: expected {expected_pages}, got {len(pdf)}")

    page_map: dict[int, dict] = {
        p: {"pdfPage": p, "class": "front-matter"} for p in range(1, int(manifest["source"]["bookPageOffset"]) + 1)
    }
    rows_by_chapter = defaultdict(list)
    for row in rows:
        number = (row.get("source") or {}).get("sourceChapterNumber")
        rows_by_chapter[number].append(row)

    chapters = []
    for chapter in manifest["chapters"]:
        plan, solution_start = chapter_page_plan(pdf, manifest, chapter)
        for entry in plan:
            if entry["pdfPage"] in page_map:
                raise SystemExit(f"page {entry['pdfPage']} assigned twice")
            page_map[entry["pdfPage"]] = {
                **entry,
                "sourceChapterNumber": chapter["number"],
                "sourceChapter": chapter["title"],
            }

        qrows = rows_by_chapter.get(chapter["number"], [])
        extracted_pages = sorted({
            (r.get("source") or {}).get("sourcePdfPage")
            for r in qrows
            if isinstance((r.get("source") or {}).get("sourcePdfPage"), int)
        })
        question_pages = [p["pdfPage"] for p in plan if p["class"] == "questions"]
        topics = sorted({
            (r.get("source") or {}).get("sourceTopicNumber")
            for r in qrows
            if isinstance((r.get("source") or {}).get("sourceTopicNumber"), int)
        })
        chapters.append({
            "number": chapter["number"],
            "title": chapter["title"],
            "questionPdfPages": question_pages,
            "questionPageCount": len(question_pages),
            "answerBookPage": chapter["answerPage"],
            "solutionBookPageStart": solution_start,
            "extractedDraftRecords": len(qrows),
            "extractedTopics": len(topics),
            "candidateQuestionPages": extracted_pages,
            "questionPagesWithoutCurrentCandidate": sorted(set(question_pages) - set(extracted_pages)),
        })

    for appendix in manifest.get("appendices", []):
        q_start = appendix.get("questionPdfPageStart", appendix["pdfPageStart"])
        q_end = appendix.get("questionPdfPageEnd")
        s_start = appendix.get("solutionPdfPageStart")
        for pdf_page in range(int(appendix["pdfPageStart"]), int(appendix["pdfPageEnd"]) + 1):
            if q_end is not None and int(q_start) <= pdf_page <= int(q_end):
                kind = "appendix-questions"
            elif s_start is not None and pdf_page >= int(s_start):
                kind = "appendix-solutions"
            else:
                kind = "appendix-unresolved"
            if pdf_page in page_map:
                raise SystemExit(f"page {pdf_page} assigned twice")
            page_map[pdf_page] = {"pdfPage": pdf_page, "class": kind, "appendix": appendix["id"]}

    unaccounted = sorted(set(range(1, expected_pages + 1)) - set(page_map))
    class_counts = Counter(entry["class"] for entry in page_map.values())
    source = manifest["source"]
    report = {
        "schemaVersion": 1,
        "source": {
            "title": source["title"],
            "edition": source["edition"],
            "publisher": source.get("publisher"),
            "pdfPages": expected_pages,
            "sha256": sha256(args.pdf),
        },
        "rights": {
            "sourceProvidedByProjectOwner": True,
            "redistributionRightsVerified": False,
            "rawSourceCommitted": False,
            "rawExtractedCorpusCommitted": False,
        },
        "summary": {
            "pagesAccountedFor": len(page_map),
            "unaccountedPages": unaccounted,
            "pageClasses": dict(sorted(class_counts.items())),
            "chapters": len(manifest["chapters"]),
            "draftRecords": len(rows),
            "approvedRecords": sum(r.get("status") == "approved" for r in rows),
            "recordsWithAnswers": sum(r.get("answer") is not None for r in rows),
            "recordsWithWorkedSteps": sum(bool(r.get("steps")) for r in rows),
            "tracks": dict(Counter((r.get("exam") or {}).get("track") or "unresolved" for r in rows)),
            "answerTypes": dict(Counter(r.get("answerType") or "unresolved" for r in rows)),
        },
        "chapters": chapters,
        "pages": [page_map[p] for p in sorted(page_map)],
        "queue": {
            "path": str(args.queue),
            "sha256": sha256(args.queue) if args.queue.exists() else None,
            "note": "Queue path is local/ignored; report contains metadata only.",
        },
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    args.out.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(report["summary"], indent=2))
    if unaccounted:
        raise SystemExit(2)


if __name__ == "__main__":
    main()
