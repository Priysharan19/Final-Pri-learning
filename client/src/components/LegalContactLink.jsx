// The footer link to the page where a person writes to us about their information or a
// purchase. Priyabhata's is the grievance page the DPDP Act asks for; Prithagoras has a
// contact page instead (docs/legal/au/contact.md). Kept out of Login.jsx so the sign-in
// screen asks the edition helper only for its sign-up course (plan E3).
import React from 'react';
import PageLink from './PageLink.jsx';
import { useLanguage } from '../i18n/index.js';
import { EDITION } from '../platform/edition.js';

export default function LegalContactLink() {
  const { t } = useLanguage();
  return EDITION === 'prithagoras'
    ? <PageLink to="/contact">{t('login.contact')}</PageLink>
    : <PageLink to="/grievance">{t('login.grievances')}</PageLink>;
}
