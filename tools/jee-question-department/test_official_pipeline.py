#!/usr/bin/env python3
"""Regression tests for the official-source intake: fetch -> extract -> engine -> audit -> pack.

Synthetic only: PDFs are generated in a temp dir with PyMuPDF and served via
file:// URLs, so CI needs no network and no exam-authority document is ever
committed.
"""
from __future__ import annotations

import copy
import hashlib
import importlib.util
import json
import subprocess
import sys
import tempfile
from pathlib import Path

import pymupdf as fitz

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))

import audit as audit_mod  # noqa: E402
import extract_official as ex  # noqa: E402
import fetch_official as fetch  # noqa: E402
import review_official as rev  # noqa: E402

BOOK = json.loads((HERE / "source-manifest.json").read_text(encoding="utf-8"))
OFFICIAL = json.loads((HERE / "official-sources.json").read_text(encoding="utf-8"))


def nta_paper(path: Path):
    doc = fitz.open()
    page = doc.new_page()
    y = 60
    page.insert_text((40, y), "Mathematics Section A"); y += 30
    for n, qid, opts in [(1, "5550001", ["55500011", "55500012", "55500013", "55500014"]),
                         (2, "5550002", ["55500021", "55500022", "55500023", "55500024"])]:
        page.insert_text((40, y), f"Question Number : {n} Question Id : {qid} Question Type : MCQ Option Shuffling : Yes"); y += 20
        page.insert_text((40, y), f"If x + {n} = {n + 2}, then x equals"); y += 20
        page.insert_text((40, y), "Options :"); y += 18
        for o in opts:
            page.insert_text((40, y), f"{o}."); y += 18
        y += 10
    page.insert_text((40, y), "Mathematics Section B"); y += 30
    page.insert_text((40, y), "Question Number : 3 Question Id : 5550003 Question Type : SA Display Question Number : Yes"); y += 20
    page.insert_text((40, y), "Find the value of 7 x 13."); y += 30
    page.insert_text((40, y), "Physics Section A"); y += 30
    page.insert_text((40, y), "Question Number : 4 Question Id : 5550004 Question Type : MCQ Option Shuffling : Yes")
    doc.save(path)


def nta_key(path: Path):
    doc = fitz.open()
    page = doc.new_page()
    text = "NATIONAL TESTING AGENCY\nExam Date : 01.01.2026\n( MATHEMATICS )\n5550001 55500013\n5550002\n55500021\n5550003\n91\n( PHYSICS )\n5550004 55500041\n"
    page.insert_text((40, 60), text)
    doc.save(path)


def jeeadv_key(path: Path):
    doc = fitz.open()
    page = doc.new_page()
    page.insert_text((40, 50), "SECTION 1 (Maximum Marks: 12)\nEach question has FOUR options (A), (B), (C) and (D). ONLY ONE of these four options is the correct\nanswer.")
    page.insert_text((40, 130), "Q.1 Let f be a real function on the real numbers with f(x) = x^2. The limit of the integral is")
    page.insert_text((40, 160), "(A) 1   (B) 2   (C) 3   (D) 4")
    page.insert_text((40, 190), "Answer: (B)")
    page.insert_text((40, 240), "SECTION 2 (Maximum Marks: 24)\nThe answer to each question is a NUMERICAL VALUE.")
    page.insert_text((40, 300), "Q.2 Let the matrix M have determinant d. The function value of the integral is")
    page.insert_text((40, 330), "Answer: [2.35 to 2.45]")
    page.insert_text((40, 380), "Q.3 Let the vectors and the plane, the probability of the circle is")
    page.insert_text((40, 410), "Answer: A or B")
    page.insert_text((280, 800), "1/1")
    doc.save(path)


def manifest_for(tmp: Path):
    docs = []
    for did, exam, role, parser, key in [
        ("t-nta-paper", "jee-main", "question-paper", "nta-cbt", "t-nta-key"),
        ("t-nta-key", "jee-main", "answer-key", "nta-key", None),
        ("t-adv-paper", "jee-advanced", "question-paper", "jeeadv", "t-adv-key"),
        ("t-adv-key", "jee-advanced", "answer-key", "jeeadv-key", None),
    ]:
        docs.append({"id": did, "exam": exam, "authority": "Test Authority", "year": 2026, "paper": "1", "session": "2",
                     "shift": None, "role": role, "url": (tmp / "src" / f"{did}.pdf").as_uri(), "parser": parser,
                     "answerKey": key, "format": "pdf", "sha256": None, "bytes": None, "subject": "maths"})
    return {"schemaVersion": 1, "kind": "official-sources", "cacheDir": str(tmp / "cache"),
            "licensing": copy.deepcopy(OFFICIAL["licensing"]), "policy": {}, "documents": docs}


def test_manifest_shape():
    assert OFFICIAL["schemaVersion"] == 1 and OFFICIAL["kind"] == "official-sources"
    ids = [d["id"] for d in OFFICIAL["documents"]]
    assert len(ids) == len(set(ids)), "duplicate document ids"
    by_id = {d["id"]: d for d in OFFICIAL["documents"]}
    for d in OFFICIAL["documents"]:
        assert d["subject"] == "maths"
        assert d["url"].startswith("https://"), d["id"]
        host = d["url"].split("/")[2]
        assert host.endswith(("jeeadv.ac.in", "nta.ac.in", "nta.nic.in", "s3waas.gov.in", "cbse.gov.in", "cbseacademic.nic.in", "ncert.nic.in")), host
        if d.get("answerKey"):
            assert d["answerKey"] in by_id, f"{d['id']} pairs with missing key {d['answerKey']}"
        if d.get("sha256") is not None:
            assert len(d["sha256"]) == 64 and int(d["sha256"], 16) >= 0
    assert OFFICIAL["policy"]["neverCommitDocuments"] is True


def test_fetch_pins_and_fails_closed(tmp: Path, manifest: dict):
    mpath = tmp / "m.json"
    mpath.write_text(json.dumps(manifest), encoding="utf-8")
    assert fetch.main(["--manifest", str(mpath), "--pin"]) == 0
    pinned = json.loads(mpath.read_text(encoding="utf-8"))
    for d in pinned["documents"]:
        assert d["sha256"] == hashlib.sha256((tmp / "src" / f"{d['id']}.pdf").read_bytes()).hexdigest()
    # tamper with the source and force a refresh: the pinned hash must refuse it
    src = tmp / "src" / "t-nta-key.pdf"
    original = src.read_bytes()
    src.write_bytes(original + b"\n%tampered")
    assert fetch.main(["--manifest", str(mpath), "--refresh", "--only", "t-nta-key"]) == 3
    src.write_bytes(original)
    # an HTML login page is classified as gated, never cached as a document
    html = tmp / "src" / "gate.pdf"
    html.write_bytes(b"<!doctype html><title>Login</title><form>captcha</form>")
    gated = fetch.fetch_one({"id": "gate", "url": html.as_uri(), "format": "pdf"}, tmp / "cache", pin=True, refresh=True, timeout=5)
    assert gated["status"] == "gated" and not (tmp / "cache" / "gate.pdf").exists()
    return pinned


def test_extract_pairs_and_engine(tmp: Path, manifest: dict):
    rows, _ = ex.extract_all(manifest, tmp / "cache")
    ex.run_engine(rows)
    by = {r["id"]: r for r in rows}
    q1, q2, q3 = by["t-nta-q01"], by["t-nta-q02"], by["t-nta-q03"]
    assert q1["officialKey"] == {**q1["officialKey"], "kind": "option", "index": 2}
    assert q2["officialKey"]["index"] == 0
    assert q3["officialKey"]["kind"] == "numeric" and q3["officialKey"]["value"] == 91
    assert "t-nta-q04" not in by, "physics question leaked into the maths queue"
    for r in (q1, q2, q3):
        assert r["status"] == "draft" and r["review"]["reviewedBy"] is None
        assert r["source"]["page"] == 1 and r["source"]["url"].startswith("file://")
        assert r["engine"]["verdict"] == "verified", r["engine"]
    a1, a2, a3 = by["t-adv-q01"], by["t-adv-q02"], by["t-adv-q03"]
    assert a1["answerType"] == "mcq" and a1["officialKey"]["index"] == 1, (a1["answerType"], a1["officialKey"], a1["review"])
    assert a2["answerType"] == "numeric" and a2["officialKey"]["range"] == [2.35, 2.45]
    assert a2["engine"]["verdict"] == "verified", "both published band edges must be accepted"
    assert a3["officialKey"]["kind"] == "ambiguous" and a3["engine"]["verdict"] != "verified"
    return rows


def approved_official(row, *, tier="automated"):
    r = copy.deepcopy(row)
    r.update({
        "status": "approved", "difficulty": 2, "prompt": "If $x + 1 = 3$, then $x$ equals",
        "mcqOptions": ["1", "2", "3", "4"], "answerType": "mcq", "answer": {"correctIndex": r["officialKey"].get("index")},
        "routing": {"part": "algebra", "targetChapter": "c11-complex-numbers"},
        "steps": [{"h": "Isolate", "d": "Subtract 1 from both sides to get $x = 2$."}],
    })
    r["review"].update({"tier": tier, "reviewedAt": "2026-10-02T00:00:00Z", "transcriptionPassId": "t-1", "flags": []})
    if tier == "automated":
        r["review"]["reviewedBy"] = "automated:key+engine+ai-review/test-model/2026-10-02"
        r["review"]["ai"] = {"transcriptionMatches": True, "complete": True, "wellPosed": True, "labelsCorrect": True,
                             "stepsCorrect": True, "independentAnswerAgrees": True, "reviewerModel": "test-model", "reviewPassId": "r-1"}
    else:
        r["review"]["reviewedBy"] = "A. Reviewer"
    return r


def test_audit_gates(rows, manifest):
    q1 = next(r for r in rows if r["id"] == "t-nta-q01")
    # drafts never publish
    _, errors, _ = audit_mod.audit([q1], BOOK, publish=True, official=manifest)
    assert any("status 'draft'" in e for e in errors)
    good = approved_official(q1)
    _, errors, _ = audit_mod.audit([good], BOOK, publish=True, official=manifest)
    assert not errors, errors
    human = approved_official(q1, tier="human")
    assert not audit_mod.audit([human], BOOK, publish=True, official=manifest)[1]

    def broken(mutate, needle):
        r = copy.deepcopy(good)
        mutate(r)
        _, errs, _ = audit_mod.audit([r], BOOK, publish=True, official=manifest)
        assert any(needle in e for e in errs), (needle, errs)

    broken(lambda r: r["answer"].update(correctIndex=0), "official answer key")
    broken(lambda r: r.update(engine={"verdict": "disagreement"}), "engine verdict")
    broken(lambda r: r["review"]["ai"].update(transcriptionMatches=False), "transcriptionMatches")
    broken(lambda r: r["review"]["ai"].update(independentAnswerAgrees=None), "independentAnswerAgrees")
    broken(lambda r: r["review"]["ai"].update(reviewPassId="t-1"), "not independent")
    broken(lambda r: r["review"].update(reviewedBy="Priya"), "automated tier reviewer")
    broken(lambda r: r["review"].update(flags=["engine-disagrees-with-official-key"]), "disagreement flags")
    broken(lambda r: r["source"].update(sha256="0" * 64), "sha256")
    broken(lambda r: r["routing"].update(targetChapter="c09-unknown"), "known Pri JEE chapter")
    broken(lambda r: r.update(steps=[{"h": "Source solution", "d": "Review the printed solution."}]), "placeholder")
    hum = copy.deepcopy(human)
    hum["review"]["reviewedBy"] = "automated:key+engine+ai-review/x/2026-10-02"
    assert any("non-person" in e for e in audit_mod.audit([hum], BOOK, publish=True, official=manifest)[1])
    unconfirmed = copy.deepcopy(manifest)
    unconfirmed["licensing"] = {"status": "unconfirmed"}
    assert any("BLOCKED_EXTERNAL" in e for e in audit_mod.audit([good], BOOK, publish=True, official=unconfirmed)[1])
    # numeric automated tier needs the engine's own re-solve to agree
    q3 = next(r for r in rows if r["id"] == "t-nta-q03")
    num = approved_official(q3)
    num.update(answerType="numeric", answer={"value": 91}, mcqOptions=None, prompt="Find the value of $7 \\times 13$.")
    assert any("re-solve" in e for e in audit_mod.audit([num], BOOK, publish=True, official=manifest)[1])
    num["engine"] = {**num["engine"], "engineSolve": {"expression": "7*13", "value": 91, "agrees": True}}
    assert not audit_mod.audit([num], BOOK, publish=True, official=manifest)[1]
    # the commercial-book path can never use the automated tier
    book = json.loads(json.dumps(__import__("test_pipeline").fixture()))
    book["review"]["reviewedBy"] = "automated:key+engine+ai-review/x/2026-10-02"
    assert any("automated review tier is not allowed" in e for e in audit_mod.audit([book], BOOK, publish=True, official=manifest)[1])
    return good


def test_decide_automated_tier(rows):
    q1 = copy.deepcopy(next(r for r in rows if r["id"] == "t-nta-q01"))
    q3 = copy.deepcopy(next(r for r in rows if r["id"] == "t-nta-q03"))
    t = {"prompt": "If $x+1=3$ then x equals", "mcqOptions": ["1", "2", "3", "4"], "targetChapter": "c11-complex-numbers",
         "difficulty": 1, "hints": ["Isolate x."], "steps": [{"h": "Isolate", "d": "x = 2"}], "passId": "t-1", "problems": []}
    t3 = {**t, "mcqOptions": None, "prompt": "Find $7 \\times 13$."}
    rev.merge_transcriptions([q1, q3], {q1["id"]: t, q3["id"]: t3}, BOOK)
    assert q1["answer"] == {"correctIndex": 2} and q3["answer"] == {"value": 91}, "answer must come from the key"
    ok = {"transcriptionMatches": True, "complete": True, "wellPosed": True, "labelsCorrect": True, "stepsCorrect": True, "passId": "r-1", "blind": True, "answerVisible": False}
    # a review whose crops showed the printed key is ignored
    q_seen = copy.deepcopy(next(r for r in rows if r["id"] == "t-nta-q01"))
    rev.merge_transcriptions([q_seen], {q_seen["id"]: t}, BOOK)
    rev.decide([q_seen], {q_seen["id"]: {**ok, "blind": False, "independentAnswer": {"kind": "option", "index": 2}}}, model="m", date="2026-10-02")
    assert q_seen["status"] == "draft" and not q_seen["review"].get("ai")
    good_rev = {q1["id"]: {**ok, "independentAnswer": {"kind": "option", "index": 2}},
                q3["id"]: {**ok, "independentAnswer": {"kind": "numeric", "expression": "7*13"}}}
    rev.decide([q1, q3], good_rev, model="test-model", date="2026-10-02")
    for r in (q1, q3):
        assert r["status"] == "approved" and r["review"]["tier"] == "automated", r["review"]
        assert r["review"]["reviewedBy"] == "automated:key+engine+ai-review/test-model/2026-10-02"
    # a blind reviewer that disagrees keeps the row a draft
    q1b = copy.deepcopy(next(r for r in rows if r["id"] == "t-nta-q01"))
    q3b = copy.deepcopy(next(r for r in rows if r["id"] == "t-nta-q03"))
    rev.merge_transcriptions([q1b, q3b], {q1b["id"]: t, q3b["id"]: t3}, BOOK)
    bad_rev = {q1b["id"]: {**ok, "independentAnswer": {"kind": "option", "index": 1}},
               q3b["id"]: {**ok, "independentAnswer": {"kind": "numeric", "expression": "7*12"}}}
    rev.decide([q1b, q3b], bad_rev, model="test-model", date="2026-10-02")
    assert q1b["status"] == "draft" and q3b["status"] == "draft"
    assert "engine-disagrees-with-official-key" in q3b["review"]["flags"]
    return [q1, q3]


def test_pack_official(approved, manifest, tmp: Path):
    queue = tmp / "approved.jsonl"
    queue.write_text("".join(json.dumps(r) + "\n" for r in approved), encoding="utf-8")
    mpath = tmp / "official.json"
    mpath.write_text(json.dumps(manifest), encoding="utf-8")
    # pack.py reads the default official manifest; run audit via module instead with the temp manifest
    _, errors, _ = audit_mod.audit(approved, BOOK, publish=True, official=manifest)
    assert not errors, errors
    spec = importlib.util.spec_from_file_location("pack_mod", HERE / "pack.py")
    pack_mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(pack_mod)
    rec = pack_mod.compact_record(approved[0])
    assert rec["official"]["url"] == approved[0]["source"]["url"]
    assert rec["review"]["tier"] == "automated"
    assert rec["sourceQuestionNumber"] == approved[0]["source"]["questionNumber"]


def test_engine_cli():
    lines = [
        {"id": "a", "officialKey": {"kind": "option", "index": 2, "optionCount": 4}},
        {"id": "b", "officialKey": {"kind": "numeric", "value": 0.75, "range": [0.74, 0.76]}},
        {"id": "c", "officialKey": {"kind": "numeric", "value": 4}, "engineSolve": "5"},
        {"id": "d"},
    ]
    out = subprocess.run(["node", str(HERE / "engine_check.mjs")], input="".join(json.dumps(l) + "\n" for l in lines),
                         capture_output=True, text=True, check=True).stdout.splitlines()
    verdicts = [json.loads(l)["verdict"] for l in out]
    assert verdicts == ["verified", "verified", "disagreement", "no-key"], verdicts


def main():
    test_manifest_shape()
    test_engine_cli()
    with tempfile.TemporaryDirectory(prefix="pri-official-") as d:
        tmp = Path(d)
        (tmp / "src").mkdir()
        nta_paper(tmp / "src" / "t-nta-paper.pdf")
        nta_key(tmp / "src" / "t-nta-key.pdf")
        jeeadv_key(tmp / "src" / "t-adv-key.pdf")
        # the JEE (Advanced) "paper" for this sitting is the key document that reprints it
        jeeadv_key(tmp / "src" / "t-adv-paper.pdf")
        manifest = manifest_for(tmp)
        pinned = test_fetch_pins_and_fails_closed(tmp, manifest)
        rows = test_extract_pairs_and_engine(tmp, pinned)
        test_audit_gates(rows, pinned)
        approved = test_decide_automated_tier(rows)
        test_pack_official(approved, pinned, tmp)
    print("Official-source intake pipeline: PASS")


if __name__ == "__main__":
    main()
