// The syllabus dot point control on the practice page: a native, labelled select
// and, when a dot point is chosen, its removable chip. Both only read and write the
// `dotpoint` query value the home links already send; the page asks for the next
// question from there and says the change aloud (it owns the live region).
import React, { useId } from 'react';
import { useT } from '../i18n/index.js';
import Icon from './Icon.jsx';
import { dotpointChoices, readDotpointParam } from '../lib/practiceDotpoints.js';

/** The chip for the dot point in force. `phone` is the copy that sits beside "Clear filter" on a narrow screen. */
export function DotpointChip({ active, onClear, phone = false }) {
  const t = useT();
  if (!active) return null;
  return (
    <span className={`chip dp-chip ${phone ? 'dp-chip-phone' : 'dp-chip-wide'}`} data-dotpoint-chip>
      <span className="dp-chip-text" lang="en">{t('practice.dotpointChip', { text: active.text })}</span>
      <button type="button" className="chip-x" data-dotpoint-clear
        aria-label={t('practice.dotpointRemove', { text: active.text })} onClick={onClear}>
        <Icon name="close" size={12} />
      </button>
    </span>
  );
}

export default function DotpointPicker({ row, value, onChange }) {
  const t = useT();
  const id = useId();
  const choices = dotpointChoices(row);
  if (!choices.length) return null;
  const read = readDotpointParam(row, value);
  const active = read?.choice || null;
  return (
    <div className="dp-pick no-print" data-dotpoint-picker>
      <label className="label" htmlFor={id}>{t('practice.dotpointLabel')}</label>
      <div className="dp-pick-row">
        <select id={id} className="input" lang="en" value={active ? String(active.ordinal) : ''} data-dotpoint-select
          onChange={e => onChange(e.target.value === '' ? null : Number(e.target.value))}>
          <option value="">{t('practice.dotpointAll')}</option>
          {choices.map(c => <option key={c.ordinal} value={String(c.ordinal)}>{c.text}</option>)}
        </select>
        <DotpointChip active={active} onClear={() => onChange(null)} />
      </div>
      {read?.missing && (
        <p className="muted dp-none" role="status" data-dotpoint-none>
          {t('practice.dotpointNone')}{' '}
          <button type="button" className="btn btn-quiet btn-sm" data-dotpoint-all onClick={() => onChange(null)}>{t('practice.dotpointAll')}</button>
        </p>
      )}
    </div>
  );
}
