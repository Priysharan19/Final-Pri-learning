// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · QR code encoder — byte mode, versions 1–10, error correction
// L or M. Enough for a class join link on a printed or projected card. No
// dependency: the app ships nothing it did not write, and a join card must
// render offline on an iPad in a classroom with no network.
//
// The encoder is deterministic (same text → same modules) and exposes its
// placement order and block plan so a test can read the symbol back and prove
// the Reed–Solomon blocks and the format information are what a reader expects.
// ─────────────────────────────────────────────────────────────────────────────

const FORMAT_BITS = { L: 1, M: 0 };

// Per version: total codewords, then for each level [ecPerBlock, [[blocks, dataCodewordsPerBlock], …]]
export const QR_VERSIONS = [
  null,
  { total: 26, L: [7, [[1, 19]]], M: [10, [[1, 16]]] },
  { total: 44, L: [10, [[1, 34]]], M: [16, [[1, 28]]] },
  { total: 70, L: [15, [[1, 55]]], M: [26, [[1, 44]]] },
  { total: 100, L: [20, [[1, 80]]], M: [18, [[2, 32]]] },
  { total: 134, L: [26, [[1, 108]]], M: [24, [[2, 43]]] },
  { total: 172, L: [18, [[2, 68]]], M: [16, [[4, 27]]] },
  { total: 196, L: [20, [[2, 78]]], M: [18, [[4, 31]]] },
  { total: 242, L: [24, [[2, 97]]], M: [22, [[2, 38], [2, 39]]] },
  { total: 292, L: [30, [[2, 116]]], M: [22, [[3, 36], [2, 37]]] },
  { total: 346, L: [18, [[2, 68], [2, 69]]], M: [26, [[4, 43], [1, 44]]] }
];
const ALIGN = [null, [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]];

// ── GF(256), primitive polynomial x^8 + x^4 + x^3 + x^2 + 1 ─────────────────
const EXP = new Uint8Array(512);
const LOG = new Uint8Array(256);
(() => {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP[i] = x; LOG[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
})();
const mul = (a, b) => (a && b ? EXP[LOG[a] + LOG[b]] : 0);

/** Generator polynomial for n error-correction codewords, highest degree first. */
export function rsGenerator(n) {
  let g = [1];
  for (let i = 0; i < n; i++) {
    const next = new Array(g.length + 1).fill(0);
    for (let j = 0; j < g.length; j++) {
      next[j] ^= g[j];
      next[j + 1] ^= mul(g[j], EXP[i]);
    }
    g = next;
  }
  return g;
}

/** Remainder of data·x^n divided by the generator — the EC codewords. */
export function rsRemainder(data, gen) {
  const out = new Array(gen.length - 1).fill(0);
  for (const byte of data) {
    const factor = byte ^ out[0];
    out.shift(); out.push(0);
    if (factor) for (let j = 0; j < out.length; j++) out[j] ^= mul(gen[j + 1], factor);
  }
  return out;
}

export function blockPlan(version, level) {
  const spec = QR_VERSIONS[version]?.[level];
  if (!spec) throw new Error(`QR version ${version}/${level} is not supported`);
  return { ecPerBlock: spec[0], blocks: spec[1], dataCodewords: spec[1].reduce((n, [c, d]) => n + c * d, 0) };
}

function textBytes(text) {
  return Array.from(new TextEncoder().encode(String(text ?? '')));
}

function versionFor(bytes, level) {
  for (let v = 1; v < QR_VERSIONS.length; v++) {
    const countBits = v <= 9 ? 8 : 16;
    if (4 + countBits + bytes.length * 8 <= blockPlan(v, level).dataCodewords * 8) return v;
  }
  throw new Error('Text is too long for a version 1–10 QR code');
}

/** Data codewords (padded) then error-correction codewords, interleaved for placement. */
export function codewordsFor(bytes, version, level) {
  const { ecPerBlock, blocks, dataCodewords } = blockPlan(version, level);
  const bits = [];
  const push = (value, n) => { for (let i = n - 1; i >= 0; i--) bits.push((value >>> i) & 1); };
  push(4, 4);
  push(bytes.length, version <= 9 ? 8 : 16);
  for (const b of bytes) push(b, 8);
  const cap = dataCodewords * 8;
  push(0, Math.min(4, cap - bits.length));
  while (bits.length % 8) bits.push(0);
  for (let pad = 0xEC; bits.length < cap; pad ^= 0xEC ^ 0x11) push(pad, 8);
  const data = [];
  for (let i = 0; i < bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | bits[i + j];
    data.push(byte);
  }
  const gen = rsGenerator(ecPerBlock);
  const dataBlocks = [];
  const ecBlocks = [];
  let off = 0;
  for (const [count, len] of blocks) {
    for (let k = 0; k < count; k++) {
      const chunk = data.slice(off, off + len);
      off += len;
      dataBlocks.push(chunk);
      ecBlocks.push(rsRemainder(chunk, gen));
    }
  }
  const out = [];
  const longest = Math.max(...dataBlocks.map(b => b.length));
  for (let i = 0; i < longest; i++) for (const b of dataBlocks) if (i < b.length) out.push(b[i]);
  for (let i = 0; i < ecPerBlock; i++) for (const b of ecBlocks) out.push(b[i]);
  return { codewords: out, dataBlocks, ecBlocks };
}

/** The [x, y] of every data module in the order the codeword bits fill them. */
export function placementOrder(version) {
  const size = version * 4 + 17;
  const isFunction = functionMap(version);
  const order = [];
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vert : vert;
        if (!isFunction[y][x]) order.push([x, y]);
      }
    }
  }
  return order;
}

export function maskBit(mask, x, y) {
  switch (mask) {
    case 0: return (x + y) % 2 === 0;
    case 1: return y % 2 === 0;
    case 2: return x % 3 === 0;
    case 3: return (x + y) % 3 === 0;
    case 4: return (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0;
    case 5: return (x * y) % 2 + (x * y) % 3 === 0;
    case 6: return ((x * y) % 2 + (x * y) % 3) % 2 === 0;
    default: return ((x + y) % 2 + (x * y) % 3) % 2 === 0;
  }
}

export function formatBits(level, mask) {
  const data = (FORMAT_BITS[level] << 3) | mask;
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  return ((data << 10) | rem) ^ 0x5412;
}

function versionBits(version) {
  let rem = version;
  for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1F25);
  return (version << 12) | rem;
}

/** Which modules are function patterns (finders, timing, alignment, format, version, dark). */
function functionMap(version) {
  const size = version * 4 + 17;
  const map = Array.from({ length: size }, () => new Array(size).fill(false));
  const mark = (x, y) => { if (x >= 0 && y >= 0 && x < size && y < size) map[y][x] = true; };
  const finder = (cx, cy) => { for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) mark(cx + dx, cy + dy); };
  finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
  for (let i = 0; i < size; i++) { mark(6, i); mark(i, 6); }
  const pos = ALIGN[version];
  for (let i = 0; i < pos.length; i++) {
    for (let j = 0; j < pos.length; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === pos.length - 1) || (i === pos.length - 1 && j === 0)) continue;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) mark(pos[i] + dx, pos[j] + dy);
    }
  }
  for (let i = 0; i < 9; i++) { mark(8, i); mark(i, 8); }
  for (let i = 0; i < 8; i++) { mark(size - 1 - i, 8); mark(8, size - 1 - i); }
  if (version >= 7) {
    for (let i = 0; i < 18; i++) {
      const a = size - 11 + i % 3;
      const b = Math.floor(i / 3);
      mark(a, b); mark(b, a);
    }
  }
  return map;
}

function drawFunctions(version, modules) {
  const size = modules.length;
  const set = (x, y, dark) => { if (x >= 0 && y >= 0 && x < size && y < size) modules[y][x] = dark ? 1 : 0; };
  const finder = (cx, cy) => {
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const d = Math.max(Math.abs(dx), Math.abs(dy));
      set(cx + dx, cy + dy, d !== 2 && d !== 4);
    }
  };
  finder(3, 3); finder(size - 4, 3); finder(3, size - 4);
  for (let i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
  const pos = ALIGN[version];
  for (let i = 0; i < pos.length; i++) {
    for (let j = 0; j < pos.length; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === pos.length - 1) || (i === pos.length - 1 && j === 0)) continue;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) set(pos[i] + dx, pos[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
  }
  if (version >= 7) {
    const bits = versionBits(version);
    for (let i = 0; i < 18; i++) {
      const bit = (bits >>> i) & 1;
      const a = size - 11 + i % 3;
      const b = Math.floor(i / 3);
      set(a, b, bit); set(b, a, bit);
    }
  }
}

function drawFormat(modules, level, mask) {
  const size = modules.length;
  const bits = formatBits(level, mask);
  const get = i => (bits >>> i) & 1;
  const set = (x, y, dark) => { modules[y][x] = dark ? 1 : 0; };
  for (let i = 0; i <= 5; i++) set(8, i, get(i));
  set(8, 7, get(6)); set(8, 8, get(7)); set(7, 8, get(8));
  for (let i = 9; i < 15; i++) set(14 - i, 8, get(i));
  for (let i = 0; i < 8; i++) set(size - 1 - i, 8, get(i));
  for (let i = 8; i < 15; i++) set(8, size - 15 + i, get(i));
  set(8, size - 8, 1);
}

function penalty(modules) {
  const size = modules.length;
  let score = 0;
  const runs = line => {
    let run = 0;
    let last = -1;
    for (let i = 0; i <= line.length; i++) {
      const v = i < line.length ? line[i] : -2;
      if (v === last) run++;
      else { if (run >= 5) score += 3 + (run - 5); run = 1; last = v; }
    }
    const s = line.join('');
    for (let i = 0; i + 7 <= s.length; i++) {
      if (s.slice(i, i + 7) !== '1011101') continue;
      const before = s.slice(Math.max(0, i - 4), i);
      const after = s.slice(i + 7, i + 11);
      if ((before.length === 4 && before === '0000') || (after.length === 4 && after === '0000')) score += 40;
    }
  };
  for (let y = 0; y < size; y++) runs(modules[y]);
  for (let x = 0; x < size; x++) runs(modules.map(row => row[x]));
  for (let y = 0; y + 1 < size; y++) for (let x = 0; x + 1 < size; x++) {
    const v = modules[y][x];
    if (v === modules[y][x + 1] && v === modules[y + 1][x] && v === modules[y + 1][x + 1]) score += 3;
  }
  const dark = modules.flat().reduce((n, v) => n + v, 0);
  const total = size * size;
  const k = Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1;
  return score + 10 * Math.max(0, k);
}

/**
 * Encode text into a module matrix. `modules[y][x]` is 1 for a dark module.
 * Level M by default: a printed card survives a smudge.
 */
export function qrMatrix(text, { level = 'M' } = {}) {
  if (!FORMAT_BITS[level] && FORMAT_BITS[level] !== 0) throw new Error('QR level must be L or M');
  const bytes = textBytes(text);
  const version = versionFor(bytes, level);
  const size = version * 4 + 17;
  const { codewords } = codewordsFor(bytes, version, level);
  const modules = Array.from({ length: size }, () => new Array(size).fill(0));
  drawFunctions(version, modules);
  const order = placementOrder(version);
  order.forEach(([x, y], i) => { modules[y][x] = i < codewords.length * 8 ? (codewords[i >>> 3] >>> (7 - (i & 7))) & 1 : 0; });
  const isFunction = functionMap(version);
  let best = null;
  for (let mask = 0; mask < 8; mask++) {
    const candidate = modules.map(row => row.slice());
    for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!isFunction[y][x] && maskBit(mask, x, y)) candidate[y][x] ^= 1;
    drawFormat(candidate, level, mask);
    const score = penalty(candidate);
    if (!best || score < best.score) best = { score, mask, modules: candidate };
  }
  return { version, size, level, mask: best.mask, modules: best.modules, codewords };
}

/** An SVG string of the code — one path, crisp at any size, printable. */
export function qrSvg(text, { level = 'M', margin = 2, dark = '#111', light = '#fff', title = '' } = {}) {
  const { size, modules } = qrMatrix(text, { level });
  const dim = size + margin * 2;
  let d = '';
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (modules[y][x]) d += `M${x + margin} ${y + margin}h1v1h-1z`;
  const label = title ? `<title>${String(title).replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]))}</title>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${dim} ${dim}" shape-rendering="crispEdges" role="img">${label}<rect width="${dim}" height="${dim}" fill="${light}"/><path d="${d}" fill="${dark}"/></svg>`;
}
