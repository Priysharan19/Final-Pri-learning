import React from 'react';

// The instrument's own glyphs: the approved book's 16-unit grid, 1.5 stroke,
// round caps and joins. Used only by the v1.1 instrument interface (the flag-off
// build keeps components/Icon.jsx). Always aria-hidden: the control names itself.

const G = {
  search: <><circle cx="7" cy="7" r="4.5" /><path d="m10.5 10.5 3.5 3.5" /></>,
  index: <><path d="M2.5 4h7M2.5 8h9M2.5 12h6" /><path d="M13 3v10" /></>,
  pen: <path d="m10.6 2.6 2.8 2.8-7.8 7.8-3.4.6.6-3.4Z" />,
  map: <><circle cx="4" cy="4" r="1.6" /><circle cx="12" cy="5" r="1.6" /><circle cx="7" cy="12" r="1.6" /><path d="M5.4 4.4 10.4 5M5 5.5l1.5 5M11 6.4 8.2 10.8" /></>,
  doc: <path d="M3.5 1.5h6l3 3v10h-9Z M9.5 1.5v3h3M5.5 8h5M5.5 10.5h5" />,
  chart: <><path d="M2 14h12M2 14V2" /><path d="m4 11 3-3 2.5 2 4.5-5" /></>,
  gear: <><circle cx="8" cy="8" r="2" /><path d="M8 1.5v2M8 12.5v2M14.5 8h-2M3.5 8h-2M12.6 3.4l-1.4 1.4M4.8 11.2l-1.4 1.4M12.6 12.6l-1.4-1.4M4.8 4.8 3.4 3.4" /></>,
  more: <path d="M3 4.5h10M3 8h10M3 11.5h10" />,
  // Settings sections (s9).
  plan: <><rect x="2.5" y="3" width="11" height="10" rx="1.5" /><path d="M2.5 6.5h11M5 10h3" /></>,
  user: <><circle cx="8" cy="5.5" r="2.5" /><path d="M3 13.5c.6-2.6 2.6-4 5-4s4.4 1.4 5 4" /></>,
  lock: <><rect x="3.5" y="7" width="9" height="6.5" rx="1.2" /><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" /></>,
  globe: <><circle cx="8" cy="8" r="5.5" /><path d="M2.5 8h11M8 2.5c1.6 1.6 2.3 3.4 2.3 5.5S9.6 11.9 8 13.5M8 2.5C6.4 4.1 5.7 5.9 5.7 8s.7 3.9 2.3 5.5" /></>,
  sun: <><circle cx="8" cy="8" r="2.5" /><path d="M8 1.5v1.5M8 13v1.5M14.5 8H13M3 8H1.5M12.6 3.4l-1 1M4.4 11.6l-1 1M12.6 12.6l-1-1M4.4 4.4l-1-1" /></>,
  book: <path d="M2.5 3.5c2-.8 3.9-.6 5.5.6 1.6-1.2 3.5-1.4 5.5-.6v9c-2-.8-3.9-.6-5.5.6-1.6-1.2-3.5-1.4-5.5-.6ZM8 4.1v9" />,
  box: <><path d="M2.5 4.5 8 2l5.5 2.5v7L8 14l-5.5-2.5Z" /><path d="M2.5 4.5 8 7l5.5-2.5M8 7v7" /></>,
  help: <><circle cx="8" cy="8" r="5.5" /><path d="M6.3 6.3a1.8 1.8 0 1 1 2.4 1.7c-.5.2-.7.6-.7 1.1M8 11.2v.1" /></>,
  cloudOff: <><path d="M4.5 12.5h7a2.5 2.5 0 0 0 .4-5 4 4 0 0 0-7.3-1.2A3.2 3.2 0 0 0 4.5 12.5Z" /><path d="m2.5 2.5 11 11" /></>,
  alert: <><path d="M8 2 14 13H2Z" /><path d="M8 6.5v3M8 11.2v.1" /></>
};

export default function Glyph({ name, size = 16, className = '' }) {
  const body = G[name];
  if (!body) return null;
  return (
    <svg className={`in-glyph ${className}`.trim()} viewBox="0 0 16 16" width={size} height={size} fill="none"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {body}
    </svg>
  );
}
