#!/usr/bin/env python3
"""Review official-source drafts: crops, AI passes, the automated tier, and a human UI.

Two review tiers can approve an official row; both are recorded honestly.

* human      a named person approves in the local reviewer (``serve``), which
             records ``reviewedBy``/``reviewedAt`` with ``tier: "human"``.
* automated  ``decide`` approves a row only when ALL hold:
               (a) the answer contract equals the official key exactly — the
                   key is copied from the authority's document, never typed;
               (b) the bundled deterministic engine verifies the key under the
                   contract, and for numeric answers independently re-evaluates
                   the reviewer's own computed expression to the same value
                   (for option answers the reviewer's blind answer must agree);
               (c) a separate AI review pass — which never sees the key —
                   confirms the transcription matches the page crop, the question
                   is complete and well posed, the chapter/difficulty labels and
                   the worked steps are right;
               (d) no disagreement flag remains.
             The reviewer is recorded as
             ``automated:key+engine+ai-review/<model>/<date>``; it never names a person.

Subcommands
  render      write page-crop PNGs for rows (work/crops/<id>-s<n>.png)
  batches     write transcription / review batch files for the AI passes
  merge-transcriptions  fold AI transcriptions into draft rows (still drafts)
  decide      fold blind AI reviews, re-run the engine, apply the automated tier
  serve       local HTML reviewer for a human (approve / reject with name + date)
"""
from __future__ import annotations

import argparse
import html
import json
import subprocess
import sys
from collections import Counter, defaultdict
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[1]
sys.path.insert(0, str(HERE))

from audit import audit, load_jsonl, target_parts  # noqa: E402

WORK = HERE / "work"
MANIFEST = HERE / "source-manifest.json"
OFFICIAL = HERE / "official-sources.json"
ENGINE = HERE / "engine_check.mjs"
KEYED = {"option", "options", "numeric"}


def write_jsonl(path: Path, rows):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as fh:
        for row in rows:
            fh.write(json.dumps(row, ensure_ascii=False, separators=(",", ":")) + "\n")


def load_json_dir(directory: Path):
    out = {}
    for path in sorted(directory.glob("*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        items = data.get("items", data) if isinstance(data, dict) else data
        for item in items:
            out[item["id"]] = {**item, "_file": path.name}
    return out


def verify_pins(rows, cache: Path = HERE / "cache" / "official"):
    """Stamp each row with its document's pinned sha256 — only after re-hashing the
    cached file and finding it identical to the pin. A mismatch leaves the row unpinned."""
    import hashlib
    official = json.loads(OFFICIAL.read_text(encoding="utf-8"))
    pins = {d["id"]: d.get("sha256") for d in official["documents"]}
    seen = {}
    for row in rows:
        did = (row.get("source") or {}).get("documentId")
        if did not in seen:
            path = cache / f"{did}.pdf"
            seen[did] = hashlib.sha256(path.read_bytes()).hexdigest() if path.exists() else None
        if pins.get(did) and seen[did] == pins[did]:
            row["source"]["sha256"] = pins[did]


def hand_archive_ids():
    """Ids already served by the hand-transcribed archive (client/src/engine/pyq)."""
    import re
    out = set()
    for path in (REPO / "client" / "src" / "engine" / "pyq").glob("records-*.js"):
        for m in re.finditer(r"id:\s*'(jeeadv-\d{4}-p\d-q)(\d+)'", path.read_text(encoding="utf-8")):
            out.add(f"{m.group(1)}{int(m.group(2)):02d}")
    return out


def candidates(rows):
    """Rows worth an AI pass: keyed, engine-verified, no flags, not a document stub,
    and not already published by the hand-transcribed archive."""
    served = hand_archive_ids()
    for row in rows:
        if row["id"] in served:
            continue
        if row.get("documentOnly") or row.get("status") != "draft":
            continue
        if (row.get("officialKey") or {}).get("kind") not in KEYED:
            continue
        if (row.get("engine") or {}).get("verdict") != "verified" or row["review"].get("flags"):
            continue
        if (row.get("exam") or {}).get("track") not in ("jee-main", "jee-advanced"):
            continue
        yield row


# ── render ────────────────────────────────────────────────────────────────────

def answer_rects(page, clip):
    """Rectangles of printed answer lines inside `clip`: a line whose first word starts
    with a case-sensitive "Answer" (JAB answer documents print the key that way). Prose
    that merely contains the word "answer" is not masked."""
    import pymupdf as fitz
    out = []
    for w in page.get_text("words", clip=clip):
        if w[7] == 0 and str(w[4]).startswith(("Answer", "ANSWER")):
            out.append(fitz.Rect(clip.x0, w[1] - 3, clip.x1, w[3] + 3))
    return out


def render(rows, crops: Path, cache: Path, zoom: float = 2.2, blind: bool = False):
    import pymupdf as fitz
    crops.mkdir(parents=True, exist_ok=True)
    opened = {}
    for row in rows:
        src = row["source"]
        path = cache / f"{src['documentId']}.pdf"
        if not path.exists():
            continue
        pdf = opened.get(path) or opened.setdefault(path, fitz.open(path))
        files = []
        for n, seg in enumerate(src.get("segments") or [], 1):
            out = crops / f"{row['id']}-s{n}.png"
            if not out.exists():
                page = pdf[seg["page"] - 1]
                clip = fitz.Rect(*seg["crop"])
                pix = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom), clip=clip)
                if blind:
                    # White out every printed answer line so the reviewer cannot see the key.
                    for r in answer_rects(page, clip):
                        # a clipped pixmap keeps page coordinates (x zoom) as its origin
                        box = fitz.IRect(int(r.x0 * zoom), int(r.y0 * zoom), int(r.x1 * zoom) + 1, int(r.y1 * zoom) + 1) & pix.irect
                        if not box.is_empty:
                            pix.set_rect(box, (255, 255, 255) if pix.n < 4 else (255, 255, 255, 255))
                pix.save(out)
            files.append(str(out))
        row.setdefault("review", {})["blindCrops" if blind else "crops"] = files
    return rows


# ── batches for the AI passes ────────────────────────────────────────────────

def transcription_sha(row):
    import hashlib
    t = row.get("transcription") or {}
    core = {k: t.get(k) for k in ("prompt", "mcqOptions", "targetChapter", "difficulty", "hints", "steps")}
    return hashlib.sha256(json.dumps(core, sort_keys=True, ensure_ascii=False).encode("utf-8")).hexdigest()


def batch_items(rows, *, with_key: bool):
    for row in rows:
        key = row["officialKey"]
        item = {
            "id": row["id"],
            "exam": row["exam"]["id"], "year": row["exam"]["year"], "paper": row["exam"].get("paper"),
            "session": row["exam"].get("session"), "shift": row["exam"].get("shift"),
            "questionNumber": row["source"]["questionNumber"], "section": row["source"].get("section"),
            "answerFormat": row.get("answerType"), "optionCount": key.get("optionCount"),
            "crops": row["review"].get("crops", []) if with_key else row["review"].get("blindCrops", []),
            "textLayer": (row.get("prompt") or "")[:3000],
        }
        if with_key:
            item["officialKey"] = {k: key[k] for k in key if k in ("kind", "index", "indices", "value", "range", "letters")}
        else:  # the blind reviewer gets the transcription, never the key
            t = row.get("transcription") or {}
            item["transcription"] = {k: t.get(k) for k in ("prompt", "mcqOptions", "targetChapter", "difficulty", "hints", "steps")}
            item["transcriptionSha"] = transcription_sha(row)
        yield item


def write_batches(rows, directory: Path, size: int, *, with_key: bool):
    directory.mkdir(parents=True, exist_ok=True)
    items = list(batch_items(rows, with_key=with_key))
    n = 0
    for i in range(0, len(items), size):
        n += 1
        body = {"items": items[i:i + size]}
        if not with_key:
            body["blind"] = True  # crops have printed answer lines masked; no key in the batch
        (directory / f"batch-{n:03d}.json").write_text(json.dumps(body, ensure_ascii=False, indent=1), encoding="utf-8")
    return n, len(items)


# ── merge + decide ───────────────────────────────────────────────────────────

def merge_transcriptions(rows, transcriptions, manifest):
    parts = target_parts(manifest)
    merged = 0
    for row in rows:
        t = transcriptions.get(row["id"])
        if not t:
            continue
        row["transcription"] = {k: t.get(k) for k in ("prompt", "mcqOptions", "targetChapter", "difficulty", "hints", "steps", "engineSolve", "problems", "model", "passId")}
        row["prompt"] = t.get("prompt") or row.get("prompt")
        row["mcqOptions"] = t.get("mcqOptions")
        target = t.get("targetChapter")
        row["routing"] = {"part": parts.get(target), "targetChapter": target if target in parts else None}
        row["difficulty"] = t.get("difficulty") if t.get("difficulty") in (1, 2, 3, 4) else None
        row["hints"] = [str(h) for h in (t.get("hints") or [])][:3]
        row["steps"] = [{"h": str(s.get("h", "")), "d": str(s.get("d", ""))} for s in (t.get("steps") or []) if isinstance(s, dict)]
        key = row["officialKey"]
        # The answer contract is copied from the official key, never from a model.
        if key["kind"] == "option":
            row["answerType"], row["answer"] = "mcq", {"correctIndex": key["index"]}
        elif key["kind"] == "options":
            row["answerType"], row["answer"] = "multi_mcq", {"correctIndices": list(key["indices"])}
        elif key["kind"] == "numeric":
            answer = {"value": key["value"]}
            if isinstance(key.get("range"), list):
                answer["tol"] = round((key["range"][1] - key["range"][0]) / 2, 9) + 1e-9  # float guard, see engine_check.mjs
            row["answerType"], row["answer"] = "numeric", answer
        row["review"]["transcriptionPassId"] = t.get("passId")
        for problem in t.get("problems") or []:
            if f"transcriber:{problem}" not in row["review"]["flags"]:
                row["review"]["flags"].append(f"transcriber:{problem}")
        merged += 1
    return merged


def independent_agrees(row, rev):
    key, ans = row["officialKey"], rev.get("independentAnswer") or {}
    if key["kind"] == "option":
        return ans.get("kind") == "option" and ans.get("index") == key["index"]
    if key["kind"] == "options":
        return ans.get("kind") == "options" and sorted(ans.get("indices") or []) == sorted(key["indices"])
    return None  # numeric: decided by the deterministic engine below


def run_engine(rows):
    payload = "\n".join(json.dumps(r, ensure_ascii=False) for r in rows) + "\n"
    proc = subprocess.run(["node", str(ENGINE)], input=payload, capture_output=True, text=True, cwd=REPO, check=True)
    return [json.loads(line) for line in proc.stdout.splitlines() if line.strip()]


def decide(rows, reviews, *, model: str, date: str):
    pending = []
    for row in rows:
        rev = reviews.get(row["id"])
        if rev and (not rev.get("blind") or rev.get("answerVisible") is not False):
            rev = None  # a review made from crops that showed the printed key is not independent
        if not rev or not row.get("transcription"):
            continue
        ai = {f: rev.get(f) is True for f in ("transcriptionMatches", "complete", "wellPosed", "labelsCorrect", "stepsCorrect")}
        agrees = independent_agrees(row, rev)
        if row["officialKey"]["kind"] == "numeric":
            expr = (rev.get("independentAnswer") or {}).get("expression")
            row["engineSolve"] = expr if expr not in (None, "") else None
        ai["independentAnswerAgrees"] = agrees  # numeric resolved after the engine run
        ai["reviewerModel"] = rev.get("model") or model
        ai["reviewPassId"] = rev.get("passId")
        ai["notes"] = rev.get("notes")
        ai["independentAnswer"] = rev.get("independentAnswer")
        row["review"]["ai"] = ai
        pending.append(row)
    if pending:
        for row, verdict in zip(pending, run_engine(pending)):
            row["engine"] = {k: verdict[k] for k in verdict if k != "id"}
            ai = row["review"]["ai"]
            if row["officialKey"]["kind"] == "numeric":
                ai["independentAnswerAgrees"] = (row["engine"].get("engineSolve") or {}).get("agrees") is True
            if row["engine"].get("verdict") == "disagreement" and "engine-disagrees-with-official-key" not in row["review"]["flags"]:
                row["review"]["flags"].append("engine-disagrees-with-official-key")
            failed = [f for f in ("transcriptionMatches", "complete", "wellPosed", "labelsCorrect", "stepsCorrect", "independentAnswerAgrees") if ai.get(f) is not True]
            if failed:
                row["review"]["reasons"] = sorted(set(row["review"]["reasons"]) | {f"ai-review:{f}" for f in failed})
                continue
            if row["review"]["flags"] or not row["routing"].get("targetChapter") or row.get("difficulty") is None:
                continue
            row["status"] = "approved"
            row["review"].update({
                "tier": "automated",
                "reviewedBy": f"automated:key+engine+ai-review/{ai['reviewerModel']}/{date}",
                "reviewedAt": f"{date}T00:00:00Z",
            })
    return pending


# ── human reviewer (local HTML) ──────────────────────────────────────────────

PAGE = """<!doctype html><html lang=en><head><meta charset=utf-8><meta name=viewport content="width=device-width,initial-scale=1">
<title>Official PYQ review</title><style>
:root{--bg:#fbfaf7;--fg:#1d1d1b;--mut:#6b6a66;--line:#dedbd3;--ok:#256c3a;--bad:#9b2c2c}
@media (prefers-color-scheme:dark){:root{--bg:#171716;--fg:#ecebe7;--mut:#a3a19b;--line:#34332f}}
body{background:var(--bg);color:var(--fg);font:15px/1.5 system-ui,sans-serif;margin:0;padding:16px;max-width:980px;margin:auto}
img{max-width:100%;border:1px solid var(--line);display:block;margin:6px 0}
pre{white-space:pre-wrap;border:1px solid var(--line);padding:8px;font-size:13px}
.row{display:flex;gap:8px;flex-wrap:wrap;align-items:center}.mut{color:var(--mut)}
button{font:inherit;padding:6px 14px;border:1px solid var(--line);background:transparent;color:var(--fg);cursor:pointer}
.ok{border-color:var(--ok)}.bad{border-color:var(--bad)}input{font:inherit;padding:5px}
</style></head><body>{body}</body></html>"""


def human_page(rows, idx, reviewer):
    if not rows:
        return PAGE.replace("{body}", "<p>No drafts in this queue.</p>")
    row = rows[idx % len(rows)]
    e = html.escape
    crops = "".join(f'<img alt="source crop" src="/crop?p={e(Path(c).name)}">' for c in row["review"].get("crops", []))
    key = row.get("officialKey")
    engine = row.get("engine")
    ai = row["review"].get("ai")
    body = f"""
<p class=mut>{idx % len(rows) + 1} / {len(rows)} · {e(row['id'])} · status <b>{e(row['status'])}</b> · tier {e(str(row['review'].get('tier')))}</p>
<p>{e(row['source']['authority'])} · <a href="{e(row['source']['url'])}">{e(row['source']['documentId'])}</a> · page {row['source']['page']} · Q{row['source']['questionNumber']}</p>
{crops}
<h3>Transcription</h3><pre>{e(row.get('prompt') or '')}</pre>
<pre>{e(json.dumps(row.get('mcqOptions'), ensure_ascii=False))}</pre>
<p>Chapter <b>{e(str(row['routing'].get('targetChapter')))}</b> · difficulty <b>{e(str(row.get('difficulty')))}</b></p>
<h3>Official key</h3><pre>{e(json.dumps(key, ensure_ascii=False))}</pre>
<h3>Engine check</h3><pre>{e(json.dumps(engine, ensure_ascii=False))}</pre>
<h3>AI review</h3><pre>{e(json.dumps(ai, ensure_ascii=False))}</pre>
<h3>Worked steps</h3><pre>{e(json.dumps(row.get('steps'), ensure_ascii=False, indent=1))}</pre>
<form method=post action="/decide" class=row>
<input type=hidden name=i value="{idx}"><input name=reviewer placeholder="Your full name" value="{e(reviewer)}" required>
<input name=note placeholder="Note (optional)">
<button class=ok name=decision value=approve>Approve</button><button class=bad name=decision value=reject>Reject</button>
<a href="/?i={idx - 1}">Prev</a> <a href="/?i={idx + 1}">Next</a></form>"""
    return PAGE.replace("{body}", body)


def serve(queue: Path, port: int, crops: Path):
    rows = load_jsonl(queue)
    decisions = queue.with_name(queue.stem + ".human-decisions.jsonl")
    state = {"reviewer": ""}

    class Handler(BaseHTTPRequestHandler):
        def _send(self, body, ctype="text/html; charset=utf-8", code=200):
            data = body if isinstance(body, bytes) else body.encode("utf-8")
            self.send_response(code)
            self.send_header("Content-Type", ctype)
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def do_GET(self):
            url = urlparse(self.path)
            q = parse_qs(url.query)
            if url.path == "/crop":
                name = Path(q.get("p", [""])[0]).name
                path = crops / name
                return self._send(path.read_bytes(), "image/png") if path.exists() else self._send("missing", code=404)
            self._send(human_page(rows, int(q.get("i", ["0"])[0] or 0), state["reviewer"]))

        def do_POST(self):
            form = parse_qs(self.rfile.read(int(self.headers.get("Content-Length", 0))).decode("utf-8"))
            i = int(form.get("i", ["0"])[0]) % len(rows)
            name = (form.get("reviewer", [""])[0] or "").strip()
            decision = form.get("decision", [""])[0]
            if len(name) < 3 or name.lower().startswith(("automated", "ai", "claude", "model")):
                return self._send("A human reviewer must enter their own name.", "text/plain", 400)
            state["reviewer"] = name
            row = rows[i]
            now = datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")
            record = {"id": row["id"], "decision": decision, "reviewer": name, "at": now, "note": form.get("note", [""])[0]}
            with decisions.open("a", encoding="utf-8") as fh:
                fh.write(json.dumps(record, ensure_ascii=False) + "\n")
            if decision == "approve":
                row["status"] = "approved"
                row["review"].update({"tier": "human", "reviewedBy": name, "reviewedAt": now})
            else:
                row["status"] = "rejected"
            write_jsonl(queue, rows)
            self.send_response(303)
            self.send_header("Location", f"/?i={i + 1}")
            self.end_headers()

        def log_message(self, *args):
            pass

    print(f"Reviewer on http://127.0.0.1:{port}/ (decisions -> {decisions})")
    ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()


# ── stats ─────────────────────────────────────────────────────────────────────

def stats(rows):
    by = defaultdict(Counter)
    for row in rows:
        if row.get("documentOnly"):
            by[(row["exam"]["id"], row["exam"]["year"])]["imageOnlyDocuments"] += 1
            continue
        c = by[(row["exam"]["id"], row["exam"]["year"])]
        c["extracted"] += 1
        c["keyMatched"] += (row.get("officialKey") or {}).get("kind") in KEYED
        c["engineVerified"] += (row.get("engine") or {}).get("verdict") == "verified"
        ai = (row.get("review") or {}).get("ai")
        if ai:
            c["aiReviewed"] += 1
            c["aiReviewPassed"] += all(ai.get(f) is True for f in ("transcriptionMatches", "complete", "wellPosed", "labelsCorrect", "stepsCorrect", "independentAnswerAgrees"))
        c["published"] += row.get("status") == "approved"
        c["held"] += row.get("status") != "approved"
        c["disagreements"] += bool((row.get("review") or {}).get("flags"))
    return [{"exam": k[0], "year": k[1], **{n: int(v) for n, v in c.items()}} for k, c in sorted(by.items(), key=lambda kv: (kv[0][0], kv[0][1] or 0))]


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    sub = ap.add_subparsers(dest="cmd", required=True)
    p = sub.add_parser("render"); p.add_argument("queue", type=Path); p.add_argument("--cache", type=Path, default=HERE / "cache" / "official"); p.add_argument("--crops", type=Path); p.add_argument("--all", action="store_true"); p.add_argument("--blind", action="store_true", help="mask printed answer lines (crops for the blind reviewer)")
    p = sub.add_parser("batches"); p.add_argument("queue", type=Path); p.add_argument("--out", type=Path, required=True); p.add_argument("--size", type=int, default=8); p.add_argument("--pass", dest="which", choices=["transcribe", "review"], required=True); p.add_argument("--skip-batched", type=Path, nargs="*", default=[], help="batch dirs whose items are already queued")
    p = sub.add_parser("merge-transcriptions"); p.add_argument("queue", type=Path); p.add_argument("--dir", type=Path, required=True)
    p = sub.add_parser("decide"); p.add_argument("queue", type=Path); p.add_argument("--dir", type=Path, nargs="+", required=True); p.add_argument("--inputs", type=Path, nargs="+", required=True, help="the blind review-in batch directories"); p.add_argument("--model", required=True); p.add_argument("--date", required=True)
    p = sub.add_parser("serve"); p.add_argument("queue", type=Path); p.add_argument("--port", type=int, default=8765); p.add_argument("--crops", type=Path, default=WORK / "crops")
    p = sub.add_parser("stats"); p.add_argument("queue", type=Path, nargs="+"); p.add_argument("--out", type=Path); p.add_argument("--markdown", type=Path)
    p = sub.add_parser("publish-set"); p.add_argument("queue", type=Path); p.add_argument("--out", type=Path, required=True)
    args = ap.parse_args(argv)

    if args.cmd == "serve":
        return serve(args.queue, args.port, args.crops)
    if args.cmd == "stats":
        rows = [r for q in args.queue for r in load_jsonl(q)]
        table = stats(rows)
        if args.out:
            args.out.write_text(json.dumps(table, indent=1) + "\n", encoding="utf-8")
        if args.markdown:
            cols = ["extracted", "keyMatched", "engineVerified", "aiReviewed", "aiReviewPassed", "published", "held", "disagreements", "imageOnlyDocuments"]
            lines = ["| exam | year | " + " | ".join(cols) + " |", "|---|---|" + "---|" * len(cols)]
            totals = Counter()
            for t in table:
                lines.append(f"| {t['exam']} | {t['year'] or '—'} | " + " | ".join(str(t.get(c, 0)) for c in cols) + " |")
                totals.update({c: t.get(c, 0) for c in cols})
            lines.append("| **total** | | " + " | ".join(f"**{totals[c]}**" for c in cols) + " |")
            args.markdown.write_text("\n".join(lines) + "\n", encoding="utf-8")
        print(json.dumps(table, indent=1))
        return 0
    rows = load_jsonl(args.queue)
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    if args.cmd == "render":
        target = rows if args.all else list(candidates(rows))
        render(target, args.crops or (WORK / ("crops-blind" if args.blind else "crops")), args.cache, blind=args.blind)
        write_jsonl(args.queue, rows)
        print(json.dumps({"rendered": len(target)}))
    elif args.cmd == "batches":
        if args.which == "transcribe":
            target = [r for r in candidates(rows) if not r.get("transcription")]
        else:
            target = [r for r in rows if r.get("transcription") and r["status"] == "draft" and not r["review"].get("ai")
                      and not r["review"].get("flags") and r["review"].get("blindCrops")]
        queued = {item["id"] for d in args.skip_batched for p in d.glob("*.json") for item in json.loads(p.read_text(encoding="utf-8"))["items"]}
        target = [r for r in target if r["id"] not in queued]
        print(json.dumps(dict(zip(("batches", "items"), write_batches(target, args.out, args.size, with_key=args.which == "transcribe")))))
    elif args.cmd == "merge-transcriptions":
        n = merge_transcriptions(rows, load_json_dir(args.dir), manifest)
        write_jsonl(args.queue, rows)
        print(json.dumps({"merged": n}))
    elif args.cmd == "decide":
        blind_ids = set()
        current = {r["id"]: transcription_sha(r) for r in rows if r.get("transcription")}
        for path in (p for d in args.inputs for p in d.glob("*.json")):
            data = json.loads(path.read_text(encoding="utf-8"))
            if data.get("blind") is True:
                # a review counts only for the exact transcription it was shown
                blind_ids.update(item["id"] for item in data["items"]
                                 if item.get("transcriptionSha") and item["transcriptionSha"] == current.get(item["id"]))
        reviews = {}
        for d in args.dir:
            reviews.update(load_json_dir(d))
        for rid, r in reviews.items():
            r["blind"] = rid in blind_ids  # set by code from the inputs, never by the reviewer
        done = decide(rows, reviews, model=args.model, date=args.date)
        write_jsonl(args.queue, rows)
        print(json.dumps({"reviewed": len(done), "approved": sum(r["status"] == "approved" for r in done)}))
    elif args.cmd == "stats":
        table = stats(rows)
        text = json.dumps(table, indent=1)
        if args.out:
            args.out.write_text(text + "\n", encoding="utf-8")
        print(text)
    elif args.cmd == "publish-set":
        verify_pins(rows)
        write_jsonl(args.queue, rows)
        served = hand_archive_ids()
        approved = [r for r in rows if r.get("status") == "approved" and r["id"] not in served]
        _, errors, _ = audit(approved, manifest, publish=True)
        bad = {e.split(":", 1)[0] for e in errors}
        keep = [r for r in approved if r["id"] not in bad]
        write_jsonl(args.out, keep)
        print(json.dumps({"approved": len(approved), "passPublishAudit": len(keep), "auditErrors": errors[:50]}, indent=1))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
