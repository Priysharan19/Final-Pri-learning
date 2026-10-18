import React from 'react';
// Source-controlled numeric vectors only: no embedded HTML or remote presentation assets.
const ink='var(--nt-ink)',accent='var(--nt-accent)',muted='var(--nt-ink-3)',soft='var(--nt-accent-soft)';
const stroke={fill:'none',stroke:accent,strokeWidth:2.7,strokeLinejoin:'round',strokeLinecap:'round'};
const T=({x,y,children,...rest})=><text x={x} y={y} fill={ink} fontFamily="var(--font,system-ui,sans-serif)" fontSize="13" {...rest}>{children}</text>;
const L=({x1,y1,x2,y2,...rest})=><line x1={x1} y1={y1} x2={x2} y2={y2} stroke={muted} strokeWidth="1.3" {...rest}/>;
function DotPlot({f}){
 const count=new Map;for(const v of f.values)count.set(v,(count.get(v)||0)+1);
 const keys=[...count.keys()].sort((a,b)=>a-b),left=66,right=540,bottom=287,lo=keys[0]-1,hi=keys[keys.length-1]+1;
 const sx=x=>left+(x-lo)/(hi-lo)*(right-left);
 return <g>
  <L x1={left} y1={bottom} x2={right} y2={bottom} stroke={ink} strokeWidth="1.8"/>
  {Array.from({length:hi-lo+1},(_,i)=>lo+i).map(v=><g key={v}><L x1={sx(v)} x2={sx(v)} y1={bottom-6} y2={bottom+6}/><T x={sx(v)} y={bottom+25} textAnchor="middle">{v}</T></g>)}
  {keys.flatMap(k=>Array.from({length:count.get(k)},(_,i)=><circle key={String(k)+'_'+i} cx={sx(k)} cy={bottom-19-24*i} r="8" fill={soft} stroke={accent} strokeWidth="2"/>))}
  <T x="300" y="42" textAnchor="middle" fontWeight="bold">One dot = one observation</T>
 </g>;
}
function Pie({f}){
 const counts=f.counts,total=counts.reduce((a,b)=>a+b),cx=295,cy=181,r=132;
 let a=-Math.PI/2;
 return <g>
  {counts.map((n,i)=>{
    const b=a+2*Math.PI*n/total,from=[cx+r*Math.cos(a),cy+r*Math.sin(a)],end=[cx+r*Math.cos(b),cy+r*Math.sin(b)],mid=(a+b)/2;
    const d='M '+cx+' '+cy+' L '+from.join(' ')+' A '+r+' '+r+' 0 '+(b-a>Math.PI?1:0)+' 1 '+end.join(' ')+' Z';
    a=b;
    return <g key={i}>
      <path d={d} fill={i%2? 'var(--nt-raised)':soft} stroke={accent} strokeWidth={i===f.index?3.2:1.6}/>
      <T x={cx+85*Math.cos(mid)} y={cy+85*Math.sin(mid)+5} textAnchor="middle" fontWeight={i===f.index?'bold':'normal'}>{String.fromCharCode(65+i)}</T>
      <T x={cx+156*Math.cos(mid)} y={cy+156*Math.sin(mid)+5} textAnchor="middle">{n}</T>
    </g>;
  })}
  <T x="295" y="349" textAnchor="middle">Total observations: {total}</T>
 </g>;
}
function StemLeaf({f}){
 const stems=Object.entries(f.values.reduce((o,v)=>{const s=Math.floor(v/10);(o[s]??=[]).push(v%10);return o;},{})).sort((a,b)=>Number(a[0])-Number(b[0]));
 return <g><T x="300" y="40" textAnchor="middle" fontWeight="bold">Stem-and-leaf diagram</T>
  <L x1="190" y1="55" x2="190" y2="303" stroke={accent} strokeWidth="2"/>
  {stems.map(([s,leaf],i)=><g key={s}>
   <T x="170" y={95+i*32} textAnchor="end" fontWeight="bold">{s}</T>
   <T x="213" y={95+i*32} fontFamily="ui-monospace,monospace" letterSpacing="4">{leaf.join('   ')}</T>
  </g>)}
  <T x="300" y="339" textAnchor="middle">Key: 2 | 4 represents 24</T>
 </g>;
}
function Motion({f}){
 const {times,velocities}=f,max=Math.max(1,...velocities),l=65,r=540,t=40,b=294;
 const sx=v=>l+(v-times[0])/(times[3]-times[0])*(r-l),sy=v=>b-v/max*(b-t-18);
 const poly=[String(sx(times[0]))+','+b,...times.map((ti,i)=>String(sx(ti))+','+String(sy(velocities[i]))),String(sx(times[3]))+','+b].join(' ');
 return <g>
  <L x1={l} y1={t} x2={l} y2={b} stroke={ink}/><L x1={l} y1={b} x2={r} y2={b} stroke={ink}/>
  <polygon points={poly} fill={soft} fillOpacity=".7"/>
  <polyline points={times.map((ti,i)=>String(sx(ti))+','+String(sy(velocities[i]))).join(' ')} {...stroke}/>
  {times.map((ti,i)=><g key={i}>
    <circle cx={sx(ti)} cy={sy(velocities[i])} r="5" fill={accent}/>
    <T x={sx(ti)} y={b+24} textAnchor="middle">{ti}</T>
    <T x={sx(ti)+8} y={sy(velocities[i])-8}>{velocities[i]}</T>
  </g>)}
  <T x="300" y="348" textAnchor="middle">Area under speed–time curve = distance</T>
 </g>;
}
function TwoBox({f}){
 const all=[...f.a,...f.b],mi=Math.min(...all),ma=Math.max(...all),pad=Math.max(1,(ma-mi)*.1),lo=mi-pad,hi=ma+pad,px=v=>65+(v-lo)/(hi-lo)*470;
 return <g>
  <T x="300" y="43" textAnchor="middle">Comparative box plots on one numerical axis</T>
  {[f.a,f.b].map((arr,i)=>{
    const [v,q1,med,q3,high]=arr,y=118+i*116;
    return <g key={i}>
      <T x="40" y={y+4} fontWeight="bold">{i?'B':'A'}</T>
      <L x1={px(v)} x2={px(high)} y1={y} y2={y} stroke={accent} strokeWidth="2.5"/>
      {[v,high].map((x,j)=><L key={j} x1={px(x)} x2={px(x)} y1={y-19} y2={y+19} stroke={accent}/>)}
      <rect x={px(q1)} y={y-31} width={px(q3)-px(q1)} height="62" fill={soft} stroke={accent} strokeWidth="2.2"/>
      <L x1={px(med)} x2={px(med)} y1={y-31} y2={y+31} stroke={accent} strokeWidth="3.1"/>
    </g>;
  })}
  {Array.from({length:6},(_,i)=>lo+(hi-lo)*i/5).map((v,i)=><T key={i} x={px(v)} y="340" textAnchor="middle">{Number(v.toFixed(1))}</T>)}
 </g>;
}
function Network({f}){
 const points={A:[85,175],B:[210,75],C:[210,270],D:[391,102],E:[510,202]};
 const edges=[['A','B'],['A','C'],['B','C'],['B','D'],['C','D'],['C','E'],['D','E']];
 return <g>
   {edges.map(([a,b],i)=>{
    const [x1,y1]=points[a],[x2,y2]=points[b],dx=x2-x1,dy=y2-y1,len=Math.hypot(dx,dy),sign=i%2?-1:1;
    const mx=(x1+x2)/2+sign*dy/len*17,my=(y1+y2)/2-sign*dx/len*17;
    return <g key={i}>
      <L x1={x1} y1={y1} x2={x2} y2={y2} stroke={accent} strokeWidth="2.4"/>
      <rect x={mx-13} y={my-14} width="26" height="24" rx="4" fill="var(--nt-raised)"/>
      <T x={mx} y={my+3} textAnchor="middle" fontWeight="bold">{f.weights[i]}</T>
    </g>;
   })}
   {Object.entries(points).map(([letter,[x,y]])=><g key={letter}>
     <circle cx={x} cy={y} r="18" fill={soft} stroke={accent} strokeWidth="2.5"/>
     <T x={x} y={y+5} textAnchor="middle" fontWeight="bold">{letter}</T>
   </g>)}
   <T x="300" y="345" textAnchor="middle">Compare positive-edge route weights from A to E</T>
 </g>;
}
function Ellipse({f}){
 const {a,b}=f,cx=300,cy=179,scale=Math.min(13,156/a),rx=a*scale,ry=b*scale,c=Math.sqrt(a*a-b*b)*scale;
 return <g>
  <L x1="65" y1={cy} x2="535" y2={cy}/><L x1={cx} y1="20" x2={cx} y2="336"/>
  <ellipse cx={cx} cy={cy} rx={rx} ry={ry} {...stroke} fill={soft}/>
  {[cx-c,cx+c].map((x,i)=><circle key={i} cx={x} cy={cy} r="5" fill={accent}/>)}
  <L x1={cx} y1={cy} x2={cx+rx} y2={cy} stroke={accent} strokeWidth="2.4"/>
  <L x1={cx} y1={cy} x2={cx} y2={cy-ry} stroke={accent} strokeWidth="2.4"/>
  <T x={cx+rx/2} y={cy+22} textAnchor="middle">a={a}</T><T x={cx+11} y={cy-ry/2}>b={b}</T>
  <T x={cx-c} y={cy+30} textAnchor="middle">F₁</T><T x={cx+c} y={cy+30} textAnchor="middle">F₂</T>
 </g>;
}
export default function StudyDiagramInvestigations({figure}) {
 switch(figure.type){
  case 'dot-plot':return <DotPlot f={figure}/>;
  case 'pie':return <Pie f={figure}/>;
  case 'stem-leaf':return <StemLeaf f={figure}/>;
  case 'motion':return <Motion f={figure}/>;
  case 'two-box':return <TwoBox f={figure}/>;
  case 'network':return <Network f={figure}/>;
  case 'ellipse':return <Ellipse f={figure}/>;
  default:return null;
 }
}
