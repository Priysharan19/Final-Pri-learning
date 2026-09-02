import assert from 'node:assert/strict';

process.env.NODE_ENV = 'production';
process.env.PRI_PUBLIC_ORIGIN = 'https://app.prilearning.example';
process.env.PRI_CSRF_SECRET = 'native-origin-contract-secret';

const {
  CSRF_COOKIE, SESSION_COOKIE, csrfForSession, csrfGuard, originGuard
} = await import('../platform/security.js');

function request({ method = 'POST', headers = {}, cookies = {} } = {}) {
  const normalized = Object.fromEntries(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]));
  return {
    method,
    cookies,
    get(name) { return normalized[String(name).toLowerCase()] ?? undefined; }
  };
}

function response() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; }
  };
}

function runGuard(guard, req) {
  const res = response();
  let next = 0;
  guard(req, res, () => { next++; });
  return { res, next };
}

{
  const result = runGuard(originGuard, request({ headers: { 'x-pri-client': 'ios-native-v1' } }));
  assert.equal(result.next, 1, 'URLSession-style native mutation should bypass browser Origin validation');
}

for (const headers of [
  { 'x-pri-client': 'ios-native-v1', origin: 'https://evil.example' },
  { 'x-pri-client': 'ios-native-v1', 'sec-fetch-site': 'cross-site' },
  { 'x-pri-client': 'ios-native-v1', 'sec-fetch-mode': 'cors' },
  { 'x-pri-client': 'web-v1' },
  {}
]) {
  const result = runGuard(originGuard, request({ headers }));
  assert.equal(result.next, 0, `browser-like request must not use the native exception: ${JSON.stringify(headers)}`);
  assert.equal(result.res.statusCode, 403);
  assert.equal(result.res.body?.error?.code, 'ORIGIN_REJECTED');
}

{
  const result = runGuard(originGuard, request({ headers: { origin: 'https://app.prilearning.example', 'x-pri-client': 'web-v1' } }));
  assert.equal(result.next, 1, 'configured web origin must continue to work');
}

{
  const result = runGuard(originGuard, request({ method: 'GET', headers: { origin: 'https://evil.example' } }));
  assert.equal(result.next, 1, 'safe methods do not need Origin validation');
}

const session = 'native-session-secret';
const csrf = csrfForSession(session);

{
  const result = runGuard(csrfGuard, request({
    headers: { 'x-pri-client': 'ios-native-v1' },
    cookies: { [SESSION_COOKIE]: session, [CSRF_COOKIE]: csrf }
  }));
  assert.equal(result.next, 0, 'native origin exception must not disable CSRF validation');
  assert.equal(result.res.statusCode, 403);
  assert.equal(result.res.body?.error?.code, 'CSRF_REJECTED');
}

{
  const result = runGuard(csrfGuard, request({
    headers: { 'x-pri-client': 'ios-native-v1', 'x-pri-csrf': csrf },
    cookies: { [SESSION_COOKIE]: session, [CSRF_COOKIE]: csrf }
  }));
  assert.equal(result.next, 1, 'native mutation with the server-issued CSRF cookie/header pair should pass');
}

console.log('PASS — native URLSession requests bypass only browser Origin checks; browser contexts remain blocked and authenticated mutations still require CSRF.');
