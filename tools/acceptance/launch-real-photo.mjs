// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · real-photo acceptance — launcher
//
//   cd ~/Developer/Final-Pri-learning
//   railway run --service pri-learning-staging --environment staging -- \
//     node <this checkout>/tools/acceptance/launch-real-photo.mjs
//
// The same launcher as launch.mjs (clean child environments, only the
// PRI_HANDWRITING_* variables reach the local servers, local SQLite, every
// byte of output scrubbed, never a mock) running real-photo.mjs instead.
// ─────────────────────────────────────────────────────────────────────────────
globalThis.__PRI_ACCEPT_RUNNER__ = {
  script: 'real-photo.mjs',
  title: 'real-photo acceptance',
  // A file path, a read count and a stage name: nothing secret.
  passEnv: ['PRI_ACCEPT_PHOTO', 'PRI_ACCEPT_READS', 'PRI_ACCEPT_STAGE']
};
await import('./launch.mjs');
