function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function customerRedeemPage({ code, rewardLabel, instagramUsername }) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#07120b">
<title>A2Z reward verification</title>
<style>
:root{font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#f8fbf9;background:#07120b}*{box-sizing:border-box}body{margin:0;min-height:100vh;background:radial-gradient(circle at 50% 0%,#163c25 0,#0b1e12 34%,#07120b 72%);color:#f8fbf9}.wrap{width:min(700px,calc(100% - 28px));margin:0 auto;padding:28px 0 64px}.brand{font-size:14px;font-weight:900;letter-spacing:.08em}.card{margin-top:22px;border:1px solid rgba(255,255,255,.12);background:rgba(8,24,14,.92);border-radius:28px;padding:28px;box-shadow:0 24px 80px rgba(0,0,0,.28)}.eyebrow{display:inline-flex;padding:8px 11px;border-radius:999px;background:rgba(109,222,148,.12);border:1px solid rgba(109,222,148,.28);font-size:12px;font-weight:900;letter-spacing:.12em;text-transform:uppercase;color:#bdf3ce}h1{font-size:clamp(38px,10vw,64px);line-height:.95;letter-spacing:-.055em;margin:18px 0}p{font-size:17px;line-height:1.55;color:#c9d9ce}.button{width:100%;border:0;border-radius:18px;padding:18px 20px;background:#effff3;color:#0a2112;font-size:18px;font-weight:950;cursor:pointer}.button:disabled{opacity:.55;cursor:not-allowed}.state{margin-top:20px;border-radius:24px;padding:24px;display:none}.state.show{display:block}.waiting{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.12)}.good{background:#0d5d2c;border:2px solid #63e28e}.bad{background:#561818;border:2px solid #f06d6d}.tick{font-size:clamp(82px,25vw,150px);line-height:.9;text-align:center;font-weight:950}.headline{font-size:clamp(30px,8vw,48px);line-height:1;text-align:center;font-weight:950;letter-spacing:-.04em;margin:16px 0 8px}.counter{margin:20px auto 4px;width:max-content;max-width:100%;padding:12px 18px;border-radius:999px;background:rgba(255,255,255,.12);font-size:20px;font-weight:950;text-align:center}.live{display:flex;justify-content:center;gap:8px;align-items:center;margin-top:14px;font-size:14px;font-weight:850}.dot{width:9px;height:9px;border-radius:50%;background:#8df3af;animation:pulse 1s infinite}.meta{margin-top:18px;padding-top:18px;border-top:1px solid rgba(255,255,255,.14);display:grid;gap:8px;font-size:15px}.muted{color:#b5c5ba}.code{font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-weight:900}.note{font-size:13px;color:#9db0a3;margin-top:16px}.old{font-size:16px;text-align:center;color:#ffd0d0}.footer{text-align:center;margin-top:22px;color:#75907d;font-size:12px}@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.45;transform:scale(.75)}}@media(prefers-reduced-motion:reduce){.dot{animation:none}}@media(max-width:520px){.card{padding:21px;border-radius:23px}.wrap{padding-top:18px}}
</style>
</head>
<body>
<main class="wrap">
  <div class="brand">PRI LEARNING × A2Z</div>
  <section class="card">
    <span class="eyebrow">Customer-controlled verification</span>
    <h1>At the counter?<br>Verify now.</h1>
    <p>When the shopkeeper is looking at your screen, tap the button once. Pri Learning will re-check the Instagram account attached to this claim, permanently redeem the one-time A2Z reward, and show the shopkeeper a live result.</p>
    <button id="verify" class="button" type="button">Show live green tick</button>
    <div id="state" class="state" role="status" aria-live="polite"></div>
    <p class="note">A previous redemption from the same Instagram identity can never produce another valid green tick, even if the account later unfollows and follows again. Current follow status is checked where Meta makes that signal available, but it is shown as campaign information rather than being exchanged for the reward.</p>
  </section>
  <div class="footer">Claim <span class="code">${escapeHtml(code)}</span></div>
</main>
<script>
const code=${JSON.stringify(code)};
const reward=${JSON.stringify(rewardLabel)};
const username=${JSON.stringify(instagramUsername)};
const button=document.getElementById('verify');
const state=document.getElementById('state');
let liveTimer=null;
let serverOffset=0;

function followLabel(value){
  if(value===true)return 'Following @'+username+' now: YES';
  if(value===false)return 'Following @'+username+' now: NO';
  return 'Current Instagram follow signal: unavailable';
}
function stopLive(){if(liveTimer){clearInterval(liveTimer);liveTimer=null;}}
function showExpired(j){
  stopLive();
  state.className='state show bad';
  state.innerHTML='<div class="tick">✕</div><div class="headline">ALREADY USED</div><div class="old">This one-time reward has already been redeemed. Do not give another reward.</div>'+(j.redemptionCount!=null?'<div class="counter">TOTAL GREEN TICKS: '+Number(j.redemptionCount)+'</div>':'');
  button.disabled=true;
  button.textContent='Reward already redeemed';
}
function showGreen(j){
  stopLive();
  state.className='state show good';
  serverOffset=Date.parse(j.serverTime)-Date.now();
  const redeemedAt=Date.parse(j.redeemedAt);
  function render(){
    const now=Date.now()+serverOffset;
    const age=Math.max(0,Math.floor((now-redeemedAt)/1000));
    if(age>60){
      state.className='state show bad';
      state.innerHTML='<div class="tick">✕</div><div class="headline">GREEN WINDOW CLOSED</div><div class="old">This reward was redeemed more than 60 seconds ago. Do not accept a screenshot or an old screen.</div><div class="counter">TOTAL GREEN TICKS: '+Number(j.redemptionCount)+'</div>';
      stopLive();
      return;
    }
    const secondsLeft=60-age;
    state.innerHTML='<div class="tick">✓</div><div class="headline">VALID — GIVE 1 '+String(reward).toUpperCase()+'</div><div class="counter">GREEN TICK #'+Number(j.redemptionCount)+'</div><div class="live"><span class="dot"></span>LIVE · '+secondsLeft+'s remaining</div><div class="meta"><div>✓ A2Z campaign verified</div><div>✓ One-time redemption completed just now</div><div>'+followLabel(j.currentFollowState)+'</div><div class="muted">Server time: '+new Date(now).toLocaleTimeString()+'</div></div>';
  }
  render();
  liveTimer=setInterval(render,1000);
  button.disabled=true;
  button.textContent='Redeemed';
}
async function status(){
  try{
    const r=await fetch('/api/customer/status?code='+encodeURIComponent(code),{cache:'no-store'});
    const j=await r.json();
    if(j.status==='already_redeemed')showExpired(j);
    else if(j.status==='invalid'){
      state.className='state show bad';
      state.innerHTML='<div class="tick">✕</div><div class="headline">INVALID</div><div class="old">This claim is not valid.</div>';
      button.disabled=true;
    }
  }catch{}
}
button.addEventListener('click',async()=>{
  button.disabled=true;
  button.textContent='Verifying…';
  state.className='state show waiting';
  state.textContent='Checking the A2Z claim and Instagram account…';
  try{
    const r=await fetch('/api/customer/redeem',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({code})});
    const j=await r.json();
    if(r.ok&&j.status==='redeemed')showGreen(j);
    else if(j.status==='already_redeemed')showExpired(j);
    else{
      state.className='state show bad';
      state.innerHTML='<div class="tick">✕</div><div class="headline">NOT VALID</div><div class="old">The server could not validate this one-time reward. Do not issue a reward.</div>';
      button.disabled=false;
      button.textContent='Try verification again';
    }
  }catch{
    state.className='state show bad';
    state.innerHTML='<div class="headline">OFFLINE</div><div class="old">The verification server is unavailable. Try again when connected.</div>';
    button.disabled=false;
    button.textContent='Try verification again';
  }
});
status();
</script>
</body>
</html>`;
}
