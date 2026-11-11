// Pri Learning · "Listen" (F9): on-device voice choice and the deterministic
// LaTeX verbaliser it speaks with. Synthetic voice lists only — no device.
import { readFileSync } from 'node:fs';
import { listenPlan, listenText, localVoices } from '../src/explain/listen.js';
import en from '../src/i18n/strings.en.js';
import hi from '../src/i18n/strings.hi.js';

let pass = 0;
const failures = [];
const ok = (name, cond, detail = '') => (cond ? pass++ : failures.push(`${name}${detail ? ` — ${detail}` : ''}`));
const V = (lang, localService = true, name = lang) => ({ lang, localService, name });

// Voice choice: on-device only.
ok('network-only voices give no plan (control hidden)', listenPlan([V('en-IN', false), V('hi-IN', false)], 'en') === null);
ok('no voices give no plan', listenPlan([], 'hi') === null && listenPlan(undefined, 'en') === null);
ok('unrelated language only gives no plan', listenPlan([V('fr-FR')], 'en') === null);
const hiPlan = listenPlan([V('en-IN'), V('hi-IN')], 'hi');
ok('Hindi reader gets the hi-IN voice', hiPlan?.voice.lang === 'hi-IN' && hiPlan.spoken === 'hi', JSON.stringify(hiPlan));
const enPlan = listenPlan([V('hi-IN'), V('en-IN')], 'en');
ok('English reader gets the en-IN voice', enPlan?.voice.lang === 'en-IN' && enPlan.spoken === 'en');
const net = listenPlan([V('hi-IN', false), V('en-IN', true)], 'hi');
ok('a network hi-IN voice is never used; falls back to on-device English', net?.voice.lang === 'en-IN' && net.voice.localService && net.spoken === 'en', JSON.stringify(net));
ok('localVoices keeps only localService === true', localVoices([V('en-IN'), V('hi-IN', false), { lang: 'en-IN' }, null]).length === 1);

// Verbaliser: deterministic maths into words.
const say = (text, plan) => listenText(text, plan);
ok('English fraction', /3 divided by 4/.test(say('$\\frac{3}{4}$', enPlan)), say('$\\frac{3}{4}$', enPlan));
ok('English square', /x squared/.test(say('$x^2$', enPlan)));
ok('English square root', /square root of 16/.test(say('$\\sqrt{16}$', enPlan)));
ok('English equals', /x equals 5/.test(say('$x = 5$', enPlan)));
ok('Hindi fraction', /3 बटा 4/.test(say('$\\frac{3}{4}$', hiPlan)), say('$\\frac{3}{4}$', hiPlan));
ok('Hindi square', /x का वर्ग/.test(say('$x^2$', hiPlan)));
ok('no LaTeX left in what is spoken', !/[\\${}^]/.test(say('$\\frac{x^2+1}{\\sqrt{2}} \\le 3$', enPlan)), say('$\\frac{x^2+1}{\\sqrt{2}} \\le 3$', enPlan));
ok('same input, same words', say('$2x+3=7$', hiPlan) === say('$2x+3=7$', hiPlan));
ok('English fallback speaks the English text', listenText(lang => (lang === 'hi' ? 'हिंदी' : 'English words'), net) === 'English words');
ok('a plain Hindi string is never read by an English voice', listenText('x का मान 5 है', net) === '' && listenText('$x$ बराबर 5', enPlan) === '');
ok('the same Hindi string is read by a Hindi voice', listenText('x का मान 5 है', hiPlan).length > 0);
ok('a plain English string still reads with English fallback', listenText('Subtract 3 from both sides.', net) === 'Subtract 3 from both sides.');
ok('no plan, nothing spoken', listenText('x', null) === '');

// Strings and wiring.
ok('control labelled in both languages', en['listen.play'] === 'Listen' && hi['listen.play'] === 'सुनें' && !!en['listen.stop'] && !!hi['listen.stop']);
const btn = readFileSync(new URL('../src/components/ListenButton.jsx', import.meta.url), 'utf8');
ok('button returns nothing without a plan', /if \(!plan \|\| !words\) return null/.test(btn));
ok('button is a real toggle button', /type="button"/.test(btn) && /aria-pressed/.test(btn));
ok('no network in the listen path', !/fetch\(|api\.|XMLHttpRequest|WebSocket/.test(btn + readFileSync(new URL('../src/explain/listen.js', import.meta.url), 'utf8')));
const qc = readFileSync(new URL('../src/components/QuestionCard.jsx', import.meta.url), 'utf8');
ok('Listen on each worked step', /<ListenButton text=\{\[s\.h, s\.d\]/.test(qc));
ok('ListenButton is loaded on demand in QuestionCard, not in the main chunk', /const ListenButton = React\.lazy\(\(\) => import\('\.\/ListenButton\.jsx'\)\)/.test(qc) && !/^import ListenButton/m.test(qc));
const tutor = readFileSync(new URL('../src/tutor/TutorHelp.jsx', import.meta.url), 'utf8');
ok('Listen on tutor replies, not the student\'s own turns', /turn\.role !== 'student' && turn\.text && <ListenButton/.test(tutor));

if (failures.length) { console.error(failures.map(f => `  ✗ ${f}`).join('\n')); console.error(`LISTEN: FAIL — ${pass}/${pass + failures.length} checks`); process.exit(1); }
console.log(`LISTEN: PASS — ${pass}/${pass} checks`);
