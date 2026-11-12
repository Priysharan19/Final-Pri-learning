#!/usr/bin/env python3
"""Outline the edition wordmarks to SVG path data (Pri Learning brand kit, Direction A).

    python3 -I outline-wordmarks.py <instrument-sans-latin-wght-normal.woff2> \
        <NotoSansDevanagari[wdth,wght].ttf> > wordmarks.json

Requires: fonttools, brotli, uharfbuzz (pip). Text is shaped with HarfBuzz, so the
Devanagari conjunct (प्र) and the pre-base i-matra (ि) come out exactly as a browser
draws them. Coordinates are font units (1000/em), y down, baseline at y = 0.

Direction A: Instrument Sans wght 600, tracking -0.028em; the P-prime mark's own
prime path, placed relative to the outlined P exactly as it sits on the mark's P
(the mark's bowl right edge 75.5 -> the P's ink right edge; the mark's cap top
13 -> the font's cap height; scale = capHeight / 75).
"""
import io, json, sys
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.pens.boundsPen import BoundsPen
import uharfbuzz as hb

TRACK = -0.028          # em, Instrument Sans wordmarks
WGHT = 600
PRIME = [(82, 5), (92.5, 7.2), (83.5, 30), (77, 28.4)]   # BrandMark.jsx PRIME_PATH
SMALL_PRIME = 1.25      # optical size for wordmarks drawn at <= 20 px tall

def instance(path, axes):
    f = TTFont(path)
    f.flavor = None
    inst = instantiateVariableFont(f, axes)
    buf = io.BytesIO(); inst.save(buf)
    return TTFont(io.BytesIO(buf.getvalue())), buf.getvalue()

def r(v):
    return round(v, 1) + 0.0

def fmt(points):
    return 'M' + 'L'.join(f'{r(x):g} {r(y):g}' for x, y in points) + 'Z'

def outline(font, data, text, track_em, lang=None, script=None):
    upem = font['head'].unitsPerEm
    face = hb.Face(data); hbfont = hb.Font(face)
    buf = hb.Buffer(); buf.add_str(text); buf.guess_segment_properties()
    if script: buf.script = script
    if lang: buf.language = lang
    hb.shape(hbfont, buf, {'kern': True, 'liga': True})
    gs = font.getGlyphSet(); order = font.getGlyphOrder()
    x = 0; parts = []; glyph_boxes = []
    n = len(buf.glyph_infos)
    for i, (info, pos) in enumerate(zip(buf.glyph_infos, buf.glyph_positions)):
        name = order[info.codepoint]
        ox, oy = x + pos.x_offset, pos.y_offset
        pen = SVGPathPen(gs, ntos=lambda v: f'{r(v):g}')
        gs[name].draw(TransformPen(pen, (1, 0, 0, -1, ox, -oy)))
        bp = BoundsPen(gs); gs[name].draw(bp)
        if bp.bounds:
            b = bp.bounds; glyph_boxes.append((info.cluster, ox + b[0], ox + b[2]))
        d = pen.getCommands()
        if d: parts.append(d)
        x += pos.x_advance + (track_em * upem if i < n - 1 else 0)
    return ' '.join(parts), x, glyph_boxes, upem

def bounds_of(font, data, text, track):
    return outline(font, data, text, track)

def main():
    latin, latin_data = instance(sys.argv[1], {'wght': WGHT})
    deva, deva_data = instance(sys.argv[2], {'wght': WGHT, 'wdth': 100})
    cap = latin['OS/2'].sCapHeight
    xh = latin['OS/2'].sxHeight
    out = {'source': {'latin': 'Instrument Sans (fontsource-variable 5.3.0), wght 600, tracking -0.028em',
                      'devanagari': 'Noto Sans Devanagari (google/fonts), wght 600, wdth 100, no tracking'},
           'capHeight': cap, 'xHeight': xh, 'wordmarks': {}}
    for edition, text in (('priyabhata', 'Priyabhata'), ('prithagoras', 'Prithagoras')):
        d, adv, boxes, upem = outline(latin, latin_data, text, TRACK)
        p_right = boxes[0][2]                     # ink right edge of the P
        s = cap / 75.0
        def place(k):
            # scale about the prime's bottom-left corner (77, 28.4) for the small-size cut
            pts = [(77 + (px - 77) * k, 28.4 + (py - 28.4) * k) for px, py in PRIME]
            return [(p_right + (px - 75.5) * s, -cap + (py - 13) * s) for px, py in pts]
        prime = place(1.0); prime_s = place(SMALL_PRIME)
        # r's ink: the next glyph after P, for the collision check
        r_left = boxes[1][1]
        ys = [p[1] for p in prime]
        out['wordmarks'][edition] = {
            'text': text, 'd': d, 'advance': round(adv, 1),
            'prime': fmt(prime), 'primeSmall': fmt(prime_s),
            'check': {'primeBottomAboveXHeight': round(-max(ys) - xh, 1),
                      'primeBottomSmallAboveXHeight': round(-max(p[1] for p in prime_s) - xh, 1),
                      'pInkRight': round(p_right, 1), 'rInkLeft': round(r_left, 1)}}
    d, adv, _, _ = outline(deva, deva_data, 'प्रियभट', 0, lang='hi', script='Deva')
    out['wordmarks']['priyabhata-hi'] = {'text': 'प्रियभट', 'd': d, 'advance': round(adv, 1)}
    json.dump(out, sys.stdout, ensure_ascii=False, indent=1)

main()
