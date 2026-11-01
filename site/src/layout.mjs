// Pri Learning public site · the page shell every page shares.
//
// One header, one footer, one theme button, one language link. No analytics,
// no third-party requests, no web fonts: the system faces are good and the
// page has nothing to phone home about. Every URL is root-relative so the
// link check in tools/site-check.mjs can resolve it against the output.

import { ROUTES, SITE_ORIGIN } from './config.mjs';

export const escapeHtml = (s) => String(s)
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;');

// The P′ mark, as in client/public/favicon.svg: P in ink, the prime in copper.
export const MARK_SVG = `<svg class="mark" viewBox="0 0 100 100" width="26" height="26" aria-hidden="true" focusable="false"><g transform="translate(3.56 10.01) scale(0.86)"><path d="M15.5 88V13H47Q58.81 13 67.15 21.35Q75.5 29.69 75.5 41.5Q75.5 53.31 67.15 61.65Q58.81 70 47 70H32.5V88ZM32.5 27V56H47Q53.01 56 57.25 51.75Q61.5 47.51 61.5 41.5Q61.5 35.49 57.25 31.25Q53.01 27 47 27Z" fill="currentColor"/><path d="M79 1 95 4.5 84 34 74.5 31.5 79 1Z" fill="var(--prime)"/></g></svg>`;

const STRINGS = {
  en: {
    skip: 'Skip to content',
    nav: [['support', 'Support'], ['privacy', 'Privacy'], ['terms', 'Terms'], ['refund-policy', 'Refunds'], ['delete-account', 'Delete account']],
    siteNav: 'Site',
    footerNav: 'Notices',
    otherLanguage: 'हिन्दी',
    otherLanguageTitle: 'इस पन्ने को हिन्दी में पढ़ें',
    theme: 'Theme',
    themeTitle: 'Switch between light, dark and the system setting',
    notEndorsed: 'Pri Learning is not endorsed by, affiliated with or approved by NCERT, CBSE, the NTA or any examination authority.',
    canBeWrong: 'Marking is automatic and can be wrong.',
    comingSoon: 'The app is coming soon. It is not on sale yet.',
    copyright: '© 2026 Pri Learning',
    hindiNotices: 'Notices in Hindi',
    generatedFrom: (file) => `This page is generated from <code>${file}</code> in the Pri Learning repository, so it cannot differ from the notice the app shows.`,
    onThisPage: 'On this page',
    backHome: 'Pri Learning home'
  },
  hi: {
    skip: 'सीधे सामग्री पर जाएँ',
    nav: [['support', 'सहायता'], ['privacy', 'गोपनीयता'], ['terms', 'शर्तें'], ['refund-policy', 'रिफ़ंड'], ['delete-account', 'खाता मिटाएँ']],
    siteNav: 'साइट',
    footerNav: 'सूचनाएँ',
    otherLanguage: 'English',
    otherLanguageTitle: 'Read this page in English',
    theme: 'थीम',
    themeTitle: 'हल्की, गहरी या सिस्टम सेटिंग के बीच बदलें',
    notEndorsed: 'Pri Learning को NCERT, CBSE, NTA या किसी भी परीक्षा-प्राधिकरण का समर्थन, अनुमोदन या संबद्धता प्राप्त नहीं है।',
    canBeWrong: 'जाँच स्वचालित है और गलत हो सकती है।',
    comingSoon: 'ऐप जल्द आ रहा है। यह अभी बिक्री पर नहीं है।',
    copyright: '© 2026 Pri Learning',
    hindiNotices: 'हिन्दी में सूचनाएँ',
    generatedFrom: (file) => `यह पन्ना Pri Learning रिपॉज़िटरी की फ़ाइल <code>${file}</code> से बनाया गया है, इसलिए यह ऐप में दिखने वाली सूचना से भिन्न नहीं हो सकता।`,
    onThisPage: 'इस पन्ने पर',
    backHome: 'Pri Learning मुखपृष्ठ'
  }
};

export const t = (lang) => STRINGS[lang];

/**
 * Wrap a page body in the shell.
 *   lang        'en' | 'hi'
 *   path        the page's own route, e.g. '/privacy'
 *   title       <title> without the site name
 *   description meta description
 *   alternate   the same page in the other language, or null
 *   body        main content HTML
 *   headings    [{ text, id }] for the "on this page" rail (optional)
 *   wide        true for the home page (no reading column)
 */
export function page({ lang, path, title, description, alternate, body, headings = [], wide = false, bodyClass = '', noindex = false }) {
  const s = t(lang);
  const routes = ROUTES[lang];
  const nav = s.nav.map(([key, label]) => {
    const href = routes[key].replace(/#.*$/, '');
    const current = href === path ? ' aria-current="page"' : '';
    const compact = key === 'refund-policy' || key === 'delete-account' ? ' data-secondary' : '';
    return `<a href="${href}"${current}${compact}>${label}</a>`;
  }).join('');
  const alternateLink = alternate
    ? `<a class="lang" href="${alternate}" lang="${lang === 'en' ? 'hi' : 'en'}" hreflang="${lang === 'en' ? 'hi' : 'en'}" title="${escapeHtml(s.otherLanguageTitle)}">${s.otherLanguage}</a>`
    : '';
  const rail = headings.length
    ? `<nav class="rail" aria-label="${escapeHtml(s.onThisPage)}"><p class="rail-title">${s.onThisPage}</p><ol>${headings.map(h => `<li><a href="#${escapeHtml(h.id)}">${escapeHtml(h.text)}</a></li>`).join('')}</ol></nav>`
    : '';
  const fullTitle = path === '/' ? title : `${title} · Pri Learning`;
  const hreflang = alternate
    ? `\n  <link rel="alternate" hreflang="${lang}" href="${SITE_ORIGIN}${path}">\n  <link rel="alternate" hreflang="${lang === 'en' ? 'hi' : 'en'}" href="${SITE_ORIGIN}${alternate}">`
    : '';
  return `<!doctype html>
<html lang="${lang}" dir="ltr">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>${escapeHtml(fullTitle)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <meta name="color-scheme" content="light dark">
  <meta name="theme-color" media="(prefers-color-scheme: light)" content="#f6f5f1">
  <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#0e0f14">
  <meta name="referrer" content="no-referrer">
  <meta property="og:title" content="${escapeHtml(fullTitle)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:type" content="website">
${noindex ? '  <meta name="robots" content="noindex">' : `  <meta property="og:url" content="${SITE_ORIGIN}${path}">
  <link rel="canonical" href="${SITE_ORIGIN}${path}">${hreflang}`}
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="stylesheet" href="/styles.css">
  <script src="/theme.js"></script>
</head>
<body class="${escapeHtml(bodyClass)}">
<a class="skip" href="#main">${s.skip}</a>
<header class="site-header">
  <div class="shell">
    <a class="brand" href="${routes.home === '/hi' ? '/' : routes.home}" aria-label="${escapeHtml(s.backHome)}">${MARK_SVG}<span>Pri Learning</span></a>
    <nav class="site-nav" aria-label="${escapeHtml(s.siteNav)}">${nav}</nav>
    <div class="tools">
      ${alternateLink}
      <button type="button" class="theme" data-theme-toggle title="${escapeHtml(s.themeTitle)}" aria-label="${escapeHtml(s.theme)}"><i aria-hidden="true"></i><span>${lang === 'hi' ? 'सिस्टम' : 'System'}</span></button>
    </div>
  </div>
</header>
<main id="main" class="${wide ? 'wide' : 'reading'}">
${wide ? body : `<div class="shell columns${headings.length ? '' : ' no-rail'}">${rail}<div class="column">${body}</div></div>`}
</main>
<footer class="site-footer">
  <div class="shell">
    <nav aria-label="${escapeHtml(s.footerNav)}" class="footer-nav">${nav}${lang === 'en' ? `<a href="/hi" lang="hi" hreflang="hi">${s.hindiNotices}</a>` : `<a href="/" lang="en" hreflang="en">English</a>`}</nav>
    <p class="fine">${s.comingSoon} ${s.canBeWrong}</p>
    <p class="fine">${s.notEndorsed}</p>
    <p class="fine">${s.copyright}</p>
  </div>
</footer>
</body>
</html>
`;
}
