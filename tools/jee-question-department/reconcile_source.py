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

from extract import answer_heading_y, line_groups, question_candidates

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


def structural_question_counts(pdf, manifest: dict, chapter: dict) -> dict[int, int]:
    """Count contiguous printed question numbers per topic before Answers."""
    off = int(manifest["source"]["bookPageOffset"])
    heads, pages = [], []
    for book_page in range(int(chapter["bookPageStart"]), int(chapter["bookPageEnd"]) + 1):
        page = pdf[book_page + off - 1]
        cutoff = answer_heading_y(page)
        limit = cutoff if cutoff is not None else float("inf")
        pages.append((book_page, page, limit))
        for words in line_groups(page.get_text("words")).values():
            tokens = [str(w[4]) for w in words]
            for i, token in enumerate(tokens[:-1]):
                if token.lower() == "topic" and tokens[i + 1].isdigit() and float(words[i][1]) < limit:
                    heads.append((book_page, float(words[i][1]), int(tokens[i + 1])))
        if cutoff is not None:
            break
    if not heads:
        heads = [(int(chapter["bookPageStart"]), 0.0, 1)]
    heads.sort()

    seen = defaultdict(lambda: defaultdict(list))
    for book_page, page, limit in pages:
        width, height = float(page.rect.width), float(page.rect.height)
        for words in line_groups(page.get_text("words")).values():
            halves = ([w for w in words if w[0] < width / 2], [w for w in words if w[0] >= width / 2])
            for side, half in enumerate(halves):
                if not half:
                    continue
                word = half[0]
                y = float(word[1])
                if y >= limit or y < height * 0.10:
                    continue
                match = re.fullmatch(r"(\d{1,3})(\.*)", str(word[4]).strip())
                if not match:
                    continue
                x = float(word[0]) / width
                if not ((0.07 <= x <= 0.20) if side == 0 else (0.48 <= x <= 0.62)):
                    continue
                eligible = [h for h in heads if (h[0], h[1]) <= (book_page, y)]
                if eligible:
                    seen[eligible[-1][2]][int(match.group(1))].append((book_page, side, y))

    result = {}
    for topic, numbers in sorted(seen.items()):
        states = list(numbers.get(1, []))
        if not states:
            continue
        ceiling = 1
        for number in range(2, 151):
            nxt = [cur for cur in numbers.get(number, []) if any(prev < cur for prev in states)]
            if not nxt:
                break
            states, ceiling = nxt, number
        result[topic] = ceiling
    return result


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
        if book_page == answer:
            cutoff = answer_heading_y(page)
            has_questions = cutoff is not None and any(
                c["score"] >= 4 and c["y"] < cutoff - 2.0
                for c in question_candidates(page, book_page)
            )
            if has_questions:
                kind = "questions+" + kind
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

    reconciliation = manifest.get("reconciliation") or {}
    overrides = {
        (int(item["chapter"]), int(item["topic"])): item
        for item in reconciliation.get("verifiedQuestionCountOverrides", [])
    }
    chapters = []
    chapter_question_occurrences = 0
    for chapter in manifest["chapters"]:
        plan, solution_start = chapter_page_plan(pdf, manifest, chapter)
        structural_counts = structural_question_counts(pdf, manifest, chapter)
        reconciled_counts = dict(structural_counts)
        applied_overrides = []
        for (ch_num, topic_num), item in overrides.items():
            if ch_num != int(chapter["number"]):
                continue
            count = int(item["count"])
            evidence = str(item.get("evidence") or "").strip()
            if count < 0:
                raise SystemExit(
                    f"verified count override c{ch_num} t{topic_num} has negative count {count}"
                )
            if not evidence:
                raise SystemExit(
                    f"verified count override c{ch_num} t{topic_num} is missing source evidence"
                )
            reconciled_counts[topic_num] = count
            applied_overrides.append(item)
        expected_occurrences = sum(reconciled_counts.values())
        chapter_question_occurrences += expected_occurrences
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
        question_pages = [p["pdfPage"] for p in plan if "questions" in p["class"]]
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
            "structuralQuestionCounts": {str(k): v for k, v in sorted(structural_counts.items())},
            "reconciledQuestionCounts": {str(k): v for k, v in sorted(reconciled_counts.items())},
            "expectedQuestionOccurrences": expected_occurrences,
            "countOverrides": applied_overrides,
            "candidateQuestionPages": extracted_pages,
            "questionPagesWithoutCurrentCandidate": sorted(set(question_pages) - set(extracted_pages)),
        })

    for appendix in manifest.get("appendices", []):
        q_start = appendix.get("questionPdfPageStart", appendix["pdfPageStart"])
        q_end = appendix.get("questionPdfPageEnd")
        s_start = appendix.get("solutionPdfPageStart")
        for pdf_page in range(int(appendix["pdfPageStart"]), int(appendix["pdfPageEnd"]) + 1):
            is_question = q_end is not None and int(q_start) <= pdf_page <= int(q_end)
            is_solution = s_start is not None and pdf_page >= int(s_start)
            if is_question and is_solution:
                kind = "appendix-questions+solutions"
            elif is_question:
                kind = "appendix-questions"
            elif is_solution:
                kind = "appendix-solutions"
            else:
                kind = "appendix-unresolved"
            if pdf_page in page_map:
                raise SystemExit(f"page {pdf_page} assigned twice")
            page_map[pdf_page] = {"pdfPage": pdf_page, "class": kind, "appendix": appendix["id"]}

    unaccounted = sorted(set(range(1, expected_pages + 1)) - set(page_map))
    class_counts = Counter(entry["class"] for entry in page_map.values())
    appendix_question_occurrences = sum(int(a.get("questionOccurrences") or 0) for a in manifest.get("appendices", []))
    source_question_occurrences = chapter_question_occurrences + appendix_question_occurrences
    if reconciliation.get("chapterQuestionOccurrences") != chapter_question_occurrences:
        raise SystemExit("manifest chapterQuestionOccurrences does not match structural reconciliation")
    if reconciliation.get("sourceQuestionOccurrences") != source_question_occurrences:
        raise SystemExit("manifest sourceQuestionOccurrences does not match structural reconciliation")
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
            "chapterQuestionOccurrences": chapter_question_occurrences,
            "appendixQuestionOccurrences": appendix_question_occurrences,
            "sourceQuestionOccurrences": source_question_occurrences,
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
