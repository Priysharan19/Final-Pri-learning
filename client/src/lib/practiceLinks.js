// Pri Learning · practice links
//
// Every surface that sends a student into Practice (Home's generator, India
// Progress, the Class X NCERT library) builds its URL here, and Practice reads
// it back here. One builder and one reader means the content certification can
// replay exactly what a button sends — a surface that builds a link the backend
// cannot serve is then a failing certification path, not a broken button.

// CBSE / NCERT practice is held to D1–D3 (adaptive-08), so no surface offers a
// CBSE student a D4 button; the JEE tracks and the olympiad keep D4.
export const CBSE_DIFFICULTIES = Object.freeze([1, 2, 3]);
export const ALL_DIFFICULTIES = Object.freeze([1, 2, 3, 4]);

/** The difficulty buttons a surface may offer in this context. */
export function practiceDifficulties({ course = null, track = null, grade = null, ceiling = null } = {}) {
  const india = course === 'in' || !!track;
  const effective = track === 'jee-main' || track === 'jee-advanced'
    ? (india && grade != null && Number(grade) < 11 ? 'cbse' : track)
    : track || (india ? 'cbse' : null);
  let list = effective === 'cbse' ? [...CBSE_DIFFICULTIES] : [...ALL_DIFFICULTIES];
  if (ceiling) list = list.filter(d => d <= Number(ceiling));
  return list;
}

/** `/practice?…` for a topic or smart request. */
export function practiceHref({ subtopic = null, dotpoint = null, difficulty = null, track = null, pyq = false } = {}) {
  const p = new URLSearchParams();
  if (subtopic) p.set('subtopic', String(subtopic));
  if (subtopic && dotpoint != null && dotpoint !== '') p.set('dotpoint', String(dotpoint));
  // Defence in depth: a CBSE link never carries D4 even if a caller asks.
  const d = difficulty != null && difficulty !== '' && track === 'cbse' ? Math.min(3, Number(difficulty)) : difficulty;
  if (d != null && d !== '') p.set('difficulty', String(d));
  if (track) p.set('track', String(track));
  if (pyq) p.set('pyq', '1');
  const q = p.toString();
  return `/practice${q ? `?${q}` : ''}`;
}

/** The POST /practice/next body Practice sends for a topic or smart link. */
export function practiceRequestFromQuery(params) {
  const get = k => (typeof params?.get === 'function' ? params.get(k) : null);
  const subtopic = get('subtopic');
  const dotpoint = get('dotpoint');
  const difficulty = get('difficulty');
  const track = get('track');
  const pyqOnly = get('pyq') === '1';
  return subtopic
    ? { mode: 'topic', subtopic, track: track || undefined, dotpoint: dotpoint != null ? Number(dotpoint) : undefined, difficulty: difficulty != null ? Number(difficulty) : undefined, pyqOnly: pyqOnly || undefined }
    : { mode: 'smart', track: track || undefined, difficulty: difficulty != null ? Number(difficulty) : undefined, pyqOnly: pyqOnly || undefined };
}

/** The Class X NCERT library's practice button for one chapter at one difficulty. */
export function class10LibraryPracticeHref(chapter, difficulty) {
  return practiceHref({ subtopic: chapter?.id, track: 'cbse', difficulty });
}

/** India Progress's "Practise" button for one chapter row. */
export function indiaProgressPracticeHref(row, track) {
  return practiceHref({ subtopic: row?.id, track: track || 'cbse' });
}

/** The syllabus board's and Priorities' link to one dot point of an India chapter. */
export function indiaDotpointPracticeHref(chapterId, dotpoint, track) {
  return practiceHref({ subtopic: chapterId, dotpoint, track: track || 'cbse' });
}
