// Pri Learning — original diagram-first question derivations; no media downloads or answer grading.
export function makeAdvancedVisual(kind,p){
 const V=(a,b)=>({kind:'value',expr:String(a),answer:String(b)});
 const P=arr=>({kind:'values',pairs:arr.map(([a,b])=>[String(a),String(b)])});
 const pt=(id,xy)=>({id,x:xy[0],y:xy[1],label:id});
 const gcd=(a,b)=>b?gcd(b,a%b):Math.abs(a);
 const fraction=(a,b)=>{const d=gcd(a,b);return `${a/d}/${b/d}`};
 const done=(q,steps,answer,verify,figure)=>{if(!figure.description||steps.length<3)throw Error('incomplete diagram question');return{question:(p.context?p.context+': ':'')+q,steps,answer:String(answer),verify,figure}};
 if(kind==='venn'){
  const {a,b,ab,out=0,mode='union'}=p; if([a,b,ab,out].some(x=>!Number.isInteger(x)||x<0))throw Error('invalid set');
  const answer=mode==='union'?a+b+ab:mode==='overlap'?ab:mode==='aTotal'?a+ab:out;
  const check=mode==='union'?`${a}+${b}+${ab}`:mode==='overlap'?`${ab}`:mode==='aTotal'?`${a}+${ab}`:`${out}`;
  const fig={type:'venn',description:`Venn diagram showing ${a} in A only, ${ab} in both, ${b} in B only and ${out} outside.`,a,b,ab,out};
  return done(`Read the Venn diagram. Find ${mode==='union'?'the size of A union B':mode==='overlap'?'the size of A intersect B':mode==='aTotal'?'the size of set A':'the count outside both sets'}.`,[`A only has ${a}, the overlap ${ab}, B only ${b} and neither ${out}.`,'Each Venn region is counted exactly once.',`The requested count is ${answer}.`],answer,V(check,answer),fig);
 }
 if(kind==='placevalue'){
  const {digits,index}=p;if(!Array.isArray(digits)||digits.length<4||digits.length>8||digits[0]===0||digits.some(n=>!Number.isInteger(n)||n<0||n>9)||index<0||index>=digits.length)throw Error('place-value');
  const power=digits.length-index-1,answer=digits[index]*10**power;
  const fig={type:'placevalue',description:`Place-value columns read left to right as ${digits.join(', ')}. The digit ${digits[index]} in the 10^${power} column is highlighted.`,digits,index};
  return done('Find the contribution of the highlighted digit in this place-value chart.',[`The full number is ${digits.join('')}.`,`The highlighted digit is ${digits[index]} in the 10^${power} column.`,`The contribution equals ${digits[index]}×10^${power}=${answer}.`],answer,V(`${digits[index]}*10^${power}`,answer),fig);
 }
 if(kind==='tape'){
  const {a,b,total,mode='first'}=p;if(![a,b,total].every(n=>Number.isInteger(n)&&n>0)||total%(a+b))throw Error('tape must have integral shares');
  const per=total/(a+b),first=per*a,second=per*b,answer=mode==='first'?first:mode==='second'?second:Math.abs(first-second);
  const expr=mode==='first'?`${a}*${total}/(${a}+${b})`:mode==='second'?`${b}*${total}/(${a}+${b})`:`abs(${a}*${total}/(${a}+${b})-${b}*${total}/(${a}+${b}))`;
  const fig={type:'tape',description:`Ratio tape showing ${a} equal shares for A and ${b} equal shares for B, total ${total} units.`,a,b,total};
  return done(`Use the marked ratio tape to find ${mode==='first'?'part A':mode==='second'?'part B':'the difference between the parts'}.`,[`There are ${a+b} equal shares in total.`,`Each share represents ${total}/(${a+b})=${per} units.`,`A=${first}, B=${second}, so the answer is ${answer}.`],`${answer} units`,V(expr,answer),fig);
 }
 if(kind==='parallel'){
  const {angle,mode='corresponding'}=p;if(!Number.isInteger(angle)||angle<=0||angle>=90)throw Error('angle');
  const answer=mode==='corresponding'?angle:180-angle;
  const fig={type:'parallel',description:`Two parallel lines crossed by a transversal; an upper acute angle is marked ${angle} degrees.`,angle};
  return done(`Find the ${mode==='corresponding'?'corresponding lower angle':'adjacent obtuse angle'} in the parallel-line construction.`,[`The drawn lines are parallel and the crossing line is a transversal.`,`Corresponding angles are equal; adjacent angles on a line sum to 180°.`,`The requested angle is ${answer}°.`],`${answer}°`,V(mode==='corresponding'?`${angle}`:`180-${angle}`,answer),fig);
 }
 if(kind==='matrix'){
  const {entries,mode='det'}=p;if(!Array.isArray(entries)||entries.length!==4||entries.some(n=>!Number.isInteger(n)))throw Error('matrix');
  const [a,b,c,d]=entries,answer=mode==='det'?a*d-b*c:mode==='trace'?a+d:a+b;
  const expr=mode==='det'?`(${a})*(${d})-(${b})*(${c})`:mode==='trace'?`(${a})+(${d})`:`(${a})+(${b})`;
  const fig={type:'matrix',description:`2 by 2 matrix: first row ${a}, ${b}; second row ${c}, ${d}.`,entries};
  return done(`Read the matrix and calculate ${mode==='det'?'its determinant':mode==='trace'?'its trace':'the sum of the top row'}.`,[`The entries in row order are ${entries.join(', ')}.`,mode==='det'?'For a 2 by 2 matrix, determinant=ad−bc.':mode==='trace'?'Trace equals the sum of the main diagonal.':'Sum the first two entries.',`The result equals ${answer}.`],answer,V(expr,answer),fig);
 }
 if(kind==='unitcircle'){
  const {deg,component='cos'}=p;
  const supported={0:['1','0'],30:['sqrt(3)/2','1/2'],45:['sqrt(2)/2','sqrt(2)/2'],60:['1/2','sqrt(3)/2'],90:['0','1'],120:['-1/2','sqrt(3)/2'],135:['-sqrt(2)/2','sqrt(2)/2'],150:['-sqrt(3)/2','1/2'],180:['-1','0'],210:['-sqrt(3)/2','-1/2'],225:['-sqrt(2)/2','-sqrt(2)/2'],240:['-1/2','-sqrt(3)/2'],270:['0','-1'],300:['1/2','-sqrt(3)/2'],315:['sqrt(2)/2','-sqrt(2)/2'],330:['sqrt(3)/2','-1/2']};
  if(!supported[deg]||!['cos','sin'].includes(component))throw Error('unit circle angle');
  const expressions=supported[deg],ans=expressions[component==='cos'?0:1];
  const fig={type:'unitcircle',description:`A unit circle with a radius at ${deg}° from the positive x-axis, showing the point corresponding to that angle.`,deg};
  return done(`Using the unit circle, find the exact value of ${component}(${deg}°).`,[`The terminal radius makes ${deg}° with the positive x-axis.`,`Its endpoint on the unit circle is (cos θ, sin θ), with the correct quadrant signs.`,`The ${component} coordinate is ${ans}.`],ans,V(ans,ans),fig);
 }
 if(kind==='sector'){
  const {r,angle,mode='area'}=p,coefficient=mode==='area'?r*r*angle/360:2*r*angle/360;
  if(!(r>0&&angle>0&&angle<360)||!Number.isInteger(coefficient))throw Error('sector must give whole π coefficient');
  const fig={type:'sector',description:`Circular sector radius ${r} and central angle ${angle} degrees, with two straight radii and arc.`,r,angle};
  return done(`Calculate the sector ${mode==='area'?'area':'arc length'}, as a multiple of π.`,[`A sector occupies ${angle}/360 of its circle.`,mode==='area'?'Area fraction of πr².':'Arc-length fraction of the circumference 2πr.',`Substituting the diagram's measurements gives ${coefficient}π.`],`${coefficient}π`,V(mode==='area'?`${r}^2*${angle}/360`:`2*${r}*${angle}/360`,coefficient),fig);
 }
 if(kind==='cuboid'){
  const {l,w,h,mode='volume'}=p;if(![l,w,h].every(Number.isInteger)||Math.min(l,w,h)<=0)throw Error('cuboid');
  const answer=mode==='volume'?l*w*h:mode==='surface'?2*(l*w+l*h+w*h):Math.sqrt(l*l+w*w+h*h);
  if(!Number.isInteger(answer))throw Error('choose exact space diagonal');
  const fig={type:'cuboid',description:`Oblique isometric cuboid with length ${l}, width ${w} and height ${h}, edges annotated.`,l,w,h};
  return done(`From the cuboid diagram calculate its ${mode==='volume'?'volume':mode==='surface'?'total surface area':'space diagonal'}.`,[`The perpendicular dimensions are ${l}, ${w} and ${h}.`,mode==='volume'?'Multiply the three edge lengths.':mode==='surface'?'Sum the three different face areas and double.':'Apply the three-dimensional Pythagorean theorem.',`The required value is ${answer}.`],answer,V(mode==='volume'?`${l}*${w}*${h}`:mode==='surface'?`2*(${l}*${w}+${l}*${h}+${w}*${h})`:`sqrt(${l}^2+${w}^2+${h}^2)`,answer),fig);
 }
 if(kind==='tree'){
  const {a,ad,sa,sad,sb,sbd,mode='total'}=p;if(![a,ad,sa,sad,sb,sbd].every(Number.isInteger)||!(a>0&&a<ad&&sa>0&&sa<sad&&sb>0&&sb<sbd))throw Error('prob tree');
  const b=ad-a,num=mode==='total'?a*sa*sbd+b*sb*sad:a*sa,den=mode==='total'?ad*sad*sbd:ad*sad,answer=fraction(num,den);
  const expr=mode==='total'?`(${a}/${ad})*(${sa}/${sad})+(${b}/${ad})*(${sb}/${sbd})`:`(${a}/${ad})*(${sa}/${sad})`;
  const fig={type:'tree',description:`Probability tree: P(A)=${a}/${ad}; P(B)=${b}/${ad}; P(S|A)=${sa}/${sad}; P(S|B)=${sb}/${sbd}.`,a,ad,sa,sad,sb,sbd};
  return done(`Find P(${mode==='total'?'success':'A and success'}) using the labelled probability tree.`,[`Branch probabilities are A=${a}/${ad}, B=${b}/${ad}.`,`Multiply along each success path to find joint probabilities.`,mode==='total'?`Add the two disjoint success paths: ${answer}.`:`Select the A-success path: ${answer}.`],answer,V(expr,`(${num})/(${den})`),fig);
 }
 if(kind==='dots'){
  const {rows,mode='total'}=p;if(!Number.isInteger(rows)||rows<2||rows>10)throw Error('triangle dots');
  const current=rows*(rows+1)/2,answer=mode==='next'?current+rows+1:current;
  const fig={type:'dots',description:`Triangular pattern of ${rows} horizontal rows with 1 through ${rows} dots, total ${current}.`,rows};
  return done(`Count ${mode==='next'?'the next triangular figure':'the shown dots'} using the dot-pattern rule.`,[`The pattern has rows of sizes 1, 2, up to ${rows}.`,`The displayed count is ${rows}(${rows}+1)/2=${current}.`,mode==='next'?`The next row adds ${rows+1}, giving ${answer}.`:`Therefore ${answer} dots are shown.`],answer,V(mode==='next'?`${rows}*(${rows}+1)/2+${rows}+1`:`${rows}*(${rows}+1)/2`,answer),fig);
 }
 if(kind==='interval'){
  const {a,b,lc=true,rc=false}=p;if(!Number.isInteger(a)||!Number.isInteger(b)||b-a<2||b-a>28)throw Error('integer interval');
  const answer=b-a-1+(lc?1:0)+(rc?1:0);
  const fig={type:'interval',description:`Number-line interval ${a} to ${b}, with ${lc?'closed':'open'} left endpoint and ${rc?'closed':'open'} right endpoint.`,a,b,lc,rc};
  return done('How many integer points are included in the highlighted interval?', [`The interval endpoints are ${a} and ${b}.`,`There are ${b-a-1} integers strictly between the endpoints.`,`Including only filled endpoints brings the total to ${answer}.`],answer,V(`(${b})-(${a})-1+${lc?1:0}+${rc?1:0}`,answer),fig);
 }
 if(kind==='linesIntersection'){
  const {m1,m2,x,y}=p;if(![m1,m2,x,y].every(Number.isInteger)||m1===m2||x<-4||x>4)throw Error('intersection');
  const b1=y-m1*x,b2=y-m2*x;
  const points=[pt('A',[-5,-5*m1+b1]),pt('B',[5,5*m1+b1]),pt('C',[-5,-5*m2+b2]),pt('D',[5,5*m2+b2]),pt('X',[x,y])];
  const fig={type:'plane',description:`Two plotted lines y=${m1}x+(${b1}) and y=${m2}x+(${b2}) meeting at labelled X(${x},${y}).`,points,segments:[['A','B'],['C','D']],pointLabels:true};
  return done('Read the two graphs and find their intersection X.',[`The two line equations are y=${m1}x+(${b1}) and y=${m2}x+(${b2}).`,`Equate these expressions and solve to get x=${x}.`,`Substitution gives y=${y}, so X=(${x},${y}).`],`(${x}, ${y})`,P([[`${m1}*(${x})+(${b1})`,y],[`${m2}*(${x})+(${b2})`,y]]),fig);
 }
 if(kind==='betweenLines'){
  const {m1,m2,end}=p;if(!Number.isInteger(m1)||!Number.isInteger(m2)||m1<=m2||m2<0||!Number.isInteger(end)||end<=0)throw Error('bounded region');
  const answer=(m1-m2)*end*end/2;
  const fig={type:'plane',description:`Two rays y=${m1}x and y=${m2}x bound a shaded triangle from x=0 to x=${end}.`,points:[pt('O',[0,0]),pt('U',[end,m1*end]),pt('L',[end,m2*end])],polygons:[{vertices:['O','U','L'],shade:true}],segments:[['O','U'],['O','L'],['U','L']]};
  return done('Calculate the area between the two graphs and the vertical boundary.',[`The vertical gap at x=${end} is (${m1}−${m2})×${end}.`,`The shaded triangle has base ${end} and height ${(m1-m2)*end}.`,`Its exact area is ${answer} square units.`],`${answer} square units`,V(`(${m1}-${m2})*${end}^2/2`,answer),fig);
 }
 throw Error('Unsupported advanced figure archetype '+kind);
}
