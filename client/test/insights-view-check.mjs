// Pri Learning · Insights view (readiness estimate + Mistake DNA): pure checks.
// The SVG trend is generated from the server's weekly points, so its honesty
// rules are checked here without a browser: a week below the coverage floor
// draws no band and breaks the line; the band is a share of the marks practised
// at that week; habits always carry their chances; the copy never claims a
// prediction, accuracy or improvement. Synthetic inputs only.
import { readFileSync } from 'node:fs';
import { chancesValues, chapterMatrix, headline, paperQuery, trendGeometry, trendPoint, PLOT } from '../src/insights/insightsView.js';
import en from '../src/i18n/strings.en.js';
import hi from '../src/i18n/strings.hi.js';

let pass = 0;
const failures = [];
const ok = (name, cond, detail = '') => (cond ? pass++ : failures.push(`${name}${detail ? ` — ${detail}` : ''}`));
const W = 7 * 86400000;

// paperQuery
ok('CBSE Class 10 query', paperQuery({ indiaTrack: 'cbse', year: 10 }) === 'track=cbse&grade=10&variant=standard');
ok('basic variant carried', paperQuery({ indiaTrack: 'cbse', year: 10, indiaVariant: 'basic' }).endsWith('variant=basic'));
ok('India course without a track is CBSE', paperQuery({ course: 'in', year: 9 }) === 'track=cbse&grade=9&variant=standard');
ok('JEE Main query', paperQuery({ indiaTrack: 'jee-main', year: 12 }) === 'track=jee-main&grade=12&variant=standard');
ok('no paper outside India', paperQuery({ course: 'nsw', year: 10 }) === null);

// trend points
const p = trendPoint({ weekEnding: 1, coverage: 0.5, show: true, coveredMarks: 40, low: 20, expected: 26, high: 32 });
ok('band is a share of the marks practised that week', p.banded && p.low === 50 && p.mid === 65 && p.high === 80, JSON.stringify(p));
const below = trendPoint({ weekEnding: 1, coverage: 0.2, show: false, coveredMarks: 16, low: null, expected: null, high: null });
ok('below the floor: no band, no numbers', !below.banded && below.low === null && below.mid === null && below.high === null);
const forged = trendPoint({ weekEnding: 1, coverage: 0.2, show: false, coveredMarks: 16, low: 1, expected: 2, high: 3 });
ok('a band is never drawn when the server says show=false, even with numbers', !forged.banded);

const weeks = [
  { weekEnding: 0, coverage: 0.45, show: true, coveredMarks: 36, low: 18, expected: 22, high: 26 },
  { weekEnding: W, coverage: 0.5, show: true, coveredMarks: 40, low: 20, expected: 25, high: 30 },
  { weekEnding: 2 * W, coverage: 0.3, show: false, coveredMarks: 24 },
  { weekEnding: 3 * W, coverage: 0.55, show: true, coveredMarks: 44, low: 24, expected: 28, high: 32 },
  { weekEnding: 4 * W, coverage: 0.6, show: true, coveredMarks: 48, low: 27, expected: 31, high: 35 }
];
const g = trendGeometry(weeks);
ok('a week under the floor splits the band into two runs', g.bands.length === 2, g.bands.join(' | '));
ok('the line does not bridge the gap', g.lines.length === 2);
ok('no dot for the unbanded week', g.dots.filter(d => d.banded).length === 4 && g.dots[2].cy === null);
ok('every week keeps its coverage tick', g.ticks.length === 5 && g.ticks.every(t => t.h > 0));
const ys = g.bands.join(' ').match(/-?\d+(\.\d+)?/g).map(Number);
ok('everything is drawn inside the plot', ys.every(v => v >= 0 && v <= Math.max(PLOT.width, PLOT.height)));
const single = trendGeometry([weeks[0]]);
ok('a single banded week is a bar, not a missing drawing', single.bands.length === 1 && single.lines.length === 0);
ok('an empty trend draws nothing', trendGeometry([]).bands.length === 0);

// headline
ok('no headline number below the floor', headline({ show: false, coverage: 0.31 }).key === 'insights.forecastNoBand' && headline({ show: false, coverage: 0.31 }).values.pct === 31);
const hv = headline({ show: true, coverage: 0.65, coveredMarks: 52, totalMarks: 80, expected: 38, low: 33, high: 43, unseenMarks: 28 });
ok('the headline carries range, practised marks and untouched marks', hv.key === 'insights.forecastBand' && hv.values.low === 33 && hv.values.high === 43 && hv.values.unseen === 28);
const filled = en[hv.key].replace(/\{(\w+)\}/g, (_, k) => hv.values[k]);
ok('the headline reads as the plan’s sentence', filled === 'On the 52 of 80 marks you have practised, you would score around 38 (33–43). 28 marks are untouched.', filled);

// habits
const c = chancesValues({ times: 7, chances: 12 });
ok('a habit is "7 of 12 chances"', en['insights.chances'].other.replace('{times}', c.times).replace('{n}', c.n) === '7 of 12 chances');
ok('chances never fall below the times seen', chancesValues({ times: 3, chances: 1 }).chances === 3);
const m = chapterMatrix([{ id: 'a', chapters: ['x', 'y'] }, { id: 'b', chapters: ['y'] }]);
ok('cross-chapter matrix orders chapters by how many habits touch them', m.chapters.join() === 'y,x' && m.rows[0].cells.join() === 'true,true' && m.rows[1].cells.join() === 'true,false');

// copy
const keys = Object.keys(en).filter(k => k.startsWith('insights.'));
ok('every insights string is in Hindi too', keys.every(k => k in hi), keys.filter(k => !(k in hi)).join(','));
const text = keys.map(k => JSON.stringify(en[k])).join(' ').toLowerCase();
for (const banned of ['predicted score', 'predicts', 'accurate', 'guarantee', 'improve your marks', 'ai-powered', 'topper', 'rank', 'careless'])
  ok(`copy never says "${banned}"`, !text.includes(banned));
ok('the forecast says "estimate from your practice"', en['insights.forecastTitle'] === 'Estimate from your practice');
ok('the forecast denies being a predicted board score', /not a predicted board score/.test(en['insights.forecastHonesty']));
ok('the Premium copy is the plan’s forecast row, extended only by the trend',
  en['insights.forecastPremium'].includes('estimate of your mark from your own practice, with its range'));
ok('the Premium copy is the plan’s Mistake DNA row', en['insights.dnaPremium'].includes('the slips you make most often, across chapters, and how often you have avoided them since'));

// the page shows no band or habit name without Premium
const page = readFileSync(new URL('../src/insights/Insights.jsx', import.meta.url), 'utf8');
ok('the free forecast branch renders coverage and the gate only', /if \(!data\.premium\) \{[\s\S]*?data-premium-gate="forecast"[\s\S]*?\n  \}/.test(page) && !/if \(!data\.premium\) \{[^}]*forecast\./.test(page));
ok('no glow, gradient, shadow or animation in the page styles',
  !/(gradient|box-shadow|filter:|drop-shadow|animation|@keyframes|text-shadow)/.test(readFileSync(new URL('../src/insights/insights.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')));

if (failures.length) {
  for (const f of failures) console.log('  ✖ ' + f);
  console.log(`INSIGHTS VIEW: FAIL — ${pass}/${pass + failures.length} checks`);
  process.exit(1);
}
console.log(`INSIGHTS VIEW: PASS — ${pass}/${pass} checks — trend drawn from the data, no band below the floor, chances on every habit, honest copy.`);
