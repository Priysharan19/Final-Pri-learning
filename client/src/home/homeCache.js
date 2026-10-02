// Per-profile, per-device Home conveniences. Everything here is a cache of
// something the app can re-derive, so every read tolerates missing, blocked or
// corrupt storage and returns the empty value.

const FILTER_KEY = 'pri-gen-filters';
const ASSIGNMENT_KEY = 'pri-home-assignments';
const ASSIGNMENT_MAX_AGE = 14 * 24 * 3_600_000;
const ASSIGNMENT_MAX_ROWS = 20;

const storageOf = storage => storage || (typeof localStorage === 'undefined' ? null : localStorage);
function readJson(storage, key) {
  try { return JSON.parse(storageOf(storage)?.getItem(key) || 'null'); } catch { return null; }
}
function writeJson(storage, key, value) {
  try { storageOf(storage)?.setItem(key, JSON.stringify(value)); } catch { /* storage full or blocked */ }
}
function byProfileOf(all) {
  return all && typeof all === 'object' && all.byProfile && typeof all.byProfile === 'object' ? all.byProfile : {};
}

/** What the saved filters were chosen against: the profile's course, class and track. */
export function filterScopeOf(user) {
  return [user?.course || 'nsw', Number(user?.year) || 0, user?.indiaTrack || user?.pathway || ''].join('|');
}

/**
 * The manual-practice filters this profile last left on Home. They are keyed by
 * profile (two siblings on one iPad do not inherit each other's class) and
 * stamped with the class/track they were chosen under: once the student
 * changes class or track the old filters are dropped, so Home never keeps
 * offering the previous class's chapters.
 */
export function loadSavedFilters(user, storage) {
  const row = byProfileOf(readJson(storage, FILTER_KEY))[String(user?.id || '')];
  if (!row || row.scope !== filterScopeOf(user)) return {};
  const { scope, ...filters } = row;
  return filters;
}

export function saveFilters(user, filters, storage) {
  if (!user?.id) return;
  const byProfile = byProfileOf(readJson(storage, FILTER_KEY));
  byProfile[String(user.id)] = { ...filters, scope: filterScopeOf(user) };
  writeJson(storage, FILTER_KEY, { byProfile });
}

/**
 * The last assignment list fetched from the cloud for this profile, kept so
 * Home can still show "you have work due" while offline. Only the fields Home
 * renders are kept: no responses, marks or teacher notes.
 */
export function cacheAssignments(user, rows, storage, now = Date.now()) {
  if (!user?.id || !Array.isArray(rows)) return;
  const slim = rows.slice(0, ASSIGNMENT_MAX_ROWS).map(r => ({
    id: r?.id, classId: r?.classId, title: r?.title, dueAt: r?.dueAt,
    specification: { questionCount: r?.specification?.questionCount },
    submission: { state: r?.submission?.state, summary: { questionsAnswered: r?.submission?.summary?.questionsAnswered } }
  })).filter(r => r.id);
  const byProfile = byProfileOf(readJson(storage, ASSIGNMENT_KEY));
  byProfile[String(user.id)] = { at: now, rows: slim };
  writeJson(storage, ASSIGNMENT_KEY, { byProfile });
}

export function cachedAssignments(user, storage, now = Date.now()) {
  const row = byProfileOf(readJson(storage, ASSIGNMENT_KEY))[String(user?.id || '')];
  if (!row || !Array.isArray(row.rows) || !(now - Number(row.at) <= ASSIGNMENT_MAX_AGE)) return [];
  return row.rows;
}
