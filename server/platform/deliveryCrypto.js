import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

function decodeConfiguredKey(raw) {
  const value = String(raw || '').trim();
  if (!value) return null;
  if (/^[a-f0-9]{64}$/i.test(value)) return Buffer.from(value, 'hex');
  try {
    const key = Buffer.from(value, 'base64url');
    if (key.length === 32) return key;
  } catch { /* fall through */ }
  try {
    const key = Buffer.from(value, 'base64');
    if (key.length === 32) return key;
  } catch { /* fall through */ }
  return null;
}

function deliveryKey() {
  const configured = decodeConfiguredKey(process.env.PRI_AUTH_DELIVERY_KEY);
  if (configured) return configured;
  if (process.env.NODE_ENV === 'production') {
    throw new Error('PRI_AUTH_DELIVERY_KEY must be configured as a 32-byte key in production');
  }
  // Development/test fallback is stable so queued mail can be exercised across
  // local process restarts. It is intentionally unusable in production.
  return createHash('sha256').update(String(process.env.PRI_CSRF_SECRET || 'pri-development-only-delivery-key')).digest();
}

export function encryptDeliveryToken(rawToken, context = '') {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', deliveryKey(), iv);
  cipher.setAAD(Buffer.from(String(context)));
  const ciphertext = Buffer.concat([cipher.update(String(rawToken), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ['v1', iv.toString('base64url'), tag.toString('base64url'), ciphertext.toString('base64url')].join('.');
}

export function decryptDeliveryToken(envelope, context = '') {
  const [version, ivRaw, tagRaw, ciphertextRaw, extra] = String(envelope || '').split('.');
  if (version !== 'v1' || !ivRaw || !tagRaw || !ciphertextRaw || extra !== undefined) throw new Error('Invalid auth delivery envelope');
  const iv = Buffer.from(ivRaw, 'base64url');
  const tag = Buffer.from(tagRaw, 'base64url');
  const ciphertext = Buffer.from(ciphertextRaw, 'base64url');
  if (iv.length !== 12 || tag.length !== 16) throw new Error('Invalid auth delivery envelope');
  const decipher = createDecipheriv('aes-256-gcm', deliveryKey(), iv);
  decipher.setAAD(Buffer.from(String(context)));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}
