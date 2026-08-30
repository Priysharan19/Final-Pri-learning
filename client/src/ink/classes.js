// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Neural classifier class inventory
// Shape-classes for the CNN. Symbols that are pixel-identical share a class
// ('0'/'o', '1'/'l') — the language decoder picks the reading from context.
// ─────────────────────────────────────────────────────────────────────────────

export const CLASSES = [
  '0o', '1l', '2', '3', '4', '5', '6', '7', '8', '9',
  'x', 'y', 't', 'n', 'a', 'b', 'e', 'c', 'd', 'k', 'm', 'r', 's', 'u', 'v', 'z',
  'i', 'g', 'h', 'f', 'w', 'p', 'q', 'L', 'H', 'R',
  'pi', 'theta', '(', ')', 'sqrt', 'percent', '<', '>',
  '+', '-', '=', '/', '.', ':', 'div', 'pm', '<=', '>=', '!=', 'deg'
];

export const CLASS_INDEX = Object.fromEntries(CLASSES.map((c, i) => [c, i]));

/** Which CNN class a template symbol belongs to. */
export function classOfSymbol(sym) {
  if (sym === '0' || sym === 'o' || sym === 'O') return '0o';
  if (sym === '1' || sym === 'l') return '1l';
  if (sym === '*') return 'x';
  return sym;
}

/** The default (maths-prior) reading of a CNN class in isolation. */
export function defaultSymbol(cls) {
  if (cls === '0o') return '0';
  if (cls === '1l') return '1';
  return cls;
}

/** All symbols a CNN class may stand for — the decoder chooses among these.
 *  Capital O and the times sign carry no independent raster class: O is a
 *  0/o ring and * is a small x. Context and geometry must earn the reading. */
export function symbolsOfClass(cls) {
  if (cls === '0o') return ['0', 'o', 'O'];
  if (cls === '1l') return ['1', 'l'];
  if (cls === 'x') return ['x', '*'];
  return [cls];
}
