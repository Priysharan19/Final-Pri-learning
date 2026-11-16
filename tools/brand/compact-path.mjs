// Pri Learning · the shortest exact spelling of an SVG path (plan E4)
//
// The brand's path data is written in absolute commands with at most two
// decimals. compactPath() rewrites it, segment by segment, in whichever of the
// absolute or relative form is shorter, with minimal number formatting (no
// leading zero, no space before a minus sign, a repeated command letter left
// out). Arithmetic is done in whole hundredths, so every coordinate of the
// result is EXACTLY the coordinate it replaces: the outline is the same shape,
// only its spelling is shorter. Every byte of it is in each edition's install.
//
// Supported input: absolute M L H V Q C A Z (what the brand kit emits). Any
// other command, or a number with more than two decimals, throws rather than
// guess.

const SCALE = 100;

function toInt(text) {
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(text)) throw new Error(`compactPath: bad number ${text}`);
  const [, frac = ''] = text.split('.');
  if (frac.length > 2) throw new Error(`compactPath: ${text} has more than two decimals`);
  return Math.round(Number(text) * SCALE);
}

function fmt(n) {
  const neg = n < 0;
  const a = Math.abs(n);
  const whole = Math.floor(a / SCALE);
  const frac = String(a % SCALE).padStart(2, '0').replace(/0+$/, '');
  const body = frac ? `${whole === 0 ? '' : whole}.${frac}` : String(whole);
  return (neg ? '-' : '') + body;
}

/** Join numbers with the fewest separators an SVG parser still reads the same. */
function joinNumbers(nums) {
  let out = '';
  for (const s of nums) {
    if (!out) { out = s; continue; }
    const needsSpace = !(s.startsWith('-') || (s.startsWith('.') && /\.\d*$/.test(out.split(/[ -]/).pop() || '')));
    out += (needsSpace ? ' ' : '') + s;
  }
  return out;
}

const ARITY = { M: 2, L: 2, H: 1, V: 1, Q: 4, C: 6, A: 7, Z: 0 };

export function compactPath(d) {
  const tokens = d.match(/[A-Za-z]|-?(?:\d+\.?\d*|\.\d+)/g) || [];
  const segs = [];
  let cmd = null;
  for (let i = 0; i < tokens.length;) {
    const t = tokens[i];
    if (/[A-Za-z]/.test(t)) {
      if (!(t in ARITY)) throw new Error(`compactPath: unsupported command ${t}`);
      cmd = t; i++;
      if (cmd === 'Z') { segs.push({ cmd, args: [] }); continue; }
    } else if (!cmd || cmd === 'Z') throw new Error('compactPath: number without a command');
    const n = ARITY[cmd];
    const args = tokens.slice(i, i + n).map(toInt);
    if (args.length !== n) throw new Error(`compactPath: ${cmd} needs ${n} numbers`);
    segs.push({ cmd, args });
    i += n;
    if (cmd === 'M') cmd = 'L'; // numbers after a moveto are lineto pairs
  }

  let x = 0, y = 0, sx = 0, sy = 0, prev = null, first = true;
  let out = '';
  for (const { cmd, args } of segs) {
    let abs, rel;
    if (cmd === 'Z') { out += 'Z'; x = sx; y = sy; prev = 'Z'; continue; }
    if (cmd === 'H') { abs = [args[0]]; rel = [args[0] - x]; }
    else if (cmd === 'V') { abs = [args[0]]; rel = [args[0] - y]; }
    else if (cmd === 'A') { abs = args; rel = [...args.slice(0, 5), args[5] - x, args[6] - y]; }
    else { abs = args; rel = args.map((v, k) => v - (k % 2 ? y : x)); }
    const flags = cmd === 'A';
    const spell = (nums, letter) => {
      const strs = nums.map((v, k) => (flags && (k === 3 || k === 4) ? String(v / SCALE) : fmt(v)));
      // A repeated letter may be left out, except after a moveto (its repeats mean lineto).
      const sameAsPrev = letter === prev && letter.toUpperCase() !== 'M';
      const head = sameAsPrev ? '' : letter;
      const body = joinNumbers(strs);
      // Without a letter, the first number needs a separator from what came before.
      const sep = sameAsPrev && !body.startsWith('-') ? ' ' : '';
      return sep + head + body;
    };
    // The first moveto is absolute either way ('m' at the start means 'M').
    const a = spell(abs, cmd);
    const r = first && cmd === 'M' ? a : spell(rel, cmd.toLowerCase());
    const pick = r.length < a.length ? r : a;
    out += pick;
    prev = pick === a ? cmd : cmd.toLowerCase();
    if (cmd === 'H') x = args[0];
    else if (cmd === 'V') y = args[0];
    else { x = args[args.length - 2]; y = args[args.length - 1]; }
    if (cmd === 'M') { sx = x; sy = y; }
    first = false;
  }
  return out;
}

/**
 * The absolute segments a path draws, in whole hundredths: { cmd, args }.
 * Reads absolute or relative commands, implicit repeats and compact number
 * spellings ("1.5.5", "2-3"). Used to prove compactPath() exact.
 */
export function absoluteSegments(d) {
  const tokens = d.match(/[A-Za-z]|-?(?:\d+\.\d*|\d+|\.\d+)/g) || [];
  const segs = [];
  let cmd = null, x = 0, y = 0, sx = 0, sy = 0;
  for (let i = 0; i < tokens.length;) {
    if (/[A-Za-z]/.test(tokens[i])) {
      cmd = tokens[i++];
      if (cmd === 'Z' || cmd === 'z') { segs.push({ cmd: 'Z', args: [] }); x = sx; y = sy; continue; }
    }
    const up = cmd.toUpperCase(), rel = cmd !== up, n = ARITY[up];
    if (n === undefined) throw new Error(`absoluteSegments: unsupported command ${cmd}`);
    const raw = tokens.slice(i, i + n).map(t => Math.round(Number(t) * SCALE));
    i += n;
    let args;
    if (up === 'H') args = [raw[0] + (rel ? x : 0)];
    else if (up === 'V') args = [raw[0] + (rel ? y : 0)];
    else if (up === 'A') args = [...raw.slice(0, 5), raw[5] + (rel ? x : 0), raw[6] + (rel ? y : 0)];
    else args = raw.map((v, k) => v + (rel ? (k % 2 ? y : x) : 0));
    segs.push({ cmd: up, args });
    if (up === 'H') x = args[0];
    else if (up === 'V') y = args[0];
    else { x = args[args.length - 2]; y = args[args.length - 1]; }
    if (up === 'M') { sx = x; sy = y; cmd = rel ? 'l' : 'L'; }
  }
  return segs;
}
