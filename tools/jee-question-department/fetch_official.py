#!/usr/bin/env python3
"""Fetch official exam-authority documents into a gitignored, hash-verified cache.

The manifest (official-sources.json) names every document by its exam-authority
URL. This tool downloads each one into ``cache/official/`` (never committed) and
checks it against the pinned sha256:

* pinned hash + matching bytes  -> ``ok``
* pinned hash + different bytes -> ``hash-mismatch`` (fail-closed; file discarded)
* no pinned hash                -> ``unpinned``; ``--pin`` records the observed hash
* login / CAPTCHA / HTML instead of a document -> ``gated`` (skipped, never bypassed)

Stdlib only so CI can exercise it without network (file:// URLs in tests).
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
DEFAULT_MANIFEST = HERE / "official-sources.json"
USER_AGENT = "Mozilla/5.0 (PriLearning official-source intake; contact via repository owner)"
MAGIC = {"pdf": b"%PDF", "zip": b"PK"}


def load_manifest(path: Path) -> dict:
    data = json.loads(path.read_text(encoding="utf-8"))
    if data.get("schemaVersion") != 1 or data.get("kind") != "official-sources":
        raise SystemExit(f"{path}: not an official-sources schemaVersion 1 manifest")
    return data


def cache_dir(manifest: dict, override: Path | None = None) -> Path:
    if override:
        return override
    return REPO / manifest.get("cacheDir", "tools/jee-question-department/cache/official")


def cached_path(doc: dict, root: Path) -> Path:
    return root / f"{doc['id']}.{doc.get('format', 'pdf')}"


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as fh:
        for block in iter(lambda: fh.read(1 << 20), b""):
            h.update(block)
    return h.hexdigest()


def download(url: str, timeout: int) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT, "Accept": "*/*"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:  # noqa: S310 - manifest URLs only
        return resp.read()


def classify_payload(doc: dict, payload: bytes) -> str | None:
    """Return a gate reason when the payload is not the expected document type."""
    magic = MAGIC.get(doc.get("format", "pdf"))
    if magic and not payload.startswith(magic):
        head = payload[:2048].lower()
        if b"captcha" in head or b"login" in head or b"<html" in head or b"<!doctype" in head:
            return "gated-or-html-response"
        return "unexpected-content-type"
    return None


def fetch_one(doc: dict, root: Path, *, pin: bool, refresh: bool, timeout: int, retries: int = 2) -> dict:
    dest = cached_path(doc, root)
    expected = doc.get("sha256")
    if dest.exists() and not refresh:
        observed = sha256_file(dest)
        if expected and observed != expected:
            dest.unlink()
        else:
            status = "ok" if expected else "unpinned"
            if pin and not expected:
                doc["sha256"], doc["bytes"] = observed, dest.stat().st_size
                status = "pinned"
            return {"id": doc["id"], "status": status, "sha256": observed, "cached": True}
    url = doc.get("fetchUrl") or doc["url"]
    last = None
    for attempt in range(retries + 1):
        try:
            payload = download(url, timeout)
            break
        except urllib.error.HTTPError as exc:
            if exc.code in (401, 403, 429):
                return {"id": doc["id"], "status": "gated", "reason": f"HTTP {exc.code}"}
            last = f"HTTP {exc.code}"
            if exc.code == 404:
                break
        except Exception as exc:  # network flakiness is reported, never hidden
            last = f"{type(exc).__name__}: {exc}"
        time.sleep(1.5 * (attempt + 1))
    else:
        payload = None
    if payload is None:
        return {"id": doc["id"], "status": "unreachable", "reason": last}
    gate = classify_payload(doc, payload)
    if gate:
        return {"id": doc["id"], "status": "gated", "reason": gate}
    observed = hashlib.sha256(payload).hexdigest()
    if expected and observed != expected:
        return {"id": doc["id"], "status": "hash-mismatch", "expected": expected, "observed": observed}
    dest.parent.mkdir(parents=True, exist_ok=True)
    tmp = dest.with_suffix(dest.suffix + ".part")
    tmp.write_bytes(payload)
    os.replace(tmp, dest)
    status = "ok" if expected else "unpinned"
    if pin and not expected:
        doc["sha256"], doc["bytes"] = observed, len(payload)
        status = "pinned"
    return {"id": doc["id"], "status": status, "sha256": observed, "cached": False}


def select(docs, only, exams):
    for doc in docs:
        if only and not any(doc["id"].startswith(prefix) for prefix in only):
            continue
        if exams and doc.get("exam") not in exams:
            continue
        yield doc


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--manifest", type=Path, default=DEFAULT_MANIFEST)
    ap.add_argument("--cache", type=Path, help="override cache directory (tests)")
    ap.add_argument("--only", nargs="*", default=[], help="document id prefixes")
    ap.add_argument("--exam", nargs="*", default=[], help="exam filter, e.g. jee-main cbse-xii")
    ap.add_argument("--pin", action="store_true", help="record observed sha256 for unpinned documents")
    ap.add_argument("--refresh", action="store_true", help="re-download even when cached")
    ap.add_argument("--timeout", type=int, default=120)
    ap.add_argument("--report", type=Path)
    args = ap.parse_args(argv)

    manifest = load_manifest(args.manifest)
    root = cache_dir(manifest, args.cache)
    results = [fetch_one(d, root, pin=args.pin, refresh=args.refresh, timeout=args.timeout)
               for d in select(manifest["documents"], args.only, set(args.exam))]
    if args.pin:
        args.manifest.write_text(json.dumps(manifest, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")
    summary = {}
    for r in results:
        summary[r["status"]] = summary.get(r["status"], 0) + 1
    report = {"cache": str(root), "summary": summary, "results": results}
    text = json.dumps(report, indent=2)
    if args.report:
        args.report.parent.mkdir(parents=True, exist_ok=True)
        args.report.write_text(text + "\n", encoding="utf-8")
    print(json.dumps({"cache": str(root), "summary": summary}, indent=2))
    bad = [r for r in results if r["status"] == "hash-mismatch"]
    for r in bad:
        print(f"HASH MISMATCH {r['id']}: expected {r['expected']} observed {r['observed']}", file=sys.stderr)
    return 3 if bad else 0


if __name__ == "__main__":
    raise SystemExit(main())
