// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the one quiet upgrade line, at a value moment only
//
// Asks moments.js whether an offer is allowed here (never during consent, a
// guardian flow, an error, a restriction, distress or an exam in progress;
// never to Premium; never where nothing is on sale), then says in one line
// what Premium adds at this moment, the edition's price where it has one, and
// that it can be cancelled at any time — with a link to the Premium screen.
// No timer, no scarcity, no dismissal guilt: it is a sentence, not a modal.
// ─────────────────────────────────────────────────────────────────────────────
import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useApp } from '../App.jsx';
import { useT } from '../i18n/index.js';
import PageLink from '../components/PageLink.jsx';
import { cloudAccountLink } from '../platform/cloudAccount.js';
import { ENTITLEMENTS, hasEntitlement } from '../platform/entitlements.js';
import { edition } from '../platform/edition.js';
import { PAYWALL_ROUTE } from './route.js';
import { MOMENT_ARRIVAL, MOMENT_KEYS, upgradeOffer } from './moments.js';
import { listPriceOf } from './pricing.js';
import { sellsPremium, useSaleAvailable } from './useSaleAvailable.js';

/** The offer for `moment` here, or null while the plan is not yet known. */
export function useUpgradeOffer(moment, context = {}) {
  const { user } = useApp() || {};
  const location = useLocation();
  const sale = useSaleAvailable();
  const [premium, setPremium] = useState(null);
  useEffect(() => {
    let live = true;
    if (!user?.id) { setPremium(false); return () => { live = false; }; }
    cloudAccountLink(user.id)
      .then(link => { if (live) setPremium(hasEntitlement(link?.entitlement, ENTITLEMENTS.UNLIMITED_PRACTICE)); })
      .catch(() => { if (live) setPremium(false); });
    return () => { live = false; };
  }, [user?.id]);
  if (premium === null) return null;
  return upgradeOffer(moment, { route: location.pathname, premium, onSale: sellsPremium(sale), ...context });
}

export default function UpgradeNote({ moment, context = {} }) {
  const t = useT();
  const offer = useUpgradeOffer(moment, context);
  if (!offer?.show) return null;
  const price = listPriceOf(edition().commerce);
  return (
    <p className="muted" data-upgrade-note={moment} style={{ marginTop: 'var(--space-2)' }}>
      {t(MOMENT_KEYS[moment])}{' '}
      {price && <>{t('upgrade.price', price)}{' '}</>}
      {t('upgrade.cancelAnytime')}{' '}
      <PageLink to={PAYWALL_ROUTE} state={{ from: MOMENT_ARRIVAL[moment] }}>{t('upgrade.see')}</PageLink>
    </p>
  );
}
