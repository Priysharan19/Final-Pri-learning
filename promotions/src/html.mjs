function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

const shell = (title, body) => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#090d1a">
<title>${escapeHtml(title)}</title>
<style>
:root{font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#f7f8fc;background:#090d1a}*{box-sizing:border-box}body{margin:0;min-height:100vh;background:radial-gradient(circle at 20% 0%,#253167 0,#11172f 34%,#090d1a 70%);color:#f7f8fc}.wrap{width:min(720px,calc(100% - 32px));margin:0 auto;padding:54px 0 72px}.brand{display:flex;align-items:center;gap:10px;font-weight:800;letter-spacing:-.02em}.mark{width:34px;height:34px;border-radius:10px;background:linear-gradient(135deg,#8ea2ff,#d9e0ff);display:grid;place-items:center;color:#11162a;font-weight:900}.card{margin-top:28px;border:1px solid rgba(255,255,255,.12);background:rgba(17,23,47,.82);backdrop-filter:blur(18px);border-radius:26px;padding:30px;box-shadow:0 24px 80px rgba(0,0,0,.3)}h1{font-size:clamp(34px,7vw,58px);line-height:.98;letter-spacing:-.055em;margin:16px 0}h2{font-size:22px;margin:30px 0 8px;letter-spacing:-.02em}p,li{color:#c8cde0;font-size:17px;line-height:1.6}ul{padding-left:22px}.eyebrow{display:inline-flex;padding:8px 11px;border-radius:999px;background:rgba(143,161,255,.13);border:1px solid rgba(143,161,255,.25);font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#cbd4ff}.steps{display:grid;gap:12px;margin:28px 0}.step{display:flex;gap:14px;align-items:flex-start;padding:16px;border-radius:18px;background:rgba(255,255,255,.05)}.num{flex:0 0 30px;width:30px;height:30px;border-radius:10px;background:#eef1ff;color:#11162a;display:grid;place-items:center;font-weight:900}.step b{display:block;margin-bottom:3px}.step span{color:#b8bfd5;line-height:1.45}.button{display:block;width:100%;text-align:center;text-decoration:none;border:0;border-radius:16px;padding:15px 18px;background:#f4f6ff;color:#11162a;font-weight:850;font-size:16px;cursor:pointer}.button.secondary{margin-top:10px;background:rgba(255,255,255,.08);color:#eef1ff;border:1px solid rgba(255,255,255,.12)}.note{font-size:13px;color:#8e97b1;margin-top:16px}.code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-weight:900;letter-spacing:.08em;padding:5px 8px;border-radius:8px;background:rgba(255,255,255,.08);color:#fff}.form{display:grid;gap:12px}.form label{font-size:13px;color:#aeb6d0}.form input{width:100%;border-radius:14px;border:1px solid rgba(255,255,255,.14);background:#0c1125;color:#fff;padding:15px;font-size:17px;outline:none}.form input:focus{border-color:#9aaaff}.result{margin-top:18px;border-radius:16px;padding:16px;display:none}.result.good{display:block;background:rgba(64,207,132,.12);border:1px solid rgba(64,207,132,.32)}.result.bad{display:block;background:rgba(255,100,100,.1);border:1px solid rgba(255,100,100,.28)}.tiny{font-size:12px;color:#7d86a0}.divider{height:1px;background:rgba(255,255,255,.08);margin:24px 0}.legal a,.footer a{color:#dce2ff}.footer{margin-top:24px;display:flex;gap:16px;flex-wrap:wrap;font-size:13px}.footer a{font-size:13px}.updated{color:#8e97b1;font-size:13px}@media(max-width:560px){.wrap{padding-top:26px}.card{padding:22px;border-radius:22px}}
</style>
</head><body><main class="wrap">${body}</main></body></html>`;

const legalFooter = `
  <div class="footer">
    <a href="/privacy">Privacy</a>
    <a href="/data-deletion">Data deletion</a>
    <a href="/terms">Promotion terms</a>
  </div>`;

export function campaignPage({ instagramUsername, keyword, refCode, rewardLabel }) {
  const dmUrl = `https://ig.me/m/${encodeURIComponent(instagramUsername)}?ref=${encodeURIComponent(refCode)}`;
  const profileUrl = `https://www.instagram.com/${encodeURIComponent(instagramUsername)}/`;
  return shell('Pri Learning · Claim', `
    <div class="brand"><span class="mark">P</span> PRI LEARNING</div>
    <section class="card">
      <span class="eyebrow">A2Z × Pri Learning</span>
      <h1>Follow. Verify.<br>Get your reward.</h1>
      <p>This QR identifies the A2Z campaign. To receive your ${escapeHtml(rewardLabel)}, follow @${escapeHtml(instagramUsername)}, enter the tracked A2Z Instagram conversation, and let Pri Learning verify your follow before issuing a one-time code.</p>
      <div class="steps">
        <div class="step"><span class="num">1</span><div><b>Follow @${escapeHtml(instagramUsername)}</b><span>Open the Instagram profile and follow the account. The reward is only issued after Instagram confirms the follow.</span></div></div>
        <div class="step"><span class="num">2</span><div><b>Open the tracked A2Z DM</b><span>The tracked button carries this QR campaign’s referral ID into Instagram so the system can attribute the claim to A2Z.</span></div></div>
        <div class="step"><span class="num">3</span><div><b>Send <span class="code">${escapeHtml(keyword)}</span></b><span>Pri Learning checks the A2Z referral and your Instagram follow state. If both are verified and you have not already redeemed, a claim code is sent back.</span></div></div>
        <div class="step"><span class="num">4</span><div><b>Show your one-time code</b><span>A2Z staff redeems it once. After redemption, this Instagram identity cannot claim again even if it later unfollows and follows again.</span></div></div>
      </div>
      <a class="button" href="${profileUrl}" rel="noopener noreferrer">1. Follow @${escapeHtml(instagramUsername)}</a>
      <a class="button secondary" href="${dmUrl}" rel="noopener noreferrer">2. Continue to A2Z verification DM</a>
      <p class="note">A valid reward requires both the tracked A2Z Instagram referral and a verified follow of @${escapeHtml(instagramUsername)}. One redeemed reward is permanently allowed per Instagram identity for this campaign.</p>
      ${legalFooter}
    </section>
  `);
}

export function staffPage() {
  return shell('Pri Learning · Staff Redemption', `
    <div class="brand"><span class="mark">P</span> PRI LEARNING · STAFF</div>
    <section class="card">
      <span class="eyebrow">Redemption console</span>
      <h1>Verify a claim.</h1>
      <p>Enter the customer’s one-time Pri code. Valid codes were issued only after A2Z campaign attribution and Instagram follow verification. A successful redemption is atomic: the same reward cannot be accepted twice.</p>
      <form id="redeem" class="form">
        <label>Claim code<input name="code" autocomplete="off" autocapitalize="characters" placeholder="PRI-ABCD-2345" required></label>
        <label>Staff PIN<input name="pin" type="password" inputmode="numeric" autocomplete="current-password" required></label>
        <button class="button" type="submit">Redeem reward</button>
      </form>
      <div id="result" class="result" role="status" aria-live="polite"></div>
      <div class="divider"></div>
      <p class="tiny">Do not redeem from screenshots you cannot inspect clearly. The server is the source of truth; green means accepted, red means do not issue another reward.</p>
      ${legalFooter}
    </section>
    <script>
    const form=document.getElementById('redeem');const result=document.getElementById('result');
    form.addEventListener('submit',async(e)=>{e.preventDefault();result.className='result';result.textContent='Checking…';const fd=new FormData(form);try{const r=await fetch('/api/redeem',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({code:fd.get('code'),pin:fd.get('pin')})});const j=await r.json();if(j.status==='redeemed'){const follow=j.followsBusiness===true?'follow verified at claim':j.followsBusiness===false?'follow not verified':'follow state unavailable';const source=j.sourceVerified?'A2Z QR verified':'source not verified';result.className='result good';result.textContent='✓ VALID — '+source+' · '+follow+'. Give 1 '+j.rewardLabel+'. This claim is now permanently redeemed.';form.elements.code.value='';}else if(j.status==='already_redeemed'){result.className='result bad';result.textContent='✕ ALREADY REDEEMED — do not issue another reward.';}else if(j.error==='invalid_staff_pin'){result.className='result bad';result.textContent='✕ Staff PIN incorrect.';}else{result.className='result bad';result.textContent='✕ INVALID CODE — do not issue a reward.';}}catch{result.className='result bad';result.textContent='Could not reach the verification server. Do not redeem until online.';}});
    </script>
  `);
}

export function privacyPage() {
  return shell('Pri Learning Promotions · Privacy', `
    <div class="brand"><span class="mark">P</span> PRI LEARNING</div>
    <section class="card legal">
      <span class="eyebrow">Privacy notice</span>
      <h1>Promotion privacy.</h1>
      <p class="updated">Last updated 28 August 2026</p>
      <p>This notice applies to the Pri Learning × A2Z Instagram reward service. It is separate from the main Pri Learning educational app.</p>

      <h2>What data we receive</h2>
      <ul>
        <li>an Instagram-scoped identifier supplied by Meta after you interact with the Pri Learning professional account;</li>
        <li>profile fields Meta makes available for the messaging interaction, which may include your Instagram username, display name and whether you follow the Pri Learning business account;</li>
        <li>the A2Z campaign referral associated with the tracked Instagram link;</li>
        <li>claim issuance and redemption status, timestamps and security/audit events;</li>
        <li>limited technical information required for service security and staff redemption rate limiting. Hosting providers may also process ordinary request metadata.</li>
      </ul>

      <h2>Why we use it</h2>
      <p>We use this information only to attribute the A2Z promotion, verify eligibility, issue and redeem a one-time reward, prevent duplicate claims, operate the service securely, investigate abuse and maintain an audit trail. We do not ask for your Instagram password and do not scrape Instagram.</p>

      <h2>Sharing</h2>
      <p>The service relies on Meta/Instagram for messaging and identity signals and on infrastructure providers used to host the promotion service and database. A2Z staff receive only the information needed to validate a reward. We do not sell promotion participant data.</p>

      <h2>Retention</h2>
      <p>Promotion records are retained only for as long as reasonably needed to operate the campaign, resolve disputes, prevent duplicate redemptions and meet security or legal obligations. Where possible, records used only for security or anti-abuse purposes are minimized.</p>

      <h2>Your choices</h2>
      <p>You can stop messaging or unfollow the Instagram account at any time. To request access, correction or deletion of promotion data, use the <a href="/data-deletion">data deletion instructions</a>. We may need to verify that the request comes from the Instagram account concerned.</p>

      <h2>Contact</h2>
      <p>For privacy questions about this promotion, contact Pri Learning through the official Instagram account <a href="https://www.instagram.com/pri.learning/" rel="noopener noreferrer">@pri.learning</a>.</p>
      ${legalFooter}
    </section>
  `);
}

export function dataDeletionPage() {
  return shell('Pri Learning Promotions · Data Deletion', `
    <div class="brand"><span class="mark">P</span> PRI LEARNING</div>
    <section class="card legal">
      <span class="eyebrow">User data deletion</span>
      <h1>Request deletion.</h1>
      <p class="updated">Last updated 28 August 2026</p>
      <p>You can ask Pri Learning to delete or anonymize personal data held by the A2Z promotion service.</p>

      <h2>How to request deletion</h2>
      <ol>
        <li>Open the official Instagram account <a href="https://www.instagram.com/pri.learning/" rel="noopener noreferrer">@pri.learning</a>.</li>
        <li>From the same Instagram account that used the A2Z promotion, send a direct message saying <strong>“A2Z data deletion request”</strong>.</li>
        <li>We will use the messaging identity supplied by Meta to verify that the request relates to that account. We will not ask for your Instagram password.</li>
        <li>After verification, data that is not required for security, fraud prevention, dispute handling or legal obligations will be deleted or anonymized. Any limited record that must be retained will be minimized and used only for that purpose.</li>
      </ol>

      <h2>What this covers</h2>
      <p>This process covers the A2Z promotion participant/profile data, campaign attribution and associated promotion records controlled by Pri Learning. Removing the Pri Learning app or permissions from Meta does not necessarily delete records already received by the promotion service, so use the request process above if you want those records reviewed for deletion.</p>

      <h2>Need help?</h2>
      <p>Contact <a href="https://www.instagram.com/pri.learning/" rel="noopener noreferrer">@pri.learning</a> and state that your message concerns an A2Z promotion privacy or deletion request.</p>
      ${legalFooter}
    </section>
  `);
}

export function termsPage() {
  return shell('Pri Learning Promotions · Terms', `
    <div class="brand"><span class="mark">P</span> PRI LEARNING</div>
    <section class="card legal">
      <span class="eyebrow">Promotion terms</span>
      <h1>A2Z reward terms.</h1>
      <p class="updated">Last updated 28 August 2026</p>
      <ul>
        <li>The offer is limited to one successfully redeemed reward per eligible Instagram identity for the A2Z campaign.</li>
        <li>Eligibility requires the tracked A2Z Instagram referral and a follow of the designated Pri Learning Instagram professional account that the service can verify through Meta at claim time.</li>
        <li>A code must be valid and successfully redeemed by A2Z staff before the reward is provided.</li>
        <li>Once redeemed, unfollowing and following again does not create a new entitlement.</li>
        <li>Attempts to manipulate referrals, codes, accounts or redemption systems may be rejected.</li>
        <li>The promotion may be suspended or ended if the technical service, Meta platform access, stock or store operations make fulfilment unavailable.</li>
      </ul>
      <p>These terms describe the technical promotion flow and do not override rights that cannot lawfully be excluded.</p>
      ${legalFooter}
    </section>
  `);
}
