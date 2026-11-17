// The content of the page, not only its size: two pages with the same number
// of strokes and points are different pages.
export const strokeSignature = strokes => {
  let h = 0x811c9dc5, points = 0;
  for (const st of strokes) {
    h = Math.imul(h ^ 0x7c, 0x01000193) >>> 0;
    for (const p of st?.points || []) {
      points += 1;
      h = Math.imul(h ^ (Math.round(Number(p?.x) || 0) & 0xffff), 0x01000193) >>> 0;
      h = Math.imul(h ^ (Math.round(Number(p?.y) || 0) & 0xffff), 0x01000193) >>> 0;
    }
  }
  return `${strokes.length}:${points}:${h.toString(36)}`;
};

/**
 * The same signature, folded incrementally. strokeSignature() walks every point
 * of every stroke, so computing it at each pen-up costs more with every stroke
 * on the page. This tracker keeps the running hash of the strokes it has already
 * seen and folds only the new ones in, falling back to a full recompute when
 * the earlier strokes are not the same objects with the same point counts
 * (undo, clear, a resize that rescaled the page, a restored draft). Its output
 * is always exactly strokeSignature(strokes).
 */
export function createStrokeSignature() {
  let seen = [];            // [{ stroke, n }] for the folded prefix
  let h = 0x811c9dc5, points = 0;
  const fold = (st) => {
    h = Math.imul(h ^ 0x7c, 0x01000193) >>> 0;
    let n = 0;
    for (const p of st?.points || []) {
      n += 1; points += 1;
      h = Math.imul(h ^ (Math.round(Number(p?.x) || 0) & 0xffff), 0x01000193) >>> 0;
      h = Math.imul(h ^ (Math.round(Number(p?.y) || 0) & 0xffff), 0x01000193) >>> 0;
    }
    return n;
  };
  return (strokes) => {
    let k = 0;
    if (seen.length <= strokes.length) {
      while (k < seen.length && seen[k].stroke === strokes[k] && seen[k].n === (strokes[k]?.points?.length || 0)) k += 1;
    }
    if (k !== seen.length) { seen = []; h = 0x811c9dc5; points = 0; k = 0; }
    for (let i = k; i < strokes.length; i += 1) seen.push({ stroke: strokes[i], n: fold(strokes[i]) });
    return `${strokes.length}:${points}:${h.toString(36)}`;
  };
}
