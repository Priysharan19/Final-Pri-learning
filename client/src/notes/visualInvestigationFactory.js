// Wave 8 original visual investigations: formulas derived from plotted figure values.
// Study only, not student-answer grading, copyrighted examination content or P0 server authority.
// Questions, steps and answers are TeX ($…$, via texFormat.js); `verify` stays in engine syntax;
// figure descriptions are plain text for screen readers.
import { m, num, paren, plus, minus, times, poly, shiftParen, pair, piTimes, plainPoly, plainShift } from './texFormat.js';

export function makeInvestigation(kind,p) {
 const V=(a,b)=>({kind:'value',expr:String(a),answer:String(b)});
 const P=a=>({kind:'values',pairs:a.map(([x,y])=>[String(x),String(y)])});
 const pt=(id,xy)=>({id,x:xy[0],y:xy[1],label:id});
 const gcd=(a,b)=>b?gcd(b,a%b):Math.abs(a);
 const done=(q,steps,answer,verify,figure)=>{
  if(!q||steps.length<3||!figure?.description||!verify||answer==null)throw Error('Incomplete investigation');
  return {question:(p.context?p.context+': ':'')+q,steps,answer:String(answer),verify,figure};
 };
 const xy=v=>pair(v[0],v[1]), plainXY=v=>`(${v[0]}, ${v[1]})`;
 if(kind==='dotPlot'){
  const {values,mode='median'}=p;
  if(!Array.isArray(values)||values.length<5||values.length>19||values.some(n=>!Number.isInteger(n)||n<0||n>12))throw Error('invalid dot values');
  const s=[...values].sort((a,b)=>a-b),mid=Math.floor(s.length/2);
  const med=s.length%2?s[mid]:(s[mid-1]+s[mid])/2;
  const freq=Object.fromEntries([...new Set(s)].map(k=>[k,s.filter(v=>v===k).length]));
  const ordered=Object.entries(freq).sort((a,b)=>b[1]-a[1]);
  if(mode==='mode'&&ordered[1]&&ordered[0][1]===ordered[1][1])throw Error('modal tie ambiguity');
  const ans=mode==='median'?med:mode==='mode'?Number(ordered[0][0]):s[s.length-1]-s[0];
  const fig={type:'dot-plot',description:`Dot plot of ${s.length} observations: ${s.join(', ')}. Each dot is one observation at its whole-number value.`,values:s};
  const last=mode==='median'?(s.length%2?`The middle (${ordinal(mid+1)}) value is ${m(num(ans))}.`:`The median is ${m(`\\tfrac{${s[mid-1]}+${s[mid]}}{2}=${num(ans)}`)}.`):mode==='mode'?`The tallest stack is at ${m(ans)}, so the mode is ${m(ans)}.`:`The range is ${m(`${s[s.length-1]}-${s[0]}=${ans}`)}.`;
  return done(`Use the dot plot to find the ${mode==='median'?'median':mode==='mode'?'mode':'range'}.`,[`The observations in order are ${m(s.join(', '))}.`,mode==='median'?'The median is the middle value, or the mean of the two middle values.':mode==='mode'?'The mode is the value with the tallest stack of dots.':'The range is the maximum minus the minimum.',last],m(num(ans)),V(mode==='median'?(s.length%2?String(s[mid]):`(${s[mid-1]}+${s[mid]})/2`):mode==='mode'?String(ans):`${s[s.length-1]}-${s[0]}`,ans),fig);
 }
 if(kind==='pieAngle'){
  const {counts,index,mode='angle'}=p;
  if(!Array.isArray(counts)||counts.length<3||counts.length>6||counts.some(x=>!Number.isInteger(x)||x<=0)||index<0||index>=counts.length)throw Error('pie data');
  const total=counts.reduce((a,b)=>a+b),part=counts[index],angle=360*part/total;
  if(!Number.isInteger(angle))throw Error('exact pie sector angle required');
  const L=String.fromCharCode(65+index);
  const fig={type:'pie',description:`Circle divided into ${counts.length} sectors in proportion to the counts ${counts.join(', ')}, starting from category A. The selected sector ${L} has ${part} of the ${total} cases.`,counts,index};
  const ans=mode==='angle'?angle:part;
  return done(`Using the sector diagram, calculate ${mode==='angle'?`the angle at the centre of sector ${m(L)}`:`the number of cases in category ${m(L)}`}.`,[`The sector counts are ${m(counts.join(', '))}, with total ${m(total)}.`,`The selected sector is ${m(`\\tfrac{${part}}{${total}}`)} of the full circle.`,mode==='angle'?`So its angle is ${m(`\\tfrac{${part}}{${total}}\\times 360^\\circ=${angle}^\\circ`)}.`:`So the number of cases is ${m(part)}.`],mode==='angle'?m(`${ans}^\\circ`):m(ans),V(mode==='angle'?`360*${part}/${total}`:`${part}`,ans),fig);
 }
 if(kind==='stemLeaf'){
  const {values,mode='median'}=p;
  if(!Array.isArray(values)||values.length<5||values.length>17||values.some(x=>!Number.isInteger(x)||x<10||x>99))throw Error('stem data');
  const s=[...values].sort((a,b)=>a-b),i=Math.floor(s.length/2),median=s.length%2?s[i]:(s[i-1]+s[i])/2,range=s[s.length-1]-s[0];
  const ans=mode==='median'?median:range;
  const fig={type:'stem-leaf',description:`Ordered stem-and-leaf plot of the two-digit observations ${s.join(', ')}; the tens digit is the stem and the units digit is the leaf. Key: 2 | 4 means 24.`,values:s};
  const last=mode==='median'?(s.length%2?`The middle value is ${m(num(ans))}.`:`The median is ${m(`\\tfrac{${s[i-1]}+${s[i]}}{2}=${num(ans)}`)}.`):`The range is ${m(`${s[s.length-1]}-${s[0]}=${ans}`)}.`;
  return done(`Read the ordered stem-and-leaf plot and calculate the ${mode==='median'?'median':'range'}.`,[`The key uses tens as stems and units as leaves to show ${m(s.length)} numbers.`,`In increasing order the observations are ${m(s.join(', '))}.`,last],m(num(ans)),V(mode==='median'?(s.length%2?String(s[i]):`(${s[i-1]}+${s[i]})/2`):`${s[s.length-1]}-${s[0]}`,ans),fig);
 }
 if(kind==='reflect'){
  const {A,B,C,axis='y',mode='coordinate'}=p;
  if(![...A,...B,...C].every(Number.isInteger)||!['x','y'].includes(axis))throw Error('reflection coords');
  const det=(B[0]-A[0])*(C[1]-A[1])-(B[1]-A[1])*(C[0]-A[0]);if(det===0)throw Error('degenerate triangle');
  const reflected=[A,B,C].map(([x,y])=>axis==='y'?[-x,y]:[x,-y]);
  const points=[...([A,B,C].map((xy,i)=>pt('ABC'[i],xy))),...reflected.map((xy,i)=>pt('PQR'[i],xy))];
  const figure={type:'plane',description:`Triangles ABC and PQR are mirror images in the ${axis}-axis. The original vertices A${plainXY(A)}, B${plainXY(B)} and C${plainXY(C)} are given; the image vertices P, Q and R are marked without coordinates.`,points,polygons:[{vertices:['A','B','C'],shade:false},{vertices:['P','Q','R'],shade:true}]};
  const area=Math.abs(det)/2;
  if(mode==='area')return done('A triangle is reflected in the labelled axis. Find the area of its shaded image.',[`The original vertices are ${m('A'+xy(A))}, ${m('B'+xy(B))} and ${m('C'+xy(C))}.`,'A reflection keeps all lengths and areas unchanged.',`The original triangle has area ${m(`\\tfrac{|${det}|}{2}=${num(area)}`)}, and so does its image.`],`${m(num(area))} square units`,V(`abs((${B[0]-A[0]})*(${C[1]-A[1]})-(${B[1]-A[1]})*(${C[0]-A[0]}))/2`,area),figure);
  const ans=reflected[0];
  return done(`After reflection in the ${m(axis)}-axis, what are the coordinates of point ${m('P')}, the image of ${m('A')}?`,[`Point ${m('A')} starts at ${m(xy(A))}.`,axis==='y'?`Reflection in the ${m('y')}-axis changes the sign of the ${m('x')}-coordinate.`:`Reflection in the ${m('x')}-axis changes the sign of the ${m('y')}-coordinate.`,`Its image is ${m('P'+xy(ans))}.`],m(xy(ans)),P([[axis==='y'?`-(${A[0]})`:`${A[0]}`,ans[0]],[axis==='x'?`-(${A[1]})`:`${A[1]}`,ans[1]]]),figure);
 }
 if(kind==='midpoint'){
  const {A,B,mode='x'}=p;
  if(![...A,...B].every(Number.isInteger)||A.join()===B.join())throw Error('same point');
  const mp=[(A[0]+B[0])/2,(A[1]+B[1])/2],dist=(B[0]-A[0])**2+(B[1]-A[1])**2;
  const fig={type:'plane',description:`The segment AB from A${plainXY(A)} to B${plainXY(B)} with its midpoint M marked on the grid; the coordinates of M are not labelled.`,points:[pt('A',A),pt('B',B),pt('M',mp)],segments:[['A','M'],['M','B']]};
  const ans=mode==='x'?mp[0]:mode==='y'?mp[1]:dist;
  const last=mode==='x'?m(`\\tfrac{${plus(A[0],B[0])}}{2}=${num(ans)}`):mode==='y'?m(`\\tfrac{${plus(A[1],B[1])}}{2}=${num(ans)}`):m(`(${minus(B[0],A[0])})^2+(${minus(B[1],A[1])})^2=${ans}`);
  return done(`From the labelled segment find ${mode==='x'?`the ${m('x')}-coordinate of its midpoint`:mode==='y'?`the ${m('y')}-coordinate of its midpoint`:'the square of its length'}.`,[`The endpoints are ${m('A'+xy(A))} and ${m('B'+xy(B))}.`,mode==='distance2'?`The squared length is ${m('(\\Delta x)^2+(\\Delta y)^2')}.`:'The midpoint is found by averaging the coordinates of the two endpoints.',`The requested value is ${last}.`],m(num(ans)),V(mode==='x'?`((${A[0]})+(${B[0]}))/2`:mode==='y'?`((${A[1]})+(${B[1]}))/2`:`((${B[0]})-(${A[0]}))^2+((${B[1]})-(${A[1]}))^2`,ans),fig);
 }
 if(kind==='motion'){
  const {times:ts,velocities,mode='distance'}=p;
  if(!Array.isArray(ts)||ts.length!==4||!Array.isArray(velocities)||velocities.length!==4||ts.some(n=>!Number.isInteger(n))||velocities.some(n=>!Number.isInteger(n)||n<0)||ts.some((n,i)=>i>0&&n<=ts[i-1]))throw Error('piecewise velocity');
  const trapezoids=[0,1,2].map(i=>(ts[i+1]-ts[i])*(velocities[i]+velocities[i+1])/2);
  const distance=trapezoids.reduce((a,b)=>a+b,0),peak=Math.max(...velocities);
  const fig={type:'motion',description:`Speed-time graph made of straight segments joining (${ts.map((t,i)=>`${t}, ${velocities[i]}`).join('), (')}); every speed is zero or positive.`,times:ts,velocities};
  const ans=mode==='distance'?distance:peak;
  const work=[0,1,2].map(i=>`\\tfrac{1}{2}(${velocities[i]}+${velocities[i+1]})\\times ${ts[i+1]-ts[i]}`).join('+');
  return done(`Read the speed-time graph. Find ${mode==='distance'?'the exact distance travelled over the interval shown':'the greatest recorded speed'}.`,[`The plotted times are ${m(ts.join(', '))} and the matching speeds are ${m(velocities.join(', '))}.`,mode==='distance'?'Each straight segment encloses a trapezium; the distance travelled is the total area under the graph.':'The highest plotted point gives the greatest speed.',mode==='distance'?`Distance ${m(`=${work}=${num(ans)}`)} distance units.`:`The answer is ${m(num(ans))} speed units.`],`${m(num(ans))} ${mode==='distance'?'distance units':'speed units'}`,V(mode==='distance'?trapezoids.map((_,i)=>`(${ts[i+1]}-${ts[i]})*(${velocities[i]}+${velocities[i+1]})/2`).join('+'):String(peak),ans),fig);
 }
 if(kind==='tangent'){
  const {a,h,k,x0}=p;
  if(![a,h,k,x0].every(Number.isInteger)||a===0||x0===h||Math.abs(a)>4)throw Error('tangent bounds');
  const yy=x=>a*(x-h)**2+k,slope=2*a*(x0-h);
  const P0=[x0,yy(x0)],P1=[x0+1,yy(x0)+slope];
  const curve=poly([[a,shiftParen('x',h)+'^2'],[k,'']]);
  const plainCurve=plainPoly([[a,(h?`(${plainShift('x',h)})`:'x')+'^2'],[k,'']]);
  const fig={type:'plane',description:`Parabola y = ${plainCurve} with vertex V(${h}, ${k}); the tangent touches the curve at P${plainXY(P0)} and passes through T${plainXY(P1)}.`,points:[pt('V',[h,k]),pt('P',P0),pt('T',P1)],segments:[['P','T']],curves:[{type:'quadratic',a,b:-2*a*h,c:a*h*h+k,xmin:Math.min(h,x0)-2,xmax:Math.max(h,x0)+2}]};
  const d=poly([[2*a,shiftParen('x',h)]]);
  return done(`Use the tangent drawn at ${m('P')} to find the gradient of the parabola at that point.`,[`The parabola is ${m(`y=${curve}`)}.`,`Differentiating gives ${m(`\\tfrac{dy}{dx}=${d}`)}; evaluate it at ${m(`x=${x0}`)}.`,`The gradient of the tangent is ${m(`${2*a===1?'':2*a===-1?'-':`${2*a}\\times `}${paren(x0-h)}=${slope}`)}.`],m(slope),V(`2*(${a})*((${x0})-(${h}))`,slope),fig);
 }
 if(kind==='twoBox'){
  const {a,b,mode='iqrDiff'}=p;
  const ordered=arr=>arr.length===5&&arr.every(Number.isInteger)&&arr.every((n,i)=>i===0||n>arr[i-1]);
  if(!ordered(a)||!ordered(b))throw Error('five number summaries must increase');
  const iqrA=a[3]-a[1],iqrB=b[3]-b[1],ans=mode==='iqrDiff'?iqrA-iqrB:mode==='medianGap'?a[2]-b[2]:(a[4]-a[0])-(b[4]-b[0]);
  const fig={type:'two-box',description:`Two box-and-whisker plots on one shared number line. Five-number summary of A: ${a.join(', ')}. Five-number summary of B: ${b.join(', ')}.`,a,b};
  const want=mode==='iqrDiff'?'\\text{IQR}(A)-\\text{IQR}(B)':mode==='medianGap'?'\\text{median}(A)-\\text{median}(B)':'\\text{range}(A)-\\text{range}(B)';
  const work=mode==='iqrDiff'?`(${minus(a[3],a[1])})-(${minus(b[3],b[1])})`:mode==='medianGap'?minus(a[2],b[2]):`(${minus(a[4],a[0])})-(${minus(b[4],b[0])})`;
  return done(`Compare the two distributions: find ${m(want)}.`,[`Series ${m('A')}: ${m(a.join(', '))}; series ${m('B')}: ${m(b.join(', '))}.`,mode==='iqrDiff'?`The interquartile range is ${m('Q_3-Q_1')}, read on the shared axis.`:mode==='medianGap'?'The line inside each box marks its median.':'The ends of the whiskers mark the range.',`The signed difference is ${m(`${want}=${work}=${ans}`)}.`],m(ans),V(mode==='iqrDiff'?`((${a[3]})-(${a[1]}))-((${b[3]})-(${b[1]}))`:mode==='medianGap'?`(${a[2]})-(${b[2]})`:`((${a[4]})-(${a[0]}))-((${b[4]})-(${b[0]}))`,ans),fig);
 }
 if(kind==='network'){
  const {weights}=p;
  if(!Array.isArray(weights)||weights.length!==7||weights.some(w=>!Number.isInteger(w)||w<1||w>15))throw Error('seven-edge positive network');
  const [ab,ac,bc,bd,cd,ce,de]=weights;
  const paths=[
   {labels:'A→B→D→E',sum:ab+bd+de},
   {labels:'A→C→E',sum:ac+ce},
   {labels:'A→C→D→E',sum:ac+cd+de},
   {labels:'A→B→C→E',sum:ab+bc+ce},
   {labels:'A→B→C→D→E',sum:ab+bc+cd+de},
   {labels:'A→C→B→D→E',sum:ac+bc+bd+de},
   {labels:'A→B→D→C→E',sum:ab+bd+cd+ce}
  ];
  const best=Math.min(...paths.map(p=>p.sum)),winners=paths.filter(p=>p.sum===best);
  if(winners.length!==1)throw Error('nonunique shortest route; regenerate case');
  const routeTex=labels=>labels.split('→').join('\\to '),route=labels=>m(routeTex(labels));
  const fig={type:'network',description:`Weighted network on the nodes A, B, C, D and E. Edge weights: AB ${ab}, AC ${ac}, BC ${bc}, BD ${bd}, CD ${cd}, CE ${ce}, DE ${de}. Find the path of least total weight from A to E.`,weights};
  return done(`Find the least total weight of a path from ${m('A')} to ${m('E')} in the network.`,[`All seven edge weights are positive.`,`Compare the possible routes: ${paths.map(p=>m(`${routeTex(p.labels)}\\colon ${p.sum}`)).join('; ')}.`,`The unique shortest route is ${route(winners[0].labels)}, with total weight ${m(best)}.`],m(best),V(winners[0].labels.split('→').slice(1).map((end,i)=>{const start=winners[0].labels.split('→')[i];const index={AB:ab,AC:ac,BC:bc,BD:bd,CD:cd,CE:ce,DE:de};return index[[start,end].sort().join('')]}).join('+'),best),fig);
 }
 if(kind==='ellipse'){
  const {a,b,mode='focal'}=p;
  if(!Number.isInteger(a)||!Number.isInteger(b)||a<=b||b<1||a>12)throw Error('ellipse axis');
  const c2=a*a-b*b,area=a*b;
  const fig={type:'ellipse',description:`Ellipse x^2/${a*a} + y^2/${b*b} = 1 centred at O, with semi-major axis a = ${a}, semi-minor axis b = ${b} and foci on the x-axis.`,a,b};
  return done(`From the ellipse diagram and its labelled semi-axes, find ${mode==='focal'?`the square of the focal distance, ${m('c^2')}`:`the area as a multiple of ${m('\\pi')}`}.`,[`The semi-major axis is ${m(`a=${a}`)} and the semi-minor axis is ${m(`b=${b}`)}.`,mode==='focal'?`For an ellipse with foci on the ${m('x')}-axis, ${m('c^2=a^2-b^2')}.`:`The area of an ellipse is ${m('\\pi ab')}.`,mode==='focal'?`So ${m(`c^2=${a}^2-${b}^2=${c2}`)}.`:`So the area is ${m(`\\pi\\times ${a}\\times ${b}=${piTimes(area)}`)}.`],mode==='focal'?m(c2):m(piTimes(area)),V(mode==='focal'?`${a}^2-${b}^2`:`${a}*${b}`,mode==='focal'?c2:area),fig);
 }
 if(kind==='inverseLine'){
  const {m:k,b,x0}=p;if(![k,b,x0].every(Number.isInteger)||k<1||k>4||Math.abs(b)>6)throw Error('inverse');
  const y0=k*x0+b;
  const f=poly([[k,'x'],[b,'']]);
  const inv=b?(k===1?plainShift('x',b):`(${plainShift('x',b)})/${k}`):(k===1?'x':`x/${k}`);
  const fig={type:'plane',description:`The line y = ${plainPoly([[k,'x'],[b,'']])} and its inverse y = ${inv} are reflections of each other in the line y = x; P on the original and Q on the inverse are marked without coordinate labels.`,points:[pt('A',[-3,k*(-3)+b]),pt('B',[4,4*k+b]),pt('C',[k*(-3)+b,-3]),pt('D',[4*k+b,4]),pt('P',[x0,y0]),pt('Q',[y0,x0])],segments:[['A','B'],['C','D'],['P','Q']]};
  return done(`The graphs of ${m(`f(x)=${f}`)} and its inverse are reflections in ${m('y=x')}. Find ${m(`f^{-1}(${y0})`)}.`,[`The point ${m('P='+pair(x0,y0))} lies on ${m('f')}, since ${m(`f(${x0})=${y0}`)}.`,`Reflecting ${m('P')} in ${m('y=x')} swaps its coordinates: the point on the inverse is ${m(pair(y0,x0))}.`,`So ${m(`f^{-1}(${y0})=${x0}`)}.`],m(x0),V(`((${y0})-(${b}))/${k}`,x0),fig);
 }
 throw Error('unsupported investigation kind '+kind);
}

function ordinal(n){const s=['th','st','nd','rd'],v=n%100;return n+(s[(v-20)%10]||s[v]||s[0]);}
