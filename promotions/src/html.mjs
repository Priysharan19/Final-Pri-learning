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
:root{font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#f7f8fc;background:#090d1a}*{box-sizing:border-box}body{margin:0;min-height:100vh;background:radial-gradient(circle at 20% 0%,#253167 0,#11172f 34%,#090d1a 70%);color:#f7f8fc}.wrap{width:min(720px,calc(100% - 32px));margin:0 auto;padding:54px 0 72px}.brand{display:flex;align-items:center;gap:10px;font-weight:800;letter-spacing:-.02em}.mark{width:34px;height:34px;border-radius:10px;background:linear-gradient(135deg,#8ea2ff,#d9e0ff);display:grid;place-items:center;color:#11162a;font-weight:900}.card{margin-top:28px;border:1px solid rgba(255,255,255,.12);background:rgba(17,23,47,.82);backdrop-filter:blur(18px);border-radius:26px;padding:30px;box-shadow:0 24px 80px rgba(0,0,0,.3)}h1{font-size:clamp(34px,7vw,58px);line-height:.98;letter-spacing:-.055em;margin:16px 0}p{color:#c8cde0;font-size:17px;line-height:1.6}.eyebrow{display:inline-flex;padding:8px 11px;border-radius:999px;background:rgba(143,161,255,.13);border:1px solid rgba(143,161,255,.25);font-size:12px;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:#cbd4ff}.steps{display:grid;gap:12px;margin:28px 0}.step{display:flex;gap:14px;align-items:flex-start;padding:16px;border-radius:18px;background:rgba(255,255,255,.05)}.num{flex:0 0 30px;width:30px;height:30px;border-radius:10px;background:#eef1ff;color:#11162a;display:grid;place-items:center;font-weight:900}.step b{display:block;margin-bottom:3px}.step span{color:#b8bfd5;line-height:1.45}.button{display:block;width:100%;text-align:center;text-decoration:none;border:0;border-radius:16px;padding:15px 18px;background:#f4f6ff;color:#11162a;font-weight:850;font-size:16px;cursor:pointer}.button.secondary{margin-top:10px;background:rgba(255,255,255,.08);color:#eef1ff;border:1px solid rgba(255,255,255,.12)}.note{font-size:13px;color:#8e97b1;margin-top:16px}.code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-weight:900;letter-spacing:.08em;padding:5px 8px;border-radius:8px;background:rgba(255,255,255,.08);color:#fff}.form{display:grid;gap:12px}.form label{font-size:13px;color:#aeb6d0}.form input{width:100%;border-radius:14px;border:1px solid rgba(255,255,255,.14);background:#0c1125;color:#fff;padding:15px;font-size:17px;outline:none}.form input:focus{border-color:#9aaaff}.result{margin-top:18px;border-radius:16px;padding:16px;display:none}.result.good{display:block;background:rgba(64,207,132,.12);border:1px solid rgba(64,207,132,.32)}.result.bad{display:block;background:rgba(255,100,100,.1);border:1px solid rgba(255,100,100,.28)}.tiny{font-size:12px;color:#7d86a0}.divider{height:1px;background:rgba(255,255,255,.08);margin:24px 0}@media(max-width:560px){.wrap{padding-top:26px}.card{padding:22px;border-radius:22px}}
</style>
</head><body><main class="wrap">${body}</main></body></html>`;

export function campaignPage({ instagramUsername, keyword, rewardLabel }) {
  const profileUrl = `https://www.instagram.com/${encodeURIComponent(instagramUsername)}/`;
  return shell('Pri Learning · Claim', `
    <div class="brand"><span class="mark">P</span> PRI LEARNING</div>
    <section class="card">
      <span class="eyebrow">A2Z × Pri Learning</span>
      <h1>One scan.<br>One reward.</h1>
      <p>Connect your Instagram identity once, receive a one-time claim code, and show it to staff for your ${escapeHtml(rewardLabel)}.</p>
      <div class="steps">
        <div class="step"><span class="num">1</span><div><b>Open @${escapeHtml(instagramUsername)}</b><span>Tap the button below to open Pri Learning on Instagram.</span></div></div>
        <div class="step"><span class="num">2</span><div><b>DM <span class="code">${escapeHtml(keyword)}</span></b><span>Send exactly this keyword. The system uses your Instagram-scoped identity to stop repeat claims.</span></div></div>
        <div class="step"><span class="num">3</span><div><b>Show your one-time code</b><span>Staff enters your code once. After redemption it can never be used again.</span></div></div>
      </div>
      <a class="button" href="${profileUrl}" rel="noopener noreferrer">Open @${escapeHtml(instagramUsername)} on Instagram</a>
      <p class="note">Following @${escapeHtml(instagramUsername)} is optional and does not change reward eligibility. One reward is available per Instagram identity for this campaign.</p>
    </section>
  `);
}

export function staffPage() {
  return shell('Pri Learning · Staff Redemption', `
    <div class="brand"><span class="mark">P</span> PRI LEARNING · STAFF</div>
    <section class="card">
      <span class="eyebrow">Redemption console</span>
      <h1>Verify a claim.</h1>
      <p>Enter the customer’s one-time Pri code. A successful redemption is atomic: the same code cannot be accepted twice.</p>
      <form id="redeem" class="form">
        <label>Claim code<input name="code" autocomplete="off" autocapitalize="characters" placeholder="PRI-ABCD-2345" required></label>
        <label>Staff PIN<input name="pin" type="password" inputmode="numeric" autocomplete="current-password" required></label>
        <button class="button" type="submit">Redeem reward</button>
      </form>
      <div id="result" class="result" role="status" aria-live="polite"></div>
      <div class="divider"></div>
      <p class="tiny">Do not redeem from screenshots you cannot inspect clearly. The server is the source of truth; green means accepted, red means do not issue another reward.</p>
    </section>
    <script>
    const form=document.getElementById('redeem');const result=document.getElementById('result');
    form.addEventListener('submit',async(e)=>{e.preventDefault();result.className='result';result.textContent='Checking…';const fd=new FormData(form);try{const r=await fetch('/api/redeem',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({code:fd.get('code'),pin:fd.get('pin')})});const j=await r.json();if(j.status==='redeemed'){result.className='result good';result.textContent='✓ VALID — give 1 '+j.rewardLabel+'. This claim is now permanently redeemed.';form.elements.code.value='';}else if(j.status==='already_redeemed'){result.className='result bad';result.textContent='✕ ALREADY REDEEMED — do not issue another reward.';}else if(j.error==='invalid_staff_pin'){result.className='result bad';result.textContent='✕ Staff PIN incorrect.';}else{result.className='result bad';result.textContent='✕ INVALID CODE — do not issue a reward.';}}catch{result.className='result bad';result.textContent='Could not reach the verification server. Do not redeem until online.';}});
    </script>
  `);
}
