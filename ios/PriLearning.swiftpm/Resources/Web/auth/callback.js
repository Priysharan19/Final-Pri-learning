// Pri Learning · Google/Apple sign-in callback.
//
// Google returns to /auth/callback.html with the identity token in the URL
// fragment, which never reaches a server. Apple form-posts to
// /v1/account/identity/apple/callback, whose page carries the same fields in a
// meta tag and loads this script too. They are read once, the fragment is
// removed from the address bar and history, and they are handed to the window that started
// the sign-in over a BroadcastChannel, which only same-origin pages can join.
// The app accepts it only for the random state it is waiting on, and the
// server accepts it only with the single-use nonce it issued.
(function () {
  var relayed = document.querySelector('meta[name="pri-oidc-callback"]');
  var params = new URLSearchParams(relayed ? String(relayed.getAttribute('content') || '') : String(location.hash || '').replace(/^#/, ''));
  try { history.replaceState(null, '', location.pathname); } catch (e) { /* best effort */ }
  var idToken = params.get('id_token') || '';
  var message = {
    type: 'pri-oidc-callback',
    provider: params.get('provider') || 'google',
    state: params.get('state') || '',
    idToken: idToken,
    error: params.get('error') || (idToken ? '' : 'invalid_response')
  };
  try {
    var channel = new BroadcastChannel('pri-oidc-callback');
    channel.postMessage(message);
    channel.close();
  } catch (e) { /* the app window times out and says so */ }
  setTimeout(function () { window.close(); }, 100);
})();
