// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · E2E flow — mathematics reflows at 200% text (WCAG 1.4.10).
//
// A phone at 200% lays out in half its width: 188 CSS px on a 375 pt iPhone,
// 215 on a 430 pt one. At that width a formula with a tall superscript (powers,
// standard form, polynomials) is wider than the column. It must either wrap
// with the text or scroll inside a box of its own; it may never widen the page,
// and no box may cut it off — sideways, or at the top of a raised exponent.
//
// The flow signs a Class 8 student in, and for both widths serves questions
// from three chapters full of superscripts until it has a fixed sample of them
// (questions are served by the server, so the sample is drawn until the
// predicate "the prompt has a superscript" holds, a bounded number of times).
// For each one it audits every rendered formula in Type, in Write, and on the
// marked card with the worked solution:
//   · the page does not scroll sideways;
//   · a formula wider than its container sits in a box that scrolls
//     horizontally (overflow-x auto or scroll), never one that clips;
//   · no superscript is cut at the top or bottom by a box that hides overflow.
//
// Usage: node client/test/tour-math-reflow.js [--no-build] [--browser=webkit]
// Synthetic: the local test platform and the server's own question bank; not
// device evidence.
// ─────────────────────────────────────────────────────────────────────────────
import { pathToFileURL } from 'node:url';

export const SAMPLE_PER_WIDTH = 4;
const WIDTHS = [['375 pt iPhone at 200%', 188, 334], ['430 pt iPhone at 200%', 215, 466]];
const CHAPTERS = ['c8-exponents', 'c7-exponents-powers', 'c10-polynomials'];

export const MATH_AUDIT = () => {
  const out = [];
  const W = document.documentElement.clientWidth;
  const name = n => `${n.tagName.toLowerCase()}.${String(n.className).split(' ').filter(Boolean).slice(0, 2).join('.')}`;
  for (const k of document.querySelectorAll('.katex-html')) {
    const r = k.getBoundingClientRect();
    if (!r.width || !k.getClientRects().length) continue;
    let box = null;
    for (let n = k.parentElement; n && n !== document.body; n = n.parentElement) {
      const s = getComputedStyle(n);
      if (s.overflowX !== 'visible' || s.overflowY !== 'visible') { box = n; break; }
    }
    if (!box) { if (r.right > W + 1) out.push(`a formula runs ${Math.round(r.right - W)}px past the page in ${name(k.parentElement)}`); continue; }
    const b = box.getBoundingClientRect(); const s = getComputedStyle(box);
    if (r.right > b.right + 1 && !/auto|scroll/.test(s.overflowX)) out.push(`a formula is cut ${Math.round(r.right - b.right)}px on the right by ${name(box)} (overflow-x: ${s.overflowX})`);
    if (/auto|scroll/.test(s.overflowY) || s.overflowY === 'visible') continue;
    for (const sup of k.querySelectorAll('.msupsub')) {
      const q = sup.getBoundingClientRect();
      if (q.height && (q.top < b.top - 1 || q.bottom > b.bottom + 1)) { out.push(`a superscript is cut ${Math.round(Math.max(b.top - q.top, q.bottom - b.bottom))}px by ${name(box)} (overflow-y: ${s.overflowY})`); break; }
    }
  }
  return { over: document.documentElement.scrollWidth - W, issues: [...new Set(out)] };
};

export const flow = {
  id: 'math-reflow',
  name: 'Maths at 200% text: superscripted formulas wrap or scroll in their own box, nothing cut',
  online: true,

  async run({ page, check, goto, settle, createProfile, online, note, browserName = 'chromium' }) {
    await page.setViewportSize({ width: 1180, height: 820 });
    await goto('/');
    await createProfile({ name: 'Reflow Student', year: 8, course: 'in' });
    await online.signIn({ name: 'Reflow Student' });
    await settle();
    const typeTab = page.getByRole('button', { name: 'Answer by typing' });
    const writeTab = page.getByRole('button', { name: 'Answer by handwriting' });
    for (const [label, w, h] of WIDTHS) {
      await page.setViewportSize({ width: w, height: h });
      let sampled = 0;
      for (const sub of CHAPTERS) {
        if (sampled >= SAMPLE_PER_WIDTH) break;
        await goto(`/practice?subtopic=${sub}&track=cbse`);
        for (let i = 0; i < 8 && sampled < SAMPLE_PER_WIDTH; i++) {
          await page.waitForSelector('.q-prompt', { timeout: 30000 }).catch(() => {});
          await settle();
          if (await page.locator('.q-prompt .msupsub').count()) {
            sampled++;
            const id = (await page.locator('.qpage').getAttribute('data-question-id').catch(() => '')) || `#${sampled}`;
            const tag = `${browserName}, ${label}, ${sub} ${id.slice(0, 8)}`;
            if (await typeTab.count()) { await typeTab.click().catch(() => {}); await settle(); }
            const typed = await page.evaluate(MATH_AUDIT);
            await check(`${tag}: Type — the page does not scroll sideways and no formula is cut`, typed.over <= 1 && typed.issues.length === 0, JSON.stringify(typed));
            if (await writeTab.count()) {
              await writeTab.click().catch(() => {});
              await page.waitForSelector('.ink-canvas', { timeout: 15000 }).catch(() => {});
              await settle();
              const written = await page.evaluate(MATH_AUDIT);
              await check(`${tag}: Write — the page does not scroll sideways and no formula is cut`, written.over <= 1 && written.issues.length === 0, JSON.stringify(written));
            }
            // The worked solution: two answers the checker refuses resolve the card.
            if (await typeTab.count()) { await typeTab.click().catch(() => {}); await settle(); }
            const box = page.locator('.editor-body input.answer-input');
            if (await box.count()) {
              for (const v of ['987654', '987653']) {
                await box.fill(v).catch(() => {});
                await page.getByRole('button', { name: 'Submit Answer' }).click({ timeout: 8000 }).catch(() => {});
                await page.waitForTimeout(1200);
              }
              if (await page.waitForSelector('.eval-card', { timeout: 15000 }).then(() => true, () => false)) {
                await settle();
                const marked = await page.evaluate(MATH_AUDIT);
                await check(`${tag}: the marked card and its worked solution — no sideways scroll, no formula cut`, marked.over <= 1 && marked.issues.length === 0, JSON.stringify(marked));
              } else note(`${tag}: this question did not resolve to a worked solution after two refused answers`);
            }
          }
          await page.locator('.ctx-next, .ws-actions .btn-primary').first().click({ timeout: 8000 }).catch(() => {});
        }
      }
      await check(`${browserName}, ${label}: the sample holds ${SAMPLE_PER_WIDTH} superscripted questions`, sampled === SAMPLE_PER_WIDTH, `${sampled} found in ${CHAPTERS.join(', ')}`);
    }
    note('SYNTHETIC: served by the local test platform; Playwright layout at half width stands in for 200% text. Not device evidence.');
  }
};

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const { runFlows } = await import('./e2e.mjs');
  process.exit(await runFlows([flow]) ? 1 : 0);
}
