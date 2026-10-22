// Pri Luxury · pressure ink outline (presentation only).
// Ported from the v3 spec's craft JS (outline / fillPoly): a stroke is a filled
// polygon whose half-width follows each point's width `w` (already shaped by
// the canvas from pen pressure, or from speed without one), tapered over the
// first and last six points, closed with midpoint quadratics. Stored strokes,
// reading and marking see exactly the points they saw before.

/** Paint a stroke as outline ink. scale widens it (the wet swell); taper=false
 *  keeps the tip blunt while the pen is down. */
export function paintOutline(ctx, pts, color, alpha = 1, scale = 1, taper = true) {
  const n = pts?.length || 0;
  if (!ctx || !n) return;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.beginPath();
  if (n === 1) ctx.arc(pts[0].x, pts[0].y, Math.max(1.4, (pts[0].w || 3) * scale / 2), 0, 7);
  else {
    const poly = new Array(n * 2);
    for (let i = 0; i < n; i++) {
      const a = pts[i && i - 1], b = pts[Math.min(n - 1, i + 1)];
      const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1;
      const w = (pts[i].w || 3) * scale / 2 * (0.35 + 0.65 * Math.min(1, Math.min(i, taper ? n - 1 - i : 6) / 6));
      poly[i] = [pts[i].x - dy / len * w, pts[i].y + dx / len * w];
      poly[2 * n - 1 - i] = [pts[i].x + dy / len * w, pts[i].y - dx / len * w];
    }
    ctx.moveTo(poly[0][0], poly[0][1]);
    for (let i = 1; i < poly.length; i++) {
      const [ax, ay] = poly[i - 1], [bx, by] = poly[i];
      ctx.quadraticCurveTo(ax, ay, (ax + bx) / 2, (ay + by) / 2);
    }
    ctx.closePath();
  }
  ctx.fill();
  ctx.globalAlpha = 1;
}
