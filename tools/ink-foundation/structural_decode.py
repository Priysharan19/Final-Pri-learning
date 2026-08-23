"""Deterministic graph decoding for Pri Ink Structural V4.

The neural model predicts evidence; this module turns that evidence into an
inspectable hypothesis.  It deliberately keeps the graph and confidence details
so Pri Learning can abstain on uncertain ink rather than hiding ambiguity behind
an apparently authoritative string.

This is a research decoder, not yet the release parser.  It supports the core
secondary-school relations needed to benchmark the V4 representation:
RIGHT, SUPERSCRIPT, SUBSCRIPT, NUMERATOR, DENOMINATOR and INSIDE_ROOT.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Iterable

import torch
import torch.nn.functional as F

from data import ID_TO_TOKEN, SPECIAL
from structural import RELATIONS, RELATION_TO_ID


@dataclass(frozen=True)
class GlyphHypothesis:
    id: int
    strokes: tuple[int, ...]
    symbol: str
    symbol_confidence: float
    cx: float
    cy: float
    width: float
    height: float


@dataclass(frozen=True)
class RelationHypothesis:
    source: int
    target: int
    kind: str
    confidence: float


@dataclass
class StructuralHypothesis:
    glyphs: list[GlyphHypothesis]
    relations: list[RelationHypothesis]
    canonical: str
    confidence: float
    ambiguous: bool
    warnings: list[str] = field(default_factory=list)


class _UnionFind:
    def __init__(self, n: int):
        self.parent = list(range(n))

    def find(self, x: int) -> int:
        while self.parent[x] != x:
            self.parent[x] = self.parent[self.parent[x]]
            x = self.parent[x]
        return x

    def union(self, a: int, b: int):
        ra, rb = self.find(a), self.find(b)
        if ra != rb:
            self.parent[rb] = ra


def _components(group_logits: torch.Tensor, valid: torch.Tensor,
                threshold: float) -> list[tuple[int, ...]]:
    """Recover glyph components from symmetric same-glyph evidence."""
    active = valid.nonzero(as_tuple=False).flatten().tolist()
    uf = _UnionFind(group_logits.shape[0])
    prob = group_logits.sigmoid()
    for ai, i in enumerate(active):
        for j in active[ai + 1:]:
            # Group membership is symmetric even though the pair head is ordered.
            score = 0.5 * (float(prob[i, j]) + float(prob[j, i]))
            if score >= threshold:
                uf.union(i, j)
    buckets: dict[int, list[int]] = {}
    for i in active:
        buckets.setdefault(uf.find(i), []).append(i)
    return [tuple(v) for _, v in sorted(buckets.items(), key=lambda kv: min(kv[1]))]


def _safe_symbol(logits: torch.Tensor) -> tuple[str, float]:
    probs = F.softmax(logits, dim=-1)
    order = probs.argsort(descending=True)
    for idx in order.tolist():
        token = ID_TO_TOKEN.get(int(idx), "<unk>")
        if token not in SPECIAL:
            return token, float(probs[idx])
    return "<unk>", 0.0


def _glyphs(symbol_logits: torch.Tensor, geometry: torch.Tensor,
            components: list[tuple[int, ...]]) -> list[GlyphHypothesis]:
    out: list[GlyphHypothesis] = []
    log_probs = F.log_softmax(symbol_logits, dim=-1)
    for gid, strokes in enumerate(components):
        idx = torch.tensor(strokes, device=symbol_logits.device, dtype=torch.long)
        # Mean log-probability prevents a many-stroke symbol from being rewarded
        # merely because it contains more physical traces.
        pooled = log_probs.index_select(0, idx).mean(dim=0)
        symbol, conf = _safe_symbol(pooled)
        g = geometry.index_select(0, idx)
        weights = g[:, 2].clamp_min(1e-3) * g[:, 3].clamp_min(1e-3)
        weights = weights / weights.sum().clamp_min(1e-6)
        cx = float((g[:, 0] * weights).sum())
        cy = float((g[:, 1] * weights).sum())
        left = float((g[:, 0] - g[:, 2] * 0.5).min())
        right = float((g[:, 0] + g[:, 2] * 0.5).max())
        top = float((g[:, 1] - g[:, 3] * 0.5).min())
        bottom = float((g[:, 1] + g[:, 3] * 0.5).max())
        out.append(GlyphHypothesis(
            id=gid,
            strokes=strokes,
            symbol=symbol,
            symbol_confidence=conf,
            cx=cx,
            cy=cy,
            width=max(1e-4, right - left),
            height=max(1e-4, bottom - top),
        ))
    return out


def _relations(relation_logits: torch.Tensor, components: list[tuple[int, ...]],
               min_confidence: float) -> list[RelationHypothesis]:
    out: list[RelationHypothesis] = []
    for si, src in enumerate(components):
        for ti, dst in enumerate(components):
            if si == ti:
                continue
            # Training stores relation supervision on group roots.  Decode from
            # the same representative trace until the group-level head replaces it.
            logits = relation_logits[src[0], dst[0]]
            probs = F.softmax(logits, dim=-1)
            rid = int(probs.argmax())
            kind = RELATIONS[rid]
            conf = float(probs[rid])
            if kind != "NONE" and conf >= min_confidence:
                out.append(RelationHypothesis(si, ti, kind, conf))
    return out


def _best_relation(relations: Iterable[RelationHypothesis], source: int, kind: str):
    candidates = [r for r in relations if r.source == source and r.kind == kind]
    return max(candidates, key=lambda r: r.confidence, default=None)


def _serialize_graph(glyphs: list[GlyphHypothesis], relations: list[RelationHypothesis]):
    """Serialize a conservative subset of the graph to Pri canonical maths text."""
    if not glyphs:
        return "", ["no glyphs"]

    warnings: list[str] = []
    attached: set[int] = set()
    supers: dict[int, int] = {}
    subs: dict[int, int] = {}
    inside_root: dict[int, int] = {}

    # Keep only the strongest competing attachment of each type per source.
    for g in glyphs:
        rel = _best_relation(relations, g.id, "SUPERSCRIPT")
        if rel:
            supers[g.id] = rel.target; attached.add(rel.target)
        rel = _best_relation(relations, g.id, "SUBSCRIPT")
        if rel:
            subs[g.id] = rel.target; attached.add(rel.target)
        rel = _best_relation(relations, g.id, "INSIDE_ROOT")
        if rel:
            inside_root[g.id] = rel.target; attached.add(rel.target)

    # A fraction node may be a slash token or a horizontal bar that the symbol
    # head currently calls '-'.  The relation evidence is what makes it structural.
    fraction_parts: dict[int, tuple[int, int]] = {}
    for g in glyphs:
        num = _best_relation(relations, g.id, "NUMERATOR")
        den = _best_relation(relations, g.id, "DENOMINATOR")
        if num and den and num.target != den.target:
            fraction_parts[g.id] = (num.target, den.target)
            attached.update((num.target, den.target))

    by_id = {g.id: g for g in glyphs}
    visiting: set[int] = set()

    def render(gid: int) -> str:
        if gid in visiting:
            warnings.append(f"cycle at glyph {gid}")
            return by_id[gid].symbol
        visiting.add(gid)
        g = by_id[gid]

        if gid in fraction_parts:
            n, d = fraction_parts[gid]
            text = f"({render(n)})/({render(d)})"
        elif gid in inside_root or g.symbol == "sqrt":
            child = inside_root.get(gid)
            text = f"sqrt({render(child)})" if child is not None else "sqrt"
        else:
            text = g.symbol

        if gid in supers:
            text += f"^({render(supers[gid])})"
        if gid in subs:
            sub = render(subs[gid])
            text += f"_{sub}" if len(sub) == 1 else f"_({sub})"
        visiting.remove(gid)
        return text

    # RIGHT relations provide sequence evidence, but geometry is the safe
    # deterministic fallback while relation calibration is still immature.
    roots = [g for g in glyphs if g.id not in attached]
    roots.sort(key=lambda g: (g.cx, g.cy))
    text = "".join(render(g.id) for g in roots)
    return text, warnings


def decode_structural_output(outputs: dict, stroke_geometry: torch.Tensor,
                             stroke_valid: torch.Tensor, group_threshold: float = 0.65,
                             relation_threshold: float = 0.60,
                             ambiguity_threshold: float = 0.80) -> StructuralHypothesis:
    """Decode one unbatched V4 output dictionary into an inspectable hypothesis."""
    symbol_logits = outputs["symbol_logits"]
    group_logits = outputs["group_logits"]
    relation_logits = outputs["relation_logits"]
    if symbol_logits.ndim == 3:
        if symbol_logits.shape[0] != 1:
            raise ValueError("decode_structural_output expects one example")
        symbol_logits = symbol_logits[0]
        group_logits = group_logits[0]
        relation_logits = relation_logits[0]
    if stroke_geometry.ndim == 3:
        stroke_geometry = stroke_geometry[0]
    if stroke_valid.ndim == 2:
        stroke_valid = stroke_valid[0]

    comps = _components(group_logits, stroke_valid.bool(), group_threshold)
    glyphs = _glyphs(symbol_logits, stroke_geometry, comps)
    relations = _relations(relation_logits, comps, relation_threshold)
    canonical, warnings = _serialize_graph(glyphs, relations)

    evidence = [g.symbol_confidence for g in glyphs]
    evidence.extend(r.confidence for r in relations)
    confidence = min(evidence) if evidence else 0.0
    ambiguous = confidence < ambiguity_threshold or bool(warnings)
    return StructuralHypothesis(
        glyphs=glyphs,
        relations=relations,
        canonical=canonical,
        confidence=confidence,
        ambiguous=ambiguous,
        warnings=warnings,
    )
