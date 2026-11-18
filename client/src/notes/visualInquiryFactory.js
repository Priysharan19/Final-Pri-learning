// Original figure-first inquiry tasks. Mathematical figure values and numeric receipts are generated together.
// No server answer checking or copied external figures; external mathematical signoff remains required.
// Questions, steps and answers are TeX ($…$, via texFormat.js); `verify` stays in engine syntax;
// figure descriptions are plain text for screen readers.
import { m, num, paren, plus, minus, times, frac, poly, pair, plainShift } from './texFormat.js';

export function makeInquiryVisual(kind,p){
 const V=(a,b)=>({kind:"value",expr:String(a),answer:String(b)});
 const P=items=>({kind:"values",pairs:items.map(([a,b])=>[String(a),String(b)])});
 const pt=(id,xy)=>({id,x:xy[0],y:xy[1],label:id});
 const done=(q,steps,answer,verify,figure)=>{
  if(!figure?.description||steps.length<3||!answer&&answer!==0)throw Error("missing figure or maths");
  return {question:(p.context?p.context+": ":"")+q,steps,answer:String(answer),verify,figure};
 };
 const factorial=n=>Array.from({length:n},(_,i)=>i+1).reduce((a,b)=>a*b,1);
 const choose=(n,k)=>factorial(n)/(factorial(k)*factorial(n-k));
 const plainXY=v=>`${v.id}(${v.x}, ${v.y})`;
 if(kind==="polygonArea"){
  const {vertices}=p;
  if(!Array.isArray(vertices)||vertices.length<3||vertices.length>6||vertices.some(x=>x.length!==2||x.some(n=>!Number.isInteger(n))))throw Error("polygon");
  const det=vertices.reduce((sum,v,i)=>sum+v[0]*vertices[(i+1)%vertices.length][1]-vertices[(i+1)%vertices.length][0]*v[1],0);
  const area=Math.abs(det)/2;if(area<1)throw Error("degenerate polygon");
  const ids=vertices.map((xy,i)=>pt(String.fromCharCode(65+i),xy));
  const fig={type:"plane",description:`Shaded polygon with ${vertices.length} vertices: ${ids.map(plainXY).join(", ")}.`,points:ids,polygons:[{vertices:ids.map(x=>x.id),shade:true}]};
  const terms=vertices.map((v,i)=>`(${v[0]})*(${vertices[(i+1)%vertices.length][1]})-(${vertices[(i+1)%vertices.length][0]})*(${v[1]})`);
  return done("Find the exact area of the shaded polygon from the labelled coordinates on the graph.",[`Read all ${m(vertices.length)} vertices in order around the polygon.`,`The shoelace sum ${m('\\sum (x_iy_{i+1}-x_{i+1}y_i)')} gives twice the signed area: ${m(det)}.`,`Area ${m(`=\\tfrac{|${det}|}{2}=${num(area)}`)} square units.`],`${m(num(area))} square units`,V(`abs(${terms.join("+")})/2`,area),fig);
 }
 if(kind==="transform"){
  const {A,B,C,dx,dy,mode="image"}=p;
  if(![...A,...B,...C,dx,dy].every(Number.isInteger)||dx===0&&dy===0)throw Error("bad translation");
  const originals=[A,B,C],images=originals.map(v=>[v[0]+dx,v[1]+dy]);
  const old=originals.map((v,i)=>pt("ABC"[i],v)),after=images.map((v,i)=>pt("PQR"[i],v));
  const fig={type:"plane",description:`Triangle ABC translated by the vector (${dx}, ${dy}) to triangle PQR. Original vertices ${old.map(plainXY).join(", ")}; image vertices ${after.map(plainXY).join(", ")}.`,points:[...old,...after],polygons:[{vertices:["A","B","C"],shade:false},{vertices:["P","Q","R"],shade:true}]};
  const origArea=Math.abs((B[0]-A[0])*(C[1]-A[1])-(B[1]-A[1])*(C[0]-A[0]))/2;
  if(!origArea)throw Error("collinear");
  if(mode==="area")return done(`A triangle is translated as shown. Find the area of the shaded image triangle ${m('PQR')}.`,[`A translation moves every point through the same vector ${m(pair(dx,dy))}.`,"A translation keeps lengths, angles and areas unchanged.",`Triangle ${m('ABC')} has area ${m(num(origArea))}, so its image ${m('PQR')} also has area ${m(num(origArea))}.`],`${m(num(origArea))} square units`,V(`abs((${B[0]-A[0]})*(${C[1]-A[1]})-(${B[1]-A[1]})*(${C[0]-A[0]}))/2`,origArea),fig);
  return done(`Read the translation vector and find the coordinates of the labelled image point ${m('P')}.`,[`The translation moves every vertex ${m(dx)} in the ${m('x')}-direction and ${m(dy)} in the ${m('y')}-direction.`,`Vertex ${m('A')} starts at ${m(pair(A[0],A[1]))}.`,`Its image is ${m(`P=(${plus(A[0],dx)}, ${plus(A[1],dy)})=${pair(images[0][0],images[0][1])}`)}.`],m(pair(images[0][0],images[0][1])),P([[`(${A[0]})+(${dx})`,images[0][0]],[`(${A[1]})+(${dy})`,images[0][1]]]),fig);
 }
 if(kind==="similarTriangles"){
  const {base,height,num:nu,den}=p;
  if(![base,height,nu,den].every(Number.isInteger)||base<=0||height<=0||nu<=0||nu>=den||den<=0||base*nu%den||height*nu%den)throw Error("non-integral similarity coords");
  const full=Math.sqrt(base*base+height*height),small=full*nu/den;
  if(!Number.isInteger(full)||!Number.isInteger(small))throw Error("integer Pythagorean side preferred");
  const D=[base*nu/den,0],E=[0,height*nu/den];
  const fig={type:"geometry",description:`Right triangle ABC with A(0, 0), B(${base}, 0), C(0, ${height}), D(${D[0]}, ${D[1]}) on AB and E(${E[0]}, ${E[1]}) on AC. DE is parallel to BC, AC = ${height}, AB = ${base}, AD = ${D[0]}.`,points:[pt("A",[0,0]),pt("B",[base,0]),pt("C",[0,height]),pt("D",D),pt("E",E)],segments:[["A","B"],["A","C"],["B","C"],["D","E"]],sideLabels:[{a:"B",b:"C",text:String(full)},{a:"A",b:"D",text:String(D[0])},{a:"A",b:"B",text:String(base)}],rightAngles:["A"]};
  const k=frac(nu,den),kRaw=`\\tfrac{${D[0]}}{${base}}`;
  return done(`Segment ${m('DE')} is parallel to ${m('BC')} in the triangle shown. Find the length of ${m('DE')}.`,[`Triangles ${m('ADE')} and ${m('ABC')} are similar because ${m('DE\\parallel BC')}.`,`The scale factor is ${m(`\\tfrac{AD}{AB}=${kRaw}${kRaw===k?'':'='+k}`)}, and the hypotenuse is ${m(`BC=\\sqrt{${base}^2+${height}^2}=${full}`)}.`,`So ${m(`DE=${k}\\times ${full}=${num(small)}`)} units.`],`${m(num(small))} units`,V(`(${nu}/${den})*sqrt(${base}^2+${height}^2)`,small),fig);
 }
 if(kind==="quadraticRoots"){
  const {r1,r2,a=1}=p;if(![r1,r2,a].every(Number.isInteger)||r1>=r2||a===0||Math.abs(a)>3)throw Error("distinct ordered roots");
  const b=-a*(r1+r2),c=a*r1*r2,h=(r1+r2)/2,k=a*(h-r1)*(h-r2);
  const lead=a===1?'':a===-1?'-':String(a);
  const fig={type:"plane",description:`Graph of y = ${lead}${[r1,r2].sort((u,w)=>(u!==0)-(w!==0)).map(r=>r?`(${plainShift('x',r)})`:'x').join('')} with x-intercepts R(${r1}, 0) and S(${r2}, 0) and vertex V(${num(h)}, ${num(k)}).`,points:[pt("R",[r1,0]),pt("S",[r2,0]),pt("V",[h,k])],curves:[{type:"quadratic",a,b,c,xmin:r1-1,xmax:r2+1}]};
  return done(`The parabola crosses the ${m('x')}-axis at ${m('R')} and ${m('S')}. Find the ${m('x')}-coordinate of its axis of symmetry.`,[`The graph has ${m('x')}-intercepts ${m(r1)} and ${m(r2)}.`,`The axis of symmetry lies halfway between the two roots.`,`Its ${m('x')}-coordinate is ${m(`\\tfrac{${plus(r1,r2)}}{2}=${num(h)}`)}.`],m(num(h)),V(`(${r1}+(${r2}))/2`,h),fig);
 }
 if(kind==="vectorArea"){
  const {u,v}=p;if(!u||!v||u.length!==2||v.length!==2||[...u,...v].some(n=>!Number.isInteger(n)))throw Error("vector coords");
  const det=u[0]*v[1]-u[1]*v[0],area=Math.abs(det);if(area===0)throw Error("collinear");
  const W=[u[0]+v[0],u[1]+v[1]],fig={type:"plane",description:`Parallelogram OUWV spanned by the vectors u = (${u[0]}, ${u[1]}) and v = (${v[0]}, ${v[1]}); O(0, 0), U(${u[0]}, ${u[1]}), V(${v[0]}, ${v[1]}), W(${W[0]}, ${W[1]}).`,points:[pt("O",[0,0]),pt("U",u),pt("V",v),pt("W",W)],polygons:[{vertices:["O","U","W","V"],shade:true}],segments:[["O","U"],["O","V"]],arrows:[["O","U"],["O","V"]]};
  return done(`Find the exact area of the shaded parallelogram spanned by ${m('\\mathbf{u}')} and ${m('\\mathbf{v}')} on the grid.`,[`The vectors are ${m('\\mathbf{u}='+pair(u[0],u[1]))} and ${m('\\mathbf{v}='+pair(v[0],v[1]))}.`,`The parallelogram spanned by two vectors in the plane has area ${m('|u_xv_y-u_yv_x|')}.`,`Area ${m(`=|${times(u[0],v[1])}-${paren(u[1])}\\times ${paren(v[0])}|=${area}`)} square units.`],`${m(area)} square units`,V(`abs((${u[0]})*(${v[1]})-(${u[1]})*(${v[0]}))`,area),fig);
 }
 if(kind==="trigWave"){
  const {amp,k,mode="peaks"}=p;
  if(!Number.isInteger(amp)||amp<=0||amp>5||!Number.isInteger(k)||k<=0||k>5)throw Error("invalid wave");
  const arg=k===1?'x':`${k}x`,curve=`${amp===1?'':amp}\\sin ${k===1?'x':`(${arg})`}`;
  const fig={type:"trig-wave",description:`Sine graph y = ${amp===1?'':amp+' '}sin(${arg}) for x from 0 to 2 pi, with the amplitude marked at plus and minus ${amp} and tick labels in multiples of pi.`,amp,k};
  const val=mode==="peaks"?k:amp;
  return done(`From the graph of the sine wave, find ${mode==="peaks"?`the number of complete crests between ${m('x=0')} and ${m('x=2\\pi')}`:"its amplitude"}.`,[`The curve is ${m(`y=${curve}`)}, drawn over one window of width ${m('2\\pi')}.`,`It reaches ${m(`\\pm ${amp}`)} and completes ${m(k)} full ${k===1?'cycle':'cycles'} in the window.`,`So the ${mode==="peaks"?"number of crests":"amplitude"} is ${m(val)}.`],m(val),V(mode==="peaks"?`${k}`:`${amp}`,val),fig);
 }
 if(kind==="histogram"){
  const {counts,width=5,mode="total"}=p;
  if(!Array.isArray(counts)||counts.length<4||counts.length>8||counts.some(x=>!Number.isInteger(x)||x<1)||!Number.isInteger(width)||width<=0)throw Error("bad frequency histogram");
  const total=counts.reduce((a,b)=>a+b,0),highest=Math.max(...counts),maxIndex=counts.indexOf(highest);
  const sorted=[...counts].sort((a,b)=>b-a);if(sorted[0]===sorted[1])throw Error("modal class ambiguous");
  const fig={type:"histogram",description:`Histogram of equal-width classes of width ${width}, with frequencies ${counts.join(", ")} for consecutive classes from 0 to ${counts.length*width}.`,counts,width};
  if(mode==="modal")return done("Find the lower class boundary of the tallest bar of the histogram.",[`Every bar is a class of width ${m(width)}.`,`The tallest bar has frequency ${m(highest)}; counting the classes from zero, it is class ${m(maxIndex)}.`,`Its lower boundary is ${m(`${maxIndex}\\times ${width}=${maxIndex*width}`)}.`],m(maxIndex*width),V(`${maxIndex}*${width}`,maxIndex*width),fig);
  return done("Find the total frequency shown by the whole histogram.",[`The ${m(counts.length)} bars have frequencies ${m(counts.join(", "))}.`,`The classes do not overlap, so every observation is in exactly one bar.`,`Total frequency ${m(`=${counts.join("+")}=${total}`)}.`],m(total),V(counts.join("+"),total),fig);
 }
 if(kind==="boxPlot"){
  const {min,q1,med,q3,max,mode="iqr"}=p;
  if(![min,q1,med,q3,max].every(Number.isInteger)||!(min<q1&&q1<med&&med<q3&&q3<max))throw Error("ordered five-number summary needed");
  const fig={type:"box-plot",description:`Box-and-whisker plot with minimum ${min}, lower quartile ${q1}, median ${med}, upper quartile ${q3} and maximum ${max}.`,min,q1,med,q3,max};
  const answer=mode==="iqr"?q3-q1:max-min;
  return done(`From the five-number summary in the plot, calculate the ${mode==="iqr"?"interquartile range":"range"}.`,[`Read the five marked values in increasing order: ${m([min,q1,med,q3,max].join(", "))}.`,mode==="iqr"?`The interquartile range measures the middle half of the data: ${m('Q_3-Q_1')}.`:"The range is the maximum minus the minimum.",mode==="iqr"?`${m(`Q_3-Q_1=${minus(q3,q1)}=${answer}`)}.`:`${m(`${minus(max,min)}=${answer}`)}.`],m(answer),V(mode==="iqr"?`(${q3})-(${q1})`:`(${max})-(${min})`,answer),fig);
 }
 if(kind==="scatterLine"){
  const {m:sl,b,points=[0,1,2,3,4],mode="slope"}=p;
  if(!Number.isInteger(sl)||sl===0||!Number.isInteger(b)||!Array.isArray(points)||points.length<4||points.some(x=>!Number.isInteger(x))||new Set(points).size!==points.length)throw Error("scatter model");
  const xy=points.map(x=>[x,sl*x+b]),fig={type:"scatter",description:`Scatter plot of the points ${xy.map(v=>`(${v[0]}, ${v[1]})`).join(", ")}, which lie on a straight line.`,xy,m:sl,b};
  const left=xy[0],right=xy[xy.length-1],slope=(right[1]-left[1])/(right[0]-left[0]);if(slope!==sl)throw Error("slope mismatch");
  const answer=mode==="slope"?sl:b;
  return done(`Use the plotted points to calculate the ${mode==="slope"?"gradient (the change in $y$ for each unit of $x$)":"$y$-intercept of the straight-line trend"}.`,[`Take the first and last plotted points, ${m(pair(left[0],left[1]))} and ${m(pair(right[0],right[1]))}.`,`Gradient ${m(`=\\tfrac{\\Delta y}{\\Delta x}=\\tfrac{${minus(right[1],left[1])}}{${minus(right[0],left[0])}}=${sl}`)}.`,`So the line is ${m(`y=${poly([[sl,'x'],[b,'']])}`)}, and the ${mode==="slope"?"gradient":"intercept"} is ${m(answer)}.`],m(answer),V(mode==="slope"?`(${right[1]}-(${left[1]}))/(${right[0]}-(${left[0]}))`:`(${left[1]})-(${sl})*(${left[0]})`,answer),fig);
 }
 if(kind==="exponential"){
  const {base,power=2}=p;if(!Number.isInteger(base)||base<2||base>4||!Number.isInteger(power)||power<1||power>3)throw Error("exponential bounds");
  const figure={type:"exponential",description:`Graph of y = ${base}^x for x from 0 to 4; the marked heights are ${Array.from({length:5},(_,i)=>base**i).join(", ")}.`,base};
  const ratio=base**power,other=4-power;
  return done(`Read the exponential graph ${m(`y=${base}^x`)}. By what factor does ${m('y')} grow between ${m(`x=${other}`)} and ${m('x=4')}?`,[`At ${m(`x=${other}`)}, ${m(`y=${base}^{${other}}=${base**other}`)}.`,`At ${m('x=4')}, ${m(`y=${base}^4=${base**4}`)}.`,`Their ratio is ${m(`\\tfrac{${base**4}}{${base**other}}=${ratio}`)}.`],m(ratio),V(`${base}^4/${base}^${other}`,ratio),figure);
 }
 if(kind==="piecewise"){
  const {left,right,mode="jump"}=p;if(!Number.isInteger(left)||!Number.isInteger(right)||left===right||Math.abs(left)>8||Math.abs(right)>8)throw Error("step function");
  const figure={type:"piecewise",description:`Step graph with f(x) = ${left} for negative x, an open circle at (0, ${left}), and f(x) = ${right} for x from 0 onwards, a filled circle at (0, ${right}).`,left,right};
  const answer=mode==="jump"?right-left:right;
  return done(`From the open and filled endpoints, find ${mode==="jump"?`the signed jump ${m('f(0^+)-f(0^-)')}`:`the value ${m('f(0)')}`}.`,[`As ${m('x')} approaches ${m('0')} from the left, the graph tends to ${m(left)}; the circle at ${m('x=0')} on that piece is open.`,`At ${m('x=0')} and just to the right, the filled endpoint gives the value ${m(right)}.`,mode==="jump"?`The jump is ${m(`${minus(right,left)}=${answer}`)}.`:`So ${m(`f(0)=${answer}`)}.`],m(answer),V(mode==="jump"?`(${right})-(${left})`:`(${right})`,answer),figure);
 }
 if(kind==="latticePaths"){
  const {east,north}=p;if(!Number.isInteger(east)||!Number.isInteger(north)||east<1||north<1||east>6||north>6)throw Error("lattice size");
  const total=choose(east+north,east);
  const figure={type:"lattice",description:`A square grid ${east} squares wide and ${north} squares high, from the start S(0, 0) to the finish T(${east}, ${north}); each step goes one unit right or one unit up.`,east,north};
  return done(`How many shortest paths, moving only right or up, join ${m('S')} to ${m('T')} in the grid?`,[`Every shortest path has exactly ${m(east)} steps right and ${m(north)} steps up.`,`A path is fixed by choosing which ${m(east)} of its ${m(east+north)} steps go right.`,`Number of paths ${m(`=\\binom{${east+north}}{${east}}=${total}`)}.`],m(total),V(`(${Array.from({length:east},(_,i)=>east+north-i).join("*")})/(${Array.from({length:east},(_,i)=>i+1).join("*")})`,total),figure);
 }
 throw Error("unsupported inquiry visual kind "+kind);
}
