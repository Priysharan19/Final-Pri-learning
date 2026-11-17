// Turns a hypothesis catalogue (see number.slips.js) into registry slips. The
// registry only asks about lines the checker already marked as a break with no
// diagnosis, so a slip here can only change the words on a broken line.
import { detectSlip } from './_run.js';

/** Numeric working: evaluations, formulas and plain expressions. */
export const numericWorking = meta => ['evaluation', 'formula', 'expression'].includes(meta?.kind);

export function registrySlips(defs) {
  return defs.map(slip => ({
    code: slip.code,
    detect: ({ line, previous, meta }) => {
      if (!line || !previous) return null;
      const hit = detectSlip([slip], previous, line, meta?.substitutions || null);
      if (!hit) return null;
      const en = slip.copy(hit.detail, { edition: 'in' }).message;
      const au = slip.copy(hit.detail, { edition: 'au' }).message;
      const messages = { hi: slip.hi(hit.detail).message };
      if (au !== en) messages['en-AU'] = au;
      return { message: en, messages, notesSectionId: null };
    }
  }));
}
