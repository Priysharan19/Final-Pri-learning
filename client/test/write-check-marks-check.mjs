// Write & Check marks: provenance is positive and ecf credit reaches the
// margin. Deterministic, no browser. Presentation only: no status changes.
import { engineMark, tagEngineVerdicts } from '../src/instrument/margin/engineMark.js';
import { mergeVerdicts, CLOUD_WORKING_ENGINE } from '../src/ink/cloudWorking.js';

let pass = 0, fail = 0;
const check = (name, ok, got) => { if (ok) pass++; else { fail++; console.log(`  ✗ ${name}${got !== undefined ? ` — got ${JSON.stringify(got)}` : ''}`); } };

check('a verdict with no source gets no stamp', engineMark({ status: 'ok' }) === null);
check('a break with no source gets no stamp', engineMark({ status: 'break' }) === null);
check('a cloud (model) verdict gets no stamp', engineMark({ status: 'break', source: CLOUD_WORKING_ENGINE }) === null && engineMark({ status: 'ok', source: CLOUD_WORKING_ENGINE }) === null);
check('an unknown source gets no stamp', engineMark({ status: 'ok', source: 'something-else' }) === null);
check('an engine ok is a tick', engineMark({ status: 'ok', source: 'engine' }) === 'ok');
check('an engine break is a cross', engineMark({ status: 'break', source: 'engine' }) === 'x');
check('an engine wrong answer line is a cross', engineMark({ status: 'wrong', source: 'engine' }) === 'x');
check('an engine ecf-credited ok is the ecf capsule', engineMark({ status: 'ok', source: 'engine', ecf: true }) === 'ecf');
check('unknown and note lines are never stamped', engineMark({ status: 'unknown', source: 'engine' }) === null && engineMark({ status: 'note', source: 'engine' }) === null);

const base = [{ status: 'ok' }, { status: 'break', note: 'n' }, { status: 'ok' }, { status: 'unknown' }];
const report = { lines: [{ status: 'ok' }, { status: 'break' }, { status: 'ok', ecf: true }, { status: 'note' }] };
const tagged = tagEngineVerdicts(base, report);
check('tagging marks engine verdicts with their provenance', tagged.slice(0, 3).every(v => v.source === 'engine'), tagged);
check('tagging never changes a status or note', tagged.every((v, i) => v.status === base[i].status) && tagged[1].note === 'n');
check('tagging carries ecf only onto an ok line the report credited', tagged[2].ecf === true && !tagged[0].ecf && !tagged[1].ecf);
check('unknown lines stay untagged', tagged[3].source === undefined);
check('stamps from tagged verdicts', tagged.map(engineMark).join() === 'ok,x,ecf,', tagged.map(engineMark));
check('the input is not mutated', base.every(v => v.source === undefined));

check('a cloud verdict passed through tagging is never relabelled or stamped', engineMark(tagEngineVerdicts([{ status: 'break', source: CLOUD_WORKING_ENGINE }], null)[0]) === null);
check('an engine status of ecf is the capsule too', engineMark({ status: 'ecf', source: 'engine' }) === 'ecf');

// The rebuild after the second read keeps the marker on engine lines.
const merged = mergeVerdicts(tagged, { firstBreak: 3, lines: [{ index: 3, status: 'break', why: 'w' }] }, { lineCount: 4 });
check('merging with the second read keeps engine provenance', merged.slice(0, 3).every(v => v.source === 'engine'), merged);
check('the model line merged in is never stamped', engineMark(merged[3]) === null);

console.log(`WRITE & CHECK MARKS: ${fail ? 'FAIL' : 'PASS'} — ${pass}/${pass + fail} checks — stamps only for the deterministic engine; ecf credit shown as the capsule.`);
process.exit(fail ? 1 : 0);
