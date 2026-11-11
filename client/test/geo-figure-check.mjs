// Pri Learning · constructed figures (F6): pure checks, synthetic prompts only.
// A figure is drawn only from lengths the question states, to scale, with a
// text alternative; impossible or under-specified figures are declined.
import { constructTriangle, figureAlt, figureGeometry, figureSpecFor } from '../src/engine/figureSpec.js';
import en from '../src/i18n/strings.en.js';
import hi from '../src/i18n/strings.hi.js';
import { readFileSync } from 'node:fs';

let pass = 0;
const failures = [];
const ok = (name, cond, detail = '') => (cond ? pass++ : failures.push(`${name}${detail ? ` — ${detail}` : ''}`));
const near = (a, b) => Math.abs(a - b) < 1e-6;
const tFor = table => (k, vars = {}) => String(table[k] ?? k).replace(/\{(\w+)\}/g, (_, n) => vars[n] ?? `{${n}}`);
const dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);

// Construction is exact.
const tri = constructTriangle(5, 4, 3); // a=BC, b=CA, c=AB → right angle at C? (3-4-5: right angle opposite 5 = A)
ok('3-4-5 has a right angle opposite the longest side', near(tri.angles.A, 90), JSON.stringify(tri.angles));
ok('angles sum to 180', near(tri.angles.A + tri.angles.B + tri.angles.C, 180));
ok('constructed side lengths match', near(dist(tri.points.A, tri.points.B), 3) && near(dist(tri.points.B, tri.points.C), 5) && near(dist(tri.points.C, tri.points.A), 4));
ok('triangle inequality failure declined', constructTriangle(1, 2, 3) === null && constructTriangle(1, 2, 10) === null);
ok('non-positive length declined', constructTriangle(0, 2, 2) === null && constructTriangle(-1, 2, 2) === null && constructTriangle(NaN, 2, 2) === null);

// Reading the question.
const listed = figureSpecFor({ prompt: 'Construct a triangle with sides 5 cm, 6 cm and 7 cm.' });
ok('listed sides read as AB, BC, CA', listed?.kind === 'triangle' && listed.sides.c === 5 && listed.sides.a === 6 && listed.sides.b === 7 && listed.unit === 'cm', JSON.stringify(listed));
const named = figureSpecFor({ prompt: 'In triangle ABC, AB = 6 cm, BC = 8 cm and CA = 10 cm. Find the area.' });
ok('named sides read', named?.sides.c === 6 && named.sides.a === 8 && named.sides.b === 10 && near(named.angles.B, 90));
const latex = figureSpecFor({ prompt: 'In $\\triangle ABC$, $AB = 6$, $BC = 8$, $AC = 10$.' });
ok('LaTeX-wrapped sides read, AC accepted for CA', latex?.sides.b === 10);
ok('impossible triangle in a prompt declined', figureSpecFor({ prompt: 'A triangle with sides 1 cm, 2 cm and 5 cm.' }) === null);
ok('two sides only declined', figureSpecFor({ prompt: 'A triangle with sides 3 cm and 4 cm.' }) === null);
const circle = figureSpecFor({ prompt: 'A circle has radius 7 cm. Find its area.' });
ok('circle by radius', circle?.kind === 'circle' && circle.radius === 7 && circle.unit === 'cm');
const dia = figureSpecFor({ prompt: 'Find the circumference of a circle of diameter 10 m.' });
ok('circle by diameter halves', dia?.radius === 5 && dia.given === 'diameter');
ok('no lengths, no figure', figureSpecFor({ prompt: 'Solve 2x + 3 = 7.' }) === null && figureSpecFor({ prompt: 'Draw a circle.' }) === null);
ok('question with its own figure gets none', figureSpecFor({ prompt: 'A circle has radius 7 cm.', hasFigure: true }) === null);

// Geometry stays to scale and inside the box.
const g = figureGeometry(named);
const pts = Object.values(g.points);
ok('all vertices inside the viewBox', pts.every(([x, y]) => x >= 0 && x <= g.size && y >= 0 && y <= g.size), JSON.stringify(g.points));
const ratio = dist(g.points.B, g.points.C) / dist(g.points.A, g.points.B);
ok('drawn to scale (BC/AB = 8/6)', Math.abs(ratio - 8 / 6) < 1e-6, String(ratio));
ok('base along the bottom', near(g.points.A[1], g.points.B[1]) && g.points.C[1] < g.points.A[1]);
ok('edge labels carry the given lengths', g.edges.map(e => e.label).join('|') === '6 cm|8 cm|10 cm');
const gc = figureGeometry(circle);
ok('circle fits the box', gc.circle.r > 0 && gc.circle.cx + gc.circle.r <= gc.size && gc.label === '7 cm');

// Text alternative, both languages.
const altEn = figureAlt(named, tFor(en));
ok('English alt names every length and angle', /AB 6 cm/.test(altEn) && /BC 8 cm/.test(altEn) && /CA 10 cm/.test(altEn) && /B 90°/.test(altEn), altEn);
const altHi = figureAlt(circle, tFor(hi));
ok('Hindi alt is Hindi and complete', /त्रिज्या 7 cm/.test(altHi) && /व्यास 14 cm/.test(altHi) && !/\{/.test(altHi), altHi);
ok('alt has no unfilled placeholder', !/\{/.test(figureAlt(listed, tFor(en))) && !/\{/.test(figureAlt(dia, tFor(en))));

// Component and wiring rules.
const comp = readFileSync(new URL('../src/components/GeoFigure.jsx', import.meta.url), 'utf8');
ok('SVG is role=img labelled by a <title>', /role="img"/.test(comp) && /aria-labelledby/.test(comp) && /<title/.test(comp));
ok('visible caption repeats the alt', /<figcaption[^>]*>\{alt\}/.test(comp));
ok('no images, no hard-coded colour', !/<img|<image|href=/.test(comp) && !/#[0-9a-f]{3,6}\b/i.test(comp));
const qc = readFileSync(new URL('../src/components/QuestionCard.jsx', import.meta.url), 'utf8');
ok('GeoFigure is loaded on demand', /React\.lazy\(\(\) => import\('\.\/GeoFigure\.jsx'\)\)/.test(qc) && !/import GeoFigure/.test(qc));
const eng = readFileSync(new URL('../src/engine/figureSpec.js', import.meta.url), 'utf8');
ok('figure engine never imports marking or a model', !/markPredictor|marker|openai|fetch\(/i.test(eng));

if (failures.length) { console.error(failures.map(f => `  ✗ ${f}`).join('\n')); console.error(`GEO FIGURE: FAIL — ${pass}/${pass + failures.length} checks`); process.exit(1); }
console.log(`GEO FIGURE: PASS — ${pass}/${pass} checks`);
