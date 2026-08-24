// Pri Ink Structural V4 LAN development bridge (client side).
//
// `npm run serve:lan:v4` exposes /__pri/ink/v4 from the developer Mac and
// keeps the research PyTorch model loaded there. This is for physical iPad
// evaluation only; it is not an offline/production runtime. The README's
// "no network call of any kind" claim is about the app, so this module
// contains no network code at all: serve-lan.mjs in --v4-dev mode injects
// /__pri/lan-bridge.js into the pages it serves, and that injected script —
// which exists only on the LAN dev origin, never in the built bundle — owns
// the fetch and installs the window.__PRI_INK_V4_LAN__ hook consumed below.
// Everywhere else the hook is absent and every call settles to null after
// one cheap check.

let capability = 'unknown'; // unknown | available | unavailable

export const structuralDevAvailable = () => capability === 'available';

export async function recognizeWithStructuralDev(strokes) {
  if (typeof window === 'undefined' || window.__PRI_NATIVE_INK__) return null;
  if (window.__PRI_LAN_DEV__ !== true) return null;
  if (capability === 'unavailable') return null;
  if (!Array.isArray(strokes) || !strokes.length) return null;

  const bridge = window.__PRI_INK_V4_LAN__;
  if (typeof bridge !== 'function') {
    capability = 'unavailable';
    return null;
  }
  try {
    const result = await bridge(strokes);
    if (result && result.gone === true) {
      capability = 'unavailable';
      return null;
    }
    if (!result || result.available === false || result.engine !== 'pri-structural-v4-dev-lan') return null;
    capability = 'available';
    return result;
  } catch {
    return null;
  }
}
