// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the Hindi fallback matcher, shared by the Hindi browser flow
// (client/test/tour-hindi.js) and its own regression (the flow's self-test).
//
// It answers one question about a rendered screen: is any English INTERFACE
// string, or any raw catalogue key, on it? It compares visible text against the
// interface catalogue only, so mathematics is never mistaken for a bug — but a
// catalogue word can also be an ordinary English word in a question ("$2$
// points" as an answer option is the text node " points"). Question content is
// English on purpose under the Hindi interface, and the app declares it with
// lang="en" (ExamRoom, QuestionCard, TypedAnswerFields). Text under a lang="en"
// element is therefore content, not a fallback, and is not compared. Everything
// else — every label, button, tag and status line — is.
// ─────────────────────────────────────────────────────────────────────────────

const flat = v => (typeof v === 'string' ? [v] : Object.values(v || {}));

/**
 * Every English interface string whose Hindi is different — i.e. every string
 * whose appearance on a Hindi screen is a fallback. A key with no Hindi at all
 * is included (its English is what the screen would fall back to). Templates
 * become patterns with their placeholders as wildcards; a template with too
 * little fixed text to be distinctive ("{n}%", "{a} · {b}") is left out rather
 * than matching half the page.
 */
export function englishInterfaceForms(en, hi) {
  const out = [];
  for (const [key, value] of Object.entries(en)) {
    const hiForms = flat(hi[key]);
    for (const form of flat(value)) {
      if (hiForms.includes(form)) continue;
      const fixed = form.replace(/\{\w+\}/g, ' ').replace(/[^A-Za-z]+/g, ' ').trim();
      if (fixed.split(' ').filter(w => w.length >= 2).length < (form.includes('{') ? 2 : 1) || fixed.length < 4) continue;
      out.push({ key, form });
    }
  }
  return out;
}

/**
 * In the page (passed to page.evaluate): every English catalogue string that is
 * on screen, and every raw key. Text inside KaTeX is skipped — it is typeset
 * mathematics — and so is text inside a lang="en" region, which is declared
 * English question content. Attributes are always checked: aria-label, title,
 * placeholder and alt are written by the interface, not by the curriculum.
 */
export function leaksOnPage({ english, keys }) {
  const norm = s => String(s || '').replace(/\s+/g, ' ').trim();
  const patterns = english.map(({ key, form }) => {
    if (!form.includes('{')) return { key, form: norm(form), re: null };
    const parts = norm(form).split(/\{\w+\}/).map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    return { key, form, re: new RegExp(`^${parts.join('.+?')}$`) };
  });
  const keySet = new Set(keys);
  const seen = [];
  const consider = (text, where) => {
    const t = norm(text);
    if (!t || !/[A-Za-z]/.test(t)) return;
    if (keySet.has(t)) { seen.push(`raw key ${t} (${where})`); return; }
    for (const p of patterns) {
      if (p.re ? p.re.test(t) : p.form === t) { seen.push(`“${t.slice(0, 70)}” = ${p.key} (${where})`); return; }
    }
  };
  const visible = el => {
    if (!el) return false;
    const style = getComputedStyle(el);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    return el.getClientRects().length > 0;
  };
  const declaredEnglish = el => {
    const region = el.closest('[lang]');
    return !!region && region !== document.documentElement && region.getAttribute('lang') === 'en';
  };
  const root = document.querySelector('.shell') || document.body;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    const parent = node.parentElement;
    if (!parent || parent.closest('.katex, script, style, noscript')) continue;
    if (declaredEnglish(parent)) continue;
    if (!visible(parent)) continue;
    consider(node.nodeValue, parent.tagName.toLowerCase());
  }
  for (const el of root.querySelectorAll('[aria-label], [title], [placeholder], [alt]')) {
    for (const attr of ['aria-label', 'title', 'placeholder', 'alt']) {
      if (el.hasAttribute(attr)) consider(el.getAttribute(attr), `${el.tagName.toLowerCase()}[${attr}]`);
    }
  }
  return [...new Set(seen)];
}

/** Render a fixture into the page's .shell (a self-test helper; no app code runs). */
export async function renderFixture(page, html) {
  await page.setContent(`<!doctype html><html lang="hi"><body><div class="shell">${html}</div></body></html>`);
}
