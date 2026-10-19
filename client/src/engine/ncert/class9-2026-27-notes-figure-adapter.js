/**
 * Mission 004: AUTHORING-SIDE ADAPTER TO EXISTING Notes/StudyDiagram.jsx.
 * Does NOT implement a second SVG framework or import Notes into the curriculum.
 * StudyDiagram accepts types 'plane' or 'geometry', numeric points/segments/
 * circles/polygons and mandatory description; 19 original data specifications.
 * Source is deliberately UNWIRED pending authenticated student UX review.
 */
import {CLASS9_GAP_STUDIES,loadClass9GapStudy} from './class9-2026-27-study-registry.js';
const point=(id,xy)=>({id,label:id,x:xy[0],y:xy[1]});
const polygonEdges=ids=>ids.map((id,i)=>[id,ids[(i+1)%ids.length]]);
function polygonFigure(src){
 const xy=src.points,ids=['A','B','C','D'].slice(0,xy.length);
 const points=xy.map((a,i)=>point(ids[i],a));
 const segments=polygonEdges(ids);
 if(src.kind==='polygon-diagonals')segments.push(['A','C'],['B','D']);
 if(src.kind==='triangle-midsegment'){
  points.length=0;for(let i=0;i<3;i++)points.push(point(['A','B','C'][i],xy[i]));
  points.push(point('D',src.midpoints[0]),point('E',src.midpoints[1]));
  segments.length=0;segments.push(...polygonEdges(['A','B','C']),['D','E']);
 }else if(src.kind==='triangle-centroid'){
  points.length=0;for(let i=0;i<3;i++)points.push(point(['A','B','C'][i],xy[i]));
  const m=src.median[1];points.push(point('M',m),point('G',src.centroid));
  segments.length=0;segments.push(...polygonEdges(['A','B','C']),['A','M']);
 }else if(src.kind==='quad-midpoints'){
  for(let i=0;i<4;i++)points.push(point('PQRS'[i],src.mid[i]));
  segments.push(...polygonEdges(['P','Q','R','S']));
 }
 return {type:'geometry',description:src.alt,points,segments,showAxisLabels:false};
}
function rectangles(src){
 const [a,b]=src.rectangles;
 const margin=Math.max(a[0],a[1])/2+2;
 const coords=[[0,0],[a[0],0],[a[0],a[1]],[0,a[1]],
               [margin+a[0],0],[margin+a[0]+b[0],0],[margin+a[0]+b[0],b[1]],[margin+a[0],b[1]]];
 const points=coords.map((xy,i)=>point(['A','B','C','D','E','F','G','H'][i],xy));
 return {type:'geometry',description:src.alt,points,polygons:[{vertices:['A','B','C','D']},{vertices:['E','F','G','H']}],pointLabels:false};
}
function parallel(src){
 const y0=src.parallelY[0],y1=src.parallelY[1],ang=src.transversalDeg*Math.PI/180;
 const dx=(y1-y0)/Math.tan(ang),x0=1,x1=x0+dx;
 const points=[point('L',[-4,y0]),point('R',[6,y0]),point('U',[-4,y1]),point('V',[6,y1]),
               point('T0',[x0-1,y0-Math.tan(ang)]),point('T1',[x1+1,y1+Math.tan(ang)])];
 return {type:'geometry',description:src.alt,points,segments:[['L','R'],['U','V'],['T0','T1']],pointLabels:false};
}
function rayCircle(src){
 const [ax,ay]=src.A,angle=src.angleDegrees*Math.PI/180,reach=src.B[0]*2.5;
 const points=[point('A',src.A),point('B',src.B),point('R',[ax+reach*Math.cos(angle),ay+reach*Math.sin(angle)])];
 return {type:'geometry',description:src.alt,points,
  segments:[['A','B'],['A','R']],circles:[{cx:src.B[0],cy:src.B[1],r:src.radius}],pointLabels:false};
}
export function adaptClass9StudyFigure(item) {
 const src=item.figure;if(!src)return {status:'no-original-figure',questionId:item.id};
 const kind=src.kind||src.type;
 let figure;
 if(kind==='coordinate-intercepts')figure={
  type:'plane',description:src.alt,points:Object.entries(src.points).map(([id,xy])=>point(id,xy)),
  segments:src.segments,pointLabels:false
 };
 else if(kind==='ray-circle')figure=rayCircle(src);
 else if(kind==='two-rectangles')figure=rectangles(src);
 else if(kind==='parallel-transversal')figure=parallel(src);
 else if(['polygon','polygon-diagonals','triangle-midsegment','triangle-centroid','quad-midpoints'].includes(kind))
  figure=polygonFigure(src);
 else return {status:'requires-existing-Notes-renderer-extension',questionId:item.id,sourceKind:kind,
  reason:kind==='stacked-bar'?'True stacked and 100%-stacked categories cannot be represented by the existing simple bar series.':
         kind==='hemi-on-cylinder'?'The Notes cuboid renderer cannot represent a hemisphere-on-cylinder exposed seam.':'No approved native Notes figure type.'};
 return {status:'existing-Notes-contract-compatible-not-visually-certified',questionId:item.id,sourceKind:kind,
  displayGate:'after-attempt-or-in-worked-solution',figure,
  owner:'student-experience / Notes',
  targetComponent:'client/src/notes/StudyDiagram.jsx',
  visualAcceptance:'pending real desktop and mobile screenshot checks'};
}
export async function getAllClass9FigureHandoffs(){
 const out=[];
 for(const ch of CLASS9_GAP_STUDIES){const p=await loadClass9GapStudy(ch.id);
  for(const item of p.questions){if(item.figure)out.push({...adaptClass9StudyFigure(item),chapterId:ch.id});}
 }
 return out;
}
