// What each browser says when import() cannot fetch a module (Chromium, Safari,
// Firefox) and the bundler's own CSS-preload failure. Plain JS so a suite can
// load it without a JSX transform.
const CHUNK_FAILURE = /dynamically imported module|importing a module script failed|failed to fetch dynamically|loading chunk|unable to preload css|^load failed$/i;

export function isChunkLoadFailure(error) {
  return !!error && CHUNK_FAILURE.test(String(error.message || error));
}
