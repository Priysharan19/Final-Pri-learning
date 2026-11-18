// Every notes diagram of one edition, drawn through the notes' own TeachingDiagrams, for the
// layout check (client/test/notes-diagram-layout-check.mjs). Test support only.
// ?edition=in|nsw picks the edition's notes; ?theme=dark and ?only=<key> narrow the page.
import React from 'react';
import { createRoot } from 'react-dom/client';
import '../../src/fonts.css';
import '../../src/theme.css';
import '../../src/theme-state.css';
import '../../src/instrument/instrument.css';
import '../../src/notes/Notes.css';
import { MemoryRouter } from 'react-router-dom';
import { TeachingDiagrams } from '../../src/notes/NotesParts.jsx';
import { NOTES_GRADES, loadNotesForGrade, loadOlympiadNotes } from '../../src/notes/notesIndex.js';
import { loadNswNotesForStage } from '../../src/notes/nsw/nswNotesIndex.js';

const params = new URLSearchParams(location.search);
const edition = params.get('edition') === 'nsw' ? 'nsw' : 'in';
const only = params.get('only');
const chapters = [];
if (edition === 'in') {
  for (const g of NOTES_GRADES) for (const [id, n] of Object.entries((await loadNotesForGrade(g)) || {})) chapters.push([`g${g}/${id}`, n]);
  try { for (const [id, n] of Object.entries((await loadOlympiadNotes()) || {})) chapters.push([`oly/${id}`, n]); } catch { /* no olympiad notes in this build */ }
} else {
  for (const [stage, course] of [[4, null], [5, null], [6, 'advanced'], [6, 'standard'], [6, 'ext1'], [6, 'ext2']]) {
    for (const [id, n] of Object.entries((await loadNswNotesForStage(stage, course)) || {})) chapters.push([`s${stage}${course ? `-${course}` : ''}/${id}`, n]);
  }
}
document.documentElement.classList.add('ui-instrument');
const theme = params.get('theme') === 'dark' ? 'dark' : 'light';
document.documentElement.setAttribute('data-theme', theme);
document.documentElement.style.colorScheme = theme;

const items = [];
for (const [cid, n] of chapters) (n.diagrams || []).forEach((d, i) => { const key = `${cid}#${i}`; if (!only || only === key) items.push({ key, d }); });
window.__DIAGRAMS = items.map(({ key, d }) => ({ key, spec: d.spec, title: d.title, note: d.note }));

createRoot(document.getElementById('root')).render(
  <MemoryRouter>
    <article className="nt nt-article" style={{ padding: '8px 16px 72px', maxWidth: only ? 720 : undefined }} data-ready>
      {items.map(({ key, d }) => <section key={key} data-did={key} style={{ margin: '0 0 28px' }}><TeachingDiagrams items={[d]} /></section>)}
    </article>
  </MemoryRouter>
);
