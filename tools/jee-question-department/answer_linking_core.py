"""Pure helpers for deterministic JEE answer-key linking."""
from __future__ import annotations

import hashlib
import re
from dataclasses import dataclass
from typing import Iterable

import pymupdf as fitz

TOPIC_EXACT_RE = re.compile(r"^Topic\s+(\d+)\s*$", re.I)
TOPIC_PREFIX_RE = re.compile(r"^Topic\s+(\d+)\b", re.I)
ANSWER_ENTRY_RE = re.compile(r"^(\d{1,3})\.\s*(.*)$")

TYPE_SINGLE = "SINGLE_CORRECT_OPTION"
TYPE_MULTI = "MULTIPLE_CORRECT_OPTIONS"
TYPE_INTEGER = "INTEGER"
TYPE_NUMERICAL = "NUMERICAL_VALUE"
TYPE_FILL = "FILL_IN_THE_BLANK"
TYPE_TF = "TRUE_FALSE"
TYPE_MATCH = "MATCH_THE_COLUMNS"
TYPE_ASSERTION = "ASSERTION_REASON"
TYPE_DESC = "DESCRIPTIVE_SOURCE_ANSWER"
TYPE_NONE = "NO_SHORT_ANSWER_KEY"
TYPE_UNKNOWN = "UNKNOWN_REQUIRES_REVIEW"
def collapse(text: str) -> str:
    return " ".join(text.replace("\u00a0", " ").split())


def text_sha256(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def bbox_union(boxes: Iterable[Iterable[float]]) -> list[float] | None:
    boxes = [tuple(map(float, box)) for box in boxes]
    if not boxes:
        return None
    return [
        round(min(b[0] for b in boxes), 2),
        round(min(b[1] for b in boxes), 2),
        round(max(b[2] for b in boxes), 2),
        round(max(b[3] for b in boxes), 2),
    ]


def answer_region(page: fitz.Page) -> list[float]:
    """Return the visually bounded compact-answer region on an answer page."""
    answer_boxes = page.search_for("Answers")
    if not answer_boxes:
        raise ValueError("exact Answers heading not found")
    heading = min(answer_boxes, key=lambda b: (b.y0, b.x0))
    y0 = float(heading.y1) + 2.0
    solution_boxes = []
    for phrase in ("Hints & Solutions", "Hints & Solution"):
        solution_boxes.extend(page.search_for(phrase))
    solution_boxes = [b for b in solution_boxes if b.y0 > heading.y0]
    y1 = min(
        (float(b.y0) for b in solution_boxes),
        default=float(page.rect.height) * 0.94,
    )
    return [
        0.0,
        round(y0, 2),
        round(float(page.rect.width), 2),
        round(y1, 2),
    ]


def answer_region_text(page: fitz.Page, region: list[float]) -> str:
    return page.get_text("text", clip=fitz.Rect(*region), sort=False)


def _topic_candidate(
    lines: list[str],
    start: int,
    topic_count: int,
    expected_counts: dict[int, int],
):
    starts: dict[int, int] = {1: start}
    cursor = start + 1
    for topic in range(2, topic_count + 1):
        found = None
        for i in range(cursor, len(lines)):
            match = TOPIC_EXACT_RE.fullmatch(collapse(lines[i]))
            if match and int(match.group(1)) == topic:
                found = i
                break
        if found is None:
            return None
        starts[topic] = found
        cursor = found + 1

    last = starts[topic_count]
    end = len(lines)
    for i in range(last + 1, len(lines)):
        if TOPIC_PREFIX_RE.match(collapse(lines[i])):
            end = i
            break

    score = 0
    for topic in range(1, topic_count + 1):
        lo = starts[topic] + 1
        hi = starts.get(topic + 1, end)
        previous = 0
        for raw in lines[lo:hi]:
            match = ANSWER_ENTRY_RE.match(raw.strip())
            if not match:
                continue
            question = int(match.group(1))
            if previous < question <= expected_counts[topic]:
                score += 1
                previous = question
    return score, starts, end


def parse_answer_key(
    page: fitz.Page,
    region: list[float],
    expected_counts: dict[int, int],
) -> dict[int, dict[int, str]]:
    """Parse source answer fragments keyed by canonical topic and question."""
    lines = answer_region_text(page, region).splitlines()
    topic_count = len(expected_counts)
    candidates = []
    for i, line in enumerate(lines):
        match = TOPIC_EXACT_RE.fullmatch(collapse(line))
        if match and int(match.group(1)) == 1:
            candidate = _topic_candidate(lines, i, topic_count, expected_counts)
            if candidate:
                candidates.append(candidate)
    if not candidates:
        raise ValueError("no complete Topic 1..N answer-key sequence found")
    _, starts, end = max(candidates, key=lambda item: item[0])

    out: dict[int, dict[int, str]] = {}
    for topic in range(1, topic_count + 1):
        lo = starts[topic] + 1
        hi = starts.get(topic + 1, end)
        entries: dict[int, str] = {}
        current_q: int | None = None
        fragment: list[str] = []
        previous = 0

        def flush() -> None:
            nonlocal fragment, current_q
            if current_q is not None:
                value = "\n".join(x.rstrip() for x in fragment).strip()
                entries[current_q] = value

        for raw in lines[lo:hi]:
            stripped = raw.strip()
            match = ANSWER_ENTRY_RE.match(stripped)
            if match:
                question = int(match.group(1))
                if previous < question <= expected_counts[topic]:
                    flush()
                    current_q = question
                    previous = question
                    fragment = [match.group(2).strip()]
                    continue
            if current_q is not None:
                fragment.append(raw)
        flush()
        out[topic] = entries
    return out
def answer_marker_candidates(
    page: fitz.Page,
    region: list[float],
    question: int,
) -> list[list[float]]:
    """Return q-number marker boxes inside the compact answer region."""
    rect = fitz.Rect(*region)
    boxes = page.search_for(f"{question}.", clip=rect)
    return [
        [round(float(value), 2) for value in box]
        for box in boxes
    ]


def classify_section_heading(text: str) -> str | None:
    low = collapse(text).lower()
    if "integer answer type" in low or "integer type question" in low:
        return TYPE_INTEGER
    if "fill in the blank" in low:
        return TYPE_FILL
    if "true/false" in low or "true / false" in low:
        return TYPE_TF
    if "assertion" in low and "reason" in low:
        return TYPE_ASSERTION
    if any(
        phrase in low
        for phrase in (
            "match the column",
            "match the columns",
            "match type question",
            "match the list",
        )
    ):
        return TYPE_MATCH
    if "analytical" in low and "descriptive" in low:
        return TYPE_DESC
    if "objective question" in low and "ii" in low:
        return TYPE_MULTI
    if "objective question" in low and " i" in f" {low}":
        return TYPE_SINGLE
    if "only one correct option" in low:
        return TYPE_SINGLE
    if (
        low.startswith("for the following question")
        and "correct answer" in low
    ):
        return TYPE_SINGLE
    return None


@dataclass(frozen=True)
class SourcePos:
    pdf_page: int
    side: int
    y: float

    def key(self) -> tuple[int, int, float]:
        return (self.pdf_page, self.side, self.y)


def side_for_x(page: fitz.Page, x: float) -> int:
    return 0 if x < float(page.rect.width) / 2 else 1
def infer_chapter_answer_types(
    pdf: fitz.Document,
    chapter_occurrences: list[dict],
    question_pdf_pages: list[int],
    answer_pdf_page: int,
) -> dict[str, str]:
    """Infer source answer type from the nearest explicit section heading."""
    events: list[tuple[SourcePos, str, object]] = []
    for pdf_page in question_pdf_pages:
        page = pdf[pdf_page - 1]
        answer_y = None
        if pdf_page == answer_pdf_page:
            boxes = page.search_for("Answers")
            if boxes:
                answer_y = min(float(box.y0) for box in boxes)
        for block in page.get_text("dict")["blocks"]:
            for line in block.get("lines", []):
                text = "".join(
                    span["text"] for span in line["spans"]
                ).strip()
                if not text:
                    continue
                x0, y0, _, _ = map(float, line["bbox"])
                if answer_y is not None and y0 >= answer_y:
                    continue
                pos = SourcePos(
                    pdf_page,
                    side_for_x(page, x0),
                    y0,
                )
                topic_match = TOPIC_PREFIX_RE.match(collapse(text))
                if topic_match:
                    events.append(
                        (pos, "topic", int(topic_match.group(1)))
                    )
                answer_type = classify_section_heading(text)
                if answer_type:
                    events.append((pos, "type", answer_type))

    for occurrence in chapter_occurrences:
        page = pdf[int(occurrence["pdfPage"]) - 1]
        crop = occurrence.get("crop") or [0, 0, 0, 0]
        pos = SourcePos(
            int(occurrence["pdfPage"]),
            side_for_x(page, float(crop[0])),
            float(crop[1]),
        )
        events.append((pos, "question", occurrence))

    order = {"topic": 0, "type": 1, "question": 2}
    events.sort(key=lambda item: (item[0].key(), order[item[1]]))
    current_topic: int | None = None
    current_type: str | None = None
    assigned: dict[str, str] = {}
    for _, kind, value in events:
        if kind == "topic":
            current_topic = int(value)
            current_type = None
        elif kind == "type":
            current_type = str(value)
        else:
            occurrence = value
            topic = int(occurrence["topic"])
            if current_topic != topic:
                current_topic = topic
                current_type = None
            assigned[occurrence["recordId"]] = (
                current_type or TYPE_UNKNOWN
            )
    return assigned
OPTION_RE = re.compile(
    r"^\(\s*([a-dA-D](?:\s*,\s*[a-dA-D])*)\s*\)$"
)
TRUE_FALSE_RE = re.compile(r"^\(?\s*(True|False)\s*\)?$", re.I)
INTEGER_RE = re.compile(r"^\(?\s*[+−-]?\d+\s*\)?$")
MATCH_PAIR_RE = re.compile(
    r"([A-DP-S])\s*(?:→|->|=)\s*"
    r"([A-Za-z0-9]+(?:\s*,\s*[A-Za-z0-9]+)*)"
)


def parse_match_mapping(compact: str) -> dict[str, list[str]] | None:
    pairs = MATCH_PAIR_RE.findall(compact)
    if not pairs:
        return None
    mapping: dict[str, list[str]] = {}
    for left, right in pairs:
        if left in mapping:
            return None
        mapping[left] = [
            value.strip()
            for value in right.split(",")
            if value.strip()
        ]
    return mapping or None


def normalize_answer_fragment(
    raw: str,
    declared_type: str,
) -> tuple[object | None, str, bool]:
    """Return normalized value, effective type, transcription-review flag."""
    compact = collapse(raw)
    option = OPTION_RE.fullmatch(compact)
    if option:
        labels = [
            part.strip().upper()
            for part in option.group(1).split(",")
        ]
        if declared_type == TYPE_MATCH:
            return {
                "sourceOption": labels[0] if len(labels) == 1 else labels,
                "resolvedMapping": None,
            }, TYPE_MATCH, True
        if len(labels) == 1:
            effective = (
                TYPE_SINGLE
                if declared_type == TYPE_UNKNOWN
                else declared_type
            )
            return labels[0], effective, False
        return labels, TYPE_MULTI, False

    truth = TRUE_FALSE_RE.fullmatch(compact)
    if truth:
        return truth.group(1).lower() == "true", TYPE_TF, False

    if declared_type == TYPE_MATCH:
        mapping = parse_match_mapping(compact)
        if mapping:
            return {"mapping": mapping}, TYPE_MATCH, False
        return {"sourceText": compact}, TYPE_MATCH, True

    if declared_type == TYPE_INTEGER and INTEGER_RE.fullmatch(compact):
        cleaned = compact.strip("() ").replace("−", "-")
        return int(cleaned), TYPE_INTEGER, False
    if declared_type == TYPE_FILL and compact:
        return {"sourceText": compact}, TYPE_FILL, len(raw.splitlines()) > 1

    if declared_type in (
        TYPE_ASSERTION,
        TYPE_DESC,
        TYPE_NUMERICAL,
    ):
        return (
            {"sourceText": compact},
            declared_type,
            len(raw.splitlines()) > 1 or not compact,
        )

    if declared_type == TYPE_INTEGER and compact:
        return {"sourceText": compact}, TYPE_INTEGER, True

    if compact:
        if declared_type == TYPE_UNKNOWN and INTEGER_RE.fullmatch(compact):
            return (
                {"sourceText": compact},
                TYPE_NUMERICAL,
                False,
            )
        return {"sourceText": compact}, declared_type, True

    return None, declared_type, True
def solution_heading_y(page: fitz.Page) -> float | None:
    boxes = []
    for phrase in ("Hints & Solutions", "Hints & Solution"):
        boxes.extend(page.search_for(phrase))
    if not boxes:
        return None
    return min(float(box.y0) for box in boxes)


def chapter_answer_regions(
    pdf: fitz.Document,
    chapter_reconciliation: dict,
    book_page_offset: int,
) -> list[dict]:
    answer_pdf = (
        int(chapter_reconciliation["answerBookPage"])
        + book_page_offset
    )
    solution_pdf = (
        int(chapter_reconciliation["solutionBookPageStart"])
        + book_page_offset
    )
    page = pdf[answer_pdf - 1]
    answers = page.search_for("Answers")
    if not answers:
        raise ValueError(
            f"chapter {chapter_reconciliation['number']}: "
            "Answers heading not found"
        )
    heading = min(answers, key=lambda box: (box.y0, box.x0))
    if solution_pdf == answer_pdf:
        boundary = solution_heading_y(page)
        y1 = boundary or float(page.rect.height) * 0.96
    else:
        y1 = float(page.rect.height) * 0.96

    regions = [{
        "pdfPage": answer_pdf,
        "printedPage": int(chapter_reconciliation["answerBookPage"]),
        "bbox": [
            0.0,
            round(float(heading.y1) + 2.0, 2),
            round(float(page.rect.width), 2),
            round(y1, 2),
        ],
        "role": "answer-key",
    }]

    if solution_pdf > answer_pdf:
        continuation = pdf[solution_pdf - 1]
        boundary = solution_heading_y(continuation)
        if boundary is not None and boundary > 100.0:
            regions.append({
                "pdfPage": solution_pdf,
                "printedPage": int(
                    chapter_reconciliation["solutionBookPageStart"]
                ),
                "bbox": [
                    0.0,
                    88.0,
                    round(float(continuation.rect.width), 2),
                    round(boundary, 2),
                ],
                "role": "answer-key-continuation",
            })
    return regions


def region_lines(
    pdf: fitz.Document,
    regions: list[dict],
) -> list[tuple[int, str]]:
    out: list[tuple[int, str]] = []
    for region in regions:
        page = pdf[int(region["pdfPage"]) - 1]
        text = page.get_text(
            "text",
            clip=fitz.Rect(*region["bbox"]),
            sort=False,
        )
        out.extend(
            (int(region["pdfPage"]), line)
            for line in text.splitlines()
        )
    return out


def parse_answer_key_regions(
    pdf: fitz.Document,
    regions: list[dict],
    expected_counts: dict[int, int],
) -> dict[int, dict[int, dict]]:
    """Parse answer fragments and retain the page where each starts."""
    source_lines = region_lines(pdf, regions)
    lines = [line for _, line in source_lines]
    topic_count = len(expected_counts)
    candidates = []
def solution_heading_y(page: fitz.Page) -> float | None:
    boxes = []
    for phrase in ("Hints & Solutions", "Hints & Solution"):
        boxes.extend(page.search_for(phrase))
    if not boxes:
        return None
    return min(float(box.y0) for box in boxes)


def chapter_answer_regions(
    pdf: fitz.Document,
    chapter_reconciliation: dict,
    book_page_offset: int,
) -> list[dict]:
    answer_pdf = (
        int(chapter_reconciliation["answerBookPage"])
        + book_page_offset
    )
    solution_pdf = (
        int(chapter_reconciliation["solutionBookPageStart"])
        + book_page_offset
    )
    page = pdf[answer_pdf - 1]
    answers = page.search_for("Answers")
    if not answers:
        raise ValueError("Answers heading not found")
    heading = min(answers, key=lambda box: (box.y0, box.x0))
    if solution_pdf == answer_pdf:
        boundary = solution_heading_y(page)
        y1 = boundary or float(page.rect.height) * 0.96
    else:
        y1 = float(page.rect.height) * 0.96

    regions = [{
        "pdfPage": answer_pdf,
        "printedPage": int(chapter_reconciliation["answerBookPage"]),
        "bbox": [
            0.0,
            round(float(heading.y1) + 2.0, 2),
            round(float(page.rect.width), 2),
            round(y1, 2),
        ],
        "role": "answer-key",
    }]

    if solution_pdf > answer_pdf:
        continuation = pdf[solution_pdf - 1]
        boundary = solution_heading_y(continuation)
        if boundary is not None and boundary > 100.0:
            regions.append({
                "pdfPage": solution_pdf,
                "printedPage": int(
                    chapter_reconciliation["solutionBookPageStart"]
                ),
                "bbox": [
                    0.0,
                    88.0,
                    round(float(continuation.rect.width), 2),
                    round(boundary, 2),
                ],
                "role": "answer-key-continuation",
            })
    return regions


def region_lines(
    pdf: fitz.Document,
    regions: list[dict],
) -> list[tuple[int, str]]:
    out: list[tuple[int, str]] = []
    for region in regions:
        page = pdf[int(region["pdfPage"]) - 1]
        text = page.get_text(
            "text",
            clip=fitz.Rect(*region["bbox"]),
            sort=False,
        )
        out.extend(
            (int(region["pdfPage"]), line)
            for line in text.splitlines()
        )
    return out


def parse_answer_key_regions(
    pdf: fitz.Document,
    regions: list[dict],
    expected_counts: dict[int, int],
) -> dict[int, dict[int, dict]]:
    """Parse answer fragments and retain the page where each starts."""
    source_lines = region_lines(pdf, regions)
    lines = [line for _, line in source_lines]
    topic_count = len(expected_counts)
    candidates = []
    for i, line in enumerate(lines):
        match = TOPIC_EXACT_RE.fullmatch(collapse(line))
        if match and int(match.group(1)) == 1:
            candidate = _topic_candidate(
                lines,
                i,
                topic_count,
                expected_counts,
            )
            if candidate:
                candidates.append(candidate)
    if topic_count == 1 and not candidates:
        starts = {1: -1}
        end = len(lines)
    elif candidates:
        _, starts, end = max(candidates, key=lambda item: item[0])
    else:
        raise ValueError(
            "no complete Topic 1..N answer-key sequence found"
        )

    out: dict[int, dict[int, dict]] = {}
    for topic in range(1, topic_count + 1):
        lo = starts[topic] + 1
        hi = starts.get(topic + 1, end)
        entries: dict[int, dict] = {}
        current_q: int | None = None
        current_page: int | None = None
        fragment: list[str] = []
        previous = 0

        def flush() -> None:
            nonlocal fragment, current_q, current_page
            if current_q is not None:
                value = "\n".join(
                    value.rstrip() for value in fragment
                ).strip()
                entries[current_q] = {
                    "raw": value,
                    "pdfPage": current_page,
                }

        for index in range(lo, hi):
            raw = lines[index]
            stripped = raw.strip()
            match = ANSWER_ENTRY_RE.match(stripped)
            if match:
                question = int(match.group(1))
                if previous < question <= expected_counts[topic]:
                    flush()
                    current_q = question
                    current_page = source_lines[index][0]
                    previous = question
                    fragment = [match.group(2).strip()]
                    continue
            if current_q is not None:
                fragment.append(raw)
        flush()
        out[topic] = entries
    return out
