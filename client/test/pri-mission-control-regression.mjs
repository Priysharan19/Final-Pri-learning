import assert from 'node:assert/strict';
import { spawnSync, execFile } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
const execAsync=promisify(execFile);
const dir=mkdtempSync(join(tmpdir(),'pri-lease-regression-'));
const root=fileURLToPath(new URL('../../',import.meta.url));
const control=join(root,'scripts/pri-mission-control.mjs');
const sha='ce8d4b06c91736c82a0e9920917914fe086de6d3';
const ref='90b5c405722807282c454592f6e6016397fd59a3';
const now=new Date();
const at=(h=0)=>new Date(now.getTime()-h*3600000).toISOString();
let checks=0;
const verify=(message,ok)=>{assert.ok(ok,message);checks++;};
const file=(name,value)=>{const target=join(dir,name);writeFileSync(target,JSON.stringify(value));return target;};
function run(args){const p=spawnSync(process.execPath,[control,...args],{encoding:'utf8'});return {code:p.status,data:p.stdout?.trim()?JSON.parse(p.stdout):{errors:[String(p.stderr)]}};}
const markers=(id,agent,branch,status,paths,beat=true)=>[
`Pri-Mission-ID: ${id}`,`Pri-Mission-Status: ${status}`,`Pri-Agent: ${agent}`,
`Pri-Branch: ${branch}`,'Pri-Risk: R3',`Pri-Base-SHA: ${sha}`,
'Pri-Attempt: 0','Pri-Failure-Fingerprint: none',`Pri-Paths: ${paths.join(', ')}`,'Pri-Dependencies: none',
...(beat?[`Pri-Lease-Heartbeat-At: ${at()}`,`Pri-Lease-Heartbeat-Ref: ${ref}`,`Pri-Lease-Heartbeat-By: ${agent}`]:[])
].join('\n');
const make=(number,id,agent,status,paths,issueState='open',beat=true)=>({number,state:issueState,title:'[PRI-MISSION] test #'+number,body:markers(id,agent,`agent/mission/${agent}/${id}`,status,paths,beat),updated_at:at()});
const india='client/src/engine/ncert/class9-2026-27-gap-study-pack.js';
const student='client/src/pages/Notes.jsx';
const e1=make(470,'class9','india-curriculum','ACTIVE',[india]);
const e2=make(900,'student-notes','student-experience','ACTIVE',[student]);
const reviewer={...make(483,'cbse','india-curriculum','REVIEW',['client/src/engine/ncert/cbse-2026-27-exam-original-blind.js'], 'open', false)}; reviewer.body+='\nPri-Review-Head: '+ref;
const expected=(issue)=>({agent:issue.body.match(/^Pri-Agent: (.+)$/m)[1],mission:issue.body.match(/^Pri-Mission-ID: (.+)$/m)[1],branch:issue.body.match(/^Pri-Branch: (.+)$/m)[1],risk:'R3'});
function checkLedger(name,issues,exp){const x=expected(exp);return run(['validate-ledger',file(name,issues),x.agent,x.mission,x.branch,x.risk,ref]);}
const reviewOnly=checkLedger('review-only.json',[reviewer],reviewer);
verify('REVIEW without writer validates',reviewOnly.code===0&&reviewOnly.data.valid&&reviewOnly.data.active_count===0);
const eWithReview=checkLedger('review-and-active.json',[e1,reviewer],reviewer);
verify('Review with one live writer validates',eWithReview.code===0&&eWithReview.data.active_count===1);
const oldComment={...e1,updated_at:at(),body:e1.body.replace(/Pri-Lease-Heartbeat-At: .+/, `Pri-Lease-Heartbeat-At: ${at(13)}`)};
const oldCommentResult=checkLedger('comment-update.json',[oldComment],oldComment);
verify('Unrelated comment cannot renew lease',oldCommentResult.code!==0&&oldCommentResult.data.errors.some(x=>x.includes('expired')));
const absentHeartbeat={...e1,body:e1.body.split('\n').filter(x=>!x.startsWith('Pri-Lease-')).join('\n')};
verify('Missing explicit heartbeat rejected',checkLedger('missing-beat.json',[absentHeartbeat],absentHeartbeat).code!==0);
const staleAdmission=run(['admit',file('stale-candidate.json',{id:'separate',agent:'student-experience',status:'ACTIVE',branch:'agent/mission/student-experience/separate',base_sha:sha,risk:'R2',paths:[student]}),file('stale-input.json',[oldComment])]);
verify('Admission and ledger both reject stale writers',staleAdmission.code!==0&&staleAdmission.data.reason==='LEDGER_INVALID');
const future={...e1,body:e1.body.replace(/Pri-Lease-Heartbeat-At: .+/, 'Pri-Lease-Heartbeat-At: '+new Date(now.getTime()+60000).toISOString())};
verify('Future-dated heartbeat invalid',checkLedger('future.json',[future],future).code!==0);
const wrongOwnerHeartbeat={...e1,body:e1.body.replace('Pri-Lease-Heartbeat-By: india-curriculum','Pri-Lease-Heartbeat-By: qa-release')};
verify('Another agent cannot renew heartbeat',checkLedger('foreign-beat.json',[wrongOwnerHeartbeat],wrongOwnerHeartbeat).code!==0);
const project={number:174,state:'open',title:'[PRI-PROJECT] state',updated_at:at(),body:markers('project','india-curriculum','agent/mission/india-curriculum/project','ACTIVE',[india])};
const projectRes=checkLedger('exclude-project.json',[project,reviewer],reviewer);
verify('Project ledger does not become writer',projectRes.code===0&&projectRes.data.active_count===0);

const closed=make(172,'historic','student-experience','ACTIVE',[student],'closed');
const closedResult=checkLedger('closed-history.json',[closed,reviewer],reviewer);
verify('Closed historical writer ignored',closedResult.code===0&&closedResult.data.active_count===0);
verify('Closed historical writer audited',closedResult.data.warnings.some(x=>x.includes('closed issue #172')));
const two=checkLedger('two-valid.json',[e1,e2],e1);
verify('Two valid disjoint writers accepted by ledger',two.code===0&&two.data.active_count===2);
const same=make(901,'same-owner','india-curriculum','ACTIVE',['client/src/engine/ncert/jee-2026-complex-original-blind.js']);
const pair=checkLedger('same-owner.json',[e1,same],e1);
verify('Same owner pair rejected',pair.code!==0&&pair.data.errors.some(x=>x.includes('OWNER_NOT_DISTINCT')));
const third=make(902,'third','math-reasoning','ACTIVE',['client/src/engine/misconceptions.js']);
const triple=checkLedger('three.json',[e1,e2,third],e1);
verify('Three writers violate cap',triple.code!==0&&triple.data.errors.some(x=>x.includes('writer leases, found 3')));
const candidate={id:'third',agent:'math-reasoning',status:'ACTIVE',branch:'agent/mission/math-reasoning/third',base_sha:sha,risk:'R3',paths:['client/src/engine/misconceptions.js']};
const cap=run(['admit',file('candidate.json',candidate),file('admission-two.json',[e1,e2])]);
verify('Third admission denied',cap.code!==0&&cap.data.decision==='DENY'&&cap.data.reason==='WRITER_CAP');
const singleAdmission=run(['admit',file('candidate2.json',candidate),file('empty.json',[])]);
verify('Standalone admission fail-closed without serialization',singleAdmission.code!==0&&singleAdmission.data.reason==='SERIALIZED_ADMISSION_REQUIRED');
const mismatch=run(['validate-ledger',file('mismatch-issues.json',[e1]),'india-curriculum','class9','agent/mission/india-curriculum/wrong-branch','R3',ref]);
verify('PR issue branch mismatch rejected',mismatch.code!==0&&mismatch.data.errors.some(x=>x.includes('branch marker')));
const wrongReviewHead=run(['validate-ledger',file('wrong-head.json',[reviewer]),...Object.values(expected(reviewer)),sha]);
verify('Review head drift rejected',wrongReviewHead.code!==0&&wrongReviewHead.data.errors.some(x=>x.includes('review head')));
const writerDrift=run(['validate-ledger',file('writer-head-mismatch.json',[e1]),...Object.values(expected(e1)),sha]);
verify('Active heartbeat ref must match current PR head',writerDrift.code!==0&&writerDrift.data.errors.some(x=>x.includes('active progress reference')));
const unknown={...e1,state:undefined};
verify('Unknown issue state fails closed',checkLedger('state-unknown.json',[unknown],unknown).code!==0);
const invalidStatus={...e1,body:e1.body.replace('Pri-Mission-Status: ACTIVE','Pri-Mission-Status: ALMOST_DONE')};
verify('Unknown mission status must fail closed',checkLedger('status-unknown.json',[invalidStatus],invalidStatus).code!==0);
const forbiddenTarget={...e1,body:e1.body.replace('Pri-Mission-Status: ACTIVE','Pri-Mission-Status: TRIAGED')};
const invalidPR=checkLedger('triaged-target.json',[forbiddenTarget],forbiddenTarget);
verify('TRIAGED target cannot validate an autonomous PR',invalidPR.code!==0&&invalidPR.data.errors.some(x=>x.includes('not eligible')));
const duplicateReview={...reviewer,number:484};
verify('Duplicate mission identities fail closed',checkLedger('dup-ids.json',[reviewer,duplicateReview],reviewer).code!==0);


const baseRecord={id:'cbse',status:'REVIEW',agent:'india-curriculum',branch:'agent/mission/india-curriculum/cbse',risk:'R3',base_sha:sha,attempt:0,acceptance:['approved original questions'],required_gate_ids:['india'],updated_at:at(),failure_fingerprint:null};
const expiredWriter={...baseRecord,status:'ACTIVE',lease_heartbeat_at:at(13),lease_heartbeat_ref:ref,lease_heartbeat_by:'india-curriculum'};
const expiredTransition=run(['transition',file('stale-writer.json',expiredWriter),'IMPLEMENTING']);
verify('Expired writer may not continue into implementation',expiredTransition.code!==0&&expiredTransition.data.errors.some(x=>x.includes('SIGNED_SERIALIZED_GOVERNOR_LEASE_REQUIRED')));
const transition=run(['transition',file('review-record.json',baseRecord),'REPAIR_PENDING']);
verify('Reviewer can request repair without occupying writer slot',transition.code===0&&transition.data.status==='REPAIR_PENDING');
const reacquire=run(['transition',file('repair-record.json',transition.data),'ACTIVE']);
verify('Transitions cannot falsely reacquire writer',reacquire.code!==0&&reacquire.data.errors.some(x=>x.includes('SERIALIZED_ADMISSION_REQUIRED')));
const invalidNew=run(['validate-record',file('needs-beat.json',{...baseRecord,status:'ACTIVE'})]);
verify('New code writing cannot proceed without explicit heartbeat',invalidNew.code!==0);
const safeLease=run(['lease-status',file('review-record-2.json',baseRecord)]);
verify('REVIEW does not itself hold writer lease',safeLease.code!==0);
const legacyActive={...baseRecord,status:'ACTIVE'};
const safeRelease=run(['transition',file('legacy-active.json',legacyActive),'REVIEW']);
verify('Legacy active without heartbeat can relinquish writer slot',safeRelease.code===0&&safeRelease.data.status==='REVIEW');
const invalidAcquire=run(['transition',file('legacy-to-repair.json',legacyActive),'IMPLEMENTING']);
verify('Legacy missing heartbeat cannot continue writing',invalidAcquire.code!==0);
const common={base_sha:sha,risk:'R3',status:'ACTIVE'};
const left={...common,id:'owned-a',agent:'india-curriculum',branch:'agent/mission/india-curriculum/owned-a',paths:[india],dependencies:[]};
const dep={...common,id:'owned-b',agent:'student-experience',branch:'agent/mission/student-experience/owned-b',paths:[student],dependencies:['owned-a']};
const dependentPair=run(['can-run-concurrently',file('dep-left.json',left),file('dep-right.json',dep)]);
verify('Dependency edges remain non-concurrent',dependentPair.code!==0&&dependentPair.data.reason==='DEPENDENCY_EDGE');
const changedBase={...dep,dependencies:[],base_sha:'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'};
const otherBase=run(['can-run-concurrently',file('base-left.json',left),file('base-right.json',changedBase)]);
verify('Different baselines remain non-concurrent',otherBase.code!==0&&otherBase.data.reason==='BASE_SHA_MISMATCH');
const derivedA={...left,paths:['client/src/notes/data/notes-class8.js','ios/PriLearning.swiftpm/Resources/Web/a.js']};
const derivedB={...dep,dependencies:[],paths:[student,'ios/PriLearning 2.swiftpm/Resources/Web/b.js']};
const derivedPair=run(['can-run-concurrently',file('derived-left.json',derivedA),file('derived-right.json',derivedB)]);
verify('Shared native derived-artifact root remains exclusive',derivedPair.code!==0&&derivedPair.data.reason==='SHARED_DERIVED_ROOT');
const serial={...common,id:'fleet-edit',agent:'qa-release',branch:'agent/mission/qa-release/fleet-edit',paths:['.pri-os/mission-control.json'],dependencies:[]};
const serialPair=run(['can-run-concurrently',file('serial-left.json',serial),file('serial-right.json',dep)]);
verify('Global governance paths cannot be concurrent',serialPair.code!==0&&serialPair.data.reason==='SERIAL_GLOBAL_AUTHORITY');
const concurrent=await Promise.all([1,2,3].map(async i=>{
  try{await execAsync(process.execPath,[control,'admit',file('racecandidate'+i+'.json',candidate),file('raceempty'+i+'.json',[])]);return 'ALLOW';}
  catch(e){const x=JSON.parse(e.stdout);return x.reason;}
}));
verify('Concurrent stale-snapshot admissions all deny',concurrent.every(x=>x==='SERIALIZED_ADMISSION_REQUIRED'));

const missingId={...e1,number:995,body:e1.body.replace(/^Pri-Mission-ID:.*\n/m,'')};
const missingResult=checkLedger('missing-id.json',[reviewer,missingId],reviewer);
verify('Managed mission missing ID remains inventoried and blocks',missingResult.code!==0&&missingResult.data.managed_count===2&&missingResult.data.errors.some(x=>x.includes('malformed required marker Pri-Mission-ID')));
const badSyntaxId={...e1,number:994,body:e1.body.replace(/^Pri-Mission-ID:.*$/m,'Pri-Mission-ID: ../unsafe/mission')};
verify('Malformed noncanonical mission ID syntax fails closed',checkLedger('bad-syntax-id.json',[reviewer,badSyntaxId],reviewer).data.errors.some(x=>x.includes('malformed mission ID syntax')));
const blankId={...e1,number:996,body:e1.body.replace(/^Pri-Mission-ID:.*$/m,'Pri-Mission-ID: ')};
verify('Blank mission ID fails closed',checkLedger('blank-id.json',[reviewer,blankId],reviewer).code!==0);
const duplicateIdMarker={...e1,number:997,body:e1.body+'\nPri-Mission-ID: hidden-shadow'};
verify('Duplicate ID marker blocks ledger',checkLedger('double-id-marker.json',[reviewer,duplicateIdMarker],reviewer).data.errors.some(x=>x.includes('malformed required marker Pri-Mission-ID')));
const duplicateCase={...e1,number:998,body:e1.body+'\nPRI-MISSION-ID: alternate'};
verify('Case-insensitive duplicate ID marker rejected',checkLedger('case-id-marker.json',[reviewer,duplicateCase],reviewer).code!==0);
const duplicateStatus={...e1,number:999,body:e1.body+'\nPri-Mission-Status: REVIEW'};
verify('Duplicate status marker blocks ledger',checkLedger('double-status.json',[reviewer,duplicateStatus],reviewer).data.errors.some(x=>x.includes('malformed required marker Pri-Mission-Status')));
const duplicateHead={...reviewer,number:999,body:reviewer.body+'\nPri-Review-Head: '+sha};
verify('Duplicate review head marker fails closed',checkLedger('double-review-head.json',[duplicateHead],duplicateHead).code!==0);
const duplicateHeartbeat={...e1,number:1000,body:e1.body+'\nPri-Lease-Heartbeat-At: '+at()};
verify('Duplicate lease heartbeat rejected',checkLedger('double-heartbeat.json',[reviewer,duplicateHeartbeat],reviewer).code!==0);
const missingStatus={...e1,number:1001,body:e1.body.replace(/^Pri-Mission-Status:.*\n/m,'')};
verify('Missing status marker is not silently ignored',checkLedger('missing-status.json',[reviewer,missingStatus],reviewer).data.errors.some(x=>x.includes('malformed required marker Pri-Mission-Status')));
const untrustedState={...e1,number:1002,state:'reopened'};
verify('Malformed GitHub issue state denies ledger',checkLedger('bad-issue-state.json',[reviewer,untrustedState],reviewer).code!==0);
const closedMalformed={number:1003,state:'closed',title:'[PRI-MISSION] old malformed',body:'Pri-Mission-Status: ACTIVE',updated_at:at()};
verify('Closed historical incomplete markers do not consume writer capacity',checkLedger('closed-malformed.json',[closedMalformed,reviewer],reviewer).code===0);
const noHead=run(['validate-ledger',file('head-omitted.json',[reviewer]),...Object.values(expected(reviewer))]);
verify('PR validator requires exact head argument',noHead.code!==0);
const shortHead=run(['validate-ledger',file('head-short.json',[reviewer]),...Object.values(expected(reviewer)),'abcd1234']);
verify('PR validator rejects short head SHA',shortHead.code!==0);
const spoofed={...e1,body:e1.body.replace(/^Pri-Lease-Heartbeat-Ref:.*$/m,'Pri-Lease-Heartbeat-Ref: '+'b'.repeat(40))};
const spoofResult=run(['admit',file('spoof-candidate.json',{id:'student-new',agent:'student-experience',status:'ACTIVE',branch:'agent/mission/student-experience/student-new',base_sha:sha,risk:'R2',paths:[student],dependencies:[]}),file('spoof-ledger.json',[spoofed])]);
verify('Forged-looking heartbeat is snapshot-eligible but blocked by serialized-admission requirement',spoofResult.code!==0&&spoofResult.data.decision==='DENY'&&spoofResult.data.reason==='SERIALIZED_ADMISSION_REQUIRED'&&spoofResult.data.eligible_on_snapshot===true);
console.log(`PASS: ${checks} deterministic governance regression assertions (isolated proposal; no GitHub write)`);

const editableHeartbeat={...baseRecord,status:'ACTIVE',lease_heartbeat_at:at(),lease_heartbeat_ref:ref,lease_heartbeat_by:'india-curriculum'};
const unsignedStatus=run(['lease-status',file('editable-heartbeat.json',editableHeartbeat)]);
verify('Fresh editable issue heartbeat cannot establish lease authority',unsignedStatus.code!==0&&unsignedStatus.data.reason==='SIGNED_SERIALIZED_GOVERNOR_LEASE_REQUIRED');
