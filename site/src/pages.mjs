// Pri Learning public site · the pages.
//
// Two kinds of page live here. The notices (/privacy, /terms, /refunds, and the
// grievance section of /support) are rendered from docs/legal and carry no copy
// of their own. The rest — home, support, delete-account, the Hindi index — is
// written here and is held to the approved coverage wording by
// tools/site-check.mjs, which refuses the words that file lists.
//
// Approved wording (V1 decision D24, audit-content): "Maths practice for CBSE /
// NCERT Classes 7 to 12, JEE Main and JEE Advanced. 77 chapters. Marking is
// automatic and can be wrong. Not endorsed by NCERT, CBSE or NTA." plus the
// Class 8 and Class 9 labels. Nothing about a syllabus being whole, an accuracy
// figure, a question count, working without a connection, or who has reviewed
// the questions beyond what is true.

import { APP_DELETE_PATH, APP_ORIGIN, FREE_PLAN, PRICES, ROUTES, mapNoticeLink } from './config.mjs';
import { escapeHtml, page, t } from './layout.mjs';
import { lastUpdated, renderMarkdown, sectionTitles, slugify } from './markdown.mjs';

// ── Notices ──────────────────────────────────────────────────────────────────

/** Anchor ids shared by both languages: English slugs, matched to Hindi by position. */
function sharedIds(englishMarkdown) {
  const english = renderMarkdown(englishMarkdown).headings; // level, text, id
  return (index, level, text) => {
    const en = english[index];
    if (en && en.level === level) return en.id;
    return slugify(text) || `section-${index + 1}`;
  };
}

function noticeArticle({ slug, lang, docs, demote = 0, dropTitle = false, only = null }) {
  const source = docs[slug][lang];
  const idFor = sharedIds(docs[slug].en);
  const rendered = renderMarkdown(source, {
    mapLink: (href) => mapNoticeLink(lang, href),
    idFor,
    demote,
    dropTitle,
    only
  });
  if (/\{\{[A-Z_]+\}\}/.test(source)) {
    throw new Error(`docs/legal/${docs[slug].file[lang]} still contains a placeholder; the site will not publish a template.`);
  }
  const file = `docs/legal/${docs[slug].file[lang]}`;
  return {
    html: `<article class="prose notice" lang="${lang}" data-source="${file}">\n${rendered.html}\n</article>`,
    title: rendered.title,
    headings: rendered.headings.filter(h => h.level === 2),
    file,
    updated: lastUpdated(source)
  };
}

const NOTICE_DESCRIPTIONS = {
  en: {
    privacy: 'What Pri Learning collects, why, where it is stored and what you can ask us to do about it.',
    terms: 'The agreement between you and Pri Learning: what the app is and is not, subscriptions, content and law.',
    'refund-policy': 'How to cancel a Pri Learning subscription and when a refund is due.'
  },
  hi: {
    privacy: 'Pri Learning क्या इकट्ठा करता है, किसलिए, कहाँ रखता है और आप हमसे क्या करने को कह सकते हैं।',
    terms: 'आपके और Pri Learning के बीच अनुबंध: ऐप क्या है और क्या नहीं, सदस्यता, सामग्री और कानून।',
    'refund-policy': 'Pri Learning की सदस्यता कैसे रद्द करें और रिफ़ंड कब बनता है।'
  }
};

export function noticePage({ slug, lang, docs }) {
  const s = t(lang);
  const article = noticeArticle({ slug, lang, docs, dropTitle: true });
  const path = ROUTES[lang][slug];
  const body = `
<header class="page-head">
  <p class="eyebrow">${lang === 'hi' ? 'सूचना' : 'Notice'}</p>
  <h1>${escapeHtml(article.title)}</h1>
</header>
${article.html}
<p class="source">${s.generatedFrom(article.file)}</p>`;
  return page({
    lang,
    path,
    title: article.title,
    description: NOTICE_DESCRIPTIONS[lang][slug],
    alternate: ROUTES[lang === 'en' ? 'hi' : 'en'][slug],
    body,
    headings: article.headings
  });
}

// ── Support ──────────────────────────────────────────────────────────────────

/** The grievance officer's email, read from the notice so it cannot drift. */
export function contactEmail(docs) {
  const block = docs.grievance.en.split(/^## /m).find(part => /^Grievance officer/.test(part)) || '';
  const email = block.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/)?.[0];
  if (!email) throw new Error('docs/legal/grievance.md names no email under "Grievance officer".');
  return email;
}

export function supportPage({ lang, docs }) {
  const email = contactEmail(docs);
  const r = ROUTES[lang];
  const grievance = noticeArticle({ slug: 'grievance', lang, docs, demote: 1, dropTitle: true });
  const headings = [
    lang === 'hi' ? { id: 'contact', text: 'संपर्क' } : { id: 'contact', text: 'Contact' },
    lang === 'hi' ? { id: 'questions', text: 'आम सवाल' } : { id: 'questions', text: 'Common questions' },
    lang === 'hi' ? { id: 'grievance', text: 'शिकायतें' } : { id: 'grievance', text: 'Grievances' }
  ];
  const body = lang === 'en' ? `
<header class="page-head">
  <p class="eyebrow">Support</p>
  <h1>Support</h1>
  <p class="lede">Pri Learning is not on sale yet. This is where to write when it is, and how a grievance about your data or a subscription is handled today.</p>
</header>
<div class="prose">
  <h2 id="contact">Contact</h2>
  <dl class="contact">
    <dt>Email</dt><dd><a href="mailto:${email}">${email}</a></dd>
    <dt>Reply</dt><dd>Within 3 working days.</dd>
    <dt>About a subscription</dt><dd>Write from the email address on the account, with the date of the charge.</dd>
  </dl>
  <h2 id="questions">Common questions</h2>
  <dl class="qa">
    <dt>A question was marked wrongly.</dt>
    <dd>Marking is automatic and can be wrong. Report it from the question inside the app, which sends us the question and your answer; or write to us with the chapter and what you answered. A mark inside Pri Learning has no standing outside it.</dd>
    <dt>Cancelling, renewals and refunds.</dt>
    <dd>See the <a href="${r['refund-policy']}">cancellation and refund policy</a>. A subscription bought through the App Store is managed, cancelled and refunded in your Apple account, under Apple's terms.</dd>
    <dt>Deleting an account.</dt>
    <dd>In the app, or without it: <a href="${r['delete-account']}">how to delete your account</a>. Deletion is immediate.</dd>
    <dt>A student under 18.</dt>
    <dd>Pri checks a child's answers only after a parent or guardian has confirmed the account by a link or a code sent to them. The same link or code lets them withdraw at any time, which stops marking, reading and syncing at once. See <a href="${r.privacy}#children">Children</a> in the privacy notice.</dd>
    <dt>Seeing, correcting or exporting your data.</dt>
    <dd>The app exports what it holds about you. For anything else, write to the address above; the grievance process below applies. See <a href="${r.privacy}#your-rights">Your rights</a>.</dd>
  </dl>
  <h2 id="grievance">Grievances</h2>
</div>
${grievance.html}
<p class="source">${t(lang).generatedFrom(grievance.file)}</p>` : `
<header class="page-head">
  <p class="eyebrow">सहायता</p>
  <h1>सहायता</h1>
  <p class="lede">Pri Learning अभी बिक्री पर नहीं है। जब होगा, तो हमसे यहाँ लिखिए; आपके डेटा या सदस्यता से जुड़ी शिकायत आज कैसे सँभाली जाती है, वह भी नीचे है।</p>
</header>
<div class="prose">
  <h2 id="contact">संपर्क</h2>
  <dl class="contact">
    <dt>ईमेल</dt><dd><a href="mailto:${email}">${email}</a></dd>
    <dt>उत्तर</dt><dd>3 कार्य-दिवसों के भीतर।</dd>
    <dt>सदस्यता के बारे में</dt><dd>खाते वाले ईमेल पते से लिखिए और शुल्क की तारीख़ बताइए।</dd>
  </dl>
  <h2 id="questions">आम सवाल</h2>
  <dl class="qa">
    <dt>किसी प्रश्न की जाँच गलत हुई।</dt>
    <dd>जाँच स्वचालित है और गलत हो सकती है। ऐप में उसी प्रश्न से रिपोर्ट कीजिए, या हमें अध्याय और अपना उत्तर लिखकर भेजिए। Pri Learning के भीतर का कोई अंक उसके बाहर मान्य नहीं है।</dd>
    <dt>रद्द करना, नवीनीकरण और रिफ़ंड।</dt>
    <dd>देखिए <a href="${r['refund-policy']}">रद्दीकरण और रिफ़ंड नीति</a>। App Store से ली गई सदस्यता आपके Apple खाते में, Apple की शर्तों के अनुसार, सँभाली, रद्द और रिफ़ंड होती है।</dd>
    <dt>खाता मिटाना।</dt>
    <dd>ऐप में, या ऐप के बिना: <a href="${r['delete-account']}">अपना खाता कैसे मिटाएँ</a>। खाता तुरंत मिट जाता है।</dd>
    <dt>18 वर्ष से कम आयु का विद्यार्थी।</dt>
    <dd>Pri किसी बच्चे के उत्तर तभी जाँचता है जब माता-पिता या अभिभावक ने उन्हें भेजे गए लिंक या कोड से खाते की पुष्टि कर दी हो। उसी लिंक या कोड से वे कभी भी पुष्टि वापस ले सकते हैं। देखिए गोपनीयता सूचना में <a href="${r.privacy}#children">बच्चे</a>।</dd>
    <dt>अपना डेटा देखना, सुधरवाना या निर्यात करना।</dt>
    <dd>ऐप आपके बारे में रखी जानकारी निर्यात कर देता है। बाक़ी के लिए ऊपर दिए पते पर लिखिए; नीचे दी गई शिकायत-प्रक्रिया लागू होती है। देखिए <a href="${r.privacy}#your-rights">आपके अधिकार</a>।</dd>
  </dl>
  <h2 id="grievance">शिकायतें</h2>
</div>
${grievance.html}
<p class="source">${t(lang).generatedFrom(grievance.file)}</p>`;
  return page({
    lang,
    path: r.support,
    title: lang === 'hi' ? 'सहायता' : 'Support',
    description: lang === 'hi'
      ? 'Pri Learning से संपर्क, सदस्यता और रिफ़ंड के सवाल, खाता मिटाना, और शिकायत अधिकारी।'
      : 'How to reach Pri Learning, questions about subscriptions and refunds, deleting an account, and the grievance officer.',
    alternate: ROUTES[lang === 'en' ? 'hi' : 'en'].support,
    body,
    headings
  });
}

// ── Delete account ───────────────────────────────────────────────────────────

export function deleteAccountPage({ lang, docs }) {
  const email = contactEmail(docs);
  const r = ROUTES[lang];
  const titles = sectionTitles(docs.privacy.en);
  const keep = titles.indexOf('How long we keep it');
  const rights = titles.indexOf('Your rights');
  if (keep < 0 || rights < 0) throw new Error('privacy.md no longer has the "How long we keep it" and "Your rights" sections this page quotes.');
  const quoted = noticeArticle({ slug: 'privacy', lang, docs, demote: 1, dropTitle: true, only: [keep, rights] });
  const appDelete = `${APP_ORIGIN}${APP_DELETE_PATH}`;
  const headings = lang === 'en'
    ? [{ id: 'in-the-app', text: 'In the app' }, { id: 'without-the-app', text: 'Without the app' }, { id: 'by-email', text: 'By email' }, { id: 'what-is-removed', text: 'What is removed and what is kept' }]
    : [{ id: 'in-the-app', text: 'ऐप में' }, { id: 'without-the-app', text: 'ऐप के बिना' }, { id: 'by-email', text: 'ईमेल से' }, { id: 'what-is-removed', text: 'क्या मिटता है और क्या रहता है' }];
  const body = lang === 'en' ? `
<header class="page-head">
  <p class="eyebrow">Account</p>
  <h1>Delete your account</h1>
  <p class="lede">Deletion is immediate. There is no waiting period, and your email address can be used again for a new, empty account.</p>
</header>
<div class="prose">
  <h2 id="in-the-app">In the app</h2>
  <ol class="steps">
    <li>Open <b>Settings → Account</b>.</li>
    <li>Choose <b>Delete account</b> and confirm it with your password, with your Apple or Google sign-in, or with a code sent to the email address or mobile number on the account.</li>
  </ol>
  <h2 id="without-the-app">Without the app</h2>
  <p>Open the app's deletion page at <a href="${appDelete}">${appDelete.replace(/^https:\/\//, '')}</a>, enter the email address on the account, and enter the code sent to it. The page answers the same way whether or not an account exists at that address, so nobody can use it to find out who has one.</p>
  <h2 id="by-email">By email</h2>
  <p>Write to <a href="mailto:${email}">${email}</a> from the email address on the account. The grievance officer handles it within the period published under <a href="${r.grievance}">Grievances</a>.</p>
  <h2 id="what-is-removed">What is removed and what is kept</h2>
  <p>From the <a href="${r.privacy}">privacy notice</a> (${escapeHtml(quoted.updated)}):</p>
</div>
${quoted.html}
<p class="source">${t(lang).generatedFrom(quoted.file)}</p>` : `
<header class="page-head">
  <p class="eyebrow">खाता</p>
  <h1>अपना खाता मिटाएँ</h1>
  <p class="lede">खाता तुरंत मिट जाता है। कोई प्रतीक्षा-अवधि नहीं है, और उसी ईमेल पते से नया, खाली खाता फिर बनाया जा सकता है।</p>
</header>
<div class="prose">
  <h2 id="in-the-app">ऐप में</h2>
  <ol class="steps">
    <li><b>सेटिंग्स → खाता</b> खोलिए।</li>
    <li><b>खाता मिटाएँ</b> चुनिए और अपने पासवर्ड, Apple या Google साइन-इन, या खाते के ईमेल पते अथवा मोबाइल नंबर पर भेजे गए कोड से पुष्टि कीजिए।</li>
  </ol>
  <h2 id="without-the-app">ऐप के बिना</h2>
  <p>ऐप का खाता-मिटाने वाला पन्ना <a href="${appDelete}">${appDelete.replace(/^https:\/\//, '')}</a> खोलिए, खाते का ईमेल पता लिखिए, और उस पर भेजा गया कोड डालिए। उस पते पर खाता हो या न हो, पन्ना एक ही तरह उत्तर देता है, ताकि कोई उससे यह पता न लगा सके कि किसका खाता है।</p>
  <h2 id="by-email">ईमेल से</h2>
  <p>खाते वाले ईमेल पते से <a href="mailto:${email}">${email}</a> पर लिखिए। शिकायत अधिकारी इसे <a href="${r.grievance}">शिकायतें</a> के तहत प्रकाशित अवधि के भीतर निपटाते हैं।</p>
  <h2 id="what-is-removed">क्या मिटता है और क्या रहता है</h2>
  <p><a href="${r.privacy}">गोपनीयता सूचना</a> से (${escapeHtml(quoted.updated)}):</p>
</div>
${quoted.html}
<p class="source">${t(lang).generatedFrom(quoted.file)}</p>`;
  return page({
    lang,
    path: r['delete-account'],
    title: lang === 'hi' ? 'अपना खाता मिटाएँ' : 'Delete your account',
    description: lang === 'hi'
      ? 'Pri Learning खाता ऐप में, ऐप के बिना या ईमेल से कैसे मिटाएँ, और मिटाने पर क्या हटता है।'
      : 'How to delete a Pri Learning account in the app, without the app, or by email, and what deletion removes.',
    alternate: ROUTES[lang === 'en' ? 'hi' : 'en']['delete-account'],
    body,
    headings
  });
}

// ── Hindi index ──────────────────────────────────────────────────────────────

export function hindiIndexPage({ docs }) {
  const r = ROUTES.hi;
  const title = (slug) => renderMarkdown(docs[slug].hi).title;
  const body = `
<header class="page-head">
  <p class="eyebrow">हिन्दी</p>
  <h1>हिन्दी में सूचनाएँ</h1>
  <p class="lede">Pri Learning की सूचनाएँ और सहायता-पन्ने हिन्दी में। हर हिन्दी दस्तावेज़ अनुवाद है; अंग्रेज़ी पाठ ही मान्य है, और यह बात हर पन्ने के पहले अनुच्छेद में लिखी है। मुख्य साइट अंग्रेज़ी में है।</p>
</header>
<ul class="index-list">
  <li><a href="${r.support}"><span>सहायता</span><small>संपर्क, आम सवाल, शिकायतें</small></a></li>
  <li><a href="${r.privacy}"><span>${escapeHtml(title('privacy'))}</span><small>${escapeHtml(lastUpdated(docs.privacy.hi))}</small></a></li>
  <li><a href="${r.terms}"><span>${escapeHtml(title('terms'))}</span><small>${escapeHtml(lastUpdated(docs.terms.hi))}</small></a></li>
  <li><a href="${r['refund-policy']}"><span>${escapeHtml(title('refund-policy'))}</span><small>${escapeHtml(lastUpdated(docs['refund-policy'].hi))}</small></a></li>
  <li><a href="${r['delete-account']}"><span>अपना खाता मिटाएँ</span><small>ऐप में, ऐप के बिना, ईमेल से</small></a></li>
</ul>
<p class="fine" style="margin-top:24px">ऐप में प्रश्न, संकेत और हल अंग्रेज़ी में हैं; ऐप का इंटरफ़ेस अंग्रेज़ी और हिन्दी में है।</p>`;
  return page({
    lang: 'hi',
    path: '/hi',
    title: 'हिन्दी में सूचनाएँ',
    description: 'Pri Learning की गोपनीयता सूचना, उपयोग की शर्तें, रिफ़ंड नीति, सहायता और खाता मिटाने का पन्ना, हिन्दी में।',
    alternate: '/',
    body
  });
}

// ── Not found ────────────────────────────────────────────────────────────────

export function notFoundPage() {
  const body = `
<header class="page-head">
  <p class="eyebrow">404</p>
  <h1>There is no page here.</h1>
  <p class="lede">The address may be from the app, which lives at <code>${APP_ORIGIN.replace(/^https:\/\//, '')}</code>, or it may simply be wrong.</p>
</header>
<ul class="index-list">
  <li><a href="/"><span>Home</span></a></li>
  <li><a href="/support"><span>Support</span></a></li>
  <li><a href="/privacy"><span>Privacy notice</span></a></li>
  <li><a href="/terms"><span>Terms of use</span></a></li>
  <li><a href="/refunds"><span>Cancellation and refund policy</span></a></li>
  <li><a href="/delete-account"><span>Delete your account</span></a></li>
</ul>`;
  return page({ lang: 'en', path: '/404', title: 'Not found', description: 'This page does not exist on prilearning.com.', alternate: null, body, noindex: true });
}

// ── Home ─────────────────────────────────────────────────────────────────────

// MathML, so the maths is typeset by the browser with no font download and no
// script. These are illustrations of the kind of question the app sets; the
// hero sheet is labelled as a typeset illustration, not a screenshot.
const M = {
  quadratic: '<math><mrow><mn>2</mn><msup><mi>x</mi><mn>2</mn></msup><mo>−</mo><mn>5</mn><mi>x</mi><mo>+</mo><mn>2</mn><mo>=</mo><mn>0</mn></mrow></math>',
  line1: '<math><mrow><mn>2</mn><msup><mi>x</mi><mn>2</mn></msup><mo>−</mo><mn>4</mn><mi>x</mi><mo>−</mo><mi>x</mi><mo>+</mo><mn>2</mn><mo>=</mo><mn>0</mn></mrow></math>',
  line2: '<math><mrow><mn>2</mn><mi>x</mi><mo stretchy="false">(</mo><mi>x</mi><mo>−</mo><mn>2</mn><mo stretchy="false">)</mo><mo>−</mo><mn>1</mn><mo stretchy="false">(</mo><mi>x</mi><mo>−</mo><mn>2</mn><mo stretchy="false">)</mo><mo>=</mo><mn>0</mn></mrow></math>',
  line3: '<math><mrow><mo stretchy="false">(</mo><mn>2</mn><mi>x</mi><mo>−</mo><mn>1</mn><mo stretchy="false">)</mo><mo stretchy="false">(</mo><mi>x</mi><mo>−</mo><mn>2</mn><mo stretchy="false">)</mo><mo>=</mo><mn>0</mn></mrow></math>',
  line4: '<math><mrow><mi>x</mi><mo>=</mo><mfrac><mn>1</mn><mn>2</mn></mfrac><mspace width="0.6em"></mspace><mtext>or</mtext><mspace width="0.6em"></mspace><mi>x</mi><mo>=</mo><mn>2</mn></mrow></math>',
  fractions: '<math><mrow><mfrac><mn>3</mn><mn>4</mn></mfrac><mo>+</mo><mfrac><mn>5</mn><mn>6</mn></mfrac><mo>−</mo><mfrac><mn>1</mn><mn>3</mn></mfrac></mrow></math>',
  ap: '<math><mrow><mn>3</mn><mo>,</mo><mn>7</mn><mo>,</mo><mn>11</mn><mo>,</mo><mn>15</mn><mo>,</mo><mi>…</mi></mrow></math>',
  integral: '<math><mrow><msubsup><mo>∫</mo><mn>0</mn><mfrac><mi>π</mi><mn>2</mn></mfrac></msubsup><mi>cos</mi><mo>⁡</mo><mi>x</mi><mspace width="0.17em"></mspace><mi>d</mi><mi>x</mi></mrow></math>',
  limit: '<math><mrow><munder><mi>lim</mi><mrow><mi>x</mi><mo>→</mo><mn>0</mn></mrow></munder><mfrac><mrow><mi>sin</mi><mo>⁡</mo><mn>3</mn><mi>x</mi></mrow><mi>x</mi></mfrac></mrow></math>',
  complex: '<math><mrow><msup><mrow><mo stretchy="false">(</mo><mn>1</mn><mo>+</mo><mi>i</mi><mo stretchy="false">)</mo></mrow><mn>8</mn></msup></mrow></math>'
};

export function homePage({ docs }) {
  const r = ROUTES.en;
  const body = `
<section class="hero" aria-labelledby="hero-title">
  <div class="shell">
    <div>
      <p class="eyebrow">Maths practice · India · Coming soon</p>
      <h1 id="hero-title">Write the maths by hand. Pri checks the answer.</h1>
      <p class="lede">Maths practice for <b>CBSE / NCERT Classes 7 to 12, JEE Main and JEE Advanced</b>. Write your working with an Apple Pencil or a finger, or type it. The mark is decided by a fixed set of mathematical rules, not by an AI model — and it can be wrong.</p>
      <p class="status"><i aria-hidden="true"></i><span>Coming soon on the App Store for iPhone and iPad, in India.</span><small>Android later.</small></p>
      <p class="hero-links"><a href="#marking">How a question is marked</a><a href="#coverage">What it covers</a><a href="${r.privacy}">Privacy notice</a></p>
    </div>
    <div class="sheet-wrap">
    <div class="glow" aria-hidden="true"></div>
    <figure class="sheet" aria-label="A typeset illustration of a worked solution">
      <div class="sheet-head"><span>Class 10 · Quadratic equations</span><span>Typeset illustration, not a screenshot</span></div>
      <p class="question">Solve ${M.quadratic}.</p>
      <ol class="work">
        <li><span class="n">1</span><span class="expr">${M.line1}</span><span class="note">read from handwriting</span></li>
        <li><span class="n">2</span><span class="expr">${M.line2}</span><span class="note">confirmed by the student</span></li>
        <li><span class="n">3</span><span class="expr">${M.line3}</span><span class="note"></span></li>
        <li class="final"><span class="n">4</span><span class="expr">${M.line4}</span><span class="note">final answer · checked by rule</span></li>
      </ol>
      <figcaption class="sheet-foot"><span><b>Read</b> by the server, <b>confirmed</b> by the student, <b>marked</b> by rule.</span><span>Marks are for the final answer.</span></figcaption>
    </figure>
    </div>
  </div>
</section>

<section class="section" id="marking" aria-labelledby="marking-title">
  <div class="shell">
    <div class="section-head">
      <h2 id="marking-title">How a question is marked</h2>
      <p>Three parts, kept separate on purpose. A reader proposes what you wrote; a fixed engine decides whether it is right; you can see and correct the step in between.</p>
    </div>
    <div class="ledger three">
      <div><span class="k">1</span><h3>You write</h3><div class="cell"><p>With an Apple Pencil, a finger or the keyboard, one line of working at a time. You can also photograph working done on paper, or a textbook question to practise questions like it.</p></div></div>
      <div><span class="k">2</span><h3>Pri reads it</h3><div class="cell"><p>A picture of your writing goes to Pri's server, which passes it to OpenAI to read. Nothing is sent until you have agreed to this, once, and you can turn it off at any time and type instead. The picture never carries the question, the expected answer or your name.</p><p>You see the transcription and can correct it before it counts.</p></div></div>
      <div><span class="k">3</span><h3>The rules decide</h3><div class="cell"><p>The mark is decided by Pri's marking engine, a fixed set of mathematical rules, never by an AI model. Marks are for the final answer. Marking is automatic and can be wrong: if a question is marked wrongly, report it from the question and we will look at it. A mark inside Pri Learning has no standing outside it.</p></div></div>
    </div>
  </div>
</section>

<section class="section" id="coverage" aria-labelledby="coverage-title">
  <div class="shell">
    <div class="section-head">
      <h2 id="coverage-title">What it covers</h2>
      <p>Maths practice for CBSE / NCERT Classes 7 to 12, JEE Main and JEE Advanced. 77 chapters. Practise by class, chapter and difficulty, sit timed papers, see the worked solution once a question is finished, and follow your progress chapter by chapter.</p>
    </div>
    <div class="ledger">
      <div><h3>Class 7</h3><p class="row-math"><span class="lead">Simplify</span> ${M.fractions}</p></div>
      <div><h3>Class 8</h3><p>Follows the earlier NCERT book.</p></div>
      <div><h3>Class 9</h3><p>8 of the 15 chapters in the CBSE 2026-27 list.</p></div>
      <div><h3>Class 10</h3><p class="row-math"><span class="lead">Find the sum of the first 20 terms of</span> ${M.ap}</p></div>
      <div><h3>Classes 11 and 12</h3><p class="row-math"><span class="lead">Evaluate</span> ${M.integral}</p></div>
      <div><h3>JEE Main</h3><p class="row-math"><span class="lead">Find</span> ${M.limit}</p></div>
      <div><h3>JEE Advanced <span class="tag">Premium</span></h3><p class="row-math"><span class="lead">Simplify</span> ${M.complex}</p></div>
    </div>
    <div style="margin-top:28px">
      <p class="honest">Questions, hints and worked solutions are in English. The app's interface is in English and Hindi.</p>
      <p class="honest">The questions and the marking rules are checked by automated tests. They have not yet had an independent human review. Not endorsed by NCERT, CBSE or NTA.</p>
    </div>
  </div>
</section>

<section class="section" id="plans" aria-labelledby="plans-title">
  <div class="shell">
    <div class="section-head">
      <h2 id="plans-title">Free and Premium</h2>
      <p>Both plans use the same marking engine. Premium lifts the limits and adds the JEE Advanced track.</p>
    </div>
    <div class="plans">
      <div class="plan"><h3>Free <span class="price">No charge</span></h3><ul>
        <li>${FREE_PLAN.questionsPerDay} practice questions a day</li>
        <li>One timed paper every ${FREE_PLAN.paperEveryDays} days</li>
        <li>CBSE / NCERT Classes 7 to 12 and JEE Main</li>
      </ul></div>
      <div class="plan premium"><h3>Premium <span class="price">${PRICES.monthly} a month · ${PRICES.annual} a year</span></h3><ul>
        <li>No daily practice limit</li>
        <li>No timed-paper limit</li>
        <li>The JEE Advanced track</li>
      </ul></div>
    </div>
    <p class="plan-note">Premium prices are App Store prices, charged by Apple once the app is on sale; the price is shown before you pay and the subscription renews until you cancel it in your Apple account. Handwriting and photo reads have a daily allowance on each plan, which the app shows. See the <a href="${r.terms}">terms</a> and the <a href="${r['refund-policy']}">refund policy</a>.</p>
  </div>
</section>

<section class="section" id="privacy" aria-labelledby="privacy-title">
  <div class="shell">
    <div class="section-head">
      <h2 id="privacy-title">Privacy, plainly</h2>
      <p>The <a href="${r.privacy}">privacy notice</a> says exactly what is collected, where it is stored and for how long. The short version:</p>
    </div>
    <div class="plain">
      <p><b>No ads. No tracking.</b> Not on this site, not in the app. We do not sell your data.</p>
      <p><b>An account, and a connection, to check answers.</b> Work done without a connection is kept on your device until it can be checked.</p>
      <p><b>Under 18? A parent or guardian confirms first.</b> They get a link or a code, and can withdraw at any time.</p>
      <p><b>Your handwriting is read by OpenAI, after you agree.</b> Pri keeps no copy of the picture, and it never goes with the question, the expected answer or your name.</p>
      <p><b>Delete your account whenever you like.</b> In the app, or <a href="${r['delete-account']}">without it</a>. Deletion is immediate.</p>
      <p><b>Questions and grievances.</b> A named grievance officer, a reply within 3 working days, and the Data Protection Board of India if we do not resolve it. See <a href="${r.support}">Support</a>.</p>
    </div>
  </div>
</section>`;
  return page({
    lang: 'en',
    path: '/',
    title: 'Pri Learning — maths practice for CBSE / NCERT and JEE, marked by rule',
    description: 'Maths practice for CBSE / NCERT Classes 7 to 12, JEE Main and JEE Advanced. Write by hand or type; the mark is decided by a fixed set of mathematical rules, not an AI model, and it can be wrong. Coming soon for iPhone and iPad in India.',
    alternate: null,
    body,
    wide: true,
    bodyClass: 'home'
  });
}
