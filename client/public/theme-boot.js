// Pri Learning · paint the right paper before anything else loads.
// Runs synchronously from <head>, ahead of the stylesheet and the app bundle,
// so a night-mode student never sees a white flash on a cold start. It reads
// only the display preference src/lib/theme.js keeps on this device; the
// profile remains the authority and re-applies it once the app is up.
// Kept as a separate file (not inline) so a strict script policy still allows it.
(function () {
  var pref = 'light';
  try {
    var stored = window.localStorage.getItem('pri.theme');
    if (stored === 'light' || stored === 'dark' || stored === 'system') pref = stored;
  } catch (e) { /* storage blocked: paper */ }
  var dark = pref === 'dark'
    || (pref === 'system' && typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-color-scheme: dark)').matches);
  var root = document.documentElement;
  root.setAttribute('data-theme', dark ? 'dark' : 'light');
  root.setAttribute('data-theme-pref', pref);
  var meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', dark ? '#121210' : '#f2f0ea');
})();
