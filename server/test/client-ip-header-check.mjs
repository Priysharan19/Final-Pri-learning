// Pri Learning · the anonymous rate-limit identity behind Railway's edge (#653).
// On Railway staging req.ip resolved to the edge node (one bucket per node for
// every anonymous user). Railway's public edge overwrites X-Real-IP with the
// caller's address, so PRI_CLIENT_IP_HEADER=x-real-ip makes the limiters count
// the client. This proves the opt-in, its allowlist, and that a missing or
// malformed header never becomes an identity, and that the limiter uses it.
import './support/hermetic.mjs';
import assert from 'node:assert/strict';
import { clientIpHeader } from '../platform/config.js';
import { clientIdentity } from '../platform/security.js';

let n = 0;
const ok = (v, m) => { assert.ok(v, m); n++; };
const req = (headers, ip = '100.64.0.7') => ({ ip, headers, get: h => headers[h.toLowerCase()] });

ok(clientIpHeader({}) === null, 'unset: no client-address header, req.ip as before');
ok(clientIpHeader({ PRI_CLIENT_IP_HEADER: ' X-Real-IP ' }) === 'x-real-ip', 'x-real-ip is accepted (case and space insensitive)');
assert.throws(() => clientIpHeader({ PRI_CLIENT_IP_HEADER: 'x-forwarded-for' }), e => e.code === 'CLIENT_IP_HEADER_INVALID'); n++;
assert.throws(() => clientIpHeader({ PRI_CLIENT_IP_HEADER: 'x-anything' }), e => e.code === 'CLIENT_IP_HEADER_INVALID'); n++;
const on = { PRI_CLIENT_IP_HEADER: 'x-real-ip' };
ok(clientIdentity(req({ 'x-real-ip': '49.36.10.20' }), on) === '49.36.10.20', 'with the opt-in, the edge-set client address is the identity');
ok(clientIdentity(req({ 'x-real-ip': '2401:4900::1' }), on) === '2401:4900::1', 'IPv6 too');
ok(clientIdentity(req({ 'x-real-ip': '49.36.10.20' }), {}) === '100.64.0.7', 'without the opt-in the header is ignored (req.ip)');
ok(clientIdentity(req({}), on) === '100.64.0.7', 'a missing header falls back to req.ip, never "unknown" shared');
for (const bad of ['1.2.3.4, 5.6.7.8', 'not-an-ip', '999.1.1.1', '']) ok(clientIdentity(req({ 'x-real-ip': bad }), on) === '100.64.0.7', `a malformed header (${JSON.stringify(bad)}) is never an identity`);

console.log(`CLIENT IP HEADER: PASS — ${n}/${n} checks — behind a trusted edge the limiters count the client, never a forged or malformed header.`);
