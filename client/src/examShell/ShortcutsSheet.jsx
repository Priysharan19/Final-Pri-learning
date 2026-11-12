// The exam shell's keyboard-shortcut list (F4 §1.1): what each key does, in a
// dialog opened with "?". `shortcuts` is [{ keys: ['←', '→'], label }].
import React from 'react';
import { useT } from '../i18n/index.js';
import { Sheet } from './ConfirmSheet.jsx';

export default function ShortcutsSheet({ open, onClose, shortcuts }) {
  const t = useT();
  return (
    <Sheet open={open} title={t('shell.shortcuts')} onClose={onClose} closeLabel={t('shell.close')} testId="shell-shortcuts">
      <dl className="xs-keys">
        {shortcuts.map(s => (
          <div key={s.label}>
            <dt>{s.keys.map(k => <kbd key={k}>{k}</kbd>)}</dt>
            <dd>{s.label}</dd>
          </div>
        ))}
      </dl>
      <p className="in-note">{t('shell.shortcutsNote')}</p>
    </Sheet>
  );
}
