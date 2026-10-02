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
DEFAULT_OFFICIAL = HERE / "official-sources.json"
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


def load_official(path: Path = DEFAULT_OFFICIAL):
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def audit(rows, manifest, publish=False, official=None):
    errors, warnings = [], []
    if official is None:
        official = load_official()
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
        if src.get("kind") == "official":
            audit_official(row, manifest, official, publish, errors)
            continue
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
            elif str(review["reviewedBy"]).startswith("automated:") or review.get("tier") == "automated":
                # The automated tier exists only for official exam-authority sources
                # with a published key; a commercial-book row always needs a person.
                fail(errors, row, "automated review tier is not allowed for the owner-supplied book source")
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


# ── Official exam-authority rows (official-sources.json) ─────────────────────

AUTOMATED_REVIEWER_RE = re.compile(r"^automated:key\+engine\+ai-review/[A-Za-z0-9._-]+/\d{4}-\d{2}-\d{2}$")
AI_REQUIRED_TRUE = ("transcriptionMatches", "complete", "wellPosed", "labelsCorrect", "stepsCorrect", "independentAnswerAgrees")
KEYED_KINDS = {"option", "options", "numeric"}


def target_parts(manifest):
    """Pri chapter id -> data part, from the single-part chapters of the book manifest."""
    parts = {}
    for chapter in manifest.get("chapters", []):
        if chapter.get("part") == "mixed":
            continue
        for target in chapter.get("targets", []):
            parts.setdefault(target, chapter["part"])
    return parts


def answer_matches_key(row):
    key = row.get("officialKey") or {}
    answer = row.get("answer") or {}
    kind, answer_type = key.get("kind"), row.get("answerType")
    if kind == "option":
        return answer_type == "mcq" and answer.get("correctIndex") == key.get("index")
    if kind == "options":
        return answer_type == "multi_mcq" and sorted(answer.get("correctIndices") or []) == sorted(key.get("indices") or [])
    if kind == "numeric":
        value = answer.get("value")
        if answer_type != "numeric" or not isinstance(value, (int, float)) or isinstance(value, bool):
            return False
        if isinstance(key.get("range"), list):
            lo, hi = key["range"]
            return lo <= value <= hi and answer.get("tol") is not None and value - answer["tol"] <= lo + 1e-9 and value + answer["tol"] >= hi - 1e-9
        return math.isclose(value, float(key.get("value")), rel_tol=0, abs_tol=1e-9)
    return False


def audit_official(row, manifest, official, publish, errors):
    src = row.get("source") or {}
    exam = row.get("exam") or {}
    review = row.get("review") or {}
    routing = row.get("routing") or {}
    if not official:
        fail(errors, row, "official row but official-sources.json is missing")
        return
    docs = {d["id"]: d for d in official.get("documents", [])}
    doc = docs.get(src.get("documentId"))
    if not doc:
        fail(errors, row, f"unknown official document {src.get('documentId')!r}")
        return
    if src.get("url") != doc.get("url"):
        fail(errors, row, "source url does not match the manifest document url")
    if not isinstance(src.get("page"), int) or src["page"] < 1:
        fail(errors, row, "official row has no 1-based source page")
    if not isinstance(src.get("questionNumber"), int) or src["questionNumber"] < 1:
        fail(errors, row, "official row has no printed question number")
    if exam.get("id") != doc.get("exam"):
        fail(errors, row, f"exam {exam.get('id')!r} does not match document exam {doc.get('exam')!r}")
    status = row.get("status")
    if not publish:
        if status == "approved":
            # an approved row in a review queue must still be complete; checked below
            pass
        else:
            return
    if publish and status != "approved":
        fail(errors, row, f"publish set contains status {status!r}")
        return
    # Everything below is the publish gate for an approved official row.
    if not doc.get("sha256") or src.get("sha256") != doc.get("sha256"):
        fail(errors, row, "official source is not pinned to the manifest sha256")
    licensing = official.get("licensing") or {}
    if licensing.get("status") != "owner-confirmed" or not licensing.get("confirmedBy") or not licensing.get("confirmedAt"):
        fail(errors, row, "usage of official material is not owner-confirmed (BLOCKED_EXTERNAL)")
    if exam.get("track") not in VALID_TRACKS:
        fail(errors, row, f"official row track {exam.get('track')!r} has no publish target in this packer")
    target = routing.get("targetChapter")
    parts = target_parts(manifest)
    if target not in parts:
        fail(errors, row, f"targetChapter {target!r} is not a known Pri JEE chapter")
    elif routing.get("part") != parts[target]:
        fail(errors, row, f"routing part {routing.get('part')!r} does not match chapter part {parts[target]!r}")
    if row.get("difficulty") not in {1, 2, 3, 4}:
        fail(errors, row, f"invalid difficulty {row.get('difficulty')!r}")
    crop = src.get("crop")
    if not isinstance(crop, list) or len(crop) != 4 or any(not isinstance(v, (int, float)) or not math.isfinite(v) for v in crop):
        fail(errors, row, "approved record lacks a valid four-number source crop")
    if len(str(row.get("prompt") or "").strip()) < 12:
        fail(errors, row, "approved record prompt is empty/too short")
    answer_type = row.get("answerType")
    if answer_type not in VALID_ANSWER_TYPES - {"selfcheck"}:
        fail(errors, row, f"official publish requires a keyed answerType, got {answer_type!r}")
    if answer_type in ("mcq", "multi_mcq"):
        options = row.get("mcqOptions")
        if not isinstance(options, list) or len(options) < 2 or any(not str(o).strip() for o in options):
            fail(errors, row, "MCQ options missing/empty")
        elif (row.get("officialKey") or {}).get("optionCount") not in (None, len(options)):
            fail(errors, row, "MCQ option count differs from the official paper")
    steps = row.get("steps")
    if not isinstance(steps, list) or not steps:
        fail(errors, row, "approved record has no worked steps")
    else:
        packed = " ".join(str(s.get("h", "")) + " " + str(s.get("d", "")) for s in steps if isinstance(s, dict)).strip()
        if not packed or PLACEHOLDER_RE.search(packed):
            fail(errors, row, "worked steps are placeholder/empty")
    key = row.get("officialKey") or {}
    if key.get("kind") not in KEYED_KINDS:
        fail(errors, row, f"no usable official answer key ({key.get('kind')!r})")
    elif not answer_matches_key(row):
        fail(errors, row, "answer does not exactly match the official answer key")
    if (row.get("engine") or {}).get("verdict") != "verified":
        fail(errors, row, f"deterministic engine verdict is {(row.get('engine') or {}).get('verdict')!r}, not 'verified'")
    if review.get("flags"):
        fail(errors, row, f"unresolved disagreement flags {review['flags']}")
    reviewer, when = review.get("reviewedBy"), review.get("reviewedAt")
    if not reviewer or not when:
        fail(errors, row, "approved record lacks reviewer evidence")
        return
    try:
        datetime.fromisoformat(str(when).replace("Z", "+00:00"))
    except ValueError:
        fail(errors, row, "reviewedAt is not ISO-8601")
    tier = review.get("tier")
    if tier == "human":
        if str(reviewer).startswith("automated:") or str(reviewer).lower().startswith(("ai", "claude", "gpt", "model")):
            fail(errors, row, "human tier names a non-person reviewer")
    elif tier == "automated":
        if not AUTOMATED_REVIEWER_RE.fullmatch(str(reviewer)):
            fail(errors, row, "automated tier reviewer must be 'automated:key+engine+ai-review/<model>/<YYYY-MM-DD>'")
        ai = review.get("ai") or {}
        for field in AI_REQUIRED_TRUE:
            if ai.get(field) is not True:
                fail(errors, row, f"automated tier: independent AI review did not confirm {field}")
        if not ai.get("reviewerModel") or not ai.get("reviewPassId"):
            fail(errors, row, "automated tier: AI review pass identity missing")
        if ai.get("reviewPassId") and ai.get("reviewPassId") == review.get("transcriptionPassId"):
            fail(errors, row, "automated tier: reviewer pass is not independent of the transcription pass")
        solve = (row.get("engine") or {}).get("engineSolve") or {}
        if answer_type == "numeric" and solve.get("agrees") is not True:
            fail(errors, row, "automated tier: engine did not independently re-solve the numeric answer")
    else:
        fail(errors, row, f"unknown review tier {tier!r}")


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
