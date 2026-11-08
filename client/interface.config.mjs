// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the one interface setting (V1 decisions D7 and D8)
//
// Every build of the student app reads this file and nothing else to decide
// which interface it ships: the web build Railway makes from the Dockerfile,
// the web bundle `npm run sync:ios` copies into both iOS packages, and the one
// android/app/build.gradle.kts packages. All three run `vite build`, and
// client/vite.config.js takes the interface from here, so web, iPhone, iPad
// and Android cannot drift apart through a build variable set on one of them.
// The retired PRI_FEATURE_INSTRUMENT variable is ignored (the build says so if
// it is set to anything that disagrees with this file).
//
// STUDENT_INTERFACE  'instrument' is the only interface (D7: "One student UI:
//                    the Instrument structure ... Every build (web, iOS,
//                    Android) ships it from one setting"). The v1.0 paper shell
//                    is no longer built for students.
//
// INTERFACE_SKIN     the token set the Instrument wears.
//                    'instrument'  the plain Instrument tokens: matte graphite
//                                  and paper, ivory primary action, one signal
//                                  orange. This is what D8 ships whenever the
//                                  Aurora skin has not passed its contrast,
//                                  reduced-motion and ink-alignment gates.
//
// client/test/interface-setting-check.mjs holds the build, the bundles' recorded
// features.json and this file to one another.
// ─────────────────────────────────────────────────────────────────────────────

export const STUDENT_INTERFACE = 'instrument';
export const INTERFACE_SKIN = 'instrument';

export const STUDENT_INTERFACES = Object.freeze(['instrument']);
export const INTERFACE_SKINS = Object.freeze(['instrument']);
