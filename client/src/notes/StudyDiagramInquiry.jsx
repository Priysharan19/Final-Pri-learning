// Independent vector drawing of more advanced source-grounded mathematics diagrams.
// Receives only author-controlled plain numeric objects; no external media or HTML injection.
import React from 'react';
const W=600,H=360;
const color='var(--nt-accent)',muted='var(--nt-ink-3)',ink='var(--nt-ink)';
const line={fill:'none',stroke:color,strokeWidth:2.6,strokeLinejoin:'round',strokeLinecap:'round'};
const small={fill:muted,fontFamily:'var(--font,system-ui,sans-serif)',fontSize:12};
const txt={fill:ink,fontFamily:'var(--font,system-ui,sans-serif)',fontSize:14};
const show=n=>Number(n.toFixed(3)).toString();
const T=({x,y,children,...props})=><text x={x} y={y} {...txt} {...props}>{children}</text>;
const axes=(x0,y0,x1,y1)=> <g><line x1={x0} y1={y1} x2={x1} y2={y1} stroke={muted} strokeWidth="1.6"/><line x1={x0} y1={y0} x2={x0} y2={y1} stroke={muted} strokeWidth="1.6"/></g>;
function Wave({f}){
 const {amp,k}=f,left=55,right=550,top=35,bottom=319,mid=(top+bottom)/2;
 const sx=x=>left+x/(2*Math.PI)*(right-left),sy=y=>mid-y*102/amp;
 const d=Array.from({length:481},(_,i)=>{
   const x=i*(2*Math.PI)/480,y=amp*Math.sin(k*x);
   return (i===0?'M':'L')+sx(x)+' '+sy(y);
 }).join(' ');
 return <g>
  <line x1={left} x2={right} y1={mid} y2={mid} stroke={muted} strokeWidth="1.6"/>
  <line x1={left} x2={left} y1={top} y2={bottom} stroke={muted} strokeWidth="1.6"/>
  {[0,.5,1,1.5,2].map(z=><g key={z}><line x1={sx(z*Math.PI)} x2={sx(z*Math.PI)} y1={mid-5} y2={mid+5} stroke={muted}/><T x={sx(z*Math.PI)} y={mid+25} textAnchor="middle" fontSize="13">{({0:'0',.5:'π/2',1:'π',1.5:'3π/2',2:'2π'})[z]}</T></g>)}
  <T x={left-11} y={sy(amp)+4} textAnchor="end">+{amp}</T><T x={left-11} y={sy(-amp)+4} textAnchor="end">−{amp}</T>
  <line x1={left} x2={right} y1={sy(amp)} y2={sy(amp)} stroke={muted} strokeDasharray="3 6" opacity=".55"/>
  <line x1={left} x2={right} y1={sy(-amp)} y2={sy(-amp)} stroke={muted} strokeDasharray="3 6" opacity=".55"/>
  <path d={d} {...line}/>
  <T x="550" y="30" textAnchor="end" fontSize="13">y = {amp} sin({k}x)</T>
 </g>;
}
function Histogram({f}){
 const {counts,width}=f,n=counts.length,max=Math.max(...counts),left=70,right=545,top=39,bottom=300;
 const sx=i=>left+i*(right-left)/n,sy=v=>bottom-v*(bottom-top-18)/max;
 const step=Math.max(1,Math.ceil(max/6)),ticks=Array.from({length:Math.floor(max/step)+1},(_,i)=>i*step);
 return <g>
  {ticks.map(v=><g key={v}><line x1={left} x2={right} y1={sy(v)} y2={sy(v)} stroke={muted} strokeOpacity=".23"/><T x={left-13} y={sy(v)+4} textAnchor="end" fontSize="12">{v}</T></g>)}
  {counts.map((v,i)=>{
   const x=sx(i),w=sx(i+1)-x;
   return <g key={i}><rect x={x} y={sy(v)} width={w} height={bottom-sy(v)} fill="var(--nt-accent-soft)" stroke={color} strokeWidth="1.7"/>
    <T x={x+w/2} y={sy(v)-9} textAnchor="middle" fontSize="13">{v}</T>
    <T x={x+w/2} y={bottom+24} textAnchor="middle" fontSize="12">{i*width}–{(i+1)*width}</T></g>;
  })}
  <line x1={left} y1={bottom} x2={right} y2={bottom} stroke={ink} strokeWidth="1.3"/>
  <T x="300" y="347" textAnchor="middle" fontSize="12">Contiguous equal-width class intervals</T>
 </g>;
}
function BoxPlot({f}){
 const {min,q1,med,q3,max}=f,left=70,right=535,y=178;
 const range=max-min,lo=min-0.1*range,hi=max+0.1*range,px=v=>left+(v-lo)/(hi-lo)*(right-left);
 const vals=[min,q1,med,q3,max];
 return <g>
  <T x="300" y="80" textAnchor="middle" fontWeight="bold">Five-number summary</T>
  <line x1={px(min)} y1={y} x2={px(max)} y2={y} {...line}/>
  {[min,max].map((x,i)=><line key={i} x1={px(x)} x2={px(x)} y1={y-27} y2={y+27} {...line}/>)}
  <rect x={px(q1)} y={y-48} width={px(q3)-px(q1)} height="96" fill="var(--nt-accent-soft)" stroke={color} strokeWidth="2.5"/>
  <line x1={px(med)} x2={px(med)} y1={y-48} y2={y+48} stroke={color} strokeWidth="3.5"/>
  {vals.map((v,i)=><g key={i}>
    <line x1={px(v)} x2={px(v)} y1={y+64} y2={y+73} stroke={muted}/>
    <T x={px(v)} y={y+97} textAnchor="middle" fontSize="13">{v}</T>
    <T x={px(v)} y={i%2===0?y-67:y-83} textAnchor="middle" fontSize="12">{['Min','Q1','Median','Q3','Max'][i]}</T>
  </g>)}
 </g>;
}
function Scatter({f}){
 const {xy,m,b}=f,left=66,right=536,top=44,bottom=306;
 const xs=xy.map(v=>v[0]),ys=xy.map(v=>v[1]),minX=Math.min(...xs),maxX=Math.max(...xs);
 const minY=Math.min(...ys),maxY=Math.max(...ys),padX=Math.max(1,(maxX-minX)*.12),padY=Math.max(1,(maxY-minY)*.14);
 const bx=[minX-padX,maxX+padX],by=[minY-padY,maxY+padY],sx=x=>left+(x-bx[0])/(bx[1]-bx[0])*(right-left),sy=y=>bottom-(y-by[0])/(by[1]-by[0])*(bottom-top);
 return <g>
  {axes(left,top,right,bottom)}
  <path d={'M'+sx(minX)+' '+sy(m*minX+b)+' L'+sx(maxX)+' '+sy(m*maxX+b)} {...line} strokeWidth="1.8" strokeDasharray="8 5"/>
  {xy.map(([x,y],i)=><g key={i}>
   <circle cx={sx(x)} cy={sy(y)} r="5.8" fill={color} stroke="var(--nt-raised)" strokeWidth="1.5"/>
   <T x={sx(x)+8} y={sy(y)-8} fontSize="12">({x},{y})</T>
  </g>)}
  {xs.map((v,i)=><T key={i} x={sx(v)} y={bottom+21} textAnchor="middle" fontSize="12">{v}</T>)}
  <T x="542" y="343" textAnchor="end" fontSize="13">x</T><T x="39" y="48" fontSize="13">y</T>
 </g>;
}
function Exponential({f}){
 const {base}=f,left=70,right=545,top=33,bottom=307,maxY=base**4;
 const sx=x=>left+x/4*(right-left),sy=y=>bottom-y/maxY*(bottom-top);
 const d=Array.from({length:121},(_,i)=>{const x=4*i/120;return (i?'L':'M')+sx(x)+' '+sy(base**x)}).join(' ');
 return <g>
  {axes(left,top,right,bottom)}
  {Array.from({length:5},(_,i)=><g key={i}>
   <line x1={sx(i)} x2={sx(i)} y1={bottom} y2={bottom+6} stroke={muted}/>
   <T x={sx(i)} y={bottom+25} textAnchor="middle" fontSize="12">{i}</T>
   <circle cx={sx(i)} cy={sy(base**i)} r="5" fill={color}/>
   <T x={sx(i)+8} y={Math.max(24,sy(base**i)-10)} fontSize="12">{base**i}</T>
  </g>)}
  <path d={d} {...line}/>
  <T x="530" y="27" textAnchor="end">y={base}^x</T>
 </g>;
}
function Piecewise({f}){
 const {left,right}=f,l=65,r=530,cx=300,cy=179,range=Math.max(3,Math.abs(left),Math.abs(right))+1;
 const sy=y=>cy-y/range*110;
 return <g>
  <line x1={l} x2={r} y1={cy} y2={cy} stroke={muted} strokeWidth="1.5"/>
  <line x1={cx} x2={cx} y1="39" y2="319" stroke={muted} strokeWidth="1.5"/>
  <line x1={l} x2={cx} y1={sy(left)} y2={sy(left)} {...line}/>
  <line x1={cx} x2={r} y1={sy(right)} y2={sy(right)} {...line}/>
  <circle cx={cx} cy={sy(left)} r="7" fill="var(--nt-raised)" stroke={color} strokeWidth="2.8"/>
  <circle cx={cx} cy={sy(right)} r="7" fill={color}/>
  <T x={l+10} y={sy(left)-12}>y={left} for x&lt;0</T>
  <T x={cx+25} y={sy(right)-12}>y={right} for x≥0</T>
  <T x={cx-13} y={cy+23}>0</T>
  <T x="300" y="343" textAnchor="middle" fontSize="13">○ open; ● included</T>
 </g>;
}
function Lattice({f}){
 const {east,north}=f,unit=Math.min(52,410/east,245/north),left=(600-east*unit)/2,top=48;
 const sx=i=>left+i*unit,sy=j=>top+(north-j)*unit;
 return <g>
  {Array.from({length:east+1},(_,i)=><line key={'x'+i} x1={sx(i)} x2={sx(i)} y1={sy(0)} y2={sy(north)} stroke={muted} strokeOpacity=".58"/>)}
  {Array.from({length:north+1},(_,j)=><line key={'y'+j} x1={sx(0)} x2={sx(east)} y1={sy(j)} y2={sy(j)} stroke={muted} strokeOpacity=".58"/>)}
  <path d={'M'+sx(0)+' '+sy(0)+' H'+sx(east)+' V'+sy(north)} {...line} strokeWidth="3.6"/>
  <circle cx={sx(0)} cy={sy(0)} r="6" fill={color}/><circle cx={sx(east)} cy={sy(north)} r="6" fill={color}/>
  <T x={sx(0)-15} y={sy(0)+22}>S</T><T x={sx(east)+12} y={sy(north)-8}>T</T>
  <T x="300" y="345" textAnchor="middle" fontSize="13">Only rightward or upward grid edges may be used</T>
 </g>;
}
export default function StudyDiagramInquiry({figure}) {
 switch(figure.type){
  case 'trig-wave':return <Wave f={figure}/>;
  case 'histogram':return <Histogram f={figure}/>;
  case 'box-plot':return <BoxPlot f={figure}/>;
  case 'scatter':return <Scatter f={figure}/>;
  case 'exponential':return <Exponential f={figure}/>;
  case 'piecewise':return <Piecewise f={figure}/>;
  case 'lattice':return <Lattice f={figure}/>;
  default:return null;
 }
}
