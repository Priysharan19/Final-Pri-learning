// The subtopic ids the legacy NSW generator modules define. Loaded on demand
// (the generator modules are large) and only by the coverage script and its
// test; the model itself never imports a generator.

const LEGACY_NSW_GENERATOR_MODULES = Object.freeze([
  ['../generators/year7.js', 'year7'],
  ['../generators/year8.js', 'year8'],
  ['../generators/year9.js', 'year9'],
  ['../generators/year10.js', 'year10'],
  ['../generators/year11.js', 'year11'],
  ['../generators/year12.js', 'year12'],
  ['../generators/streams-standard.js', 'streamsStandard'],
  ['../generators/streams-ext.js', 'streamsExt']
]);

/** Every subtopic id with a legacy NSW generator function, sorted. */
export async function legacyNswGeneratorIds() {
  const ids = new Set();
  for (const [path, name] of LEGACY_NSW_GENERATOR_MODULES) {
    const bank = (await import(path))[name];
    for (const [id, generate] of Object.entries(bank || {})) {
      if (typeof generate === 'function') ids.add(id);
    }
  }
  return [...ids].sort();
}
