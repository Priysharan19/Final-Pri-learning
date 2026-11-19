// The syllabus dot point control on the practice page: a native, labelled select
// beside a removable chip. It only reads and writes the `dotpoint` query value
// the home links already send; the page asks for the next question from there.
import React, { useId } from 'react';
import { useT } from '../i18n/index.js';
import Icon from './Icon.jsx';
import { useAnnounce } from '../examShell/useAnnounce.js';
import { dotpointChoices, readDotpointParam } from '../lib/practiceDotpoints.js';

export default function DotpointPicker({ row, value, onChange }) {
  const t = useT();
  const id = useId();
  const { announce, region } = useAnnounce();
  const choices = dotpointChoices(row);
  if (!choices.length) return null;
  const read = readDotpointParam(row, value);
  const active = read?.choice || null;

  const choose = ordinal => {
    onChange(ordinal);
    const next = ordinal == null ? null : choices.find(c => c.ordinal === ordinal);
    announce(next ? t('practice.dotpointAnnounce', { text: next.text }) : t('practice.dotpointAnnounceAll'));
  };

  return (
    <div className="dp-pick no-print" data-dotpoint-picker>
      <label className="label" htmlFor={id}>{t('practice.dotpointLabel')}</label>
      <div className="dp-pick-row">
        <select id={id} className="input" lang="en" value={active ? String(active.ordinal) : ''} data-dotpoint-select
          onChange={e => choose(e.target.value === '' ? null : Number(e.target.value))}>
          <option value="">{t('practice.dotpointAll')}</option>
          {choices.map(c => <option key={c.ordinal} value={String(c.ordinal)}>{c.text}</option>)}
        </select>
        {active && (
          <span className="chip dp-chip" data-dotpoint-chip>
            <span className="dp-chip-text" lang="en">{t('practice.dotpointChip', { text: active.text })}</span>
            <button type="button" className="chip-x" data-dotpoint-clear
              aria-label={t('practice.dotpointRemove', { text: active.text })} onClick={() => choose(null)}>
              <Icon name="close" size={12} />
            </button>
          </span>
        )}
      </div>
      {read?.missing && (
        <p className="muted dp-none" role="status" data-dotpoint-none>
          {t('practice.dotpointNone')}{' '}
          <button type="button" className="btn btn-quiet btn-sm" data-dotpoint-all onClick={() => onChange(null)}>{t('practice.dotpointAll')}</button>
        </p>
      )}
      {region}
    </div>
  );
}
