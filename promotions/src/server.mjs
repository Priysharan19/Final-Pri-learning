import http from 'node:http';
import { URL } from 'node:url';
import { loadConfig } from './config.mjs';
import { campaignPage, dataDeletionPage, privacyPage, staffPage, termsPage } from './html.mjs';
import {
  ensureInstagramWebhookSubscription,
  fetchInstagramProfile,
  extractInstagramMessages,
  extractInstagramReferrals,
  sendInstagramText,
} from './instagram.mjs';
import { PromotionsStore } from './store.mjs';
import {
  anonymizeId,
  createCampaignPassCode,
  createClaimCode,
  hashCampaignPassCode,
  hashClaimCode,
  safeEqualText,
  verifyMetaSignature,
} from './security.mjs';

const config = loadConfig();
const store = new PromotionsStore(config.dbPath);
store.seedCampaign({
  id: config.campaignId,
  keyword: config.campaignKeyword,
  refCode: config.campaignRef,
  rewardLabel: config.rewardLabel,
});

const redemptionAttempts = new Map();
const MAX_BODY = 256 * 1024;
const CAMPAIGN_PASS_TTL_MS = 15 * 60 * 1000;
const runtimeStatus = {
  instagramWebhookSubscription: config.isProduction ? 'pending' : 'development',
  lastWebhookAt: null,
  lastReferralAt: null,
  lastQrPassAt: null,
  lastMessageAt: null,
  lastProcessingErrorAt: null,
};
let subscriptionTimer = null;

function setSecurityHeaders(res, contentType = 'text/plain; charset=utf-8') {
  res.setHeader('Content-Type', contentType);
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.setHeader('Content-Security-Policy', "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self' https://www.instagram.com https://ig.me");
}

function json(res, status, body) {
  res.statusCode = status;
  setSecurityHeaders(res, 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}
function html(res, status, body) {
  res.statusCode = status;
  setSecurityHeaders(res, 'text/html; charset=utf-8');
  res.end(body);
}
function text(res, status, body) {
  res.statusCode = status;
  setSecurityHeaders(res);
  res.end(body);
}
async function readRawBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY) throw Object.assign(new Error('Body too large'), { statusCode: 413 });
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
function parseJsonBody(raw) {
  if (!raw.length) return {};
  try { return JSON.parse(raw.toString('utf8')); }
  catch { throw Object.assign(new Error('Invalid JSON'), { statusCode: 400 }); }
}
function remoteKey(req) { return req.socket.remoteAddress || 'unknown'; }
function redemptionRateLimited(req) {
  const key = remoteKey(req);
  const now = Date.now();
  const previous = (redemptionAttempts.get(key) ?? []).filter((ts) => now - ts < 60_000);
  previous.push(now);
  redemptionAttempts.set(key, previous);
  return previous.length > 12;
}
function subjectRef(scopedId) { return `ig:${anonymizeId(scopedId, config.claimSecret)}`; }
function matchesCampaignKeyword(messageText, campaignKeyword) {
  return String(messageText ?? '').trim().toLowerCase() === String(campaignKeyword ?? '').trim().toLowerCase();
}
function parseCampaignPassMessage(messageText) {
  const match = String(messageText ?? '').trim().match(/^([^\s]+)\s+(A2Z-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4})$/i);
  if (!match) return null;
  return { keyword: match[1], passCode: match[2].toUpperCase() };
}

async function refreshInstagramWebhookSubscription() {
  if (!config.isProduction) return;
  try {
    await ensureInstagramWebhookSubscription({
      accountId: config.instagramAccountId,
      accessToken: config.instagramAccessToken,
      apiVersion: config.metaApiVersion,
      fields: ['messages', 'messaging_referral'],
    });
    runtimeStatus.instagramWebhookSubscription = 'subscribed';
    console.log(JSON.stringify({
      level: 'info',
      event: 'instagram_webhooks_subscribed',
      fields: ['messages', 'messaging_referral'],
    }));
  } catch (error) {
    runtimeStatus.instagramWebhookSubscription = 'error';
    console.error(JSON.stringify({
      level: 'error',
      event: 'instagram_webhook_subscription_failed',
      message: error.message,
    }));
  }
}

async function issueForInstagramIdentity({ campaign, senderId, profile }) {
  store.upsertParticipant({
    instagramScopedId: senderId,
    username: profile?.username ?? null,
    displayName: profile?.name ?? null,
    followsBusiness: profile?.followsBusiness ?? null,
  });
  const code = createClaimCode();
  const result = store.issueOrRotateClaim({
    campaignId: campaign.id,
    instagramScopedId: senderId,
    codeHash: hashClaimCode(config.claimSecret, code),
    followsBusiness: profile?.followsBusiness ?? null,
    subjectRef: subjectRef(senderId),
  });
  return result.status === 'already_redeemed' ? result : { ...result, code };
}

async function sendToInstagram(senderId, message) {
  return sendInstagramText({
    accountId: config.instagramAccountId,
    recipientScopedId: senderId,
    text: message,
    accessToken: config.instagramAccessToken,
    apiVersion: config.metaApiVersion,
  });
}

async function processInstagramPayload(payload) {
  const referrals = extractInstagramReferrals(payload);
  if (referrals.length) runtimeStatus.lastReferralAt = new Date().toISOString();
  for (const referral of referrals) {
    const campaign = store.getCampaignByRef(referral.ref);
    if (!campaign) continue;
    store.recordAttribution({
      instagramScopedId: referral.senderId,
      campaignId: campaign.id,
      refCode: referral.ref,
      source: referral.source,
      subjectRef: subjectRef(referral.senderId),
    });
  }

  const messages = extractInstagramMessages(payload);
  if (messages.length) runtimeStatus.lastMessageAt = new Date().toISOString();
  for (const message of messages) {
    let attributedCampaign = store.getAttributedCampaign(message.senderId);
    const passMessage = parseCampaignPassMessage(message.text);

    if (!attributedCampaign && passMessage) {
      const campaign = store.getCampaignByKeyword(passMessage.keyword);
      if (campaign) {
        const passHash = hashCampaignPassCode(config.claimSecret, passMessage.passCode);
        const passResult = store.consumeCampaignPass({
          passHash,
          instagramScopedId: message.senderId,
          subjectRef: subjectRef(message.senderId),
        });

        if (passResult.status === 'consumed' && passResult.campaignId === campaign.id) {
          runtimeStatus.lastQrPassAt = new Date().toISOString();
          store.recordAttribution({
            instagramScopedId: message.senderId,
            campaignId: campaign.id,
            refCode: `qr-pass:${passHash.slice(0, 12)}`,
            source: 'QR_PASS',
            subjectRef: subjectRef(message.senderId),
          });
          attributedCampaign = campaign;
        } else if (passResult.status === 'already_consumed_by_identity' && passResult.campaignId === campaign.id) {
          attributedCampaign = store.getAttributedCampaign(message.senderId);
        } else {
          await sendToInstagram(message.senderId,
            `That A2Z verification code is ${passResult.status === 'expired' ? 'expired' : 'not valid anymore'}. Re-open the official A2Z QR page to get a fresh verification message, then send the full message shown there.`);
          continue;
        }
      }
    }

    if (!attributedCampaign) {
      const keywordCampaign = store.getCampaignByKeyword(message.text);
      if (keywordCampaign) {
        await sendToInstagram(message.senderId,
          `This reward is reserved for the A2Z QR campaign. Re-open the official A2Z QR page and send the full verification message shown there (it starts with ${keywordCampaign.keyword}).`);
      }
      continue;
    }

    const campaign = attributedCampaign;
    if (!matchesCampaignKeyword(message.text, campaign.keyword) && !passMessage) continue;

    let profile = null;
    try {
      profile = await fetchInstagramProfile({
        scopedId: message.senderId,
        accessToken: config.instagramAccessToken,
        apiVersion: config.metaApiVersion,
      });
    } catch (error) {
      console.error(JSON.stringify({
        level: 'warn',
        event: 'instagram_profile_lookup_failed_nonblocking',
        subject: subjectRef(message.senderId),
        message: error.message,
      }));
    }

    const claim = await issueForInstagramIdentity({ campaign, senderId: message.senderId, profile });
    const reply = claim.status === 'already_redeemed'
      ? `This ${campaign.reward_label} has already been redeemed for this campaign. The same Instagram identity cannot receive another reward.`
      : `A2Z QR verified. Your one-time code is ${claim.code}. Show it to A2Z staff. Once redeemed, this Instagram identity cannot claim again.${profile?.followsBusiness === true ? ` Thanks for following @${config.instagramUsername}.` : ` Following @${config.instagramUsername} is optional and does not affect this reward.`}`;

    await sendToInstagram(message.senderId, reply);
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, config.publicBaseUrl);
    if (req.method === 'GET' && url.pathname === '/health') {
      return json(res, 200, {
        ok: true,
        service: 'pri-promotions',
        campaign: config.campaignId,
        instagramWebhookSubscription: runtimeStatus.instagramWebhookSubscription,
        lastWebhookAt: runtimeStatus.lastWebhookAt,
        lastReferralAt: runtimeStatus.lastReferralAt,
        lastQrPassAt: runtimeStatus.lastQrPassAt,
        lastMessageAt: runtimeStatus.lastMessageAt,
        lastProcessingErrorAt: runtimeStatus.lastProcessingErrorAt,
      });
    }
    if (req.method === 'GET' && url.pathname === '/robots.txt') {
      return text(res, 200, 'User-agent: *\nAllow: /\n');
    }
    if (req.method === 'GET' && url.pathname === '/privacy') return html(res, 200, privacyPage());
    if (req.method === 'GET' && url.pathname === '/data-deletion') return html(res, 200, dataDeletionPage());
    if (req.method === 'GET' && url.pathname === '/terms') return html(res, 200, termsPage());
    if (req.method === 'GET' && url.pathname === '/') {
      res.statusCode = 302;
      res.setHeader('Location', `/c/${encodeURIComponent(config.campaignId)}`);
      res.end();
      return;
    }
    if (req.method === 'GET' && url.pathname.startsWith('/c/')) {
      const campaign = store.getCampaign(decodeURIComponent(url.pathname.slice(3)));
      if (!campaign) return text(res, 404, 'Campaign not found.');
      const campaignPassCode = createCampaignPassCode();
      store.issueCampaignPass({
        campaignId: campaign.id,
        passHash: hashCampaignPassCode(config.claimSecret, campaignPassCode),
        ttlMs: CAMPAIGN_PASS_TTL_MS,
      });
      return html(res, 200, campaignPage({
        instagramUsername: config.instagramUsername,
        keyword: campaign.keyword,
        refCode: campaign.ref_code,
        rewardLabel: campaign.reward_label,
        campaignPassCode,
      }));
    }
    if (req.method === 'GET' && url.pathname === '/staff') return html(res, 200, staffPage());
    if (req.method === 'GET' && url.pathname === '/webhooks/instagram') {
      const mode = url.searchParams.get('hub.mode');
      const token = url.searchParams.get('hub.verify_token');
      const challenge = url.searchParams.get('hub.challenge');
      if (mode === 'subscribe' && challenge && safeEqualText(token, config.metaVerifyToken)) return text(res, 200, challenge);
      return text(res, 403, 'Verification failed.');
    }
    if (req.method === 'POST' && url.pathname === '/webhooks/instagram') {
      const raw = await readRawBody(req);
      if (config.metaAppSecret && !verifyMetaSignature(config.metaAppSecret, raw, req.headers['x-hub-signature-256'])) {
        return text(res, 401, 'Invalid webhook signature.');
      }
      const payload = parseJsonBody(raw);
      runtimeStatus.lastWebhookAt = new Date().toISOString();
      text(res, 200, 'EVENT_RECEIVED');
      void processInstagramPayload(payload).catch((error) => {
        runtimeStatus.lastProcessingErrorAt = new Date().toISOString();
        console.error(JSON.stringify({ level: 'error', event: 'instagram_webhook_processing_failed', message: error.message }));
      });
      return;
    }
    if (req.method === 'POST' && url.pathname === '/api/redeem') {
      if (redemptionRateLimited(req)) return json(res, 429, { error: 'too_many_attempts' });
      const body = parseJsonBody(await readRawBody(req));
      if (!safeEqualText(body.pin, config.staffPin)) return json(res, 403, { error: 'invalid_staff_pin' });
      const code = String(body.code ?? '');
      if (!/^PRI-[2-9A-HJ-NP-Z]{4}-[2-9A-HJ-NP-Z]{4}$/i.test(code.trim())) return json(res, 400, { status: 'invalid' });
      const result = store.redeemByCodeHash({
        codeHash: hashClaimCode(config.claimSecret, code),
        subjectRef: `staff:${remoteKey(req)}`,
      });
      if (result.status === 'redeemed') return json(res, 200, result);
      if (result.status === 'already_redeemed') return json(res, 409, result);
      return json(res, 404, result);
    }
    if (!config.isProduction && req.method === 'POST' && url.pathname === '/dev/simulate') {
      const body = parseJsonBody(await readRawBody(req));
      if (!safeEqualText(body.pin, config.staffPin)) return json(res, 403, { error: 'invalid_staff_pin' });
      const senderId = String(body.instagramScopedId || `dev-${Date.now()}`);
      const campaign = store.getCampaign(config.campaignId);
      const profile = {
        id: senderId,
        username: body.username ?? 'demo_user',
        name: body.name ?? 'Demo User',
        followsBusiness: typeof body.followsBusiness === 'boolean' ? body.followsBusiness : null,
      };
      const claim = await issueForInstagramIdentity({ campaign, senderId, profile });
      return json(res, 200, claim);
    }
    return text(res, 404, 'Not found.');
  } catch (error) {
    const status = error.statusCode || 500;
    if (status >= 500) console.error(error);
    if (!res.headersSent) return json(res, status, { error: status >= 500 ? 'internal_error' : error.message });
    res.end();
  }
});

server.listen(config.port, () => {
  console.log(`Pri Promotions listening on ${config.publicBaseUrl} (port ${config.port})`);
  if (!config.isProduction) {
    console.log(`Development simulator enabled: POST ${config.publicBaseUrl}/dev/simulate`);
  } else {
    void refreshInstagramWebhookSubscription();
    subscriptionTimer = setInterval(() => void refreshInstagramWebhookSubscription(), 15 * 60 * 1000);
    subscriptionTimer.unref();
  }
});

function shutdown() {
  if (subscriptionTimer) clearInterval(subscriptionTimer);
  server.close(() => {
    store.close();
    process.exit(0);
  });
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
