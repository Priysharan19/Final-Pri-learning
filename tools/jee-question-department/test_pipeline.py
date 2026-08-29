#!/usr/bin/env python3
"""Regression test for the JEE review → audit → pack boundary.

Uses only synthetic records. The copyrighted source PDF is never required in CI.
"""
from __future__ import annotations

import base64
import gzip
import importlib.util
import json
import subprocess
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
MANIFEST = HERE / "source-manifest.json"
PACKER = HERE / "pack.py"


def load_audit_module():
    spec = importlib.util.spec_from_file_location("jee_question_audit", HERE / "audit.py")
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def fixture(answer_type="mcq"):
    row = {
        "id": "fixture-c01-t01-q001",
        "status": "approved",
        "source": {
            "book": "41 Years IIT JEE Mathematics",
            "edition": "2019-1979",
            "sourceChapterNumber": 1,
            "sourceChapter": "Complex Numbers",
            "sourceTopicNumber": 1,
            "sourceTopic": "Complex Number in Iota Form",
            "sourcePage": 1,
            "sourcePdfPage": 10,
            "sourceQuestionNumber": 1,
            "crop": [50.0, 100.0, 300.0, 200.0],
        },
        "routing": {
            "part": "algebra",
            "targetChapter": "c11-complex-numbers",
            "allowedTargets": ["c11-complex-numbers"],
        },
        "exam": {
            "year": 2019,
            "track": "jee-main",
            "evidence": "synthetic CI fixture",
        },
        "difficulty": 3,
        "answerType": answer_type,
        "prompt": "Synthetic reviewed JEE question used only by the CI pipeline test.",
        "answer": {"correctIndex": 1},
        "mcqOptions": ["A", "B", "C", "D"],
        "hints": ["Synthetic hint"],
        "steps": [
            {"h": "Set up", "d": "Use the stated condition to form the required expression."},
            {"h": "Finish", "d": "Simplify the expression and obtain the reviewed result."},
        ],
        "review": {
            "extractionScore": 10,
            "reasons": [],
            "reviewedBy": "ci-fixture",
            "reviewedAt": "2026-08-29T00:00:00Z",
        },
    }
    return row


def main():
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    audit_mod = load_audit_module()

    approved = fixture()
    summary, errors, _ = audit_mod.audit([approved], manifest, publish=True)
    assert not errors, errors
    assert summary["approved"] == 1

    rejected = fixture()
    rejected["id"] = "fixture-rejected"
    rejected["steps"] = [{"h": "Source solution", "d": "Review the printed solution."}]
    _, errors, _ = audit_mod.audit([rejected], manifest, publish=True)
    assert errors and any("placeholder" in err.lower() for err in errors)

    with tempfile.TemporaryDirectory(prefix="pri-jee-dept-") as tmp:
        root = Path(tmp)
        queue = root / "approved.jsonl"
        dest = root / "packed"
        mixed = fixture()
        mixed["id"] = "fixture-c26-t01-q001"
        mixed["source"].update({
            "sourceChapterNumber": 26, "sourceChapter": "Miscellaneous",
            "sourceTopicNumber": 1, "sourceTopic": "Mixed",
            "sourcePage": 573, "sourcePdfPage": 582, "sourceQuestionNumber": 1,
        })
        mixed["routing"].update({
            "part": "mixed", "targetChapter": "c11-complex-numbers",
            "allowedTargets": ["c11-complex-numbers"],
        })
        queue.write_text(
            json.dumps(approved, ensure_ascii=False) + "\n" + json.dumps(mixed, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )
        subprocess.run(
            [sys.executable, str(PACKER), str(queue), "--manifest", str(MANIFEST), "--dest", str(dest), "--max-base64-chars", "80"],
            check=True,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
        )

        catalog = (dest / "catalog.js").read_text(encoding="utf-8")
        assert '"jee-main-c11-complex-numbers":["algebra","mixed"]' in catalog
        assert '"records":2' in catalog
        shards = sorted(dest.glob("algebra-*.b64"))
        assert shards
        encoded = "".join(p.read_text(encoding="ascii").strip() for p in shards)
        records = json.loads(gzip.decompress(base64.b64decode(encoded)).decode("utf-8"))
        assert len(records) == 1
        packed = records[0]
        assert packed["id"] == approved["id"]
        assert packed["chapterId"] == "c11-complex-numbers"
        assert packed["review"]["reviewedBy"] == "ci-fixture"
        assert len(packed["steps"]) == 2

    print("JEE question department pipeline: PASS")


if __name__ == "__main__":
    main()
