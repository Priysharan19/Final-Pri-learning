// Per-class loading of the extra forms: a Class 7 student never downloads the JEE
// forms. A bank's generator ids pick the chunks (by the id's class prefix); each
// chunk is its own dynamic import. india-forms-extra.js imports every band
// statically and exists for the tests and tools that want them all.
const CHUNK_OF = { olymp: 'c12', c12: 'c12', c11: 'c11', c10: 'c10', c9: 'c789', c8: 'c789', c7: 'c789' };
const LOADERS = {
  c12: () => Promise.all([import('./band-12-a.js'), import('./band-12-b.js'), import('./band-12-c.js'), import('./band-sweep-hi.js')]),
  c11: () => Promise.all([import('./band-11-a.js'), import('./band-11-b.js'), import('./band-sweep-hi.js')]),
  c10: () => Promise.all([import('./band-10.js')]),
  c789: () => Promise.all([import('./band-789.js'), import('./band-sweep.js')])
};

/** Merge maps of skill id -> forms; a skill present in several maps gets the union (by form tag). */
export function mergeForms(into, ...maps) {
  for (const map of maps) {
    for (const [id, list] of Object.entries(map)) {
      if (!Array.isArray(list)) continue;
      const have = into[id] || (into[id] = []);
      for (const f of list) if (f && !have.some(g => g.form === f.form)) have.push(f);
    }
  }
  return into;
}

/** The extra forms for the classes the given generator ids belong to. */
export async function loadExtraForms(ids) {
  const chunks = new Set();
  for (const id of ids) {
    const prefix = String(id).split('-')[0];
    if (Object.hasOwn(CHUNK_OF, prefix)) chunks.add(CHUNK_OF[prefix]);
  }
  const out = {};
  for (const mods of await Promise.all([...chunks].map(c => LOADERS[c]()))) {
    for (const mod of mods) mergeForms(out, ...Object.values(mod).filter(v => v && typeof v === 'object' && !Array.isArray(v)));
  }
  return out;
}

/** Figure decorators (forms/prompt-figures.js) for the authored skills among the given ids; its own chunk. */
export async function loadFigureDecorators(ids) {
  const want = new Set(ids.map(String));
  const { FIGURE_FOR } = await import('./prompt-figures.js');
  return Object.fromEntries(Object.entries(FIGURE_FOR).filter(([id]) => want.has(id)));
}
