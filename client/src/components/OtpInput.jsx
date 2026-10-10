// Pri Learning · six-box one-time-code input.
//
// One real <input> per digit so each box can be styled and announced, with
// the behaviour people expect from a code field:
//   · typing moves forward; Backspace clears a box, or steps back from an empty
//     one; Delete clears in place; the arrow keys, Home and End move;
//   · a whole code pasted into ANY box — or dropped into any box by the
//     keyboard's "from Messages / from Mail" suggestion — fills all six;
//   · the first box carries autocomplete="one-time-code" so iOS and Android
//     offer the code from the message; WebOTP (Android Chrome) is the caller's;
//   · the sixth digit calls onComplete once, so the caller can submit without a
//     button press (the caller owns duplicate-request protection);
//   · a polite live region says how many digits are in, so a screen-reader user
//     is not left counting boxes; `describedBy` ties the boxes to the caller's
//     error or status line.
import React, { useEffect, useRef } from 'react';
import { useT } from '../i18n/index.js';

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

export default function OtpInput({
  value, onChange, onComplete, disabled = false, invalid = false, autoFocus = true,
  idPrefix = 'otp', labelledBy, describedBy
}) {
  const t = useT();
  const refs = useRef([]);
  const digits = Array.from({ length: OTP_LENGTH }, (_, i) => value[i] || '');

  useEffect(() => {
    if (autoFocus && !disabled) refs.current[Math.min(value.length, OTP_LENGTH - 1)]?.focus({ preventScroll: true });
    // Focus only when the field first appears or is re-enabled.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFocus, disabled]);

  const commit = (next) => {
    const clean = otpDigits(next).slice(0, OTP_LENGTH);
    onChange(clean);
    if (clean.length === OTP_LENGTH && clean !== value) onComplete?.(clean);
    return clean;
  };

  const fillFrom = (index, text) => {
    if (!otpDigits(text)) return;
    const clean = commit(otpAfterInput(value, index, text));
    refs.current[Math.min(clean.length, OTP_LENGTH - 1)]?.focus();
  };

  /** What was newly entered in a box that may already hold a digit. */
  const entered = (digit, raw) => {
    const text = otpDigits(raw);
    if (!digit || text.length <= 1) return text;
    const at = text.indexOf(digit);
    return at < 0 ? text : text.slice(0, at) + text.slice(at + 1);
  };

  const onKeyDown = (index, event) => {
    if (event.key === 'Backspace') {
      event.preventDefault();
      if (digits[index]) commit(value.slice(0, index) + value.slice(index + 1));
      else if (index > 0) {
        commit(value.slice(0, index - 1) + value.slice(index));
        refs.current[index - 1]?.focus();
      }
    } else if (event.key === 'Delete') {
      event.preventDefault();
      if (digits[index]) commit(value.slice(0, index) + value.slice(index + 1));
    } else if (event.key === 'ArrowLeft' && index > 0) {
      event.preventDefault();
      refs.current[index - 1]?.focus();
    } else if (event.key === 'ArrowRight' && index < OTP_LENGTH - 1) {
      event.preventDefault();
      refs.current[index + 1]?.focus();
    } else if (event.key === 'Home') {
      event.preventDefault();
      refs.current[0]?.focus();
    } else if (event.key === 'End') {
      event.preventDefault();
      refs.current[Math.min(value.length, OTP_LENGTH - 1)]?.focus();
    }
  };

  return (
    <div className={`otp-boxes${invalid ? ' otp-invalid' : ''}`} role="group" aria-labelledby={labelledBy} aria-describedby={describedBy}>
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={el => { refs.current[index] = el; }}
          id={`${idPrefix}-${index}`}
          className={`otp-box${digit ? ' otp-filled' : ''}`}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          enterKeyHint="done"
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          // Every box accepts a whole code: the keyboard's suggestion inserts
          // into whichever box holds the caret, not always the first.
          maxLength={OTP_LENGTH}
          aria-label={t('signup.codeDigit', { n: index + 1, total: OTP_LENGTH })}
          aria-invalid={invalid || undefined}
          aria-describedby={describedBy}
          value={digit}
          disabled={disabled}
          data-testid={`${idPrefix}-box`}
          onChange={e => fillFrom(index, entered(digit, e.target.value))}
          onPaste={e => { e.preventDefault(); fillFrom(index, e.clipboardData.getData('text')); }}
          onKeyDown={e => onKeyDown(index, e)}
          onFocus={e => e.target.select()}
        />
      ))}
      <span className="sr-only" role="status" aria-live="polite" data-testid={`${idPrefix}-progress`}>
        {value.length > 0 && value.length < OTP_LENGTH ? t('signup.codeProgress', { n: value.length, total: OTP_LENGTH }) : ''}
      </span>
    </div>
  );
}
