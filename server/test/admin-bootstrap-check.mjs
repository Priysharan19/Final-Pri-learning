// First-admin bootstrap contract (cloud-01, quality-17).
//
// PRI_BOOTSTRAP_ADMIN_EMAIL names one mailbox. The first account that proves
// control of it (email verification, or sign-in once verified) becomes admin
// while the deployment has no admin, with an audit row. Once an admin exists
// the setting is inert. Operators can also promote via
// server/tools/promote-role.mjs, which audits with via:'cli'.

import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = join(here, '..', '..');
process.env.PRI_BOOTSTRAP_ADMIN_EMAIL = 'Owner@Pri.Example';

const { startApp, registerAccount, verifyEmail, checks } = await import('./support/app-harness.mjs');
const { createPlatformDb } = await import('../platform/db.js');
const { bootstrapAdminConfigured, maybeBootstrapAdmin } = await import('../platform/bootstrapAdmin.js');

const c = checks();
const bootstrapRows = db => db.prepare("SELECT actor_account_id, target_id, metadata_json FROM audit_log WHERE action='account.bootstrap-admin' ORDER BY id").all();
const role = (db, id) => db.prepare('SELECT role FROM accounts WHERE id=?').get(id)?.role;

// A. Verification path, then inert once an admin exists.
{
  const h = await startApp();
  try {
    c.eq(bootstrapAdminConfigured(), true, 'bootstrap email configured');

    const student = await registerAccount(h, { email: 'first.student@example.test' });
    c.eq(student.account.role, 'student', 'ordinary registration is a student');
    c.eq((await verifyEmail(h, student.account.id)).status, 200, 'student verifies');
    c.eq(role(h.db, student.account.id), 'student', 'a verified non-bootstrap email stays a student');
    c.deq(bootstrapRows(h.db), [], 'no bootstrap audit row yet');

    const owner = await registerAccount(h, { email: 'owner@pri.example', name: 'Pri Owner' });
    c.eq(owner.status, 201, 'owner registers');
    c.eq(owner.account.role, 'student', 'the bootstrap email is a student until the mailbox is proven');
    c.eq((await h.request('/v1/admin/health', { jar: owner.jar })).status, 403, 'unverified owner has no admin access');
    c.eq((await h.request('/v1/account/me', { jar: owner.jar })).data.account.role, 'student', '/me reports student before verification');

    c.eq((await verifyEmail(h, owner.account.id)).status, 200, 'owner verifies the mailbox');
    const me = await h.request('/v1/account/me', { jar: owner.jar });
    c.eq(me.data.account.role, 'admin', 'verification promotes the bootstrap email to admin');
    c.eq(me.data.account.emailVerified, true, 'and it is verified');
    const adminHealth = await h.request('/v1/admin/health', { jar: owner.jar });
    c.eq(adminHealth.status, 200, 'admin routes open for the bootstrapped admin');
    c.eq(adminHealth.data.ok, true, 'admin health responds');
    const rows = bootstrapRows(h.db);
    c.eq(rows.length, 1, 'exactly one bootstrap audit row');
    c.eq(rows[0].target_id, owner.account.id, 'audit targets the owner');
    c.eq(rows[0].actor_account_id, null, 'audit actor is the system, not a user');
    c.eq(JSON.parse(rows[0].metadata_json).source, 'PRI_BOOTSTRAP_ADMIN_EMAIL', 'audit names the source');
    c.eq(maybeBootstrapAdmin(h.db, owner.account.id), false, 'bootstrap is idempotent');

    // Inert once any admin exists, even if the setting is pointed elsewhere.
    process.env.PRI_BOOTSTRAP_ADMIN_EMAIL = 'second.owner@pri.example';
    const second = await registerAccount(h, { email: 'second.owner@pri.example' });
    c.eq((await verifyEmail(h, second.account.id)).status, 200, 'second owner verifies');
    c.eq(role(h.db, second.account.id), 'student', 'a second bootstrap target stays a student once an admin exists');
    c.eq((await h.request('/v1/account/login', { method: 'POST', body: { email: 'second.owner@pri.example', password: 'correct-horse-battery' } })).data.account.role, 'student', 'login does not promote either');
    c.eq(bootstrapRows(h.db).length, 1, 'still one bootstrap audit row');
  } finally {
    await h.close();
    h.db.close();
  }
}

// B. Login path for an account that was verified before the setting existed,
// and the unverified-login guard.
{
  process.env.PRI_BOOTSTRAP_ADMIN_EMAIL = 'nobody.yet@pri.example';
  const h = await startApp();
  try {
    const late = await registerAccount(h, { email: 'late.owner@pri.example', password: 'late-owner-password' });
    c.eq((await verifyEmail(h, late.account.id)).status, 200, 'late owner verified while the setting pointed elsewhere');
    c.eq(role(h.db, late.account.id), 'student', 'still a student');

    process.env.PRI_BOOTSTRAP_ADMIN_EMAIL = 'late.owner@pri.example';
    const login = await h.request('/v1/account/login', { method: 'POST', body: { email: 'late.owner@pri.example', password: 'late-owner-password', deviceId: 'ipad-late' } });
    c.eq(login.status, 200, 'late owner signs in');
    c.eq(login.data.account.role, 'admin', 'sign-in promotes an already-verified bootstrap email');
    c.eq(bootstrapRows(h.db).length, 1, 'login path audited');
  } finally {
    await h.close();
    h.db.close();
  }

  process.env.PRI_BOOTSTRAP_ADMIN_EMAIL = 'unverified.owner@pri.example';
  const g = await startApp();
  try {
    const owner = await registerAccount(g, { email: 'unverified.owner@pri.example', password: 'unverified-owner-pw' });
    const login = await g.request('/v1/account/login', { method: 'POST', body: { email: 'unverified.owner@pri.example', password: 'unverified-owner-pw' } });
    c.eq(login.data.account.role, 'student', 'an unverified bootstrap email is never promoted on sign-in');
    c.deq(bootstrapRows(g.db), [], 'no audit row without mailbox proof');
    c.eq((await verifyEmail(g, owner.account.id)).status, 200, 'owner verifies');
    c.eq(role(g.db, owner.account.id), 'admin', 'promotion follows verification');
  } finally {
    await g.close();
    g.db.close();
  }
}

// C. Operator CLI against a file-backed database.
{
  delete process.env.PRI_BOOTSTRAP_ADMIN_EMAIL;
  const dir = mkdtempSync(join(tmpdir(), 'pri-admin-bootstrap-'));
  const file = join(dir, 'platform.db');
  const h = await startApp({ db: createPlatformDb(file) });
  const cli = (...args) => {
    const env = { ...process.env, PRI_PLATFORM_DB: file };
    delete env.NODE_ENV;
    delete env.PRI_BOOTSTRAP_ADMIN_EMAIL;
    const run = spawnSync(process.execPath, [join(ROOT, 'server', 'tools', 'promote-role.mjs'), ...args], { env, encoding: 'utf8' });
    return { status: run.status, stdout: run.stdout.trim(), stderr: run.stderr.trim() };
  };
  try {
    const teacher = await registerAccount(h, { email: 'teacher.candidate@example.test' });
    c.eq(teacher.account.role, 'student', 'candidate starts as a student');

    const promoted = cli('Teacher.Candidate@example.test', 'teacher');
    c.eq(promoted.status, 0, `promote-role exits 0 (${promoted.stderr})`);
    const out = JSON.parse(promoted.stdout);
    c.eq(out.previousRole, 'student', 'CLI reports the previous role');
    c.eq(out.role, 'teacher', 'CLI reports the new role');
    c.eq(role(h.db, teacher.account.id), 'teacher', 'role changed in the shared database');
    const audit = h.db.prepare("SELECT actor_account_id, target_id, metadata_json FROM audit_log WHERE action='account.role' ORDER BY id DESC").get();
    c.eq(audit?.target_id, teacher.account.id, 'CLI change is audited');
    c.eq(audit?.actor_account_id, null, 'CLI actor is null');
    c.eq(JSON.parse(audit.metadata_json).via, 'cli', 'audit metadata says via cli');
    c.eq((await h.request('/v1/account/me', { jar: teacher.jar })).data.account.role, 'teacher', 'the live session sees the promoted role');

    const admin = cli('teacher.candidate@example.test', 'admin');
    c.eq(admin.status, 0, 'CLI can create the first admin');
    c.eq(role(h.db, teacher.account.id), 'admin', 'admin role applied');
    c.eq((await h.request('/v1/admin/health', { jar: teacher.jar })).status, 200, 'CLI-made admin can use admin routes');

    c.eq(cli('nobody@example.test', 'teacher').status, 3, 'unknown email exits 3');
    c.eq(cli('teacher.candidate@example.test', 'overlord').status, 2, 'invalid role exits 2');
    c.eq(cli().status, 2, 'missing arguments exit 2');
  } finally {
    await h.close();
    h.db.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

console.log(`ADMIN BOOTSTRAP — PASS — ${c.count()}/${c.count()} checks`);
