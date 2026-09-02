import { readFileSync } from 'node:fs';
import { X509Certificate, verify as verifySignature } from 'node:crypto';

const MAX_SKEW_MS = 60_000;
const LEAF_OID_DER = Buffer.from('060a2a864886f76364060b01', 'hex'); // 1.2.840.113635.100.6.11.1
const INTERMEDIATE_OID_DER = Buffer.from('060a2a864886f76364060201', 'hex'); // 1.2.840.113635.100.6.2.1

function appleError(code, message, status = 400) {
  return Object.assign(new Error(message), { code, status });
}

function decodePart(value, label) {
  try {
    return JSON.parse(Buffer.from(String(value || ''), 'base64url').toString('utf8'));
  } catch {
    throw appleError('APPLE_JWS_INVALID', `Apple ${label} is not valid JWS JSON.`);
  }
}

function pemBlocks(value) {
  return String(value || '').match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g) || [];
}

export function configuredAppleRoots() {
  const blocks = [];
  blocks.push(...pemBlocks(process.env.PRI_APPLE_ROOT_CA_PEM));
  const file = String(process.env.PRI_APPLE_ROOT_CA_FILE || '').trim();
  if (file) {
    try { blocks.push(...pemBlocks(readFileSync(file, 'utf8'))); }
    catch { throw appleError('APPLE_ROOT_CA_UNAVAILABLE', 'Configured Apple root certificate file could not be read.', 503); }
  }
  const roots = [];
  for (const pem of blocks) {
    try { roots.push(new X509Certificate(pem)); }
    catch { throw appleError('APPLE_ROOT_CA_INVALID', 'Configured Apple root certificate is invalid.', 503); }
  }
  return roots;
}

function containsOid(cert, oidDer) {
  return cert.raw.indexOf(oidDer) !== -1;
}

function checkDate(cert, effectiveAt) {
  const at = Number(effectiveAt);
  const from = new Date(cert.validFrom).getTime();
  const to = new Date(cert.validTo).getTime();
  if (!Number.isFinite(at) || !Number.isFinite(from) || !Number.isFinite(to) || from > at + MAX_SKEW_MS || to < at - MAX_SKEW_MS) {
    throw appleError('APPLE_CERTIFICATE_EXPIRED', 'Apple signing certificate is not valid for the signed date.', 401);
  }
}

function verifyChain(header, payload, roots) {
  const chain = Array.isArray(header?.x5c) ? header.x5c : [];
  if (header?.alg !== 'ES256' || chain.length !== 3) {
    throw appleError('APPLE_CERTIFICATE_CHAIN_INVALID', 'Apple signed data has an invalid certificate chain.', 401);
  }
  if (!roots.length) throw appleError('APPLE_ROOT_CA_NOT_CONFIGURED', 'Apple signed-data verification is not configured on this deployment.', 503);

  let leaf, intermediate, claimedRoot;
  try {
    leaf = new X509Certificate(Buffer.from(chain[0], 'base64'));
    intermediate = new X509Certificate(Buffer.from(chain[1], 'base64'));
    claimedRoot = new X509Certificate(Buffer.from(chain[2], 'base64'));
  } catch {
    throw appleError('APPLE_CERTIFICATE_CHAIN_INVALID', 'Apple signed data contains an unreadable certificate.', 401);
  }

  const trusted = roots.find(root => root.fingerprint256 === claimedRoot.fingerprint256);
  if (!trusted) throw appleError('APPLE_CERTIFICATE_CHAIN_INVALID', 'Apple signed data does not chain to a configured Apple root.', 401);
  if (!intermediate.ca || intermediate.issuer !== trusted.subject || !intermediate.verify(trusted.publicKey)) {
    throw appleError('APPLE_CERTIFICATE_CHAIN_INVALID', 'Apple intermediate certificate is not trusted.', 401);
  }
  if (leaf.issuer !== intermediate.subject || !leaf.verify(intermediate.publicKey)) {
    throw appleError('APPLE_CERTIFICATE_CHAIN_INVALID', 'Apple leaf certificate is not trusted.', 401);
  }
  if (!containsOid(leaf, LEAF_OID_DER) || !containsOid(intermediate, INTERMEDIATE_OID_DER)) {
    throw appleError('APPLE_CERTIFICATE_PURPOSE_INVALID', 'Apple signing certificate has an invalid purpose.', 401);
  }

  const signedAt = Number(payload?.signedDate) || Date.now();
  checkDate(leaf, signedAt);
  checkDate(intermediate, signedAt);
  checkDate(trusted, signedAt);
  return leaf.publicKey;
}

/**
 * Verify a StoreKit/App Store Server JWS without trusting decoded payload data.
 * Apple uses ES256 and an x5c chain rooted in an Apple root CA. The two private
 * Apple certificate-purpose OIDs below are the same ones enforced by Apple's
 * open-source App Store Server Library. The root itself is deployment trust
 * configuration (`PRI_APPLE_ROOT_CA_PEM` or `PRI_APPLE_ROOT_CA_FILE`).
 */
export function verifyAppleJWS(jws, { roots = configuredAppleRoots() } = {}) {
  const compact = String(jws || '');
  if (compact.length < 32 || compact.length > 64 * 1024) throw appleError('APPLE_JWS_INVALID', 'Apple signed data is missing or too large.');
  const parts = compact.split('.');
  if (parts.length !== 3 || parts.some(part => !part)) throw appleError('APPLE_JWS_INVALID', 'Apple signed data is not a compact JWS.');

  const header = decodePart(parts[0], 'JWS header');
  const payload = decodePart(parts[1], 'JWS payload');
  const key = verifyChain(header, payload, roots);
  let signature;
  try { signature = Buffer.from(parts[2], 'base64url'); }
  catch { throw appleError('APPLE_JWS_INVALID', 'Apple JWS signature is invalid.'); }
  if (signature.length !== 64) throw appleError('APPLE_JWS_SIGNATURE_INVALID', 'Apple JWS signature has an invalid shape.', 401);

  const ok = verifySignature(
    'sha256',
    Buffer.from(`${parts[0]}.${parts[1]}`),
    { key, dsaEncoding: 'ieee-p1363' },
    signature
  );
  if (!ok) throw appleError('APPLE_JWS_SIGNATURE_INVALID', 'Apple JWS signature verification failed.', 401);
  return { header, payload };
}
