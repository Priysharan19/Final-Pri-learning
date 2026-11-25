// Pri Learning · the addresses of the Prithagoras web app, for the server's status code
//
// The server answers every address with the app shell, and the app draws "Page not found" for an address that is no
// route. A shell with status 200 is a soft 404: a crawler or a link checker cannot tell. In the Prithagoras edition the
// server now answers an address that is no route with the same shell and status 404. The list is the one App.jsx keeps
// (APP_PATHS); client/test/not-found-routes-check.mjs holds the two equal. Priyabhata is unchanged: it answers 200.

export const AU_APP_PATHS = Object.freeze([
  '/', '/practice', '/practise-photo', '/progress', '/plan', '/today', '/error-log', '/premium', '/insights',
  '/parent-report', '/placement', '/map', '/signin', '/stats', '/badges', '/tasks', '/teach', '/exams', '/paper-generator',
  '/exams/:id', '/papers/sit/:attemptId', '/notes', '/notes/:chapterId', '/library', '/library/:id', '/desk/import',
  '/desk/:attemptId', '/rush', '/match', '/review', '/history', '/favorites', '/mistakes', '/classes', '/privacy', '/terms',
  '/refund-policy', '/third-party-notices', '/welcome', '/welcome/marking', '/welcome/syllabus', '/welcome/teachers',
  '/contact', '/grievance', '/refunds', '/settings', '/account-action', '/guardian/consent', '/account/delete-request',
  '/parent/report-email', '/index.html'
]);

const matches = (pattern, pathname) => {
  const a = pattern.split('/').filter(Boolean), b = pathname.split('/').filter(Boolean);
  return a.length === b.length && a.every((seg, i) => seg.startsWith(':') ? b[i] !== '' : seg.toLowerCase() === b[i].toLowerCase());
};

/** Whether a URL path is an address of the app (the same matching App.jsx uses). */
export function isAppPath(pathname) {
  return AU_APP_PATHS.some(pattern => matches(pattern, String(pathname || '/')));
}
