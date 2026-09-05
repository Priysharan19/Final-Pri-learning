// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · CSV — the roster a teacher already has, pasted or exported
// from a school system, one student per line. No dependency, no network.
// ─────────────────────────────────────────────────────────────────────────────

/** Split CSV text into rows of cells. Quotes, doubled quotes, CR/LF and a BOM are handled. */
export function parseCsv(text) {
  const src = String(text ?? '').replace(/^﻿/, '');
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"') {
        if (src[i + 1] === '"') { cell += '"'; i++; } else quoted = false;
      } else cell += c;
      continue;
    }
    if (c === '"') { quoted = true; continue; }
    if (c === ',' || c === '\t' || c === ';') { row.push(cell); cell = ''; continue; }
    if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      rows.push(row); row = [];
      continue;
    }
    cell += c;
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  return rows.map(r => r.map(x => x.trim())).filter(r => r.some(Boolean));
}

const HEADER_WORDS = {
  name: ['name', 'student', 'student name', 'full name', 'pupil'],
  year: ['class', 'year', 'grade', 'std', 'standard'],
  track: ['track', 'stream', 'course track', 'india track'],
  course: ['course', 'syllabus', 'board']
};

function headerIndex(cells) {
  const lower = cells.map(c => c.toLowerCase());
  const at = key => lower.findIndex(c => HEADER_WORDS[key].includes(c));
  const idx = { name: at('name'), year: at('year'), track: at('track'), course: at('course') };
  return idx.name >= 0 ? idx : null;
}

const TRACKS = { cbse: 'cbse', ncert: 'cbse', jee: 'jee-main', 'jee main': 'jee-main', 'jee-main': 'jee-main', 'jee advanced': 'jee-advanced', 'jee-advanced': 'jee-advanced', olympiad: 'olympiad', ioqm: 'olympiad', prmo: 'olympiad' };

function cleanTrack(value) {
  const key = String(value || '').trim().toLowerCase();
  return TRACKS[key] || null;
}

function cleanYear(value) {
  const n = Number(String(value || '').replace(/[^0-9]/g, ''));
  return Number.isInteger(n) && n >= 7 && n <= 12 ? n : null;
}

/**
 * Roster rows for POST /classes/:id/roster. A header row is optional and is
 * recognised by its words (name, class/year, track, course); without one the
 * columns are taken as name, class, track. Blank names are dropped here so the
 * count the teacher sees is the count of students, not of lines.
 */
export function parseRoster(text) {
  const rows = parseCsv(text);
  if (!rows.length) return [];
  const header = headerIndex(rows[0]);
  const body = header ? rows.slice(1) : rows;
  const idx = header || { name: 0, year: 1, track: 2, course: -1 };
  const out = [];
  for (const cells of body) {
    const name = (cells[idx.name] || '').trim();
    if (!name) continue;
    const row = { name };
    const year = idx.year >= 0 ? cleanYear(cells[idx.year]) : null;
    if (year) row.class = year;
    const track = idx.track >= 0 ? cleanTrack(cells[idx.track]) : null;
    if (track) row.track = track;
    const course = idx.course >= 0 ? String(cells[idx.course] || '').trim().toLowerCase() : '';
    if (course === 'in' || course === 'india' || course === 'cbse') row.course = 'in';
    else if (course === 'nsw' || course === 'hsc') row.course = 'nsw';
    out.push(row);
    if (out.length >= 200) break;
  }
  return out;
}
