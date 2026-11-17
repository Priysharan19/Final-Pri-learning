// Uploading a hosted PDF (plan F3). The platform accepts no body over 1 MiB, so a
// file goes up as at most 50 parts of 512 KiB (base64 inside JSON), then one call
// asks the server to assemble it. The server computes the hash and size itself
// and refuses the file if what is declared here does not match; the checks here
// only spare staff a long upload that is bound to fail.
export const PART_BYTES = 512 * 1024;
export const MAX_BYTES = 25 * 1024 * 1024;

const toBase64 = bytes => {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};

async function sha256Hex(buffer) {
  const digest = await crypto.subtle.digest('SHA-256', buffer);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Problems visible before sending, as codes the panel turns into words. */
export function fileProblems(file) {
  if (!file) return ['none'];
  if (!file.size) return ['empty'];
  if (file.size > MAX_BYTES) return ['large'];
  if (file.type && file.type !== 'application/pdf') return ['type'];
  return [];
}

/**
 * Send `file` for revision `n` of resource `rid`. `transport` is the cloud
 * object; `onProgress(done, total)` is called after each part.
 */
export async function uploadAsset(transport, rid, n, file, onProgress = () => {}) {
  const problems = fileProblems(file);
  if (problems.length) throw Object.assign(new Error('file'), { code: 'UPLOAD_LOCAL', problems });
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const parts = Math.ceil(bytes.length / PART_BYTES);
  await transport.resourceAdminAssetStart(rid, n);
  for (let i = 0; i < parts; i++) {
    await transport.resourceAdminAssetPart(rid, n, i, toBase64(bytes.subarray(i * PART_BYTES, (i + 1) * PART_BYTES)));
    onProgress(i + 1, parts);
  }
  return transport.resourceAdminAssetComplete(rid, n, { parts, byteLength: bytes.length, sha256: await sha256Hex(buffer) });
}
