function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

const shell = (title, body, script = '') => `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="theme-color" content="#090d1a"><title>${escapeHtml(title)}</title>
<style>
:root{font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#f7f8fc;background:#090d1a}*{box-sizing:border-box}body{margin:0;min-height:100vh;background:radial-gradient(circle at 20% 0%,#253167 0,#11172f 34%,#090d1a 70%);color:#f7f8fc}.wrap{width:min(720px,calc(100% - 28px));margin:0 auto;padding:30px 0 60px}.brand{display:flex;align-items:center;gap:10px;font-weight:850;letter-spacing:-.02em}.mark{width:34px;height:34px;border-radius:10px;background:linear-gradient(135deg,#8ea2ff,#d9e0ff);display:grid;place-items:center;color:#11162a;font-weight:950}.card{margin-top:24px;border:1px solid rgba(255,255,255,.12);background:rgba(17,23,47,.88);border-radius:26px;padding:28px;box-shadow:0 24px 80px rgba(0,0,0,.3)}h1{font-size:clamp(34px,8vw,58px);line-height:1;letter-spacing:-.05em;margin:14px 0}p{color:#c8cde0;font-size:17px;line-height:1.55}.eyebrow{display:inline-flex;padding:8px 11px;border-radius:999px;background:rgba(143,161,255,.13);border:1px solid rgba(143,161,255,.25);font-size:12px;font-weight:850;letter-spacing:.12em;text-transform:uppercase;color:#cbd4ff}.button{display:block;width:100%;border:0;border-radius:16px;padding:16px 18px;background:#f4f6ff;color:#11162a;font-weight:900;font-size:16px;cursor:pointer;text-decoration:none;text-align:center}.button.secondary{margin-top:10px;background:rgba(255,255,255,.08);color:#eef1ff;border:1px solid rgba(255,255,255,.12)}.form{display:grid;gap:13px}.form label{font-size:13px;color:#aeb6d0}.form input{width:100%;border-radius:14px;border:1px solid rgba(255,255,255,.14);background:#0c1125;color:#fff;padding:16px;font-size:18px;outline:none}.form input:focus{border-color:#9aaaff}.qr-wrap{margin:22px auto 12px;max-width:360px;padding:18px;border-radius:24px;background:#fff}.qr-wrap svg{display:block;width:100%;height:auto}.code{display:inline-block;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-weight:950;letter-spacing:.07em;padding:8px 10px;border-radius:10px;background:rgba(255,255,255,.08);color:#fff}.result{margin-top:18px;border-radius:20px;padding:22px;font-size:19px;font-weight:800;line-height:1.4}.good{background:rgba(64,207,132,.14);border:1px solid rgba(64,207,132,.36)}.bad{background:rgba(255,100,100,.12);border:1px solid rgba(255,100,100,.32)}.waiting{background:rgba(143,161,255,.1);border:1px solid rgba(143,161,255,.26)}.huge{font-size:clamp(32px,8vw,50px);line-height:1.05;margin:8px 0}.tiny{font-size:13px;color:#8e97b1}.divider{height:1px;background:rgba(255,255,255,.08);margin:22px 0}.session{display:inline-flex;gap:7px;align-items:center;font-size:13px;color:#9ee7bb}.dot{width:8px;height:8px;border-radius:50%;background:#63d98d}@media(max-width:560px){.card{padding:21px;border-radius:22px}.wrap{padding-top:20px}}
</style></head><body><main class="wrap">${body}</main>${script}</body></html>`;

export function customerClaimPage({ code, qrSvg, instagramUsername }) {
  return shell('A2Z reward · Pri Learning', `
    <div class="brand"><span class="mark">P</span> PRI LEARNING</div>
    <section class="card">
      <span class="eyebrow">A2Z reward ready</span>
      <h1>Show this QR<br>to the shopkeeper.</h1>
      <p>Your A2Z campaign claim has been verified. A2Z staff scans this QR with their phone. The server accepts it once and permanently blocks a second redemption.</p>
      <div class="qr-wrap">${qrSvg}</div>
      <p style="text-align:center"><span class="code">${escapeHtml(code)}</span></p>
      <p class="tiny" style="text-align:center">The shopkeeper should trust the green/red staff verification screen, not a screenshot of this page. Following @${escapeHtml(instagramUsername)} is optional.</p>
    </section>`);
}

export function staffLoginPage({ next = '/staff' } = {}) {
  return shell('A2Z staff unlock', `
    <div class="brand"><span class="mark">P</span> PRI LEARNING · A2Z STAFF</div>
    <section class="card">
      <span class="eyebrow">Staff device</span>
      <h1>Unlock this phone.</h1>
      <p>Enter the A2Z staff PIN once. This device stays unlocked for the shift, so customer QR scans can be verified immediately.</p>
      <form id="unlock" class="form">
        <label>Staff PIN<input name="pin" type="password" inputmode="numeric" autocomplete="current-password" required></label>
        <button class="button" type="submit">Unlock staff verification</button>
      </form>
      <div id="result" class="result waiting" style="display:none" role="status"></div>
    </section>`, `<script>
    const form=document.getElementById('unlock'),result=document.getElementById('result');
    form.addEventListener('submit',async(e)=>{e.preventDefault();result.style.display='block';result.className='result waiting';result.textContent='Unlocking…';const fd=new FormData(form);try{const r=await fetch('/api/staff/session',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({pin:fd.get('pin')})});const j=await r.json();if(r.ok){result.className='result good';result.textContent='✓ Staff device unlocked';location.replace(${JSON.stringify(next)});}else{result.className='result bad';result.textContent=j.error==='invalid_staff_pin'?'✕ Incorrect staff PIN':'✕ Could not unlock this device';}}catch{result.className='result bad';result.textContent='✕ Verification server unavailable';}});
    </script>`);
}

export function staffHomePage() {
  return shell('A2Z staff verification', `
    <div class="brand"><span class="mark">P</span> PRI LEARNING · A2Z STAFF</div>
    <section class="card">
      <span class="session"><span class="dot"></span> Staff device unlocked</span>
      <h1>Scan customer QR.</h1>
      <p>Use this phone's normal Camera app to scan the QR on the customer's reward screen. Tap the link that appears. The result page will automatically redeem a valid code and show green or red.</p>
      <div class="divider"></div>
      <p><b>Fallback:</b> if the customer's QR cannot be scanned, enter the printed claim code below.</p>
      <form id="manual" class="form">
        <label>Claim code<input name="code" autocapitalize="characters" autocomplete="off" placeholder="PRI-ABCD-2345" required></label>
        <button class="button" type="submit">Verify & redeem</button>
      </form>
      <div id="result" style="display:none" class="result waiting" role="status"></div>
      <button id="lock" class="button secondary" type="button">Lock this staff device</button>
    </section>`, `<script>
    const result=document.getElementById('result');
    function show(j){result.style.display='block';if(j.status==='redeemed'){result.className='result good';result.textContent='✓ VALID — GIVE 1 '+j.rewardLabel.toUpperCase()+'. Redeemed now.';}else if(j.status==='already_redeemed'){result.className='result bad';result.textContent='✕ ALREADY REDEEMED — DO NOT GIVE ANOTHER REWARD.';}else{result.className='result bad';result.textContent='✕ INVALID CODE — DO NOT GIVE A REWARD.';}}
    document.getElementById('manual').addEventListener('submit',async(e)=>{e.preventDefault();result.style.display='block';result.className='result waiting';result.textContent='Checking…';const fd=new FormData(e.currentTarget);try{const r=await fetch('/api/redeem-session',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({code:fd.get('code')})});const j=await r.json();if(r.status===401){location.replace('/staff?next='+encodeURIComponent(location.pathname));return;}show(j);}catch{result.className='result bad';result.textContent='✕ Verification server unavailable';}});
    document.getElementById('lock').addEventListener('click',async()=>{await fetch('/api/staff/logout',{method:'POST'});location.replace('/staff');});
    </script>`);
}

export function staffScanPage({ code }) {
  return shell('A2Z scan result', `
    <div class="brand"><span class="mark">P</span> PRI LEARNING · A2Z STAFF</div>
    <section class="card">
      <span class="session"><span class="dot"></span> Staff device unlocked</span>
      <div id="result" class="result waiting">
        <div class="huge">Checking…</div>
        <div>Verifying <span class="code">${escapeHtml(code)}</span></div>
      </div>
      <a class="button secondary" href="/staff">Back to staff screen</a>
    </section>`, `<script>
    const result=document.getElementById('result');
    (async()=>{try{const r=await fetch('/api/redeem-session',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({code:${JSON.stringify(code)}})});const j=await r.json();if(r.status===401){location.replace('/staff?next='+encodeURIComponent(location.pathname+location.search));return;}if(j.status==='redeemed'){result.className='result good';result.innerHTML='<div class="huge">✓ VALID</div><div>GIVE 1 '+String(j.rewardLabel).toUpperCase()+'. This claim has just been redeemed.</div>';}else if(j.status==='already_redeemed'){result.className='result bad';result.innerHTML='<div class="huge">✕ ALREADY REDEEMED</div><div>Do not give another reward.</div>';}else{result.className='result bad';result.innerHTML='<div class="huge">✕ INVALID</div><div>Do not give a reward.</div>';}}catch{result.className='result bad';result.innerHTML='<div class="huge">✕ OFFLINE</div><div>Do not give a reward until the verification server is reachable.</div>';}})();
    </script>`);
}
