// Per-class loading of the extra forms: a Class 7 student never downloads the JEE
// forms. A bank's generator ids pick the chunks (by the id's class prefix); each
// chunk is its own dynamic import. india-forms-extra.js imports every band
// statically and exists for the tests and tools that want them all.
const CHUNK_OF = { olymp: 'c12', c12: 'c12', c11: 'c11', c10: 'c10' };
const LOADERS = {
  c12: () => Promise.all([import('./band-12-a.js'), import('./band-12-b.js'), import('./band-12-c.js')]),
  c11: () => Promise.all([import('./band-11-a.js'), import('./band-11-b.js')]),
  c10: () => Promise.all([import('./band-10.js')])
};

/** The extra forms for the classes the given generator ids belong to. */
export async function loadExtraForms(ids) {
  const chunks = new Set();
  for (const id of ids) {
    const prefix = String(id).split('-')[0];
    if (Object.hasOwn(CHUNK_OF, prefix)) chunks.add(CHUNK_OF[prefix]);
  }
  const out = {};
  for (const mods of await Promise.all([...chunks].map(c => LOADERS[c]()))) {
    for (const mod of mods) Object.assign(out, ...Object.values(mod));
  }
  return out;
}
