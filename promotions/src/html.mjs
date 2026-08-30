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
:root{font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#f7f8fc;background:#090d1a}*{box-sizing:border-box}body{margin:0;min-height:100vh;background:radial-gradient(circle at 20% 0%,#253167 0,#11172f 34%,#090d1a 70%);color:#f7f8fc}.wrap{width:min(720px,calc(100% - 32px));margin:0 auto;padding:54px 0 72px}.brand{display:flex;align-items:center;gap:10px;font-weight:800;letter-spacing:-.02em}.mark{width:34px;height:34px;border-radius:10px;background:linear-gradient(135deg,#8ea2ff,#d9e0ff);display:grid;place-items:center;color:#11162a;font-weight:900}.card{margin-top:28px;border:1px solid rgba(255,255,255,.12);background:rgba(17,23,47,.82);backdrop-filter:blur(18px);border-radius:26px;padding:30px;box-shadow:0 24px 80px rgba(0,0,0,.3)}h1{font-size:clamp(34px,7vw,58px);line-height:.98;letter-spacing:-.055em;margin:16px 0}h2{font-size:22px;margin:30px 0 8px;letter-spacing:-.02em}p,li{color:#c8cde0;font-size:17px;line-height:1.6}ul,ol{padding-left:22px}.eyebrow{display:inline-flex;padding:8px 11px;border-radius:999px;background:rgba(143,161,255,.13);border:1px solid rgba(143,161,255,.25);font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#cbd4ff}.steps{display:grid;gap:12px;margin:28px 0}.step{display:flex;gap:14px;align-items:flex-start;padding:16px;border-radius:18px;background:rgba(255,255,255,.05)}.num{flex:0 0 30px;width:30px;height:30px;border-radius:10px;background:#eef1ff;color:#11162a;display:grid;place-items:center;font-weight:900}.step b{display:block;margin-bottom:3px}.step span{color:#b8bfd5;line-height:1.45}.button{display:block;width:100%;text-align:center;text-decoration:none;border:0;border-radius:16px;padding:15px 18px;background:#f4f6ff;color:#11162a;font-weight:850;font-size:16px;cursor:pointer}.button.secondary{margin-top:10px;background:rgba(255,255,255,.08);color:#eef1ff;border:1px solid rgba(255,255,255,.12)}.note{font-size:13px;color:#8e97b1;margin-top:16px}.code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-weight:900;letter-spacing:.06em;padding:5px 8px;border-radius:8px;background:rgba(255,255,255,.08);color:#fff}.verify-box{margin:18px 0;padding:18px;border:1px solid rgba(143,161,255,.28);border-radius:18px;background:rgba(143,161,255,.08)}.verify-message{display:block;margin:10px 0 14px;padding:14px;border-radius:12px;background:#090d1a;color:#fff;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-weight:900;font-size:18px;letter-spacing:.04em;word-break:break-word}.copy-status{font-size:13px;color:#aeb6d0;margin-top:10px;min-height:20px}.form{display:grid;gap:12px}.form label{font-size:13px;color:#aeb6d0}.form input{width:100%;border-radius:14px;border:1px solid rgba(255,255,255,.14);background:#0c1125;color:#fff;padding:15px;font-size:17px;outline:none}.form input:focus{border-color:#9aaaff}.result{margin-top:18px;border-radius:16px;padding:16px;display:none}.result.good{display:block;background:rgba(64,207,132,.12);border:1px solid rgba(64,207,132,.32)}.result.bad{display:block;background:rgba(255,100,100,.1);border:1px solid rgba(255,100,100,.28)}.tiny{font-size:12px;color:#7d86a0}.divider{height:1px;background:rgba(255,255,255,.08);margin:24px 0}.legal a,.footer a{color:#dce2ff}.footer{margin-top:24px;display:flex;gap:16px;flex-wrap:wrap;font-size:13px}.footer a{font-size:13px}.updated{color:#8e97b1;font-size:13px}@media(max-width:560px){.wrap{padding-top:26px}.card{padding:22px;border-radius:22px}}
</style>
</head><body><main class="wrap">${body}</main></body></html>`;

const legalFooter = `
  <div class="footer">
    <a href="/privacy">Privacy</a>
    <a href="/data-deletion">Data deletion</a>
    <a href="/terms">Promotion terms</a>
  </div>`;

// ─────────────────────────────────────────────────────────────────────────────
// The customer-facing campaign page.
//
// Set in the Pri Learning app's own design system — "Design system v4, Dark
// LaTeX" (client/src/theme.css): near-black paper, Computer Modern serif, ivory
// ink, cream for the primary action, one gold accent, 1px hairlines, small-caps
// labels. The counter poster uses the same language, so a person who scans a
// near-black Computer Modern poster lands on a near-black Computer Modern page.
//
// It does not use shell() — the shell carries the older Inter/indigo styling
// that the staff and legal pages still use.
// ─────────────────────────────────────────────────────────────────────────────
const CLAIM_FONTS = `
@font-face{font-family:'KaTeX_Main';src:url(/fonts/KaTeX_Main-Regular.woff2) format('woff2');font-weight:400;font-style:normal;font-display:swap}
@font-face{font-family:'KaTeX_Main';src:url(/fonts/KaTeX_Main-Bold.woff2) format('woff2');font-weight:700;font-style:normal;font-display:swap}
@font-face{font-family:'KaTeX_AMS';src:url(/fonts/KaTeX_AMS-Regular.woff2) format('woff2');font-weight:400;font-style:normal;font-display:swap}`;

// Every value is lifted verbatim from client/src/theme.css.
const CLAIM_CSS = `
:root{
  --page:#0a0a09;--surface:#101010;--surface-2:#161615;
  --hairline:rgba(240,236,224,0.13);--hairline-strong:rgba(240,236,224,0.24);--hairline-faint:rgba(240,236,224,0.07);
  --ink:#efece1;--ink-2:#b3afa2;--ink-3:#7c796d;
  --cream:#f4f1e0;--cream-ink:#131310;
  --gold:#c9ad63;--gold-bright:#e3c87e;
  --good:#5aa86c;--bad:#cf5f56;
  --radius:6px;--radius-sm:3px;
  --font:'KaTeX_Main','Latin Modern Roman','Computer Modern',Georgia,'Times New Roman',serif;
  --font-mono:'JetBrains Mono',ui-monospace,SFMono-Regular,Menlo,monospace;
  --ease:cubic-bezier(0.22,1,0.36,1);
  color-scheme:dark;
}
*,*::before,*::after{box-sizing:border-box}
html,body{height:100%}
body{margin:0;background:var(--page);color:var(--ink);font-family:var(--font);font-size:16px;line-height:1.55;-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)}
main{width:min(430px,100%);margin:0 auto;padding:22px 22px 34px;display:flex;flex-direction:column;min-height:100%}
a{color:inherit;text-decoration:none}
::selection{background:rgba(201,173,99,0.32)}
.head{display:flex;align-items:baseline;justify-content:space-between;gap:14px}
.logo{display:flex;align-items:baseline;gap:1px;user-select:none}
.logo-bb{font-family:'KaTeX_AMS',var(--font);font-size:21px;line-height:1;font-weight:400}
.logo-name{font-size:17px;letter-spacing:0.01em;font-weight:500}
.sc{font-size:10.5px;font-weight:500;text-transform:uppercase;letter-spacing:0.18em;color:var(--ink-3)}
.rule{height:1px;background:var(--hairline);margin:14px 0 0}
.kicker{font-size:11px;letter-spacing:0.32em;text-transform:uppercase;color:var(--gold);margin:28px 0 12px}
h1{margin:0;font-size:clamp(34px,13vw,54px);line-height:0.98;letter-spacing:-1px;font-weight:700;color:var(--ink);text-wrap:balance}
h1 .l2{display:block}
.card{margin-top:26px;background:var(--surface);border:1px solid var(--hairline);border-radius:var(--radius);padding:18px}
.label{margin:0 0 10px;font-size:10.5px;font-weight:500;text-transform:uppercase;letter-spacing:0.18em;color:var(--ink-3)}
.code{margin:0;font-family:var(--font-mono);font-size:21px;font-weight:700;letter-spacing:0.04em;color:var(--ink);word-break:break-word;line-height:1.35;background:var(--surface-2);border:1px solid var(--hairline-faint);border-radius:var(--radius-sm);padding:12px 13px;-webkit-user-select:all;user-select:all}
.expiry{margin:10px 0 0;font-size:12.5px;color:var(--ink-2);display:flex;align-items:center;gap:7px}
.expiry.warn{color:var(--gold-bright)}
.expiry.dead{color:var(--bad)}
.expiry svg{flex:0 0 auto}
.btn{display:flex;align-items:center;justify-content:center;gap:9px;width:100%;min-height:52px;padding:14px 20px;border-radius:var(--radius-sm);font-family:inherit;font-size:17px;font-weight:500;letter-spacing:0.01em;border:1px solid transparent;cursor:pointer;text-align:center;transition:background 0.13s var(--ease),border 0.13s var(--ease),color 0.13s var(--ease),transform 0.13s var(--ease)}
.btn:active{transform:scale(0.97)}
.btn-primary{background:var(--cream);color:var(--cream-ink);border-color:var(--cream);margin-top:16px}
.btn-ghost{background:none;color:var(--ink);border-color:var(--hairline-strong);margin-top:10px}
.status{margin:11px 0 0;font-size:13px;line-height:1.45;color:var(--ink-2)}
.status.ok{color:var(--good)}
.status.err{color:var(--bad)}
.status:empty{display:none}
.steps{list-style:none;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:9px;margin:26px 0 0;padding:0}
.steps li{border-top:1px solid var(--hairline);padding-top:9px;display:flex;flex-direction:column;gap:3px}
.steps .n{font-size:11px;color:var(--gold);line-height:1;display:flex;align-items:center;gap:4px;min-height:12px}
.steps .t{font-size:14px;color:var(--ink-2)}
.steps li.done{border-top-color:rgba(201,173,99,0.55)}
.steps li.done .t{color:var(--ink)}
.steps li.now{border-top-color:var(--ink)}
.steps li.now .t{color:var(--ink)}
.hint{margin:14px 0 0;font-size:13.5px;color:var(--ink-2)}
details{margin-top:26px;border-top:1px solid var(--hairline);padding-top:14px}
summary{font-size:13.5px;color:var(--ink-2);cursor:pointer;list-style:none;display:flex;align-items:center;gap:8px;min-height:24px}
summary::-webkit-details-marker{display:none}
summary .chev{transition:transform 0.16s var(--ease);color:var(--ink-3)}
details[open] summary .chev{transform:rotate(90deg)}
details p{margin:10px 0 0;font-size:13.5px;line-height:1.6;color:var(--ink-2)}
footer{margin-top:auto;padding-top:26px;display:flex;gap:16px;flex-wrap:wrap}
footer a{font-size:12px;color:var(--ink-2);border-bottom:1px solid var(--hairline);padding-bottom:1px}
@media (max-width:360px){.code{font-size:19px}}
@media (prefers-reduced-motion:reduce){*{transition:none !important}}`;

export function campaignPage({
  instagramUsername,
  keyword,
  refCode,
  rewardLabel,
  campaignPassCode,
  passExpiresAt = '',
}) {
  const dmUrl = `https://ig.me/m/${encodeURIComponent(instagramUsername)}?ref=${encodeURIComponent(refCode)}`;
  const profileUrl = `https://www.instagram.com/${encodeURIComponent(instagramUsername)}/`;
  const verificationMessage = `${keyword} ${campaignPassCode}`;
  const handle = `@${escapeHtml(instagramUsername)}`;
  const reward = escapeHtml(rewardLabel);
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#0a0a09">
<meta name="robots" content="noindex">
<title>Pri Learning · Claim</title>
<meta property="og:title" content="Free ${reward} · A2Z × Pri Learning">
<meta property="og:description" content="One scan, one follow, one ${reward} at the A2Z counter.">
<meta property="og:type" content="website">
<style>${CLAIM_FONTS}${CLAIM_CSS}
</style>
</head>
<body>
<main>

  <div class="head">
    <span class="logo"><span class="logo-bb">P</span><span class="logo-name">ri Learning.</span></span>
    <span class="sc">${escapeHtml(keyword)}</span>
  </div>
  <div class="rule"></div>

  <p class="kicker">No purchase necessary</p>
  <h1>Free<span class="l2">${reward}.</span></h1>

  <section class="card">
    <p class="label">Send this code</p>
    <p id="verification-message" class="code" data-expires-at="${escapeHtml(passExpiresAt)}">${escapeHtml(verificationMessage)}</p>
    <p class="expiry" id="expiry">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.8"/><path d="M12 7.5V12l3 2" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
      <span id="expiry-text">Valid for about 15 minutes</span>
    </p>
    <button id="copy-open" class="btn btn-primary" type="button">
      <span id="copy-open-text">Copy code, open Instagram</span>
      <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12h13M13 6.5 18.5 12 13 17.5" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </button>
    <p class="status" id="copy-status" role="status" aria-live="polite"></p>
  </section>

  <ol class="steps" id="steps">
    <li><span class="n">1</span><span class="t">Send</span></li>
    <li><span class="n">2</span><span class="t">Follow</span></li>
    <li><span class="n">3</span><span class="t">Return</span></li>
    <li><span class="n">4</span><span class="t">Tick</span></li>
  </ol>
  <p class="hint" id="hint">Show the green tick at the counter.</p>

  <a class="btn btn-ghost" id="follow" href="${profileUrl}" rel="noopener noreferrer">
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" stroke-width="1.7"/><circle cx="12" cy="12" r="4.1" stroke="currentColor" stroke-width="1.7"/><circle cx="17.2" cy="6.8" r="1.15" fill="currentColor"/></svg>
    <span id="follow-text">Follow ${handle}</span>
  </a>

  <details>
    <summary>
      <svg class="chev" width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 5l7 7-7 7" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      Why Instagram?
    </summary>
    <p>One ${reward} per person. The code ties this scan to your account, so nobody can claim twice. A green tick requires a current Instagram follow, and once this identity has redeemed, unfollowing and following again cannot create another reward.</p>
  </details>

  <footer>
    <a href="/privacy">Privacy</a>
    <a href="/data-deletion">Data deletion</a>
    <a href="/terms">Promotion terms</a>
  </footer>

</main>
<script>
(function () {
  var DM = ${JSON.stringify(dmUrl)};
  var PROFILE = ${JSON.stringify(profileUrl)};
  var TTL = 15 * 60 * 1000;
  var codeEl = document.getElementById('verification-message');
  var status = document.getElementById('copy-status');
  var btn = document.getElementById('copy-open');
  var btnText = document.getElementById('copy-open-text');
  var expiryText = document.getElementById('expiry-text');
  var expiryEl = document.getElementById('expiry');
  var steps = document.getElementById('steps').children;
  var hint = document.getElementById('hint');
  var followBtn = document.getElementById('follow');
  var code = (codeEl.textContent || '').trim();
  var expired = false;

  // Progress is per-code and local: the page cannot see whether the DM landed,
  // so it remembers only that this device took the step.
  var KEY = 'pri-a2z:' + code;
  function store(k, v) { try { localStorage.setItem(KEY + ':' + k, v); } catch (e) {} }
  function load(k) { try { return localStorage.getItem(KEY + ':' + k); } catch (e) { return null; } }

  var serverExpiry = Date.parse(codeEl.getAttribute('data-expires-at') || '');
  var deadline;
  if (!isNaN(serverExpiry)) {
    deadline = serverExpiry;
  } else {
    var first = parseInt(load('seen'), 10);
    if (!first) { first = Date.now(); store('seen', String(first)); }
    deadline = first + TTL;
  }
  function pad(n) { return n < 10 ? '0' + n : String(n); }
  function tickClock() {
    var left = deadline - Date.now();
    if (left <= 0) {
      // A dead code makes every other action pointless: the only useful button
      // left is the one that fetches a fresh one.
      expired = true;
      expiryEl.className = 'expiry dead';
      expiryText.textContent = 'This code has expired';
      btnText.textContent = 'Get a new code';
      status.className = 'status';
      status.textContent = '';
      return;
    }
    var m = Math.floor(left / 60000), s = Math.floor((left % 60000) / 1000);
    expiryEl.className = 'expiry' + (left < 3 * 60000 ? ' warn' : '');
    expiryText.textContent = 'Expires in ' + m + ':' + pad(s);
    setTimeout(tickClock, 1000);
  }
  tickClock();

  var CHECK = '<svg width="11" height="11" viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M4 10.6 8 14.4 16 5.6" stroke="#5aa86c" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  function paint() {
    var sent = load('sent') === '1';
    for (var i = 0; i < steps.length; i++) steps[i].className = '';
    if (sent) {
      steps[0].className = 'done';
      steps[0].querySelector('.n').innerHTML = CHECK;
      steps[1].className = 'now';
      if (!expired) { btnText.textContent = 'Follow ' + ${JSON.stringify(`@${instagramUsername}`)}; }
      hint.textContent = 'Sent the code? Now follow, then open the claim link in your DM.';
      document.getElementById('follow-text').textContent = 'Reopen the Instagram DM';
      followBtn.setAttribute('href', DM);
    } else {
      steps[0].className = 'now';
    }
  }

  btn.addEventListener('click', function () {
    if (expired) { window.location.reload(); return; }
    if (load('sent') === '1') { window.location.href = PROFILE; return; }
    var copied = false;
    function go() {
      if (copied) {
        store('sent', '1');
        status.className = 'status ok';
        status.textContent = 'Copied. Paste it into the chat and send.';
        setTimeout(function () { window.location.href = DM; }, 400);
      } else {
        // Do not hand off with an empty clipboard — that lands them in Instagram
        // with nothing to paste.
        status.className = 'status err';
        status.textContent = 'Could not copy. Press and hold the code above to copy it, then tap Follow to open Instagram.';
        try {
          var r = document.createRange(); r.selectNodeContents(codeEl);
          var sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(r);
        } catch (e) {}
      }
    }
    function legacy() {
      var ta = document.createElement('textarea');
      ta.value = code; ta.setAttribute('readonly', '');
      ta.style.position = 'fixed'; ta.style.top = '0'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.focus(); ta.select();
      try { copied = document.execCommand('copy'); } catch (e) {}
      ta.remove(); go();
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(code).then(function () { copied = true; go(); }, legacy);
    } else { legacy(); }
  });

  paint();
})();
</script>
</body>
</html>`;
}

export function staffPage() {
  return shell('Pri Learning · Staff Redemption', `
    <div class="brand"><span class="mark">P</span> PRI LEARNING · STAFF</div>
    <section class="card">
      <span class="eyebrow">Redemption console</span>
      <h1>Verify a claim.</h1>
      <p>This is an operational fallback. The normal customer-controlled flow shows a live green tick only after current follow verification and one-time redemption.</p>
      <form id="redeem" class="form">
        <label>Claim code<input name="code" autocomplete="off" autocapitalize="characters" placeholder="PRI-ABCD-2345" required></label>
        <label>Staff PIN<input name="pin" type="password" inputmode="numeric" autocomplete="current-password" required></label>
        <button class="button" type="submit">Redeem reward</button>
      </form>
      <div id="result" class="result" role="status" aria-live="polite"></div>
      <div class="divider"></div>
      <p class="tiny">The customer live-green-tick flow is the preferred verification method.</p>
      ${legalFooter}
    </section>
    <script>
    const form=document.getElementById('redeem');const result=document.getElementById('result');
    form.addEventListener('submit',async(e)=>{e.preventDefault();result.className='result';result.textContent='Checking…';const fd=new FormData(form);try{const r=await fetch('/api/redeem',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({code:fd.get('code'),pin:fd.get('pin')})});const j=await r.json();if(j.status==='redeemed'){const source=j.sourceVerified?'A2Z QR verified':'source not verified';result.className='result good';result.textContent='✓ VALID — '+source+'. Give 1 '+j.rewardLabel+'. This claim is now permanently redeemed.';form.elements.code.value='';}else if(j.status==='already_redeemed'){result.className='result bad';result.textContent='✕ ALREADY REDEEMED — do not issue another reward.';}else if(j.error==='invalid_staff_pin'){result.className='result bad';result.textContent='✕ Staff PIN incorrect.';}else{result.className='result bad';result.textContent='✕ INVALID CODE — do not issue a reward.';}}catch{result.className='result bad';result.textContent='Could not reach the verification server. Do not redeem until online.';}});
    </script>
  `);
}

export function privacyPage() {
  return shell('Pri Learning Promotions · Privacy', `
    <div class="brand"><span class="mark">P</span> PRI LEARNING</div>
    <section class="card legal">
      <span class="eyebrow">Privacy notice</span>
      <h1>Promotion privacy.</h1>
      <p class="updated">Last updated 29 August 2026</p>
      <p>This notice applies to the Pri Learning × A2Z Instagram reward service. It is separate from the main Pri Learning educational app.</p>
      <h2>What data we receive</h2>
      <ul>
        <li>an Instagram-scoped identifier supplied by Meta after you interact with the Pri Learning professional account;</li>
        <li>profile fields Meta makes available for the messaging interaction, which may include your Instagram username, display name and current follow-relationship signal;</li>
        <li>the short-lived A2Z QR verification pass or Meta referral used to attribute the campaign interaction;</li>
        <li>claim issuance and redemption status, timestamps and security/audit events;</li>
        <li>limited technical information required for service security and redemption rate limiting. Hosting providers may also process ordinary request metadata.</li>
      </ul>
      <h2>Why we use it</h2>
      <p>We use this information to attribute the A2Z promotion, verify the current Instagram follow relationship at redemption, prevent duplicate claims, operate the service securely, investigate abuse and maintain an audit trail. The live green tick is issued only when the follow relationship is positively confirmed and the Instagram identity has not already redeemed this campaign. We do not ask for your Instagram password and do not scrape Instagram.</p>
      <h2>Sharing</h2>
      <p>The service relies on Meta/Instagram for messaging and identity/follow signals and on infrastructure providers used to host the promotion service and database. A2Z staff only need to see the live validation result. We do not sell promotion participant data.</p>
      <h2>Retention</h2>
      <p>Promotion records are retained only for as long as reasonably needed to operate the campaign, resolve disputes, prevent duplicate redemptions and meet security or legal obligations. Short-lived unused QR passes expire automatically.</p>
      <h2>Your choices</h2>
      <p>You can unfollow at any time, but an account that is not currently following will not receive a green tick. Once a reward has been redeemed, following again does not create another entitlement. To request access, correction or deletion of promotion data, use the <a href="/data-deletion">data deletion instructions</a>.</p>
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
      <p class="updated">Last updated 29 August 2026</p>
      <p>You can ask Pri Learning to delete or anonymize personal data held by the A2Z promotion service.</p>
      <h2>How to request deletion</h2>
      <ol>
        <li>Open the official Instagram account <a href="https://www.instagram.com/pri.learning/" rel="noopener noreferrer">@pri.learning</a>.</li>
        <li>From the same Instagram account that used the A2Z promotion, send a direct message saying <strong>“A2Z data deletion request”</strong>.</li>
        <li>We will use the messaging identity supplied by Meta to verify that the request relates to that account. We will not ask for your Instagram password.</li>
        <li>After verification, data that is not required for security, fraud prevention, dispute handling or legal obligations will be deleted or anonymized.</li>
      </ol>
      <h2>What this covers</h2>
      <p>This process covers the A2Z promotion participant/profile data, campaign attribution and associated promotion records controlled by Pri Learning.</p>
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
      <p class="updated">Last updated 29 August 2026</p>
      <ul>
        <li>The offer is limited to one successfully redeemed reward per eligible Instagram identity for the A2Z campaign.</li>
        <li>Eligibility requires a valid A2Z campaign attribution, normally established by the short-lived verification message generated from the A2Z QR page.</li>
        <li>The live green tick requires Meta/Instagram to confirm that the same Instagram identity is currently following @pri.learning at the moment of redemption.</li>
        <li>If the current follow cannot be positively verified, no green tick is issued and the claim remains unredeemed so the customer can retry.</li>
        <li>Once redeemed, repeated scans, unfollowing, following again or repeated messages from the same Instagram identity do not create a new entitlement.</li>
        <li>Attempts to manipulate verification passes, follow checks, codes, accounts or redemption systems may be rejected.</li>
        <li>The promotion may be suspended or ended if the technical service, Meta platform access, stock or store operations make fulfilment unavailable.</li>
      </ul>
      <p>This promotion is in no way sponsored, endorsed or administered by, or associated with, Instagram.</p>
      <p>These terms describe the technical promotion flow and do not override rights that cannot lawfully be excluded.</p>
      ${legalFooter}
    </section>
  `);
}
