import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

function nowIso() {
  return new Date().toISOString();
}

export class PromotionsStore {
  constructor(path = ':memory:') {
    if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec('PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;');
    if (path !== ':memory:') this.db.exec('PRAGMA journal_mode = WAL;');
    this.#migrate();
  }

  #migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS campaigns (
        id TEXT PRIMARY KEY,
        keyword TEXT NOT NULL UNIQUE COLLATE NOCASE,
        reward_label TEXT NOT NULL,
        active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0, 1)),
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS participants (
        instagram_scoped_id TEXT PRIMARY KEY,
        username TEXT,
        display_name TEXT,
        follows_business INTEGER CHECK(follows_business IN (0, 1) OR follows_business IS NULL),
        last_seen_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS claims (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        campaign_id TEXT NOT NULL REFERENCES campaigns(id),
        instagram_scoped_id TEXT NOT NULL REFERENCES participants(instagram_scoped_id),
        code_hash TEXT UNIQUE,
        issued_at TEXT NOT NULL,
        redeemed_at TEXT,
        last_follow_state INTEGER CHECK(last_follow_state IN (0, 1) OR last_follow_state IS NULL),
        UNIQUE(campaign_id, instagram_scoped_id)
      );

      CREATE TABLE IF NOT EXISTS audit_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_type TEXT NOT NULL,
        campaign_id TEXT,
        claim_id INTEGER,
        subject_ref TEXT,
        created_at TEXT NOT NULL,
        metadata_json TEXT NOT NULL DEFAULT '{}'
      );

      CREATE INDEX IF NOT EXISTS idx_claims_code_hash ON claims(code_hash);
      CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_events(created_at);
    `);
  }

  seedCampaign({ id, keyword, rewardLabel }) {
    this.db.prepare(`
      INSERT INTO campaigns (id, keyword, reward_label, active, created_at)
      VALUES (?, ?, ?, 1, ?)
      ON CONFLICT(id) DO UPDATE SET keyword = excluded.keyword, reward_label = excluded.reward_label
    `).run(id, keyword, rewardLabel, nowIso());
  }

  getCampaign(id) {
    return this.db.prepare('SELECT * FROM campaigns WHERE id = ? AND active = 1').get(id) ?? null;
  }

  getCampaignByKeyword(keyword) {
    return this.db.prepare('SELECT * FROM campaigns WHERE keyword = ? AND active = 1').get(String(keyword).trim()) ?? null;
  }

  upsertParticipant({ instagramScopedId, username = null, displayName = null, followsBusiness = null }) {
    const seenAt = nowIso();
    const followValue = followsBusiness == null ? null : followsBusiness ? 1 : 0;
    this.db.prepare(`
      INSERT INTO participants (instagram_scoped_id, username, display_name, follows_business, last_seen_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(instagram_scoped_id) DO UPDATE SET
        username = COALESCE(excluded.username, participants.username),
        display_name = COALESCE(excluded.display_name, participants.display_name),
        follows_business = COALESCE(excluded.follows_business, participants.follows_business),
        last_seen_at = excluded.last_seen_at
    `).run(instagramScopedId, username, displayName, followValue, seenAt);
  }

  issueOrRotateClaim({ campaignId, instagramScopedId, codeHash, followsBusiness = null, subjectRef = null }) {
    const issuedAt = nowIso();
    const followValue = followsBusiness == null ? null : followsBusiness ? 1 : 0;
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const existing = this.db.prepare(`
        SELECT id, redeemed_at FROM claims WHERE campaign_id = ? AND instagram_scoped_id = ?
      `).get(campaignId, instagramScopedId);

      if (existing?.redeemed_at) {
        this.#audit('claim_repeat_after_redemption', campaignId, existing.id, subjectRef, {});
        this.db.exec('COMMIT');
        return { status: 'already_redeemed', claimId: existing.id, redeemedAt: existing.redeemed_at };
      }

      if (existing) {
        this.db.prepare(`
          UPDATE claims SET code_hash = ?, issued_at = ?, last_follow_state = ? WHERE id = ?
        `).run(codeHash, issuedAt, followValue, existing.id);
        this.#audit('claim_code_rotated', campaignId, existing.id, subjectRef, { followsBusiness });
        this.db.exec('COMMIT');
        return { status: 'rotated', claimId: existing.id, issuedAt };
      }

      const result = this.db.prepare(`
        INSERT INTO claims (campaign_id, instagram_scoped_id, code_hash, issued_at, last_follow_state)
        VALUES (?, ?, ?, ?, ?)
      `).run(campaignId, instagramScopedId, codeHash, issuedAt, followValue);
      const claimId = Number(result.lastInsertRowid);
      this.#audit('claim_issued', campaignId, claimId, subjectRef, { followsBusiness });
      this.db.exec('COMMIT');
      return { status: 'issued', claimId, issuedAt };
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  redeemByCodeHash({ codeHash, subjectRef = 'staff' }) {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const claim = this.db.prepare(`
        SELECT c.id, c.campaign_id, c.redeemed_at, ca.reward_label
        FROM claims c JOIN campaigns ca ON ca.id = c.campaign_id
        WHERE c.code_hash = ?
      `).get(codeHash);

      if (!claim) {
        this.#audit('redeem_invalid_code', null, null, subjectRef, {});
        this.db.exec('COMMIT');
        return { status: 'invalid' };
      }

      if (claim.redeemed_at) {
        this.#audit('redeem_repeat', claim.campaign_id, claim.id, subjectRef, {});
        this.db.exec('COMMIT');
        return { status: 'already_redeemed', claimId: claim.id, redeemedAt: claim.redeemed_at, rewardLabel: claim.reward_label };
      }

      const redeemedAt = nowIso();
      const result = this.db.prepare(`
        UPDATE claims SET redeemed_at = ? WHERE id = ? AND redeemed_at IS NULL
      `).run(redeemedAt, claim.id);

      if (result.changes !== 1) {
        this.db.exec('ROLLBACK');
        return { status: 'conflict' };
      }

      this.#audit('redeem_success', claim.campaign_id, claim.id, subjectRef, {});
      this.db.exec('COMMIT');
      return { status: 'redeemed', claimId: claim.id, redeemedAt, rewardLabel: claim.reward_label };
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  getStats(campaignId) {
    return this.db.prepare(`
      SELECT
        COUNT(*) AS claims,
        SUM(CASE WHEN redeemed_at IS NOT NULL THEN 1 ELSE 0 END) AS redeemed,
        SUM(CASE WHEN redeemed_at IS NULL THEN 1 ELSE 0 END) AS outstanding
      FROM claims WHERE campaign_id = ?
    `).get(campaignId);
  }

  #audit(eventType, campaignId, claimId, subjectRef, metadata) {
    this.db.prepare(`
      INSERT INTO audit_events (event_type, campaign_id, claim_id, subject_ref, created_at, metadata_json)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(eventType, campaignId, claimId, subjectRef, nowIso(), JSON.stringify(metadata ?? {}));
  }

  close() {
    this.db.close();
  }
}
