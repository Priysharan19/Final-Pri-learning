// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the four legal notices in Hindi
//
// The DPDP Act's section 5(3) gives a data principal the right to read the
// notice in English or in any language in the Eighth Schedule. This app has
// shipped a full Hindi interface for a while and English-only notices behind
// it, which made the translation a courtesy and the notice a wall — a student
// who reads the whole app in Hindi met the one document that decides what
// happens to their data in a language they had already told us they do not
// read. These four files close that.
//
// WHY THEY ARE BEHIND AN import(). The same argument the Hindi string
// catalogue makes: an English reader must not download 34 kB of Devanagari
// they will never open, and a language added later must not be paid for by
// everyone who does not read it. vite.config.js has no rule naming this chunk,
// so it is not in the install; it lands in the warm pass, which is the right
// place — the warm pass is what a student has seconds after the app is on
// screen, and from then on these are offline like everything else.
//
// WHY ALL FOUR TRAVEL TOGETHER rather than one chunk per page: every notice
// links to the others at its foot, and the privacy notice sends a reader to
// the grievance page by name. One request that arrives once beats four that
// arrive one at a time on a link where the cost is latency rather than bytes.
//
// WHY THE ENGLISH IS NOT HERE. English is the operative text — every document
// below says so in its own first paragraph — so the page imports it statically
// and can always show it. A page whose governing version could fail to arrive
// would be worse than one that never offered Hindi at all.
//
// Nothing but the documents is imported, so the chunk carries the notices and
// nothing else. That is the rule strings.hi.js keeps, for the same reason.
// ─────────────────────────────────────────────────────────────────────────────
import privacy from '../../../docs/legal/privacy.hi.md?raw';
import terms from '../../../docs/legal/terms.hi.md?raw';
import refund from '../../../docs/legal/refund-policy.hi.md?raw';
import grievance from '../../../docs/legal/grievance.hi.md?raw';

/** Keyed by the same slugs as LEGAL_PAGES, which are the routes themselves. */
export default Object.freeze({
  privacy,
  terms,
  'refund-policy': refund,
  grievance
});
