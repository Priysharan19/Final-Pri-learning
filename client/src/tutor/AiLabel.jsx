import React from 'react';
import { useT } from '../i18n/index.js';

// Every sentence a model wrote is labelled as such, in the same words each time,
// apart from the engine's own feedback (which has no label of its own, because
// it is not a claim: it is the deterministic check's result). "What the engine
// checked" says in plain words what that check covers and what it does not.
export default function AiLabel({ labelKey }) {
  const t = useT();
  return (
    <div className="ai-label-wrap">
      <span className="ai-label" data-ai-label>{t(labelKey)}</span>
      <details className="ai-checked" data-ai-checked>
        <summary>{t('ai.checked.link')}</summary>
        <p>{t('ai.checked.body')}</p>
      </details>
    </div>
  );
}
