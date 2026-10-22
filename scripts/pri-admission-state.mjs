#!/usr/bin/env node
// Trusted-controller core. Imported by protected main workflow, never by PR code.
// A GitHub issue body or comment is never a grant. Only a signed, hash-chained
// event committed through the protected serialized ref can hold a writer lease.
import { createHash, sign, verify, randomUUID } from 'node:crypto';

const WRITERS = new Set(['ACTIVE', 'IMPLEMENTING', 'TESTING', 'REPAIR']);
const REVIEWING = new Set(['REVIEW', 'CI', 'MERGE_READY']);
const STATES = new Set(['DISCOVERED','TRIAGED','ACTIVE','IMPLEMENTING','TESTING',
  'REVIEW','CI','REPAIR_PENDING','REPAIR','MERGE_READY','BLOCKED_EXTERNAL',
  'BLOCKED_AUTOMATION','DONE','ABANDONED']);
const MAX_WRITERS = 2;
const REPOSITORY = 'Priysharan19/Final-Pri-learning';
const POLICY_VERSION = 1;
const SIGNER_ID = 'pri-writer-governor-v1';
const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const validPath = x => typeof x === 'string' && !!x && !x.startsWith('/') && !x.includes('\\') && !x.includes('//') && x.split('/').every(y => y && y !== '.' && y !== '..');
const staticPrefix = x => x.slice(0, x.search(/[?*]/) < 0 ? x.length : x.search(/[?*]/));
const pathOverlap = (a,b) => a===b || ((a.includes('*') || a.includes('?') || b.includes('*') || b.includes('?')) && (staticPrefix(a).startsWith(staticPrefix(b)) || staticPrefix(b).startsWith(staticPrefix(a))));
const serial = x => /^(?:\.pri-os\/|\.github\/workflows\/|scripts\/pri-|AGENTS\.md$|Dockerfile$|(?:client\/)?package(?:-lock)?\.json$)/.test(x);
const conflictingScopes = (a,b) => a.some(x => b.some(y => pathOverlap(x,y) || serial(x) || serial(y)));
const TTL_MS = 12 * 3600 * 1000;
const sha = text => createHash('sha256').update(text).digest('hex');
const sorted = v => Array.isArray(v) ? v.map(sorted) :
  v && typeof v === 'object' ? Object.fromEntries(Object.keys(v).sort().map(k => [k, sorted(v[k])])) : v;
const canonical = x => JSON.stringify(sorted(x));
const hex40 = x => /^[0-9a-f]{40}$/i.test(String(x || ''));
// Literal line-key matching avoids dynamically constructing regular expressions
// from input-controlled marker names (and escaping ambiguities).
const marker = (body, key) => {
  const prefix = `${key}:`.toLowerCase();
  const values = String(body || '').split('\n').filter(line =>
    line.toLowerCase().startsWith(prefix)).map(line => line.slice(prefix.length).trim());
  if (values.length !== 1 || !values[0]) throw new Error('MISSING_OR_DUPLICATE_' + key);
  return values[0];
};
const optionalMarker = (body,key) => {
  const matches = String(body || '').split('\n').filter(line => line.toLowerCase().startsWith((key+':').toLowerCase()));
  if (matches.length > 1) throw new Error('DUPLICATE_' + key);
  return matches.length ? matches[0].slice(key.length+1).trim() : '';
};
const asPaths = v => {
  if (!v || v === 'none') return [];
  try { const data = JSON.parse(v); if (Array.isArray(data)) return data.map(String); } catch {}
  return v.split(',').map(x => x.trim()).filter(Boolean);
};
export const eventDigest = payload => sha(canonical(payload));
export async function verifyAuthorityHistory({head,genesisSha,loadCommit,loadLog,filePath}) {
  if (!hex40(head) || !hex40(genesisSha) || typeof loadCommit !== 'function' ||
      typeof loadLog !== 'function' || !filePath)
    throw new Error('AUTHORITY_GENESIS_NOT_PINNED');
  let cursor=head, child=null, latest=null;
  const seen=new Set();
  for(let n=0;n<1000;n++) {
    if(seen.has(cursor)) throw new Error('AUTHORITY_HISTORY_CYCLE');
    seen.add(cursor);
    const commit=await loadCommit(cursor);
    if(!commit || !Array.isArray(commit.parents) || commit.parents.length!==1 ||
        !Array.isArray(commit.files) || commit.files.length!==1 ||
        commit.files[0].filename!==filePath)
      throw new Error('AUTHORITY_HISTORY_CONTAINS_UNTRUSTED_CHANGE');
    const entry=await loadLog(cursor);
    if (!entry || entry.version!==1 || !Array.isArray(entry.events))
      throw new Error('INVALID_AUTHORITY_LOG');
    if(child) assertAppendOnlyHistory(child,entry);
    if(!latest) latest=entry;
    if(cursor===genesisSha) {
      if(entry.events.length!==0) throw new Error('NONEMPTY_PINNED_AUTHORITY_GENESIS');
      return {log:latest,head,genesisSha,commitsChecked:seen.size};
    }
    if(entry.events.length===0) throw new Error('UNPINNED_EMPTY_AUTHORITY_LOG');
    child=entry;
    cursor=commit.parents[0].sha;
    if(!hex40(cursor)) throw new Error('INVALID_AUTHORITY_PARENT_SHA');
  }
  throw new Error('PINNED_AUTHORITY_GENESIS_UNREACHABLE');
}

export function assertAppendOnlyHistory(child, parent) {
  if (!child || !parent || child.version !== 1 || parent.version !== 1 ||
    !Array.isArray(child.events) || !Array.isArray(parent.events) ||
    child.events.length !== parent.events.length + 1 ||
    canonical(child.events.slice(0,-1)) !== canonical(parent.events))
    throw new Error('NON_APPEND_ONLY_AUTHORITY_HISTORY');
  return true;
}
export function signEvent(payload, privateKey) {
  return {payload, signature: sign(null, Buffer.from(canonical(payload)), privateKey).toString('base64')};
}
export function inspectSignedLog(log, publicKey, nowMs = Date.now()) {
  if (!log || log.version !== 1 || !Array.isArray(log.events)) throw new Error('INVALID_AUTHORITY_LOG');
  const active = new Map();
  const usedGrants = new Set();
  const released = new Map(), invalidated = new Map();
  let prev = '0'.repeat(64), index = 0, lastTimestamp = 0;
  for (const entry of log.events) {
    if (!entry || !entry.payload || typeof entry.signature !== 'string') throw new Error('INVALID_GRANT_EVENT');
    const p = entry.payload;
    if (p.seq !== ++index || p.prev !== prev || !['GRANT','RENEW','RELEASE','REVOKE'].includes(p.operation))
      throw new Error('BROKEN_EVENT_CHAIN');
    if (!verify(null, Buffer.from(canonical(p)), publicKey, Buffer.from(entry.signature, 'base64')))
      throw new Error('INVALID_EVENT_SIGNATURE');
    if (p.repository !== REPOSITORY || p.policy_version !== POLICY_VERSION || p.signer_id !== SIGNER_ID || !UUID_V4.test(p.grant_id || '')) throw new Error('INVALID_GRANT_DOMAIN');
    if (!Array.isArray(p.paths) || !p.paths.length || !p.paths.every(validPath) || new Set(p.paths).size !== p.paths.length) throw new Error('INVALID_SIGNED_PATH_SCOPE');
    if (!Number.isSafeInteger(p.timestamp_ms) || p.timestamp_ms < 0 || p.timestamp_ms > nowMs + 120000)
      throw new Error('INVALID_EVENT_TIME');
    if (p.timestamp_ms < lastTimestamp) throw new Error('NON_MONOTONIC_SIGNED_EVENT_TIME');
    lastTimestamp = p.timestamp_ms;
    if (!Number.isSafeInteger(p.run_id) || p.run_id <= 0 || !p.actor || !hex40(p.main_sha))
      throw new Error('INVALID_GOVERNOR_PROVENANCE');
    if (!Number.isInteger(p.issue_number) || p.issue_number < 1 || !p.mission || !p.agent || !p.branch)
      throw new Error('INVALID_GRANT_IDENTITY');
    if (p.operation === 'GRANT') {
      if (!/^R[1-4]$/.test(String(p.risk||''))) throw new Error('INVALID_SIGNED_RISK');
      if (!hex40(p.head_sha) || !hex40(p.base_sha) || !Array.isArray(p.paths) || !p.paths.length
        || !Number.isSafeInteger(p.expiry_ms) || p.expiry_ms - p.timestamp_ms > TTL_MS
        || p.expiry_ms <= p.timestamp_ms || active.has(p.issue_number)) throw new Error('INVALID_GRANT');
      if (usedGrants.has(p.grant_id)) throw new Error('REUSED_GRANT_ID');
      if (invalidated.has(p.issue_number)) throw new Error('REVOKED_MISSION_REGRANT_FORBIDDEN');
      usedGrants.add(p.grant_id);
      if ([...active.values(),...released.values()].some(g => g.mission===p.mission || g.branch===p.branch || g.grant_id===p.grant_id)) throw new Error('DUPLICATE_SIGNED_IDENTITY');
      active.set(p.issue_number, p);
    } else {
      const current = active.get(p.issue_number) || (p.operation==='REVOKE' ? released.get(p.issue_number) : null);
      if (!current || current.mission !== p.mission || current.agent !== p.agent || current.branch !== p.branch || current.grant_id !== p.grant_id)
        throw new Error('UNMATCHED_RENEW_OR_REVOKE');
      if (p.operation === 'REVOKE') {
        if (current.risk!==p.risk || current.base_sha!==p.base_sha ||
          current.main_sha!==p.main_sha || current.head_sha!==p.head_sha ||
          canonical(current.paths)!==canonical(p.paths))
          throw new Error('REVOKE_IDENTITY_OR_SOURCE_DRIFT');
        active.delete(p.issue_number);
        released.delete(p.issue_number);
        invalidated.set(p.issue_number,p);
      } else if (p.operation === 'RELEASE') {
        if (current.expiry_ms <= p.timestamp_ms || current.head_sha !== p.head_sha ||
          current.base_sha !== p.base_sha || current.main_sha !== p.main_sha ||
          current.risk !== p.risk || canonical(current.paths)!==canonical(p.paths))
          throw new Error('UNAUTHORIZED_SOURCE_RELEASE');
        active.delete(p.issue_number);
        released.set(p.issue_number,p);
      } else {
        if (!hex40(p.head_sha) || !Number.isSafeInteger(p.expiry_ms)
          || p.expiry_ms - p.timestamp_ms > TTL_MS || p.expiry_ms <= p.timestamp_ms
          || p.timestamp_ms > current.expiry_ms || p.base_sha !== current.base_sha
          || p.main_sha !== current.main_sha || p.risk !== current.risk || canonical(p.paths) !== canonical(current.paths))
          throw new Error('UNSAFE_RENEWAL');
        active.set(p.issue_number, p);
      }
    }
    // Historical safety is checked after EVERY signed transition at that event's
    // time. A later revocation cannot hide an earlier invalid over-allocation.
    const historical = [...active.values()].filter(g => g.expiry_ms > p.timestamp_ms);
    if (historical.length > MAX_WRITERS) throw new Error('HISTORICAL_WRITER_CAP');
    for (let i=0; i<historical.length; i++) for(let j=i+1;j<historical.length;j++) {
      if (historical[i].agent===historical[j].agent) throw new Error('HISTORICAL_OWNER_CONFLICT');
      if (conflictingScopes(historical[i].paths,historical[j].paths)) throw new Error('HISTORICAL_SCOPE_CONFLICT');
      if (historical[i].main_sha!==historical[j].main_sha || historical[i].base_sha!==historical[j].base_sha)
        throw new Error('HISTORICAL_BASE_CONFLICT');
    }
    prev = eventDigest(p);
  }
  const live = [...active.values()].filter(p => p.expiry_ms > nowMs);
  // Expiry removes write authority automatically, never the issue's audit history.
  if (live.length > MAX_WRITERS) throw new Error('WRITER_CAP');
  for (let i=0;i<live.length;i++) for (let j=i+1;j<live.length;j++) {
    if (live[i].agent === live[j].agent) throw new Error('OWNER_NOT_DISTINCT');
    if (conflictingScopes(live[i].paths,live[j].paths)) throw new Error('WRITER_SCOPE_CONFLICT');
    if (live[i].base_sha !== live[j].base_sha || live[i].main_sha !== live[j].main_sha)
      throw new Error('WRITER_BASE_MISMATCH');
  }
  return {nextSeq:index+1, prevHash:prev, active, live, released, invalidated};
}
export function issueIdentity(issue) {
  if (!issue || issue.state !== 'open' || !String(issue.title || '').startsWith('[PRI-MISSION]'))
    throw new Error('NON_MANAGED_ISSUE');
  return {
    issue_number: issue.number,
    mission: marker(issue.body,'Pri-Mission-ID'),
    status: marker(issue.body,'Pri-Mission-Status'),
    agent: marker(issue.body,'Pri-Agent'),
    branch: marker(issue.body,'Pri-Branch'),
    risk: marker(issue.body,'Pri-Risk'),
    base_sha: marker(issue.body,'Pri-Base-SHA'),
    paths: asPaths(optionalMarker(issue.body,'Pri-Paths'))
  };
}
export function assertLedgerMatchesGrants(issues, authority, mainSha, nowMs = Date.now(), options = {}) {
  if (!Array.isArray(issues) || !hex40(mainSha)) throw new Error('INCOMPLETE_GITHUB_LEDGER');
  const openIssues = issues.filter(x => !x.pull_request && x.state === 'open');
  for (const x of openIssues) if (/^Pri-Mission-ID:/mi.test(String(x.body || '')) &&
    !String(x.title || '').startsWith('[PRI-MISSION]') &&
    !(/^Pri-Agent: director$/mi.test(String(x.body || '')) &&
      /^Pri-Mission-Status: (BLOCKED_EXTERNAL|BLOCKED_AUTOMATION|DONE)$/mi.test(String(x.body || '')) &&
      !authority.active.has(x.number)))
    throw new Error('HIDDEN_MANAGED_ISSUE_' + x.number);
  const managed = openIssues.filter(x => String(x.title || '').startsWith('[PRI-MISSION]'));
  const seen = new Set(), seenMissions = new Set(), seenBranches = new Set();
  for (const x of managed) {
    const id = issueIdentity(x);
    if (!STATES.has(id.status)) throw new Error('UNKNOWN_MANAGED_ISSUE_STATUS_' + x.number);
    if (seen.has(id.issue_number)) throw new Error('DUPLICATE_ISSUE');
    if (seenMissions.has(id.mission)) throw new Error('DUPLICATE_MISSION_ID_'+id.mission);
    if (seenBranches.has(id.branch)) throw new Error('DUPLICATE_MISSION_BRANCH_'+id.branch);
    seen.add(id.issue_number); seenMissions.add(id.mission); seenBranches.add(id.branch);
    const current = authority.active.get(x.number);
    if (WRITERS.has(id.status)) {
      if (!current) throw new Error('WRITER_WITHOUT_AUTHORITY_' + x.number);
      if (options.revocationRecovery === true) {
        if (current.mission !== id.mission || current.agent !== id.agent || current.risk !== id.risk || current.branch !== id.branch ||
          canonical(current.paths) !== canonical(id.paths)) throw new Error('WRITER_AUTHORITY_DRIFT_' + x.number);
        continue;
      }
      if (current.expiry_ms <= nowMs) throw new Error('WRITER_WITHOUT_AUTHORITY_' + x.number);
      if (current.main_sha !== mainSha || current.base_sha !== id.base_sha ||
        current.mission !== id.mission || current.agent !== id.agent || current.risk !== id.risk ||
        current.branch !== id.branch || current.risk !== id.risk || canonical(current.paths) !== canonical(id.paths) ||
        marker(x.body,'Pri-Lease-Grant-ID') !== eventDigest(current))
        throw new Error('WRITER_AUTHORITY_DRIFT_' + x.number);
    } else if (REVIEWING.has(id.status)) {
      const source=authority.released.get(x.number);
      if (!source || authority.invalidated.has(x.number))
        throw new Error('REVIEW_WITHOUT_SIGNED_PROVENANCE_' + x.number);
      if (current && current.expiry_ms>nowMs) throw new Error('REVIEW_WITH_LIVE_WRITER_' + x.number);
      if (source.mission!==id.mission || source.agent!==id.agent || source.branch!==id.branch ||
        source.risk!==id.risk || source.base_sha!==id.base_sha ||
        canonical(source.paths)!==canonical(id.paths) ||
        marker(x.body,'Pri-Review-Head')!==source.head_sha ||
        marker(x.body,'Pri-Provenance-Event')!==eventDigest(source))
        throw new Error('REVIEW_PROVENANCE_DRIFT_' + x.number);
    } else if (current && current.expiry_ms > nowMs && options.revocationRecovery !== true) {
      throw new Error('LIVE_GRANT_WITH_NONWRITER_ISSUE_' + x.number);
    }
  }
  for (const grant of authority.live) if (!seen.has(grant.issue_number))
    throw new Error('MISSING_GRANTED_ISSUE_' + grant.issue_number);
  return {managed: managed.length, live_writers: authority.live.length};
}
export function appendGrant(log, request, issues, pr, mainSha, actor, runId, nowMs, privateKey, publicKey) {
  const authority=inspectSignedLog(log,publicKey,nowMs);
  assertLedgerMatchesGrants(issues,authority,mainSha,nowMs,{revocationRecovery:request.operation==='REVOKE'});
  const issue=issues.find(x=>x.number===request.issue_number);
  const id=issueIdentity(issue);
  if (!['GRANT','REVOKE','RENEW','RELEASE'].includes(request.operation)) throw new Error('INVALID_OPERATION');
  if (request.operation==='GRANT' && id.branch !== 'agent/mission/'+id.agent+'/'+id.mission) throw new Error('NONCANONICAL_GRANT_BRANCH');
  if (!hex40(mainSha) || (id.base_sha !== mainSha && request.operation!=='REVOKE')) throw new Error('BASE_SHA_MOVED');
  if (!Number.isSafeInteger(runId) || runId<=0 || !actor) throw new Error('ACTOR_REQUIRED');
  if (!pr || pr.number !== request.pr_number || pr.head?.ref !== id.branch
    || !hex40(pr.head?.sha) || pr.head.sha !== request.head_sha
    || pr.base?.ref !== 'main' || pr.base.sha !== mainSha || pr.state !== 'open')
    throw new Error('UNTRUSTED_PR_HEAD');
  const existing=authority.active.get(id.issue_number) || (request.operation==='REVOKE' ? authority.released.get(id.issue_number) : null);
  if (request.operation === 'GRANT') {
    if (!['TRIAGED','REPAIR_PENDING'].includes(id.status) || existing || authority.released.has(id.issue_number) || authority.invalidated.has(id.issue_number))
      throw new Error('WRITER_STATE_NOT_ADMISSIBLE');
    if (authority.live.length >= MAX_WRITERS) throw new Error('WRITER_CAP');
    if (authority.live.some(g => g.agent === id.agent)) throw new Error('OWNER_NOT_DISTINCT');
    if (authority.live.some(g => g.mission === id.mission || g.branch === id.branch)) throw new Error('DUPLICATE_SIGNED_IDENTITY');
    if (authority.live.some(g => conflictingScopes(g.paths,id.paths))) throw new Error('WRITER_SCOPE_CONFLICT');
    if (!id.paths.length || !id.paths.every(validPath)) throw new Error('INVALID_SIGNED_PATH_SCOPE');
  } else if (!existing || (['RENEW','RELEASE'].includes(request.operation) && (existing.expiry_ms <= nowMs || !WRITERS.has(id.status)))) {
    throw new Error('NO_LIVE_GRANT_TO_MODIFY');
  }
  if (existing && (existing.agent !== id.agent || existing.mission !== id.mission || existing.branch !== id.branch || existing.risk !== id.risk || canonical(existing.paths) !== canonical(id.paths)))
    throw new Error('AUTHORITY_IDENTITY_DRIFT');
  const payload={
    repository:REPOSITORY,policy_version:POLICY_VERSION,signer_id:SIGNER_ID,grant_id:existing?.grant_id||randomUUID(),
    seq:authority.nextSeq,prev:authority.prevHash,operation:request.operation,
    issue_number:id.issue_number,mission:id.mission,agent:id.agent,branch:id.branch,risk:id.risk,
    base_sha:id.base_sha,head_sha:request.head_sha,main_sha:mainSha,paths:id.paths,
    timestamp_ms:nowMs,expiry_ms:request.operation==='REVOKE'?nowMs:nowMs+TTL_MS,
    actor,run_id:runId
  };
  if (request.operation==='RELEASE' && id.status!=='TESTING')
    throw new Error('SOURCE_RELEASE_REQUIRES_TESTING_STATE');
  if (request.operation==='RELEASE' && existing.head_sha!==request.head_sha)
    throw new Error('RELEASE_REQUIRES_SIGNED_CHECKPOINT_HEAD');
  if (request.operation==='RENEW' && existing.head_sha===request.head_sha)
    throw new Error('RENEW_REQUIRES_NEW_EXACT_HEAD');
  return {version:1,events:[...log.events,signEvent(payload,privateKey)]};
}
export function revokeAuthoritativeGrant(log, issueNumber, actor, runId, nowMs, privateKey, publicKey) {
  const authority=inspectSignedLog(log,publicKey,nowMs);
  const prior=authority.active.get(issueNumber) || authority.released.get(issueNumber);
  if (!prior) throw new Error('UNKNOWN_AUTHORITY_GRANT');
  if (!actor || !Number.isSafeInteger(runId) || runId<=0)
    throw new Error('INVALID_REVOKER_IDENTITY');
  const payload={...prior,seq:authority.nextSeq,prev:authority.prevHash,
    operation:'REVOKE',timestamp_ms:nowMs,expiry_ms:nowMs,actor,run_id:runId};
  return {version:1,events:[...log.events,signEvent(payload,privateKey)]};
}

// GitHub issue content is a REPAIRABLE projection of signed authority.
// Reconciliation is deterministic and idempotent. All source identity fields
// must already match the signed event, preventing reassignment of provenance.
export function reconcileIssueAuthority(issue, authority, nowMs = Date.now(), currentMainSha = null) {
  const id=issueIdentity(issue);
  const current=authority.active.get(id.issue_number);
  const released=authority.released.get(id.issue_number);
  const anchor=current || released || authority.invalidated.get(id.issue_number);
  if (!anchor && !authority.invalidated.has(id.issue_number))
    throw new Error('NO_SIGNED_HISTORY_TO_RECONCILE');
  if (anchor && (anchor.mission!==id.mission || anchor.agent!==id.agent ||
      anchor.branch!==id.branch || anchor.risk!==id.risk ||
      anchor.base_sha!==id.base_sha || canonical(anchor.paths)!==canonical(id.paths)))
    throw new Error('ISSUE_IDENTITY_DIFFERS_FROM_SIGNED_AUTHORITY');
  const target=authority.invalidated.has(id.issue_number) ||
    (current && (current.expiry_ms<=nowMs || (currentMainSha && current.main_sha!==currentMainSha)))
    ? 'BLOCKED_AUTOMATION' : released
      ? REVIEWING.has(id.status) ? id.status : 'REVIEW' : WRITERS.has(id.status) ? id.status : 'ACTIVE';
  // Every live writer state carries the same signed lease identity. Reconciliation
  // must not remove the grant marker merely because work progressed past ACTIVE.
  // Expired, revoked and main-stale authority must still project fail-closed.
  const authorizedWriter=WRITERS.has(target) && current &&
    current.expiry_ms>nowMs && !authority.invalidated.has(id.issue_number) &&
    (!currentMainSha || current.main_sha===currentMainSha);
  const markers=new Map([
    ['Pri-Mission-Status',target],
    ['Pri-Lease-Grant-ID',authorizedWriter ? eventDigest(current) : null],
    ['Pri-Lease-Heartbeat-At',authorizedWriter ? new Date(current.timestamp_ms).toISOString() : null],
    ['Pri-Lease-Heartbeat-Ref',authorizedWriter ? current.head_sha : null],
    ['Pri-Lease-Heartbeat-By',authorizedWriter ? current.agent : null],
    ['Pri-Review-Head',released ? released.head_sha : null],
    ['Pri-Provenance-Event',released ? eventDigest(released) : null]
  ]);
  const lines=String(issue.body || '').trimEnd().split('\n').filter(line=>{
    const key=line.split(':',1)[0].toLowerCase();
    return ![...markers.keys()].some(k=>k.toLowerCase()===key);
  });
  for(const [key,value] of markers) if(value!==null) lines.push(`${key}: ${value}`);
  return {body:lines.join('\n').trim()+'\n',status:target,
    authority_event:released ? eventDigest(released) : current ? eventDigest(current) : null,
    changed:(lines.join('\n').trim()+'\n')!==issue.body};
}

// A release event is durable source truth; it is NOT permission to edit.
// Review may continue long after the writer's original 12-hour TTL expires.
export function verifyReleasedSource({authority,issue,pr,head,mainSha}) {
  const id=issueIdentity(issue);
  if (!REVIEWING.has(id.status)) throw new Error('NOT_IN_REVIEW_STATE');
  const released=authority.released.get(id.issue_number);
  if (!released || authority.invalidated.has(id.issue_number)) throw new Error('REVIEW_WITHOUT_SIGNED_PROVENANCE');
  if (authority.live.some(g=>g.issue_number===id.issue_number)) throw new Error('WRITER_STILL_ACTIVE');
  if (!hex40(head) || !pr || pr.state!=='open' || pr.head?.sha!==head ||
    pr.head?.ref!==id.branch || pr.base?.ref!=='main' || pr.base?.sha!==mainSha ||
    pr.head?.repo?.full_name!==REPOSITORY || pr.base?.repo?.full_name!==REPOSITORY)
    throw new Error('STALE_OR_UNTRUSTED_REVIEW_PR');
  if (released.issue_number!==id.issue_number || released.mission!==id.mission ||
    released.agent!==id.agent || released.branch!==id.branch || released.risk!==id.risk ||
    released.base_sha!==id.base_sha || released.head_sha!==head ||
    canonical(released.paths)!==canonical(id.paths) ||
    marker(issue.body,'Pri-Review-Head')!==head ||
    marker(issue.body,'Pri-Provenance-Event')!==eventDigest(released))
    throw new Error('REVIEW_PROVENANCE_MISMATCH');
  return {issue_number:id.issue_number,mission:id.mission,agent:id.agent,
    head_sha:head,provenance_digest:eventDigest(released),grant_id:released.grant_id,
    released_at:released.timestamp_ms,original_main_sha:released.main_sha,paths:released.paths};
}

export function authorizeCAS({read,putIfFastForward}, mutate) {
  // The remote ref update must be non-forced: a stale-parent commit is
  // rejected by GitHub as non-fast-forward. Never retry with force=true.
  return Promise.resolve(read()).then(async ({head,log}) => {
    const next=await mutate(log);
    await putIfFastForward(head,next);
    return {previous_head:head, next};
  });
}
