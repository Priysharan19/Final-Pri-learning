"""Deterministic graph/AST decoding for Pri Ink Structural V4.

The neural model predicts evidence; this module turns that evidence into an
inspectable hypothesis. It deliberately keeps trace grouping, relation evidence,
an AST and calibrated decision confidence so Pri Learning can abstain on
uncertain ink rather than hiding ambiguity behind an authoritative string.

This remains a research decoder. It supports the core secondary-school spatial
relations needed to benchmark the V4 representation and supports multi-glyph
fractions, radicals, superscripts and subscripts.
"""
from __future__ import annotations

from dataclasses import dataclass, field

import torch
import torch.nn.functional as F

from data import ID_TO_TOKEN, SPECIAL
from structural import RELATIONS


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


@dataclass(frozen=True)
class MathNode:
    """Minimal inspectable AST used by the research structural decoder."""
    kind: str
    value: str | None = None
    children: tuple["MathNode", ...] = ()

    def canonical(self) -> str:
        if self.kind == "symbol":
            return self.value or ""
        if self.kind == "sequence":
            return "".join(child.canonical() for child in self.children)
        if self.kind == "fraction":
            num, den = self.children
            return f"({num.canonical()})/({den.canonical()})"
        if self.kind == "sqrt":
            return f"sqrt({self.children[0].canonical()})"
        if self.kind == "superscript":
            base, exponent = self.children
            return f"{base.canonical()}^({exponent.canonical()})"
        if self.kind == "subscript":
            base, sub = self.children
            text = sub.canonical()
            suffix = f"_{text}" if len(text) == 1 else f"_({text})"
            return base.canonical() + suffix
        if self.kind == "scripts":
            base, exponent, sub = self.children
            sub_text = sub.canonical()
            sub_suffix = f"_{sub_text}" if len(sub_text) == 1 else f"_({sub_text})"
            return f"{base.canonical()}^({exponent.canonical()}){sub_suffix}"
        return self.value or ""


@dataclass
class StructuralHypothesis:
    glyphs: list[GlyphHypothesis]
    relations: list[RelationHypothesis]
    ast: MathNode
    canonical: str
    confidence: float
    symbol_confidence: float
    grouping_confidence: float
    relation_confidence: float
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
                threshold: float) -> tuple[list[tuple[int, ...]], float]:
    """Recover glyph components and confidence in all pairwise group decisions."""
    active = valid.nonzero(as_tuple=False).flatten().tolist()
    uf = _UnionFind(group_logits.shape[0])
    prob = group_logits.sigmoid()
    decisions: list[tuple[int, int, float]] = []
    for ai, i in enumerate(active):
        for j in active[ai + 1:]:
            # Group membership is symmetric even though the pair head is ordered.
            score = 0.5 * (float(prob[i, j]) + float(prob[j, i]))
            decisions.append((i, j, score))
            if score >= threshold:
                uf.union(i, j)
    buckets: dict[int, list[int]] = {}
    for i in active:
        buckets.setdefault(uf.find(i), []).append(i)
    components = [tuple(v) for _, v in sorted(buckets.items(), key=lambda kv: min(kv[1]))]

    # A 0.51/0.49 pair decision should not become "high confidence" simply
    # because the threshold happened to fall on one side of it.
    pair_conf = []
    for i, j, score in decisions:
        same = uf.find(i) == uf.find(j)
        pair_conf.append(score if same else 1.0 - score)
    confidence = min(pair_conf, default=1.0)
    return components, confidence


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
               min_confidence: float) -> tuple[list[RelationHypothesis], float]:
    out: list[RelationHypothesis] = []
    decision_confidences: list[float] = []
    for si, src in enumerate(components):
        for ti, dst in enumerate(components):
            if si == ti:
                continue
            # Training stores relation supervision on group roots. Decode from
            # the same representative trace until a future group-level head replaces it.
            logits = relation_logits[src[0], dst[0]]
            probs = F.softmax(logits, dim=-1)
            rid = int(probs.argmax())
            kind = RELATIONS[rid]
            conf = float(probs[rid])
            decision_confidences.append(conf)
            if kind != "NONE" and conf >= min_confidence:
                out.append(RelationHypothesis(si, ti, kind, conf))
    return out, min(decision_confidences, default=1.0)


def _targets(relations: list[RelationHypothesis], source: int, kind: str) -> list[int]:
    best: dict[int, float] = {}
    for rel in relations:
        if rel.source == source and rel.kind == kind:
            best[rel.target] = max(best.get(rel.target, 0.0), rel.confidence)
    return list(best)


def _order_ids(ids: list[int], glyphs: list[GlyphHypothesis],
               relations: list[RelationHypothesis], warnings: list[str]) -> list[int]:
    """Topologically respect RIGHT edges, with x-position as deterministic tie-break."""
    unique = list(dict.fromkeys(ids))
    if len(unique) < 2:
        return unique
    allowed = set(unique)
    edges: dict[int, set[int]] = {i: set() for i in unique}
    incoming = {i: 0 for i in unique}
    for rel in relations:
        if rel.kind != "RIGHT" or rel.source not in allowed or rel.target not in allowed:
            continue
        if rel.target not in edges[rel.source]:
            edges[rel.source].add(rel.target)
            incoming[rel.target] += 1

    by_id = {g.id: g for g in glyphs}
    ready = sorted((i for i in unique if incoming[i] == 0), key=lambda i: (by_id[i].cx, by_id[i].cy))
    ordered: list[int] = []
    while ready:
        current = ready.pop(0)
        ordered.append(current)
        for target in sorted(edges[current], key=lambda i: (by_id[i].cx, by_id[i].cy)):
            incoming[target] -= 1
            if incoming[target] == 0:
                ready.append(target)
                ready.sort(key=lambda i: (by_id[i].cx, by_id[i].cy))
    if len(ordered) != len(unique):
        warnings.append("RIGHT relation cycle; fell back to geometry")
        return sorted(unique, key=lambda i: (by_id[i].cx, by_id[i].cy))
    return ordered


def _build_ast(glyphs: list[GlyphHypothesis], relations: list[RelationHypothesis]):
    if not glyphs:
        return MathNode("sequence"), ["no glyphs"]

    warnings: list[str] = []
    by_id = {g.id: g for g in glyphs}
    child_kinds = ("SUPERSCRIPT", "SUBSCRIPT", "INSIDE_ROOT", "NUMERATOR", "DENOMINATOR")
    children: dict[tuple[int, str], list[int]] = {}
    parents: dict[int, set[tuple[int, str]]] = {}
    for g in glyphs:
        for kind in child_kinds:
            targets = _targets(relations, g.id, kind)
            if targets:
                children[(g.id, kind)] = targets
                for target in targets:
                    parents.setdefault(target, set()).add((g.id, kind))

    for target, owners in parents.items():
        if len(owners) > 1:
            warnings.append(
                f"glyph {target} has multiple structural parents: " +
                ", ".join(f"{src}:{kind}" for src, kind in sorted(owners))
            )

    attached = set(parents)
    visiting: set[int] = set()

    def sequence(ids: list[int]) -> MathNode:
        ordered = _order_ids(ids, glyphs, relations, warnings)
        return MathNode("sequence", children=tuple(render(i) for i in ordered))

    def render(gid: int) -> MathNode:
        if gid in visiting:
            warnings.append(f"structural cycle at glyph {gid}")
            return MathNode("symbol", value=by_id[gid].symbol)
        visiting.add(gid)
        g = by_id[gid]

        numerators = children.get((gid, "NUMERATOR"), [])
        denominators = children.get((gid, "DENOMINATOR"), [])
        inside = children.get((gid, "INSIDE_ROOT"), [])
        supers = children.get((gid, "SUPERSCRIPT"), [])
        subs = children.get((gid, "SUBSCRIPT"), [])

        if numerators or denominators:
            if not numerators or not denominators:
                warnings.append(f"incomplete fraction relation at glyph {gid}")
                node = MathNode("symbol", value=g.symbol)
            else:
                node = MathNode("fraction", children=(sequence(numerators), sequence(denominators)))
        elif inside:
            node = MathNode("sqrt", children=(sequence(inside),))
        elif g.symbol == "sqrt":
            warnings.append(f"radical glyph {gid} has no INSIDE_ROOT relation")
            node = MathNode("symbol", value="sqrt")
        else:
            node = MathNode("symbol", value=g.symbol)

        if supers and subs:
            node = MathNode("scripts", children=(node, sequence(supers), sequence(subs)))
        elif supers:
            node = MathNode("superscript", children=(node, sequence(supers)))
        elif subs:
            node = MathNode("subscript", children=(node, sequence(subs)))
        visiting.remove(gid)
        return node

    roots = [g.id for g in glyphs if g.id not in attached]
    if not roots:
        warnings.append("no structural root; fell back to all glyphs")
        roots = [g.id for g in glyphs]
    ast = sequence(roots)
    return ast, warnings


def decode_structural_output(outputs: dict, stroke_geometry: torch.Tensor,
                             stroke_valid: torch.Tensor, group_threshold: float = 0.65,
                             relation_threshold: float = 0.60,
                             ambiguity_threshold: float = 0.80) -> StructuralHypothesis:
    """Decode one V4 output dictionary into an inspectable AST hypothesis."""
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

    components, grouping_confidence = _components(
        group_logits, stroke_valid.bool(), group_threshold
    )
    glyphs = _glyphs(symbol_logits, stroke_geometry, components)
    relations, relation_confidence = _relations(
        relation_logits, components, relation_threshold
    )
    ast, warnings = _build_ast(glyphs, relations)
    canonical = ast.canonical()

    symbol_confidence = min((g.symbol_confidence for g in glyphs), default=0.0)
    confidence = min(symbol_confidence, grouping_confidence, relation_confidence)
    ambiguous = confidence < ambiguity_threshold or bool(warnings)
    return StructuralHypothesis(
        glyphs=glyphs,
        relations=relations,
        ast=ast,
        canonical=canonical,
        confidence=confidence,
        symbol_confidence=symbol_confidence,
        grouping_confidence=grouping_confidence,
        relation_confidence=relation_confidence,
        ambiguous=ambiguous,
        warnings=warnings,
    )
