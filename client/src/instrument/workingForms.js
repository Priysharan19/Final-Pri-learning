// The working indicator's construction for each counter cut (Lit Instrument
// D6, docs/design/lit-instrument-decision.md): the line drawn between the three
// points, and each point as [x, y, dx, dy] — where it settles and the loose
// offset it gathers from, in a 24-unit box. Priyabhata draws the jyā (the bow
// and its string), Prithagoras the right angle. Only the build's own edition
// record carries its form (platform/edition-record.js), so a bundle holds one.
// Plain literals: a call here would keep the other edition's form in a build.
export const WORKING_FORMS = {
  jya: { line: 'M9 4A8 8 0 0 1 9 20Z', points: [[9, 4, 3, 5], [17, 12, -6, -3], [9, 20, 4, -6]] },
  square: { line: 'M6 6V18H18M6 14.5H9.5V18', points: [[6, 6, 5, 4], [6, 18, 3, -5], [18, 18, -6, -2]] }
};
