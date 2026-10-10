// The catalogue entries whose words public/boot-guard.js carries a copy of.
//
// That file draws the "could not load / did not start / still loading" notice
// before the bundle — and so the catalogue — exists on the page, which is the
// whole reason it exists; it cannot look a key up. The words are still owned
// by the catalogue (src/i18n/strings.en.js, strings.hi.js) like every other
// sentence a student reads, and this table says which entry each copy is.
// client/test/boot-resilience-check.mjs reads it and fails when a copy drifts.
export const BOOT_NOTICE_KEYS = Object.freeze({
  load: Object.freeze(['boot.loadFailedTitle', 'boot.loadFailedBody']),
  start: Object.freeze(['boot.notStartedTitle', 'boot.notStartedBody']),
  slow: Object.freeze(['boot.slowTitle', 'boot.slowBody']),
  reload: 'errorScreen.reload'
});
