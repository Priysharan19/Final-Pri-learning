// Test pictures that are pictures: a real format signature in front of a
// test's own payload.
//
// The server reads an upload's first bytes (handwritingProvider.js imageFormatOf) and
// refuses anything that is not a PNG, JPEG or WebP before a provider is paid
// to read it. Suites whose scripted readers carry their instructions inside the
// picture ("PICTURE|behaviour|label|…") keep doing so: the signature comes
// first, and those readers split on '|' and never read the first field.
//
// Twelve header bytes, so the base64 head is exactly 16 characters and a
// suite can append base64 of its own without breaking the encoding.

export const PNG_HEAD = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]);
export const JPEG_HEAD = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
export const PNG_HEAD_B64 = PNG_HEAD.toString('base64');

const bytesOf = payload => Buffer.isBuffer(payload) ? payload : Buffer.from(String(payload));
/** A PNG data URL whose bytes are the PNG signature, then `payload`. */
export const pngDataUrl = payload => 'data:image/png;base64,' + Buffer.concat([PNG_HEAD, bytesOf(payload)]).toString('base64');
/** A JPEG data URL whose bytes are the JPEG/JFIF signature, then `payload`. */
export const jpegDataUrl = payload => 'data:image/jpeg;base64,' + Buffer.concat([JPEG_HEAD, bytesOf(payload)]).toString('base64');
