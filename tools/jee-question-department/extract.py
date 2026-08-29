#!/usr/bin/env python3
"""Pri Learning JEE Question Adding Department — source intake.

This stage deliberately creates a REVIEW QUEUE, not production questions.  Maths
PDF extraction is lossy (fractions, matrices, superscripts and two-column flow),
so no record is allowed to become a student-facing question until a reviewer has
checked the source crop, target chapter, answer and worked steps.
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

try:
    import fitz  # PyMuPDF
except ImportError as exc:  # pragma: no cover - clear operator error
    raise SystemExit("PyMuPDF is required: python3 -m pip install -r tools/jee-question-department/requirements.txt") from exc

HERE = Path(__file__).resolve().parent
DEFAULT_MANIFEST = HERE / "source-manifest.json"

QUESTION_RE = re.compile(r"^(\d{1,3})(\.)?$")
YEAR_RE = re.compile(r"\b((?:19|20)\d{2})\b")
MAIN_RE = re.compile(r"\bMain\b", re.I)
ADV_RE = re.compile(r"\b(?:Adv(?:anced)?|IIT\s*JEE)\b", re.I)


def load_manifest(path: Path) -> dict:
    data = json.loads(path.read_text(encoding="utf-8"))
    if data.get("schemaVersion") != 1:
        raise SystemExit(f"Unsupported source manifest schema: {data.get('schemaVersion')!r}")
    return data


def line_groups(words):
    grouped = defaultdict(list)
    for word in words:
        grouped[(word[5], word[6])].append(word)
    for key in grouped:
        grouped[key].sort(key=lambda w: (w[0], w[7]))
    return grouped


def topic_events(page, source_page: int):
    events = []
    groups = line_groups(page.get_text("words"))
    for words in groups.values():
        tokens = [str(w[4]) for w in words]
        for i, token in enumerate(tokens):
            if token.lower() != "topic" or i + 1 >= len(tokens) or not tokens[i + 1].isdigit():
                continue
            n = int(tokens[i + 1])
            title = " ".join(tokens[i + 2:]).strip()
            events.append({"sourcePage": source_page, "y": float(words[i][1]), "number": n, "title": title})
    return sorted(events, key=lambda x: x["y"])


def question_candidates(page, source_page: int):
    """Find likely printed question numbers from the two canonical number gutters.

    The score is intentionally conservative. Low-confidence candidates are still
    discoverable through the gap audit and source page, rather than silently
    promoted into the app.
    """
    width = float(page.rect.width)
    left_anchor, right_anchor = width * 0.110, width * 0.525
    left_band = (width * 0.095, width * 0.126)
    right_band = (width * 0.510, width * 0.548)
    groups = line_groups(page.get_text("words"))
    out = []
    for words in groups.values():
        for i, word in enumerate(words):
            token = str(word[4]).strip()
            match = QUESTION_RE.fullmatch(token)
            if not match:
                continue
            x, y = float(word[0]), float(word[1])
            side = "left" if left_band[0] <= x <= left_band[1] else "right" if right_band[0] <= x <= right_band[1] else None
            if not side:
                continue
            n = int(match.group(1))
            if not 1 <= n <= 150:
                continue
            score = 2 if bool(match.group(2)) else 0
            next_text = ""
            if i + 1 < len(words):
                nxt = words[i + 1]
                if float(nxt[0]) - float(word[2]) <= width * 0.045:
                    next_text = str(nxt[4]).strip()
                    if re.match(r"^[A-Za-z]", next_text):
                        score += 4
                    elif next_text.startswith(("(", "[", "{", "|", "−", "-")):
                        score += 1
            anchor = left_anchor if side == "left" else right_anchor
            if abs(x - anchor) <= width * 0.016:
                score += 1
            if len(words) >= 2:
                score += 1
            out.append({
                "sourcePage": source_page,
                "y": y,
                "x": x,
                "side": side,
                "number": n,
                "printed": token,
                "nextText": next_text,
                "score": score,
            })
    return sorted(out, key=lambda x: (x["side"] != "left", x["y"]))


def assign_topic(events, source_page: int, y: float, fallback: dict | None):
    eligible = [e for e in events if (e["sourcePage"], e["y"]) <= (source_page, y)]
    if eligible:
        return max(eligible, key=lambda e: (e["sourcePage"], e["y"]))
    return fallback or {"number": 1, "title": ""}


def crop_text(page, marker, next_marker):
    width, height = float(page.rect.width), float(page.rect.height)
    if marker["side"] == "left":
        x0, x1 = width * 0.085, width * 0.505
    else:
        x0, x1 = width * 0.505, width * 0.94
    y0 = max(0.0, marker["y"] - 2.5)
    y1 = min(height, (next_marker["y"] - 2.0) if next_marker and next_marker["side"] == marker["side"] else height * 0.91)
    text = page.get_text("text", clip=fitz.Rect(x0, y0, x1, y1), sort=True)
    text = re.sub(r"[ \t]+\n", "\n", text)
    text = re.sub(r"\n{3,}", "\n\n", text).strip()
    return text, [round(x0, 2), round(y0, 2), round(x1, 2), round(y1, 2)]


def infer_exam(text: str):
    year_match = YEAR_RE.search(text)
    year = int(year_match.group(1)) if year_match else None
    if MAIN_RE.search(text):
        track, evidence = "jee-main", "explicit Main label in source crop"
    elif ADV_RE.search(text):
        track, evidence = "jee-advanced", "explicit Advanced/IIT-JEE label in source crop"
    elif year and year <= 2012:
        track, evidence = "jee-advanced", "historical IIT-JEE era inferred from year; reviewer must confirm"
    else:
        track, evidence = None, "track not safely inferable from extracted crop"
    return year, track, evidence


def target_for(chapter: dict):
    targets = chapter.get("targets", [])
    if len(targets) == 1 and not chapter.get("ambiguousTarget"):
        return targets[0], []
    return None, ["target-chapter-review-required"]


def extract_chapter(pdf, manifest: dict, chapter: dict, min_score: int):
    offset = int(manifest["source"]["bookPageOffset"])
    start, answer = int(chapter["bookPageStart"]), int(chapter["answerPage"])
    topic_events_all = []
    for source_page in range(start, answer):
        topic_events_all.extend(topic_events(pdf[source_page + offset - 1], source_page))
    topic_events_all.sort(key=lambda e: (e["sourcePage"], e["y"]))
    fallback = {"number": 1, "title": chapter["title"]} if not topic_events_all else None

    rows = []
    seen = set()
    target, target_reasons = target_for(chapter)
    for source_page in range(start, answer):
        page = pdf[source_page + offset - 1]
        all_candidates = question_candidates(page, source_page)
        candidates = [c for c in all_candidates if c["score"] >= min_score]
        by_side = {"left": [], "right": []}
        for c in candidates:
            by_side[c["side"]].append(c)
        for side in by_side:
            by_side[side].sort(key=lambda c: c["y"])

        for marker in candidates:
            topic = assign_topic(topic_events_all, source_page, marker["y"], fallback)
            # Source question numbers reset per topic. Duplicate detector keeps the
            # best extraction candidate and leaves the ambiguity visible in audit.
            key = (int(topic.get("number") or 1), marker["number"])
            next_same = None
            same_side = by_side[marker["side"]]
            pos = same_side.index(marker)
            if pos + 1 < len(same_side):
                next_same = same_side[pos + 1]
            raw_text, crop = crop_text(page, marker, next_same)
            year, track, track_evidence = infer_exam(raw_text)
            review_reasons = list(target_reasons)
            if marker["score"] < 6:
                review_reasons.append("low-extraction-confidence")
            if not track:
                review_reasons.append("exam-track-review-required")
            if not raw_text or len(raw_text) < 12:
                review_reasons.append("prompt-extraction-review-required")
            row = {
                "id": f"arihant41-c{chapter['number']:02d}-t{int(topic.get('number') or 1):02d}-q{marker['number']:03d}",
                "status": "draft",
                "source": {
                    "book": manifest["source"]["title"],
                    "edition": manifest["source"]["edition"],
                    "sourceChapterNumber": chapter["number"],
                    "sourceChapter": chapter["title"],
                    "sourceTopicNumber": int(topic.get("number") or 1),
                    "sourceTopic": topic.get("title") or "",
                    "sourcePage": source_page,
                    "sourcePdfPage": source_page + offset,
                    "sourceQuestionNumber": marker["number"],
                    "crop": crop,
                },
                "routing": {
                    "part": chapter["part"],
                    "targetChapter": target,
                    "allowedTargets": chapter.get("targets", []),
                },
                "exam": {"year": year, "track": track, "evidence": track_evidence},
                "difficulty": None,
                "answerType": "selfcheck",
                "prompt": raw_text,
                "answer": None,
                "mcqOptions": None,
                "hints": [],
                "steps": [],
                "review": {
                    "extractionScore": marker["score"],
                    "reasons": sorted(set(review_reasons)),
                    "reviewedBy": None,
                    "reviewedAt": None,
                },
            }
            previous = seen.intersection({key})
            if previous:
                row["review"]["reasons"].append("duplicate-question-marker")
                row["id"] += f"-p{source_page}y{int(marker['y'])}"
            seen.add(key)
            rows.append(row)
    return rows


def write_jsonl(path: Path, rows):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as handle:
        for row in rows:
            handle.write(json.dumps(row, ensure_ascii=False, separators=(",", ":")) + "\n")


def main():
    parser = argparse.ArgumentParser(description="Extract a review queue from the JEE source PDF")
    parser.add_argument("pdf", type=Path)
    parser.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    parser.add_argument("--out", type=Path, default=HERE / "work" / "review-queue.jsonl")
    parser.add_argument("--min-score", type=int, default=4, help="conservative printed-number marker threshold")
    args = parser.parse_args()

    manifest = load_manifest(args.manifest)
    pdf = fitz.open(args.pdf)
    expected_pages = int(manifest["source"]["pdfPages"])
    if len(pdf) != expected_pages:
        raise SystemExit(f"Source PDF page count mismatch: expected {expected_pages}, got {len(pdf)}")

    rows = []
    for chapter in manifest["chapters"]:
        rows.extend(extract_chapter(pdf, manifest, chapter, args.min_score))
    write_jsonl(args.out, rows)

    chapters = len({r["source"]["sourceChapterNumber"] for r in rows})
    flagged = sum(bool(r["review"]["reasons"]) for r in rows)
    print(json.dumps({
        "queue": str(args.out),
        "candidates": len(rows),
        "chaptersSeen": chapters,
        "flaggedForReview": flagged,
        "published": 0,
        "rule": "Extraction never publishes. Audit + explicit approval are mandatory."
    }, indent=2))


if __name__ == "__main__":
    main()
