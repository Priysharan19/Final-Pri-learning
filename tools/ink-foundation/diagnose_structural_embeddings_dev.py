#!/usr/bin/env python3
"""Diagnose Pri Ink V4 dedicated glyph embeddings on the frozen dev split.

Development diagnostic only; never writer-disjoint or production evidence. It
compares the trained group-level classifier with nearest prototypes built from
the same dedicated local glyph embeddings on the 38 P0001 training expressions.
"""
from __future__ import annotations

import argparse
from collections import Counter, defaultdict
from pathlib import Path

import torch
import torch.nn.functional as F
from torch.utils.data import DataLoader

from data import ID_TO_TOKEN, SPECIAL, TOKEN_TO_ID
from dev_split import make_same_writer_dev_split
from structural import PriInkStructuralV4, StructuralConfig
from structural_data import StructuralInkDataset, corpus_files, load_structural_examples


def _best_real_symbol(logits: torch.Tensor) -> str:
    probs = F.softmax(logits, dim=-1)
    for idx in probs.argsort(descending=True).tolist():
        token = ID_TO_TOKEN.get(int(idx), "<unk>")
        if token not in SPECIAL:
            return token
    return "<unk>"


def _group_vector(glyph_embeddings: torch.Tensor, strokes: list[int]) -> torch.Tensor:
    idx = torch.tensor(strokes, device=glyph_embeddings.device, dtype=torch.long)
    selected = glyph_embeddings.index_select(0, idx)
    count = glyph_embeddings.new_tensor([min(len(strokes), 6) / 6.0])
    vec = torch.cat([selected.mean(dim=0), selected.max(dim=0).values, count], dim=0)
    return F.normalize(vec.float(), dim=0)


def _collect(model, dataset, rows, device):
    loader = DataLoader(dataset, batch_size=1, shuffle=False, num_workers=0)
    collected = []
    with torch.inference_mode():
        for batch, row in zip(loader, rows):
            outputs = model(
                batch["stroke_points"].to(device), batch["stroke_point_valid"].to(device),
                batch["stroke_valid"].to(device), batch["stroke_geometry"].to(device), batch["raster"].to(device),
            )
            embeddings = outputs["glyph_stroke_embeddings"][0]
            groups = []
            for group in row.structure.get("groups") or []:
                strokes = [int(i) for i in (group.get("strokes") or [])]
                if strokes: groups.append((group, strokes))
            logits = model.classify_glyph_components(embeddings, [strokes for _, strokes in groups]) if groups else None
            for gi, (group, strokes) in enumerate(groups):
                collected.append({
                    "target": str(group.get("symbol", "")), "strokes": strokes,
                    "vector": _group_vector(embeddings, strokes).cpu(),
                    "neural": _best_real_symbol(logits[gi]), "expression": row.target,
                })
    return collected


def main():
    p = argparse.ArgumentParser()
    p.add_argument("checkpoint", nargs="?", default="tools/ink-foundation/runs/pri-ink-structural-v4-dev.pt")
    p.add_argument("--corpus", default="client/test/ink-corpus-structural")
    p.add_argument("--device", default="auto")
    args = p.parse_args()

    ckpt_path = Path(args.checkpoint); ckpt = torch.load(ckpt_path, map_location="cpu", weights_only=False)
    if int(ckpt.get("architecture_version", 0)) != 4 or ckpt.get("stage") != "structural-research-dev":
        raise SystemExit("expected a V4 structural-research-dev checkpoint")
    if ckpt.get("production_ready") is not False:
        raise SystemExit("development checkpoint must remain production_ready=false")
    if (ckpt.get("vocab") or []) != list(TOKEN_TO_ID.keys()):
        raise SystemExit("checkpoint vocabulary does not match runtime vocabulary")

    split_meta = ckpt.get("dev_split") or {}
    examples = load_structural_examples(corpus_files(args.corpus))
    examples, recreated = make_same_writer_dev_split(
        examples, seed=int(split_meta.get("seed", 20260824)), fraction=float(split_meta.get("fraction", 0.20)),
    )
    for key in ("writer", "trainSamples", "validationSamples"):
        if recreated.get(key) != split_meta.get(key): raise SystemExit(f"frozen dev split mismatch for {key}")

    train_rows = [x for x in examples if x.split == "train"]; val_rows = [x for x in examples if x.split == "validation"]
    cfg = StructuralConfig(**ckpt["config"])
    train_ds = StructuralInkDataset(examples, "train", cfg); val_ds = StructuralInkDataset(examples, "validation", cfg)
    if args.device == "auto":
        device = torch.device("cuda" if torch.cuda.is_available() else "mps" if torch.backends.mps.is_available() else "cpu")
    else: device = torch.device(args.device)
    model = PriInkStructuralV4(len(TOKEN_TO_ID), cfg); model.load_state_dict(ckpt["model"], strict=True); model.to(device).eval()

    train = _collect(model, train_ds, train_rows, device); validation = _collect(model, val_ds, val_rows, device)
    by_symbol: dict[str, list[torch.Tensor]] = defaultdict(list)
    for item in train: by_symbol[item["target"]].append(item["vector"])
    prototypes = {symbol: F.normalize(torch.stack(vectors).mean(dim=0), dim=0) for symbol, vectors in by_symbol.items()}
    support = Counter(item["target"] for item in train); labels = sorted(prototypes)
    proto_matrix = torch.stack([prototypes[label] for label in labels]) if labels else None

    neural_ok = prototype_ok = prototype_n = unsupported = 0; rows = []
    for item in validation:
        target = item["target"]; neural_ok += int(item["neural"] == target)
        proto_pred = "<unsupported>"; proto_score = float("nan")
        if target in prototypes and proto_matrix is not None:
            scores = proto_matrix @ item["vector"]; best = int(scores.argmax())
            proto_pred = labels[best]; proto_score = float(scores[best]); prototype_ok += int(proto_pred == target); prototype_n += 1
        else: unsupported += 1
        rows.append((target, item["neural"], proto_pred, proto_score, item["expression"], support[target]))

    total = len(validation)
    print("\nPri Ink Structural V4 — P0001 GLYPH EMBEDDING DIAGNOSTIC\n")
    print("same frozen writer holdout · diagnostic only · never production evidence")
    print(f"train glyphs: {len(train)} across {len(prototypes)} supported symbols")
    print(f"validation glyphs: {total}")
    print(f"neural oracle-group accuracy: {100*neural_ok/max(1,total):.2f}% ({neural_ok}/{total})")
    print(f"prototype accuracy on real-train-supported validation glyphs: {100*prototype_ok/max(1,prototype_n):.2f}% ({prototype_ok}/{prototype_n})")
    print(f"prototype support coverage: {100*prototype_n/max(1,total):.2f}% ({prototype_n}/{total}); unsupported glyphs={unsupported}")
    print(f"unsupported validation symbols: {recreated.get('unsupportedRealTrainSymbols', [])}")
    print("\nPer-glyph diagnostic:")
    for target, neural, proto, score, expression, count in rows:
        score_text = "n/a" if proto == "<unsupported>" else f"{score:.3f}"; marker = "OK" if proto == target else "--"
        print(f"  {marker} target={target!r:<8} neural={neural!r:<8} prototype={proto!r:<14} sim={score_text:<6} real_train_examples={count:<2} expr={expression!r}")
    print("\nInterpretation:")
    if prototype_n and prototype_ok / prototype_n >= 0.80:
        print("  dedicated glyph embeddings are strong; prioritise writer adaptation and grouping")
    elif prototype_n and prototype_ok / prototype_n >= 0.60:
        print("  local glyph representation is useful but still needs discrimination improvements")
    else:
        print("  dedicated glyph representation remains weak; do not tune the decoder yet")
    print("production ready: false")


if __name__ == "__main__":
    main()
