// Pri Learning · the anonymous rate-limit identity behind Railway's edge (#653).
// On Railway staging req.ip resolved to the edge node (one bucket per node for
// every anonymous user). Railway's public edge overwrites X-Real-IP with the
// caller's address, so PRI_CLIENT_IP_HEADER=x-real-ip makes the limiters count
// the client. This proves the opt-in, its allowlist, and that a missing or
// malformed header never becomes an identity, and that the limiter uses it.
import './support/hermetic.mjs';
import assert from 'node:assert/strict';
import { clientIpHeader, clientIpProbeEnabled } from '../platform/config.js';
import { classifyRealIp } from '../../tools/verify-deployment-proxy.mjs';
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

// The staging-only probe that MEASURES whether X-Real-IP can be forged (#779 review).
ok(!clientIpProbeEnabled({}) && !clientIpProbeEnabled({ PRI_CLIENT_IP_HEADER_PROBE: '1' }), 'the probe is off unless asked for, and asking is not enough');
ok(!clientIpProbeEnabled({ PRI_CLIENT_IP_HEADER_PROBE: '1', RAILWAY_ENVIRONMENT_NAME: 'production' }), 'never in a production Railway environment');
ok(!clientIpProbeEnabled({ PRI_CLIENT_IP_HEADER_PROBE: 'true', RAILWAY_ENVIRONMENT_NAME: 'staging' }), 'only the exact value 1 turns it on');
ok(clientIpProbeEnabled({ PRI_CLIENT_IP_HEADER_PROBE: '1', RAILWAY_ENVIRONMENT_NAME: 'staging' }), 'on for staging with the flag');
{
  const { startApp } = await import('./support/app-harness.mjs');
  const { createPlatformDb } = await import('../platform/db.js');
  const saved = { p: process.env.PRI_CLIENT_IP_HEADER_PROBE, r: process.env.RAILWAY_ENVIRONMENT_NAME };
  const status = async (env) => {
    for (const [k, v] of Object.entries(env)) if (v === undefined) delete process.env[k]; else process.env[k] = v;
    const app = await startApp({ db: createPlatformDb(':memory:') });
    try { const r = await app.request('/v1/diag/client-ip', { headers: { 'X-Real-IP': '198.18.0.9', 'X-Forwarded-For': '198.18.0.9' } }); return { status: r.status, body: r.data }; }
    finally { await app.close(); }
  };
  const off = await status({ PRI_CLIENT_IP_HEADER_PROBE: undefined, RAILWAY_ENVIRONMENT_NAME: undefined });
  const prod = await status({ PRI_CLIENT_IP_HEADER_PROBE: '1', RAILWAY_ENVIRONMENT_NAME: 'production' });
  const on = await status({ PRI_CLIENT_IP_HEADER_PROBE: '1', RAILWAY_ENVIRONMENT_NAME: 'staging' });
  for (const [k, v] of [['PRI_CLIENT_IP_HEADER_PROBE', saved.p], ['RAILWAY_ENVIRONMENT_NAME', saved.r]]) if (v === undefined) delete process.env[k]; else process.env[k] = v;
  ok(off.status === 404 && prod.status === 404, `the endpoint does not exist by default or in production (${off.status}, ${prod.status})`);
  ok(on.status === 200 && on.body?.xRealIp === '198.18.0.9' && on.body?.probe === 'client-ip', `on staging it echoes what reached the process (${on.status})`);
}
const spoof = classifyRealIp([{ forged: '198.18.1.2', reply: { probe: 'client-ip', xRealIp: '198.18.1.2', xForwardedFor: '198.18.1.2, 49.36.0.1', reqIp: '100.64.0.2' } }]);
const edge = classifyRealIp([{ forged: '198.18.1.2', reply: { probe: 'client-ip', xRealIp: '49.36.0.1', xForwardedFor: '49.36.0.1', reqIp: '100.64.0.2' } }]);
ok(spoof.verdict === 'X-REAL-IP-SPOOFABLE' && edge.verdict === 'X-REAL-IP-EDGE-SET' && classifyRealIp([{ forged: 'x', reply: null }]).verdict === 'UNAVAILABLE',
  'the proxy probe FAILS when a forged X-Real-IP reaches the app, passes only when the edge replaced it, and is unavailable without the diagnostic');
console.log(`CLIENT IP HEADER: PASS — ${n}/${n} checks — behind a trusted edge the limiters count the client, never a forged or malformed header.`);
