// Label audit shared by the browser checks: in a real browser, every KaTeX label's tight box is
// measured against (a) points sampled along every stroked outline in its figure (curves, axes, edges,
// shapes, bar and box outlines, circles, hidden edges) and (b) every other label's box in the same
// figure. Gridlines, ticks and fills are not strokes a label can be misread against. It returns the
// overlaps found; the caller fails on any.
export async function auditLabels(page, scopeSelector, name = 'figure') {
  return page.evaluate(({ scopeSelector, name }) => {
    const STROKES = '.dg-curve, .dg-shape, .dg-solid, .dg-hidden, .dg-edge, .dg-axis, .dg-vector, .dg-bar, .dg-box, .dg-venn, .dg-node, .dg-asymptote, .dg-rightmark, .dg-arc, .dg-dash, .dg-interval, .dg-break';
    const found = [];
    let figures = 0; let samples = 0; let labels = 0;
    for (const svg of document.querySelectorAll(`${scopeSelector} svg.dg-svg`)) {
      figures += 1;
      const tag = svg.closest('[data-case]')?.dataset.case || name;
      const boxes = [];
      for (const inner of svg.querySelectorAll('.dg-tex-in')) {
        const target = inner.querySelector('.katex-html') || inner;
        const range = document.createRange(); range.selectNodeContents(target);
        const r = range.getBoundingClientRect();
        if (r.width > 0 && r.height > 0) boxes.push({ r, text: (inner.querySelector('.katex-html') || inner).textContent.trim().slice(0, 18) });
      }
      labels += boxes.length;
      for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i].r; const b = boxes[j].r;
        if (a.left + 1 < b.right && b.left + 1 < a.right && a.top + 1 < b.bottom && b.top + 1 < a.bottom) found.push(`${tag}: "${boxes[i].text}" and "${boxes[j].text}" overlap`);
      }
      for (const el of svg.querySelectorAll(STROKES)) {
        if (!el.getTotalLength || el.closest('defs')) continue;
        const ctm = el.getScreenCTM(); if (!ctm) continue;
        const len = el.getTotalLength(); const step = 2;
        for (let d = 0; d <= len; d += step) {
          const q = el.getPointAtLength(d);
          const x = q.x * ctm.a + q.y * ctm.c + ctm.e; const y = q.x * ctm.b + q.y * ctm.d + ctm.f;
          samples += 1;
          for (const b of boxes) {
            if (x > b.r.left + 1 && x < b.r.right - 1 && y > b.r.top + 1 && y < b.r.bottom - 1) found.push(`${tag}: "${b.text}" is crossed by a ${el.getAttribute('class')}`);
          }
        }
      }
    }
    return { found: [...new Set(found)], figures, samples, labels };
  }, { scopeSelector, name });
}
