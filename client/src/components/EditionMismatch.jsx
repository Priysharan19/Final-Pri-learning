// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · this app and this service are different editions (plan E2)
//
// Shown instead of the whole app (main.jsx) when the server this build reached
// says it is the other edition, or refuses a request as EDITION_MISMATCH. It
// is a statement, not a step: there is no sign-in form, nothing to retry and
// nothing to choose, because the app in the student's hand cannot be made into
// the other one. Their work on this device is untouched.
// ─────────────────────────────────────────────────────────────────────────────
import React from 'react';
import { translate } from '../i18n/index.js';
import { edition, editionDisplayName } from '../platform/edition.js';

export default function EditionMismatch({ conflict }) {
  const app = edition().brand;
  return (
    <div className="crash-wrap">
      <section className="card crash-card" role="alert" data-edition-mismatch={conflict.service}>
        <div className="card-title">{app}</div>
        <h1 className="crash-title">
          {translate('edition.mismatchBody', { app, service: editionDisplayName(conflict.service) })}
        </h1>
      </section>
    </div>
  );
}
