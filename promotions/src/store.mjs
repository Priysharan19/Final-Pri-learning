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
        ref_code TEXT,
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

      CREATE TABLE IF NOT EXISTS campaign_attributions (
        instagram_scoped_id TEXT NOT NULL,
        campaign_id TEXT NOT NULL REFERENCES campaigns(id),
        ref_code TEXT NOT NULL,
        source TEXT,
        attributed_at TEXT NOT NULL,
        PRIMARY KEY(instagram_scoped_id, campaign_id)
      );

      CREATE TABLE IF NOT EXISTS campaign_passes (
        pass_hash TEXT PRIMARY KEY,
        campaign_id TEXT NOT NULL REFERENCES campaigns(id),
        issued_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        consumed_at TEXT,
        instagram_scoped_id TEXT
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
      CREATE INDEX IF NOT EXISTS idx_attribution_subject ON campaign_attributions(instagram_scoped_id, attributed_at DESC);
      CREATE INDEX IF NOT EXISTS idx_campaign_pass_expiry ON campaign_passes(expires_at);
      CREATE INDEX IF NOT EXISTS idx_audit_created_at ON audit_events(created_at);
    `);

    const campaignColumns = this.db.prepare('PRAGMA table_info(campaigns)').all().map((column) => column.name);
    if (!campaignColumns.includes('ref_code')) {
      this.db.exec('ALTER TABLE campaigns ADD COLUMN ref_code TEXT;');
    }
    this.db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_campaign_ref_code ON campaigns(ref_code) WHERE ref_code IS NOT NULL;');
  }

  seedCampaign({ id, keyword, refCode, rewardLabel }) {
    this.db.prepare(`
      INSERT INTO campaigns (id, keyword, ref_code, reward_label, active, created_at)
      VALUES (?, ?, ?, ?, 1, ?)
      ON CONFLICT(id) DO UPDATE SET
        keyword = excluded.keyword,
        ref_code = excluded.ref_code,
        reward_label = excluded.reward_label
    `).run(id, keyword, refCode, rewardLabel, nowIso());
  }

  getCampaign(id) {
    return this.db.prepare('SELECT * FROM campaigns WHERE id = ? AND active = 1').get(id) ?? null;
  }

  getCampaignByKeyword(keyword) {
    return this.db.prepare('SELECT * FROM campaigns WHERE keyword = ? AND active = 1').get(String(keyword).trim()) ?? null;
  }

  getCampaignByRef(refCode) {
    return this.db.prepare('SELECT * FROM campaigns WHERE ref_code = ? AND active = 1').get(String(refCode).trim()) ?? null;
  }

  issueCampaignPass({ campaignId, passHash, ttlMs = 24 * 60 * 60 * 1000 }) {
    const issuedAt = nowIso();
    const expiresAt = new Date(Date.now() + ttlMs).toISOString();
    this.db.prepare(`
      INSERT INTO campaign_passes (pass_hash, campaign_id, issued_at, expires_at)
      VALUES (?, ?, ?, ?)
    `).run(passHash, campaignId, issuedAt, expiresAt);
    this.#audit('campaign_pass_issued', campaignId, null, null, { expiresAt });
    return { campaignId, issuedAt, expiresAt };
  }

  consumeCampaignPass({ passHash, instagramScopedId, subjectRef = null }) {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const pass = this.db.prepare(`
        SELECT p.*, c.active
        FROM campaign_passes p
        JOIN campaigns c ON c.id = p.campaign_id
        WHERE p.pass_hash = ?
      `).get(passHash);

      if (!pass || pass.active !== 1) {
        this.#audit('campaign_pass_invalid', null, null, subjectRef, {});
        this.db.exec('COMMIT');
        return { status: 'invalid' };
      }

      if (Date.parse(pass.expires_at) <= Date.now()) {
        this.#audit('campaign_pass_expired', pass.campaign_id, null, subjectRef, {});
        this.db.exec('COMMIT');
        return { status: 'expired', campaignId: pass.campaign_id };
      }

      if (pass.consumed_at) {
        const sameIdentity = pass.instagram_scoped_id === instagramScopedId;
        this.#audit('campaign_pass_reused', pass.campaign_id, null, subjectRef, { sameIdentity });
        this.db.exec('COMMIT');
        return {
          status: sameIdentity ? 'already_consumed_by_identity' : 'used',
          campaignId: pass.campaign_id,
        };
      }

      const consumedAt = nowIso();
      const result = this.db.prepare(`
        UPDATE campaign_passes
        SET consumed_at = ?, instagram_scoped_id = ?
        WHERE pass_hash = ? AND consumed_at IS NULL
      `).run(consumedAt, instagramScopedId, passHash);

      if (result.changes !== 1) {
        this.db.exec('ROLLBACK');
        return { status: 'conflict' };
      }

      this.#audit('campaign_pass_consumed', pass.campaign_id, null, subjectRef, {});
      this.db.exec('COMMIT');
      return { status: 'consumed', campaignId: pass.campaign_id, consumedAt };
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
  }

  recordAttribution({ instagramScopedId, campaignId, refCode, source = null, subjectRef = null }) {
    const attributedAt = nowIso();
    this.db.prepare(`
      INSERT INTO campaign_attributions (instagram_scoped_id, campaign_id, ref_code, source, attributed_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(instagram_scoped_id, campaign_id) DO UPDATE SET
        ref_code = excluded.ref_code,
        source = excluded.source,
        attributed_at = excluded.attributed_at
    `).run(instagramScopedId, campaignId, refCode, source, attributedAt);
    this.#audit('campaign_attributed', campaignId, null, subjectRef, { refCode, source });
    return { campaignId, attributedAt };
  }

  getAttributedCampaign(instagramScopedId) {
    return this.db.prepare(`
      SELECT c.*
      FROM campaign_attributions a
      JOIN campaigns c ON c.id = a.campaign_id
      WHERE a.instagram_scoped_id = ? AND c.active = 1
      ORDER BY a.attributed_at DESC
      LIMIT 1
    `).get(instagramScopedId) ?? null;
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
        SELECT
          c.id,
          c.campaign_id,
          c.instagram_scoped_id,
          c.redeemed_at,
          ca.reward_label,
          p.follows_business,
          EXISTS(
            SELECT 1 FROM campaign_attributions a
            WHERE a.campaign_id = c.campaign_id
              AND a.instagram_scoped_id = c.instagram_scoped_id
          ) AS source_verified
        FROM claims c
        JOIN campaigns ca ON ca.id = c.campaign_id
        JOIN participants p ON p.instagram_scoped_id = c.instagram_scoped_id
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
        return {
          status: 'already_redeemed',
          claimId: claim.id,
          redeemedAt: claim.redeemed_at,
          rewardLabel: claim.reward_label,
          sourceVerified: claim.source_verified === 1,
          followsBusiness: claim.follows_business == null ? null : claim.follows_business === 1,
        };
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
      return {
        status: 'redeemed',
        claimId: claim.id,
        redeemedAt,
        rewardLabel: claim.reward_label,
        sourceVerified: claim.source_verified === 1,
        followsBusiness: claim.follows_business == null ? null : claim.follows_business === 1,
      };
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
