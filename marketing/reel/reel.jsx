/* Pri Learning — Instagram reel v3 (2160×3840 4K, 36.4s) — animations-v3 engine */
const {CompositionStage, useComposition, Shot, Easing, interpolate, animate, clamp} = window;
const {useRef, useEffect, useMemo, useState} = React;

const C = {page:'#0a0a09',surface:'#101010',s2:'#161615',s3:'#1d1d1b',
  hair:'rgba(240,236,224,0.13)',hairS:'rgba(240,236,224,0.24)',hairF:'rgba(240,236,224,0.07)',
  ink:'#efece1',ink2:'#b3afa2',ink3:'#7c796d',cream:'#f4f1e0',creamInk:'#131310',
  gold:'#c9ad63',goldB:'#e3c87e',goldSoft:'rgba(201,173,99,0.12)',goldBord:'rgba(201,173,99,0.55)',
  good:'#5aa86c',goodSoft:'rgba(90,168,108,0.13)',bad:'#cf5f56',
  lpage:'#f7f4ea',link:'#171610',link2:'#565348',lgold:'#8e6f27',lhair:'rgba(26,24,16,0.16)'};
const SERIF = "'KaTeX_Main','STIX Two Text',Georgia,'Times New Roman',serif";
const MATHF = "'KaTeX_Math'," + SERIF;
const AMS = "'KaTeX_AMS'," + SERIF;
const BIGOP = "'KaTeX_Size2','KaTeX_Size1'," + SERIF;
const HAND = "'Caveat','Segoe Script',cursive";
const GRAIN='data:image/svg+xml;utf8,'+encodeURIComponent("<svg xmlns='http://www.w3.org/2000/svg' width='280' height='280'><filter id='ng'><feTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='2' stitchTiles='stitch'/></filter><rect width='280' height='280' filter='url(#ng)'/></svg>");

const MOTION = {
  enter(T,s,d=0.85,dist=36){const p=clamp((T-s)/d,0,1),e=Easing.easeOutQuart(p);
    return {opacity:Easing.easeOutSine(p),transform:`translateY(${(1-e)*dist}px)`};},
  draw:(T,s,d=1)=>Easing.easeInOutSine(clamp((T-s)/d,0,1)),
  pop(T,s,d=0.6){const p=clamp((T-s)/d,0,1);
    return {opacity:clamp(p*5,0,1),transform:`scale(${0.7+0.3*Easing.easeOutBack(p)})`};}
};
const lerp=(a,b,p)=>a+(b-a)*p;
const fadeIO=(T,s,e,fi=0.35,fo=0.35)=>clamp((T-s)/fi,0,1)*(1-clamp((T-(e-fo))/fo,0,1));
function kf(T,keys){if(T<=keys[0][0])return keys[0][1];
  for(let i=0;i<keys.length-1;i++){const a=keys[i],b=keys[i+1];
    if(T<b[0])return a[1]+(b[1]-a[1])*Easing.easeInOutCubic(clamp((T-a[0])/(b[0]-a[0]),0,1));}
  return keys[keys.length-1][1];}

function mulberry32(a){return function(){a|=0;a=(a+0x6D2B79F5)|0;let t=Math.imul(a^(a>>>15),1|a);t=(t+Math.imul(t^(t>>>7),61|t))^t;return((t^(t>>>14))>>>0)/4294967296;};}

const SYMS=(()=>{const r=mulberry32(11);const gl=['∫','∑','π','√','∂','θ','Δ','≤','λ','∞','φ','dx','ƒ','≠','±','e','∴','α'];
  const a=[];for(let i=0;i<30;i++)a.push({x:r()*1040,y:r()*2050-60,s:22+r()*46,o:0.045+r()*0.075,ch:gl[Math.floor(r()*gl.length)],sp:3+r()*7,rot:(r()*30-15)});return a;})();
function MathField({T,opacity=1}){
  return <div style={{position:'absolute',inset:0,pointerEvents:'none',opacity}}>
    {SYMS.map((s,i)=><span key={i} style={{position:'absolute',left:s.x,top:s.y,fontFamily:MATHF,fontStyle:'italic',fontSize:s.s,color:C.ink,opacity:s.o,transform:`translateY(${-T*s.sp*0.6}px) rotate(${s.rot}deg)`}}>{s.ch}</span>)}
  </div>;
}

const RAMP=['#c04f46','#cf8f3e','#b0b24a','#6fae54','#3f9e4f'];
const NODES=(()=>{const r=mulberry32(7);const a=[];for(let i=0;i<62;i++)a.push({x:50+r()*800,y:50+r()*1100,r:4+r()*4.5,c:RAMP[Math.min(4,Math.floor(r()*6))],tw:r()*6.3});
  a[23]={x:430,y:560,r:9,c:'#6fae54',tw:1};return a;})();
const EDGES=(()=>{const e=[],deg=new Array(NODES.length).fill(0);
  for(let i=0;i<NODES.length;i++)for(let j=i+1;j<NODES.length;j++){const dx=NODES[i].x-NODES[j].x,dy=NODES[i].y-NODES[j].y;
    if(dx*dx+dy*dy<150*150&&deg[i]<3&&deg[j]<3){e.push([i,j]);deg[i]++;deg[j]++;}}return e;})();

function handDur(text,per){let d=0;for(const ch of text)d+=ch===' '?per*0.35:per;return d;}
function HandLine({text,start,per=0.082,x,y,size=84,T,color='#ebe7d8'}){
  const chars=[...text];let acc=start;const spans=chars.map((ch,i)=>{
    const isSp=ch===' ';const d=isSp?per*0.35:per;const p=clamp((T-acc)/(d*2.4),0,1);acc+=d;
    if(isSp)return <span key={i} style={{display:'inline-block',width:size*0.22}}>{' '}</span>;
    const e=Easing.easeOutCubic(p);const rot=(((i*7919)%9)-4)*1.3;const dy=(((i*104729)%7)-3)*2.4;
    return <span key={i} style={{display:'inline-block',opacity:e,filter:p<1?`blur(${(1-e)*1.6}px)`:'none',transform:`translateY(${dy+(1-e)*8}px) rotate(${rot}deg) scale(${0.85+0.15*e})`,transformOrigin:'50% 82%'}}>{ch}</span>;});
  return <div style={{position:'absolute',left:x,top:y,fontFamily:HAND,fontWeight:600,fontSize:size,color,whiteSpace:'nowrap',letterSpacing:'0.01em'}}>{spans}</div>;
}
function Pencil({x,y,T,opacity}){
  return <div style={{position:'absolute',left:x-7,top:y-186+Math.sin(T*14)*2,width:14,zIndex:6,opacity,transform:`rotate(${33+Math.sin(T*7)*1.6}deg)`,transformOrigin:'50% 100%',pointerEvents:'none'}}>
    <div style={{width:14,height:162,borderRadius:7,background:'linear-gradient(90deg,#f2efe4,#cfcaba 55%,#a9a494)',boxShadow:'0 8px 20px rgba(0,0,0,0.55)'}}></div>
    <div style={{width:0,height:0,borderLeft:'7px solid transparent',borderRight:'7px solid transparent',borderTop:'17px solid #8a8678'}}></div>
    <div style={{width:4,height:6,background:'#26261f',margin:'-23px auto 0',borderRadius:1}}></div>
  </div>;
}
const Kicker=({children,style,T,at})=>{
  const p=at!=null&&T!=null?Easing.easeOutQuart(clamp((T-at)/1.1,0,1)):1;
  return <div style={{fontSize:26,letterSpacing:`${0.5-0.16*p}em`,textTransform:'uppercase',color:C.ink3,fontFamily:SERIF,...style}}>{children}</div>;};

/* typeset integral: ∫₀^π (x sin x)/(1+cos²x) dx */
function TypesetInt({s=1,lead}){
  const fr={display:'inline-flex',flexDirection:'column',alignItems:'center',lineHeight:1.12};
  return <span style={{display:'inline-flex',alignItems:'center',gap:10*s,fontFamily:MATHF,fontStyle:'italic',color:C.ink}}>
    {lead&&<span style={{fontSize:28*s}}>{lead}</span>}
    <span style={{display:'inline-flex',alignItems:'center'}}>
      <span style={{fontFamily:BIGOP,fontStyle:'normal',fontSize:52*s,lineHeight:0.9}}>∫</span>
      <span style={{display:'inline-flex',flexDirection:'column',justifyContent:'space-between',height:56*s,margin:`0 0 ${-6*s}px 3px`}}>
        <span style={{fontSize:17*s}}>π</span>
        <span style={{fontSize:17*s,fontStyle:'normal',fontFamily:SERIF}}>0</span>
      </span>
    </span>
    <span style={fr}>
      <span style={{fontSize:25*s}}>x sin x</span>
      <span style={{alignSelf:'stretch',height:Math.max(1.5,1.6*s),background:C.ink,margin:`${3*s}px 0`,borderRadius:1}}></span>
      <span style={{fontSize:25*s}}>1 + cos²x</span>
    </span>
    <span style={{fontSize:25*s,marginLeft:2*s}}>dx</span>
  </span>;
}
function Frac({n,d,s=1}){
  return <span style={{display:'inline-flex',flexDirection:'column',alignItems:'center',lineHeight:1.1,verticalAlign:'middle'}}>
    <span style={{fontSize:26*s}}>{n}</span>
    <span style={{alignSelf:'stretch',height:1.6*s,background:C.ink,margin:`${2.5*s}px 0`,borderRadius:1}}></span>
    <span style={{fontSize:26*s}}>{d}</span>
  </span>;
}

/* ─── sections ─── */
function Hook({T,CU}){
  const zoom=1+0.02*T;
  const w1=['What','if','your'],w2=['handwriting'];
  const ul=MOTION.draw(T,1.5,0.6);
  return <div style={{position:'absolute',inset:0,transform:`scale(${zoom})`,opacity:fadeIO(T,0,CU.Write,0.2,0.25)}}>
    <MathField T={T} opacity={clamp((T+0.4)/0.9,0,1)}/>
    <div style={{position:'absolute',left:'50%',top:900,width:1500,height:1200,transform:'translate(-50%,-50%)',background:'radial-gradient(50% 50% at 50% 50%, rgba(201,173,99,0.085), transparent 70%)'}}></div>
    <div style={{position:'absolute',left:0,right:0,top:250,textAlign:'center',...MOTION.enter(T,0.1)}}>
      <Kicker T={T} at={0.1}>IIT JEE · Olympiad Maths · iPad + Pencil</Kicker></div>
    <div style={{position:'absolute',left:60,right:60,top:690,textAlign:'center',fontFamily:SERIF,fontSize:104,lineHeight:1.22,color:C.ink}}>
      <div>{w1.map((w,i)=><span key={i} style={{display:'inline-block',marginRight:26,...MOTION.enter(T,0.2+i*0.1,0.7,50)}}>{w}</span>)}</div>
      <div>{w2.map((w,i)=><span key={i} style={{display:'inline-block',...MOTION.enter(T,0.5,0.7,50)}}>{w}</span>)}</div>
      <div style={{fontStyle:'italic',color:C.gold,...MOTION.enter(T,0.9,0.8,56)}}>marked itself?</div>
      <svg width="120" height="88" viewBox="0 0 120 88" style={{display:'block',margin:'20px auto 0',overflow:'visible'}}><path d="M12 46 L44 74 L106 12" fill="none" stroke={C.gold} strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="132" strokeDashoffset={132*(1-ul)} opacity={ul>0.01?1:0}/></svg>
    </div>
  </div>;
}

function Device({T,CU}){
  const t0=CU.Write;
  const LINES=[
    {text:'I = ∫ x sinx/(1+cos²x) dx',x:44,y:26,size:58,start:t0+0.45,per:0.05,W:630},
    {text:'x→π−x ⇒ 2I = π∫ sinx/(1+cos²x)',x:44,y:172,size:53,start:t0+1.7,per:0.046,W:706},
    {text:'t = cosx ⇒ 2I = π∫ dt/(1+t²)',x:44,y:318,size:55,start:t0+3.0,per:0.048,W:648},
    {text:'2I = π·π/2  ∴  I = π²/4',x:44,y:464,size:62,start:t0+4.15,per:0.05,W:552}];
  const durs=LINES.map(l=>handDur(l.text,l.per));
  const endAll=LINES[3].start+durs[3];
  let li=0;for(let i=0;i<4;i++)if(T>=LINES[i].start)li=i;
  const lp=Easing.easeInOutSine(clamp((T-LINES[li].start)/durs[li],0,1));
  const px=LINES[li].x+56+lp*LINES[li].W, pyk=LINES[li].y+92;
  const penFade=clamp((T-(LINES[0].start-0.3))/0.25,0,1)*(1-clamp((T-(endAll+0.2))/0.25,0,1));
  const writing=T>=LINES[li].start&&lp<1;
  const glow=penFade*(writing?0.6*clamp(Math.sin(Math.PI*lp)*2.5,0,1):0);
  const z=kf(T,[[t0+0.35,1],[t0+1.3,1.24],[CU.Marked-0.3,1.24],[CU.Marked+0.7,1.02],[CU.Bank,1.06]]);
  const py=kf(T,[[t0+0.35,0],[t0+1.3,-30],[t0+2.9,-64],[t0+4.6,-100],[CU.Marked-0.3,-100],[CU.Marked+0.7,0]]);
  const dev={x:120,y:150,w:840,h:1460};
  const ipadIn=MOTION.enter(T,t0+0.05,1,64);
  const tilt=1-Easing.easeOutCubic(clamp((T-t0-0.05)/1.3,0,1));
  const readsAt=LINES[0].start+durs[0]+0.2;
  const solved=T>LINES[3].start+durs[3]*0.6;
  const evalOn=MOTION.enter(T,CU.Marked+2.05,0.7,44);
  const mins=String(Math.floor((41+Math.max(0,T-t0))/60)).padStart(2,'0');
  const secs=String(Math.floor(41+Math.max(0,T-t0))%60).padStart(2,'0');
  const marks=[{t:'✓',c:C.good},{t:'M1',c:C.good},{t:'M1',c:C.good},{t:'A1',c:C.gold}];
  const chips=[['JEE Advanced · 1997',C.gold],['Definite Integration',C.ink2],['4 marks',C.ink2],['L4',RAMP[1]]];
  return <div style={{position:'absolute',inset:0,background:C.page,opacity:fadeIO(T,t0,CU.Bank,0.35,0.001)}}>
    <div style={{position:'absolute',inset:0,transform:`scale(${z}) translateY(${py}px)`,transformOrigin:'50% 52%'}}>
      <div style={{position:'absolute',left:dev.x-90,top:dev.y-50,width:dev.w+180,height:dev.h+140,background:'radial-gradient(50% 50% at 50% 45%, rgba(201,173,99,0.12), transparent 70%)',filter:'blur(24px)'}}></div>
      <div style={{position:'absolute',left:dev.x,top:dev.y,width:dev.w,height:dev.h,borderRadius:48,background:'#000',border:'2px solid #2a2a26',boxShadow:'0 60px 140px rgba(0,0,0,0.75), 0 0 90px rgba(201,173,99,0.07)',padding:16,opacity:ipadIn.opacity,transform:`perspective(2400px) rotateX(${8*tilt}deg) rotateY(${-8*tilt}deg) ${ipadIn.transform}`}}>
        <div style={{position:'relative',width:'100%',height:'100%',borderRadius:34,background:C.page,border:`1px solid ${C.hair}`,overflow:'hidden'}}>
          <div style={{position:'absolute',inset:0,zIndex:9,pointerEvents:'none',background:'linear-gradient(115deg, transparent 42%, rgba(244,241,224,0.075) 50%, transparent 58%)',transform:`translateX(${-70+150*MOTION.draw(T,t0+0.35,2.4)}%)`}}></div>
          <div style={{display:'flex',alignItems:'center',gap:10,height:60,padding:'0 22px',borderBottom:`1px solid ${C.hair}`}}>
            <span style={{fontFamily:AMS,fontSize:26,color:C.ink}}>P</span>
            <span style={{fontFamily:SERIF,fontSize:21,color:C.ink,marginLeft:-8}}>ri Learning</span>
            <span style={{marginLeft:'auto',fontSize:14.5,color:C.ink2,fontFamily:SERIF}}>Aarav · Class 11 · JEE Adv</span>
            <span style={{fontSize:14,color:C.ink3,fontFamily:SERIF}}>▮ 98%</span>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:8,padding:'14px 24px 0'}}>
            {chips.map((c,i)=><span key={i} style={{fontSize:12.5,padding:'3px 10px',border:`1px solid ${i===0?C.goldBord:C.hair}`,background:i===0?C.goldSoft:'transparent',borderRadius:3,color:c[1],letterSpacing:i===0?'0.06em':0,fontFamily:SERIF}}>{c[0]}</span>)}
            <span style={{marginLeft:'auto',fontSize:15,color:C.ink2,fontVariantNumeric:'tabular-nums'}}>◷ {mins}:{secs}</span>
          </div>
          <div style={{display:'flex',alignItems:'center',gap:16,margin:'14px 24px 0',padding:'16px 22px',background:C.s2,border:`1px solid ${C.hair}`,borderRadius:8}}>
            <span style={{fontSize:13,letterSpacing:'0.2em',color:C.gold,fontFamily:SERIF}}>Q 7.</span>
            <span style={{fontFamily:SERIF,fontSize:26,color:C.ink}}>Evaluate</span>
            <TypesetInt s={0.98}/>
          </div>
          <div style={{display:'flex',gap:8,alignItems:'center',padding:'12px 24px 8px'}}>
            {['✎ Pen','⌫ Erase','↺ Undo','▦ Grid'].map((m,i)=><div key={i} style={{padding:'6px 14px',display:'grid',placeItems:'center',border:`1px solid ${i===0?C.cream:C.hairS}`,boxShadow:i===0?`0 0 0 1px ${C.cream}`:'none',borderRadius:4,color:i===0?C.ink:C.ink3,fontSize:14.5,fontFamily:SERIF}}>{m}</div>)}
            <span style={{marginLeft:'auto',fontSize:13.5,color:C.ink3,fontStyle:'italic'}}>palm rejection on</span>
          </div>
          <div style={{position:'relative',margin:'2px 20px 0',height:610,borderTop:`1px solid ${C.hair}`,borderBottom:`1px solid ${C.hair}`,backgroundImage:`radial-gradient(rgba(240,236,224,0.07) 1.3px, transparent 1.4px)`,backgroundSize:'44px 44px',backgroundPosition:'8px 6px'}}>
            {LINES.map((L,i)=><HandLine key={i} {...L} T={T}/>)}
            <Pencil x={px} y={pyk} T={T} opacity={penFade}/>
            <div style={{position:'absolute',left:px-13,top:pyk-13,width:26,height:26,borderRadius:'50%',background:'radial-gradient(circle, rgba(244,241,224,0.45), transparent 70%)',opacity:glow}}></div>
            {LINES.map((L,i)=>{const at=CU.Marked+0.35+i*0.34;
              return <React.Fragment key={'m'+i}>
                <div style={{position:'absolute',left:24,top:L.y-4,width:L.W+70,height:104,border:`2px solid ${i===3?C.goldBord:'rgba(90,168,108,0.75)'}`,borderRadius:10,background:i===3?C.goldSoft:'rgba(90,168,108,0.06)',boxShadow:`0 0 18px ${i===3?'rgba(201,173,99,0.2)':'rgba(90,168,108,0.14)'}`,...MOTION.pop(T,at)}}></div>
                <div style={{position:'absolute',left:24+L.W+70-160,top:L.y+28,width:150,display:'flex',justifyContent:'flex-end',pointerEvents:'none'}}><span style={{fontSize:26,fontFamily:SERIF,color:marks[i].c,border:`1.5px solid ${marks[i].c}`,borderRadius:4,padding:'3px 12px',background:C.page,boxShadow:'0 6px 18px rgba(0,0,0,0.5)',...MOTION.pop(T,at+0.12)}}>{marks[i].t}</span></div>
              </React.Fragment>;})}
          </div>
          <div style={{display:'flex',alignItems:'center',gap:14,padding:'14px 24px 0',...MOTION.enter(T,readsAt,0.5,14)}}>
            <span style={{fontSize:12.5,letterSpacing:'0.18em',textTransform:'uppercase',color:C.ink3}}>typeset live</span>
            {solved
              ?<span style={{fontFamily:MATHF,fontStyle:'italic',fontSize:28,color:C.ink,display:'inline-flex',alignItems:'center',gap:10}}>I = <Frac n='π²' d='4' s={0.9}/></span>
              :<TypesetInt s={0.62} lead='I ='/>}
            <span style={{fontSize:14,color:C.gold,border:`1px solid ${C.goldBord}`,background:C.goldSoft,borderRadius:3,padding:'2px 10px'}}>{solved?'exact ✓':'recognised'}</span>
          </div>
          <div style={{position:'absolute',left:20,right:20,bottom:18,border:`1px solid ${C.goldBord}`,borderRadius:6,overflow:'hidden',background:C.surface,...evalOn}}>
            <div style={{display:'flex',alignItems:'baseline',padding:'14px 20px 6px',background:`linear-gradient(180deg,${C.goldSoft},transparent)`}}>
              <span style={{fontFamily:AMS,fontSize:21,color:C.ink}}>P</span>
              <span style={{fontFamily:SERIF,fontSize:19,color:C.ink}}>ri Learning. <span style={{color:C.ink2}}>Evaluation</span></span>
              <span style={{marginLeft:'auto',fontFamily:SERIF,fontSize:27,color:C.gold}}>4 / 4 <span style={{fontSize:15,color:C.ink3}}>full marks</span></span>
            </div>
            <div style={{padding:'8px 20px 14px',fontSize:18,color:C.ink2,fontFamily:SERIF}}>
              King's property ✓ · substitution ✓ · exact value ✓
              <span style={{color:C.gold,marginLeft:12,...MOTION.pop(T,CU.Marked+2.7)}}>+24 Calculus rating</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>;
}

function Bank({T,CU}){
  const t0=CU.Bank;
  const e=Easing.easeOutExpo(MOTION.draw(T,t0+0.2,1.6));
  const n=Math.round(344798*e);
  const settle=1+0.05*(1-Easing.easeOutBack(clamp((T-t0-1.7)/0.5,0,1)))*(T>t0+1.7?1:0);
  const tags=[['L1','NCERT','#79b97f'],['L2','JEE Main','#a8b06a'],['L3','JEE Advanced','#cf8f3e'],['L4','Olympiad','#c9695f']];
  return <div style={{position:'absolute',inset:0,background:C.page,transform:`scale(${1+0.013*(T-t0)})`,opacity:fadeIO(T,t0,CU.Map,0.001,0.35)}}>
    <MathField T={T} opacity={0.7}/>
    <div style={{position:'absolute',left:0,right:0,top:560,textAlign:'center',...MOTION.enter(T,t0+0.1)}}>
      <Kicker T={T} at={t0+0.1}>Exam-style question bank</Kicker></div>
    <div style={{position:'absolute',left:'50%',top:770,width:12,height:12,borderRadius:'50%',border:`2px solid ${C.goldBord}`,transform:`translate(-50%,-50%) scale(${1+80*MOTION.draw(T,t0+1.75,0.8)})`,opacity:0.5*(1-MOTION.draw(T,t0+1.75,0.8))}}></div>
    <div style={{position:'absolute',left:0,right:0,top:660,textAlign:'center',fontFamily:SERIF,fontSize:172,color:C.ink,fontVariantNumeric:'tabular-nums',letterSpacing:'0.01em',transform:`scale(${settle})`,filter:e<0.985?`blur(${(1-e)*2.5}px)`:'none',...(T<t0+2.3?{opacity:MOTION.enter(T,t0+0.2,0.8).opacity}:{})}}>
      {n.toLocaleString('en-IN')}</div>
    <div style={{position:'absolute',left:0,right:0,top:900,textAlign:'center',fontFamily:SERIF,fontSize:37,color:C.ink2,...MOTION.enter(T,t0+0.7)}}>
      distinct questions · Class 9–12 · <span style={{color:C.gold}}>NCERT → Olympiad</span></div>
    <div style={{position:'absolute',left:0,right:0,top:1040,display:'flex',gap:18,justifyContent:'center'}}>
      {tags.map((t,i)=><div key={i} style={{border:`1px solid ${C.hairS}`,borderRadius:4,padding:'12px 26px',fontFamily:SERIF,fontSize:26,color:t[2],background:C.surface,...MOTION.pop(T,t0+1.4+i*0.12)}}>{t[0]} <span style={{color:C.ink3,fontSize:22}}>{t[1]}</span></div>)}
    </div>
  </div>;
}

function Map({T,CU}){
  const t0=CU.Map;
  const p=Easing.easeInOutSine(MOTION.draw(T,t0,2.6));
  const hl=NODES[23];
  return <div style={{position:'absolute',inset:0,background:`radial-gradient(1100px 900px at 50% 42%, #101013 0%, ${C.page} 70%)`,opacity:fadeIO(T,t0,CU.Band,0.35,0.35)}}>
    <div style={{position:'absolute',left:0,right:0,top:210,textAlign:'center',zIndex:3,...MOTION.enter(T,t0+0.15)}}>
      <Kicker T={T} at={t0+0.15}>The knowledge map</Kicker></div>
    <div style={{position:'absolute',left:90,top:330,width:900,height:1200,transform:`scale(${1.08+0.42*p})`,transformOrigin:`${hl.x/900*100}% ${hl.y/1200*100}%`}}>
      <svg viewBox="0 0 900 1200" style={{width:'100%',height:'100%',overflow:'visible'}}>
        {EDGES.map(([i,j],k)=><line key={k} x1={NODES[i].x} y1={NODES[i].y} x2={NODES[j].x} y2={NODES[j].y} stroke={C.ink} strokeOpacity={0.09*clamp((T-t0-0.2-k*0.012)/0.6,0,1)} strokeWidth={1}/>)}
        {NODES.map((nd,i)=><circle key={i} cx={nd.x} cy={nd.y} r={nd.r*clamp((T-t0-i*0.014)/0.5,0,1)} fill={nd.c} opacity={0.55+0.4*Math.sin(T*1.8+nd.tw)}/>)}
        <circle cx={hl.x} cy={hl.y} r={16+26*MOTION.draw(T,t0+0.85,0.7)} fill="none" stroke={C.gold} strokeWidth={2} opacity={clamp(MOTION.draw(T,t0+0.85,0.45)-MOTION.draw(T,t0+2.2,0.8)*0.4,0,1)}/>
      </svg>
      <div style={{position:'absolute',left:hl.x+26,top:hl.y+22,background:C.s3,border:`1px solid ${C.hairS}`,borderRadius:5,padding:'10px 16px',boxShadow:'0 14px 40px rgba(0,0,0,0.55)',...MOTION.pop(T,t0+1.15)}}>
        <div style={{fontSize:11,letterSpacing:'0.2em',textTransform:'uppercase',color:C.gold,fontFamily:SERIF}}>JEE · Calculus</div>
        <div style={{fontSize:16,color:C.ink,fontFamily:SERIF,marginTop:3}}>Limits — mastery 87%</div>
      </div>
    </div>
    <div style={{position:'absolute',left:0,right:0,bottom:330,textAlign:'center',fontFamily:SERIF,fontSize:34,color:C.ink2,...MOTION.enter(T,t0+1.55)}}>
      Every topic, NCERT to Olympiad. <span style={{color:C.gold}}>All of it, mapped.</span></div>
  </div>;
}

function Band({T,CU}){
  const t0=CU.Band;
  const pn=(84+15.4*Easing.easeOutQuart(MOTION.draw(T,t0+0.3,1.15))).toFixed(1);
  const fill=0.94*Easing.easeInOutCubic(MOTION.draw(T,t0+0.6,1.1));
  const numPop=1+0.08*(1-Easing.easeOutBack(clamp((T-t0-1.45)/0.4,0,1)))*(T>t0+1.45?1:0);
  return <div style={{position:'absolute',inset:0,background:C.page,opacity:fadeIO(T,t0,CU.Match,0.35,0.001)}}>
    <div style={{position:'absolute',left:140,right:140,top:600,border:`1px solid ${C.hairS}`,borderRadius:6,background:`linear-gradient(180deg,${C.goldSoft},transparent 40%),${C.surface}`,padding:'54px 60px 60px',...MOTION.enter(T,t0+0.1,0.85,54)}}>
      <div style={{fontSize:24,letterSpacing:'0.3em',textTransform:'uppercase',color:C.ink3,fontFamily:SERIF}}>Predicted JEE percentile</div>
      <div style={{fontFamily:SERIF,fontSize:300,lineHeight:1.05,color:C.ink,textAlign:'center',transform:`scale(${numPop})`}}>
        {pn}<span style={{fontSize:64,color:C.ink2,marginLeft:16}}>%ile</span>
      </div>
      <div style={{height:7,background:C.s3,borderRadius:3,overflow:'hidden',marginTop:26}}>
        <div style={{height:'100%',width:`${fill*100}%`,background:`linear-gradient(90deg,${C.gold},${C.goldB})`,borderRadius:3,boxShadow:`0 0 14px ${C.goldBord}`}}></div>
      </div>
      <div style={{marginTop:22,fontFamily:SERIF,fontSize:26,color:C.ink2,...MOTION.enter(T,t0+1.15)}}>
        calibrated to JEE Main · confidence ±0.4 · trajectory ↗</div>
      <div style={{marginTop:12,fontFamily:SERIF,fontSize:17,color:C.ink3,...MOTION.enter(T,t0+1.35,0.6,10)}}>
        Estimate from your practice data — not a guarantee of results.</div>
    </div>
  </div>;
}

function Match({T,CU}){
  const t0=CU.Match;
  const p=MOTION.draw(T,t0+0.45,1.8);
  const lanes=[
    {n:'You',ini:'A',max:1.0,c:C.cream,cf:t=>Math.pow(t,1.9)},
    {n:'Ishaan',ini:'I',max:0.88,c:C.ink3,cf:t=>Math.pow(t,0.85)},
    {n:'Kabir',ini:'K',max:0.7,c:C.ink3,cf:t=>Math.pow(t,0.9)},
    {n:'Rohan',ini:'R',max:0.48,c:C.ink3,cf:t=>Math.pow(t,1)}];
  const scores=[1240,1180,990,760];
  return <div style={{position:'absolute',inset:0,background:C.page,opacity:fadeIO(T,t0,CU.Exam,0.001,0.001)}}>
    <MathField T={T} opacity={0.35}/>
    <div style={{position:'absolute',left:0,right:0,top:430,textAlign:'center',...MOTION.enter(T,t0+0.1)}}>
      <Kicker T={T} at={t0+0.1}>Match mode</Kicker>
      <div style={{fontFamily:SERIF,fontSize:52,color:C.ink,marginTop:16}}>Race the arena.</div>
      <div style={{fontFamily:SERIF,fontSize:26,color:C.ink3,marginTop:8}}>Algebra · Calculus · Coordinate Geometry</div>
    </div>
    <div style={{position:'absolute',left:130,right:130,top:790,display:'grid',gap:34}}>
      {lanes.map((l,i)=>{const lp=l.cf(p)*l.max;const win=i===0&&T>t0+2.3;
        return <div key={i} style={{display:'flex',alignItems:'center',gap:20,...MOTION.enter(T,t0+0.3+i*0.1,0.6,26)}}>
          <div style={{width:56,height:56,border:`1px solid ${i===0?C.cream:C.hairS}`,borderRadius:5,display:'grid',placeItems:'center',fontFamily:SERIF,fontSize:24,color:i===0?C.ink:C.ink2,background:C.s2,boxShadow:i===0?`0 0 0 1px ${C.cream}`:'none',position:'relative'}}>{l.ini}{i===0&&<span style={{position:'absolute',top:-40,left:'50%',marginLeft:-15,fontSize:30,color:C.gold,...MOTION.pop(T,t0+2.35)}}>♛</span>}</div>
          <div style={{width:130,fontFamily:SERIF,fontSize:26,color:i===0?C.ink:C.ink2}}>{l.n}</div>
          <div style={{flex:1,height:14,border:`1px solid ${C.hair}`,borderRadius:3,background:C.s3,overflow:'hidden'}}>
            <div style={{height:'100%',width:`${lp*100}%`,background:i===0?`linear-gradient(90deg,${C.cream},#fffdf2)`:C.ink3,borderRadius:2,boxShadow:i===0?'0 0 16px rgba(244,241,224,0.3)':'none'}}></div>
          </div>
          <div style={{width:90,textAlign:'right',fontFamily:SERIF,fontSize:28,color:i===0?C.ink:C.ink3,fontVariantNumeric:'tabular-nums'}}>{Math.round(scores[i]*lp/l.max)}</div>
          {i===0&&<span style={{position:'absolute',right:-4,marginTop:-58,fontFamily:SERIF,fontSize:24,color:C.gold,...MOTION.pop(T,t0+2.35)}}>{win?'+18 rating':''}</span>}
        </div>;})}
    </div>
    <div style={{position:'absolute',inset:0,pointerEvents:'none',background:'radial-gradient(620px 420px at 50% 46%, rgba(201,173,99,0.16), transparent 70%)',opacity:clamp((T-t0-2.3)/0.15,0,1)*(1-clamp((T-t0-2.6)/0.5,0,1))}}></div>
    {[0,1,2,3,4,5].map(k=>{const pp=MOTION.draw(T,t0+2.35,0.6);const ang=k*1.047+0.3;return <div key={'pt'+k} style={{position:'absolute',left:905+Math.cos(ang)*95*pp,top:812+Math.sin(ang)*72*pp,width:7,height:7,borderRadius:'50%',background:C.gold,opacity:T>t0+2.35?(1-pp)*0.8:0}}></div>;})}
    <div style={{position:'absolute',left:0,right:0,top:1240,textAlign:'center',fontFamily:SERIF,fontSize:30,color:C.ink2,...MOTION.enter(T,t0+2.0)}}>
      Rookie → Pro → <span style={{color:C.gold}}>Legend</span> · live leaderboard</div>
  </div>;
}

function Exam({T,CU}){
  const t0=CU.Exam;
  const e=Easing.easeOutQuart(clamp((T-t0-0.1)/0.8,0,1));
  const rows=[['Substitution t = cos x, dt handled','2','✓'],['Limits transformed to −1 … 1','1','✓'],['Exact value stated as π²/4','1','✗']];
  return <div style={{position:'absolute',inset:0,background:C.page,opacity:fadeIO(T,t0,CU.Kit,0.001,0.2)}}>
    <div style={{position:'absolute',left:0,right:0,top:250,textAlign:'center',...MOTION.enter(T,t0+0.1)}}>
      <Kicker T={T} at={t0+0.1}>Full mock papers</Kicker></div>
    <div style={{position:'absolute',left:168,right:132,top:418,height:1060,background:'#eae6d8',borderRadius:6,transform:`rotate(${1.6*e}deg)`,boxShadow:'0 30px 80px rgba(0,0,0,0.5)',opacity:e*0.9}}></div>
    <div style={{position:'absolute',left:150,right:150,top:400,height:1080,background:C.lpage,borderRadius:6,boxShadow:'0 50px 130px rgba(0,0,0,0.75)',padding:'56px 60px',opacity:e,transform:`translateY(${(1-e)*90}px) rotate(${-2.5+2.5*e}deg)`}}>
      <div style={{fontFamily:SERIF,fontSize:36,color:C.link,textAlign:'center'}}>Mathematics</div>
      <div style={{fontFamily:SERIF,fontSize:19,color:C.link2,textAlign:'center',marginTop:6,letterSpacing:'0.14em',textTransform:'uppercase'}}>JEE Advanced pattern · Mock Paper 1</div>
      <div style={{borderTop:`1px solid ${C.lhair}`,margin:'30px 0 24px'}}></div>
      {[0,1,2].map(q=><div key={q} style={{display:'flex',gap:16,alignItems:'baseline',marginBottom:22,...MOTION.enter(T,t0+0.5+q*0.18,0.5,18)}}>
        <span style={{fontFamily:SERIF,fontSize:23,color:C.link,fontWeight:700}}>{q+11}.</span>
        <div style={{flex:1}}>
          <div style={{height:11,background:'rgba(26,24,16,0.14)',borderRadius:2,width:`${88-q*9}%`}}></div>
          <div style={{height:11,background:'rgba(26,24,16,0.09)',borderRadius:2,width:`${60-q*8}%`,marginTop:9}}></div>
        </div>
        <span style={{fontFamily:SERIF,fontSize:17,color:C.link2}}>({3-q} marks)</span>
      </div>)}
      <div style={{border:`1px solid rgba(26,24,16,0.3)`,marginTop:30,...MOTION.enter(T,t0+1.1,0.6,22)}}>
        <div style={{display:'flex',fontFamily:SERIF,fontSize:14,letterSpacing:'0.16em',textTransform:'uppercase',color:C.link2,borderBottom:`1px solid rgba(26,24,16,0.3)`,background:'rgba(26,24,16,0.05)'}}>
          <div style={{flex:1,padding:'9px 16px'}}>Marking criteria</div><div style={{width:90,padding:'9px 0',textAlign:'center',borderLeft:`1px solid rgba(26,24,16,0.3)`}}>Marks</div>
        </div>
        {rows.map((r,i)=><div key={i} style={{display:'flex',fontFamily:SERIF,fontSize:19,color:C.link,borderBottom:i<2?`1px solid ${C.lhair}`:'none',...MOTION.enter(T,t0+1.3+i*0.15,0.45,12)}}>
          <div style={{flex:1,padding:'10px 16px'}}>{r[0]} <span style={{color:r[2]==='✓'?'#3f7d4c':'#a33228'}}>{r[2]}</span>{i===2&&<span style={{fontFamily:HAND,fontSize:24,color:'#a33228',display:'inline-block',transform:'rotate(-4deg)',marginLeft:10,...MOTION.pop(T,t0+2.1)}}>−1</span>}</div>
          <div style={{width:90,padding:'10px 0',textAlign:'center',borderLeft:`1px solid rgba(26,24,16,0.3)`,fontVariantNumeric:'tabular-nums'}}>{r[1]}</div>
        </div>)}
      </div>
      <div style={{position:'absolute',right:52,top:44,border:'2.5px solid #a33228',color:'#a33228',borderRadius:6,padding:'8px 18px',fontFamily:SERIF,fontSize:34,transform:'rotate(6deg)',...MOTION.pop(T,t0+1.95)}}>12 / 15</div>
    </div>
    <div style={{position:'absolute',left:0,right:0,bottom:290,textAlign:'center',fontFamily:SERIF,fontSize:30,color:C.ink2,...MOTION.enter(T,t0+1.7)}}>
      multipart (a)(b)(c) · worked solutions · <span style={{color:C.gold}}>step marks, like a real examiner</span></div>
  </div>;
}

function Kit({T,CU}){
  const t0=CU.Kit;
  const cards=[
    ['Smart Practice','Elo-tuned to ~70% success · weak spots first'],
    ['3-level hints','stuck is never stopped'],
    ['Photo answers','snap your paper working'],
    ['90-second Rush','streaks · XP · 22 achievements'],
    ['History replay','re-attempt with fresh numbers'],
    ['Scribble pad','rough work, saved with the attempt'],
    ['Teacher task packs','AirDrop to the class · no server'],
    ['Encrypted backup','your whole history, one file']];
  const per=0.65,lead=0.2;
  const idx=Math.min(cards.length-1,Math.max(0,Math.floor((T-t0-lead)/per)));
  const ct=(T-t0-lead)-idx*per;
  const p=clamp(ct/0.18,0,1);const e=Easing.easeOutCubic(p);
  const c=cards[idx];
  const xp=clamp((ct-(per-0.16))/0.16,0,1);const ex=idx<7?xp*xp*xp:0;
  const dotP=Easing.easeOutCubic(p);
  return <div style={{position:'absolute',inset:0,background:C.page}}>
    <MathField T={T} opacity={0.3}/>
    <div style={{position:'absolute',left:0,right:0,top:430,textAlign:'center'}}>
      <Kicker T={T} at={t0+0.05}>And the whole toolkit</Kicker></div>
    <div style={{position:'absolute',left:80,right:80,top:800,textAlign:'center',opacity:e*(1-ex),transform:`translateX(${(1-e)*90-ex*90}px) scale(${0.96+0.04*e})`,filter:(e<1||ex>0)?`blur(${((1-e)+ex)*3}px)`:'none'}}>
      <div style={{fontFamily:SERIF,fontSize:22,letterSpacing:'0.34em',color:C.gold,marginBottom:18}}>{String(idx+1).padStart(2,'0')} / 08</div>
      <div style={{fontFamily:SERIF,fontSize:96,color:C.ink,lineHeight:1.1}}>{c[0]}</div>
      <div style={{fontFamily:SERIF,fontSize:32,color:C.gold,marginTop:22}}>{c[1]}</div>
    </div>
    <div style={{position:'absolute',left:0,right:0,top:1210,display:'flex',gap:14,justifyContent:'center'}}>
      {cards.map((_,i)=>{const grow=i===idx?dotP:(i===idx-1?1-dotP:0);
        return <div key={i} style={{width:10+24*grow,height:10,borderRadius:5,background:i===idx?C.gold:C.hairS}}></div>;})}
    </div>
    <div style={{position:'absolute',left:0,right:0,top:1330,textAlign:'center',fontFamily:SERIF,fontSize:27,color:C.ink3}}>8 tools · all offline · all included</div>
  </div>;
}

function Price({T,CU}){
  const t0=CU.Price;
  const strike=MOTION.draw(T,t0+0.85,0.4);
  const dim=1-0.5*MOTION.draw(T,t0+1.35,0.4);
  const up=-34*MOTION.draw(T,t0+1.35,0.4);
  return <div style={{position:'absolute',inset:0,background:C.page,opacity:fadeIO(T,t0,CU.Close,0.25,0.3)}}>
    <MathField T={T} opacity={0.25}/>
    <div style={{position:'absolute',left:0,right:0,top:410,textAlign:'center',...MOTION.enter(T,t0+0.05)}}>
      <Kicker T={T} at={t0+0.05}>The maths of the price</Kicker></div>
    <div style={{position:'absolute',left:0,right:0,top:540,textAlign:'center',opacity:dim,transform:`translateY(${up}px)`}}>
      <div style={{fontFamily:SERIF,fontSize:30,color:C.ink3,...MOTION.enter(T,t0+0.15)}}>Big-brand coaching</div>
      <div style={{marginTop:10,...MOTION.enter(T,t0+0.3)}}>
        <span style={{position:'relative',display:'inline-block',fontFamily:SERIF,fontSize:120,color:C.ink,fontVariantNumeric:'tabular-nums'}}>
          ₹2,00,000<span style={{fontSize:42,color:C.ink2}}> / year</span>
          <span style={{position:'absolute',left:'-2%',top:'55%',height:6,width:`${strike*104}%`,background:C.gold,boxShadow:`0 0 16px ${C.goldBord}`,borderRadius:3}}></span>
        </span>
      </div>
    </div>
    <div style={{position:'absolute',left:'50%',top:1080,width:12,height:12,borderRadius:'50%',border:`2px solid ${C.goldBord}`,transform:`translate(-50%,-50%) scale(${1+70*MOTION.draw(T,t0+1.6,0.7)})`,opacity:0.55*(1-MOTION.draw(T,t0+1.6,0.7))}}></div>
    <div style={{position:'absolute',left:0,right:0,top:900,textAlign:'center',...MOTION.pop(T,t0+1.5,0.6)}}>
      <div style={{fontFamily:SERIF,fontSize:26,letterSpacing:'0.26em',textTransform:'uppercase',color:C.gold}}>Pri Learning</div>
      <div style={{fontFamily:SERIF,fontSize:170,color:C.gold,lineHeight:1.15,textShadow:'0 0 60px rgba(201,173,99,0.25)'}}>₹999<span style={{fontSize:48,color:C.ink2}}> / month</span></div>
      <div style={{fontFamily:SERIF,fontSize:30,color:C.ink2,marginTop:14,...MOTION.enter(T,t0+2.1)}}>under ₹34 a day · cancel anytime</div>
    </div>
    <div style={{position:'absolute',left:0,right:0,top:1390,display:'flex',gap:20,justifyContent:'center'}}>
      {[['save ₹1,88,012 a year',1],['100% offline',0],['no lock-in',0]].map(([c,g],i)=>
        <div key={i} style={{border:`1px solid ${g?C.goldBord:C.hairS}`,borderRadius:4,padding:'11px 24px',fontFamily:SERIF,fontSize:22,letterSpacing:'0.12em',textTransform:'uppercase',color:g?C.gold:C.ink2,background:g?C.goldSoft:C.surface,...MOTION.pop(T,t0+2.5+i*0.12)}}>{c}</div>)}
    </div>
    <div style={{position:'absolute',left:0,right:0,top:1478,textAlign:'center',fontFamily:SERIF,fontSize:17,color:C.ink3,...MOTION.enter(T,t0+2.8,0.6,10)}}>
      Savings vs a typical big-brand two-year JEE classroom programme.</div>
  </div>;
}

function Close({T,CU,total}){
  const t0=CU.Close;
  const glow=24+10*Math.sin(T*2.6);
  const out=MOTION.draw(T,total-0.7,0.7);
  return <div style={{position:'absolute',inset:0,background:C.page}}>
    <MathField T={T} opacity={0.6*clamp(MOTION.draw(T,t0,1),0,1)}/>
    {[[150,520,0],[912,560,2.1],[236,1480,4.2]].map(([x,y,ph],i)=><span key={'tw'+i} style={{position:'absolute',left:x,top:y,fontSize:26,color:C.gold,opacity:clamp(MOTION.draw(T,t0+0.6,0.8),0,1)*(0.25+0.75*Math.max(0,Math.sin(T*2.4+ph)))}}>✦</span>)}
    <div style={{position:'absolute',left:0,right:0,top:620,textAlign:'center',...MOTION.enter(T,t0+0.4)}}>
      <Kicker T={T} at={t0+0.4} style={{color:C.gold,fontSize:23,whiteSpace:'nowrap'}}>Write it by hand · marked like an examiner</Kicker></div>
    <div style={{position:'absolute',left:0,right:0,top:740,textAlign:'center',...MOTION.pop(T,t0+0.1,0.7)}}>
      <span style={{fontFamily:AMS,fontSize:168,color:C.ink}}>P</span>
      <span style={{fontFamily:SERIF,fontSize:132,color:C.ink}}>ri Learning</span>
    </div>
    <div style={{position:'absolute',left:0,right:0,top:1100,textAlign:'center',...MOTION.enter(T,t0+0.85,0.7,40)}}>
      <span style={{display:'inline-block',whiteSpace:'nowrap',background:C.cream,color:C.creamInk,fontFamily:SERIF,fontSize:44,letterSpacing:'0.04em',padding:'26px 64px',borderRadius:5,boxShadow:`0 0 ${glow}px rgba(244,241,224,0.28)`,transform:`scale(${1+0.014*Math.sin(T*3)})`}}>Coming soon</span>
    </div>
    <div style={{position:'absolute',left:0,right:0,top:1305,textAlign:'center',fontFamily:SERIF,fontSize:27,color:C.ink3,whiteSpace:'nowrap',...MOTION.enter(T,t0+1.25)}}>
      Class 9–12 · JEE Main & Advanced · Olympiad · iPad + Pencil</div>
    <div style={{position:'absolute',left:0,right:0,top:1390,textAlign:'center',...MOTION.enter(T,t0+1.6)}}>
      <span style={{display:'inline-block',border:`1px solid ${C.goldBord}`,background:C.goldSoft,color:C.gold,borderRadius:4,padding:'9px 26px',fontFamily:SERIF,fontSize:24,letterSpacing:'0.14em',textTransform:'uppercase'}}>Follow @pri.learning for launch</span>
    </div>
    <div style={{position:'absolute',inset:0,background:C.page,opacity:out,pointerEvents:'none'}}></div>
  </div>;
}

function Supers({T,CU,on}){
  if(!on)return null;
  const items=[
    {at:CU.Write+0.3,until:CU.Write+2.3,t:<span>A real <em style={{color:C.gold}}>JEE Advanced</em> integral.</span>},
    {at:CU.Write+2.3,until:CU.Marked,t:<span>Read live, <em style={{color:C.gold}}>symbol by symbol.</em></span>},
    {at:CU.Marked+0.2,until:CU.Marked+1.9,t:<span>Step marks: <em style={{color:C.gold}}>M1 · M1 · A1.</em></span>},
    {at:CU.Marked+1.9,until:CU.Bank-0.1,t:<span>Like a real examiner.</span>},
    {at:CU.Map+0.25,until:CU.Band-0.1,t:<span>Every topic on the syllabus.</span>},
    {at:CU.Match+0.25,until:CU.Exam-0.05,t:<span>Race rivals in <em style={{color:C.gold}}>Match Mode.</em></span>},
  ];
  const a=items.find(it=>T>=it.at&&T<it.until);
  if(!a)return null;
  const e=MOTION.enter(T,a.at,0.55,22);
  return <div style={{position:'absolute',left:80,right:80,top:1408,textAlign:'center',...e}}><div style={{width:38,height:3,background:C.gold,margin:'0 auto 14px',borderRadius:2,opacity:0.85}}></div><div style={{fontFamily:SERIF,fontSize:46,color:C.ink,textShadow:'0 2px 24px rgba(0,0,0,0.8)'}}>{a.t}</div></div>;
}

/* Soundtrack: assets/vo-mix.wav is the full commercial mix (music + recorded
   VO, ducking baked in) — preferred when present, and speech synthesis stays
   silent so the voice isn't doubled. Falls back to music.wav + live
   speech-synthesis VO when the mix hasn't been generated. */
function AudioRig({musicOn,voOn,CU}){
  const {T,time,playing,duration}=useComposition();
  const vref=useRef(null);
  const [audioSrc,setAudioSrc]=useState('./assets/vo-mix.wav');
  const baked=audioSrc.indexOf('vo-mix')>=0;
  const VO=useMemo(()=>[
    {at:CU.Hook+0.05,text:'What if your handwriting, marked itself?'},
    {at:CU.Write+0.15,text:'A real J E E Advanced integral. Watch it read every symbol, live.'},
    {at:CU.Marked+0.1,text:'Marked step by step, like a real examiner. Full marks.'},
    {at:CU.Bank+0.1,text:'Over three lakh J E E style questions.'},
    {at:CU.Map+0.1,text:'Every topic on the syllabus, mapped.'},
    {at:CU.Band+0.1,text:'Your J E E percentile? Predicted.'},
    {at:CU.Match+0.1,text:'Race your rivals in Match Mode.'},
    {at:CU.Exam+0.1,text:'Full mocks. Real marking.'},
    {at:CU.Kit+0.1,text:'Smart practice, hints, photo answers, rush rounds, streaks, task packs, backups.'},
    {at:CU.Price+0.1,text:'Two lakhs a year for coaching. This? Nine ninety nine a month.'},
    {at:CU.Close+0.15,text:'Pri Learning. Coming soon.'},
  ],[CU]);
  let ai=-1;for(let i=0;i<VO.length;i++){const until=i+1<VO.length?VO[i+1].at:VO[i].at+3.8;if(T>=VO[i].at&&T<until)ai=i;}
  useEffect(()=>{
    const un=()=>{const v=vref.current;if(v&&v.paused&&!window.__priPlaying){v.play().then(()=>{if(!window.__priPlaying)v.pause();}).catch(()=>{});}
      try{window.speechSynthesis&&speechSynthesis.resume();}catch(e){}
      try{window.speechSynthesis&&speechSynthesis.getVoices();}catch(e){}};
    window.addEventListener('pointerdown',un,{passive:true});
    window.addEventListener('pri-audio-unlock',un);
    return()=>{window.removeEventListener('pointerdown',un);window.removeEventListener('pri-audio-unlock',un);};
  },[]);
  const sync=Math.round(time*2);
  useEffect(()=>{const v=vref.current;if(!v)return;window.__priPlaying=playing;v.volume=0.9;
    if(playing&&musicOn){if(Math.abs(v.currentTime-time)>0.3){try{v.currentTime=Math.max(0,time);}catch(e){}}
      if(v.paused)v.play().catch(()=>{});}
    else if(!v.paused){v.pause();try{v.currentTime=Math.max(0,time);}catch(e){}}
  },[playing,musicOn,sync]);
  useEffect(()=>{if(!('speechSynthesis'in window)||baked)return;
    speechSynthesis.cancel();
    if(!playing||!voOn||ai<0)return;
    const ln=VO[ai];if(T-ln.at>1.8)return;
    const u=new SpeechSynthesisUtterance(ln.text);
    const vs=speechSynthesis.getVoices();
    const en=vs.filter(v=>/^en/i.test(v.lang));
    const inn=en.filter(v=>/en[-_]in/i.test(v.lang)||/india/i.test(v.name));
    const pick=inn.find(v=>/(natural|neural|premium|enhanced)/i.test(v.name))
      ||en.find(v=>/Neerja|Heera|Rishi|Veena|Isha|Kajal|Prabhat/i.test(v.name))
      ||inn[0]
      ||en.find(v=>/(natural|neural|premium|enhanced)/i.test(v.name))
      ||en.find(v=>v.lang==='en-GB')
      ||en.find(v=>/Samantha|Google US English/i.test(v.name));
    if(pick)u.voice=pick;else u.lang='en-IN';
    u.rate=0.99;u.pitch=0.96;u.volume=1;
    speechSynthesis.speak(u);
    return()=>{try{speechSynthesis.cancel();}catch(e){}};
  },[ai,playing,voOn,baked]);
  return <video ref={vref} src={audioSrc} preload="auto" playsInline
    onError={()=>{if(baked)setAudioSrc('./assets/music.wav');
      else console.warn('reel: music track missing or failed to load — continuing silent');}}
    data-om-exportable-video-play-start="0" data-om-exportable-video-play-end={duration}
    style={{position:'absolute',left:0,top:0,width:2,height:2,opacity:0,pointerEvents:'none'}}></video>;
}

function Piece({voiceOver,music,captions}){
  const {T,CUES,authoredTotal}=useComposition();
  const CU=CUES;
  const gf=Math.floor(T*12);
  const flash=(t,d=0.14)=>T>=t?clamp(1-(T-t)/d,0,1):0;
  const fl=Math.max(flash(CU.Bank),flash(CU.Price),0.7*flash(CU.Close));
  return <div data-screen-label={'reel t='+Math.floor(T)+'s'} style={{position:'absolute',inset:0,background:C.page,overflow:'hidden',fontFamily:SERIF,color:C.ink}}>
    <div style={{position:'absolute',left:0,top:0,width:1080,height:1920,transform:'scale(2)',transformOrigin:'0 0',filter:'contrast(1.025) saturate(1.06) brightness(1.01)'}}>
      <Shot from={CU.Hook} to={CU.Write}><Hook T={T} CU={CU}/></Shot>
      <Shot from={CU.Write} to={CU.Bank}><Device T={T} CU={CU}/></Shot>
      <Shot from={CU.Bank} to={CU.Map+0.4}><Bank T={T} CU={CU}/></Shot>
      <Shot from={CU.Map} to={CU.Band+0.4}><Map T={T} CU={CU}/></Shot>
      <Shot from={CU.Band} to={CU.Match}><Band T={T} CU={CU}/></Shot>
      <Shot from={CU.Match} to={CU.Exam}><Match T={T} CU={CU}/></Shot>
      <Shot from={CU.Exam} to={CU.Kit+0.1}><Exam T={T} CU={CU}/></Shot>
      <Shot from={CU.Kit} to={CU.Price+0.05}><Kit T={T} CU={CU}/></Shot>
      <Shot from={CU.Price} to={CU.Close+0.4}><Price T={T} CU={CU}/></Shot>
      <Shot from={CU.Close} to={authoredTotal+0.01}><Close T={T} CU={CU} total={authoredTotal}/></Shot>
      <Supers T={T} CU={CU} on={captions!==false}/>
      <div style={{position:'absolute',inset:0,pointerEvents:'none',background:'radial-gradient(120% 90% at 50% 42%, transparent 52%, rgba(0,0,0,0.42) 100%)'}}></div>
      <div style={{position:'absolute',inset:0,pointerEvents:'none',background:'linear-gradient(180deg, rgba(201,173,99,0.05), transparent 28%, transparent 74%, rgba(0,0,0,0.2))'}}></div>
      <div style={{position:'absolute',inset:-40,pointerEvents:'none',opacity:0.05,mixBlendMode:'overlay',backgroundImage:`url("${GRAIN}")`,backgroundSize:'280px 280px',transform:`translate(${(gf*97)%23}px,${(gf*61)%19}px)`}}></div>
      <div style={{position:'absolute',inset:0,pointerEvents:'none',background:'#f4f1e0',opacity:0.09*fl}}></div>
      {T<CU.Close&&<div style={{position:'absolute',left:44,top:40,display:'flex',alignItems:'baseline',opacity:0.55*clamp(T/0.4,0,1)}}><span style={{fontFamily:AMS,fontSize:29,color:C.ink}}>P</span><span style={{fontFamily:SERIF,fontSize:23,color:C.ink}}>ri Learning</span></div>}
    </div>
    <AudioRig musicOn={music!==false} voOn={voiceOver!==false} CU={CU}/>
  </div>;
}

function PriReel(props){
  return <CompositionStage width={2160} height={3840} bg="#0a0a09"
    scenes={window.OM_SCENES} playback={window.OM_PLAYBACK}>
    <Piece voiceOver={props.voiceOver} music={props.music} captions={props.captions}/>
  </CompositionStage>;
}
window.PriReel = PriReel;
