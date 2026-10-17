import assert from 'node:assert/strict';
import {manualDecision} from '../../scripts/pri-manual-authorization.mjs';
const head='a'.repeat(40);
const pr={state:'open',changed_files:1,user:{login:'Priysharan19',type:'User'},
 head:{ref:'task/p0-fix',sha:head,repo:{full_name:'Priysharan19/Final-Pri-learning'}},
 base:{ref:'main',repo:{full_name:'Priysharan19/Final-Pri-learning'}}};
const validReview={user:{login:'Kalp-Bajpai',type:'User'},state:'APPROVED',commit_id:head,submitted_at:'2026-10-14T12:00:00Z'};
const basic={pr,headSha:head,reviews:[validReview],
 permissions:{Priysharan19:'admin','Kalp-Bajpai':'write'},
 files:[{status:'modified',filename:'client/src/pages/Home.jsx'}]};
const run=(name,data,expected)=>{
  const result=manualDecision(data);
  assert.equal(result.authorized,expected,name+' '+JSON.stringify(result));
  return result;
};
let n=0;
run('valid human reviewer',basic,true);n++;
run('task prefix without review',{...basic,reviews:[]},false);n++;
run('feature prefix without review',{...basic,pr:{...pr,head:{...pr.head,ref:'feature/pretend-human'}},reviews:[]},false);n++;
run('author lacks write permission',{...basic,permissions:{...basic.permissions,Priysharan19:'read'}},false);n++;
run('reviewer lacks write permission',{...basic,permissions:{...basic.permissions,'Kalp-Bajpai':'read'}},false);n++;
run('self approval',{...basic,reviews:[{...validReview,user:{login:'Priysharan19',type:'User'}}]},false);n++;
run('stale approval',{...basic,reviews:[{...validReview,commit_id:'b'.repeat(40)}]},false);n++;
run('comment after approval remains valid',{...basic,reviews:[validReview,{...validReview,state:'COMMENTED',submitted_at:'2026-10-14T12:01:00Z'}]},true);n++;
run('dismissed after approval',{...basic,reviews:[validReview,{...validReview,state:'DISMISSED',submitted_at:'2026-10-14T12:01:00Z'}]},false);n++;
run('fake bot',{...basic,reviews:[{...validReview,user:{login:'Kalp-Bajpai',type:'Bot'}}]},false);n++;
run('fork candidate',{...basic,pr:{...pr,head:{...pr.head,repo:{full_name:'another/repo'}}}},false);n++;
run('sensitive approval from unauthorised reviewer',{...basic,files:[{status:'modified',filename:'.github/workflows/pri-agent-governance.yml'}],
 reviews:[{...validReview,user:{login:'OtherReviewer',type:'User'}}],
 permissions:{...basic.permissions,OtherReviewer:'write'}},false);n++;
run('sensitive approval from Kalp',{...basic,files:[{status:'modified',filename:'.github/workflows/pri-agent-governance.yml'}]},true);n++;
run('missing changed-file snapshot',{...basic,files:[]},false);n++;

// A rename checks its historical source, not only the innocent-looking target.
const nonSecurityApprover={...validReview,user:{login:'OtherReviewer',type:'User'}};
const nonSecurityPermissions={...basic.permissions,OtherReviewer:'write'};
const renamed={status:'renamed',filename:'client/src/pages/Home.jsx',
  previous_filename:'.github/workflows/pri-agent-governance.yml'};
const copied={...renamed,status:'copied'};
const otherReviewer={...basic,reviews:[nonSecurityApprover],
  permissions:nonSecurityPermissions};
run('rename from security path requires security approver',
  {...otherReviewer,files:[renamed]},false);n++;
run('copy from security path requires security approver',
  {...otherReviewer,files:[copied]},false);n++;
run('security approval covers source AND target of rename',
  {...basic,files:[renamed]},true);n++;
run('renamed file without old path denied',
  {...basic,files:[{status:'renamed',filename:'client/src/pages/Home.jsx'}]},false);n++;
run('copied file without old path denied',
  {...basic,files:[{status:'copied',filename:'client/src/pages/Home.jsx'}]},false);n++;
run('malformed prior path denied',
  {...basic,files:[{...renamed,previous_filename:'../.github/workflows/secret.yml'}]},false);n++;
run('backslash path denied',
  {...basic,files:[{status:'modified',filename:'client\\\\src/pages/Home.jsx'}]},false);n++;
run('missing status denied',
  {...basic,files:[{filename:'client/src/pages/Home.jsx'}]},false);n++;
run('unexpected historical metadata denied',
  {...basic,files:[{status:'modified',filename:'client/src/pages/Home.jsx',
    previous_filename:'.github/workflows/pri-agent-governance.yml'}]},false);n++;
run('sensitive file deletion needs security approval',
  {...otherReviewer,files:[{status:'removed',filename:'.pri-os/mission-control.json'}]},false);n++;
console.log('PASS: '+n+' manual-lane authorization regressions');
