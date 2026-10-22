import React from 'react';

// Margin's sixteen icons, drawn like the ink: a 24-unit grid, 1.5 stroke, round
// caps and joins, no fills. Teal (.acc) marks only the live part of an icon,
// copper (.cop) appears only on marking icons; margin.css colours both and
// collapses them to currentColor in forced colours. Always aria-hidden: the
// control names itself.

export const MARGIN_ICONS = {
  index: <><path d="M5 6h14M5 12h14M5 18h9" /><circle className="acc" cx="19" cy="18" r="1.2" /></>,
  map: <><circle cx="6" cy="6" r="2.2" /><circle cx="18" cy="12" r="2.2" /><circle cx="7" cy="18" r="2.2" /><path d="M8 7l8 4M16 13.3l-7 3.6" /><circle className="acc" cx="18" cy="12" r="0.6" /></>,
  scripts: <><path d="M6 3h9l4 4v14H6z" /><path d="M15 3v4h4M9 11h7M9 15h5" /></>,
  report: <><path d="M4 20h16M6 16l4-5 3 3 5-7" /><circle className="acc" cx="18" cy="7" r="1.2" /></>,
  pen: <><path d="M5 19l1-4L16 5l3 3L9 18z" /><path className="acc" d="M5 19l1.5-.4" /></>,
  eraser: <><path d="M9 19h11M4.5 14.5l8-8 6 6-6 6H9z" /><path d="M9 10l6 6" /></>,
  lasso: <><ellipse cx="12" cy="10" rx="8" ry="5" strokeDasharray="2.5 2.5" /><path d="M8 14c-1.5 2.5 0 6 3 6" /></>,
  undo: <><path d="M9 14L4 9l5-5" /><path d="M4 9h10a6 6 0 010 12h-3" /></>,
  check: <><path d="M3 20h18" /><path className="acc" d="M6 12l4 4 8-9" /></>,
  correct: <path className="acc" d="M4 13l5 5L20 6" />,
  error: <path className="cop" d="M6 6l12 12M18 6L6 18" />,
  carried: <><path className="cop" d="M4 17c4-8 10-8 16-2" /><path className="cop" d="M17 12l3 3-3.5 1" /></>,
  hint: <path d="M9 18h6M10 21h4M12 3a6 6 0 00-3.5 10.9c.6.5 1 1.2 1 2V16h5v-.1c0-.8.4-1.5 1-2A6 6 0 0012 3z" />,
  online: <><circle cx="12" cy="12" r="8" /><circle className="acc" cx="12" cy="12" r="2.5" /></>,
  offline: <><circle cx="12" cy="12" r="8" strokeDasharray="3 3" /><circle className="cop" cx="12" cy="12" r="2.5" /></>,
  command: <><rect x="3" y="6" width="18" height="12" rx="3" /><path d="M8 10.5l2 1.5-2 1.5M12 14h4" /></>
};

export default function MarginIcon({ name, size = 24, className = '' }) {
  const body = MARGIN_ICONS[name];
  if (!body) return null;
  return (
    <svg className={`m-icon ${className}`.trim()} viewBox="0 0 24 24" width={size} height={size} fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {body}
    </svg>
  );
}

// The examiner's three marks, which differ by shape as well as colour: a teal
// circle with a tick, a copper diamond with a cross, and a dashed copper
// capsule for "error carried forward". They only ever draw a mark the
// deterministic engine set. The caller passes the translated label.
const MARKS = {
  ok: <><circle cx="22" cy="22" r="19" fill="var(--c-teal-soft)" stroke="var(--c-teal)" strokeWidth="1.4" /><path d="M13 22.5l6 6 12-13" fill="none" stroke="var(--c-teal)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" /></>,
  x: <><rect x="3.5" y="3.5" width="37" height="37" rx="2" transform="rotate(45 22 22)" fill="var(--c-copper-soft)" stroke="var(--c-copper)" strokeWidth="1.4" /><path d="M15 15l14 14M29 15L15 29" stroke="var(--c-copper)" strokeWidth="3" strokeLinecap="round" /></>,
  ecf: <><rect x="2.5" y="11" width="39" height="22" rx="11" fill="none" stroke="var(--c-copper)" strokeWidth="1.4" strokeDasharray="3 2" /><text x="22" y="26.5" textAnchor="middle" fontFamily="STIX Two Text, Georgia, serif" fontStyle="italic" fontSize="14" fill="var(--c-copper)">ecf</text></>
};

export function MarkGlyph({ kind, label, size = 44, className = '' }) {
  const body = MARKS[kind];
  if (!body) return null;
  return (
    <svg className={`c-mark c-mark-${kind} ${className}`.trim()} viewBox="0 0 44 44" width={size} height={size} role="img" aria-label={label}>
      {body}
    </svg>
  );
}
