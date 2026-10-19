// Pri Learning · how a typed, pasted or autofilled code lands in the six boxes.
// Pure, so the rules are tested without a browser.

export const OTP_LENGTH = 6;

/** The digits of whatever was typed, pasted or autofilled (spaces, dashes and words dropped). */
export function otpDigits(text) {
  return String(text ?? '').replace(/\D/g, '');
}

/**
 * What the code becomes when `incoming` arrives in box `index`. A whole code
 * replaces everything wherever it lands; anything shorter is written from the
 * box it was typed into. Pure, so the rules are tested without a browser.
 */
export function otpAfterInput(value, index, incoming) {
  const digits = otpDigits(incoming);
  const current = otpDigits(value).slice(0, OTP_LENGTH);
  if (!digits) return current;
  if (digits.length >= OTP_LENGTH) return digits.slice(0, OTP_LENGTH);
  const at = Math.min(index, current.length);
  return (current.slice(0, at) + digits + current.slice(at + digits.length)).slice(0, OTP_LENGTH);
}
