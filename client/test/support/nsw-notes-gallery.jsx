// One NSW notes chapter, drawn through the app's own parts and styles, for the
// browser check (client/test/nsw-notes-visual-check.mjs). Test support only.
// ?topic=<id> picks the chapter; the theme is set by the check (data-theme).
import React from 'react';
import { createRoot } from 'react-dom/client';
import '../../src/fonts.css';
import '../../src/theme.css';
import '../../src/theme-state.css';
import '../../src/instrument/instrument.css';
import '../../src/notes/Notes.css';
import { ChapterSheet } from '../../src/notes/nsw/NswParts.jsx';
import { loadNswNotesForStage, NSW_NOTES_TOPIC_BY_ID } from '../../src/notes/nsw/nswNotesIndex.js';
import { MathText } from '../../src/lib/latex.jsx';

const params = new URLSearchParams(location.search);
const id = params.get('topic') || 'ma4-frc-c-01';
const topic = NSW_NOTES_TOPIC_BY_ID[id];
const notes = (await loadNswNotesForStage(topic.stage, topic.course))[id];
document.documentElement.classList.add('ui-instrument');
document.documentElement.setAttribute('data-theme', params.get('theme') === 'dark' ? 'dark' : 'light');
document.documentElement.style.colorScheme = params.get('theme') === 'dark' ? 'dark' : 'light';

createRoot(document.getElementById('root')).render(
  <article className="nt nt-article" style={{ padding: "8px 16px 72px" }} data-nsw-notes data-topic={id}>
    <header className="nt-ch-head">
      <p className="nt-eyebrow">Year {topic.years[0]} · Stage {topic.stage}{topic.course ? ` · ${topic.course}` : ''}</p>
      <h1 className="nt-title">{topic.name}</h1>
      <MathText block className="nt-lede" text={notes.summary} />
    </header>
    <ChapterSheet notes={notes} topicId={id} />
  </article>
);
