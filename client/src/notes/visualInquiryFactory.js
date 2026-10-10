// Original figure-first inquiry tasks. Mathematical figure values and numeric receipts are generated together.
// No server answer checking or copied external figures; external mathematical signoff remains required.
export function makeInquiryVisual(kind,p){
 const V=(a,b)=>({kind:"value",expr:String(a),answer:String(b)});
 const P=items=>({kind:"values",pairs:items.map(([a,b])=>[String(a),String(b)])});
 const pt=(id,xy)=>({id,x:xy[0],y:xy[1],label:id});
 const round=n=>Number(n.toFixed(7));
 const done=(q,steps,answer,verify,figure)=>{
  if(!figure?.description||steps.length<3||!answer&&answer!==0)throw Error("missing figure or maths");
  return {question:(p.context?p.context+": ":"")+q,steps,answer:String(answer),verify,figure};
 };
 const factorial=n=>Array.from({length:n},(_,i)=>i+1).reduce((a,b)=>a*b,1);
 const choose=(n,k)=>factorial(n)/(factorial(k)*factorial(n-k));
 if(kind==="polygonArea"){
  const {vertices}=p;
  if(!Array.isArray(vertices)||vertices.length<3||vertices.length>6||vertices.some(x=>x.length!==2||x.some(n=>!Number.isInteger(n))))throw Error("polygon");
  const det=vertices.reduce((sum,v,i)=>sum+v[0]*vertices[(i+1)%vertices.length][1]-vertices[(i+1)%vertices.length][0]*v[1],0);
  const area=Math.abs(det)/2;if(area<1)throw Error("degenerate polygon");
  const ids=vertices.map((xy,i)=>pt(String.fromCharCode(65+i),xy));
  const fig={type:"plane",description:`Shaded ${vertices.length}-vertex polygon with points ${ids.map(x=>x.id+"("+x.x+","+x.y+")").join(", ")}.`,points:ids,polygons:[{vertices:ids.map(x=>x.id),shade:true}]};
  const terms=vertices.map((v,i)=>`(${v[0]})*(${vertices[(i+1)%vertices.length][1]})-(${vertices[(i+1)%vertices.length][0]})*(${v[1]})`);
  return done("Find the exact shaded polygon area from the graph's labelled coordinates.",[`Read all ${vertices.length} polygon vertices in the plotted cyclic order.`,`Use the shoelace sum; the signed double area is ${det}.`,`Area = |${det}|/2 = ${area} square units.`],`${area} square units`,V(`abs(${terms.join("+")})/2`,area),fig);
 }
 if(kind==="transform"){
  const {A,B,C,dx,dy,mode="image"}=p;
  if(![...A,...B,...C,dx,dy].every(Number.isInteger)||dx===0&&dy===0)throw Error("bad translation");
  const originals=[A,B,C],images=originals.map(v=>[v[0]+dx,v[1]+dy]);
  const old=originals.map((v,i)=>pt("ABC"[i],v)),after=images.map((v,i)=>pt("PQR"[i],v));
  const fig={type:"plane",description:`Triangle ABC translated by vector (${dx},${dy}) to PQR. Original vertices ${old.map(v=>v.id+"("+v.x+","+v.y+")").join(", ")}; image vertices ${after.map(v=>v.id+"("+v.x+","+v.y+")").join(", ")}.`,points:[...old,...after],polygons:[{vertices:["A","B","C"],shade:false},{vertices:["P","Q","R"],shade:true}]};
  const origArea=Math.abs((B[0]-A[0])*(C[1]-A[1])-(B[1]-A[1])*(C[0]-A[0]))/2;
  if(!origArea)throw Error("collinear");
  if(mode==="area")return done("A triangle is translated as shown. Find the area of the shaded image triangle PQR.",[`Translation moves every point through the same vector (${dx},${dy}).`,"A translation preserves lengths, angles and areas.",`Original triangle ABC has area ${origArea}, so image PQR also has area ${origArea}.`],`${origArea} square units`,V(`abs((${B[0]-A[0]})*(${C[1]-A[1]})-(${B[1]-A[1]})*(${C[0]-A[0]}))/2`,origArea),fig);
  return done("Read the translation vector and find the coordinates of the labelled image point P.",[`The translation shifts every vertex ${dx} in the x direction and ${dy} in the y direction.`,`Vertex A starts at (${A[0]},${A[1]}).`,`Image P=(${A[0]}+(${dx}),${A[1]}+(${dy}))=(${images[0][0]},${images[0][1]}).`],`(${images[0][0]}, ${images[0][1]})`,P([[`(${A[0]})+(${dx})`,images[0][0]],[`(${A[1]})+(${dy})`,images[0][1]]]),fig);
 }
 if(kind==="similarTriangles"){
  const {base,height,num,den}=p;
  if(![base,height,num,den].every(Number.isInteger)||base<=0||height<=0||num<=0||num>=den||den<=0||base*num%den||height*num%den)throw Error("non-integral similarity coords");
  const full=Math.sqrt(base*base+height*height),small=full*num/den;
  if(!Number.isInteger(full)||!Number.isInteger(small))throw Error("integer Pythagorean side preferred");
  const D=[base*num/den,0],E=[0,height*num/den];
  const fig={type:"geometry",description:`Right triangle ABC A(0,0), B(${base},0), C(0,${height}), with D(${D}) on AB and E(${E}) on AC. DE is parallel to BC, AC=${height}, AB=${base}, AD=${D[0]}.`,points:[pt("A",[0,0]),pt("B",[base,0]),pt("C",[0,height]),pt("D",D),pt("E",E)],segments:[["A","B"],["A","C"],["B","C"],["D","E"]],sideLabels:[{a:"B",b:"C",text:String(full)},{a:"A",b:"D",text:String(D[0])},{a:"A",b:"B",text:String(base)}],rightAngles:["A"]};
  return done("Segment DE is parallel to BC in the shown triangle. Determine length DE.",[`Triangles ADE and ABC are similar because DE ∥ BC.`,`Scale factor AD/AB=${D[0]}/${base}=${num}/${den}; the full hypotenuse BC=sqrt(${base}²+${height}²)=${full}.`,`Therefore DE=(${num}/${den})×${full}=${small} units.`],`${small} units`,V(`(${num}/${den})*sqrt(${base}^2+${height}^2)`,small),fig);
 }
 if(kind==="quadraticRoots"){
  const {r1,r2,a=1}=p;if(![r1,r2,a].every(Number.isInteger)||r1>=r2||a===0||Math.abs(a)>3)throw Error("distinct ordered roots");
  const b=-a*(r1+r2),c=a*r1*r2,h=(r1+r2)/2,k=a*(h-r1)*(h-r2);
  const fig={type:"plane",description:`Quadratic graph y=${a}(x-(${r1}))(x-(${r2})) with x-intercepts R(${r1},0), S(${r2},0) and vertex V(${h},${k}).`,points:[pt("R",[r1,0]),pt("S",[r2,0]),pt("V",[h,k])],curves:[{type:"quadratic",a,b,c,xmin:r1-1,xmax:r2+1}]};
  return done("The parabola crosses the x-axis at R and S. Find the x-coordinate of its axis of symmetry.",[`The graph has x-intercepts ${r1} and ${r2}.`,`The axis of symmetry lies exactly halfway between the two roots.`,`Its x-coordinate is (${r1}+(${r2}))/2=${h}.`],h,V(`(${r1}+(${r2}))/2`,h),fig);
 }
 if(kind==="vectorArea"){
  const {u,v}=p;if(!u||!v||u.length!==2||v.length!==2||[...u,...v].some(n=>!Number.isInteger(n)))throw Error("vector coords");
  const det=u[0]*v[1]-u[1]*v[0],area=Math.abs(det);if(area===0)throw Error("collinear");
  const W=[u[0]+v[0],u[1]+v[1]],fig={type:"plane",description:`Parallelogram OUVW spanned by vectors u=(${u}), v=(${v}); O=(0,0), U=(${u}), V=(${v}), W=(${W}).`,points:[pt("O",[0,0]),pt("U",u),pt("V",v),pt("W",W)],polygons:[{vertices:["O","U","W","V"],shade:true}],segments:[["O","U"],["O","V"]],arrows:[["O","U"],["O","V"]]};
  return done("Find the exact shaded parallelogram area determined by u and v on the grid.",[`The vectors are u=(${u[0]},${u[1]}) and v=(${v[0]},${v[1]}).`,`A parallelogram spanned by two 2D vectors has area |u_x v_y−u_y v_x|.`,`Area=|${u[0]}×${v[1]}−${u[1]}×${v[0]}|=${area} square units.`],`${area} square units`,V(`abs((${u[0]})*(${v[1]})-(${u[1]})*(${v[0]}))`,area),fig);
 }
 if(kind==="trigWave"){
  const {amp,k,mode="peaks"}=p;
  if(!Number.isInteger(amp)||amp<=0||amp>5||!Number.isInteger(k)||k<=0||k>5)throw Error("invalid wave");
  const fig={type:"trig-wave",description:`Continuous sine graph y=${amp}sin(${k}x), x from 0 to 2π, with numerical amplitude marks ±${amp} and π-axis tick labels.`,amp,k};
  const val=mode==="peaks"?k:amp;
  return done(`From the graphed sine wave, determine ${mode==="peaks"?"the number of complete positive crests between x=0 and x=2π":"its positive amplitude"}.`,[`The curve is y=${amp} sin(${k}x), drawn across one 2π-wide window.`,`The vertical extremes are ±${amp} and the function completes ${k} full oscillations in the window.`,`Thus the requested ${mode==="peaks"?"crest count":"amplitude"} is ${val}.`],val,V(mode==="peaks"?`${k}`:`${amp}`,val),fig);
 }
 if(kind==="histogram"){
  const {counts,width=5,mode="total"}=p;
  if(!Array.isArray(counts)||counts.length<4||counts.length>8||counts.some(x=>!Number.isInteger(x)||x<1)||!Number.isInteger(width)||width<=0)throw Error("bad frequency histogram");
  const total=counts.reduce((a,b)=>a+b,0),highest=Math.max(...counts),maxIndex=counts.indexOf(highest);
  const sorted=[...counts].sort((a,b)=>b-a);if(sorted[0]===sorted[1])throw Error("modal class ambiguous");
  const fig={type:"histogram",description:`Contiguous equal-width frequency bins of width ${width}, with heights ${counts.join(", ")} for consecutive classes from 0 to ${counts.length*width}.`,counts,width};
  if(mode==="modal")return done("Find the lower class boundary of the tallest histogram bin.",[`All bars represent equal-width classes of width ${width}.`,`The unique tallest bar has frequency ${highest} and occurs at class index ${maxIndex} (counting from zero).`,`Its lower boundary is ${maxIndex}×${width}=${maxIndex*width}.`],maxIndex*width,V(`${maxIndex}*${width}`,maxIndex*width),fig);
  return done("Find the total frequency represented by the whole histogram.",[`The ${counts.length} bins have counts ${counts.join(", ")}.`,`Because the classes are disjoint, every observation appears in exactly one bar.`,`Total frequency=${counts.join("+")}=${total}.`],total,V(counts.join("+"),total),fig);
 }
 if(kind==="boxPlot"){
  const {min,q1,med,q3,max,mode="iqr"}=p;
  if(![min,q1,med,q3,max].every(Number.isInteger)||!(min<q1&&q1<med&&med<q3&&q3<max))throw Error("ordered five-number summary needed");
  const fig={type:"box-plot",description:`Box-and-whisker plot with minimum ${min}, Q1 ${q1}, median ${med}, Q3 ${q3}, maximum ${max}.`,min,q1,med,q3,max};
  const answer=mode==="iqr"?q3-q1:max-min;
  return done(`From the plotted five-number summary, calculate the ${mode==="iqr"?"interquartile range":"overall range"}.`,[`Read the five marked values in increasing order: ${min}, ${q1}, ${med}, ${q3}, ${max}.`,mode==="iqr"?"The interquartile range measures the middle half of the observations: Q3−Q1.":"The overall range is maximum minus minimum.",`Subtract the required endpoints to obtain ${answer}.`],answer,V(mode==="iqr"?`(${q3})-(${q1})`:`(${max})-(${min})`,answer),fig);
 }
 if(kind==="scatterLine"){
  const {m,b,points=[0,1,2,3,4],mode="slope"}=p;
  if(!Number.isInteger(m)||m===0||!Number.isInteger(b)||!Array.isArray(points)||points.length<4||points.some(x=>!Number.isInteger(x))||new Set(points).size!==points.length)throw Error("scatter model");
  const xy=points.map(x=>[x,m*x+b]),fig={type:"scatter",description:`Scatterplot with exact points ${xy.map(v=>"("+v.join(",")+")").join(", ")} on a straight trend.`,xy,m,b};
  const left=xy[0],right=xy[xy.length-1],slope=(right[1]-left[1])/(right[0]-left[0]);if(slope!==m)throw Error("slope mismatch");
  const answer=mode==="slope"?m:b;
  return done(`Use the plotted observations to calculate the ${mode==="slope"?"gradient (change in y per unit x)":"y-intercept of their straight-line trend"}.`,[`Take the first and last plotted observations: (${left}) and (${right}).`,`Gradient=(Δy)/(Δx)=(${right[1]}−(${left[1]}))/(${right[0]}−(${left[0]}))=${m}.`,`Hence the plotted relation is y=${m}x+(${b}), giving ${mode==="slope"?"slope "+m:"intercept "+b}.`],answer,V(mode==="slope"?`(${right[1]}-(${left[1]}))/(${right[0]}-(${left[0]}))`:`(${left[1]})-(${m})*(${left[0]})`,answer),fig);
 }
 if(kind==="exponential"){
  const {base,power=2}=p;if(!Number.isInteger(base)||base<2||base>4||!Number.isInteger(power)||power<1||power>3)throw Error("exponential bounds");
  const figure={type:"exponential",description:`Growth plot y=${base}^x across integer x=0..4; marked heights are ${Array.from({length:5},(_,i)=>base**i).join(", ")}.`,base};
  const ratio=base**power,other=4-power;
  return done(`Read the exponential graph y=${base}^x. By what factor does y grow between x=${other} and x=4?`,[`At x=${other}, y=${base}^${other}=${base**other}.`,`At x=4, y=${base}^4=${base**4}.`,`Their ratio is ${base**4}/${base**other}=${ratio}.`],ratio,V(`${base}^4/${base}^${other}`,ratio),figure);
 }
 if(kind==="piecewise"){
  const {left,right,mode="jump"}=p;if(!Number.isInteger(left)||!Number.isInteger(right)||left===right||Math.abs(left)>8||Math.abs(right)>8)throw Error("step function");
  const figure={type:"piecewise",description:`Piecewise constant graph f(x)=${left} for negative x with an open circle at (0,${left}), and f(x)=${right} for x≥0 with a filled circle at (0,${right}).`,left,right};
  const answer=mode==="jump"?right-left:right;
  return done(`From the open and filled endpoints, find ${mode==="jump"?"the signed jump f(0+)−f(0−)":"the actual function value f(0)"}.`,[`As x approaches zero from the left, the graph tends to ${left}; the circle at x=0 is open there.`,`At x=0 and immediately to the right, the filled endpoint gives value ${right}.`,`The requested value is ${answer}.`],answer,V(mode==="jump"?`(${right})-(${left})`:`(${right})`,answer),figure);
 }
 if(kind==="latticePaths"){
  const {east,north}=p;if(!Number.isInteger(east)||!Number.isInteger(north)||east<1||north<1||east>6||north>6)throw Error("lattice size");
  const total=choose(east+north,east);
  const figure={type:"lattice",description:`An ${east}-by-${north} square grid from start (0,0) to finish (${east},${north}); movement permitted only one step right or one step up.`,east,north};
  return done("How many shortest right/up paths connect S to T in the grid?",[`Every shortest route has exactly ${east} rightward and ${north} upward steps.`,`The order of these ${east+north} moves determines the route, so choose positions for the ${east} right steps.`,`Number of routes=C(${east+north},${east})=${total}.`],total,V(`(${Array.from({length:east},(_,i)=>east+north-i).join("*")})/(${Array.from({length:east},(_,i)=>i+1).join("*")})`,total),figure);
 }
 throw Error("unsupported inquiry visual kind "+kind);
}
