"""Writer-safe dataset loader for PRI Ink V2 corpora."""
from __future__ import annotations

import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable

from features import FEATURE_CONTRACT_VERSION, build_feature_tensor
from vocabulary import encode, tokenize

ALLOWED_SPLITS = {"train", "calibration", "test", "final_holdout"}


@dataclass(frozen=True)
class InkExample:
    participant_id: str
    session_id: str
    split: str
    target: str
    features: list[list[float]]
    token_ids: list[int]
    symbol_count: int
    pen: bool
    provenance: str
    source_file: str


class CorpusError(RuntimeError):
    pass


def _load_json(path: Path) -> dict[str, Any]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except Exception as exc:
        raise CorpusError(f"{path}: invalid JSON: {exc}") from exc
    if not isinstance(data, dict):
        raise CorpusError(f"{path}: top level must be an object")
    return data


def validate_v2_document(data: dict[str, Any], path: Path) -> tuple[str, str, str, str]:
    if data.get("format") != "pri-ink-corpus" or data.get("version") != 2:
        raise CorpusError(f"{path}: only pri-ink-corpus version 2 is accepted for model training")
    participant = data.get("participant")
    session = data.get("session")
    if not isinstance(participant, dict) or not isinstance(session, dict):
        raise CorpusError(f"{path}: missing participant/session metadata")
    participant_id = str(participant.get("id") or "").strip()
    session_id = str(session.get("id") or "").strip()
    split = str(participant.get("split") or "").strip()
    provenance = str(session.get("collector") or "unknown")
    if len(participant_id) < 3 or not session_id:
        raise CorpusError(f"{path}: participant/session identity is incomplete")
    if split not in ALLOWED_SPLITS:
        raise CorpusError(f"{path}: invalid split {split!r}")
    if session.get("predictedSamplesIncluded") is not False:
        raise CorpusError(f"{path}: predicted samples are forbidden in production training evidence")
    return participant_id, session_id, split, provenance


def load_corpus(paths: Iterable[Path], *, include_finger: bool = False) -> list[InkExample]:
    examples: list[InkExample] = []
    participant_split: dict[str, str] = {}
    sessions: set[tuple[str, str]] = set()

    for path in paths:
        data = _load_json(path)
        participant_id, session_id, split, provenance = validate_v2_document(data, path)
        previous = participant_split.setdefault(participant_id, split)
        if previous != split:
            raise CorpusError(
                f"writer leakage: participant {participant_id!r} appears in both {previous!r} and {split!r}"
            )
        session_key = (participant_id, session_id)
        if session_key in sessions:
            raise CorpusError(f"duplicate session {participant_id}/{session_id}")
        sessions.add(session_key)

        samples = data.get("samples")
        if not isinstance(samples, list):
            raise CorpusError(f"{path}: samples must be an array")
        for sample_index, sample in enumerate(samples):
            if not isinstance(sample, dict):
                continue
            pen = bool(sample.get("pen"))
            if not pen and not include_finger:
                continue
            if sample.get("predictedSamplesIncluded") is not False:
                raise CorpusError(f"{path} sample {sample_index}: predicted samples are forbidden")
            if sample.get("strokeOrderPreserved") is not True:
                raise CorpusError(f"{path} sample {sample_index}: natural stroke order is required")
            target = str(sample.get("target") or "").strip()
            strokes = sample.get("strokes")
            if not target or not isinstance(strokes, list) or not strokes:
                continue
            tensor = build_feature_tensor(strokes)
            if not tensor.rows:
                continue
            token_ids = encode(target)
            if not token_ids:
                continue
            examples.append(InkExample(
                participant_id=participant_id,
                session_id=session_id,
                split=split,
                target=target,
                features=tensor.rows,
                token_ids=token_ids,
                symbol_count=len(tokenize(target)),
                pen=pen,
                provenance=provenance,
                source_file=str(path),
            ))

    return examples


def discover(root: str | Path) -> list[Path]:
    base = Path(root)
    return sorted(path for path in base.rglob("*.json") if path.is_file())


def audit(examples: list[InkExample]) -> dict[str, Any]:
    by_split: dict[str, dict[str, Any]] = {}
    for split in sorted(ALLOWED_SPLITS):
        members = [e for e in examples if e.split == split]
        by_split[split] = {
            "examples": len(members),
            "participants": len({e.participant_id for e in members}),
            "sessions": len({(e.participant_id, e.session_id) for e in members}),
        }
    participant_sets = {
        split: {e.participant_id for e in examples if e.split == split}
        for split in ALLOWED_SPLITS
    }
    overlaps: list[str] = []
    ordered = sorted(ALLOWED_SPLITS)
    for i, lhs in enumerate(ordered):
        for rhs in ordered[i + 1:]:
            shared = participant_sets[lhs] & participant_sets[rhs]
            if shared:
                overlaps.append(f"{lhs}<->{rhs}: {sorted(shared)}")
    if overlaps:
        raise CorpusError("writer split leakage: " + "; ".join(overlaps))
    return {
        "featureContract": FEATURE_CONTRACT_VERSION,
        "examples": len(examples),
        "participants": len({e.participant_id for e in examples}),
        "sessions": len({(e.participant_id, e.session_id) for e in examples}),
        "splits": by_split,
        "writerLeakage": False,
    }
