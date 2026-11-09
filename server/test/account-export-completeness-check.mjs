// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · the account export carries every account-bearing table (P2 #2)
//
// GET /v1/account/export must hand an account everything the server keeps
// about it. The account-bearing tables are DISCOVERED from the schema (every
// foreign key onto accounts(id)), so a table added later fails this check until
// it is either exported (COVERED) or listed in EXCLUDED with a reason.
//
// Rows are seeded for the exporting account and for a second account in every
// covered table. The export must carry the first account's rows, never the
// second's, and never a secret: password/token/code hashes, request digests,
// TOTP material, or the sealed body of a question/paper that is still open.
//
//   node server/test/account-export-completeness-check.mjs
//   node scripts/with-postgres.mjs node server/test/account-export-completeness-check.mjs --engine=postgres
// ─────────────────────────────────────────────────────────────────────────────
import './support/hermetic.mjs';
import { requestedEngine } from './support/engine.mjs';
import { checks, registerAccount, startApp } from './support/app-harness.mjs';

// table.column → the export section that carries it.
const COVERED = {
  'account_identities.account_id': 'identities',
  'learning_events.account_id': 'learningEvents',
  'sync_entities.account_id': 'entities',
  'class_members.student_account_id': 'classes',
  'assignment_submissions.student_account_id': 'assignmentSubmissions',
  'assignment_feedback.student_account_id': 'assignmentFeedback',
  'issue_reports.account_id': 'issueReports',
  'operational_events.account_id': 'telemetry',
  'entitlement_snapshots.account_id': 'entitlement',
  'guardian_consents.account_id': 'guardianConsent',
  'idempotency_keys.account_id': 'receipts',
  'account_phones.account_id': 'phones',
  'parent_report_links.account_id': 'parentReport',
  'parent_report_sends.account_id': 'parentReport'
};
// table.column → why it is not in the export.
const EXCLUDED = {
  'account_sessions.account_id': 'session token hashes and device/user-agent hashes: authentication secrets',
  'account_tokens.account_id': 'single-use token hashes: authentication secrets',
  'account_mfa.account_id': 'TOTP secret ciphertext: authentication secret',
  'account_mfa_recovery_codes.account_id': 'recovery code hashes: authentication secrets',
  'otp_challenges.account_id': 'one-time code and destination HMACs, minutes-lived: authentication secrets',
  'auth_delivery_outbox.account_id': 'encrypted tokens in a transient delivery queue: authentication secrets',
  'audit_log.actor_account_id': 'security audit trail kept under docs/privacy/data-retention.md; not learner content',
  'entitlement_support_grants.account_id': 'operator grant records; their effect is exported as the entitlement summary',
  'billing_apple_accounts.account_id': 'payment-provider linkage; exported as the entitlement summary (provider rows: follow-up)',
  'billing_apple_signed_events.account_id': 'payment-provider signed payloads; exported as the entitlement summary (follow-up)',
  'billing_events.account_id': 'payment-provider webhook ledger; exported as the entitlement summary (follow-up)',
  'billing_google_accounts.account_id': 'payment-provider linkage; exported as the entitlement summary (follow-up)',
  'billing_google_purchases.account_id': 'payment-provider purchase tokens: provider credentials',
  'billing_payments.account_id': 'payment-provider records; exported as the entitlement summary (follow-up)',
  'billing_subscriptions.account_id': 'payment-provider records; exported as the entitlement summary (follow-up)',
  'billing_trial_claims.account_id': 'payment-provider trial ledger; exported as the entitlement summary (follow-up)',
  'classes.teacher_account_id': 'teacher-side class records (join code hash); student-side membership is exported (teacher export: follow-up)',
  'assignments.teacher_account_id': 'teacher-side assignment authoring (teacher export: follow-up)',
  'assignment_feedback.teacher_account_id': 'the teacher id on a student\'s feedback; the feedback is exported to the student without it',
  'content_revisions.author_account_id': 'curriculum authoring records, operator content',
  'content_revisions.reviewer_account_id': 'curriculum review records, operator content',
  'feature_flags.updated_by': 'operator configuration',
  'teacher_invites.created_by': 'operator-issued invite code hashes',
  'teacher_invites.used_by': 'invite code hashes: secrets'
};

const c = checks();
const h = await startApp({ engine: requestedEngine() });
const db = h.db;
const now = Date.now();

async function accountForeignKeys() {
  if (h.engine === 'postgres') {
    const rows = await db.all(`SELECT t.relname AS tbl, a.attname AS col
      FROM pg_constraint k JOIN pg_class t ON t.oid = k.conrelid JOIN pg_class r ON r.oid = k.confrelid
      JOIN pg_namespace n ON n.oid = r.relnamespace
      JOIN pg_attribute a ON a.attrelid = k.conrelid AND a.attnum = ANY(k.conkey)
      WHERE k.contype = 'f' AND r.relname = 'accounts' AND n.nspname = 'pri'`);
    return [...new Set(rows.map(row => `${row.tbl}.${row.col}`))].sort();
  }
  const tables = await db.all("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
  const found = [];
  for (const { name } of tables) {
    for (const fk of await db.all(`PRAGMA foreign_key_list('${name}')`)) if (fk.table === 'accounts') found.push(`${name}.${fk.from}`);
  }
  return [...new Set(found)].sort();
}

try {
  // ── Every account-bearing column is either exported or excluded with a reason ─
  const discovered = await accountForeignKeys();
  c.ok(discovered.length >= Object.keys(COVERED).length, `the schema names its account-bearing tables (${discovered.length})`);
  const unlisted = discovered.filter(key => !(key in COVERED) && !(key in EXCLUDED));
  c.deq(unlisted, [], 'every table.column referencing accounts(id) is exported or explicitly excluded with a reason');
  c.deq(Object.keys(COVERED).filter(key => !discovered.includes(key)), [], 'every covered table.column exists in this schema');

  // ── Two students and a teacher ─────────────────────────────────────────────
  const alice = await registerAccount(h, { email: 'alice.complete@example.test', deviceId: 'ipad-alice' });
  const bob = await registerAccount(h, { email: 'bob.complete@example.test', deviceId: 'ipad-bob' });
  const carol = await registerAccount(h, { email: 'carol.teacher@example.test', deviceId: 'ipad-carol' });
  c.deq([alice.status, bob.status, carol.status], [201, 201, 201], 'three accounts register');
  const A = alice.account.id; const B = bob.account.id; const T = carol.account.id;

  await db.run('INSERT INTO classes(id,teacher_account_id,name,join_code_hash,created_at) VALUES (?,?,?,?,?)', ['class-1', T, 'Year 9 Maths', 'join-code-hash-SECRET', now]);
  await db.run('INSERT INTO assignments(id,class_id,teacher_account_id,title,specification_json,created_at) VALUES (?,?,?,?,?,?)', ['asg-1', 'class-1', T, 'Fractions', '{}', now]);

  async function seed(id, tag, phone, guardianPhone, cursor) {
    await db.run("UPDATE accounts SET age_basis='child' WHERE id=?", [id]);
    await db.run('INSERT INTO learning_events(server_cursor,id,account_id,device_id,device_seq,kind,entity_id,occurred_at,payload_json,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)',
      [cursor, `ev-${tag}`, id, `dev-${tag}`, 1, 'attempt', `ent-${tag}`, now, JSON.stringify({ marker: `${tag}-EVENT` }), now]);
    await db.run('INSERT INTO sync_entities(account_id,kind,entity_id,version,server_cursor,body_json,tombstone,updated_at) VALUES (?,?,?,?,?,?,?,?)',
      [id, 'profile', `ent-${tag}`, 1, 1, JSON.stringify({ marker: `${tag}-ENTITY` }), 0, now]);
    await db.run('INSERT INTO class_members(class_id,student_account_id,joined_at) VALUES (?,?,?)', ['class-1', id, now]);
    await db.run('INSERT INTO assignment_submissions(assignment_id,student_account_id,state,summary_json,started_at,updated_at) VALUES (?,?,?,?,?,?)',
      ['asg-1', id, 'started', JSON.stringify({ marker: `${tag}-SUBMISSION` }), now, now]);
    await db.run('INSERT INTO assignment_feedback(assignment_id,student_account_id,teacher_account_id,feedback_json,returned_at,updated_at) VALUES (?,?,?,?,?,?)',
      ['asg-1', id, T, JSON.stringify({ marker: `${tag}-FEEDBACK` }), now, now]);
    await db.run('INSERT INTO issue_reports(id,account_id,category,note,created_at) VALUES (?,?,?,?,?)', [`rep-${tag}`, id, 'other', `${tag}-REPORT`, now]);
    await db.run('INSERT INTO operational_events(id,account_id,event_type,surface,metadata_json,created_at) VALUES (?,?,?,?,?,?)',
      [`op-${tag}`, id, 'page_view', `${tag}-SURFACE`, '{}', now]);
    await db.run("INSERT INTO entitlement_snapshots(account_id,plan,status,provider,updated_at) VALUES (?,'free','free','none',?) ON CONFLICT(account_id) DO NOTHING", [id, now]);
    await db.run('INSERT INTO guardian_consents(account_id,guardian_name,guardian_email,guardian_phone,notice_version,requested_at,confirmed_at,method) VALUES (?,?,?,?,?,?,?,?)',
      [id, `${tag} Parent`, '', guardianPhone, '2026-10', now, now, 'guardian-phone-otp']);
    await db.run('INSERT INTO account_phones(account_id,phone_e164,verified_at) VALUES (?,?,?)', [id, phone, now]);
    await db.run("INSERT INTO parent_report_links(account_id,recipient_email,status,unsubscribe_token_hash,unsubscribe_token_envelope,requested_at,confirmed_at) VALUES (?,?,'active',?,?,?,?)",
      [id, `${tag.toLowerCase()}.parent@example.test`, `${tag}-UNSUB-HASH-SECRET`, `${tag}-UNSUB-ENVELOPE-SECRET`, now, now]);
    await db.run("INSERT INTO parent_report_sends(account_id,week_start,status,provider_message_id,created_at,updated_at,sent_at) VALUES (?,?,'sent',?,?,?,?)",
      [id, now - 7 * 86400000, `${tag}-PROVIDER-ID`, now, now, now]);
    const receipt = (scope, key, body) => db.run('INSERT INTO idempotency_keys(account_id,scope,key,response_json,request_digest,created_at,expires_at) VALUES (?,?,?,?,?,?,?)',
      [id, scope, key, JSON.stringify(body), `${tag}-DIGEST-${scope}-${key}`, now, now + 86400000]);
    await receipt('exam-paper', `${tag}-exam-open`, { answer: `${tag}-PAPER-OPEN-SECRET` });
    await receipt('exam-answers', `${tag}-exam-open`, { answers: `${tag}-MY-EXAM-ANSWERS` });
    await receipt('exam-paper', `${tag}-exam-done`, { answer: `${tag}-PAPER-DONE` });
    await receipt('exam-result', `${tag}-exam-done`, { score: `${tag}-EXAM-RESULT` });
    await receipt('exam-layout', `${tag}-layout`, { layoutSeed: `${tag}-LAYOUT-SEED-SECRET` });
    await receipt('practice-question', `${tag}-q-open`, { answer: `${tag}-ANSWER-OPEN-SECRET` });
    await receipt('practice-question', `${tag}-q-done`, { answer: `${tag}-ANSWER-DONE` });
    await receipt('practice-completion', `${tag}-q-done`, { attemptId: `${tag}-COMPLETION` });
    await receipt('practice-recognition', `${tag}-rcpt`, { text: `${tag}-TRANSCRIPT` });
  }
  await seed(A, 'ALICE', '+919876500001', '+919876511111', 1001);
  await seed(B, 'BOB', '+919876500002', '+919876522222', 1002);
  // Alice's authentication secrets, which must never be exported.
  await db.run('INSERT INTO account_mfa(account_id,secret_ciphertext,created_at,updated_at) VALUES (?,?,?,?)', [A, 'ALICE-TOTP-CIPHERTEXT', now, now]);
  await db.run('INSERT INTO account_mfa_recovery_codes(account_id,code_hash,created_at) VALUES (?,?,?)', [A, 'ALICE-RECOVERY-HASH', now]);
  await db.run("INSERT INTO otp_challenges(id,channel,purpose,destination_hash,account_id,code_hash,provider,created_at,expires_at) VALUES (?,'sms','reauth',?,?,?,'test',?,?)",
    ['otp-alice', 'ALICE-DEST-HMAC', A, 'ALICE-OTP-HASH', now, now + 60000]);

  // ── Alice exports ──────────────────────────────────────────────────────────
  const res = await h.request('/v1/account/export', { jar: alice.jar });
  c.eq(res.status, 200, 'Alice exports');
  const x = res.data;
  const text = JSON.stringify(x);
  c.eq(x.format, 'pri-account-export-v1', 'the format stays v1 (additions are new keys only)');
  for (const key of ['account', 'identities', 'learningEvents', 'entities', 'classes', 'assignmentSubmissions', 'assignmentFeedback', 'telemetry', 'issueReports', 'entitlement', 'guardianConsent']) {
    c.ok(key in x, `the earlier section ${key} is still there`);
  }
  for (const section of new Set(Object.values(COVERED))) c.ok(x[section] != null, `the export carries ${section}`);

  // Every covered table's seeded row is there.
  for (const marker of ['ALICE-EVENT', 'ALICE-ENTITY', 'ALICE-SUBMISSION', 'ALICE-FEEDBACK', 'ALICE-REPORT', 'ALICE-SURFACE',
    'ALICE-MY-EXAM-ANSWERS', 'ALICE-PAPER-DONE', 'ALICE-EXAM-RESULT', 'ALICE-ANSWER-DONE', 'ALICE-COMPLETION', 'ALICE-TRANSCRIPT']) {
    c.ok(text.includes(marker), `the export carries Alice's ${marker}`);
  }
  c.ok(x.classes.some(row => row.id === 'class-1'), 'the class membership is exported');
  c.eq(x.identities.length, 1, 'the password identity is exported');
  c.deq(x.phones, [{ phone: '+919876500001', verifiedAt: now }], 'Alice\'s own verified phone is exported in full');
  c.eq(x.guardianConsent?.state != null, true, 'the guardian consent record is exported');
  c.eq(x.guardianConsent.guardianPhone, '+91 ••••• 111', 'the guardian phone is exported masked, as the guardian email is');
  c.ok(!text.includes('+919876511111'), 'the guardian\'s full number is not in the export');
  c.eq(x.parentReport?.link?.recipient, 'a•••••••••••@example.test', 'the parent report recipient is exported masked');
  c.deq(x.parentReport?.sends?.map(row => row.status), ['sent'], 'each week\'s parent report send is exported');

  const receipts = x.receipts;
  c.ok(Array.isArray(receipts) && receipts.length === 9, 'all nine of Alice\'s idempotency rows are listed');
  const r = (scope, key) => receipts.find(row => row.scope === scope && row.key === key);
  c.deq([r('exam-paper', 'ALICE-exam-open')?.body, r('exam-paper', 'ALICE-exam-open')?.withheld], [null, 'unresolved-question'], 'an open exam paper is listed but its sealed body withheld');
  c.deq([r('practice-question', 'ALICE-q-open')?.body, r('practice-question', 'ALICE-q-open')?.withheld], [null, 'unresolved-question'], 'an open practice question is listed but its sealed body withheld');
  c.deq(r('practice-question', 'ALICE-q-done')?.body, { answer: 'ALICE-ANSWER-DONE' }, 'a resolved question\'s body is exported');
  c.eq(r('exam-layout', 'ALICE-layout')?.withheld, 'internal', 'internal machinery (the layout seed) is withheld');

  // ── Redacted: secrets and sealed answers ───────────────────────────────────
  const secrets = ['ALICE-UNSUB-HASH-SECRET', 'ALICE-UNSUB-ENVELOPE-SECRET', 'alice.parent@example.test', 'ALICE-PROVIDER-ID', 'ALICE-PAPER-OPEN-SECRET', 'ALICE-ANSWER-OPEN-SECRET', 'ALICE-LAYOUT-SEED-SECRET', 'ALICE-DIGEST', 'ALICE-TOTP-CIPHERTEXT',
    'ALICE-RECOVERY-HASH', 'ALICE-OTP-HASH', 'ALICE-DEST-HMAC', 'join-code-hash-SECRET'];
  const realHashes = [
    ...(await db.all('SELECT password_hash AS v FROM accounts WHERE id=?', [A])),
    ...(await db.all('SELECT token_hash AS v FROM account_sessions WHERE account_id=?', [A])),
    ...(await db.all('SELECT token_hash AS v FROM account_tokens WHERE account_id=?', [A]))
  ].map(row => row.v).filter(Boolean);
  c.ok(realHashes.length >= 2, 'Alice has a password hash and a session token hash to look for');
  for (const secret of [...secrets, ...realHashes]) c.ok(!text.includes(secret), `the export never carries ${secret.length > 30 ? 'a stored hash' : secret}`);
  c.ok(!/request_digest|requestDigest|token_hash|code_hash|password_hash|secret_ciphertext/.test(text), 'no hash/digest field name appears');
  c.ok(!text.includes(T), 'the teacher\'s account id is not exported');

  // ── Bob's rows never appear ────────────────────────────────────────────────
  c.ok(!text.includes('BOB-'), 'none of Bob\'s seeded rows appear in Alice\'s export');
  c.ok(!text.includes(B), 'Bob\'s account id does not appear');
  c.ok(!text.includes('+919876500002') && !text.includes('+919876522222'), 'Bob\'s phone and guardian phone do not appear');

  // The audit receipt counts the new sections, still with no personal data.
  const audit = await db.get("SELECT metadata_json FROM audit_log WHERE action='account.export' AND target_id=? ORDER BY id DESC", [A]);
  const counts = JSON.parse(audit.metadata_json).counts;
  c.deq([counts.receipts, counts.phones], [9, 1], 'the audit receipt counts receipts and phones');

  console.log(`engine: ${h.engine}`);
  console.log(`account-export-completeness-check (${h.engine}): ${c.count()} checks passed`);
} finally {
  await h.close();
}
