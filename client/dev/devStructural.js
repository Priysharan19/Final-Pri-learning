// Pri Ink Structural V4 LAN development bridge.
//
// `npm run serve:lan:v4` exposes /__pri/ink/v4 from the developer Mac and
// keeps the research PyTorch model loaded there. This is for physical iPad
// evaluation only; it is not an offline/production runtime, which is why it
// lives under client/dev rather than client/src: the README's "no network
// call of any kind" claim is about the app, and CI greps client/src to hold
// it. The probe below only ever fires on the dedicated LAN dev origin —
// main.jsx sets __PRI_LAN_DEV__ for port 4196 or an explicit ?priLanDev=1 —
// so an ordinary offline build never opens a connection at all.

let capability = 'unknown'; // unknown | available | unavailable

export const structuralDevAvailable = () => capability === 'available';

export async function recognizeWithStructuralDev(strokes) {
  if (typeof window === 'undefined' || window.__PRI_NATIVE_INK__) return null;
  if (window.__PRI_LAN_DEV__ !== true) return null;
  if (capability === 'unavailable') return null;
  if (!Array.isArray(strokes) || !strokes.length) return null;

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeout = setTimeout(() => controller?.abort(), 14500);
  try {
    const response = await fetch('/__pri/ink/v4', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ strokes }),
      cache: 'no-store',
      signal: controller?.signal
    });
    if (response.status === 404 || response.status === 405) {
      capability = 'unavailable';
      return null;
    }
    if (!response.ok) return null;
    const result = await response.json();
    if (!result || result.available === false || result.engine !== 'pri-structural-v4-dev-lan') return null;
    capability = 'available';
    return result;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}
