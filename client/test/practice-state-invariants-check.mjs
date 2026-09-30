// PRI-02 — deterministic learning-state invariants.
import assert from 'node:assert/strict';
import { installBrowserEnv, resetStorage } from './backend-check.mjs';

installBrowserEnv(); resetStorage();
const { api } = await import('../src/api.js');
const idb = await import('../src/local/idb.js');
const { checkAnswer } = await import('../src/engine/checker.js');
const { loadAllBanks } = await import('../src/engine/generators/index.js');
const { cloudLinkRowId } = await import('../src/platform/cloudAccount.js');
await loadAllBanks();

function canonical(q) {
  const a=q?.answer; if(!a) return null;
  if(a.canonicalInput!==undefined) return String(a.canonicalInput);
  if(q.answerType==='numeric') {
    if(a.surdForm) return `${a.surdForm.k===1?'':a.surdForm.k===-1?'-':a.surdForm.k}sqrt(${a.surdForm.r})`;
    if(a.simplestFraction) return `${a.simplestFraction.n}/${a.simplestFraction.d}`;
    if(a.requireExact) return null; return String(a.value);
  }
  if(q.answerType==='expression') return a.expr;
  if(q.answerType==='mcq') return String(a.correctIndex);
  if(q.answerType==='set') return a.values.join(', ');
  if(q.answerType==='point') return `(${a.x}, ${a.y})`;
  if(q.answerType==='ratio') return `${a.a}:${a.b}`;
  if(q.answerType==='working') return a.canonicalWorking ?? null;
  return null;
}
async function rightFor(id){ const row=await idb.get('questions',id); const x=canonical(row?.payload); return x!==null&&checkAnswer(row.payload,x).correct?x:null; }
async function resolveAny(body={}){
  for(let i=0;i<40;i++){
    const s=await api.post('/practice/next',{...body,resume:true}); const right=await rightFor(s.question.id);
    if(right!==null){ const r=await api.post(`/practice/${s.question.id}/submit`,{answer:right,ms:900}); assert.equal(r.resolved,true); return {served:s,result:r}; }
    const r=await api.post(`/practice/${s.question.id}/reveal`,{ms:900}); assert.equal(r.resolved,true);
  }
  throw new Error('No answerable question found');
}
async function snap(pid,topic=null){
  const me=(await api.get('/me')).user, attempts=await idb.byIndex('attempts','pid',pid), stats=await api.get('/stats');
  const rating=topic?await idb.get('ratings',`${pid}:${topic}`):null;
  return {xp:me.xp,today:me.today.questions,attempts:attempts.length,stats:stats.totals.attempts,rating:rating?.attempts||0,usage:me.usage};
}
async function expect409(p){ try{await p;}catch(e){assert.equal(e.status,409);return;} assert.fail('expected 409'); }

const free=(await api.post('/profiles',{name:'PRI-02 Free',year:10})).user;
const used0=(await api.get('/me')).user.usage.practice.used;
const [n1,n2]=await Promise.all([api.post('/practice/next',{resume:true}),api.post('/practice/next',{resume:true})]);
assert.equal(n1.question.id,n2.question.id); assert.equal(n2.resumed,true);
assert.equal((await api.get('/me')).user.usage.practice.used,used0+1);
assert.equal((await idb.byIndex('questions','pid',free.id)).filter(q=>!q.answered).length,1);
assert.equal((await api.post('/practice/next',{resume:true})).question.id,n1.question.id);
assert.equal((await api.get('/me')).user.usage.practice.used,used0+1);

const r0=await rightFor(n1.question.id); if(r0===null) await api.post(`/practice/${n1.question.id}/reveal`,{}); else await api.post(`/practice/${n1.question.id}/submit`,{answer:r0});
const seed=await api.post('/practice/next',{resume:true}), topic=seed.question.subtopic, rs=await rightFor(seed.question.id);
if(rs===null) await api.post(`/practice/${seed.question.id}/reveal`,{}); else await api.post(`/practice/${seed.question.id}/submit`,{answer:rs});

let raceQ=await api.post('/practice/next',{mode:'topic',subtopic:topic,resume:true}), raceRight=await rightFor(raceQ.question.id);
while(raceRight===null){ await api.post(`/practice/${raceQ.question.id}/reveal`,{}); raceQ=await api.post('/practice/next',{mode:'topic',subtopic:topic,resume:true}); raceRight=await rightFor(raceQ.question.id); }
const pre=await snap(free.id,topic);
const raced=await Promise.allSettled([api.post(`/practice/${raceQ.question.id}/submit`,{answer:raceRight,ms:700}),api.post(`/practice/${raceQ.question.id}/submit`,{answer:raceRight,ms:700})]);
assert.equal(raced.filter(x=>x.status==='fulfilled').length,1); assert.equal(raced.filter(x=>x.status==='rejected'&&x.reason?.status===409).length,1);
const win=raced.find(x=>x.status==='fulfilled').value, post=await snap(free.id,topic);
assert.equal(post.attempts,pre.attempts+1); assert.equal(post.stats,pre.stats+1); assert.equal(post.today,pre.today+1); assert.equal(post.rating,pre.rating+1); assert.equal(post.xp,pre.xp+win.xp);
await expect409(api.post(`/practice/${raceQ.question.id}/submit`,{answer:raceRight,ms:700})); assert.deepEqual(await snap(free.id,topic),post);

let qr=await api.post('/practice/next',{mode:'topic',subtopic:topic,resume:true}), rr=await rightFor(qr.question.id);
while(rr===null){ await api.post(`/practice/${qr.question.id}/reveal`,{}); qr=await api.post('/practice/next',{mode:'topic',subtopic:topic,resume:true}); rr=await rightFor(qr.question.id); }
const ar0=(await idb.byIndex('attempts','pid',free.id)).length;
const mixed=await Promise.allSettled([api.post(`/practice/${qr.question.id}/submit`,{answer:rr}),api.post(`/practice/${qr.question.id}/reveal`,{})]);
assert.equal(mixed.filter(x=>x.status==='fulfilled').length,1); assert.equal(mixed.filter(x=>x.status==='rejected'&&x.reason?.status===409).length,1);
assert.equal((await idb.byIndex('attempts','pid',free.id)).length,ar0+1);

while(((await idb.get('ratings',`${free.id}:${topic}`))?.attempts||0)<4) await resolveAny({mode:'topic',subtopic:topic});
const rb=await idb.get('ratings',`${free.id}:${topic}`), vb=await idb.get('reviews',`${free.id}:${topic}`), hb=await api.post('/history/list',{pageSize:100}), sb=await api.get('/stats');
assert.ok(rb?.attempts>=4); assert.ok(vb);
await api.post('/auth/logout'); await api.post('/profiles/select',{id:free.id});
assert.deepEqual(await idb.get('ratings',`${free.id}:${topic}`),rb); assert.deepEqual(await idb.get('reviews',`${free.id}:${topic}`),vb);
assert.equal((await api.post('/history/list',{pageSize:100})).total,hb.total); assert.deepEqual((await api.get('/stats')).totals,sb.totals);
await resolveAny({mode:'topic',subtopic:topic});

const freeOpen=await api.post('/practice/next',{resume:true});
const other=(await api.post('/profiles',{name:'PRI-02 Other',year:10})).user, otherOpen=await api.post('/practice/next',{resume:true});
assert.notEqual(otherOpen.question.id,freeOpen.question.id);
try{await api.post(`/practice/${freeOpen.question.id}/reveal`,{});assert.fail('cross-profile resolve');}catch(e){assert.equal(e.status,404);}
assert.equal((await api.post('/practice/next',{resume:true})).question.id,otherOpen.question.id);
await api.post('/profiles/select',{id:free.id}); assert.equal((await api.post('/practice/next',{resume:true})).question.id,freeOpen.question.id);

const premium=(await api.post('/profiles',{name:'PRI-02 Premium',year:10})).user, now=Date.now();
await idb.put('device',{id:cloudLinkRowId(premium.id),accountId:`acct-${premium.id}`,role:'student',emailVerified:true,linkedAt:now,lastVerifiedAt:now,lastSyncAt:null,entitlement:{plan:'premium',status:'active',provider:'web',currentPeriodEnd:now+30*86400000,offlineUntil:now+7*86400000,issuedAt:now,sourceVersion:1}});
const ps=await snap(premium.id); await resolveAny(); await resolveAny(); const pe=await snap(premium.id);
assert.equal(pe.attempts,ps.attempts+2); assert.equal(pe.today,ps.today+2);

const stored=await idb.get('profiles',premium.id), claim=`${premium.id}:rollback-claim`, xp0=stored.xp||0;
const attempt={id:claim,pid:premium.id,questionId:'rollback-seed',subtopic:'rollback',difficulty:1,correct:1,ms:1,hintsUsed:0,mode:'practice',viaInk:false,ratingBefore:1000,ratingAfter:1001,createdAt:now};
await idb.atomicBatch([{type:'add',store:'attempts',value:attempt}]);
await assert.rejects(idb.atomicBatch([{type:'add',store:'attempts',value:{...attempt,questionId:'rollback-duplicate'}},{type:'put',store:'profiles',value:{...stored,xp:xp0+9999}}]));
assert.equal((await idb.get('profiles',premium.id)).xp||0,xp0);
console.log('PASS — PRI-02 state invariants: resume, duplicate Next, exactly-once submit/reveal, retry, adaptive persistence, profile isolation, free/premium, atomic rollback.');
