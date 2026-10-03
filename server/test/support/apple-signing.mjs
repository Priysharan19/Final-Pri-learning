// Test-only Apple signing fixtures.
//
// Generates a throwaway root → intermediate → leaf chain with the two Apple
// certificate-purpose OIDs the server enforces, and signs StoreKit/App Store
// Server Notification v2 shaped payloads with it (ES256, x5c). The production
// trust roots are untouched: a suite trusts this root only by putting it in
// PRI_APPLE_ROOT_CA_PEM for its own process. A second, never-trusted chain
// with the same shape stands in for an attacker's forgery.
import { execFileSync } from 'node:child_process';
import { X509Certificate, createPrivateKey, sign } from 'node:crypto';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

function openssl(...args) {
  execFileSync('openssl', args, { stdio: ['ignore', 'pipe', 'pipe'] });
}

function makeChain(dir, label, days) {
  const file = name => join(dir, `${label}-${name}`);
  openssl('ecparam', '-name', 'prime256v1', '-genkey', '-noout', '-out', file('root.key'));
  openssl('req', '-x509', '-new', '-key', file('root.key'), '-sha256', '-days', String(days),
    '-subj', `/CN=Pri Test ${label} Root`,
    '-addext', 'basicConstraints=critical,CA:TRUE',
    '-addext', 'keyUsage=critical,keyCertSign,cRLSign',
    '-out', file('root.pem'));
  openssl('ecparam', '-name', 'prime256v1', '-genkey', '-noout', '-out', file('intermediate.key'));
  openssl('req', '-new', '-key', file('intermediate.key'), '-subj', `/CN=Pri Test ${label} Intermediate`, '-out', file('intermediate.csr'));
  writeFileSync(file('intermediate.ext'), [
    'basicConstraints=critical,CA:TRUE,pathlen:0', 'keyUsage=critical,keyCertSign,cRLSign',
    'subjectKeyIdentifier=hash', 'authorityKeyIdentifier=keyid,issuer', '1.2.840.113635.100.6.2.1=ASN1:NULL', ''
  ].join('\n'));
  openssl('x509', '-req', '-in', file('intermediate.csr'), '-CA', file('root.pem'), '-CAkey', file('root.key'),
    '-CAcreateserial', '-days', String(days), '-sha256', '-extfile', file('intermediate.ext'), '-out', file('intermediate.pem'));
  openssl('ecparam', '-name', 'prime256v1', '-genkey', '-noout', '-out', file('leaf.key'));
  openssl('req', '-new', '-key', file('leaf.key'), '-subj', `/CN=Pri Test ${label} App Store Signing`, '-out', file('leaf.csr'));
  writeFileSync(file('leaf.ext'), [
    'basicConstraints=critical,CA:FALSE', 'keyUsage=critical,digitalSignature',
    'subjectKeyIdentifier=hash', 'authorityKeyIdentifier=keyid,issuer', '1.2.840.113635.100.6.11.1=ASN1:NULL', ''
  ].join('\n'));
  openssl('x509', '-req', '-in', file('leaf.csr'), '-CA', file('intermediate.pem'), '-CAkey', file('intermediate.key'),
    '-CAcreateserial', '-days', String(days), '-sha256', '-extfile', file('leaf.ext'), '-out', file('leaf.pem'));
  const rootPem = readFileSync(file('root.pem'), 'utf8');
  const chain = ['leaf.pem', 'intermediate.pem', 'root.pem'].map(name => new X509Certificate(readFileSync(file(name))).raw.toString('base64'));
  return { rootPem, chain, key: createPrivateKey(readFileSync(file('leaf.key'))) };
}

const b64url = value => Buffer.from(JSON.stringify(value)).toString('base64url');

export function createAppleSigner({ days = 400 } = {}) {
  const dir = mkdtempSync(join(tmpdir(), 'pri-apple-signing-'));
  try {
    const trusted = makeChain(dir, 'Trusted', days);
    const rogue = makeChain(dir, 'Rogue', days);
    function jws(payload, { chain = trusted } = {}) {
      const head = b64url({ alg: 'ES256', x5c: chain.chain });
      const body = b64url(payload);
      const signature = sign('sha256', Buffer.from(`${head}.${body}`), { key: chain.key, dsaEncoding: 'ieee-p1363' });
      return `${head}.${body}.${signature.toString('base64url')}`;
    }
    return { rootPem: trusted.rootPem, trusted, rogue, jws };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
