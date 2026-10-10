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
