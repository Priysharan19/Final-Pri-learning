// F9: "Listen" on a worked step. Hidden when the device has no on-device voice;
// shown, and speaking verbalised maths with the hi-IN / en-IN voice, once a
// (stubbed) speechSynthesis lists one. The stub records what would be spoken;
// nothing is said aloud and nothing leaves the page.
// The question is real: the test server issues c10-tangent-length-reasoning seed 1
// ("…AB = 9 cm, BC = 19 cm and CA = 14 cm, find BD"), and the real server marks it. Only
// the issue SEED is pinned (test server only, never deployed). Synthetic run.
import { pathToFileURL } from 'node:url';

const PIN = { generator: 'c10-tangent-length-reasoning', difficulty: 1, curriculum: 'in', seed: 1 };
const POST_ISSUE = /\/v1\/practice\/issue(?:\?.*)?$/;
const LISTEN = '.solution-panel [data-listen]';

// A test-only speechSynthesis: starts with NO voices, records each utterance.
function stubSpeech() {
  const target = new EventTarget();
  const state = { voices: [], spoken: [] };
  const synth = Object.assign(target, {
    getVoices: () => state.voices.slice(),
    speak(u) { state.spoken.push({ text: u.text, lang: u.lang, voice: u.voice && u.voice.lang }); },
    cancel() {}, pause() {}, resume() {}, speaking: false, pending: false, paused: false
  });
  Object.defineProperty(window, 'speechSynthesis', { configurable: true, get: () => synth });
  // The real utterance only accepts a real SpeechSynthesisVoice; the stub's
  // voices are plain objects, so the utterance is stubbed too.
  window.SpeechSynthesisUtterance = class { constructor(text) { this.text = text; } };
  window.__priSpeech = state;
}
const front = page => page.locator('.qpage[data-question-id]');

export const flow = {
  id: 'listen',
  name: 'Listen · hidden with no voice, speaks a worked step with an on-device voice',
  online: true,
  async run({ page, base, goto, createProfile, online, check, note, settle }) {
    await goto('/');
    await createProfile({ name: 'Listen Student', year: 10, course: 'in' });
    await online.signIn({ name: 'Listen Student' });
    const issued = [];
    await page.addInitScript(stubSpeech);
    await page.route(POST_ISSUE, async route => {
      const original = route.request().postDataJSON() || {};
      const response = await route.fetch({ postData: JSON.stringify({ ...original, ...PIN }) });
      issued.push({ status: response.status(), body: (await response.text()).slice(0, 300), original });
      await route.fulfill({ response });
    });
    await page.goto(`${base}/practice?subtopic=c10-linear-pair-methods`, { waitUntil: 'domcontentloaded' });
    await front(page).locator('.q-prompt').waitFor({ timeout: 30000 });
    await settle();
    const issuedAnswer = async () => {
      let a = await online.answerOf();
      for (let i = 0; i < 10 && a.kind === 'unissued'; i++) { await page.waitForTimeout(500); a = await online.answerOf(); }
      return a;
    };
    let known = await issuedAnswer();
    for (let n = 0; n < 4 && !/\$AB = 9\$ cm, \$BC = 19\$ cm and \$CA = 14\$ cm/.test(known.prompt || ''); n++) {
      const before = await front(page).getAttribute('data-question-id');
      await page.locator('.ctx-next').click();
      await page.waitForFunction(id => {
        const q = document.querySelector('.qpage[data-question-id]');
        return q && q.getAttribute('data-question-id') !== id && !!q.querySelector('.q-prompt');
      }, before, { timeout: 30000 });
      known = await issuedAnswer();
    }
    if (!await check('the real server issued the pinned AB 9, BC 19, CA 14 triangle question',
      /\$AB = 9\$ cm, \$BC = 19\$ cm and \$CA = 14\$ cm/.test(known.prompt || '') && known.kind === 'text', JSON.stringify({ known, issued }).slice(0, 1200))) return;

    const typing = page.getByRole('button', { name: 'Answer by typing' });
    if (await typing.count()) await typing.click();
    await page.locator('[data-final-answer]').fill(known.text);
    await page.locator('.ws-actions .btn-primary').click();
    await page.locator('.eval-card').waitFor({ state: 'visible', timeout: 30000 });
    const panel = page.locator('details.solution-panel summary');
    if (await panel.count()) await panel.first().click();
    await page.locator('.solution-panel .step').first().waitFor({ state: 'visible', timeout: 30000 });

    const steps = await page.locator('.solution-panel .step').count();
    await check('no voice on the device: the worked steps show no Listen control', steps > 0 && await page.locator(LISTEN).count() === 0, `steps ${steps}`);

    // A network-only voice must not bring the control back.
    await page.evaluate(() => { window.__priSpeech.voices = [{ lang: 'en-IN', name: 'Net', localService: false }]; window.speechSynthesis.dispatchEvent(new Event('voiceschanged')); });
    await page.waitForTimeout(300);
    await check('a network-only voice keeps it hidden', await page.locator(LISTEN).count() === 0);

    await page.evaluate(() => { window.__priSpeech.voices = [{ lang: 'hi-IN', name: 'Lekha', localService: true }, { lang: 'en-IN', name: 'Rishi', localService: true }]; window.speechSynthesis.dispatchEvent(new Event('voiceschanged')); });
    const listen = page.locator(LISTEN).first();
    await listen.waitFor({ state: 'visible', timeout: 10000 });
    await check('an on-device voice shows one Listen per worked step', await page.locator(LISTEN).count() === steps, `${await page.locator(LISTEN).count()} for ${steps} steps`);
    await check('Listen is a named, unpressed button', await listen.evaluate(b => b.tagName === 'BUTTON' && b.getAttribute('aria-pressed') === 'false' && b.textContent.trim() === 'Listen'));
    await listen.click();
    const spoken = await page.evaluate(() => window.__priSpeech.spoken);
    await check('it speaks the step with the en-IN on-device voice', spoken.length === 1 && spoken[0].lang === 'en-IN' && spoken[0].voice === 'en-IN', JSON.stringify(spoken));
    await check('the maths is verbalised: no LaTeX reaches the voice', !!spoken[0]?.text && !/[$\\{}^]/.test(spoken[0].text), spoken[0]?.text);
    await check('while speaking it offers Stop', await listen.getAttribute('aria-pressed') === 'true' && (await listen.textContent()).trim() === 'Stop');
    await listen.click();
    await check('Stop returns it to Listen', await listen.getAttribute('aria-pressed') === 'false');
    note('Synthetic run: speechSynthesis is a test stub that records utterances; no device voice was heard. No physical-device claim.');
  }
};

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const { onlinePlatform } = await import('./support/online-session.mjs');
  await onlinePlatform({ allowSeededPractice: true });
  const { runOne } = await import('./e2e.mjs');
  process.exit(await runOne(flow) ? 1 : 0);
}
