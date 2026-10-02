// Paints the stored theme before first paint. Why and how: src/lib/theme.js.
(function () {
  var pref = 'light';
  try {
    var stored = window.localStorage.getItem('pri.theme');
    if (stored === 'light' || stored === 'dark' || stored === 'system') pref = stored;
  } catch (e) {}
  var dark = pref === 'dark'
    || (pref === 'system' && typeof window.matchMedia === 'function'
      && window.matchMedia('(prefers-color-scheme: dark)').matches);
  var root = document.documentElement;
  root.setAttribute('data-theme', dark ? 'dark' : 'light');
  root.setAttribute('data-theme-pref', pref);
  root.style.colorScheme = dark ? 'dark' : 'light';
  var meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', dark ? '#121210' : '#f2f0ea');
})();
