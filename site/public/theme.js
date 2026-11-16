// Pri Learning public site · light and dark, both first-class.
//
// Loaded synchronously in <head> so a remembered choice applies before the
// first paint. The only thing stored is that choice, in this browser; nothing
// is sent anywhere. Without JavaScript the page follows the system setting
// through prefers-color-scheme and the button simply does nothing.
(function () {
  var KEY = 'pri-site-theme';
  var root = document.documentElement;

  function read() {
    try { var v = localStorage.getItem(KEY); return v === 'light' || v === 'dark' ? v : 'system'; }
    catch (e) { return 'system'; }
  }
  function write(v) {
    try { if (v === 'system') localStorage.removeItem(KEY); else localStorage.setItem(KEY, v); }
    catch (e) { /* private window, blocked storage: the page still works */ }
  }
  function apply(v) {
    if (v === 'light' || v === 'dark') root.setAttribute('data-theme', v);
    else root.removeAttribute('data-theme');
  }

  apply(read());

  function label(v, lang) {
    if (lang === 'hi') return v === 'light' ? 'हल्का' : v === 'dark' ? 'गहरा' : 'सिस्टम';
    return v === 'light' ? 'Light' : v === 'dark' ? 'Dark' : 'System';
  }

  document.addEventListener('DOMContentLoaded', function () {
    var button = document.querySelector('[data-theme-toggle]');
    if (!button) return;
    var lang = root.getAttribute('lang') || 'en';
    var state = read();
    var render = function () {
      button.querySelector('span').textContent = label(state, lang);
      button.setAttribute('data-state', state);
    };
    render();
    button.addEventListener('click', function () {
      state = state === 'system' ? 'dark' : state === 'dark' ? 'light' : 'system';
      write(state);
      apply(state);
      render();
    });
  });
})();
