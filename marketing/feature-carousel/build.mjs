// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning — five-feature Instagram carousel (7 slides, 1080×1350)
//
// Emits slides/NN-*.html plus preview.html. `render.mjs` shoots the PNGs.
// Every colour is lifted verbatim from client/src/theme.css ("Design system v4
// — Dark LaTeX") and the type is the real Computer Modern the app ships: the
// KaTeX woff2 faces, read from client/node_modules/katex at build time and
// inlined as data URIs so a slide renders with no network and no font host.
//
// Edit this file, never the generated HTML.
//
// No slide carries a figure that is not measured in CI (the chapter count is
// IN_CURRICULUM's), and none carries a coverage, accuracy, price-saving,
// offline or examiner claim — owner decision D24 (1 Nov 2026); the banned
// phrases are enforced by client/test/marketing-claims-check.mjs.
// ─────────────────────────────────────────────────────────────────────────────
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const KATEX = resolve(HERE, '../../client/node_modules/katex/dist/fonts');

const W = 1080;
const H = 1350;

const face = (file, family, weight, style = 'normal') =>
  `@font-face{font-family:'${family}';src:url(data:font/woff2;base64,${
    readFileSync(`${KATEX}/${file}.woff2`).toString('base64')
  }) format('woff2');font-weight:${weight};font-style:${style};font-display:block}`;

const FONTS =
  face('KaTeX_Main-Regular', 'KaTeX_Main', 400) +
  face('KaTeX_Main-Bold', 'KaTeX_Main', 700) +
  face('KaTeX_Main-Italic', 'KaTeX_Main', 400, 'italic') +
  face('KaTeX_Math-Italic', 'KaTeX_Math', 400, 'italic') +
  face('KaTeX_AMS-Regular', 'KaTeX_AMS', 400);

// theme.css --font / --font-math
const SERIF = "'KaTeX_Main','Latin Modern Roman','Computer Modern',Georgia,'Times New Roman',serif";
const MATH = "'KaTeX_Math','KaTeX_Main',Georgia,serif";
// The student's ink. Caveat is the reel's hand but lives on a font host; the
// slides render offline, so the local script face is the one that lands.
const HAND = "'Caveat','Bradley Hand','Segoe Script','Chalkboard SE',cursive";

// theme.css :root (dark)
const T = {
  page: '#0a0a09',
  surface: '#101010',
  surface2: '#161615',
  ink: '#efece1',
  ink2: '#b3afa2',
  ink3: '#7c796d',
  cream: '#f4f1e0',
  creamInk: '#131310',
  gold: '#c9ad63',
  goldBright: '#e3c87e',
  good: '#5aa86c',
  bad: '#cf5f56',
  hair: 'rgba(240,236,224,0.13)',
  hairStrong: 'rgba(240,236,224,0.24)',
  hairFaint: 'rgba(240,236,224,0.07)',
};

const CSS = `
${FONTS}
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:${W}px;height:${H}px}
body{
  background:${T.page};color:${T.ink};font-family:${SERIF};
  -webkit-font-smoothing:antialiased;
}
.slide{
  position:relative;width:${W}px;height:${H}px;overflow:hidden;
  background:${T.page};
  display:flex;flex-direction:column;
  padding:96px 88px 76px;
}
/* light from the upper left, vignette to the corners — the film's grade */
.slide::before{
  content:'';position:absolute;inset:0;pointer-events:none;
  background:
    radial-gradient(120% 80% at 18% 0%, rgba(201,173,99,0.075), transparent 62%),
    radial-gradient(100% 100% at 50% 55%, transparent 38%, rgba(0,0,0,0.42));
}
.slide::after{
  content:'';position:absolute;inset:0;pointer-events:none;opacity:0.045;
  background-image:url("data:image/svg+xml;utf8,%3Csvg xmlns='http://www.w3.org/2000/svg' width='240' height='240'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3'/%3E%3C/filter%3E%3Crect width='240' height='240' filter='url(%23n)'/%3E%3C/svg%3E");
}
.slide>*{position:relative;z-index:1}

/* ── header ───────────────────────────────────────────────────────────── */
.kicker{
  font-size:23px;text-transform:uppercase;letter-spacing:0.18em;
  color:${T.gold};display:flex;align-items:center;gap:20px;
}
.kicker .num{color:${T.ink3};letter-spacing:0.18em}
.kicker .rule{flex:1;height:1px;background:${T.hair}}

/* ── type ─────────────────────────────────────────────────────────────── */
h1{
  font-size:104px;line-height:1.02;letter-spacing:-1.5px;font-weight:400;
  margin-top:44px;
}
h1 em{font-style:normal;color:${T.gold}}
h2{
  font-size:76px;line-height:1.06;letter-spacing:-1.1px;font-weight:400;
  margin-top:38px;
}
h2 em{font-style:normal;color:${T.gold}}
p.body{
  font-size:35px;line-height:1.52;color:${T.ink2};margin-top:34px;max-width:850px;
}
p.body b{color:${T.ink};font-weight:400}
.spacer{flex:1;min-height:12px}

/* ── measured chip ────────────────────────────────────────────────────── */
.stat{
  border:1px solid ${T.hair};border-radius:6px;background:${T.surface};
  padding:26px 30px;display:flex;flex-direction:column;gap:12px;
}
.stat .label{
  font-size:20px;text-transform:uppercase;letter-spacing:0.18em;color:${T.ink3};
}
.stat .value{font-size:41px;line-height:1.18;color:${T.ink}}
.stat .value b{color:${T.goldBright};font-weight:400}
.foot{font-size:21px;line-height:1.42;color:${T.ink3};margin-top:13px}
.foot code{font-family:'KaTeX_Typewriter',ui-monospace,monospace;font-size:19px}

/* ── footer ───────────────────────────────────────────────────────────── */
.footer{
  margin-top:44px;padding-top:26px;border-top:1px solid ${T.hairFaint};
  width:100%;align-self:stretch;
  display:flex;align-items:baseline;justify-content:space-between;
  font-size:24px;color:${T.ink3};letter-spacing:0.02em;
}
.mark{color:${T.ink2}}
.mark .P{font-family:'KaTeX_AMS',${SERIF}}
.idx{font-size:20px;letter-spacing:0.18em;text-transform:uppercase}

/* ── the ink demo ─────────────────────────────────────────────────────── */
.paper{
  border:1px solid ${T.hair};border-radius:6px;background:${T.surface};
  padding:28px 34px 26px;margin-top:34px;
}
.paper .cap{
  font-size:19px;text-transform:uppercase;letter-spacing:0.18em;color:${T.ink3};
  margin-bottom:24px;
}
.line{
  display:flex;align-items:center;gap:22px;padding:11px 0;
  border-bottom:1px solid ${T.hairFaint};
}
.line:last-child{border-bottom:none}
.ink{
  font-family:${HAND};font-size:52px;line-height:1;color:${T.ink};
  flex:1;letter-spacing:0.5px;
}
.tick{font-size:40px;color:${T.good};width:44px;text-align:center}
.cross{font-size:40px;color:${T.bad};width:44px;text-align:center}
.marks{
  font-size:22px;letter-spacing:0.14em;text-transform:uppercase;color:${T.ink3};
  width:118px;text-align:right;
}
.note{
  margin-top:22px;padding-left:22px;border-left:2px solid ${T.bad};
  font-size:27px;line-height:1.4;color:${T.ink2};
}
.note b{color:${T.ink};font-weight:400}

/* ── the ladder (levels slide) ────────────────────────────────────────── */
.ladder{margin-top:40px;display:flex;flex-direction:column;gap:0}
.rung{
  display:flex;align-items:baseline;gap:24px;padding:22px 0;
  border-bottom:1px solid ${T.hairFaint};
}
.rung:last-child{border-bottom:none}
.rung .name{font-size:40px;color:${T.ink};width:340px}
.rung .desc{font-size:26px;color:${T.ink3};flex:1;line-height:1.34}
.rung .tier{
  font-size:21px;letter-spacing:0.14em;color:${T.gold};text-transform:uppercase;
}

/* ── the class grid ───────────────────────────────────────────────────── */
.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-top:28px}
.cell{
  border:1px solid ${T.hair};border-radius:6px;background:${T.surface};
  padding:20px 20px;
}
.cell .n{font-size:40px;color:${T.ink};line-height:1}
.cell .t{font-size:19px;color:${T.ink3};margin-top:9px;line-height:1.3}

/* ── the symbol strip (recognition slide) ─────────────────────────────── */
.glyphs{
  border:1px solid ${T.hair};border-radius:6px;background:${T.surface};
  padding:24px 32px 22px;margin-top:30px;
}
.glyphs .cap{
  font-size:19px;text-transform:uppercase;letter-spacing:0.18em;color:${T.ink3};
  margin-bottom:22px;
}
.glyphs .row{
  font-family:${HAND};font-size:44px;line-height:1.46;color:${T.ink};
  display:flex;flex-wrap:wrap;gap:0 25px;letter-spacing:1px;
}
.glyphs .row span:nth-child(n+15){color:${T.ink2}}

/* ── the all-in-one slide ─────────────────────────────────────────────── */
/* The hero is the marked ink — the one thing no formula sheet can do — and the
   grid under it carries the rest of the product without turning into a list. */
.hero{
  border:1px solid ${T.hairStrong};border-radius:6px;background:${T.surface};
  padding:26px 32px 24px;margin-top:30px;
  box-shadow:0 26px 60px rgba(0,0,0,0.55);
}
.hero .cap{
  font-size:18px;text-transform:uppercase;letter-spacing:0.17em;color:${T.ink3};
  display:flex;justify-content:space-between;margin-bottom:16px;
}
.hero .cap .live{color:${T.gold}}
.hero .l{
  display:flex;align-items:center;gap:20px;padding:11px 0;
  border-bottom:1px solid ${T.hairFaint};
}
.hero .l.wrong{
  background:linear-gradient(90deg, rgba(207,95,86,0.10), transparent 78%);
  margin:0 -32px;padding-left:32px;padding-right:32px;
}
.hero .l:last-of-type{border-bottom:none}
.hero .w{
  font-family:${HAND};font-size:50px;line-height:1;color:${T.ink};
  flex:1;letter-spacing:0.5px;
}
.hero .m{
  font-size:19px;letter-spacing:0.14em;text-transform:uppercase;color:${T.ink3};
  width:84px;text-align:right;
}
.hero .v{font-size:38px;width:46px;text-align:center;color:${T.good}}
.hero .v.no{color:${T.bad}}
.hero .said{
  margin-top:17px;padding-left:20px;border-left:2px solid ${T.bad};
  font-size:26px;line-height:1.36;color:${T.ink2};
}
.hero .said b{color:${T.ink};font-weight:400}

.tiles{display:grid;grid-template-columns:repeat(3,1fr);gap:13px;margin-top:26px}
.tile{
  border:1px solid ${T.hair};border-radius:6px;background:${T.surface};
  padding:19px 19px 20px;
}
.tile .k{
  font-size:17px;text-transform:uppercase;letter-spacing:0.15em;color:${T.gold};
  display:block;
}
.tile .d{font-size:22px;line-height:1.31;letter-spacing:-0.2px;color:${T.ink};margin-top:10px}
.tile .d small{display:block;font-size:19px;color:${T.ink3};margin-top:6px;line-height:1.28}

.signoff{
  margin-top:28px;padding-top:24px;border-top:1px solid ${T.hairFaint};
  width:100%;display:flex;align-items:baseline;justify-content:space-between;
}
.signoff .mark{font-size:33px;color:${T.ink}}
.signoff .mark .P{font-family:'KaTeX_AMS',${SERIF}}
.signoff .mark em{font-style:normal;color:${T.gold};margin-left:20px}
.signoff .handle{font-size:23px;color:${T.ink3};letter-spacing:0.02em}

/* ── cover / CTA ──────────────────────────────────────────────────────── */
.cover{justify-content:center;align-items:flex-start;padding:96px 88px 76px}
.cover h1{font-size:92px;margin-top:0;letter-spacing:-1.2px}
.cover .sub{font-size:36px;color:${T.ink2};margin-top:46px;line-height:1.48;max-width:830px}
.swipe{
  margin-top:56px;font-size:23px;letter-spacing:0.18em;text-transform:uppercase;
  color:${T.gold};display:flex;align-items:center;gap:18px;
}
.swipe .dash{width:130px;height:1px;background:${T.hair};display:inline-block}
.lead{flex:0.7}
.cta{justify-content:center;align-items:center;text-align:center}
.cta .word{font-size:96px;letter-spacing:-1px}
.cta .word .P{font-family:'KaTeX_AMS',${SERIF}}
.cta .join{font-size:56px;color:${T.gold};margin-top:40px}
.cta .handle{font-size:34px;color:${T.ink2};margin-top:46px;line-height:1.6}
.pill{
  display:inline-block;margin-top:52px;padding:20px 44px;border-radius:3px;
  background:${T.cream};color:${T.creamInk};font-size:30px;letter-spacing:0.04em;
}
.rulebreak{width:150px;height:1px;background:${T.hairStrong};margin:56px auto 0}
`;

const page = (title, body) => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>${title}</title>
<style>${CSS}</style></head><body>${body}</body></html>`;

// ─── slide furniture ──────────────────────────────────────────────────────
const head = (kicker, num) => `<div class="kicker">${
  num ? `<span class="num">${num}</span>` : ''
}<span>${kicker}</span><span class="rule"></span></div>`;

const foot = i => `<div class="footer">
  <span class="mark"><span class="P">P</span>ri Learning</span>
  <span class="idx">${String(i).padStart(2, '0')} / 07</span>
</div>`;

const stat = (label, value, note) => `<div class="stat">
  <div class="label">${label}</div>
  <div class="value">${value}</div>
</div>${note ? `<div class="foot">${note}</div>` : ''}`;

// ─── the seven slides ─────────────────────────────────────────────────────
const SLIDES = [
  // The whole post on one artboard. Every line is true of the shipped app
  // (owner decision D24, 1 Nov 2026): no coverage, accuracy, price-saving,
  // offline or examiner claim, and no figure that is not measured in CI.
  ['00-all-in-one', 'Everything', `<div class="slide">
    ${head('Pri Learning')}
    <h1 style="font-size:62px;margin-top:24px;letter-spacing:-0.9px;line-height:1.08">Your handwriting, <em>read</em>.<br>Your answer, <em>marked</em>.<br>Class 7 to <em>JEE Advanced</em>.</h1>
    <div class="hero">
      <div class="cap"><span>Class 10 · Quadratic equations</span><span class="live">Marked by the engine</span></div>
      <div class="l"><span class="w">x<sup>2</sup> + 6x + 5 = 0</span><span class="m"></span><span class="v">✓</span></div>
      <div class="l"><span class="w">(x + 3)<sup>2</sup> − 9 + 5 = 0</span><span class="m"></span><span class="v">✓</span></div>
      <div class="l wrong"><span class="w">x = −1  or  x = 5</span><span class="m"></span><span class="v no">✗</span></div>
      <div class="said">Line 3 — <b>the sign flipped</b> taking the root across. Final answer: not accepted.</div>
    </div>
    <div class="tiles">
      <div class="tile"><span class="k">Handwriting</span>
        <div class="d">Reads your Pencil<small>Read by Pri’s server when you are online. Needs an account.</small></div></div>
      <div class="tile"><span class="k">Automatic marking</span>
        <div class="d">Checked by the engine<small>Final answer marked at once, with the worked solution. It can be wrong.</small></div></div>
      <div class="tile"><span class="k">Three tracks</span>
        <div class="d">Boards → JEE Advanced<small>CBSE / NCERT, JEE Main, JEE Advanced.</small></div></div>
      <div class="tile"><span class="k">Classes 7 to 12</span>
        <div class="d">77 chapters<small>Class 9: 8 of the 15 CBSE 2026–27 chapters. Class 8: the earlier NCERT book.</small></div></div>
      <div class="tile"><span class="k">Generated practice</span>
        <div class="d">Fresh numbers each time<small>Small pools repeat, and Pri says so when they do.</small></div></div>
      <div class="tile"><span class="k">Timed papers</span>
        <div class="d">Exam-style practice<small>Timed paper simulations, marked automatically. No rank is predicted.</small></div></div>
    </div>
    <div class="spacer"></div>
    <div class="signoff">
      <span class="mark"><span class="P">P</span>ri Learning <em>Join the change.</em></span>
      <span class="handle">@pri.learning — coming soon</span>
    </div>
  </div>`],

  ['01-cover', 'Cover', `<div class="slide cover">
    ${head('What Pri does')}
    <div class="lead"></div>
    <h1>Write the maths.<br>It marks the maths.</h1>
    <div class="sub">Handwriting read by Pri’s server, final answers marked automatically — maths practice
      for CBSE / NCERT Classes 7 to 12, JEE Main and JEE Advanced. Marking can be wrong.</div>
    <div class="swipe"><span>Five things</span><span class="dash"></span><span>→</span></div>
    <div class="spacer"></div>
    ${foot(1)}
  </div>`],

  ['02-recognition', 'Recognition', `<div class="slide">
    ${head('Recognition', '01')}
    <h2>It reads your handwriting,<br>not your <em>typing</em>.</h2>
    <p class="body">Write with the Pencil the way you would on paper — fractions, roots, exponents,
      multi-line working. When you are online, Pri’s server reads the ink and the engine marks the
      final answer. It needs an account and a connection, and the reading can be wrong: Pri shows
      what it read, and you can type instead.</p>
    <div class="glyphs">
      <div class="cap">fractions · roots · exponents · multi-line working</div>
      <div class="row">${
        ['0','1','2','3','4','5','6','7','8','9','x','y','t','n','a',
         'b','e','θ','π','√','÷','±','+','−','=','≠','≤','≥','%','°']
          .map(g => `<span>${g}</span>`).join('')
      }</div>
    </div>
    <div class="spacer"></div>
    <div class="foot">The ink is read by an outside AI service (OpenAI) through Pri’s server; the mark is decided
      by Pri’s own deterministic engine, never by the AI. Nothing leaves the device until you have agreed to that.</div>
    ${foot(2)}
  </div>`],

  ['03-marking', 'Marking', `<div class="slide">
    ${head('Feedback', '02')}
    <h2>The verdict lands on<br><em>your own answer</em>.</h2>
    <p class="body">Marked when you submit — the final answer is checked by Pri’s deterministic engine, and the
      worked solution shows every step and names the usual slip. Marking is automatic and can be wrong;
      the solution is there to check it against.</p>
    <div class="paper">
      <div class="cap">Class 10 · Quadratic equations</div>
      <div class="line"><span class="ink">x<sup>2</sup> + 6x + 5 = 0</span><span class="marks"></span><span class="tick">✓</span></div>
      <div class="line"><span class="ink">(x + 3)<sup>2</sup> − 9 + 5 = 0</span><span class="marks"></span><span class="tick">✓</span></div>
      <div class="line"><span class="ink">x = −1  or  x = 5</span><span class="marks"></span><span class="cross">✗</span></div>
      <div class="note">The maths breaks on this line — <b>the sign flipped</b> taking the
        root across. Final answer: not accepted.</div>
    </div>
    <div class="spacer"></div>
    <div class="foot">Not a grade alone: the worked solution and the named slip come with every marked answer.
      The ticks on working lines are illustrative; the mark is on the final answer.</div>
    ${foot(3)}
  </div>`],

  ['04-levels', 'Levels', `<div class="slide">
    ${head('Three tracks', '03')}
    <h2>Boards to <em>JEE Advanced</em>.<br>One app.</h2>
    <p class="body">Three tracks over the same mathematics. What separates them is not the
      chapter list — it is the pressure.</p>
    <div class="ladder">
      <div class="rung"><span class="name">CBSE / NCERT</span><span class="desc">The school syllabus, Classes 7–12</span><span class="tier">D1–D3</span></div>
      <div class="rung"><span class="name">JEE Main</span><span class="desc">Classes 11–12 at objective depth, negative marking, 3 hours</span><span class="tier">D1–D4</span></div>
      <div class="rung"><span class="name">JEE Advanced</span><span class="desc">Classes 11–12 at JEE Advanced depth</span><span class="tier">D3–D4</span></div>
    </div>
    <div class="spacer"></div>
    <div class="foot">Timed paper simulations in each track, marked automatically. Pri does not predict a rank.
      JEE Advanced is part of Premium.</div>
    ${foot(4)}
  </div>`],

  ['05-syllabus', 'Syllabus', `<div class="slide">
    ${head('Classes 7–12', '04')}
    <h2>Class 7 to Class 12.<br><em>77 chapters</em>.</h2>
    <p class="body">Chapters broken into the outcomes they teach, each with generated practice behind it.
      Class 9 currently has 8 of the 15 chapters in the CBSE 2026–27 list; Class 8 follows the earlier
      NCERT book.</p>
    <div class="grid">
      <div class="cell"><div class="n">7</div><div class="t">Integers, first algebra, plane geometry</div></div>
      <div class="cell"><div class="n">8</div><div class="t">Identities, mensuration, first graphs</div></div>
      <div class="cell"><div class="n">9</div><div class="t">Irrationals, polynomials, circles</div></div>
      <div class="cell"><div class="n">10</div><div class="t">The board year — quadratics, AP, trig</div></div>
      <div class="cell"><div class="n">11</div><div class="t">The JEE foundation year</div></div>
      <div class="cell"><div class="n">12</div><div class="t">Calculus, matrices, vectors, boards</div></div>
    </div>
    <div class="spacer"></div>
    <div class="foot">Not endorsed by, affiliated with or approved by NCERT, CBSE or the NTA.</div>
    ${foot(5)}
  </div>`],

  ['06-unlimited', 'Generated', `<div class="slide">
    ${head('Generated', '05')}
    <h2>Fresh numbers,<br><em>every time</em>.</h2>
    <p class="body">Questions are generated, so the same chapter at the same difficulty hands you a new
      question rather than the one you did last week. Small pools repeat, and Pri tells you when a
      question is a repeat.</p>
    <div class="spacer"></div>
    <div class="foot">Free: 20 practice questions a day and one timed paper every 30 days. Premium (₹199 a month or
      ₹1,499 a year): no daily cap, no paper limit, and the JEE Advanced track.</div>
    ${foot(6)}
  </div>`],

  ['07-cta', 'CTA', `<div class="slide cta">
    <div class="word"><span class="P">P</span>ri Learning</div>
    <div class="join">Join the change.</div>
    <div class="rulebreak"></div>
    <div class="handle">CBSE / NCERT Classes 7–12 · JEE Main · JEE Advanced<br>Marking is automatic and can be wrong</div>
    <div class="pill">Follow @pri.learning — coming soon</div>
  </div>`]
];

mkdirSync(resolve(HERE, 'slides'), { recursive: true });
for (const [file, title, body] of SLIDES) {
  writeFileSync(resolve(HERE, `slides/${file}.html`), page(`Pri Learning — ${title}`, body));
}

// preview.html — all seven at 40% for eyeballing the set as a set
writeFileSync(resolve(HERE, 'preview.html'), page('Pri Learning — carousel preview', `
<style>
  html,body{width:auto;height:auto}
  body{background:#1a1a18;padding:40px;display:flex;flex-wrap:wrap;gap:28px;justify-content:center}
  .shrink{width:${W * 0.4}px;height:${H * 0.4}px;overflow:hidden}
  .shrink .slide{transform:scale(0.4);transform-origin:top left}
</style>
${SLIDES.map(([, , body]) => `<div class="shrink">${body}</div>`).join('')}
`));

console.log(`built ${SLIDES.length} slides at ${W}×${H} → slides/, preview.html`);
