// Pri Learning · six-box one-time-code input.
//
// One real <input> per digit so each box can be styled and announced, with
// the behaviour people expect from a code field: typing moves forward,
// Backspace on an empty box moves back, arrow keys move, and pasting (or an
// SMS/keyboard autofill of the whole code into the first box) fills every box.
// The first box carries autocomplete="one-time-code" so iOS and Android offer
// the code from the message; WebOTP (Android Chrome) is handled by the caller.
import React, { useEffect, useRef } from 'react';
import { useT } from '../i18n/index.js';

export const OTP_LENGTH = 6;

export default function OtpInput({ value, onChange, onComplete, disabled = false, invalid = false, autoFocus = true, idPrefix = 'otp', labelledBy }) {
  const t = useT();
  const refs = useRef([]);
  const digits = Array.from({ length: OTP_LENGTH }, (_, i) => value[i] || '');

  useEffect(() => {
    if (autoFocus && !disabled) refs.current[Math.min(value.length, OTP_LENGTH - 1)]?.focus({ preventScroll: true });
    // Focus only when the field first appears or is re-enabled.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFocus, disabled]);

  const commit = (next) => {
    const clean = next.replace(/\D/g, '').slice(0, OTP_LENGTH);
    onChange(clean);
    if (clean.length === OTP_LENGTH) onComplete?.(clean);
    return clean;
  };

  const fillFrom = (index, text) => {
    const incoming = String(text || '').replace(/\D/g, '');
    if (!incoming) return;
    // A whole code (paste, autofill) replaces everything; a single digit
    // replaces the box it was typed into.
    const next = incoming.length >= OTP_LENGTH
      ? incoming.slice(0, OTP_LENGTH)
      : (value.slice(0, index) + incoming + value.slice(index + incoming.length)).slice(0, OTP_LENGTH);
    const clean = commit(next);
    refs.current[Math.min(clean.length, OTP_LENGTH - 1)]?.focus();
  };

  const onKeyDown = (index, event) => {
    if (event.key === 'Backspace') {
      event.preventDefault();
      if (digits[index]) commit(value.slice(0, index) + value.slice(index + 1));
      else if (index > 0) {
        commit(value.slice(0, index - 1) + value.slice(index));
        refs.current[index - 1]?.focus();
      }
    } else if (event.key === 'ArrowLeft' && index > 0) {
      event.preventDefault();
      refs.current[index - 1]?.focus();
    } else if (event.key === 'ArrowRight' && index < OTP_LENGTH - 1) {
      event.preventDefault();
      refs.current[index + 1]?.focus();
    }
  };

  return (
    <div className={`otp-boxes${invalid ? ' otp-invalid' : ''}`} role="group" aria-labelledby={labelledBy}>
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={el => { refs.current[index] = el; }}
          id={`${idPrefix}-${index}`}
          className={`otp-box${digit ? ' otp-filled' : ''}`}
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          autoComplete={index === 0 ? 'one-time-code' : 'off'}
          maxLength={index === 0 ? OTP_LENGTH : 1}
          aria-label={t('signup.codeDigit', { n: index + 1, total: OTP_LENGTH })}
          aria-invalid={invalid || undefined}
          value={digit}
          disabled={disabled}
          data-testid={`${idPrefix}-box`}
          onChange={e => fillFrom(index, e.target.value.slice(digit ? 1 : 0) || e.target.value)}
          onPaste={e => { e.preventDefault(); fillFrom(0, e.clipboardData.getData('text')); }}
          onKeyDown={e => onKeyDown(index, e)}
          onFocus={e => e.target.select()}
        />
      ))}
    </div>
  );
}
