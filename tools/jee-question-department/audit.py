#!/usr/bin/env python3
"""Strict audit gate for JEE question-department review queues and publish sets."""
from __future__ import annotations

import argparse
import json
import math
import re
from datetime import datetime
from collections import Counter, defaultdict
from pathlib import Path

HERE = Path(__file__).resolve().parent
DEFAULT_MANIFEST = HERE / "source-manifest.json"
VALID_TRACKS = {"jee-main", "jee-advanced"}
VALID_ANSWER_TYPES = {"mcq", "multi_mcq", "numeric", "selfcheck"}
PLACEHOLDER_RE = re.compile(r"review the printed solution|todo|tbd|placeholder|source solution\s*$", re.I)


def load_jsonl(path: Path):
    rows = []
    for i, raw in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
        if not raw.strip():
            continue
        try:
            rows.append(json.loads(raw))
        except json.JSONDecodeError as exc:
            raise SystemExit(f"{path}:{i}: invalid JSON: {exc}") from exc
    return rows


def fail(errors, row, message):
    errors.append(f"{row.get('id','<missing-id>')}: {message}")


def audit(rows, manifest, publish=False):
    errors, warnings = [], []
    ids = Counter(r.get("id") for r in rows)
    for qid, n in ids.items():
        if not qid:
            errors.append("record missing id")
        elif n > 1:
            errors.append(f"{qid}: duplicate id occurs {n} times")

    chapter_by_num = {int(c["number"]): c for c in manifest["chapters"]}
    allowed_targets = {t for c in manifest["chapters"] for t in c.get("targets", [])}
    topic_numbers = defaultdict(set)
    question_numbers = defaultdict(set)

    for row in rows:
        src = row.get("source") or {}
        routing = row.get("routing") or {}
        exam = row.get("exam") or {}
        review = row.get("review") or {}
        ch_num = src.get("sourceChapterNumber")
        chapter = chapter_by_num.get(int(ch_num)) if str(ch_num).isdigit() else None
        if not chapter:
            fail(errors, row, f"unknown source chapter {ch_num!r}")
            continue
        if src.get("sourceChapter") != chapter.get("title"):
            fail(errors, row, f"sourceChapter {src.get('sourceChapter')!r} does not match manifest title {chapter.get('title')!r}")
        sp = src.get("sourcePage")
        if not isinstance(sp, int) or not (chapter["bookPageStart"] <= sp <= chapter["bookPageEnd"]):
            fail(errors, row, f"sourcePage {sp!r} outside chapter range")
        pdfp = src.get("sourcePdfPage")
        expected_pdf = sp + manifest["source"]["bookPageOffset"] if isinstance(sp, int) else None
        if pdfp != expected_pdf:
            fail(errors, row, f"sourcePdfPage {pdfp!r} does not match source page offset {expected_pdf!r}")
        qn = src.get("sourceQuestionNumber")
        tn = src.get("sourceTopicNumber", 1)
        if not isinstance(qn, int) or qn < 1:
            fail(errors, row, "invalid source question number")
        if not isinstance(tn, int) or tn < 1:
            fail(errors, row, "invalid source topic number")
        else:
            topic_numbers[ch_num].add(tn)
            if isinstance(qn, int):
                question_numbers[(ch_num, tn)].add(qn)

        part = routing.get("part")
        if part != chapter.get("part"):
            fail(errors, row, f"routing part {part!r} does not match manifest {chapter.get('part')!r}")
        target = routing.get("targetChapter")
        if target is not None and target not in chapter.get("targets", []):
            fail(errors, row, f"target chapter {target!r} not allowed for source chapter")
        if target is not None and target not in allowed_targets:
            fail(errors, row, f"unknown target chapter {target!r}")

        status = row.get("status")
        if publish and status != "approved":
            fail(errors, row, f"publish set contains status {status!r}")
        if publish:
            if not target:
                fail(errors, row, "approved publish record has no targetChapter")
            if exam.get("track") not in VALID_TRACKS:
                fail(errors, row, f"approved publish record has invalid exam track {exam.get('track')!r}")
            if row.get("difficulty") not in {1, 2, 3, 4}:
                fail(errors, row, f"approved publish record has invalid difficulty {row.get('difficulty')!r}")
            if not review.get("reviewedBy") or not review.get("reviewedAt"):
                fail(errors, row, "approved record lacks reviewer evidence")
            else:
                try:
                    datetime.fromisoformat(str(review["reviewedAt"]).replace("Z", "+00:00"))
                except ValueError:
                    fail(errors, row, "approved record reviewedAt is not ISO-8601")
            crop = src.get("crop")
            if not isinstance(crop, list) or len(crop) != 4 or any(not isinstance(v, (int, float)) or not math.isfinite(v) for v in crop):
                fail(errors, row, "approved record lacks a valid four-number source crop")
            prompt = str(row.get("prompt") or "").strip()
            if len(prompt) < 12:
                fail(errors, row, "approved record prompt is empty/too short")
            answer_type = row.get("answerType")
            if answer_type not in VALID_ANSWER_TYPES:
                fail(errors, row, f"invalid answerType {answer_type!r}")
            steps = row.get("steps")
            if not isinstance(steps, list) or not steps:
                fail(errors, row, "approved record has no worked steps")
            else:
                packed = " ".join(str(s.get("h", "")) + " " + str(s.get("d", "")) for s in steps if isinstance(s, dict)).strip()
                if not packed or PLACEHOLDER_RE.search(packed):
                    fail(errors, row, "worked steps are placeholder/empty")
            if answer_type == "mcq":
                options = row.get("mcqOptions")
                answer = row.get("answer") or {}
                if not isinstance(options, list) or len(options) < 2:
                    fail(errors, row, "MCQ has fewer than two options")
                idx = answer.get("correctIndex")
                if not isinstance(idx, int) or not options or not 0 <= idx < len(options):
                    fail(errors, row, "MCQ correctIndex is invalid")
            elif answer_type == "multi_mcq":
                options = row.get("mcqOptions")
                indices = (row.get("answer") or {}).get("correctIndices")
                if not isinstance(options, list) or len(options) < 2:
                    fail(errors, row, "multi-MCQ has fewer than two options")
                if not isinstance(indices, list) or not indices or any(not isinstance(i, int) or i < 0 or i >= len(options) for i in indices):
                    fail(errors, row, "multi-MCQ correctIndices invalid")
            elif answer_type == "numeric":
                value = (row.get("answer") or {}).get("value")
                if not isinstance(value, (int, float)) or isinstance(value, bool) or not math.isfinite(value):
                    fail(errors, row, "numeric answer has no finite numeric value")

    # Extraction-stage warning: missing integers are review gaps, not silently ignored.
    for key, nums in sorted(question_numbers.items(), key=lambda kv: (int(kv[0][0]), kv[0][1])):
        if not nums:
            continue
        ceiling = max(nums)
        missing = [n for n in range(1, ceiling + 1) if n not in nums]
        if missing:
            warnings.append(f"chapter {key[0]} topic {key[1]}: candidate sequence has gaps {missing[:12]}{'…' if len(missing) > 12 else ''}")

    summary = {
        "records": len(rows),
        "approved": sum(r.get("status") == "approved" for r in rows),
        "draft": sum(r.get("status") == "draft" for r in rows),
        "errors": len(errors),
        "warnings": len(warnings),
        "chaptersRepresented": len({(r.get("source") or {}).get("sourceChapterNumber") for r in rows}),
        "tracks": dict(Counter((r.get("exam") or {}).get("track") or "unresolved" for r in rows)),
        "answerTypes": dict(Counter(r.get("answerType") or "unresolved" for r in rows)),
    }
    return summary, errors, warnings


def main():
    ap = argparse.ArgumentParser(description="Audit JEE question department records")
    ap.add_argument("queue", type=Path)
    ap.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    ap.add_argument("--publish", action="store_true", help="apply the production publish gate")
    ap.add_argument("--report", type=Path)
    args = ap.parse_args()

    manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
    rows = load_jsonl(args.queue)
    summary, errors, warnings = audit(rows, manifest, publish=args.publish)
    report = {"mode": "publish" if args.publish else "review-queue", "summary": summary, "errors": errors, "warnings": warnings}
    text = json.dumps(report, ensure_ascii=False, indent=2)
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(text + "\n", encoding="utf-8")
    print(text)
    if errors:
        raise SystemExit(2)


if __name__ == "__main__":
    main()
