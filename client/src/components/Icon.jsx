// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the one icon family.
//
// Every icon in the product is drawn here, on the same 24-unit grid, with the
// same 1.6 stroke, round caps and round joins — the line weight of a fine
// technical pen. No emoji, no SF Symbols, no third-party set: an icon that
// arrives from somewhere else would be the one thing on screen that does not
// look like Pri. Icons are functional, never decorative, so every icon is
// aria-hidden and the control that holds it carries the accessible name.
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';

// A plain list of path data is drawn as <path> elements; anything else (a
// circle, a dashed rect) is written out as JSX.
const PATHS = {
  home: ['M3.5 10.5 12 3.5l8.5 7', 'M5.5 9.2V20.5h13V9.2', 'M9.8 20.5v-5.5h4.4v5.5'],
  practice: ['M4 20l1.2-4.6L15.6 5a2 2 0 0 1 2.8 0l.6.6a2 2 0 0 1 0 2.8L8.6 18.8 4 20Z', 'm13.8 6.8 3.4 3.4'],
  review: ['M4.5 12a7.5 7.5 0 1 0 2.2-5.3', 'M4 4.5v4h4', 'M12 8.5V12l2.5 1.5'],
  rush: <><circle cx="12" cy="13.5" r="7" /><path d="M12 13.5V9.8" /><path d="M10 3h4" /><path d="M18.4 6.6l1.2-1.2" /></>,
  match: ['M4 6h10', 'M4 12h7', 'M4 18h10', 'm17 9 3 3-3 3'],
  teacher: <><rect x="3.5" y="4" width="17" height="11.5" rx="1" /><path d="M8 20l4-4.5 4 4.5" /><path d="M7.5 8.5h6M7.5 11.5h9" /></>,
  notes: ['M6 3.5h10.5L19 6v14.5H6z', 'M9 8.5h7M9 12h7M9 15.5h4.5'],
  tasks: ['M12 5.5C10 4 7.5 3.5 4 3.8V19c3.5-.3 6 .3 8 1.7 2-1.4 4.5-2 8-1.7V3.8c-3.5-.3-6 .2-8 1.7Z', 'M12 5.5v15.2'],
  progress: ['M4 19.5h16', 'M6.5 16V11', 'M11 16V7.5', 'M15.5 16v-5.5', 'M20 16V4.5'],
  exams: ['M7 3.5h10a1 1 0 0 1 1 1v15a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1v-15a1 1 0 0 1 1-1Z', 'M9 8h6M9 11.5h6M9 15h3.5'],
  classes: ['m2.5 9 9.5-5 9.5 5-9.5 5-9.5-5Z', 'M6.5 11.5V16c0 1.4 2.5 2.8 5.5 2.8s5.5-1.4 5.5-2.8v-4.5'],
  settings: <><circle cx="12" cy="12" r="3" /><path d="M19 12a7 7 0 0 0-.15-1.4l2.1-1.6-2-3.4-2.45 1a7 7 0 0 0-2.4-1.4L13.7 2.6h-3.9l-.4 2.6a7 7 0 0 0-2.4 1.4l-2.45-1-2 3.4 2.1 1.6A7 7 0 0 0 4.5 12c0 .5.05.9.15 1.4l-2.1 1.6 2 3.4 2.45-1a7 7 0 0 0 2.4 1.4l.4 2.6h3.9l.4-2.6a7 7 0 0 0 2.4-1.4l2.45 1 2-3.4-2.1-1.6c.1-.5.15-.9.15-1.4Z" /></>,
  more: ['M4 7h16M4 12h16M4 17h16'],
  back: ['M15 5l-7 7 7 7'],
  next: ['M9 5l7 7-7 7'],
  arrowRight: ['M4.5 12h15', 'm13.5 6 6 6-6 6'],
  close: ['M6 6l12 12M18 6 6 18'],
  pen: ['M4 20l1.2-4.6L15.6 5a2 2 0 0 1 2.8 0l.6.6a2 2 0 0 1 0 2.8L8.6 18.8 4 20Z'],
  eraser: ['m9 19.5-4.6-4.6a1.6 1.6 0 0 1 0-2.3l8.2-8.2a1.6 1.6 0 0 1 2.3 0l4.6 4.6a1.6 1.6 0 0 1 0 2.3L12 19.5', 'M9 19.5h11', 'm8.5 8.5 7 7'],
  undo: ['M9 5.5 4.5 10 9 14.5', 'M4.5 10h9.5a5 5 0 0 1 0 10H11'],
  redo: ['m15 5.5 4.5 4.5-4.5 4.5', 'M19.5 10H10a5 5 0 0 0 0 10h3'],
  clear: ['M4.5 7h15', 'M9.5 7V4.5h5V7', 'M6.5 7l1 13h9l1-13'],
  pageAdd: ['M6 3.5h8l4 4v13H6z', 'M14 3.5v4h4', 'M12 11v6M9 14h6'],
  finger: ['M9 11.5V5a1.5 1.5 0 0 1 3 0v5.5', 'M12 10.5V9a1.5 1.5 0 0 1 3 0v2', 'M15 11V10a1.5 1.5 0 0 1 3 0v4.5a6 6 0 0 1-6 6h-.5a6 6 0 0 1-5-2.7L4.2 14.5a1.4 1.4 0 0 1 2.2-1.8L9 15'],
  bookmark: ['M6.5 3.5h11v17l-5.5-4-5.5 4z'],
  info: <><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5.5" /><path d="M12 7.6v.1" /></>,
  scratch: <><rect x="3.5" y="4.5" width="17" height="15" rx="1.5" strokeDasharray="2.4 2.4" /><path d="M7.5 15c1.5-3 3-3 4.5 0s3 3 4.5 0" /></>,
  hint: ['M9.5 18h5M10 21h4', 'M12 3a6 6 0 0 0-3.4 10.9c.7.5 1.1 1.2 1.2 2.1h4.4c.1-.9.5-1.6 1.2-2.1A6 6 0 0 0 12 3Z'],
  type: <><rect x="2.5" y="6" width="19" height="12" rx="1.5" /><path d="M6 10h.01M9.5 10h.01M13 10h.01M16.5 10h.01M7.5 14h9" /></>,
  photo: <><path d="M4 7.5h3l1.5-2h7l1.5 2h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></>,
  check: ['m5 12.5 4.5 4.5L19 7.5'],
  correction: ['M4.5 19.5c3-1 5-3 6.5-6', 'M13.5 4.5l6 6-7.5 7.5H6v-6z'],
  uncertain: <><circle cx="12" cy="12" r="8.5" strokeDasharray="3 2.6" /><path d="M9.8 9.6a2.3 2.3 0 1 1 3.3 2.1c-.7.4-1.1.9-1.1 1.7v.4" /><path d="M12 16.6v.1" /></>,
  alert: ['M12 4 21 19.5H3z', 'M12 10v4.5', 'M12 17v.1'],
  clock: <><circle cx="12" cy="12.5" r="8" /><path d="M12 8v4.5l3 1.8" /></>,
  flag: ['M6 21V4', 'M6 4.5h11l-2.5 4 2.5 4H6'],
  offline: ['M3 9a14 14 0 0 1 4.5-2.6M10.5 5.6A14 14 0 0 1 21 9', 'M6.5 12.5a9 9 0 0 1 3-1.7M14 11a9 9 0 0 1 3.5 1.5', 'M12 18v.1', 'M3.5 3.5l17 17'],
  sun: <><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4 6 18M18 6l1.4-1.4" /></>,
  moon: ['M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10Z'],
  device: <><rect x="3.5" y="5" width="17" height="11.5" rx="1.5" /><path d="M9 20h6M12 16.5V20" /></>,
  chevronDown: ['m6 9 6 6 6-6'],
  compare: <><rect x="3.5" y="4.5" width="7.5" height="15" rx="1" /><rect x="13" y="4.5" width="7.5" height="15" rx="1" /></>
};

export const ICON_NAMES = Object.freeze(Object.keys(PATHS));

export default function Icon({ name, size = 18, className = '', strokeWidth = 1.6 }) {
  const body = PATHS[name];
  if (!body) return null;
  return (
    <svg className={`pri-icon ${className}`.trim()} viewBox="0 0 24 24" width={size} height={size}
      fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true" focusable="false">
      {Array.isArray(body) ? body.map((d, i) => <path key={i} d={d} />) : body}
    </svg>
  );
}
