#!/usr/bin/env node
// Author question bank DIAGRAMS: the owner's TikZ figures, compiled once at authoring time to inert SVG files.
//
//   node tools/qbank-diagrams.mjs render <archive-dir> --work <dir> [--ids A11-F1-003,...] [--limit N] [--jobs 6]
//        compile every question that has TikZ (outside the repository, in <dir>), verify each figure, write <dir>/results.json
//   node tools/qbank-diagrams.mjs check              verify the COMMITTED figures (server/content/qbank/figures) against their manifest and the
//                                                    sanitiser, without TeX (this is what CI runs; CI has no TeX)
//   node tools/qbank-import.mjs --pack <archive> --out <pack> --figures <dir>   packs the questions whose figure verified
//
// Authoring only. The app never runs TeX. The TikZ is the owner's DATA and is treated as untrusted input:
//   * it is rejected before any compile when it holds anything that reads or writes a file, runs a program, loads a package, redefines the
//     document, or hides any of that behind ^^ escapes (untrustedTikz);
//   * TeX is run with -no-shell-escape and in paranoid file mode (openin_any=p, openout_any=p), in a fresh temp directory outside this
//     repository, with a minimal environment, and the result is converted by dvisvgm with every glyph turned into a path (--no-fonts), so
//     the file renders the same everywhere and depends on no font;
//   * the SVG is then normalised (no comment, no version stamp, sizes in px) so a rerun is byte-identical, and sanitised: an allow-list of
//     elements and attributes, no script, no event attribute, no external reference, no style, no image, no foreignObject.
// The preamble is the bank's own, READ from its source/build.py (never run). pgfsys-dvisvgm.def is declared before the class, or some
// figures come out empty.
//
// Pure and deterministic: no clock, no network, no model, no randomness.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fileURLToPath } from 'node:url';
import { checkAnswer, plainTex } from '../client/src/engine/checker.js';

const run = promisify(execFile);
export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const FIGURES_DIR = path.join(ROOT, 'server', 'content', 'qbank', 'figures');
export const FIGURES_FORMAT = 'pri-qbank-figures-v1';
export const MAX_FIGURE_BYTES = 90_000;
export const NEUTRAL_ALT = 'Diagram for this question; the measurements are given in the question text.';
const TEX_BIN = ['/Library/TeX/texbin', '/usr/local/texlive/2026/bin/universal-darwin', '/usr/texbin'];
const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const safe = (fn, fallback = null) => { try { return fn(); } catch { return fallback; } };

// ── 1. the TikZ is untrusted input ───────────────────────────────────────────
// Commands that touch a file, run a program, load code, or reshape the document. \x-style loop variables, \pgfmathsetmacro, \edef, \noexpand,
// \numexpr and \ifodd (all used by the bank) are fine: none of them leaves TeX.
const FORBIDDEN = [
  [/\\(?:immediate|write|newwrite|openout|closeout|openin|closein|read|readline|newread|input|include|InputIfFileExists|IfFileExists|endinput)(?![A-Za-z])/, 'file access'],
  [/\\(?:write18|ShellEscape|pdfshellescape|directlua|latelua|luaexec|luadirect|pdfsave|pdfliteral|pdfobj|special|shipout|pdfximage|includegraphics|pgfimage|pgfdeclareimage|pgfuseimage|pdf[A-Za-z]+)(?![A-Za-z])/, 'program, raw output or image'],
  [/\\(?:usepackage|RequirePackage|documentclass|LoadClass|PassOptionsToPackage|usetikzlibrary\s*\{[^}]*(?:external|\.\.)[^}]*\})(?![A-Za-z])/, 'package or class loading'],
  [/\\(?:begin|end)\s*\{\s*(?:document|verbatim|lstlisting|minted)\s*\}/, 'document structure'],
  [/\\(?:catcode|csname|endcsname|scantokens|detokenize|string|uppercase|lowercase|lccode|uccode|jobname|batchmode|nonstopmode|errorstopmode|scrollmode|errhelp|errmessage|message|typeout|verb|url|href|tikzexternalize|pgfplotstableread|pgfplotstablecreatecol|pgfplotsinvokeforeach|ExplSyntaxOn)(?![A-Za-z])/, 'category change, token trick or external'],
  [/\\(?:openup|AtBeginDocument|AtEndDocument|AtEndOfPackage|everyjob|everypar\s*=|output\s*=)(?![A-Za-z])/, 'document hook'],
  [/\\addplot3?\s*(?:\[[^\]]*\])?\s*(?:table|file|gnuplot|graphics)\b/, 'plot from a file or program'],
  [/\bgnuplot\b/, 'gnuplot'],
  [/\^\^/, 'hex escape'],
  [/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/, 'control character']
];
/** Why this TikZ may not be compiled: a list of short reasons, [] when nothing in it reaches outside TeX's own drawing. */
export function untrustedTikz(tikz) {
  const s = String(tikz ?? '');
  const out = [];
  if (!/^\s*\\begin\{tikzpicture\}/.test(s) || !/\\end\{tikzpicture\}\s*$/.test(s)) out.push('not a single tikzpicture');
  if ((s.match(/\\begin\{tikzpicture\}/g) || []).length !== 1) out.push('not a single tikzpicture');
  if (s.length > 20_000) out.push('too long');
  for (const [re, why] of FORBIDDEN) if (re.test(s)) out.push(why);
  return [...new Set(out)];
}

// ── 2. compile ───────────────────────────────────────────────────────────────
/** The bank's preamble (source/build.py PREAMBLE, as a standalone figure), with the dvisvgm graphics driver first. */
export const PREAMBLE = String.raw`\def\pgfsysdriver{pgfsys-dvisvgm.def}
\documentclass[11pt,border=6pt]{standalone}
\usepackage{amsmath,amssymb,mathtools,xcolor}
\usepackage{tikz,pgfplots}
\usetikzlibrary{arrows.meta,calc,angles,quotes,patterns,decorations.markings,intersections,positioning,3d}
\pgfplotsset{compat=1.18}
\usepgfplotslibrary{fillbetween}
\renewcommand{\familydefault}{\sfdefault}
\usepackage{helvet}
\definecolor{ink}{gray}{0.1}\definecolor{soft}{gray}{0.88}\definecolor{mid}{gray}{0.55}
\tikzset{
  pt/.style={circle,fill=ink,inner sep=1.3pt},
  opt/.style={circle,draw=ink,fill=white,inner sep=1.3pt},
  ax/.style={-{Stealth[length=2.2mm]},line width=0.5pt},
  curve/.style={line width=1.1pt,ink},
  aux/.style={dashed,line width=0.5pt,mid},
  region/.style={fill=soft},
  every picture/.style={line cap=round,line join=round,font=\small},
  vec/.style={-{Stealth[length=2.6mm]},line width=0.9pt},
}
\pgfplotsset{hsc/.style={axis lines=middle,axis line style={-{Stealth[length=2.2mm]}},
  xlabel={$x$},ylabel={$y$},xlabel style={anchor=west},ylabel style={anchor=south},
  every axis plot/.append style={line width=1.1pt,ink,no markers,samples=200},
  width=7.2cm,height=5.6cm,axis on top,tick label style={font=\footnotesize,fill=white,inner sep=1.2pt},xticklabel style={anchor=north east,xshift=1pt,yshift=-2pt},yticklabel style={anchor=east,xshift=-1pt},clip=true,clip mode=individual}}
\begin{document}
`;

export function toolchain() {
  if (process.env.PRI_QBANK_NO_TEX === '1') return null;   // as on CI, which has no TeX: the compile tests are skipped by name
  const have = name => [...TEX_BIN.map(d => path.join(d, name))].find(p => fs.existsSync(p)) ?? null;
  const latex = have('latex'), dvisvgm = have('dvisvgm');
  return latex && dvisvgm ? { latex, dvisvgm, bin: path.dirname(latex) } : null;
}
const texEnv = (bin, home) => ({ PATH: `${bin}:/usr/bin:/bin`, HOME: home, LANG: 'C', TMPDIR: home, openin_any: 'p', openout_any: 'p', shell_escape: 'f', TEXMFOUTPUT: home });

/** Compile one figure in a fresh directory under `work`. Returns { svg, warnings } or { error }. The TikZ must already have passed untrustedTikz. */
export async function compileFigure(id, tikz, work, tools = toolchain()) {
  if (!tools) return { error: 'no latex and dvisvgm on this machine' };
  const bad = untrustedTikz(tikz);
  if (bad.length) return { error: `rejected before compile: ${bad.join(', ')}` };
  const dir = path.join(work, 'tex', id.replace(/[^A-Za-z0-9-]/g, '_'));
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'fig.tex'), `${PREAMBLE}${tikz}\n\\end{document}\n`);
  const env = texEnv(tools.bin, dir);
  try {
    await run(tools.latex, ['-no-shell-escape', '-interaction=nonstopmode', '-halt-on-error', '-output-format=dvi', 'fig.tex'], { cwd: dir, env, timeout: 90_000, maxBuffer: 8 << 20 });
  } catch (e) {
    const log = safe(() => fs.readFileSync(path.join(dir, 'fig.log'), 'utf8'), '');
    const line = /^! .*$/m.exec(log)?.[0] ?? String(e.message).split('\n')[0];
    return { error: `latex: ${line.slice(0, 160)}` };
  }
  let out;
  try {
    out = await run(tools.dvisvgm, ['--no-fonts', '--exact-bbox', '--precision=3', '--optimize', '-o', 'fig.svg', 'fig.dvi'], { cwd: dir, env, timeout: 60_000, maxBuffer: 8 << 20 });
  } catch (e) { return { error: `dvisvgm: ${String(e.stderr || e.message).split('\n')[0].slice(0, 160)}` }; }
  const warnings = `${out.stderr}\n${out.stdout}`.split('\n').filter(l => /warning/i.test(l)).map(l => l.trim().slice(0, 120));
  const svg = safe(() => fs.readFileSync(path.join(dir, 'fig.svg'), 'utf8'));
  fs.rmSync(dir, { recursive: true, force: true });
  return svg ? { svg, warnings } : { error: 'dvisvgm wrote no file' };
}

// ── 3. normalise, sanitise, verify ───────────────────────────────────────────
const px = pt => Math.round(pt * (4 / 3) * 100) / 100;
/** The same SVG every run: no XML declaration or generator comment, width and height in px, a compact body. */
export function normaliseSvg(raw) {
  let s = String(raw).replace(/^﻿/, '').replace(/<\?xml[^>]*\?>\s*/g, '').replace(/<!--[\s\S]*?-->\s*/g, '');
  s = s.replace(/<svg\b[^>]*>/, tag => {
    const vb = /viewBox='([^']+)'/.exec(tag)?.[1] ?? /viewBox="([^"]+)"/.exec(tag)?.[1];
    if (!vb) return tag;
    const [, , w, h] = vb.split(/\s+/).map(Number);
    return `<svg xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink' width='${px(w)}' height='${px(h)}' viewBox='${vb}'>`;
  });
  return s.replace(/\r\n?/g, '\n').replace(/[ \t]+\n/g, '\n').replace(/\n{2,}/g, '\n').trim() + '\n';
}

const ELEMENTS = new Set(['svg', 'defs', 'g', 'path', 'use', 'rect', 'line', 'polyline', 'polygon', 'circle', 'ellipse', 'clipPath', 'pattern', 'symbol', 'radialGradient', 'linearGradient', 'stop']);
const ATTRS = new Set(['xmlns', 'xmlns:xlink', 'width', 'height', 'viewBox', 'id', 'd', 'x', 'y', 'x1', 'y1', 'x2', 'y2', 'cx', 'cy', 'r', 'rx', 'ry', 'points',
  'transform', 'fill', 'stroke', 'stroke-width', 'stroke-linecap', 'stroke-linejoin', 'stroke-miterlimit', 'stroke-dasharray', 'stroke-dashoffset',
  'stroke-opacity', 'fill-opacity', 'opacity', 'fill-rule', 'clip-rule', 'clip-path', 'xlink:href', 'patternUnits', 'patternTransform', 'patternContentUnits', 'version', 'offset', 'stop-color', 'stop-opacity', 'fx', 'fy', 'x1', 'gradientUnits', 'gradientTransform', 'spreadMethod', 'style']);
/** Why this SVG may not be served: [] when it is a plain, inert drawing. Fails on anything outside the allow-list. */
export function sanitiseProblems(svg) {
  const s = String(svg);
  const out = [];
  if (!/^<svg\b[^>]*viewBox='[^']+'/.test(s) || !/<\/svg>\s*$/.test(s)) out.push('not a bare svg with a viewBox');
  if (/<script|<foreignObject|<image|<style|<a[\s>]|<iframe|<object|<embed|<animate|<set[\s>]|<!ENTITY|<!DOCTYPE|<!\[CDATA\[|<\?/i.test(s)) out.push('forbidden element or declaration');
  if (/\son[a-z]+\s*=/i.test(s)) out.push('event attribute');
  if (/javascript:|data:|vbscript:|https?:|\/\//i.test(s.replace(/xmlns(?::xlink)?='http:\/\/www\.w3\.org\/[^']+'/g, ''))) out.push('external or script reference');
  if (/url\(\s*(?!#)/i.test(s)) out.push('external url()');
  for (const tag of s.matchAll(/<\s*(\/?)([A-Za-z][\w:-]*)((?:\s+[^<>]*?)?)\s*(\/?)>/g)) {
    const [, close, name, attrs] = tag;
    if (!ELEMENTS.has(name)) { out.push(`element ${name}`); continue; }
    if (close) continue;
    for (const a of attrs.matchAll(/([A-Za-z_:][\w:.-]*)\s*=\s*(?:'([^']*)'|"([^"]*)")/g)) {
      if (!ATTRS.has(a[1])) out.push(`attribute ${a[1]}`);
      // The one inline style dvisvgm writes (a gradient fill, from `ball color`); any other style is refused.
      if (a[1] === 'style' && !/^fill:url\(#[\w-]+\);\s*stroke:none$/.test(a[2] ?? a[3] ?? '')) out.push('style attribute');
      if (a[1] === 'xlink:href' && !/^#[\w-]+$/.test(a[2] ?? a[3] ?? '')) out.push('xlink:href that is not a local id');
    }
  }
  return [...new Set(out)];
}

/** Number of drawing elements outside <defs>: a figure with none is empty. */
export function drawnCount(svg) {
  const body = String(svg).replace(/<defs>[\s\S]*?<\/defs>/g, '');
  return (body.match(/<(?:path|line|rect|circle|ellipse|polyline|polygon|use)\b/g) || []).length;
}
export function svgSize(svg) {
  const m = /<svg\b[^>]*width='([\d.]+)' height='([\d.]+)'/.exec(svg);
  return m ? { w: Number(m[1]), h: Number(m[2]) } : { w: 0, h: 0 };
}

/** Why a normalised figure is not good enough to serve: [] when it is. */
export function verifyFigure(svg) {
  const out = [...sanitiseProblems(svg)];
  const bytes = Buffer.byteLength(svg);
  if (bytes > MAX_FIGURE_BYTES) out.push(`size ${bytes} over ${MAX_FIGURE_BYTES}`);
  if (drawnCount(svg) < 1) out.push('nothing drawn');
  const { w, h } = svgSize(svg);
  if (!(w >= 12 && w <= 1200 && h >= 12 && h <= 1200)) out.push(`size ${w}x${h} px out of range`);
  return out;
}

// ── 4. what the TikZ shows, for the text alternative and the answer-leak test ─
function grab(s, i, open, close) {
  // s[i] === open; the text inside the balanced pair and the index after it, or null.
  let depth = 0;
  for (let j = i; j < s.length; j++) {
    const c = s[j];
    if (c === '\\') { j++; continue; }
    if (c === open) depth++;
    else if (c === close && --depth === 0) return { text: s.slice(i + 1, j), end: j + 1 };
  }
  return null;
}
/** Split on commas at depth 0 of braces, brackets and parentheses. */
function splitTop(s) {
  const out = []; let depth = 0, cur = '';
  for (const c of s) {
    if ('{[('.includes(c)) depth++;
    if ('}])'.includes(c)) depth--;
    if (c === ',' && depth === 0) { out.push(cur); cur = ''; } else cur += c;
  }
  if (cur.trim()) out.push(cur);
  return out.map(x => x.trim()).filter(Boolean);
}
const optionValue = (opts, key) => {
  for (const o of splitTop(opts)) { const m = new RegExp(`^${key}\\s*=\\s*([\\s\\S]*)$`).exec(o); if (m) return m[1].trim(); }
  return null;
};
const unbrace = v => (v && v.startsWith('{') && v.endsWith('}') ? v.slice(1, -1) : v);

/** The texts a figure prints (node text, label= and pin= values, quotes-style angle labels), as TeX, in source order. */
export function figureTexts(tikz) {
  const out = [];
  const s = String(tikz);
  const add = t => { const x = String(t ?? '').trim(); if (x) out.push(x); };
  for (const m of s.matchAll(/\\node\b|\bnode\b|\\coordinate\b|\\draw\b|\\path\b|\\fill\b|\\filldraw\b|\\pic\b/g)) {
    let i = m.index + m[0].length;
    const skip = () => { while (/\s/.test(s[i] ?? '')) i++; };
    skip();
    if (s[i] === '[') {
      const g = grab(s, i, '[', ']');
      if (g) {
        for (const o of splitTop(g.text)) {
          const lab = /^(?:label|pin)(?:\s*\[[^\]]*\])?\s*=\s*([\s\S]*)$/.exec(o);
          if (lab) { const v = lab[1].trim(); const br = v.indexOf('{'); if (br >= 0) { const gg = grab(v, br, '{', '}'); if (gg) add(gg.text); } else add(v.replace(/^[a-z ]+:/, '')); }
          const q = /"([^"]+)"/.exec(o); if (q) add(q[1]);
        }
        i = g.end;
      }
    }
    skip();
    if (/^\\node\b|^node\b/.test(m[0])) {
      if (s[i] === '(') { const g = grab(s, i, '(', ')'); if (g) i = g.end; skip(); }
      if (s.startsWith('at', i)) { i += 2; skip(); if (s[i] === '(') { const g = grab(s, i, '(', ')'); if (g) i = g.end; } skip(); }
      if (s[i] === '{') { const g = grab(s, i, '{', '}'); if (g) add(g.text); }
    }
  }
  // Axis: tick labels and axis titles.
  for (const m of s.matchAll(/\b(xticklabels|yticklabels|xlabel|ylabel|title)\s*=\s*\{/g)) {
    const g = grab(s, m.index + m[0].length - 1, '{', '}');
    if (g && !/\\empty/.test(g.text)) for (const t of (m[1].endsWith('labels') ? splitTop(g.text) : [g.text])) add(t.replace(/^\{|\}$/g, ''));
  }
  return out;
}

/** Ticks the axes print: [{ axis, values: [number], labels: [TeX] | null }]. Auto ticks (no xtick/ytick) are not known and are not listed. */
export function figureTicks(tikz) {
  const s = String(tikz), out = [];
  for (const m of s.matchAll(/\b([xy])tick\s*=\s*\{([^}]*)\}/g)) {
    const values = m[2].split(',').map(v => v.trim()).filter(Boolean).map(Number).filter(Number.isFinite);
    if (!values.length) continue;
    const lm = new RegExp(`\\b${m[1]}ticklabels\\s*=\\s*\\{`).exec(s);
    const g = lm ? grab(s, lm.index + lm[0].length - 1, '{', '}') : null;
    const labels = g ? splitTop(g.text).map(t => t.replace(/^\{|\}$/g, '')) : null;
    out.push({ axis: m[1], values, labels: labels && labels.length === values.length ? labels : null, mislabelled: !!lm && !(labels && labels.length === values.length) });
  }
  return out;
}

const GREEK = { theta: 'theta', alpha: 'alpha', beta: 'beta', gamma: 'gamma', delta: 'delta', phi: 'phi', pi: 'pi', lambda: 'lambda', mu: 'mu', sigma: 'sigma', omega: 'omega' };
/** A TeX label as plain words, or null when it holds something this does not translate (the label is then left out, never guessed). */
export function spoken(tex) {
  let t = String(tex).replace(/\$/g, '').replace(/\\(?:small|scriptsize|footnotesize|tiny|large|normalsize)\b/g, '').replace(/\\[,;:! ]/g, ' ').trim();
  const mathrm = /\\(?:mathbf|mathrm|textbf|text|mathit|textit|boldsymbol|vec|overrightarrow)\s*\{([^{}]*)\}/g;
  t = t.replace(mathrm, '$1');
  for (let k = 0; k < 4; k++) t = t.replace(/\\[dt]?frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, '($1 over $2)').replace(/\\sqrt\s*\{([^{}]*)\}/g, '(square root of $1)').replace(/\\sqrt\s*(\d)/g, '(square root of $1)');
  t = t.replace(/\^\s*\\circ|\^\s*\{\\circ\}/g, ' degrees').replace(/\^\s*\{?2\}?/g, ' squared').replace(/\^\s*\{?3\}?/g, ' cubed').replace(/\\cdot|\\times/g, ' times ')
    .replace(/\\(?:le|leq)\b/g, ' at most ').replace(/\\(?:ge|geq)\b/g, ' at least ').replace(/\\(?:ldots|dots|cdots)\b/g, '...').replace(/\\ln\b/g, 'ln ').replace(/\\log\b/g, 'log ')
    .replace(/\\(sin|cos|tan)\b/g, '$1 ').replace(/\\prime\b|'/g, ' prime').replace(/\\approx|\\sim/g, ' about ')
    .replace(/\\([A-Za-z]+)/g, (all, name) => (GREEK[name] ? ` ${GREEK[name]} ` : all)).replace(/\\\\/g, ' ');
  t = t.replace(/_\s*\{?([A-Za-z0-9]+)\}?/g, ' sub $1').replace(/[{}]/g, '').replace(/\s+/g, ' ').replace(/\s+([,.)])/g, '$1').replace(/\(\s+/g, '(').trim();
  if (!t || /[\\^_&#%~]/.test(t) || t.length > 60) return null;
  return t.replace(/(^|[\s(,])-(?=\s?[\dA-Za-z(])/g, '$1minus ').replace(/minus\s+/g, 'minus ');
}

/**
 * The shape of a drawing as far as the source states it outright. Only what is certain is returned: with a loop (\\foreach) in the source the
 * number of things drawn is not stated outright, so no count is claimed.
 */
export function figureFacts(tikz) {
  const s = String(tikz);
  const loop = /\\foreach/.test(s);
  const facts = { axis: /\\begin\{axis\}/.test(s), loop, plots: 0, dashed: 0, shaded: false, closed: 0, circles: 0, xlabel: null, ylabel: null, range: {} };
  if (facts.axis) {
    const head = /\\begin\{axis\}\s*\[/.exec(s);
    let opts = '';
    if (head) { const g = grab(s, head.index + head[0].length - 1, '[', ']'); opts = g?.text ?? ''; }
    // The bank's `hsc` axis style titles the axes x and y unless the figure says otherwise; without it nothing is assumed.
    const hsc = splitTop(opts).includes('hsc');
    facts.xlabel = unbrace(optionValue(opts, 'xlabel')) ?? (hsc ? '$x$' : null);
    facts.ylabel = unbrace(optionValue(opts, 'ylabel')) ?? (hsc ? '$y$' : null);
    for (const k of ['xmin', 'xmax', 'ymin', 'ymax']) for (const o of splitTop(opts)) { const m = new RegExp(`^${k}\\s*=\\s*(-?[\\d.]+)$`).exec(o); if (m) facts.range[k] = Number(m[1]); }
    for (const m of s.matchAll(/\\addplot3?\s*\+?\s*(\[[^\]]*\])?/g)) {
      const o = m[1] ?? '';
      facts.plots++;
      if (/\b(?:dashed|dotted|densely dashed|loosely dashed|dash pattern|aux)\b/.test(o)) facts.dashed++;
      if (/\bfill\b(?!\s*=\s*none)|\bpattern\b/.test(o)) facts.shaded = true;
    }
    if (/\\closedcycle|fillbetween/.test(s)) facts.shaded = true;
  }
  for (const m of s.matchAll(/\\(draw|fill|filldraw)\b([^;]*);/g)) {
    const stmt = m[2];
    if (/--\s*cycle\b/.test(stmt)) { facts.closed++; if (m[1] !== 'draw' && /\bfill\b|\\fill/.test(m[1])) facts.shaded = facts.shaded || facts.axis; }
    // A dot, `circle (1.5pt)` or `circle[radius=1pt]`, is a marked point and not a circle.
    facts.circles += (stmt.match(/\bcircle\b/g) || []).length - (stmt.match(/\bcircle\s*(?:\[[^\]]*\bradius\s*=\s*[\d.]+\s*pt[^\]]*\]|\(\s*[\d.]+\s*pt\s*\))/g) || []).length;
  }
  return facts;
}

/** Text-alternative parts for one figure: { structure, ticks, labels, dropped } (strings or null). */
export function altParts(tikz) {
  const f = figureFacts(tikz);
  const bits = [];
  if (f.axis) {
    const xl = f.xlabel && spoken(f.xlabel), yl = f.ylabel && spoken(f.ylabel);
    bits.push(`Graph drawn on ${xl && yl ? `${xl} and ${yl} axes` : 'a pair of axes'}`);
    if (f.plots && !f.loop) bits.push(`${f.plots} ${f.plots === 1 ? 'plotted line, curve or set of points is' : 'plotted lines, curves or sets of points are'} drawn`);
    if (f.dashed) bits.push('some of the plotted lines are dashed');
    if (f.shaded) bits.push('a region is shaded');
  } else if (!f.loop) {
    if (f.closed) bits.push(`${f.closed} closed ${f.closed === 1 ? 'shape is' : 'shapes are'} drawn`);
    if (f.circles) bits.push(`${f.circles} ${f.circles === 1 ? 'circle is' : 'circles are'} drawn`);
  }
  const structure = bits.length ? `${bits.join('; ')}.` : null;
  // What is printed at each tick: its label when the source gives one, else its number. An axis whose labels cannot be put into words is left out.
  const inRange = (axis, x) => !((f.range[`${axis}min`] !== undefined && x < f.range[`${axis}min`]) || (f.range[`${axis}max`] !== undefined && x > f.range[`${axis}max`]));
  const ticks = figureTicks(tikz).map(t => {
    if (t.mislabelled || !t.values.every(x => inRange(t.axis, x))) return null;
    const shown = t.labels ? t.labels.map(spoken) : t.values.map(v => spoken(String(v)));
    return shown.every(x => x !== null && x !== '') ? { axis: t.axis, values: t.values, shown } : null;
  }).filter(Boolean);
  const tickWords = ticks.map(t => `${t.axis === 'x' ? 'horizontal' : 'vertical'} axis: ${t.shown.join(', ')}`).join('; ');
  const texts = figureTexts(tikz);
  const words = []; let dropped = 0;
  for (const t of texts) {
    const w = spoken(t);
    if (w === null) { dropped++; continue; }
    if (!words.includes(w)) words.push(w);
  }
  const axisNames = new Set([f.xlabel, f.ylabel].filter(Boolean).map(spoken).filter(Boolean));
  const shown = words.filter(w => !(f.axis && axisNames.has(w))).slice(0, 24);
  return { structure, ticks: ticks.length ? { text: `Marked on the ${tickWords}.`, values: ticks } : null, labels: shown.length ? { words: shown, partial: dropped > 0 || shown.length < words.length } : null, dropped };
}

// ── 5. does the figure, or its text, show the answer? ────────────────────────
/** The numbers an answer key states outright (a set's values, a point's coordinates, a numeric value). */
export function answerNumbers(part) {
  const a = part?.answer;
  if (!a) return [];
  if (part.answerType === 'numeric' && Number.isFinite(a.value)) return [a.value];
  if (part.answerType === 'set' && Array.isArray(a.values)) return a.values.filter(Number.isFinite);
  if (part.answerType === 'point' && Number.isFinite(a.x) && Number.isFinite(a.y)) return [a.x, a.y];
  return [];
}
const asQuestion = part => ({ prompt: part.prompt, answerType: part.answerType, answer: part.answer, difficulty: part.difficulty ?? 2, subtopic: 'qbank-figure', steps: [], hints: [], traps: [] });
const numericProbe = v => ({ prompt: '', answerType: 'numeric', answer: { value: v, tol: Math.max(1e-6, Math.abs(v) * 2e-4) }, difficulty: 2, subtopic: 'qbank-figure', steps: [], hints: [], traps: [] });

/** The strings a reader of a text could take for a typed answer (a math span, the right of an `=`, a whole short text). */
function candidatesOf(text) {
  const t = String(text), cands = new Set();
  const add = x => { const p = String(x).trim(); if (p && p.length <= 120) cands.add(p); };
  add(t);
  for (const m of t.matchAll(/(?<!\\)\$((?:\\\$|[^$])+?)(?<!\\)\$/g)) { const plain = safe(() => plainTex(m[1]), null); if (plain) { add(plain); for (const piece of String(plain).split(/=/).slice(1)) add(piece); } }
  const plain = safe(() => plainTex(t), null);
  if (plain) { add(plain); for (const piece of String(plain).split(/=/).slice(1)) add(piece); }
  for (const piece of t.split(/[,;:]|\band\b/)) add(piece);
  return cands;
}
const NEAR = v => Math.max(1e-6, Math.abs(v) * 2e-3);
/** Does `text` (a label, or a part of an alt text) state the number v, or (for any key) the whole answer? */
const textHasNumber = (text, v) => { for (const c of candidatesOf(text)) if (safe(() => checkAnswer(numericProbe(v), c), {}).correct === true) return true; return false; };
const textHasKey = (part, text) => { const q = asQuestion(part); for (const c of candidatesOf(text)) if (safe(() => checkAnswer(q, c), {}).correct === true) return true; return false; };
/** Does the question's own text state the number (then a figure that shows it gives nothing away)? */
function statesNumber(prompt, v) {
  if (textHasNumber(String(prompt).replace(/\$/g, ' $ '), v)) return true;
  for (const m of String(prompt).matchAll(/-?\d+(?:\.\d+)?/g)) if (Math.abs(Number(m[0]) - v) <= NEAR(v)) return true;
  return false;
}
/** The part of the key a piece of text gives away: true when it states a number of the key, or the whole key, that the question does not state. */
export function statesAnswer(part, text) {
  const nums = answerNumbers(part);
  if (nums.some(v => textHasNumber(text, v) && !statesNumber(part.prompt, v))) return true;
  return textHasKey(part, text) && !(nums.length && nums.every(v => statesNumber(part.prompt, v)));
}
/**
 * What in the figure's printed text, or at its ticks, states the answer of this part and is not also in the question. [] when nothing does.
 * A figure that does is NOT served: it is listed for the owner (a figure may show a value the question asks the student to find).
 * Axes with no xtick/ytick print automatic ticks, which the source does not state and which are not tested.
 */
export function figureLeaks(tikz, part) {
  const out = figureTexts(tikz).filter(t => statesAnswer(part, t));
  const nums = answerNumbers(part);
  for (const tk of figureTicks(tikz)) for (const x of tk.values) if (nums.some(v => Math.abs(x - v) <= NEAR(v) && !statesNumber(part.prompt, v))) out.push(`${tk.axis}tick ${x}`);
  return [...new Set(out)];
}

/**
 * The text alternative of a figure for a question (its auto-markable parts all share the figure). Built only from what the TikZ states:
 * its structure, the labels it prints and the values at its ticks. The fullest version is tried first and a version that states an answer
 * of any part is dropped in favour of a shorter one; with nothing left, the neutral sentence. Returns { alt, kind: 'generated' | 'neutral' }.
 */
export function figureAlt(tikz, parts) {
  const p = altParts(tikz);
  const compose = ({ ticks, labels }) => {
    const bits = [p.structure ?? 'Diagram.'];
    if (labels) bits.push(`${labels.partial ? 'Labels include' : 'Labels shown'}: ${labels.words.join(', ')}.`);
    if (ticks) bits.push(ticks.text);
    bits.push('Read the question for what it asks.');
    return bits.join(' ');
  };
  const tries = [{ ticks: p.ticks, labels: p.labels }, { ticks: null, labels: p.labels }, { ticks: p.ticks, labels: null }, { ticks: null, labels: null }];
  for (const t of tries) {
    if (!p.structure && !t.labels && !t.ticks) break;
    const alt = compose(t);
    if (alt.length <= 420 && !parts.some(part => altStates(part, t))) return { alt, kind: 'generated' };
  }
  return { alt: NEUTRAL_ALT, kind: 'neutral' };
}
/** Would these pieces of an alt text state an answer of the part that the question does not already state? */
function altStates(part, t) {
  const nums = answerNumbers(part);
  const texts = [...(t.labels?.words ?? []), ...(t.ticks?.values ?? []).flatMap(tk => tk.shown)];
  if (texts.some(w => statesAnswer(part, w))) return true;
  for (const tk of t.ticks?.values ?? []) for (const x of tk.values) if (nums.some(v => Math.abs(x - v) <= NEAR(v) && !statesNumber(part.prompt, v))) return true;
  return false;
}

// ── 6. the figures set (what the pack and the server read) ───────────────────
/** results.json written by `render`: { format, figures: { <question id>: { ok, ... } } }. */
export function loadFigureResults(dir) {
  const file = path.join(dir, 'results.json');
  const data = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (data.format !== FIGURES_FORMAT) throw new Error(`${file} is not ${FIGURES_FORMAT}`);
  const svgs = new Map();
  for (const [id, r] of Object.entries(data.figures)) if (r.ok) svgs.set(id, fs.readFileSync(path.join(dir, 'svg', `${id}.svg`), 'utf8'));
  return { results: new Map(Object.entries(data.figures)), svgs };
}

/** The figure a question may be packed with: it rendered, verified, and shows no answer. Else null. */
export const packableFigure = (figures, questionId) => {
  const r = figures?.results.get(questionId);
  return r && r.ok && !r.leaks?.length ? r : null;
};

/** What the pack carries for a question with a figure (public: shown to the student). */
export const figureRef = r => ({ alt: r.alt, w: r.w, h: r.h, sha256: r.sha256, bytes: r.bytes });

/** Files of the figures directory for the given packed question ids: figures/<id>.svg and figures/manifest.json. */
export function figureFiles(figures, ids) {
  const files = new Map();
  const entries = [];
  for (const id of [...new Set(ids)].sort()) {
    const r = packableFigure(figures, id);
    const svg = figures.svgs.get(id);
    if (!r || !svg) throw new Error(`no verified figure for ${id}`);
    files.set(`figures/${id}.svg`, svg);
    entries.push({ id, sha256: r.sha256, bytes: r.bytes, w: r.w, h: r.h, alt: r.altKind });
  }
  files.set('figures/manifest.json', JSON.stringify({ format: FIGURES_FORMAT, count: entries.length, bytes: entries.reduce((s, e) => s + e.bytes, 0), figures: entries }) + '\n');
  return files;
}

/** Verify a figures directory (the committed one by default) against its manifest and the sanitiser. Returns { problems, count, bytes }. */
export function checkFiguresDir(dir = FIGURES_DIR) {
  const problems = [];
  const mfile = path.join(dir, 'manifest.json');
  if (!fs.existsSync(mfile)) return { problems: [`no ${mfile}`], count: 0, bytes: 0 };
  const m = JSON.parse(fs.readFileSync(mfile, 'utf8'));
  if (m.format !== FIGURES_FORMAT) problems.push('manifest format');
  const listed = new Set(m.figures.map(f => `${f.id}.svg`));
  const onDisk = fs.readdirSync(dir).filter(f => f.endsWith('.svg'));
  for (const f of onDisk) if (!listed.has(f)) problems.push(`${f} is not in the manifest`);
  let bytes = 0;
  for (const f of m.figures) {
    const file = path.join(dir, `${f.id}.svg`);
    if (!/^[AX][0-9]{2}-[A-Z][0-9]-[A-Z0-9]{3}$/.test(f.id)) { problems.push(`${f.id}: bad id`); continue; }
    if (!fs.existsSync(file)) { problems.push(`${f.id}: file missing`); continue; }
    const buf = fs.readFileSync(file);
    bytes += buf.length;
    if (buf.length !== f.bytes || sha256(buf) !== f.sha256) problems.push(`${f.id}: does not match the manifest`);
    for (const p of verifyFigure(buf.toString('utf8'))) problems.push(`${f.id}: ${p}`);
  }
  if (m.count !== m.figures.length) problems.push('manifest count');
  return { problems, count: m.figures.length, bytes };
}

// ── 7. command line ──────────────────────────────────────────────────────────
function insideRepo(p) { const rel = path.relative(ROOT, path.resolve(p)); return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel)); }

async function pool(items, jobs, fn) {
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(jobs, items.length) }, async () => { for (;;) { const i = next++; if (i >= items.length) return; await fn(items[i], i); } }));
}

export async function main(argv) {
  const flag = name => { const i = argv.findIndex(a => a === `--${name}`); return i >= 0 ? argv[i + 1] : null; };
  if (argv[0] === 'check') {
    const r = checkFiguresDir();
    if (r.problems.length) { console.error(`QBANK FIGURES: FAIL ${r.problems.length}\n  ${r.problems.slice(0, 20).join('\n  ')}`); return 1; }
    console.log(`QBANK FIGURES: PASS, ${r.count} figures, ${r.bytes} bytes, every file matches the manifest and the sanitiser`);
    return 0;
  }
  if (argv[0] === 'render') {
    const archive = argv[1], work = flag('work');
    if (!archive || !work || archive.startsWith('--')) { console.error('usage: node tools/qbank-diagrams.mjs render <archive-dir> --work <dir> [--ids a,b] [--limit N] [--jobs N]'); return 2; }
    if (insideRepo(work)) { console.error(`refusing to work inside the repository: ${work}`); return 2; }
    const tools = toolchain();
    if (!tools) { console.error('latex and dvisvgm are not installed on this machine'); return 2; }
    const base = fs.existsSync(path.join(archive, 'data', 'pritagoras_qbank.json')) ? path.join(archive, 'data') : archive;
    const questions = JSON.parse(fs.readFileSync(path.join(base, 'pritagoras_qbank.json'), 'utf8'));
    const marking = JSON.parse(fs.readFileSync(path.join(base, 'pritagoras_marking.json'), 'utf8'));
    const partsOf = new Map();
    for (const p of marking) if (['numeric', 'expression', 'set', 'interval', 'equation', 'point'].includes(p.answerType)) (partsOf.get(p.question) || partsOf.set(p.question, []).get(p.question)).push(p);
    const only = flag('ids') ? new Set(flag('ids').split(',')) : null;
    let todo = questions.filter(q => q.tikz && (!only || only.has(q.id))).sort((a, b) => (a.id < b.id ? -1 : 1));
    if (flag('limit')) todo = todo.slice(0, Number(flag('limit')));
    fs.mkdirSync(path.join(work, 'svg'), { recursive: true });
    const prior = safe(() => JSON.parse(fs.readFileSync(path.join(work, 'results.json'), 'utf8')).figures, {}) || {};
    const figures = { ...prior };
    const jobs = Number(flag('jobs')) || Math.max(1, Math.min(6, os.cpus().length - 1));
    await pool(todo, jobs, async q => {
      const tikzHash = sha256(Buffer.from(q.tikz)).slice(0, 16);
      const parts = partsOf.get(q.id) || [];
      const have = prior[q.id];
      let svg = null, warnings = [], error = null;
      if (have?.ok && have.tikz === tikzHash && fs.existsSync(path.join(work, 'svg', `${q.id}.svg`))) svg = fs.readFileSync(path.join(work, 'svg', `${q.id}.svg`), 'utf8');
      else {
        const r = await compileFigure(q.id, q.tikz, work, tools);
        if (r.error) error = r.error; else { svg = normaliseSvg(r.svg); warnings = r.warnings; }
      }
      const problems = svg ? verifyFigure(svg) : [];
      if (svg && !problems.length) fs.writeFileSync(path.join(work, 'svg', `${q.id}.svg`), svg);
      const ok = !!svg && !problems.length && !error;
      const size = ok ? svgSize(svg) : { w: 0, h: 0 };
      const leaks = ok ? [...new Set(parts.flatMap(p => figureLeaks(q.tikz, p)))] : [];
      const alt = ok ? figureAlt(q.tikz, parts) : { alt: null, kind: null };
      figures[q.id] = { ok, tikz: tikzHash, ...(ok ? { sha256: sha256(Buffer.from(svg)), bytes: Buffer.byteLength(svg), ...size, alt: alt.alt, altKind: alt.kind } : {}), ...(leaks.length ? { leaks } : {}), ...(error ? { error } : {}), ...(problems.length ? { problems } : {}), ...(warnings.length ? { warnings: [...new Set(warnings)] } : {}) };
    });
    const sorted = Object.fromEntries(Object.entries(figures).sort(([a], [b]) => (a < b ? -1 : 1)));
    fs.writeFileSync(path.join(work, 'results.json'), JSON.stringify({ format: FIGURES_FORMAT, figures: sorted }, null, 1) + '\n');
    const all = Object.values(sorted), okAll = all.filter(f => f.ok);
    console.log(`rendered ${okAll.length} of ${all.length} figures; failed ${all.length - okAll.length}; ${okAll.reduce((s, f) => s + f.bytes, 0)} bytes`);
    const why = {}; for (const f of all.filter(x => !x.ok)) { const k = (f.error || f.problems?.join('; ') || 'unknown').replace(/\d+/g, 'N').slice(0, 60); why[k] = (why[k] || 0) + 1; }
    console.log('failures', JSON.stringify(why));
    console.log(`alt text: generated ${okAll.filter(f => f.altKind === 'generated').length}, neutral ${okAll.filter(f => f.altKind === 'neutral').length}; figures that show an answer: ${okAll.filter(f => f.leaks?.length).length}`);
    return 0;
  }
  console.error('usage: node tools/qbank-diagrams.mjs render <archive-dir> --work <dir> | check');
  return 2;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).then(code => { process.exitCode = code; });
}
