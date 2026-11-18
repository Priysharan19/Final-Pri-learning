import React from 'react';
import { GLYPHS, iconFor } from './chapterIcons.js';

/** The glyph's paths, drawn into whatever <svg> or <g> it is placed in. Decorative. */
export function GlyphPaths({ glyph }) {
  return GLYPHS[glyph].map((d, i) => <path key={i} d={d} />);
}

/** A standalone 24-unit glyph (the phone list's row marker). Decorative: the chapter's name is the accessible name. */
export function Glyph({ id, strand, className }) {
  const { key } = iconFor(id, strand);
  return (
    <svg className={className} viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false" data-glyph={key}>
      <GlyphPaths glyph={key} />
    </svg>
  );
}
