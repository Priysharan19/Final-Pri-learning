#!/usr/bin/env python3
"""Diagnose symbol-aware glyph partitioning on the frozen P0001 dev holdout.

No weights are trained and nothing is promoted. The diagnostic enumerates
contiguous draw-order partitions (up to a small maximum glyph stroke count) and
scores each partition with both temperature-calibrated pairwise grouping evidence
and the V4 group-level glyph classifier. It also reports leave-one-expression-out
parameter transfer so an in-sample parameter sweep is not mistaken for evidence.
"""
from __future__ import annotations

import argparse
import math
from dataclasses import dataclass
from pathlib import Path

import torch
import torch.nn.functional as F
from torch.utils.data import DataLoader

from data import ID_TO_TOKEN, SPECIAL, TOKEN_TO_ID
from dev_split import make_same_writer_dev_split
from evaluate_structural import edit_distance
from structural import PriInkStructuralV4, StructuralConfig
from structural_data import StructuralInkDataset, corpus_files, load_structural_examples
from structural_decode import _build_ast, _glyphs, _relations


TEMPERATURES = (1.0, 1.5, 2.0, 3.0, 4.0, 6.0)
SYMBOL_WEIGHTS = (0.25, 0.5, 1.0, 1.5, 2.0, 3.0, 4.0, 6.0, 8.0)


@dataclass
class CandidateResult:
    partition: tuple[tuple[int, ...], ...]
    canonical: str
    symbols: tuple[str, ...]
    pair_score: float
    symbol_score: float
    joint_score: float
    exact: int
    edit: int


@dataclass
class SampleCache:
    number: int
    target: str
    truth: tuple[tuple[int, ...], ...]
    active: tuple[int, ...]
    geometry: torch.Tensor
    outputs: dict
    candidates: list[tuple[tuple[int, ...], ...]]
    component_cache: dict[tuple[int, ...], tuple[torch.Tensor, str, float]]


def _partition(groups) -> tuple[tuple[int, ...], ...]:
    return tuple(tuple(sorted(int(i) for i in group)) for group in groups)


def _truth_partition(structure: dict) -> tuple[tuple[int, ...], ...]:
    groups = [g.get("strokes") or [] for g in (structure.get("groups") or [])]
    return _partition(groups)


def _is_contiguous_partition(truth: tuple[tuple[int, ...], ...], active: tuple[int, ...]) -> bool:
    position = {stroke: i for i, stroke in enumerate(active)}
    for group in truth:
        pos = sorted(position[i] for i in group)
        if pos != list(range(pos[0], pos[-1] + 1)):
            return False
    ordered = sorted(truth, key=lambda g: position[g[0]])
    flattened = [i for group in ordered for i in group]
    return flattened == list(active)


def _segmentations(active: tuple[int, ...], max_group_size: int):
    n = len(active)
    out = []

    def rec(start: int, groups: list[tuple[int, ...]]):
        if start == n:
            out.append(tuple(groups))
            return
        for size in range(1, min(max_group_size, n - start) + 1):
            groups.append(tuple(active[start:start + size]))
            rec(start + size, groups)
            groups.pop()

    rec(0, [])
    return out


def _best_real_symbol(logits: torch.Tensor) -> tuple[str, float]:
    probs = F.softmax(logits, dim=-1)
    for idx in probs.argsort(descending=True).tolist():
        token = ID_TO_TOKEN.get(int(idx), "<unk>")
        if token not in SPECIAL:
            return token, float(probs[idx])
    return "<unk>", 1e-8


def _component_membership(partition, active):
    membership = {}
    for gi, component in enumerate(partition):
        for stroke in component:
            membership[stroke] = gi
    return membership


def _pair_score(group_logits: torch.Tensor, active: tuple[int, ...], partition, temperature: float) -> float:
    membership = _component_membership(partition, active)
    total = 0.0
    count = 0
    for ai, i in enumerate(active):
        for j in active[ai + 1:]:
            raw = 0.5 * (group_logits[i, j] + group_logits[j, i])
            calibrated = torch.sigmoid(raw / temperature).clamp(1e-6, 1 - 1e-6)
            same = membership[i] == membership[j]
            total += float(torch.log(calibrated if same else 1.0 - calibrated))
            count += 1
    return total / max(1, count)


def _decode_partition(model, cache: SampleCache, partition, relation_threshold: float):
    embeddings = cache.outputs["glyph_stroke_embeddings"][0]
    symbol_logits = cache.outputs["symbol_logits"][0]
    relation_logits = cache.outputs["relation_logits"][0]
    component_logits = torch.stack([cache.component_cache[c][0] for c in partition])
    glyphs = _glyphs(symbol_logits, cache.geometry, list(partition), component_logits)
    relations, _ = _relations(relation_logits, list(partition), relation_threshold)
    ast, _ = _build_ast(glyphs, relations)
    return ast.canonical(), tuple(g.symbol for g in glyphs)


def _score_candidate(model, cache: SampleCache, partition, temperature: float,
                     symbol_weight: float, relation_threshold: float) -> CandidateResult:
    pair = _pair_score(cache.outputs["group_logits"][0], cache.active, partition, temperature)
    symbol_logs = [math.log(max(1e-8, cache.component_cache[c][2])) for c in partition]
    symbol = sum(symbol_logs) / max(1, len(symbol_logs))
    joint = pair + symbol_weight * symbol
    canonical, symbols = _decode_partition(model, cache, partition, relation_threshold)
    return CandidateResult(
        partition=partition,
        canonical=canonical,
        symbols=symbols,
        pair_score=pair,
        symbol_score=symbol,
        joint_score=joint,
        exact=int(canonical == cache.target),
        edit=edit_distance(canonical, cache.target),
    )


def _best_for(model, cache, temperature, symbol_weight, relation_threshold):
    best = None
    for partition in cache.candidates:
        row = _score_candidate(model, cache, partition, temperature, symbol_weight, relation_threshold)
        tie = (row.joint_score, row.symbol_score, row.pair_score, -len(row.partition))
        if best is None or tie > best[0]:
            best = (tie, row)
    return best[1]


def _aggregate(rows, caches):
    exact = sum(r.exact for r in rows)
    edits = sum(r.edit for r in rows)
    chars = sum(max(1, len(c.target)) for c in caches)
    partition = sum(r.partition == c.truth for r, c in zip(rows, caches))
    glyph_count = sum(len(r.partition) == len(c.truth) for r, c in zip(rows, caches))
    return {
        "exact": exact / max(1, len(rows)),
        "cer": edits / max(1, chars),
        "partition": partition / max(1, len(rows)),
        "glyph_count": glyph_count / max(1, len(rows)),
    }


def _rank(metrics):
    # Exact expression is primary; then true partition recovery; then CER.
    return (metrics["exact"], metrics["partition"], -metrics["cer"], metrics["glyph_count"])


def main():
    p = argparse.ArgumentParser()
    p.add_argument("checkpoint", nargs="?", default="tools/ink-foundation/runs/pri-ink-structural-v4-dev.pt")
    p.add_argument("--corpus", default="client/test/ink-corpus-structural")
    p.add_argument("--device", default="auto")
    p.add_argument("--max-group-size", type=int, default=4)
    p.add_argument("--relation-threshold", type=float, default=0.60)
    args = p.parse_args()

    checkpoint = Path(args.checkpoint)
    ckpt = torch.load(checkpoint, map_location="cpu", weights_only=False)
    if int(ckpt.get("architecture_version", 0)) != 4 or ckpt.get("stage") != "structural-research-dev":
        raise SystemExit("expected a structural-research-dev V4 checkpoint")
    if ckpt.get("production_ready") is not False:
        raise SystemExit("dev checkpoint must remain production_ready=false")
    if (ckpt.get("vocab") or []) != list(TOKEN_TO_ID.keys()):
        raise SystemExit("checkpoint vocabulary mismatch")

    split_meta = ckpt.get("dev_split") or {}
    examples = load_structural_examples(corpus_files(args.corpus))
    examples, recreated = make_same_writer_dev_split(
        examples, seed=int(split_meta["seed"]), fraction=float(split_meta["fraction"])
    )
    for key in ("writer", "trainSamples", "validationSamples"):
        if recreated.get(key) != split_meta.get(key):
            raise SystemExit(f"frozen dev split mismatch for {key}")

    validation_rows = [x for x in examples if x.split == "validation"]
    cfg = StructuralConfig(**ckpt["config"])
    dataset = StructuralInkDataset(examples, "validation", cfg)
    loader = DataLoader(dataset, batch_size=1, shuffle=False, num_workers=0)

    if args.device == "auto":
        device = torch.device("cuda" if torch.cuda.is_available() else "mps" if torch.backends.mps.is_available() else "cpu")
    else:
        device = torch.device(args.device)

    model = PriInkStructuralV4(len(TOKEN_TO_ID), cfg)
    model.load_state_dict(ckpt["model"], strict=True)
    model.to(device).eval()

    caches: list[SampleCache] = []
    with torch.inference_mode():
        for number, (batch, row) in enumerate(zip(loader, validation_rows), 1):
            outputs = model(
                batch["stroke_points"].to(device),
                batch["stroke_point_valid"].to(device),
                batch["stroke_valid"].to(device),
                batch["stroke_geometry"].to(device),
                batch["raster"].to(device),
            )
            active = tuple(batch["stroke_valid"][0].nonzero(as_tuple=False).flatten().tolist())
            candidates = _segmentations(active, args.max_group_size)
            embeddings = outputs["glyph_stroke_embeddings"][0]
            all_components = sorted({component for partition in candidates for component in partition})
            component_cache = {}
            for component in all_components:
                logits = model.classify_glyph_components(embeddings, [component])[0]
                token, confidence = _best_real_symbol(logits)
                component_cache[component] = (logits, token, confidence)
            caches.append(SampleCache(
                number=number,
                target=row.target,
                truth=_truth_partition(row.structure),
                active=active,
                geometry=batch["stroke_geometry"][0].to(device),
                outputs=outputs,
                candidates=candidates,
                component_cache=component_cache,
            ))

    print("\nPri Ink Structural V4 — SYMBOL-AWARE JOINT GROUPING DIAGNOSTIC\n")
    print("same frozen writer holdout · no training · parameter sweep is diagnostic only")
    print(f"writer: {recreated['writer']} · samples: {len(caches)} · max group size: {args.max_group_size}")
    noncontiguous = [c.number for c in caches if not _is_contiguous_partition(c.truth, c.active)]
    print(f"truth partitions compatible with contiguous search: {len(caches)-len(noncontiguous)}/{len(caches)}")
    if noncontiguous:
        print(f"non-contiguous truth samples (cannot be solved by this search): {noncontiguous}")

    table = {}
    best_key = None
    best_rows = None
    best_metrics = None
    for temperature in TEMPERATURES:
        for weight in SYMBOL_WEIGHTS:
            rows = [_best_for(model, c, temperature, weight, args.relation_threshold) for c in caches]
            metrics = _aggregate(rows, caches)
            table[(temperature, weight)] = (rows, metrics)
            if best_metrics is None or _rank(metrics) > _rank(best_metrics):
                best_key = (temperature, weight)
                best_rows = rows
                best_metrics = metrics

    print("\nJoint parameter sweep (best rows by exact/partition/CER):")
    ranked = sorted(table.items(), key=lambda kv: _rank(kv[1][1]), reverse=True)[:10]
    print("  temp  sym_w  exact_expr      CER   partition_exact  glyph_count_exact")
    for (temperature, weight), (_, metrics) in ranked:
        print(
            f"  {temperature:4.1f}  {weight:5.2f}     {100*metrics['exact']:6.2f}% "
            f" {100*metrics['cer']:6.2f}%       {100*metrics['partition']:6.2f}% "
            f"          {100*metrics['glyph_count']:6.2f}%"
        )

    temperature, weight = best_key
    print(
        f"\nbest in-sample diagnostic: temp={temperature:.1f} symbol_weight={weight:.2f} · "
        f"exact={100*best_metrics['exact']:.2f}% · CER={100*best_metrics['cer']:.2f}% · "
        f"partition={100*best_metrics['partition']:.2f}%"
    )

    print("\nPer-sample result at best in-sample parameters:")
    for cache, result in zip(caches, best_rows):
        marker = "OK" if result.partition == cache.truth else "--"
        print(
            f"  {marker} #{cache.number} target={cache.target!r} pred={result.canonical!r} "
            f"truth={cache.truth} pred_groups={result.partition} symbols={result.symbols} "
            f"pair={result.pair_score:.3f} sym={result.symbol_score:.3f}"
        )

    # Leave-one-expression-out parameter transfer: select parameters on eight
    # samples and apply them untouched to the ninth. This is still same-writer
    # development evidence, but exposes a parameter choice that only memorises
    # this nine-sample sweep.
    loo_rows = []
    chosen = []
    for held in range(len(caches)):
        train_caches = [c for i, c in enumerate(caches) if i != held]
        selected_key = None
        selected_metrics = None
        for key, (rows, _) in table.items():
            subset_rows = [r for i, r in enumerate(rows) if i != held]
            metrics = _aggregate(subset_rows, train_caches)
            if selected_metrics is None or _rank(metrics) > _rank(selected_metrics):
                selected_key = key
                selected_metrics = metrics
        row = table[selected_key][0][held]
        loo_rows.append(row)
        chosen.append(selected_key)
    loo = _aggregate(loo_rows, caches)
    print(
        "\nleave-one-expression-out parameter transfer: "
        f"exact={100*loo['exact']:.2f}% · CER={100*loo['cer']:.2f}% · "
        f"partition={100*loo['partition']:.2f}% · glyph_count={100*loo['glyph_count']:.2f}%"
    )
    print("chosen (temperature, symbol_weight) per held-out sample: " + ", ".join(str(x) for x in chosen))

    print("\nInterpretation:")
    if best_metrics["partition"] >= 0.85 and loo["partition"] >= 0.70:
        print("  group-level symbol evidence repairs most pairwise boundary errors; promote a joint decoder experiment next")
    elif best_metrics["partition"] > 0.66:
        print("  joint evidence helps, but partitioning is not yet stable enough; strengthen the grouping model/cluster objective")
    else:
        print("  symbol-aware contiguous partitioning is insufficient; the grouping representation itself needs retraining")
    print("production ready: false")


if __name__ == "__main__":
    main()
