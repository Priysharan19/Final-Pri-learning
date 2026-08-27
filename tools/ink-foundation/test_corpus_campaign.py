#!/usr/bin/env python3
"""Regression tests for Pri Ink V17.1 corpus evidence and campaign planning."""
from __future__ import annotations

import json
import tempfile
from pathlib import Path

from audit_writer_diversity import POLICY, build_report
from plan_collection_campaign import SPLITS, assigned_split, candidate_codes, build_campaign


def sample(target="x"):
    return {
        "target": target,
        "strokes": [{
            "points": [
                {"x": 1.0, "y": 2.0, "t": 0.0, "p": 0.4, "w": 2.0},
                {"x": 3.0, "y": 4.0, "t": 0.02, "p": 0.5, "w": 2.2},
            ]
        }],
    }


def corpus(writer, split, session, samples):
    return {
        "format": "pri-ink-corpus",
        "version": 2,
        "split": split,
        "writer": {
            "id": writer,
            "sessionId": session,
            "handedness": "right",
        },
        "samples": samples,
    }


def write_doc(root: Path, name: str, doc: dict):
    (root / name).write_text(json.dumps(doc), encoding="utf-8")


def test_policy():
    readiness = POLICY["readiness"]
    evidence = POLICY["evidence"]
    assert readiness["trainWriterTarget"] == 100
    assert readiness["minSamplesPerTrainWriter"] == 40
    assert readiness["evaluationMinWriters"] == 20
    assert readiness["evaluationMinSamples"] == 1000
    assert readiness["minTrainWritersPerToken"] == 5
    assert readiness["minTestWritersPerToken"] == 3
    assert readiness["minTestOccurrencesPerToken"] == 5
    assert evidence["routineToolsMayInspectFinalHoldoutTargets"] is False
    assert evidence["routineToolsMayInspectFinalHoldoutStrokes"] is False


def test_duplicate_writer_session_and_holdout_firewall():
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        write_doc(root, "train-a.json", corpus("P1000", "train", "SAME", [sample("x")]))
        write_doc(root, "train-b.json", corpus("P1000", "train", "SAME", [sample("2")]))
        # Deliberately toxic holdout contents: if routine readiness inspected this,
        # it would create an unknown target and style/sample statistics.
        write_doc(
            root,
            "holdout.json",
            corpus(
                "P2000",
                "final-holdout",
                "HOLDOUT-SESSION",
                [{"target": "🔥", "strokes": [{"points": [{"x": "not-a-number"}]}]}],
            ),
        )

        report = build_report(root)
        assert report["duplicateSessionIds"] == ["SAME"], report["duplicateSessionIds"]
        assert report["gates"]["noDuplicateSessionIds"] is False
        assert report["unknownTargets"] == [], report["unknownTargets"]
        assert "final-holdout" not in report["samplesBySplit"]
        assert report["finalHoldout"]["writersRegistered"] == 1
        assert report["finalHoldout"]["contentInspected"] is False
        holdout = report["byWriter"]["P2000"]
        assert holdout == {
            "split": "final-holdout",
            "files": 1,
            "detailsRead": False,
        }


def test_candidate_allocator():
    counts = {split: 8 for split in SPLITS}
    codes = candidate_codes({"P0001", "P0002"}, counts, "P", 4)
    all_codes = []
    for split in SPLITS:
        assert len(codes[split]) == counts[split]
        assert all(assigned_split(code) == split for code in codes[split])
        all_codes.extend(codes[split])
    assert len(all_codes) == len(set(all_codes))
    assert not ({"P0001", "P0002"} & set(all_codes))


def test_campaign_never_reports_holdout_samples():
    with tempfile.TemporaryDirectory() as tmp:
        root = Path(tmp)
        write_doc(root, "holdout.json", corpus(
            "P3000", "final-holdout", "H3000", [sample("x"), sample("2")]
        ))
        plan = build_campaign(str(root), preview=2)
        assert plan["samples"]["current"]["final-holdout"] is None
        assert plan["samples"]["targets"]["finalHoldout"] is None
        assert plan["samples"]["deficits"]["finalHoldout"] is None
        assert plan["evidenceFirewall"]["finalHoldoutContentInspected"] is False
        assert plan["evidenceFirewall"]["finalHoldoutSamplesReported"] is False
        for split in SPLITS:
            for code in plan["candidateCodes"][split]:
                assert assigned_split(code) == split


def main():
    test_policy()
    test_duplicate_writer_session_and_holdout_firewall()
    test_candidate_allocator()
    test_campaign_never_reports_holdout_samples()
    print("Pri Ink V17.1 corpus evidence/campaign regression: PASS")


if __name__ == "__main__":
    main()
