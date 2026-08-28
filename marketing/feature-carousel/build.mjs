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
// Every figure on a slide is a measured one, and each carries its command in
// COPY beside it — see POST.md's claims table. Do not add a number here that
// README's "Measured accuracy" block does not carry.
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
.rows{margin-top:28px;display:flex;flex-direction:column}
.r{
  display:flex;align-items:flex-start;gap:20px;padding:17px 0;
  border-bottom:1px solid ${T.hairFaint};
}
.r:last-child{border-bottom:none}
.r .no{
  font-size:21px;letter-spacing:0.14em;color:${T.gold};width:42px;
  padding-top:6px;flex:none;
}
.r .txt{flex:1}
.r .name{
  font-size:20px;text-transform:uppercase;letter-spacing:0.18em;color:${T.ink3};
}
.r .say{font-size:28px;line-height:1.32;color:${T.ink};margin-top:9px}
.r .say b{color:${T.goldBright};font-weight:400}
.r .fig{
  width:212px;flex:none;text-align:right;padding-top:4px;
  font-size:29px;line-height:1.24;color:${T.goldBright};
}
.r .fig small{
  display:block;font-size:17px;letter-spacing:0.13em;text-transform:uppercase;
  color:${T.ink3};margin-top:7px;
}
.signoff{
  margin-top:34px;padding-top:24px;border-top:1px solid ${T.hairFaint};
  width:100%;display:flex;align-items:baseline;justify-content:space-between;
}
.signoff .mark{font-size:32px;color:${T.ink}}
.signoff .mark .P{font-family:'KaTeX_AMS',${SERIF}}
.signoff .mark em{font-style:normal;color:${T.gold};margin-left:22px}
.signoff .handle{font-size:24px;color:${T.ink3};letter-spacing:0.02em}

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
  // The whole post on one artboard — the five features, each with the figure
  // that backs it. Same numbers, same commands as the carousel; POST.md's
  // claims table covers both.
  ['00-all-in-one', 'Everything', `<div class="slide">
    ${head('What Pri does')}
    <h1 style="font-size:70px;margin-top:26px">Write the maths.<br>It marks the maths.</h1>
    <div class="rows">
      <div class="r">
        <div class="no">01</div>
        <div class="txt"><div class="name">Recognition</div>
          <div class="say">Reads your <b>handwriting</b> on the iPad itself — no network,
            no account.</div></div>
        <div class="fig">98.4%<small>characters read</small></div>
      </div>
      <div class="r">
        <div class="no">02</div>
        <div class="txt"><div class="name">Instant feedback</div>
          <div class="say"><b>✓ and ✗ on your own ink</b>, line by line, with the
            misconception named.</div></div>
        <div class="fig">795 / 795<small>mistakes named</small></div>
      </div>
      <div class="r">
        <div class="no">03</div>
        <div class="txt"><div class="name">Every level</div>
          <div class="say">Boards to <b>JEE Advanced</b> — CBSE, JEE Main, JEE Advanced,
            Olympiad.</div></div>
        <div class="fig">4 tracks<small>one syllabus</small></div>
      </div>
      <div class="r">
        <div class="no">04</div>
        <div class="txt"><div class="name">Every class</div>
          <div class="say"><b>Class 7 to Class 12</b>, every NCERT chapter mapped to its
            syllabus lines.</div></div>
        <div class="fig">252 / 252<small>dot points covered</small></div>
      </div>
      <div class="r">
        <div class="no">05</div>
        <div class="txt"><div class="name">Unlimited</div>
          <div class="say">Questions built from a <b>seed</b>, not drawn from a pool.
            Premium: no cap.</div></div>
        <div class="fig">3,44,798<small>distinct questions</small></div>
      </div>
    </div>
    <div class="spacer"></div>
    <div class="foot">Measured, not asserted — 98.4% is characters on held-out simulated
      writers (n = 560 lines, worst hand 71%); 3,44,798 distinct questions observed at 3,000
      draws per cell, thinnest cell 54.</div>
    <div class="signoff">
      <span class="mark"><span class="P">P</span>ri Learning <em>Join the change.</em></span>
      <span class="handle">@pri.learning — coming soon</span>
    </div>
  </div>`],

  ['01-cover', 'Cover', `<div class="slide cover">
    ${head('What Pri does')}
    <div class="lead"></div>
    <h1>Write the maths.<br>It marks the maths.</h1>
    <div class="sub">Handwriting read on the iPad itself, working marked line by line —
      Class 7 to JEE Advanced, and the question bank does not run out.</div>
    <div class="swipe"><span>Five things</span><span class="dash"></span><span>→</span></div>
    <div class="spacer"></div>
    ${foot(1)}
  </div>`],

  ['02-recognition', 'Recognition', `<div class="slide">
    ${head('Recognition', '01')}
    <h2>It reads your handwriting,<br>not your <em>typing</em>.</h2>
    <p class="body">A convolutional net ships <b>inside the app</b> — 597 kB of int8 weights,
      running on the iPad itself. Fractions, roots, exponents, multi-line working. No network,
      no upload, no account. It learns your hand, per profile.</p>
    <div class="glyphs">
      <div class="cap">56 symbols · read on device</div>
      <div class="row">${
        // Every glyph here is a class the shipped net actually has —
        // client/src/ink/model-data.js, 56 of them. Do not add one that is not.
        ['0','1','2','3','4','5','6','7','8','9','x','y','t','n','a',
         'b','e','θ','π','√','÷','±','+','−','=','≠','≤','≥','%','°']
          .map(g => `<span>${g}</span>`).join('')
      }</div>
    </div>
    <div class="spacer"></div>
    ${stat(
      'Held-out writer suite · 40 writers × 14 lines',
      '<b>98.4%</b> of characters read correctly<br><b>94.5%</b> of whole lines exact',
      'Simulated writers, n = 560 lines — <code>inkcheck-holdout2.mjs</code>. Worst single hand: 71%. Not a human trial.'
    )}
    ${foot(2)}
  </div>`],

  ['03-marking', 'Marking', `<div class="slide">
    ${head('Feedback', '02')}
    <h2>The ticks land on<br><em>your own ink</em>.</h2>
    <p class="body">Marked the moment you lift the Pencil — line by line, method marks awarded
      where the reasoning holds even when the final answer does not, and the exact line where
      the maths breaks named in the margin.</p>
    <div class="paper">
      <div class="cap">Class 10 · Quadratic equations</div>
      <div class="line"><span class="ink">x<sup>2</sup> + 6x + 5 = 0</span><span class="marks">M1</span><span class="tick">✓</span></div>
      <div class="line"><span class="ink">(x + 3)<sup>2</sup> − 9 + 5 = 0</span><span class="marks">M1</span><span class="tick">✓</span></div>
      <div class="line"><span class="ink">x = −1  or  x = 5</span><span class="marks">A1</span><span class="cross">✗</span></div>
      <div class="note">The maths breaks on this line — <b>you keep flipping the sign</b> taking the
        root across. 2 of 3 marks.</div>
    </div>
    <div class="spacer"></div>
    <div class="foot">A grade is not feedback. The misconception has a name, and the engine
      names it — <b>795 / 795</b> seeded mistakes identified, <code>npm run test:diagnose</code>.</div>
    ${foot(3)}
  </div>`],

  ['04-levels', 'Levels', `<div class="slide">
    ${head('Every level', '03')}
    <h2>Boards to <em>JEE Advanced</em>.<br>One app.</h2>
    <p class="body">Four tracks over the same mathematics. What separates them is not the
      chapter list — it is the pressure.</p>
    <div class="ladder">
      <div class="rung"><span class="name">CBSE / NCERT</span><span class="desc">The school syllabus, Classes 7–12</span><span class="tier">D1–D3</span></div>
      <div class="rung"><span class="name">JEE Main</span><span class="desc">Classes 11–12 at objective depth, negative marking, 3 hours</span><span class="tier">D1–D4</span></div>
      <div class="rung"><span class="name">JEE Advanced</span><span class="desc">The same syllabus taken to multi-concept depth</span><span class="tier">D1–D4</span></div>
      <div class="rung"><span class="name">Olympiad</span><span class="desc">PRMO → RMO → INMO — not harder school maths, a different subject</span><span class="tier">D1–D4</span></div>
    </div>
    <div class="spacer"></div>
    <div class="foot">Full mock papers with criteria marking, a predicted percentile from your
      own practice, and Match Mode races. Percentile is an estimate from practice data — not a
      guarantee of results.</div>
    ${foot(4)}
  </div>`],

  ['05-syllabus', 'Syllabus', `<div class="slide">
    ${head('Every class', '04')}
    <h2>Class 7 to Class 12.<br><em>All of it</em>, mapped.</h2>
    <p class="body">Not a chapter list on a landing page — every NCERT chapter broken into the
      syllabus lines it teaches, each with a generator behind it.</p>
    <div class="grid">
      <div class="cell"><div class="n">7</div><div class="t">Integers, first algebra, plane geometry</div></div>
      <div class="cell"><div class="n">8</div><div class="t">Identities, mensuration, first graphs</div></div>
      <div class="cell"><div class="n">9</div><div class="t">Irrationals, polynomials, proof</div></div>
      <div class="cell"><div class="n">10</div><div class="t">The board year — quadratics, AP, trig</div></div>
      <div class="cell"><div class="n">11</div><div class="t">The JEE foundation year</div></div>
      <div class="cell"><div class="n">12</div><div class="t">Calculus, matrices, vectors, boards</div></div>
    </div>
    <div class="spacer"></div>
    ${stat(
      'Syllabus coverage',
      '<b>252 / 252</b> dot points covered<br><b>220</b> targeted exactly · <b>0</b> reach zero',
      '<code>node tools/dotpoint-coverage.mjs</code> — 32 are reachable only alongside a sibling, so 220 is the number that survives “targeted”.'
    )}
    ${foot(5)}
  </div>`],

  ['06-unlimited', 'Unlimited', `<div class="slide">
    ${head('Unlimited', '05')}
    <h2>The bank does<br><em>not run out</em>.</h2>
    <p class="body">Every question is built from a seed, not drawn from a pool — so the same
      chapter at the same difficulty hands you a new question, not the one you did last week.
      Premium is unlimited: every track, every class, no cap.</p>
    <div class="spacer"></div>
    ${stat(
      'Question census · 3,000 draws × 336 cells',
      '<b>344,798</b> distinct questions observed<br>thinnest cell holds <b>54</b> · <b>0</b> cells return one',
      '<code>node tools/count-questions.mjs</code>, last measured 2026-08-21. “Unlimited” is a claim about the space; the thin-cell number is the half that keeps it honest.'
    )}
    ${foot(6)}
  </div>`],

  ['07-cta', 'CTA', `<div class="slide cta">
    <div class="word"><span class="P">P</span>ri Learning</div>
    <div class="join">Join the change.</div>
    <div class="rulebreak"></div>
    <div class="handle">Class 7 to Olympiad · marked like an examiner<br>All of it on your iPad</div>
    <div class="pill">Follow @pri.learning — coming soon</div>
  </div>`],
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
