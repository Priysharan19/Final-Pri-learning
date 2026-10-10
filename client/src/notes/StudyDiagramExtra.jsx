// Vector-only specialist educational diagrams. Figures contain authored numerical data.
import React from 'react';
const color='var(--nt-accent)';
const ink='var(--nt-ink)';
const muted='var(--nt-ink-3)';
const TXT={fill:ink,fontFamily:'var(--font, sans-serif)',fontSize:15};
const LBL={...TXT,fontSize:13};
const STROKE={fill:'none',stroke:color,strokeWidth:2.5};
const shade={fill:'var(--nt-accent-soft)',stroke:color,strokeWidth:2.1};
const T=({x,y,children,...rest})=><text x={x} y={y} {...TXT} {...rest}>{children}</text>;

function Venn({f}){
 return <g>
  <rect x="62" y="37" width="474" height="278" rx="12" fill="none" stroke={muted}/>
  <circle cx="245" cy="174" r="102" {...shade}/><circle cx="355" cy="174" r="102" {...shade}/>
  <T x="187" y="82" fontWeight="bold">A</T><T x="407" y="82" fontWeight="bold">B</T>
  <T x="194" y="185" textAnchor="middle" fontSize="24">{f.a}</T>
  <T x="300" y="185" textAnchor="middle" fontSize="24">{f.ab}</T>
  <T x="406" y="185" textAnchor="middle" fontSize="24">{f.b}</T>
  <T x="82" y="293" fontSize="13">Neither: {f.out}</T>
 </g>;
}
function PlaceValue({f}){
 const n=f.digits.length,w=500/n;
 return <g><T x="300" y="83" textAnchor="middle" fontWeight="bold" fontSize="20">PLACE VALUE</T>
  {f.digits.map((d,i)=>{
   const x=50+i*w,selected=i===f.index;
   return <g key={i}>
    <rect x={x} y="114" width={w-4} height="124" rx="5" fill={selected?'var(--nt-accent-soft)':'none'} stroke={selected?color:muted} strokeWidth={selected?3:1}/>
    <T x={x+(w-4)/2} y="155" textAnchor="middle" fontSize="13" fill={muted}>10^{n-i-1}</T>
    <T x={x+(w-4)/2} y="208" textAnchor="middle" fontWeight="bold" fontSize="27">{d}</T>
   </g>
  })}
  <T x="300" y="277" textAnchor="middle">Read columns left to right</T>
 </g>;
}
function Tape({f}){
 const tot=f.a+f.b,w=480/tot,x=60;
 return <g>
  <T x="300" y="87" textAnchor="middle" fontWeight="bold">Total: {f.total} units</T>
  <T x={x+f.a*w/2} y="127" textAnchor="middle">A</T><T x={x+f.a*w+f.b*w/2} y="127" textAnchor="middle">B</T>
  {Array.from({length:tot},(_,i)=><rect key={i} x={x+i*w} y="143" width={w} height="82" fill={i<f.a?'var(--nt-accent-soft)':'none'} stroke={color} strokeWidth="1.8"/>)}
  <T x="300" y="264" textAnchor="middle">A : B = {f.a} : {f.b}</T>
 </g>;
}
function Parallel({f}){
 const degrees=f.angle*Math.PI/180,dx=90/Math.tan(degrees),x1=300-dx,x2=300+dx;
 return <g>
  <line x1="70" y1="92" x2="530" y2="92" {...STROKE}/>
  <line x1="70" y1="272" x2="530" y2="272" {...STROKE}/>
  <line x1={x1} y1="92" x2={x2} y2="272" {...STROKE}/>
  <T x="80" y="75" fontStyle="italic">l</T><T x="80" y="258" fontStyle="italic">m</T>
  <T x={x1+43} y="123" fontWeight="bold">{f.angle}°</T>
  <T x={x2+18} y="255" fontSize="13">?</T>
  <path d={'M '+(x1+40)+' 92 A 40 40 0 0 1 '+(x1+40*Math.cos(degrees))+' '+(92+40*Math.sin(degrees))} fill="none" stroke={color} strokeWidth="1.5"/>
  <text x="320" y="332" textAnchor="middle" fill={muted} fontSize="13">l ∥ m</text>
 </g>;
}
function Matrix({f}){
 const [a,b,c,d]=f.entries;
 const x=[240,355],y=[144,242];
 return <g>
  <path d="M187 95 H172 V280 H187 M414 95 H429 V280 H414" {...STROKE}/>
  {[[a,x[0],y[0]],[b,x[1],y[0]],[c,x[0],y[1]],[d,x[1],y[1]]].map(([n,xx,yy],i)=><T key={i} x={xx} y={yy} textAnchor="middle" fontSize="30">{n}</T>)}
 </g>;
}
function UnitCircle({f}){
 const cx=300,cy=184,r=128,t=f.deg*Math.PI/180,x=cx+r*Math.cos(t),y=cy-r*Math.sin(t);
 return <g>
  <circle cx={cx} cy={cy} r={r} {...STROKE}/>
  <line x1="115" y1={cy} x2="485" y2={cy} stroke={muted}/>
  <line x1={cx} y1="18" x2={cx} y2="350" stroke={muted}/>
  <line x1={cx} y1={cy} x2={x} y2={y} {...STROKE}/>
  <line x1={x} y1={y} x2={x} y2={cy} stroke={muted} strokeDasharray="5 5"/>
  <circle cx={x} cy={y} r="6" fill={color}/>
  <T x={Math.min(522,Math.max(68,x+13))} y={Math.max(22,y-10)} fontWeight="bold">P</T>
  <T x={Math.min(520,cx+35)} y={Math.max(45,cy-20)} fontSize="14">{f.deg}°</T>
  <T x={470} y={cy+20} fontSize="13">x</T><T x={cx+12} y="33" fontSize="13">y</T>
  <T x={cx-10} y={cy+19} textAnchor="end" fontSize="12">O</T>
 </g>;
}
function Sector({f}){
 const cx=300,cy=196,rad=131,t=f.angle*Math.PI/180,x=cx+rad*Math.cos(t),y=cy-rad*Math.sin(t);
 const large=f.angle>180?1:0;
 const path='M '+cx+' '+cy+' L '+(cx+rad)+' '+cy+' A '+rad+' '+rad+' 0 '+large+' 0 '+x+' '+y+' Z';
 return <g>
  <path d={path} {...shade}/>
  <circle cx={cx} cy={cy} r="4" fill={color}/>
  <T x={cx+65} y={cy+19}>r={f.r}</T><T x={x+9} y={y-9}>r={f.r}</T>
  <T x={cx+7} y={cy-21} fontWeight="bold">{f.angle}°</T>
  <T x="300" y="327" textAnchor="middle">Central angle and radii determine this sector</T>
 </g>;
}
function Cuboid({f}){
 const O=[150,258],U=[360,258],V=[423,208],W=[213,208],up=-132;
 const corners=[O,U,V,W,[O[0],O[1]+up],[U[0],U[1]+up],[V[0],V[1]+up],[W[0],W[1]+up]];
 const segment=(a,b,key,dashed)=>{const A=corners[a],B=corners[b];return <line key={key} x1={A[0]} y1={A[1]} x2={B[0]} y2={B[1]} stroke={color} strokeWidth="2.5" strokeDasharray={dashed?'5 5':undefined}/>};
 return <g>
  {[ [0,1],[1,2],[2,3],[0,4],[1,5],[2,6],[4,5],[5,6],[6,7],[7,4] ].map(([a,b],i)=>segment(a,b,i,false))}
  {segment(3,7,'hidden',true)}
  <T x="255" y="284" textAnchor="middle">l={f.l}</T>
  <T x="405" y="251">w={f.w}</T><T x="130" y="197">h={f.h}</T>
  <T x="300" y="333" fontSize="13" textAnchor="middle">Edge lengths are not drawn to a common 3-D scale</T>
 </g>;
}
function Tree({f}){
 const sx=70,first=245,last=445,y=[90,270],leaves=[52,127,218,293];
 const branches=[[sx,185,first,y[0]],[sx,185,first,y[1]],[first,y[0],last,leaves[0]],[first,y[0],last,leaves[1]],[first,y[1],last,leaves[2]],[first,y[1],last,leaves[3]]];
 return <g>
  {branches.map(([x1,y1,x2,y2],i)=><line key={i} x1={x1} y1={y1} x2={x2} y2={y2} {...STROKE}/>)}
  <T x="128" y="119" fontSize="13">A: {f.a}/{f.ad}</T>
  <T x="128" y="264" fontSize="13">B: {f.ad-f.a}/{f.ad}</T>
  <T x="306" y="75" fontSize="13">S: {f.sa}/{f.sad}</T>
  <T x="306" y="135" fontSize="13">¬S: {f.sad-f.sa}/{f.sad}</T>
  <T x="306" y="223" fontSize="13">S: {f.sb}/{f.sbd}</T>
  <T x="306" y="293" fontSize="13">¬S: {f.sbd-f.sb}/{f.sbd}</T>
  <T x="453" y="58">A,S</T><T x="453" y="133">A,¬S</T><T x="453" y="220">B,S</T><T x="453" y="299">B,¬S</T>
 </g>;
}
function Dots({f}){
 const r=f.rows,spacing=Math.min(30,215/r),top=56;
 const nodes=[];
 for(let i=1;i<=r;i++)for(let j=0;j<i;j++)nodes.push(<circle key={i+'-'+j} cx={300+(j-(i-1)/2)*spacing} cy={top+i*spacing} r="5" fill={color}/>);
 return <g>{nodes}<T x="300" y="330" textAnchor="middle">{r} rows in a triangular arrangement</T></g>;
}
function Interval({f}){
 const lx=84,rx=516,y=194,range=(f.b-f.a)+6,start=f.a-3,scale=(rx-lx)/range,px=n=>lx+(n-start)*scale;
 return <g>
  <line x1={lx} x2={rx} y1={y} y2={y} stroke={muted} strokeWidth="2"/>
  <line x1={px(f.a)} x2={px(f.b)} y1={y} y2={y} stroke={color} strokeWidth="6"/>
  {Array.from({length:f.b-f.a+7},(_,i)=>f.a-3+i).map(v=><g key={v}>
   <line x1={px(v)} x2={px(v)} y1={y-9} y2={y+9} stroke={muted}/>
   {v===f.a||v===f.b||v%2===0?<T x={px(v)} y={y+37} textAnchor="middle" fontSize="13">{v}</T>:null}
  </g>)}
  {[[f.a,f.lc],[f.b,f.rc]].map(([v,closed],i)=><circle key={i} cx={px(v)} cy={y} r="8" stroke={color} strokeWidth="2.5" fill={closed?color:'var(--nt-raised)'}/>)}
  <T x="300" y="110" textAnchor="middle">Filled endpoint = included; open = excluded</T>
 </g>;
}
export default function StudyDiagramExtra({figure}) {
 switch(figure.type){
 case 'venn':return <Venn f={figure}/>;
 case 'placevalue':return <PlaceValue f={figure}/>;
 case 'tape':return <Tape f={figure}/>;
 case 'parallel':return <Parallel f={figure}/>;
 case 'matrix':return <Matrix f={figure}/>;
 case 'unitcircle':return <UnitCircle f={figure}/>;
 case 'sector':return <Sector f={figure}/>;
 case 'cuboid':return <Cuboid f={figure}/>;
 case 'tree':return <Tree f={figure}/>;
 case 'dots':return <Dots f={figure}/>;
 case 'interval':return <Interval f={figure}/>;
 default:return null;
 }
}
