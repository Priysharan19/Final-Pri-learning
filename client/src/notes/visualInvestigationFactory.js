// Wave 7 original visual investigations: formulas derived from plotted figure values.
// Study only, not student-answer grading, copyrighted examination content or P0 server authority.
export function makeInvestigation(kind,p) {
 const V=(a,b)=>({kind:'value',expr:String(a),answer:String(b)});
 const P=a=>({kind:'values',pairs:a.map(([x,y])=>[String(x),String(y)])});
 const pt=(id,xy)=>({id,x:xy[0],y:xy[1],label:id});
 const gcd=(a,b)=>b?gcd(b,a%b):Math.abs(a);
 const choose=(n,k)=>{let v=1;for(let i=1;i<=k;i++)v=v*(n-i+1)/i;return Math.round(v)};
 const done=(q,steps,answer,verify,figure)=>{
  if(!q||steps.length<3||!figure?.description||!verify||answer==null)throw Error('Incomplete investigation');
  return {question:(p.context?p.context+': ':'')+q,steps,answer:String(answer),verify,figure};
 };
 if(kind==='dotPlot'){
  const {values,mode='median'}=p;
  if(!Array.isArray(values)||values.length<5||values.length>19||values.some(n=>!Number.isInteger(n)||n<0||n>12))throw Error('invalid dot values');
  const s=[...values].sort((a,b)=>a-b),mid=Math.floor(s.length/2);
  const med=s.length%2?s[mid]:(s[mid-1]+s[mid])/2;
  const freq=Object.fromEntries([...new Set(s)].map(k=>[k,s.filter(v=>v===k).length]));
  const ordered=Object.entries(freq).sort((a,b)=>b[1]-a[1]);
  if(mode==='mode'&&ordered[1]&&ordered[0][1]===ordered[1][1])throw Error('modal tie ambiguity');
  const ans=mode==='median'?med:mode==='mode'?Number(ordered[0][0]):s[s.length-1]-s[0];
  const fig={type:'dot-plot',description:`Dot plot marking each of ${s.length} observations: ${s.join(', ')}. Each dot is one observation at its integer value.`,values:s};
  return done(`Use the dot plot to find the ${mode==='median'?'median':mode==='mode'?'unique mode':'range'}.`,[`The sorted observations are ${s.join(', ')}.`,mode==='median'?'The median is the middle value, or average of two middle values.':mode==='mode'?'The mode is the value with the highest dot stack.':'The range is maximum minus minimum.',`The requested statistic is ${ans}.`],ans,V(mode==='median'?(s.length%2?String(s[mid]):`(${s[mid-1]}+${s[mid]})/2`):mode==='mode'?String(ans):`${s[s.length-1]}-${s[0]}`,ans),fig);
 }
 if(kind==='pieAngle'){
  const {counts,index,mode='angle'}=p;
  if(!Array.isArray(counts)||counts.length<3||counts.length>6||counts.some(x=>!Number.isInteger(x)||x<=0)||index<0||index>=counts.length)throw Error('pie data');
  const total=counts.reduce((a,b)=>a+b),part=counts[index],angle=360*part/total;
  if(!Number.isInteger(angle))throw Error('exact pie sector angle required');
  const fig={type:'pie',description:`Circle divided into ${counts.length} proportional sectors with counts ${counts.join(', ')} from category A onward. Selected sector ${String.fromCharCode(65+index)} has ${part} of ${total} cases.`,counts,index};
  const ans=mode==='angle'?angle:part;
  return done(`Using the proportional sector diagram, calculate ${mode==='angle'?'the central angle of sector '+String.fromCharCode(65+index):'the number of cases represented by category '+String.fromCharCode(65+index)}.`,[`The sector counts are ${counts.join(', ')}, total ${total}.`,`The selected sector has ${part}/${total} of a full circle.`,`Thus ${mode==='angle'?`angle = 360 × ${part}/${total} = ${angle}°`:`the number of cases is ${part}`}.`],mode==='angle'?`${ans}°`:ans,V(mode==='angle'?`360*${part}/${total}`:`${part}`,ans),fig);
 }
 if(kind==='stemLeaf'){
  const {values,mode='median'}=p;
  if(!Array.isArray(values)||values.length<5||values.length>17||values.some(x=>!Number.isInteger(x)||x<10||x>99))throw Error('stem data');
  const s=[...values].sort((a,b)=>a-b),i=Math.floor(s.length/2),median=s.length%2?s[i]:(s[i-1]+s[i])/2,range=s[s.length-1]-s[0];
  const ans=mode==='median'?median:range;
  const fig={type:'stem-leaf',description:`Ordered stem-and-leaf chart of two-digit observations ${s.join(', ')}; the tens digit is the stem, and the units digit is the leaf. Key 2 | 4 = 24.`,values:s};
  return done(`Read the ordered stem-and-leaf plot and calculate the ${mode==='median'?'median':'range'}.`,[`The key uses tens stems and units leaves to display ${s.length} numbers.`,`In ascending order, the observations are ${s.join(', ')}.`,`The ${mode==='median'?'middle value':'difference between highest and lowest'} is ${ans}.`],ans,V(mode==='median'?(s.length%2?String(s[i]):`(${s[i-1]}+${s[i]})/2`):`${s[s.length-1]}-${s[0]}`,ans),fig);
 }
 if(kind==='reflect'){
  const {A,B,C,axis='y',mode='coordinate'}=p;
  if(![...A,...B,...C].every(Number.isInteger)||!['x','y'].includes(axis))throw Error('reflection coords');
  const det=(B[0]-A[0])*(C[1]-A[1])-(B[1]-A[1])*(C[0]-A[0]);if(det===0)throw Error('degenerate triangle');
  const reflected=[A,B,C].map(([x,y])=>axis==='y'?[-x,y]:[x,-y]);
  const points=[...([A,B,C].map((xy,i)=>pt('ABC'[i],xy))),...reflected.map((xy,i)=>pt('PQR'[i],xy))];
  const figure={type:'plane',description:`Triangles ABC and PQR are mirror images in the ${axis}-axis. A(${A}), B(${B}), C(${C}); image P(${reflected[0]}), Q(${reflected[1]}), R(${reflected[2]}).`,points,polygons:[{vertices:['A','B','C'],shade:false},{vertices:['P','Q','R'],shade:true}]};
  const area=Math.abs(det)/2;
  if(mode==='area')return done('A triangle is reflected in the labelled axis. Find the area of its shaded image.',[`The original vertices are A(${A}), B(${B}), C(${C}).`,'Reflection preserves all lengths and areas.',`The original triangle area is |${det}|/2=${area}, which is also the image area.`],`${area} square units`,V(`abs((${B[0]-A[0]})*(${C[1]-A[1]})-(${B[1]-A[1]})*(${C[0]-A[0]}))/2`,area),figure);
  const ans=reflected[0];
  return done(`After reflection in the ${axis}-axis, what are the coordinates of point P, the image of A?`,[`Point A starts at (${A[0]},${A[1]}).`,axis==='y'?'Reflection in the y-axis changes the sign of the x-coordinate.':'Reflection in the x-axis changes the sign of the y-coordinate.',`Its marked image is P(${ans[0]},${ans[1]}).`],`(${ans.join(', ')})`,P([[axis==='y'?`-(${A[0]})`:`${A[0]}`,ans[0]],[axis==='x'?`-(${A[1]})`:`${A[1]}`,ans[1]]]),figure);
 }
 if(kind==='midpoint'){
  const {A,B,mode='x'}=p;
  if(![...A,...B].every(Number.isInteger)||A.join()===B.join())throw Error('same point');
  const m=[(A[0]+B[0])/2,(A[1]+B[1])/2],dist=(B[0]-A[0])**2+(B[1]-A[1])**2;
  const fig={type:'plane',description:`The segment AB from A(${A}) to B(${B}) with midpoint M(${m}) indicated on a Cartesian grid.`,points:[pt('A',A),pt('B',B),pt('M',m)],segments:[['A','M'],['M','B']]};
  const ans=mode==='x'?m[0]:mode==='y'?m[1]:dist;
  return done(`From the labelled segment find ${mode==='x'?'the x-coordinate of its midpoint':mode==='y'?'the y-coordinate of its midpoint':'the square of its Euclidean length'}.`,[`The endpoints are A(${A}) and B(${B}).`,mode==='distance2'?'The squared distance equals (Δx)²+(Δy)².':'The midpoint is found by averaging the two endpoint coordinates.',`The requested value is ${ans}.`],ans,V(mode==='x'?`((${A[0]})+(${B[0]}))/2`:mode==='y'?`((${A[1]})+(${B[1]}))/2`:`((${B[0]})-(${A[0]}))^2+((${B[1]})-(${A[1]}))^2`,ans),fig);
 }
 if(kind==='motion'){
  const {times,velocities,mode='distance'}=p;
  if(!Array.isArray(times)||times.length!==4||!Array.isArray(velocities)||velocities.length!==4||times.some(n=>!Number.isInteger(n))||velocities.some(n=>!Number.isInteger(n)||n<0)||times.some((n,i)=>i>0&&n<=times[i-1]))throw Error('piecewise velocity');
  const trapezoids=[0,1,2].map(i=>(times[i+1]-times[i])*(velocities[i]+velocities[i+1])/2);
  const distance=trapezoids.reduce((a,b)=>a+b,0),peak=Math.max(...velocities);
  const fig={type:'motion',description:`Piecewise-linear speed-time graph joining (${times.map((t,i)=>`${t},${velocities[i]}`).join('), (')}) with nonnegative speeds.`,times,velocities};
  const ans=mode==='distance'?distance:peak;
  return done(`Read the piecewise-linear speed-time graph. Find ${mode==='distance'?'the exact travelled distance over the shown interval':'the maximum recorded speed'}.`,[`The plotted times are ${times.join(', ')} and corresponding speeds are ${velocities.join(', ')}.`,mode==='distance'?'Each straight segment encloses a trapezoid; accumulated distance is total area under the graph.':'The highest plotted vertex gives the maximum speed.',`The answer is ${ans} ${mode==='distance'?'distance units':'speed units'}.`],ans,V(mode==='distance'?trapezoids.map((_,i)=>`(${times[i+1]}-${times[i]})*(${velocities[i]}+${velocities[i+1]})/2`).join('+'):String(peak),ans),fig);
 }
 if(kind==='tangent'){
  const {a,h,k,x0}=p;
  if(![a,h,k,x0].every(Number.isInteger)||a===0||x0===h||Math.abs(a)>4)throw Error('tangent bounds');
  const yy=x=>a*(x-h)**2+k,slope=2*a*(x0-h);
  const P0=[x0,yy(x0)],P1=[x0+1,yy(x0)+slope];
  const fig={type:'plane',description:`Quadratic y=${a}(x-(${h}))²+(${k}) with vertex V(${h},${k}); tangent touches the curve at P(${P0}) and passes through T(${P1}).`,points:[pt('V',[h,k]),pt('P',P0),pt('T',P1)],segments:[['P','T']],curves:[{type:'quadratic',a,b:-2*a*h,c:a*h*h+k,xmin:Math.min(h,x0)-2,xmax:Math.max(h,x0)+2}]};
  return done('Use the tangent drawn at P to calculate the instantaneous gradient of the quadratic.',[`The graphed quadratic has y=${a}(x−(${h}))²+(${k}).`,`Differentiating gives dy/dx=2×${a}(x−(${h})); evaluate at x=${x0}.`,`The tangent gradient is ${slope}.`],slope,V(`2*(${a})*((${x0})-(${h}))`,slope),fig);
 }
 if(kind==='twoBox'){
  const {a,b,mode='iqrDiff'}=p;
  const ordered=arr=>arr.length===5&&arr.every(Number.isInteger)&&arr.every((n,i)=>i===0||n>arr[i-1]);
  if(!ordered(a)||!ordered(b))throw Error('five number summaries must increase');
  const iqrA=a[3]-a[1],iqrB=b[3]-b[1],ans=mode==='iqrDiff'?iqrA-iqrB:mode==='medianGap'?a[2]-b[2]:(a[4]-a[0])-(b[4]-b[0]);
  const fig={type:'two-box',description:`Comparative box-and-whisker plots. A five-number summary ${a.join(', ')}. B five-number summary ${b.join(', ')}. Both use a shared numeric axis.`,a,b};
  return done(`Compare the two distributions: find ${mode==='iqrDiff'?'IQR(A) − IQR(B)':mode==='medianGap'?'median(A) − median(B)':'range(A) − range(B)'}.`,[`Series A: ${a.join(', ')}; Series B: ${b.join(', ')}.`,mode==='iqrDiff'?'IQR uses Q3 − Q1 on a shared axis.':mode==='medianGap'?'The central line of each box marks its median.':'The whisker endpoints mark the overall range.',`The signed difference A−B is ${ans}.`],ans,V(mode==='iqrDiff'?`((${a[3]})-(${a[1]}))-((${b[3]})-(${b[1]}))`:mode==='medianGap'?`(${a[2]})-(${b[2]})`:`((${a[4]})-(${a[0]}))-((${b[4]})-(${b[0]}))`,ans),fig);
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
  const fig={type:'network',description:`Weighted undirected network between nodes A B C D E. Edge weights: AB=${ab}, AC=${ac}, BC=${bc}, BD=${bd}, CD=${cd}, CE=${ce}, DE=${de}. Find minimum weight path A to E.`,weights};
  return done('Find the minimum total weight of a path from A to E in the network.',[`All seven edge weights are positive.`,`Compare candidate routes including ${paths.map(p=>p.labels+'='+p.sum).join('; ')}.`,`The unique shortest route is ${winners[0].labels}, with total weight ${best}.`],best,V(winners[0].labels.split('→').slice(1).map((end,i)=>{const start=winners[0].labels.split('→')[i];const index={AB:ab,AC:ac,BC:bc,BD:bd,CD:cd,CE:ce,DE:de};return index[[start,end].sort().join('')]}).join('+'),best),fig);
 }
 if(kind==='ellipse'){
  const {a,b,mode='focal'}=p;
  if(!Number.isInteger(a)||!Number.isInteger(b)||a<=b||b<1||a>12)throw Error('ellipse axis');
  const c2=a*a-b*b,area=a*b;
  const fig={type:'ellipse',description:`Ellipse x²/${a*a}+y²/${b*b}=1 centred at O, major semiaxis a=${a} and minor semiaxis b=${b}, with horizontal foci.`,a,b};
  return done(`From the ellipse diagram and labelled semiaxes find ${mode==='focal'?'the square of the focal distance c²':'the area as a multiple of π'}.`,[`The major semiaxis is ${a} and the minor semiaxis ${b}.`,mode==='focal'?'A horizontal ellipse satisfies c²=a²−b².':'The ellipse area is πab.',`The required ${mode==='focal'?'focal-distance square':'coefficient of π'} is ${mode==='focal'?c2:area}.`],mode==='focal'?c2:`${area}π`,V(mode==='focal'?`${a}^2-${b}^2`:`${a}*${b}`,mode==='focal'?c2:area),fig);
 }
 if(kind==='inverseLine'){
  const {m,b,x0}=p;if(![m,b,x0].every(Number.isInteger)||m<1||m>4||Math.abs(b)>6)throw Error('inverse');
  const y0=m*x0+b;
  const fig={type:'plane',description:`A pair of reflected function graphs y=${m}x+(${b}) and its inverse y=(x-(${b}))/${m}, reflected in the diagonal y=x. Labeled points P(${x0},${y0}) and P'(${y0},${x0}).`,points:[pt('A',[-3,m*(-3)+b]),pt('B',[4,4*m+b]),pt('C',[m*(-3)+b,-3]),pt('D',[4*m+b,4]),pt('P',[x0,y0]),pt('Q',[y0,x0])],segments:[['A','B'],['C','D'],['P','Q']]};
  return done(`The graph of f(x)=${m}x+(${b}) and its inverse are reflected in y=x. Find f⁻¹(${y0}).`,[`The point P=(${x0},${y0}) lies on f.`,`Reflect P in y=x: its inverse point is (${y0},${x0}).`,`Therefore f⁻¹(${y0})=${x0}.`],x0,V(`((${y0})-(${b}))/${m}`,x0),fig);
 }
 throw Error('unsupported investigation kind '+kind);
}
