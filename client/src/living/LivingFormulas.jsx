// Pri Learning · the living formulas of one chapter: a short line saying what to do, then the figures.
import { useT } from '../i18n/index.js';
import { SPEC_BY_ID } from './specs.js';
import LivingFormula from './LivingFormula.jsx';

export default function LivingFormulas({ ids }) {
  const t = useT();
  const specs = ids.map(id => SPEC_BY_ID[id]).filter(Boolean);
  if (!specs.length) return null;
  return (
    <>
      <p className="lf-intro">{t('living.ui.intro')}</p>
      <div className="lf-set">{specs.map(spec => <LivingFormula key={spec.id} spec={spec} />)}</div>
    </>
  );
}
