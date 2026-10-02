#!/usr/bin/env python3
"""Pri Learning · official-source intake: PDFs from exam authorities -> DRAFT rows.

Reads documents fetched by fetch_official.py (hash-verified cache), finds the
mathematics questions, records exact provenance (document, URL, sha256, page,
printed question number, crop segments), pairs each question with the
authority's own answer key where one is published, and runs the bundled
deterministic engine (engine_check.mjs) over the paired key.

Every row it writes is ``status: "draft"`` with ``reviewedBy: null``. Nothing
here can publish: audit.py --publish rejects drafts, and a draft only becomes
publishable after a recorded human review or the separately-recorded automated
review tier (see review_official.py and docs/content/official-pyq-intake.md).

Parsers (manifest ``parser`` field):
  nta-cbt / nta-key   NTA computer-based-test papers: question IDs + option IDs;
                      the final key maps question ID -> option ID or value.
  jeeadv / jeeadv-key JEE (Advanced) papers and the JAB answer documents that
                      reprint each question with its final answer.
  cbse / cbse-ms      CBSE board / sample papers and their marking schemes.
  ncert-exemplar      NCERT exemplar chapters (exercise MCQs + printed answers).
"""
from __future__ import annotations

import argparse
import io
import json
import re
import subprocess
import sys
import zipfile
from collections import Counter, defaultdict
from pathlib import Path

try:
    import pymupdf as fitz  # PyMuPDF >= 1.24
except ImportError:  # pragma: no cover
    try:
        import fitz  # type: ignore
    except ImportError as exc:  # pragma: no cover
        raise SystemExit("PyMuPDF is required: python3 -m pip install -r tools/jee-question-department/requirements.txt") from exc

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
DEFAULT_MANIFEST = HERE / "official-sources.json"
DEFAULT_OUT = HERE / "work" / "official-queue.jsonl"
ENGINE = HERE / "engine_check.mjs"
LETTERS = "ABCD"

TRACK_OF_EXAM = {"jee-main": "jee-main", "jee-advanced": "jee-advanced"}

MATHS_WORDS = re.compile(r"\b(matri(?:x|ces)|determinant|integral|differentiab|function|ellipse|hyperbola|parabola|polynomial|probability|real numbers?|complex numbers?|vectors?|sin|cos|tan|log|limit|sequence|series|circle|tangent to the curve|plane|lines?\b)", re.I)
PHYS_WORDS = re.compile(r"\b(velocity|acceleration|mass|charge|current|magnetic|electric|wavelength|photon|resistor|capacitor|lens|friction|momentum|kinetic|pressure|temperature|joule|newton|ohm|tesla|volt)\b", re.I)
CHEM_WORDS = re.compile(r"\b(mol|moles|reaction|compound|oxidation|acid|base|solution|enthalpy|entropy|isomer|ion|electron|bond|catalyst|equilibrium|alkene|alkyl|benzene|aqueous|salt)\b", re.I)


# ── manifest / cache ──────────────────────────────────────────────────────────

def load_manifest(path: Path) -> dict:
    data = json.loads(path.read_text(encoding="utf-8"))
    if data.get("schemaVersion") != 1 or data.get("kind") != "official-sources":
        raise SystemExit(f"{path}: not an official-sources manifest")
    return data


def cache_root(manifest: dict, override: Path | None) -> Path:
    return override or (REPO / manifest.get("cacheDir", "tools/jee-question-department/cache/official"))


def open_documents(doc: dict, root: Path):
    """Yield (member_name, fitz.Document) for a cached PDF or each PDF in a cached ZIP."""
    path = root / f"{doc['id']}.{doc.get('format', 'pdf')}"
    if not path.exists():
        return
    if doc.get("format") == "zip":
        with zipfile.ZipFile(path) as zf:
            for name in sorted(zf.namelist()):
                if name.lower().endswith(".pdf") and not name.startswith("__MACOSX"):
                    try:
                        yield name, fitz.open(stream=zf.read(name), filetype="pdf")
                    except Exception:  # an unreadable member is reported via counts
                        continue
    else:
        yield None, fitz.open(path)


# ── shared geometry ───────────────────────────────────────────────────────────

def segments_between(pdf, start, end, *, top_margin=0.05, bottom_margin=0.95, x0=None, x1=None):
    """Crop segments from marker `start` (page, y) up to `end` (page, y) or page end."""
    segs = []
    sp, sy = start
    ep, ey = end if end else (sp, None)
    for pno in range(sp, ep + 1):
        page = pdf[pno]
        w, h = float(page.rect.width), float(page.rect.height)
        top = max(0.0, sy - 3.0) if pno == sp else h * top_margin
        bottom = (ey - 2.0) if (end and pno == ep) else h * bottom_margin
        if bottom - top < 6:
            continue
        segs.append({"page": pno + 1, "crop": [round(x0 if x0 is not None else w * 0.03, 2), round(top, 2),
                                               round(x1 if x1 is not None else w * 0.97, 2), round(bottom, 2)]})
    return segs


def text_of(pdf, segs):
    parts = []
    for s in segs:
        page = pdf[s["page"] - 1]
        parts.append(page.get_text("text", clip=fitz.Rect(*s["crop"]), sort=True))
    text = "\n".join(parts)
    text = re.sub(r"[ \t]+\n", "\n", text)
    return re.sub(r"\n{3,}", "\n\n", text).strip()


def has_images(pdf, segs):
    for s in segs:
        page = pdf[s["page"] - 1]
        r = fitz.Rect(*s["crop"])
        for info in page.get_image_info():
            if fitz.Rect(info["bbox"]).intersects(r):
                return True
    return False


def base_row(doc, manifest, *, qid, page, number, segs, member=None, section=None, key_doc=None):
    return {
        "id": qid,
        "status": "draft",
        "source": {
            "kind": "official",
            "documentId": doc["id"],
            "member": member,
            "authority": doc["authority"],
            "url": doc["url"],
            "archivedAt": doc.get("archivedAt"),
            "sha256": doc.get("sha256"),
            "page": page,
            "questionNumber": number,
            "section": section,
            "crop": segs[0]["crop"] if segs else None,
            "segments": segs,
            "keyDocumentId": key_doc["id"] if key_doc else None,
            "keyUrl": key_doc["url"] if key_doc else None,
        },
        "exam": {
            "id": doc["exam"],
            "track": TRACK_OF_EXAM.get(doc["exam"]),
            "year": doc.get("year"),
            "paper": doc.get("paper"),
            "session": doc.get("session"),
            "shift": doc.get("shift"),
            "evidence": "exam authority document named in official-sources.json",
        },
        "routing": {"part": None, "targetChapter": None},
        "difficulty": None,
        "answerType": None,
        "prompt": "",
        "mcqOptions": None,
        "answer": None,
        "officialKey": {"kind": "none"},
        "engine": None,
        "hints": [],
        "steps": [],
        "review": {"tier": None, "reasons": [], "flags": [], "reviewedBy": None, "reviewedAt": None},
    }


# ── NTA (JEE Main CBT) ────────────────────────────────────────────────────────

NTA_HEADER = re.compile(r"Question Number\s*:\s*(\d+)\s+Question Id\s*:\s*(\d+)\s+Question Type\s*:\s*(\w+)")
NTA_SECTION = re.compile(r"\b(Mathematics|Physics|Chemistry)\s+Section\s+([AB])\b", re.I)
NTA_OPTION = re.compile(r"^\s*(\d{6,})\.\s*$")


def parse_nta_key(pdf) -> dict:
    """{question_id: answer_token} restricted to the MATHEMATICS block of each page."""
    out = {}
    for page in pdf:
        text = page.get_text()
        m = re.search(r"\(\s*MATHEMATICS\s*\)(.*?)(?:\(\s*PHYSICS\s*\)|\(\s*CHEMISTRY\s*\)|$)", text, re.S)
        if not m:
            continue
        tokens = []
        for line in m.group(1).split("\n"):
            parts = line.split()
            if not parts:
                continue
            if all(re.fullmatch(r"-?\d+(?:\.\d+)?", p) for p in parts):
                tokens.extend(parts)  # "qid answer" on one line, or one per line
            else:
                tokens.append(" ".join(parts))  # "Drop", "Any non -negative Integer", ...
        for qid, ans in zip(tokens[0::2], tokens[1::2]):
            out[qid] = ans
    return out


def nta_questions(pdf):
    """Yield maths questions with their header position, option ids and type."""
    events = []
    for pno, page in enumerate(pdf):
        for block in page.get_text("dict")["blocks"]:
            if block["type"] != 0:
                continue
            text = " ".join(s["text"] for line in block["lines"] for s in line["spans"])
            y = float(block["bbox"][1])
            sec = NTA_SECTION.search(text)
            if sec:
                events.append(("section", pno, y, sec.group(1).lower(), sec.group(2)))
            hdr = NTA_HEADER.search(text)
            if hdr:
                events.append(("q", pno, y, hdr.groups(), float(block["bbox"][3])))
            opt = NTA_OPTION.match(text)
            if opt:
                events.append(("opt", pno, y, opt.group(1), None))
    events.sort(key=lambda e: (e[1], e[2]))
    subject, section = None, None
    current = None
    out = []
    for ev in events:
        if ev[0] == "section":
            subject, section = ev[3], ev[4]
            if current:
                current["end"] = (ev[1], ev[2])
                current = None
        elif ev[0] == "q":
            if current and "end" not in current:
                current["end"] = (ev[1], ev[2])
            num, qid, qtype = ev[3]
            current = {"subject": subject, "section": section, "number": int(num), "qid": qid, "type": qtype,
                       "start": (ev[1], ev[4]), "options": []}
            out.append(current)
        elif ev[0] == "opt" and current:
            current["options"].append(ev[3])
    return [q for q in out if q["subject"] == "mathematics"]


def extract_nta(doc, manifest, root, key_doc):
    key = {}
    if key_doc:
        for _, kpdf in open_documents(key_doc, root):
            key.update(parse_nta_key(kpdf))
    rows = []
    for _, pdf in open_documents(doc, root):
        for q in nta_questions(pdf):
            segs = segments_between(pdf, q["start"], q.get("end"))
            qid = f"{doc['id'].removesuffix('-paper')}-q{q['number']:02d}"
            row = base_row(doc, manifest, qid=qid, page=q["start"][0] + 1, number=q["number"], segs=segs,
                           section=f"Mathematics Section {q['section']}", key_doc=key_doc)
            row["source"]["nta"] = {"questionId": q["qid"], "optionIds": q["options"], "questionType": q["type"]}
            row["answerType"] = "mcq" if q["type"].upper() == "MCQ" else "numeric"
            row["prompt"] = text_of(pdf, segs)
            if has_images(pdf, segs):
                row["review"]["reasons"].append("image-only-stem-needs-transcription")
            raw = key.get(q["qid"])
            if raw is None:
                row["review"]["reasons"].append("no-official-key-entry")
            elif not re.fullmatch(r"-?\d+(?:\.\d+)?", raw):
                row["officialKey"] = {"kind": "dropped", "raw": raw}
                row["review"]["reasons"].append("official-key-dropped-question")
            elif row["answerType"] == "mcq":
                if raw in q["options"]:
                    idx = q["options"].index(raw)
                    row["officialKey"] = {"kind": "option", "index": idx, "optionId": raw, "optionCount": len(q["options"]), "raw": raw}
                else:
                    row["officialKey"] = {"kind": "unmatched", "raw": raw}
                    row["review"]["reasons"].append("key-option-id-not-on-question")
            else:
                try:
                    value = float(raw)
                    row["officialKey"] = {"kind": "numeric", "value": int(value) if value.is_integer() else value, "text": raw, "raw": raw}
                except ValueError:
                    row["officialKey"] = {"kind": "unmatched", "raw": raw}
                    row["review"]["reasons"].append("numeric-key-unparseable")
            rows.append(row)
    return rows


# ── JEE (Advanced) ────────────────────────────────────────────────────────────

ADV_Q = re.compile(r"^\s*Q\.\s*(\d{1,2})\b")
ADV_ANS = re.compile(r"Answer(?:\s*Q\s*\d+)?\s*:\s*(.+)$", re.I)
PAGE_NO = re.compile(r"^\s*(\d{1,2})\s*/\s*(\d{1,2})\s*$", re.M)


def subject_blocks(pdf):
    """Split a JEE (Advanced) document into subject blocks by the k/N page counter."""
    blocks, cur = [], []
    for pno, page in enumerate(pdf):
        m = PAGE_NO.search(page.get_text())
        if m and int(m.group(1)) == 1 and cur:
            blocks.append(cur)
            cur = []
        cur.append(pno)
    if cur:
        blocks.append(cur)
    return blocks


def classify_subject(pdf, pages):
    text = "\n".join(pdf[p].get_text() for p in pages)
    scores = {"mathematics": len(MATHS_WORDS.findall(text)), "physics": len(PHYS_WORDS.findall(text)) * 1.4,
              "chemistry": len(CHEM_WORDS.findall(text)) * 1.4}
    if re.search(r"\bMATHEMATICS\b", text):
        scores["mathematics"] += 50
    best = max(scores, key=scores.get)
    ordered = sorted(scores.values(), reverse=True)
    confident = ordered[0] >= 8 and ordered[0] >= 1.5 * max(ordered[1], 1)
    return best, confident, scores


def section_kind(text: str):
    t = re.sub(r"\s+", " ", text)
    if re.search(r"ONE OR MORE THAN ONE", t, re.I):
        return "multi_mcq"
    if re.search(r"NON-NEGATIVE INTEGER|NUMERICAL VALUE|INTEGER", t, re.I):
        return "numeric"
    if re.search(r"ONLY ONE of these four options", t, re.I):
        return "mcq"
    return None


def parse_answer_token(raw: str):
    s = raw.strip().replace("TO", "to")
    s = re.sub(r"Final Answer Keys?", "", s, flags=re.I).strip()
    if re.search(r"\bor\b", s, re.I):
        return {"kind": "ambiguous", "raw": raw}
    rng = re.search(r"\[?\s*(-?\d+(?:\.\d+)?)\s*to\s*(-?\d+(?:\.\d+)?)\s*\]?", s, re.I)
    if rng:
        lo, hi = float(rng.group(1)), float(rng.group(2))
        if lo == hi:
            return {"kind": "numeric", "value": int(lo) if lo.is_integer() else lo, "text": rng.group(1), "raw": raw}
        return {"kind": "numeric", "value": round((lo + hi) / 2, 9), "range": [lo, hi], "text": f"{lo} to {hi}", "raw": raw}
    num = re.fullmatch(r"\[?\s*(-?\d+(?:\.\d+)?)\s*\]?", s)
    if num:
        v = float(num.group(1))
        return {"kind": "numeric", "value": int(v) if v.is_integer() else v, "text": num.group(1), "raw": raw}
    letters = re.findall(r"[A-D]", re.sub(r"[^A-D]", " ", s.upper()))
    joined = re.fullmatch(r"\(?[A-D]\)?(?:\s*,?\s*\(?[A-D]\)?)*", s.upper().strip())
    if letters and joined:
        idx = sorted({LETTERS.index(c) for c in letters})
        if len(idx) == 1:
            return {"kind": "option", "index": idx[0], "optionCount": 4, "raw": raw, "letters": "".join(LETTERS[i] for i in idx)}
        return {"kind": "options", "indices": idx, "optionCount": 4, "raw": raw, "letters": "".join(LETTERS[i] for i in idx)}
    return {"kind": "unmatched", "raw": raw}


def parse_2019_key_table(pdf):
    """The 2019 final key is a Question/Physics/Chemistry/Mathematics table."""
    text = pdf[0].get_text()
    body = text.split("Mathematics", 1)[1] if "Mathematics" in text else ""
    lines = [l.strip() for l in body.split("\n") if l.strip()]
    out, i = {}, 0
    while i + 3 < len(lines):
        if re.fullmatch(r"\d{1,2}", lines[i]):
            q = int(lines[i])
            out[q] = parse_answer_token(lines[i + 3].replace("*", "").replace("(", "[").replace(")", "]")) \
                if re.search(r"\d", lines[i + 3]) else parse_answer_token(lines[i + 3])
            i += 4
        else:
            i += 1
    return out


def adv_question_markers(pdf, pages):
    markers = []
    for pno in pages:
        page = pdf[pno]
        for block in page.get_text("dict")["blocks"]:
            if block["type"] != 0:
                continue
            for line in block["lines"]:
                text = "".join(s["text"] for s in line["spans"])
                m = ADV_Q.match(text)
                if m and float(line["bbox"][0]) < page.rect.width * 0.2:
                    markers.append({"number": int(m.group(1)), "page": pno, "y": float(line["bbox"][1])})
    markers.sort(key=lambda m: (m["page"], m["y"]))
    # keep the first occurrence of each number (answers or instructions never start with Q.n)
    seen, out = set(), []
    for m in markers:
        if m["number"] in seen:
            continue
        seen.add(m["number"])
        out.append(m)
    return out


def section_map(pdf, pages, markers):
    """Assign each question the answer format of the nearest preceding SECTION instruction."""
    kinds = []
    for pno in pages:
        blocks = sorted(pdf[pno].get_text("blocks"), key=lambda b: (b[1], b[0]))
        for i, b in enumerate(blocks):
            if not re.match(r"\s*SECTION\s+\d", b[4]):
                continue
            # the instructions are this block and the ones below it, up to the first question
            parts = [b[4]]
            for nb in blocks[i + 1:]:
                if re.match(r"\s*(Q\.\s*\d|SECTION\s+\d)", nb[4]):
                    break
                parts.append(nb[4])
            kinds.append(((pno, float(b[1])), section_kind(" ".join(parts)), len(kinds) + 1))
    out = {}
    for m in markers:
        prior = [k for k in kinds if k[0] <= (m["page"], m["y"])]
        out[m["number"]] = (prior[-1][1], prior[-1][2]) if prior else (None, None)
    return out


def extract_jeeadv(doc, manifest, root, key_doc, docs_by_id):
    rows = []
    # Prefer the authority's "question paper with final answers" document as the
    # question source when the key document reprints the questions (2023+).
    sources = []
    key_pdf = None
    if key_doc:
        for _, kp in open_documents(key_doc, root):
            key_pdf = kp
    use_key_as_paper = key_pdf is not None and bool(re.search(r"Q\.\s*1\b", "".join(p.get_text() for p in key_pdf)))
    table_key = parse_2019_key_table(key_pdf) if key_pdf is not None and not use_key_as_paper else {}
    paper_pdf = None
    for _, pp in open_documents(doc, root):
        paper_pdf = pp
    if paper_pdf is None and not use_key_as_paper:
        return rows
    pdf, carrier = (key_pdf, key_doc) if use_key_as_paper else (paper_pdf, doc)
    if not any(p.get_text().strip() for p in pdf):
        row = base_row(doc, manifest, qid=f"{doc['id'].removesuffix('-paper')}-image-only", page=1, number=0, segs=[], key_doc=key_doc)
        row["review"]["reasons"] += ["image-only-document-needs-page-level-transcription"]
        row["documentOnly"] = True
        return [row]
    for pages in subject_blocks(pdf):
        subject, confident, _ = classify_subject(pdf, pages)
        if subject != "mathematics":
            continue
        markers = adv_question_markers(pdf, pages)
        kinds = section_map(pdf, pages, markers)
        for i, m in enumerate(markers):
            nxt = markers[i + 1] if i + 1 < len(markers) else None
            end = (nxt["page"], nxt["y"]) if nxt else (pages[-1], pdf[pages[-1]].rect.height * 0.95)
            segs = segments_between(pdf, (m["page"], m["y"]), end)
            text = text_of(pdf, segs)
            answer_line = None
            for line in text.split("\n"):
                am = ADV_ANS.search(line)
                if am:
                    answer_line = am.group(1)
            qid = f"{doc['id'].removesuffix('-paper')}-q{m['number']:02d}"
            row = base_row(carrier, manifest, qid=qid, page=m["page"] + 1, number=m["number"], segs=segs,
                           section=f"Section {kinds[m['number']][1]}" if kinds[m['number']][1] else None, key_doc=key_doc)
            row["source"]["paperDocumentId"] = doc["id"]
            row["source"]["paperUrl"] = doc["url"]
            row["answerType"] = kinds[m["number"]][0]
            row["prompt"] = re.sub(r"(?m)^.*Answer(?:\s*Q\s*\d+)?\s*:.*$", "", text).strip()
            if not confident:
                row["review"]["reasons"].append("subject-block-classification-uncertain")
            if answer_line:
                row["officialKey"] = parse_answer_token(answer_line)
            elif m["number"] in table_key:
                row["officialKey"] = table_key[m["number"]]
            key = row["officialKey"]
            if key["kind"] == "none":
                row["review"]["reasons"].append("no-official-key" if not key_doc else "key-entry-not-found")
            elif key["kind"] in ("ambiguous", "unmatched"):
                row["review"]["reasons"].append(f"official-key-{key['kind']}")
            elif row["answerType"] == "mcq" and key["kind"] == "options":
                row["review"]["flags"].append("section-says-single-but-key-has-several")
            elif row["answerType"] == "multi_mcq" and key["kind"] == "option":
                row["officialKey"] = {**key, "kind": "options", "indices": [key["index"]]}
            if row["answerType"] is None:
                row["review"]["reasons"].append("answer-format-unresolved")
            rows.append(row)
    return rows


# ── CBSE / NCERT (draft statistics; no automated publish target yet) ─────────

CBSE_Q = re.compile(r"^\s*(?:Q\.?\s*)?(\d{1,2})\s*[.)]\s+\S")
MS_ANS = re.compile(r"^\s*(?:Q\.?\s*)?(\d{1,2})\s*[.)]?\s*(?:Ans(?:wer)?\s*[:.-]?\s*)?\(\s*([a-dA-D])\s*\)", re.M)


def line_markers(pdf, pattern, x_limit=0.25):
    out = []
    for pno, page in enumerate(pdf):
        for block in page.get_text("dict")["blocks"]:
            if block["type"] != 0:
                continue
            for line in block["lines"]:
                text = "".join(s["text"] for s in line["spans"])
                m = pattern.match(text)
                if m and float(line["bbox"][0]) < page.rect.width * x_limit:
                    out.append({"number": int(m.group(1)), "page": pno, "y": float(line["bbox"][1])})
    out.sort(key=lambda m: (m["page"], m["y"]))
    seq, expect = [], 1
    for m in out:  # keep a monotone 1..n run so sub-parts and table rows are not questions
        if m["number"] == expect:
            seq.append(m)
            expect += 1
    return seq


def ms_answers(pdf):
    text = "\n".join(p.get_text() for p in pdf)
    out = {}
    for m in MS_ANS.finditer(text):
        out.setdefault(int(m.group(1)), "abcd".index(m.group(2).lower()))
    return out


def set_code(name: str | None):
    if not name:
        return None
    m = re.search(r"(\d{2,3}-\d-\d|\d{2,3}_\d_\d|\d{2,3}/\d/\d)", name)
    return m.group(1).replace("_", "-").replace("/", "-") if m else Path(name).stem


def extract_cbse(doc, manifest, root, key_doc):
    keys = {}
    if key_doc:
        for member, kpdf in open_documents(key_doc, root):
            keys[set_code(member)] = ms_answers(kpdf)
    rows = []
    for member, pdf in open_documents(doc, root):
        code = set_code(member)
        answers = keys.get(code) or (next(iter(keys.values())) if len(keys) == 1 else {})
        markers = line_markers(pdf, CBSE_Q)
        for i, m in enumerate(markers):
            nxt = markers[i + 1] if i + 1 < len(markers) else None
            end = (nxt["page"], nxt["y"]) if nxt else (len(pdf) - 1, pdf[-1].rect.height * 0.95)
            segs = segments_between(pdf, (m["page"], m["y"]), end)
            suffix = f"-{code}" if member else ""
            row = base_row(doc, manifest, qid=f"{doc['id']}{suffix}-q{m['number']:02d}", page=m["page"] + 1,
                           number=m["number"], segs=segs, member=member, key_doc=key_doc)
            row["prompt"] = text_of(pdf, segs)
            if m["number"] in answers:
                row["answerType"] = "mcq"
                row["officialKey"] = {"kind": "option", "index": answers[m["number"]], "optionCount": 4, "raw": "abcd"[answers[m["number"]]]}
            else:
                row["review"]["reasons"].append("descriptive-or-key-not-auto-paired")
            row["review"]["reasons"].append("cbse-publish-target-not-built")
            rows.append(row)
    return rows


EXEMPLAR_ANS = re.compile(r"^\s*(\d{1,3})\s*\.?\s*\(\s*([A-Da-d])\s*\)", re.M)


def extract_exemplar(doc, manifest, root):
    rows = []
    for _, pdf in open_documents(doc, root):
        text = "\n".join(p.get_text() for p in pdf)
        mcq_answers = {}
        tail = text.rsplit("ANSWERS", 1)[-1] if "ANSWERS" in text.upper() else ""
        for m in EXEMPLAR_ANS.finditer(tail):
            mcq_answers.setdefault(int(m.group(1)), "ABCD".index(m.group(2).upper()))
        markers = line_markers(pdf, CBSE_Q, x_limit=0.3)
        for i, m in enumerate(markers):
            nxt = markers[i + 1] if i + 1 < len(markers) else None
            end = (nxt["page"], nxt["y"]) if nxt else (len(pdf) - 1, pdf[-1].rect.height * 0.95)
            segs = segments_between(pdf, (m["page"], m["y"]), end)
            row = base_row(doc, manifest, qid=f"{doc['id']}-q{m['number']:03d}", page=m["page"] + 1,
                           number=m["number"], segs=segs)
            row["prompt"] = text_of(pdf, segs)[:4000]
            if m["number"] in mcq_answers:
                row["answerType"] = "mcq"
                row["officialKey"] = {"kind": "option", "index": mcq_answers[m["number"]], "optionCount": 4,
                                      "raw": "ABCD"[mcq_answers[m["number"]]]}
            row["review"]["reasons"] += ["exemplar-numbering-restarts-per-exercise-review-required", "ncert-publish-target-not-built"]
            rows.append(row)
    return rows


# ── engine + driver ───────────────────────────────────────────────────────────

def run_engine(rows):
    if not rows:
        return
    payload = "\n".join(json.dumps(r, ensure_ascii=False) for r in rows) + "\n"
    proc = subprocess.run(["node", str(ENGINE)], input=payload, capture_output=True, text=True, cwd=REPO)
    if proc.returncode != 0:
        raise SystemExit(f"engine_check.mjs failed: {proc.stderr[:2000]}")
    verdicts = [json.loads(l) for l in proc.stdout.splitlines() if l.strip()]
    if len(verdicts) != len(rows):
        raise SystemExit("engine_check.mjs returned a different number of verdicts")
    for row, v in zip(rows, verdicts):
        row["engine"] = {k: v[k] for k in v if k != "id"}
        if v.get("verdict") == "disagreement":
            row["review"]["flags"].append("engine-disagrees-with-official-key")


def extract_all(manifest, root, *, only=(), exams=()):
    docs = {d["id"]: d for d in manifest["documents"]}
    rows, coverage = [], []
    for doc in manifest["documents"]:
        if doc["role"] not in ("question-paper", "sample-paper", "exercise-with-answers"):
            continue
        if only and not any(doc["id"].startswith(p) for p in only):
            continue
        if exams and doc["exam"] not in exams:
            continue
        path = root / f"{doc['id']}.{doc.get('format', 'pdf')}"
        key_doc = docs.get(doc.get("answerKey")) if doc.get("answerKey") else None
        if not path.exists() and not (key_doc and (root / f"{key_doc['id']}.{key_doc.get('format', 'pdf')}").exists()):
            coverage.append({"id": doc["id"], "status": "not-cached"})
            continue
        if doc["parser"] == "nta-cbt":
            got = extract_nta(doc, manifest, root, key_doc)
        elif doc["parser"] == "jeeadv":
            got = extract_jeeadv(doc, manifest, root, key_doc, docs)
        elif doc["parser"] == "cbse":
            got = extract_cbse(doc, manifest, root, key_doc)
        elif doc["parser"] == "ncert-exemplar":
            got = extract_exemplar(doc, manifest, root)
        else:
            got = []
        coverage.append({"id": doc["id"], "status": "extracted", "rows": len(got)})
        rows.extend(got)
    ids = Counter(r["id"] for r in rows)
    for r in rows:
        if ids[r["id"]] > 1:
            r["review"]["flags"].append("duplicate-question-id")
    return rows, coverage


def stats(rows):
    by = defaultdict(Counter)
    for r in rows:
        if r.get("documentOnly"):
            by[(r["exam"]["id"], r["exam"]["year"])]["imageOnlyDocuments"] += 1
            continue
        k = (r["exam"]["id"], r["exam"]["year"])
        c = by[k]
        c["extracted"] += 1
        if r["officialKey"]["kind"] in ("option", "options", "numeric"):
            c["keyMatched"] += 1
        if (r.get("engine") or {}).get("verdict") == "verified":
            c["engineVerified"] += 1
        if "engine-disagrees-with-official-key" in r["review"]["flags"] or r["review"]["flags"]:
            c["disagreements"] += 1
    return [{"exam": k[0], "year": k[1], **dict(v)} for k, v in sorted(by.items(), key=lambda kv: (kv[0][0], kv[0][1] or 0))]


def write_jsonl(path: Path, rows):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as fh:
        for r in rows:
            fh.write(json.dumps(r, ensure_ascii=False, separators=(",", ":")) + "\n")


def main(argv=None):
    ap = argparse.ArgumentParser(description="Extract DRAFT maths rows from cached official documents")
    ap.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    ap.add_argument("--cache", type=Path)
    ap.add_argument("--out", type=Path, default=DEFAULT_OUT)
    ap.add_argument("--stats", type=Path, help="write per-exam/year statistics JSON")
    ap.add_argument("--only", nargs="*", default=[])
    ap.add_argument("--exam", nargs="*", default=[])
    ap.add_argument("--no-engine", action="store_true")
    args = ap.parse_args(argv)
    manifest = load_manifest(args.manifest)
    rows, coverage = extract_all(manifest, cache_root(manifest, args.cache), only=args.only, exams=set(args.exam))
    if not args.no_engine:
        run_engine([r for r in rows if not r.get("documentOnly")])
    write_jsonl(args.out, rows)
    table = stats(rows)
    report = {"queue": str(args.out), "rows": len(rows), "published": 0,
              "rule": "Extraction never publishes; every row is a draft with reviewedBy null.",
              "byExamYear": table, "documents": coverage}
    if args.stats:
        args.stats.parent.mkdir(parents=True, exist_ok=True)
        args.stats.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({k: report[k] for k in ("queue", "rows", "published")}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
