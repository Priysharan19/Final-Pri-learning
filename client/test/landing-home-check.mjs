// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the verified page: public landing and Home
//
//   node client/test/landing-home-check.mjs
//
// 1. The landing demo's statuses are the engine's. Nothing in the script says
//    "checked" or "first error": change one line of the scripted working and
//    the status the page would show changes with it, through the real Step
//    Check (engine/checker.js).
// 2. See why is the real mistakeView on the two lines Step Check compared, and
//    its values are f(u) and g(u) of those two expressions.
// 3. The social-proof slots never render in production: the flag is off, and
//    even with it on nothing renders without consented content.
// 4. The page renders (SSR) its final state with an icon AND a word per
//    status, the edition's syllabus line, no invented figures, no competitor.
// 5. Home's helpers only show what exists: the trend needs two marked papers,
//    the latest marked work needs certified marks, marks at stake needs
//    hsc-forecast's figures with their disclaimer.
// 6. Every new string exists in English and Hindi.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { stepCheck } from '../src/engine/checker.js';
import { CHAIN, CORRECT_LINE4, DEMO_LINES, STATUS, UNSURE, runDemo } from '../src/landing/demoScript.js';
import { SOCIAL_PROOF, SOCIAL_PROOF_ENABLED, socialProofSlots } from '../src/landing/landing.config.js';
import { latestMarked, marksAtStake, nextMeta, papersTrend, sparkPath, homeForecast } from '../src/home/verifiedHome.js';

let pass = 0;
const failures = [];
const ok = (cond, label) => { if (cond) pass++; else failures.push(label); };
const read = rel => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8');
const statuses = r => r.lines.map(l => l.status);

// ── 1 · The statuses are the engine's ────────────────────────────────────────
ok(runDemo() === null && runDemo({ glyph: null }) === null, 'nothing is checked before the reading is confirmed');
const base = runDemo({ glyph: UNSURE.read });
ok(JSON.stringify(statuses(base)) === JSON.stringify([STATUS.GIVEN, STATUS.CHECKED, STATUS.CHECKED, STATUS.ERROR, STATUS.FOLLOWS]),
  `the script as written: line 1 is the given substitution (context, no verdict), 2–3 checked, 4 first error, 5 follows — got ${statuses(base)}`);
ok(base.lines[0].engine.length === 0 && DEMO_LINES[0].given === true && !DEMO_LINES[0].claims, 'the given line makes no claim and is never put to the engine');
ok(base.lines.slice(1, 4).every(l => l.engine.length > 0), 'every marked line rests on Step Check rows');
ok(base.firstError === 4, 'the first error is line 4');
ok(base.lines[4].engine.length === 0 && DEMO_LINES[4].claims('u').length === 0, 'line 5 (a definite integral) gives the engine nothing it can check, so it can never be Checked');
ok(DEMO_LINES.every(l => !('status' in l) && !('verdict' in l)), 'the script carries no status of its own');

// The rows behind each verdict are exactly what Step Check returns now.
for (const line of DEMO_LINES.filter(l => l.claims && l.claims.length)) {
  const fresh = line.claims(UNSURE.read).flatMap(c => stepCheck(c.meta, c.working).lines);
  const shown = base.lines.find(l => l.n === line.n).engine;
  ok(JSON.stringify(fresh.map(r => r.status)) === JSON.stringify(shown.map(r => r.status)), `line ${line.n}: the shown rows are Step Check's rows`);
}

// The confirmed reading is what is checked: read the glyph as v and line 2 breaks.
const asV = runDemo({ glyph: UNSURE.alternative });
ok(asV.lines[1].status === STATUS.ERROR && asV.firstError === 2, 'confirming v instead of u makes line 2 the first error (the reading is what is checked)');
ok(asV.lines.slice(2).every(l => l.status !== STATUS.ERROR), 'and nothing after the first error is called an error');
ok(asV.seeWhy === null, 'See why is drawn only for a break in the chain it compares');

// Fix line 4 and the error disappears; the line after it is then checked by the engine on its own terms.
const fixedChain = { ...CHAIN, lines: [CHAIN.lines[0], '= -1 + 4/(4-u^2)'] };
const fixed = runDemo({ glyph: UNSURE.read, chain: fixedChain });
ok(fixed.lines[3].status === STATUS.CHECKED, 'the correct line 4 is Checked by the engine');
ok(fixed.firstError === null && fixed.seeWhy === null, 'with line 4 correct there is no first error and no See why');
ok(fixed.lines[4].status === STATUS.UNVERIFIED, 'and line 5 (a definite integral, outside the engine) is Not verified, never ticked');

// Break line 3's limits: the engine, not the script, reports it.
const badLimits = DEMO_LINES.map(l => (l.n !== 3 ? l : { ...l, claims: g => l.claims(g).map(c => (c.working === 'tan(pi/4) = 1' ? { ...c, working: 'tan(pi/4) = 2' } : c)) }));
const lim = runDemo({ glyph: UNSURE.read, lines: badLimits });
ok(lim.lines[2].status === STATUS.ERROR && lim.firstError === 3, 'a wrong upper limit (tan(π/4) = 2) makes line 3 the first error');
ok(lim.lines[3].status === STATUS.FOLLOWS, 'and line 4 then follows from it');

// ── 2 · See why ──────────────────────────────────────────────────────────────
const v = base.seeWhy;
const f = u => (u * u) / (4 - u * u);
const g = u => 1 - 4 / (4 - u * u);
ok(v && v.kind === 'expression' && v.variable === 'u', 'See why compares the two expressions in u');
ok(v && v.point.x === 1 && Math.abs(v.point.before - 1 / 3) < 1e-12 && Math.abs(v.point.yours + 1 / 3) < 1e-12, 'at u = 1 the values are 0.333 and −0.333 (design fixture)');
ok(v && [0.5, 1.2, 1.7, 3].every(u => Math.abs(v.before.at(u) - f(u)) < 1e-9 && Math.abs(v.yours.at(u) - g(u)) < 1e-9), 'its curves are f(u) = u²/(4 − u²) and g(u) = 1 − 4/(4 − u²), the expressions Step Check compared');
ok(v && Math.abs(v.before.at(0) - v.yours.at(0)) < 1e-12, 'they agree at u = 0');
ok(base.correct === true, 'the correct form −1 + 4/(4 − u²) is shown only because the engine accepts it in place');
ok(runDemo({ glyph: 'u', correct: { ...CORRECT_LINE4, working: '= 1 + 4/(4-u^2)' } }).correct === false, 'a wrong "correct form" is never shown');

// ── 3 · Social proof stays hidden ────────────────────────────────────────────
ok(SOCIAL_PROOF_ENABLED === false, 'the social-proof flag is off');
ok(Array.isArray(SOCIAL_PROOF) && SOCIAL_PROOF.length === 0, 'no social-proof content is in the build');
ok(socialProofSlots().length === 0, 'production renders no slot');
ok(socialProofSlots(true, []).length === 0, 'the flag alone renders nothing (no empty placeholders)');
ok(socialProofSlots(true, [{ kind: 'teacher', body: 'A quote' }]).length === 0, 'content without a consent record never renders');
ok(socialProofSlots(true, [{ kind: 'teacher', body: 'A quote', consentRef: 'consent-1' }]).length === 1, 'consented content renders only with the flag on');
ok(socialProofSlots(false, [{ kind: 'teacher', body: 'A quote', consentRef: 'consent-1' }]).length === 0, 'and never with the flag off');

// ── 4 · Render ───────────────────────────────────────────────────────────────
const root = fileURLToPath(new URL('..', import.meta.url));
const { createServer } = await import('vite');
const react = (await import('@vitejs/plugin-react')).default;
const React = (await import('react')).default;
const { renderToStaticMarkup } = await import('react-dom/server');
const { MemoryRouter } = await import('react-router-dom');
// A server render: the router's layout effects cannot run, and say so on every render.
const consoleError = console.error;
console.error = (msg, ...rest) => { if (!String(msg).includes('useLayoutEffect does nothing on the server')) consoleError(msg, ...rest); };
const COMPETITORS = /leibniz|cuemath|byju|khan academy|photomath|mathway|chatgpt/i;
const server = await createServer({
  root, configFile: false, logLevel: 'error', appType: 'custom',
  server: { middlewareMode: true, hmr: false, watch: null }, optimizeDeps: { noDiscovery: true },
  plugins: [react()], define: { __PRI_FEATURE_TUTOR__: 'false', __PRI_PRODUCTION_BUILD__: 'false' }
});
try {
  const i18n = await server.ssrLoadModule('/src/i18n/index.js');
  const L = await server.ssrLoadModule('/src/landing/Landing.jsx');
  const P = await server.ssrLoadModule('/src/landing/PublicInfo.jsx');
  const H = await server.ssrLoadModule('/src/home/HomeVerified.jsx');
  const h = React.createElement;
  const at = (el, path = '/welcome') => renderToStaticMarkup(h(MemoryRouter, { initialEntries: [path] }, el));
  await i18n.setLanguage('en');

  const page = at(h(L.default, { demoInitial: L.FINAL }));
  ok(page.includes('Every line checked.') && page.includes('Not guessed.'), 'the headline');
  for (const [n, word] of [[1, 'Given'], [2, 'Checked'], [3, 'Checked'], [4, 'First error'], [5, 'Follows from line 4']]) {
    const cell = page.match(new RegExp(`data-demo-status="${n}">([\\s\\S]*?)</span><span class="lp-chip"`));
    ok(cell && /<svg/.test(cell[1]) && cell[1].includes(word), `line ${n}: an icon and the word "${word}"`);
  }
  ok(/data-demo-line="4" data-status="error"/.test(page) && /data-demo-line="2" data-status="checked"/.test(page), 'the final state carries the engine\'s statuses');
  ok(page.includes('Line 4 is the first error.'), 'the summary names the engine\'s first error');
  ok(page.includes('Correct form:') && page.includes('data-demo-correct'), 'the correct form is shown with See why');
  ok(page.includes('A scripted student.'), 'the page says the student is scripted');
  ok(page.includes('Every line is checked by a maths engine, and anything it can’t verify is labelled. AI never decides your mark.'), 'proof point 1, exactly');
  ok(page.includes('You confirm what we read from your handwriting before anything is marked.'), 'proof point 2, exactly');
  ok(!/data-social-proof|data-social-slot/.test(page), 'no social-proof slot renders in production');
  ok(!/\b\d{2,}(\.\d+)?\s?%|\b\d{1,3}(,\d{3})+\b|students? (use|trust)|rated|★/i.test(page.replace(/<[^>]+>/g, ' ')), 'no invented statistic or rating');
  ok(!COMPETITORS.test(page), 'no competitor is named');
  for (const href of ['/welcome/marking', '/welcome/syllabus', '/welcome/teachers', '/privacy', '/terms']) ok(page.includes(`href="${href}"`), `links to ${href}`);
  ok((page.match(/data-landing-signin|data-landing-create/g) || []).length === 2 && /href="\/"[^>]*data-landing-create|data-landing-create[^>]*href="\/"/.test(page.replace(/class="[^"]*"/g, '')), 'Sign in and Create an account open the sign-in card');
  ok(!/<input[^>]*type="text"|<textarea/.test(page), 'the demo takes no visitor text: nothing a visitor writes is checked signed out');

  const waiting = at(h(L.default, { demoInitial: { read: DEMO_LINES.length, glyph: null, lock: 0, open: false } }));
  ok(waiting.includes('data-demo-confirm') && waiting.includes('It’s u. Confirm') && waiting.includes('data-demo-state="waiting"'), 'it waits for the visitor to confirm u');
  ok(!/data-status="(checked|error|follows|unverified)"/.test(waiting), 'before confirmation no line has a status');

  // Edition copy: the syllabus proof point is the edition's.
  ok(L.syllabusKey('prithagoras') === 'landing.proofSyllabusAu' && L.syllabusKey('priyabhata') === 'landing.proofSyllabusIn', 'each edition has its own syllabus proof point');
  const enS = (await import('../src/i18n/strings.en.js')).default;
  ok(enS['landing.proofSyllabusAu'] === 'Built on the NSW Mathematics Advanced 2024 syllabus, first HSC 2027.', 'the Prithagoras syllabus line, exactly');
  ok(/CBSE/.test(enS['landing.proofSyllabusIn']) && /NCERT/.test(enS['landing.proofSyllabusIn']), 'the Priyabhata line names CBSE and NCERT');

  // See why, drawn with the real component, on the engine's view.
  const MG = await server.ssrLoadModule('/src/components/MistakeGraph.jsx');
  const sw = renderToStaticMarkup(h(MG.MistakeGraphView, { view: base.seeWhy }));
  ok(sw.includes('At u = 1 your line gives −0.333, but the line before gives 0.333.'), 'See why says the engine\'s counterexample in words');
  ok(/role="slider"/.test(sw) && /aria-live="polite"/.test(sw), 'See why is keyboard-operable with live values');

  for (const page of ['marking', 'syllabus', 'teachers']) {
    const html = at(h(P.default, { page }), `/welcome/${page}`);
    ok(html.includes(`data-landing-page="${page}"`) && /<h1/.test(html), `/welcome/${page} renders with a heading`);
    ok(!COMPETITORS.test(html), `/welcome/${page} names no competitor`);
  }

  await i18n.setLanguage('hi');
  const hiPage = at(h(L.default, { demoInitial: L.FINAL }));
  ok(hiPage.includes('हर पंक्ति की जाँच।') && hiPage.includes('पहली गलती'), 'Hindi renders the landing and its statuses');
  await i18n.setLanguage('en');

  // ── 5 · Home ───────────────────────────────────────────────────────────────
  const S = 'server';
  const exams = [
    { id: 'a', finished_at: 3, score: 72, total: 100, marked_by: S },
    { id: 'b', finished_at: 1, score: 61, total: 100, marked_by: S },
    { id: 'c', finished_at: 2, score: 68, total: 100, marked_by: S },
    { id: 'd', finished_at: 4, score: 10, total: 100, marked_by: S, provisional: true },
    { id: 'e', finished_at: null, score: 0, total: 100, marked_by: S },
    { id: 'f', finished_at: 5, score: 50, total: 100, marked_by: S, pending_marks: 4 },
    { id: 'g', finished_at: 6, score: 40, total: 100, marked_by: 'earlier-version' },
    { id: 'h', finished_at: 7, score: 45, total: 100, marked_by: 'backup' }
  ];
  const trend = papersTrend(exams);
  ok(JSON.stringify(trend.map(p => p.pct)) === '[61,68,72]', 'the trend is the papers the server marked in full, oldest first (provisional, pending, unfinished, restored-backup and earlier-version marks left out)');
  ok(papersTrend(exams.slice(0, 1)) === null && papersTrend([]) === null && papersTrend(null) === null, 'fewer than two papers: no trend');
  ok(sparkPath(trend).d.startsWith('M') && sparkPath(null) === null, 'the sparkline is drawn only from a trend');
  const trendHtml = at(h(H.PapersTrend, { exams }), '/');
  ok(trendHtml.includes('61 → 68 → 72') && trendHtml.includes('href="/exams"'), 'the trend renders with its numbers in text, linking to the Exam Desk');
  ok(at(h(H.PapersTrend, { exams: exams.slice(0, 1) }), '/') === '', 'and renders nothing with one paper');

  ok(latestMarked({ id: 'q', subtopicName: 'Integration', marksEarned: 2, marksPossible: 4 }).earned === 2, 'latest marked work reads the certified marks');
  ok(latestMarked({ id: 'q', subtopicName: 'Integration' }) === null && latestMarked({ id: 'q', marksEarned: 1, marksPossible: 2, repeat: true }) === null, 'no certified marks (or a repeat): nothing shown');

  ok(homeForecast() === null, 'hsc-forecast is not on main: no forecast is read');
  ok(marksAtStake({ data: { outcome: 'MAV-12-06' } }, null) === null, 'marks at stake is hidden without the forecast');
  const forecast = { weights: { 'MAV-12-06': 0.12 }, meta: { paperMarks: 100, bands: { 'MAV-12-06': [0.09, 0.14] }, disclaimer: 'Not a prediction.' } };
  ok(marksAtStake({ data: {} }, forecast) === null, 'and without the action\'s outcome');
  const stake = marksAtStake({ data: { outcome: 'MAV-12-06' } }, forecast);
  ok(stake && stake.lo === 9 && stake.hi === 14 && stake.disclaimer === 'Not a prediction.', 'with both, the band from forecastMeta, with its disclaimer');
  ok(marksAtStake({ data: { outcome: 'MAV-12-06' } }, { ...forecast, meta: { ...forecast.meta, disclaimer: '' } }) === null, 'never without the disclaimer');
  ok(at(h(H.MarksAtStake, { action: { data: { outcome: 'MAV-12-06' } } }), '/') === '', 'the Home card renders nothing today');

  ok(JSON.stringify(nextMeta({ kind: 'assignment', data: { remaining: 6 } })) === '{"questions":6,"minutes":null,"minutesLeft":null}', 'an assignment carries its remaining questions');
  ok(nextMeta({ kind: 'adaptive', data: { topic: 'x' } }).questions === null && nextMeta({ kind: 'smart-practice', data: {} }).minutes === null, 'practice carries no count or time, and none is invented');
  ok(nextMeta({ kind: 'exam', dueAt: 1000 + 25 * 60000, data: {} }, 1000).minutesLeft === 25, 'an exam in progress carries its real minutes left');
  ok(nextMeta({ kind: 'reviews', data: { count: 3, unit: 'topic' } }).questions === 3 && nextMeta({ kind: 'reviews', data: { count: 3, unit: 'dotpoint' } }).questions === null, 'due topic reviews carry their count; dot points are not questions');
  ok(at(h(H.default, { exams, recent: { id: 'q', subtopicName: 'Integration', marksEarned: 2, marksPossible: 4 }, action: null, showMarked: false }), '/').indexOf('data-home-latest-marked') === -1, 'the latest marked work is not repeated while the Resume card shows it');
  const aside = at(h(H.default, { exams: [], recent: null, action: null }), '/');
  ok(aside === '', 'with nothing true to show, the aside renders nothing');
} finally {
  await server.close();
}

// ── 6 · Strings and sources ──────────────────────────────────────────────────
const en = (await import('../src/i18n/strings.en.js')).default;
const hi = (await import('../src/i18n/strings.hi.js')).default;
const keys = Object.keys(en).filter(k => k.startsWith('landing.') || k.startsWith('home.vp.') || k === 'login.seeHowMarking');
ok(keys.length >= 60, `the new strings are catalogued (${keys.length})`);
ok(keys.every(k => k in hi), 'every new string has a Hindi translation');
ok(!/excellent|great job|amazing|well done/i.test(keys.map(k => JSON.stringify(en[k])).join(' ')), 'no praise words');
const landing = read('src/landing/Landing.jsx');
const script = read('src/landing/demoScript.js');
ok(!/edition-accent/.test(landing + read('src/landing/landing.css') + read('src/home/verifiedHome.css')), 'the edition accent stays off verdicts and charts (editions decision)');
ok(/import \{ stepCheck \} from '\.\.\/engine\/checker\.js'/.test(script) && /import \{ mistakeView \} from '\.\.\/engine\/mistakeView\.js'/.test(script), 'the demo imports the real engine');
ok(!/from '\.\.\/(api|platform\/cloud|tutor)/.test(landing + script), 'the demo calls no server, cloud or tutor');
ok(/prefers-reduced-motion: reduce/.test(read('src/landing/landing.css')) && /reducedMotion\(\) \? WAITING : START/.test(landing), 'reduced motion: every line read at once, but the visitor still confirms the reading');
const app = read('src/App.jsx');
ok(/<Route path="\/welcome" element=\{<Landing \/>\} \/>/.test(app) && /React\.lazy\(\(\) => import\('\.\/landing\/Landing\.jsx'\)\)/.test(app), 'the landing is a lazy, signed-out route');

if (failures.length) {
  console.error(`LANDING HOME: FAIL — ${failures.length} of ${pass + failures.length}`);
  for (const f of failures) console.error('  ✗ ' + f);
  process.exit(1);
}
console.log(`LANDING HOME: PASS — ${pass}/${pass} checks`);
