// A whole notes chapter page — the India page (pages/Notes.jsx) or the NSW page
// (pages/NswNotes.jsx) — drawn at one route with the app's own styles and no account,
// for client/test/notes-pages-check.mjs. Test support only.
// ?page=in|nsw&path=/notes/<id>&theme=light|dark
import React from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import '../../src/fonts.css';
import '../../src/theme.css';
import '../../src/theme-state.css';
import '../../src/instrument/instrument.css';
import Notes from '../../src/pages/Notes.jsx';
import NswNotes from '../../src/pages/NswNotes.jsx';

const params = new URLSearchParams(location.search);
const Page = params.get('page') === 'nsw' ? NswNotes : Notes;
const path = params.get('path') || '/notes/c10-quadratic-equations';
const theme = params.get('theme') === 'dark' ? 'dark' : 'light';
document.documentElement.classList.add('ui-instrument');
document.documentElement.setAttribute('data-theme', theme);
document.documentElement.style.colorScheme = theme;
document.documentElement.style.background = 'var(--paper, var(--surface))';
document.body.style.background = 'var(--paper, var(--surface))';

// Where a button left the notes for (Practice), so the check can read the link it followed.
function Left() {
  const at = useLocation();
  return <p data-left-notes={`${at.pathname}${at.search}`}>{at.pathname}</p>;
}

createRoot(document.getElementById('root')).render(
  <MemoryRouter initialEntries={[path]}>
    <div style={{ padding: '8px 16px 72px' }}>
      <Routes>
        <Route path="/notes" element={<Page />} />
        <Route path="/notes/:chapterId" element={<Page />} />
        <Route path="*" element={<Left />} />
      </Routes>
    </div>
  </MemoryRouter>
);
