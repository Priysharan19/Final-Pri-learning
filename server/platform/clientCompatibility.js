// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · client compatibility floor (CP-11)
//
// Native shells cannot be updated by a deploy, so the server keeps working with
// every shell back to a configured minimum and tells anything older to update,
// with a structured answer instead of failing in odd ways:
//   426 { error: { code: 'CLIENT_UPGRADE_REQUIRED', platform, minBuild, build } }
// The shells send their build number (X-Pri-Shell-Build: CFBundleVersion on
// Apple, versionCode on Android) next to their client id. The floor is
// deployment configuration (PRI_MIN_IOS_BUILD, PRI_MIN_ANDROID_BUILD); unset
// means no floor. The web app is always current and has none.
//
// Always allowed, whatever the build: health, and the routes a student needs to
// leave or take their data — logout, account export and account deletion.
// ─────────────────────────────────────────────────────────────────────────────

const FLOOR = Object.freeze({ 'ios-native-v1': ['ios', 'PRI_MIN_IOS_BUILD'], 'android-native-v1': ['android', 'PRI_MIN_ANDROID_BUILD'] });
const EXEMPT = [
  ['GET', /^\/health$/],
  ['POST', /^\/account\/logout$/],
  ['GET', /^\/account\/export$/],
  ['DELETE', /^\/account\/?$/],
];

function positiveInt(raw) {
  const text = String(raw ?? '').trim();
  if (!/^\d{1,9}$/.test(text)) return null;
  const n = Number(text);
  return n > 0 ? n : null;
}

/** Configuration mistakes production must not boot with (config.js). */
export function compatibilityConfigProblems(env = process.env) {
  const problems = [];
  for (const [, name] of Object.values(FLOOR)) {
    const raw = String(env[name] ?? '').trim();
    if (raw && positiveInt(raw) === null) problems.push(`${name} (a positive integer build number)`);
  }
  return problems;
}

export function clientCompatibility(env = process.env) {
  return (req, res, next) => {
    const client = req.get('x-pri-client');
    const floor = FLOOR[client];
    if (!floor) return next();
    const [platform, name] = floor;
    const minBuild = positiveInt(env[name]);
    if (!minBuild) return next();
    if (EXEMPT.some(([method, path]) => req.method === method && path.test(req.path))) return next();
    const build = positiveInt(req.get('x-pri-shell-build'));
    if (build !== null && build >= minBuild) return next();
    res.set('Cache-Control', 'no-store');
    return res.status(426).json({
      error: {
        code: 'CLIENT_UPGRADE_REQUIRED',
        message: 'This version of Pri Learning is too old to use the cloud. Update the app from the store; everything on this device keeps working offline.',
        platform,
        minBuild,
        build
      }
    });
  };
}
