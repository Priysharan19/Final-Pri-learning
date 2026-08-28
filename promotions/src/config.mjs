import { resolve } from 'node:path';

function env(name, fallback = '') {
  const value = process.env[name];
  return value == null || value === '' ? fallback : value;
}

export function loadConfig() {
  const nodeEnv = env('NODE_ENV', 'development');
  const isProduction = nodeEnv === 'production';
  const config = {
    nodeEnv,
    isProduction,
    port: Number(env('PORT', '8787')),
    publicBaseUrl: env('PUBLIC_BASE_URL', 'http://localhost:8787').replace(/\/$/, ''),
    dbPath: env('PROMOTIONS_DB_PATH', resolve(process.cwd(), '.data', 'pri-promotions.sqlite')),
    claimSecret: env('CLAIM_SECRET', isProduction ? '' : 'dev-only-claim-secret-change-me'),
    staffPin: env('STAFF_PIN', isProduction ? '' : '2468'),
    instagramUsername: env('INSTAGRAM_USERNAME', 'pri.learning'),
    instagramAccountId: env('INSTAGRAM_ACCOUNT_ID'),
    instagramAccessToken: env('INSTAGRAM_ACCESS_TOKEN'),
    metaAppSecret: env('META_APP_SECRET'),
    metaVerifyToken: env('META_VERIFY_TOKEN'),
    metaApiVersion: env('META_API_VERSION', 'v24.0'),
    campaignId: env('CAMPAIGN_ID', 'a2z'),
    campaignKeyword: env('CAMPAIGN_KEYWORD', 'A2Z'),
    campaignRef: env('CAMPAIGN_REF', 'pri-a2z-qr-2026'),
    rewardLabel: env('CAMPAIGN_REWARD_LABEL', 'Pri Learning reward'),
  };

  if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }
  if (!/^[A-Za-z0-9_=-]{1,200}$/.test(config.campaignRef)) {
    throw new Error('CAMPAIGN_REF may contain only letters, numbers, _, =, and - and must be 1-200 characters.');
  }

  if (isProduction) {
    const required = [
      ['CLAIM_SECRET', config.claimSecret],
      ['STAFF_PIN', config.staffPin],
      ['META_APP_SECRET', config.metaAppSecret],
      ['META_VERIFY_TOKEN', config.metaVerifyToken],
      ['INSTAGRAM_ACCOUNT_ID', config.instagramAccountId],
      ['INSTAGRAM_ACCESS_TOKEN', config.instagramAccessToken],
    ];
    const missing = required.filter(([, value]) => !value).map(([name]) => name);
    if (missing.length) throw new Error(`Missing production environment variables: ${missing.join(', ')}`);
    if (config.claimSecret.length < 32) throw new Error('CLAIM_SECRET must be at least 32 characters in production.');
    if (config.staffPin.length < 6) throw new Error('STAFF_PIN must be at least 6 characters in production.');
  }

  return config;
}
