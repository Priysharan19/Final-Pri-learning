// Response hardening headers for every response the Pri Learning server sends:
// the built client, the /v1 control plane and error pages alike.
//
// The Content-Security-Policy is enforced (not report-only). It is the policy
// the built client actually satisfies: scripts are only the hashed Vite module
// chunks served from this origin; the one deliberate relaxation is
// style-src 'unsafe-inline', which React style attributes, KaTeX inline layout
// and the ink interaction guard's injected <style> element all require. The
// browser half of server/test/security-headers-check.mjs loads the real build
// under this header and fails on any violation.

const ORIGIN = /^https:\/\/[a-z0-9.-]+(?::\d{1,5})?$/i;

function extraConnectSources() {
  return String(process.env.PRI_CSP_CONNECT_SRC || '')
    .split(/[\s,]+/)
    .map(value => value.trim())
    .filter(value => ORIGIN.test(value));
}

export function contentSecurityPolicy({ connectSources = extraConnectSources() } = {}) {
  const connect = ["'self'", ...connectSources].join(' ');
  return [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    `connect-src ${connect}`,
    "worker-src 'self'",
    "manifest-src 'self'",
    "media-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'"
  ].join('; ');
}

// The app itself may open the camera for photo capture of a printed question
// (QuestionCard's <input type="file" capture>), so camera stays available to the
// document and is denied only to embedded frames; nothing else is ever used.
export const PERMISSIONS_POLICY = 'camera=(self), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()';
export const HSTS = 'max-age=31536000; includeSubDomains';

export function securityHeaderValues({ production = process.env.NODE_ENV === 'production', csp = contentSecurityPolicy() } = {}) {
  const headers = {
    'Content-Security-Policy': csp,
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Referrer-Policy': 'no-referrer',
    'Permissions-Policy': PERMISSIONS_POLICY,
    // allow-popups rather than same-origin: a future Google/Apple web sign-in
    // popup must keep its opener to hand the identity token back.
    'Cross-Origin-Opener-Policy': 'same-origin-allow-popups'
  };
  if (production) headers['Strict-Transport-Security'] = HSTS;
  return headers;
}

export function securityHeaders(options = {}) {
  const values = securityHeaderValues(options);
  return (req, res, next) => {
    for (const [name, value] of Object.entries(values)) res.set(name, value);
    next();
  };
}
