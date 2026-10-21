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
  more: <path d="M3 4.5h10M3 8h10M3 11.5h10" />
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
