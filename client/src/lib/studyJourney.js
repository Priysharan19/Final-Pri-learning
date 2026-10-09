// One durable selection through notes → examples → practice.
// A lesson never silently broadens the student's exact selected outcome.
import { practiceHref, practiceDifficulties } from './practiceLinks.js';

export const STUDY_TRACKS = Object.freeze(['cbse', 'jee-main', 'jee-advanced']);

export function studyHref({ subtopic, dotpoint = null, difficulty = null, track = 'cbse', view = 'notes' } = {}) {
  if (!/^c(?:7|8|9|10|11|12)-[a-z0-9-]+$/.test(String(subtopic || ''))) return null;
  if (!STUDY_TRACKS.includes(track)) return null;
  if (!['notes', 'examples'].includes(view)) return null;
  const p = new URLSearchParams({ track, view });
  if (dotpoint != null) p.set('dotpoint', String(dotpoint));
  if (difficulty != null) p.set('difficulty', String(difficulty));
  return `/notes/${encodeURIComponent(subtopic)}?${p}`;
}

export function selectedStudyContext(chapter, params) {
  const get = key => typeof params?.get === 'function' ? params.get(key) : null;
  const track = STUDY_TRACKS.includes(get('track')) ? get('track') : 'cbse';
  const dot = get('dotpoint');
  const dif = get('difficulty');
  const dotpoint = dot !== null && /^(0|[1-9]\d*)$/.test(dot) &&
    Number(dot) < (chapter?.dotpoints?.length || 0) ? Number(dot) : null;
  const choices = practiceDifficulties({ course: 'in', track, grade: Number(chapter?.grade) });
  const difficulty = dif !== null && /^[1-4]$/.test(dif) && choices.includes(Number(dif))
    ? Number(dif) : null;
  return { subtopic: chapter?.id || null, track, dotpoint, difficulty };
}

export function selectedStudyPracticeHref(chapter, params) {
  return practiceHref(selectedStudyContext(chapter, params));
}
