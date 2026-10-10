// Pri Learning — native vector mathematics diagrams for authored study examples.
// Mathematical coordinates, unit lengths and angles are never stretched independently.
// All SVG nodes are from a fixed internal whitelist. No HTML injection or external assets.
import React, { useId } from 'react';
import './StudyDiagram.css';
import StudyDiagramExtra from './StudyDiagramExtra.jsx';

const W = 600;
const H = 360;
const FRAME = {left:62,right:548,top:34,bottom:314};
const finite = n => typeof n === 'number' && Number.isFinite(n);
const near = n => Math.abs(n) < 1e-8 ? '0' : String(Number(n.toFixed(3)));
function extent(fig) {
  const coords = [];
  for (const p of fig.points || []) if (finite(p.x) && finite(p.y)) coords.push([p.x,p.y]);
  for (const c of fig.circles || []) if ([c.cx,c.cy,c.r].every(finite) && c.r>0) {
    coords.push([c.cx-c.r,c.cy-c.r],[c.cx+c.r,c.cy+c.r]);
  }
  for (const curve of fig.curves || []) if (curve.type==='quadratic' && [curve.a,curve.b,curve.c,curve.xmin,curve.xmax].every(finite)) {
    for (let i=0;i<=60;i++) {
      const x=curve.xmin+(curve.xmax-curve.xmin)*i/60;
      coords.push([x,curve.a*x*x+curve.b*x+curve.c]);
    }
  }
  if (fig.type==='plane') coords.push([0,0]);
  if (!coords.length) coords.push([0,0],[1,1]);
  const minX=Math.min(...coords.map(c=>c[0])),maxX=Math.max(...coords.map(c=>c[0]));
  const minY=Math.min(...coords.map(c=>c[1])),maxY=Math.max(...coords.map(c=>c[1]));
  const span=Math.max(maxX-minX,maxY-minY,2),margin=Math.max(1,span*0.12);
  return { minX:minX-margin,maxX:maxX+margin,minY:minY-margin,maxY:maxY+margin };
}
function Frame({fig,arrowId}) {
  const box=extent(fig);
  const plotW=FRAME.right-FRAME.left,plotH=FRAME.bottom-FRAME.top;
  const scale=Math.min(plotW/(box.maxX-box.minX),plotH/(box.maxY-box.minY));
  const midX=(box.minX+box.maxX)/2,midY=(box.minY+box.maxY)/2;
  const sx=x=>W/2+(x-midX)*scale, sy=y=>H/2-(y-midY)*scale;
  const byId=Object.fromEntries((fig.points||[]).map(p=>[p.id,p]));
  const toPath=vertices=>vertices.map((id,i)=>{
    const p=byId[id];return p?(i===0?'M':'L')+sx(p.x)+' '+sy(p.y):'';
  }).join(' ')+' Z';
  const rangeStep=Math.max(1,Math.ceil(Math.max(box.maxX-box.minX,box.maxY-box.minY)/16));
  const ticks=(lo,hi)=>Array.from({length:Math.min(36,Math.ceil((hi-lo)/rangeStep)+2)},(_,i)=>(Math.ceil(lo/rangeStep)+i)*rangeStep).filter(v=>v<=hi);
  const xTicks=ticks(box.minX,box.maxX),yTicks=ticks(box.minY,box.maxY);
  const grid=fig.type==='plane';
  return <g>
    {grid && <g className="nt-diagram-grid">
      {xTicks.map(v=><line key={'gx'+v} x1={sx(v)} x2={sx(v)} y1={FRAME.top} y2={FRAME.bottom}/>)}
      {yTicks.map(v=><line key={'gy'+v} x1={FRAME.left} x2={FRAME.right} y1={sy(v)} y2={sy(v)}/>)}
    </g>}
    {grid && <g className="nt-diagram-axes">
      {box.minY<=0&&box.maxY>=0 && <line x1={FRAME.left} x2={FRAME.right} y1={sy(0)} y2={sy(0)} />}
      {box.minX<=0&&box.maxX>=0 && <line x1={sx(0)} x2={sx(0)} y1={FRAME.top} y2={FRAME.bottom}/>}
      {xTicks.map(v=><text key={'tx'+v} x={sx(v)} y={Math.min(H-12,Math.max(18,sy(0)+18))} textAnchor="middle">{near(v)}</text>)}
      {yTicks.filter(v=>v!==0).map(v=><text key={'ty'+v} x={Math.min(W-22,Math.max(21,sx(0)-13))} y={sy(v)+4} textAnchor="end">{near(v)}</text>)}
    </g>}
    {(fig.polygons||[]).map((poly,i)=><path key={'poly'+i} d={toPath(poly.vertices||[])} className="nt-diagram-region"/>)}
    {(fig.circles||[]).map((circle,i)=><circle key={'circle'+i} className="nt-diagram-primary" cx={sx(circle.cx)} cy={sy(circle.cy)} r={circle.r*scale}/>)}
    {(fig.curves||[]).map((curve,i)=>{
      if(curve.type!=='quadratic')return null;
      const d=Array.from({length:121},(_,j)=>{
        const x=curve.xmin+(curve.xmax-curve.xmin)*j/120;
        return (j===0?'M':'L')+sx(x)+' '+sy(curve.a*x*x+curve.b*x+curve.c);
      }).join(' ');
      return <path key={'curve'+i} d={d} className="nt-diagram-primary"/>;
    })}
    {(fig.segments||[]).map(([a,b],i)=>{
      const A=byId[a],B=byId[b];if(!A||!B)return null;
      const arrow=(fig.arrows||[]).some(([c,d])=>c===a&&d===b);
      return <line key={'seg'+i} className="nt-diagram-primary" x1={sx(A.x)} y1={sy(A.y)} x2={sx(B.x)} y2={sy(B.y)} markerEnd={arrow?'url(#'+arrowId+')':undefined}/>;
    })}
    {(fig.sideLabels||[]).map((label,i)=>{
      const A=byId[label.a],B=byId[label.b];if(!A||!B)return null;
      const dx=B.x-A.x,dy=B.y-A.y,len=Math.hypot(dx,dy)||1;
      const x=sx((A.x+B.x)/2)-dy/len*14,y=sy((A.y+B.y)/2)-dx/len*14;
      return <text key={'side'+i} className="nt-diagram-side" x={x} y={y} textAnchor="middle">{label.text}</text>;
    })}
    {(fig.rightAngles||[]).map((id,i)=>{
      const p=byId[id];if(!p)return null;
      const neighbours=(fig.segments||[]).filter(([a,b])=>a===id||b===id).map(([a,b])=>byId[a===id?b:a]).filter(Boolean);
      if(neighbours.length<2)return null;
      const vecs=neighbours.slice(0,2).map(n=>{
        const dx=n.x-p.x,dy=n.y-p.y,l=Math.hypot(dx,dy)||1;
        return [dx/l,dy/l];
      });
      const [u,v]=vecs,s=0.32;
      return <path key={'right'+i} className="nt-diagram-angle" d={'M'+sx(p.x+u[0]*s)+' '+sy(p.y+u[1]*s)+' L'+sx(p.x+(u[0]+v[0])*s)+' '+sy(p.y+(u[1]+v[1])*s)+' L'+sx(p.x+v[0]*s)+' '+sy(p.y+v[1]*s)}/>;
    })}
    {(fig.points||[]).map(p=><g key={'p'+p.id}>
      <circle className="nt-diagram-dot" cx={sx(p.x)} cy={sy(p.y)} r="4.6"/>
      {fig.pointLabels!==false && <text className="nt-diagram-point-label" x={sx(p.x)+8} y={sy(p.y)-9}>{p.label||p.id}{grid?'('+near(p.x)+','+near(p.y)+')':''}</text>}
    </g>)}
  </g>;
}
function Bars({fig}) {
  const values=fig.values||[],labels=fig.labels||[];
  const max=Math.max(1,...values);
  const n=values.length, left=62,right=552,top=30,bottom=290;
  const width=(right-left)/Math.max(1,n),barW=Math.min(74,width*0.62);
  const scale=(bottom-top-18)/max;
  const step=Math.max(1,Math.ceil(max/5));
  const ticks=Array.from({length:Math.floor(max/step)+1},(_,i)=>i*step);
  return <g>
    <g className="nt-diagram-grid">{ticks.map(t=><line key={t} x1={left} x2={right} y1={bottom-t*scale} y2={bottom-t*scale}/>)}</g>
    <line className="nt-diagram-primary" x1={left} y1={bottom} x2={right} y2={bottom}/>
    {ticks.map(t=><text className="nt-diagram-ticks" key={'tick'+t} x={left-10} y={bottom-t*scale+4} textAnchor="end">{t}</text>)}
    {values.map((v,i)=>{
      const x=left+i*width+(width-barW)/2;
      return <g key={labels[i]}>
        <rect className="nt-diagram-bar" x={x} y={bottom-v*scale} width={barW} height={v*scale} rx="3"/>
        <text className="nt-diagram-bar-value" x={x+barW/2} y={bottom-v*scale-9} textAnchor="middle">{v}</text>
        <text className="nt-diagram-bar-label" x={x+barW/2} y={bottom+25} textAnchor="middle">{labels[i]}</text>
      </g>;
    })}
  </g>;
}
function NumberLine({fig}) {
  const start=fig.min,end=fig.max,left=58,right=548,y=H/2;
  const scale=(right-left)/(end-start),px=v=>left+(v-start)*scale;
  const step=Math.max(1,Math.ceil((end-start)/14));
  const ticks=Array.from({length:Math.ceil((end-start)/step)+2},(_,i)=>Math.ceil(start/step)*step+i*step).filter(v=>v<=end);
  return <g>
    <line className="nt-diagram-primary" x1={left} y1={y} x2={right} y2={y}/>
    {ticks.map(v=><g key={'nt'+v}>
      <line className="nt-diagram-tick" x1={px(v)} x2={px(v)} y1={y-7} y2={y+7}/>
      <text className="nt-diagram-ticks" x={px(v)} y={y+27} textAnchor="middle">{near(v)}</text>
    </g>)}
    {fig.marks.map((m,i)=><g key={m.id}>
      <circle className="nt-diagram-dot" cx={px(m.value)} cy={y} r="6.2"/>
      <text className="nt-diagram-point-label" x={px(m.value)} y={y-18} textAnchor="middle">{m.id+' = '+near(m.value)}</text>
    </g>)}
  </g>;
}
export default function StudyDiagram({ figure }) {
  const instance=useId().replace(/:/g,'-');
  const supported=['plane','geometry','bars','numberline','venn','placevalue','tape','parallel','matrix','unitcircle','sector','cuboid','tree','dots','interval','pascal','square-grid','cube-grid','algebra-area','prime-bars','slope-field'];
  if (!figure || !supported.includes(figure.type) || !figure.description) return null;
  const arrowId='nt-diagram-arrow-'+instance;
  return <figure className="nt-diagram" data-testid="notes-math-diagram">
    <svg viewBox="0 0 600 360" role="img" aria-label={figure.description} preserveAspectRatio="xMidYMid meet">
      <title>{figure.description}</title>
      <defs><marker id={arrowId} markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto" markerUnits="strokeWidth"><path d="M0 0 L8 4 L0 8 z" className="nt-diagram-arrow"/></marker></defs>
      {figure.type==='bars'?<Bars fig={figure}/>:figure.type==='numberline'?<NumberLine fig={figure}/>:['plane','geometry'].includes(figure.type)?<Frame fig={figure} arrowId={arrowId}/>:<StudyDiagramExtra figure={figure}/>}
    </svg>
    <figcaption className="nt-sr">{figure.description}</figcaption>
  </figure>;
}
