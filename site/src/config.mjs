// Pri Learning public site · the few facts the generator needs that are not in
// docs/legal. Everything here is a V1 default recorded in
// ~/Developer/pri-finish/V1_DECISIONS_2026-11-01.md (D5, D19, D24) or in the
// store listing drafts under docs/release/store; change it there first.

export const SITE_ORIGIN = 'https://prilearning.com';

// D5: the app lives on its own host. The site never embeds or proxies it.
export const APP_ORIGIN = 'https://app.prilearning.com';

// The app's public account-deletion page (client/src/pages/AccountDeleteRequest.jsx).
export const APP_DELETE_PATH = '/account/delete-request';

// D19 — the only two prices that may appear anywhere on the site, and only as
// store prices once the app is on sale. tools/site-check.mjs refuses any other ₹ amount.
export const PRICES = Object.freeze({ monthly: '₹199', annual: '₹1,499' });

// D19 — free plan as the server enforces it (20 questions a day, one timed paper in 30 days).
export const FREE_PLAN = Object.freeze({ questionsPerDay: 20, paperEveryDays: 30 });

// Where each notice is published, per language. The notices link to each other
// with the app's routes (/refund-policy, /grievance, /account/delete-request);
// the generator maps those onto these.
export const ROUTES = Object.freeze({
  en: Object.freeze({
    home: '/',
    support: '/support',
    privacy: '/privacy',
    terms: '/terms',
    'refund-policy': '/refunds',
    grievance: '/support#grievance',
    'delete-account': '/delete-account'
  }),
  hi: Object.freeze({
    home: '/hi',
    support: '/hi/support',
    privacy: '/hi/privacy',
    terms: '/hi/terms',
    'refund-policy': '/hi/refunds',
    grievance: '/hi/support#grievance',
    'delete-account': '/hi/delete-account'
  })
});

/** Rewrites a link inside a notice onto the site's routes for that language. */
export function mapNoticeLink(lang, href) {
  const routes = ROUTES[lang];
  if (href === '/refund-policy') return routes['refund-policy'];
  if (href === '/grievance') return routes.grievance;
  if (href === '/account/delete-request') return routes['delete-account'];
  if (href === '/privacy') return routes.privacy;
  if (href === '/terms') return routes.terms;
  if (/^(https?:|mailto:|#)/.test(href)) return href;
  throw new Error(`A notice links to ${href}, which the site does not publish. Add it to site/src/config.mjs.`);
}
