// Pri Learning · the glyph for each feature row of a living formula.
//
// The same family as the syllabus map's chapter glyphs (the chapter-map-layout branch's
// instrument/chapterIcons.js): 24 × 24, a single 1.5 px line in currentColor, round caps and joins, no fills,
// drawn by hand as paths (no icon font, no emoji, no new colour). A glyph is decoration and always aria-hidden:
// the row's words are the accessible content. A dashed line is drawn as short segments.
const dot = (x, y, r = 1.2) => `M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0`;
const DASH_H = y => `M3 ${y}H6M9 ${y}H12M15 ${y}H18M21 ${y}H21.2`;
const WAVE = 'M2 12C5 3 8 3 12 12S19 21 22 12';

export const GLYPHS = {
  midline: [DASH_H(12), 'M2 12C5 6 8 6 12 12S19 18 22 12'],
  amplitude: ['M12 3V21', 'M9.2 6L12 3L14.8 6M9.2 18L12 21L14.8 18', 'M5 12H8M16 12H19'],
  period: ['M2 9C5 2 8 2 12 9S19 16 22 9', 'M3 20H21', 'M6 17.2L3 20L6 22.8M18 17.2L21 20L18 22.8'],
  range: ['M2 12C5 4 8 4 12 12S19 20 22 12', 'M3.5 5H8.5M15.5 19H20.5'],
  rootsTwo: ['M3 12H21', 'M5 4Q12 26 19 4', dot(8.3, 12, 1.3), dot(15.7, 12, 1.3)],
  rootTouch: ['M3 16H21', 'M5 4Q12 28 19 4', dot(12, 16, 1.3)],
  rootsNone: ['M3 19H21', 'M5 4Q12 16 19 4'],
  rootOne: ['M3 12H21', 'M5 20L19 4', dot(12, 12, 1.3)],
  yInt: ['M12 3V21', 'M4 18L20 7', dot(12, 12.6, 1.3)],
  xInt: ['M3 12H21', 'M5 20L19 4', dot(12, 12, 1.3)],
  turnMin: ['M4 4Q12 28 20 4', dot(12, 16, 1.3)],
  turnMax: ['M4 20Q12 -4 20 20', dot(12, 8, 1.3)],
  cornerMin: ['M4 5L12 18L20 5', dot(12, 18, 1.3)],
  cornerMax: ['M4 19L12 6L20 19', dot(12, 6, 1.3)],
  axis: ['M12 3V5.5M12 8.5V11.5M12 14.5V17.5M12 20.5V21', 'M5 5Q12 25 19 5'],
  slopeUp: ['M4 20H19V7', 'M4 20L19 7'],
  slopeDown: ['M4 7H19V20', 'M4 7L19 20'],
  slopeFlat: ['M3 12H21', 'M17.5 8.5L21 12L17.5 15.5'],
  asymH: [DASH_H(18), 'M3 4C6 14 11 17 21 17.5'],
  asymV: ['M6 3V6M6 9V12M6 15V18M6 21V21.2', 'M7.5 21C8 11 12 7 21 6'],
  grows: ['M3 20C12 19 17 14 21 4', 'M16 4H21V9'],
  decays: ['M3 4C7 14 12 19 21 20', 'M16 20H21V15'],
  circle: ['M4 12a8 8 0 1 0 16 0a8 8 0 1 0-16 0', 'M12 12H20', dot(12, 12, 1)],
  centre: ['M4 12a8 8 0 1 0 16 0a8 8 0 1 0-16 0', dot(12, 12, 1.5)],
  crossAxis: ['M5 10a7 7 0 1 0 14 0a7 7 0 1 0-14 0', 'M2 15H22', dot(7.1, 15, 1.2), dot(16.9, 15, 1.2)],
  bellPeak: ['M2 20H22', 'M3 20C8 20 9 5 12 5S16 20 21 20', 'M12 5V20'],
  bellBend: ['M2 20H22', 'M3 20C8 20 9 5 12 5S16 20 21 20', dot(8, 14.2, 1.2), dot(16, 14.2, 1.2)],
  bellSpread: ['M3 20C8 20 9 5 12 5S16 20 21 20', 'M5 22.5H19', 'M7.5 20.2L5 22.5L7.5 24.8M16.5 20.2L19 22.5L16.5 24.8'],
  passes: ['M3 4V20H21', 'M5 18C6 10 11 7 20 6', dot(12, 8.3, 1.3)],
  rises: ['M4 18L20 6', 'M14 6H20V12'],
  falls: ['M4 6L20 18', 'M14 18H20V12'],
  shift: [WAVE, 'M3 21.5H12', 'M9 19L12 21.5L9 24'],
  peakDot: ['M2 14C5 4 8 4 12 14S19 24 22 14', dot(6.8, 6.3, 1.3)],
  line: ['M3 12H21'],
  none: ['M3 19H21', 'M5 5Q12 15 19 5']
};

const K = (name, ...kinds) => Object.fromEntries(kinds.map(k => [k, name]));
export const KIND_ICON = Object.freeze({
  ...K('midline', 'midline'), ...K('amplitude', 'amplitude'), ...K('period', 'period'), ...K('range', 'range'),
  ...K('rootsTwo', 'rootsTwo'), ...K('rootTouch', 'rootTouch'), ...K('rootsNone', 'rootsNone', 'noXInt'), ...K('rootOne', 'rootOne'),
  ...K('line', 'rootsEvery', 'notParabola', 'flatSine', 'zeroFn', 'constantFn', 'zeroLog', 'zeroAbs'),
  ...K('yInt', 'yInt'), ...K('xInt', 'xInt'),
  ...K('turnMin', 'turnMin'), ...K('turnMax', 'turnMax'), ...K('cornerMin', 'cornerMin'), ...K('cornerMax', 'cornerMax'), ...K('axis', 'axis'),
  ...K('slopeUp', 'slopeUp', 'slopes'), ...K('slopeDown', 'slopeDown'), ...K('slopeFlat', 'slopeFlat'),
  ...K('asymH', 'asymH'), ...K('asymV', 'asymV'), ...K('grows', 'grows'), ...K('decays', 'decays'),
  ...K('centre', 'centre'), ...K('circle', 'radius'),
  ...K('crossAxis', 'crossX', 'crossY', 'touchX', 'touchY', 'missX', 'missY'),
  ...K('bellPeak', 'peak'), ...K('bellBend', 'inflect'), ...K('bellSpread', 'rule'),
  ...K('passes', 'passes'), ...K('rises', 'rises'), ...K('falls', 'falls'), ...K('shift', 'shift'), ...K('peakDot', 'firstMax')
});
