// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · E2E flow — the numbers a student sees are the numbers in the
// attempt ledger (§14).
//
// client/test/progress-truth-check.mjs proves the routes agree with the raw
// attempt rows. This proves the SCREENS do: a real Class 10 CBSE profile made
// through onboarding answers questions in Practice, and after each sitting the
// suite reads the attempt rows straight out of the browser's IndexedDB,
// recomputes every figure independently, and compares it with what India
// Progress and Home actually render:
//
//   · Questions answered, Chapters started, Chapters practised
//   · Demonstrated accuracy — withheld ("Not enough evidence yet", with how
//     many answers are still needed) below ten answers, the exact ratio above
//   · every row of the chapter table (attempts, correct)
//   · Home's daily-goal ring and streak line
//
// Run on its own:  node client/test/tour-progress-truth.js
// ─────────────────────────────────────────────────────────────────────────────
import { pathToFileURL } from 'node:url';

const STUDENT = { name: 'Progress Truth', year: 10, course: 'in' };

/** In the page: the current profile's attempts, straight from IndexedDB. */
async function ledger() {
  const pid = localStorage.getItem('pri-current-profile');
  const db = await new Promise((res, rej) => { const r = indexedDB.open('pri-learning'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const rows = await new Promise((res, rej) => {
    const r = db.transaction('attempts', 'readonly').objectStore('attempts').getAll();
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
  db.close();
  const mine = rows.filter(a => a.pid === pid);
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' });
  const today = fmt.format(new Date());
  const ev = mine.filter(a => a.mode !== 'rush' && a.mode !== 'match' && a.subtopic && a.subtopic !== 'custom');
  const byCh = {};
  for (const a of ev) {
    const c = byCh[a.subtopic] || (byCh[a.subtopic] = { attempts: 0, correct: 0 });
    c.attempts++; if (a.correct) c.correct++;
  }
  const correct = ev.filter(a => a.correct).length;
  return {
    answered: mine.length,
    evidence: ev.length,
    accuracy: ev.length >= 10 ? Math.round(1000 * correct / ev.length) / 10 : null,
    byCh,
    started: Object.keys(byCh).length,
    practised: Object.values(byCh).filter(c => c.attempts >= 5).length,
    today: mine.filter(a => fmt.format(new Date(a.createdAt)) === today).length
  };
}

async function answerCurrentQuestion(page) {
  const type = page.getByRole('button', { name: /Answer by typing/i }).first();
  if (await type.count()) await type.click();
  await page.waitForTimeout(120);
  const mcq = page.locator('.mcq button:visible').first();
  const answer = page.locator('.answer-input:visible').first();
  const working = page.locator('.working-input:visible').first();
  if (await mcq.count()) await mcq.click();
  else if (await answer.count()) await answer.fill('0');
  else if (await working.count()) await working.fill('0');
  const button = page.locator('.editor-foot .btn-primary:visible, .row.no-print .btn-primary:visible').first();
  if (await button.count()) { await button.click(); await page.waitForTimeout(200); }
  // A first wrong answer leaves the question open; Show solution closes it.
  const reveal = page.getByRole('button', { name: /Show solution/i }).first();
  // Show solution forfeits the marks, so it takes a second, confirming press.
  if (await reveal.isVisible().catch(() => false)) { await reveal.click(); await reveal.click(); await page.waitForTimeout(220); }
}

export const flow = {
  id: 'progress-truth',
  name: 'Progress truth · rendered numbers = attempt ledger',

  async run({ page, base, check, goto, createProfile, settle }) {
    await goto('/');
    await createProfile(STUDENT);

    const sitting = async (n) => {
      await page.goto(`${base}/practice`, { waitUntil: 'domcontentloaded' });
      for (let i = 0; i < n; i++) {
        await page.waitForSelector('.q-prompt', { timeout: 30000 });
        const before = (await page.evaluate(ledger)).answered;
        await answerCurrentQuestion(page);
        await page.waitForFunction(async (b) => {
          const pid = localStorage.getItem('pri-current-profile');
          const db = await new Promise(res => { const r = indexedDB.open('pri-learning'); r.onsuccess = () => res(r.result); });
          const n = await new Promise(res => { const r = db.transaction('attempts').objectStore('attempts').getAll(); r.onsuccess = () => res(r.result.filter(a => a.pid === pid).length); });
          db.close();
          return n > b;
        }, before, { timeout: 15000 }).catch(() => {});
        const next = page.locator('.ctx-next').first();
        if (i < n - 1 && await next.count()) { await next.click(); await settle(); }
      }
    };

    const audit = async (label) => {
      const L = await page.evaluate(ledger);
      await page.goto(`${base}/progress`, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('[data-metric="answered"]', { timeout: 30000 });
      await settle();
      const shown = await page.evaluate(() => {
        const v = sel => document.querySelector(`[data-metric="${sel}"] [data-value]`)?.getAttribute('data-value');
        return {
          answered: Number(v('answered')), started: Number(v('started')), practised: Number(v('practised')),
          accuracy: v('accuracy'),
          accuracyText: document.querySelector('[data-metric="accuracy"]')?.innerText || '',
          rows: [...document.querySelectorAll('tr[data-chapter]')].map(tr => ({
            id: tr.getAttribute('data-chapter'), attempts: Number(tr.getAttribute('data-attempts')), correct: Number(tr.getAttribute('data-correct')),
            text: tr.innerText
          }))
        };
      });
      await check(`${label}: Questions answered = attempt rows`, shown.answered === L.answered, `${shown.answered} vs ${L.answered}`);
      await check(`${label}: Chapters started = chapters with evidence`, shown.started === L.started, `${shown.started} vs ${L.started}`);
      await check(`${label}: Chapters practised = chapters with 5+ answers`, shown.practised === L.practised, `${shown.practised} vs ${L.practised}`);
      const drift = shown.rows.filter(r => (L.byCh[r.id]?.attempts || 0) !== r.attempts || (L.byCh[r.id]?.correct || 0) !== r.correct);
      await check(`${label}: every chapter row = the ledger for that chapter`, drift.length === 0, JSON.stringify(drift.slice(0, 3)));
      const thin = shown.rows.filter(r => r.attempts > 0 && r.attempts < 5);
      await check(`${label}: a chapter with under five answers shows no percentage`, thin.every(r => /Too few answers/.test(r.text) && !/\d%/.test(r.text)), JSON.stringify(thin.slice(0, 2).map(r => r.text)));
      if (L.accuracy == null) {
        await check(`${label}: accuracy is withheld below ten answers`, shown.accuracy === '' && /Not enough evidence yet/.test(shown.accuracyText), shown.accuracyText);
        const need = 10 - L.evidence;
        await check(`${label}: …and says how many answers it still needs`, new RegExp(`Shown after ${need} more answers?`).test(shown.accuracyText), shown.accuracyText);
      } else {
        await check(`${label}: accuracy = correct / answers over the ledger`, Number(shown.accuracy) === L.accuracy, `${shown.accuracy} vs ${L.accuracy}`);
      }
      await page.goto(`${base}/`, { waitUntil: 'domcontentloaded' });
      // Home's week card carries today's count (the goal ring it replaced was
      // the same number drawn as a ring).
      await page.waitForSelector('.goal-card[data-today]', { timeout: 30000 });
      await settle();
      const ring = await page.locator('.goal-card').getAttribute('data-today');
      await check(`${label}: Home's goal counts today's answers`, parseInt(ring, 10) === L.today, `${JSON.stringify(ring)} vs ${L.today}`);
      await check(`${label}: …and says so in words`, (await page.locator('.goal-sub').innerText()).includes(String(L.today)), await page.locator('.goal-sub').innerText());
      const goalSub = await page.locator('.goal-sub').innerText();
      await check(`${label}: Home's streak is one day`, /\b1\b/.test(goalSub), JSON.stringify(goalSub));
      return L;
    };

    await sitting(3);
    const L1 = await audit('After 3 answers');
    await check('the first sitting produced answers', L1.answered >= 3, String(L1.answered));
    await sitting(8);
    const L2 = await audit('After 11 answers');
    await check('the second sitting crossed the accuracy floor', L2.evidence >= 10, String(L2.evidence));
  }
};

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const { runOne } = await import('./e2e.mjs');
  process.exit(await runOne(flow) ? 1 : 0);
}
