// Pri Learning — original diagram-first question derivations; no media downloads or answer grading.
// Questions, steps and answers are TeX ($…$, via texFormat.js); `verify` stays in engine syntax;
// figure descriptions are plain text for screen readers.
import { m, num, paren, plus, times, frac, poly, pair, piTimes, plainPoly } from './texFormat.js';

// Exact unit-circle values: engine syntax (for the receipt) and TeX (for the page).
const UNIT_TEX={'1':'1','0':'0','-1':'-1','1/2':'\\tfrac{1}{2}','-1/2':'-\\tfrac{1}{2}','sqrt(2)/2':'\\tfrac{\\sqrt{2}}{2}','-sqrt(2)/2':'-\\tfrac{\\sqrt{2}}{2}','sqrt(3)/2':'\\tfrac{\\sqrt{3}}{2}','-sqrt(3)/2':'-\\tfrac{\\sqrt{3}}{2}'};

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
  const want=mode==='union'?m('n(A\\cup B)'):mode==='overlap'?m('n(A\\cap B)'):mode==='aTotal'?`the size of set ${m('A')}`:'the count outside both sets';
  const last=mode==='union'?`${m(`n(A\\cup B)=${a}+${ab}+${b}=${answer}`)}`:mode==='aTotal'?`${m(`n(A)=${a}+${ab}=${answer}`)}`:`the requested count is ${m(answer)}`;
  return done(`Read the Venn diagram. Find ${want}.`,[`${m('A')} only has ${m(a)}, the overlap ${m(ab)}, ${m('B')} only ${m(b)} and neither ${m(out)}.`,'Each region of the diagram is counted exactly once.',`So ${last}.`],m(answer),V(check,answer),fig);
 }
 if(kind==='placevalue'){
  const {digits,index}=p;if(!Array.isArray(digits)||digits.length<4||digits.length>8||digits[0]===0||digits.some(n=>!Number.isInteger(n)||n<0||n>9)||index<0||index>=digits.length)throw Error('place-value');
  const power=digits.length-index-1,answer=digits[index]*10**power;
  const fig={type:'placevalue',description:`Place-value columns read left to right as ${digits.join(', ')}. The digit ${digits[index]} in the 10^${power} column is highlighted.`,digits,index};
  return done('Find the value of the highlighted digit in this place-value chart.',[`The full number is ${m(digits.join(''))}.`,`The highlighted digit is ${m(digits[index])}, in the ${m(`10^{${power}}`)} column.`,`Its value is ${m(`${digits[index]}\\times 10^{${power}}=${answer}`)}.`],m(answer),V(`${digits[index]}*10^${power}`,answer),fig);
 }
 if(kind==='tape'){
  const {a,b,total,mode='first'}=p;if(![a,b,total].every(n=>Number.isInteger(n)&&n>0)||total%(a+b))throw Error('tape must have integral shares');
  const per=total/(a+b),first=per*a,second=per*b,answer=mode==='first'?first:mode==='second'?second:Math.abs(first-second);
  const expr=mode==='first'?`${a}*${total}/(${a}+${b})`:mode==='second'?`${b}*${total}/(${a}+${b})`:`abs(${a}*${total}/(${a}+${b})-${b}*${total}/(${a}+${b}))`;
  const fig={type:'tape',description:`Ratio tape showing ${a} equal shares for A and ${b} equal shares for B, total ${total} units.`,a,b,total};
  return done(`Use the marked ratio tape to find ${mode==='first'?`part ${m('A')}`:mode==='second'?`part ${m('B')}`:'the difference between the parts'}.`,[`There are ${m(`${a}+${b}=${a+b}`)} equal shares in total.`,`Each share is ${m(`\\tfrac{${total}}{${a+b}}=${per}`)} units.`,`${m(`A=${a}\\times ${per}=${first}`)} and ${m(`B=${b}\\times ${per}=${second}`)}, so the answer is ${m(answer)}.`],`${m(answer)} units`,V(expr,answer),fig);
 }
 if(kind==='parallel'){
  const {angle,mode='corresponding'}=p;if(!Number.isInteger(angle)||angle<=0||angle>=90)throw Error('angle');
  const answer=mode==='corresponding'?angle:180-angle;
  const fig={type:'parallel',description:`Two parallel lines crossed by a transversal; an upper acute angle is marked ${angle} degrees.`,angle};
  return done(`Find the ${mode==='corresponding'?'corresponding lower angle':'adjacent obtuse angle'} in the parallel-line figure.`,[`The two drawn lines are parallel and the crossing line is a transversal.`,mode==='corresponding'?`Corresponding angles are equal, so the lower angle is also ${m(`${angle}^\\circ`)}.`:`Adjacent angles on a straight line add to ${m('180^\\circ')}.`,mode==='corresponding'?`The requested angle is ${m(`${answer}^\\circ`)}.`:`The requested angle is ${m(`180^\\circ-${angle}^\\circ=${answer}^\\circ`)}.`],m(`${answer}^\\circ`),V(mode==='corresponding'?`${angle}`:`180-${angle}`,answer),fig);
 }
 if(kind==='matrix'){
  const {entries,mode='det'}=p;if(!Array.isArray(entries)||entries.length!==4||entries.some(n=>!Number.isInteger(n)))throw Error('matrix');
  const [a,b,c,d]=entries,answer=mode==='det'?a*d-b*c:mode==='trace'?a+d:a+b;
  const expr=mode==='det'?`(${a})*(${d})-(${b})*(${c})`:mode==='trace'?`(${a})+(${d})`:`(${a})+(${b})`;
  const fig={type:'matrix',description:`2 by 2 matrix: first row ${a}, ${b}; second row ${c}, ${d}.`,entries};
  const M=`\\begin{pmatrix}${a}&${b}\\\\${c}&${d}\\end{pmatrix}`;
  const work=mode==='det'?`${m(`\\det=${times(a,d)}-${paren(b)}\\times ${paren(c)}=${answer}`)}`:mode==='trace'?`${m(`${plus(a,d)}=${answer}`)}`:`${m(`${plus(a,b)}=${answer}`)}`;
  return done(`Read the matrix and calculate ${mode==='det'?'its determinant':mode==='trace'?'its trace':'the sum of the top row'}.`,[`The matrix is ${m(M)}.`,mode==='det'?`For a ${m('2\\times 2')} matrix, ${m('\\det=ad-bc')}.`:mode==='trace'?'The trace is the sum of the main diagonal.':'Add the two entries in the first row.',`The result is ${work}.`],m(answer),V(expr,answer),fig);
 }
 if(kind==='unitcircle'){
  const {deg,component='cos'}=p;
  const supported={0:['1','0'],30:['sqrt(3)/2','1/2'],45:['sqrt(2)/2','sqrt(2)/2'],60:['1/2','sqrt(3)/2'],90:['0','1'],120:['-1/2','sqrt(3)/2'],135:['-sqrt(2)/2','sqrt(2)/2'],150:['-sqrt(3)/2','1/2'],180:['-1','0'],210:['-sqrt(3)/2','-1/2'],225:['-sqrt(2)/2','-sqrt(2)/2'],240:['-1/2','-sqrt(3)/2'],270:['0','-1'],300:['1/2','-sqrt(3)/2'],315:['sqrt(2)/2','-sqrt(2)/2'],330:['sqrt(3)/2','-1/2']};
  if(!supported[deg]||!['cos','sin'].includes(component))throw Error('unit circle angle');
  const expressions=supported[deg],ans=expressions[component==='cos'?0:1],tex=UNIT_TEX[ans];
  const fig={type:'unitcircle',description:`A unit circle with a radius at ${deg} degrees from the positive x-axis, showing the point for that angle.`,deg};
  return done(`Using the unit circle, find the exact value of ${m(`\\${component}(${deg}^\\circ)`)}.`,[`The radius makes ${m(`${deg}^\\circ`)} with the positive ${m('x')}-axis.`,`Its endpoint on the unit circle is ${m('(\\cos\\theta, \\sin\\theta)')}, with the signs of its quadrant.`,`The ${component==='cos'?m('x'):m('y')}-coordinate is ${m(tex)}, so ${m(`\\${component}(${deg}^\\circ)=${tex}`)}.`],m(tex),V(ans,ans),fig);
 }
 if(kind==='sector'){
  const {r,angle,mode='area'}=p,coefficient=mode==='area'?r*r*angle/360:2*r*angle/360;
  if(!(r>0&&angle>0&&angle<360)||!Number.isInteger(coefficient))throw Error('sector must give whole π coefficient');
  const fig={type:'sector',description:`Circular sector with radius ${r} and central angle ${angle} degrees, drawn with its two radii and arc.`,r,angle};
  const ans=piTimes(coefficient);
  return done(`Calculate the sector ${mode==='area'?'area':'arc length'} as a multiple of ${m('\\pi')}.`,[`The sector is ${m(`\\tfrac{${angle}}{360}`)} of its circle.`,mode==='area'?`Its area is that fraction of ${m('\\pi r^2')}.`:`Its arc length is that fraction of the circumference ${m('2\\pi r')}.`,mode==='area'?`${m(`\\tfrac{${angle}}{360}\\times\\pi\\times ${r}^2=${ans}`)}.`:`${m(`\\tfrac{${angle}}{360}\\times 2\\pi\\times ${r}=${ans}`)}.`],m(ans),V(mode==='area'?`${r}^2*${angle}/360`:`2*${r}*${angle}/360`,coefficient),fig);
 }
 if(kind==='cuboid'){
  const {l,w,h,mode='volume'}=p;if(![l,w,h].every(Number.isInteger)||Math.min(l,w,h)<=0)throw Error('cuboid');
  const answer=mode==='volume'?l*w*h:mode==='surface'?2*(l*w+l*h+w*h):Math.sqrt(l*l+w*w+h*h);
  if(!Number.isInteger(answer))throw Error('choose exact space diagonal');
  const fig={type:'cuboid',description:`Cuboid drawn in perspective with length ${l}, width ${w} and height ${h}, edges labelled.`,l,w,h};
  const work=mode==='volume'?`${l}\\times ${w}\\times ${h}=${answer}`:mode==='surface'?`2(${l}\\times ${w}+${l}\\times ${h}+${w}\\times ${h})=${answer}`:`\\sqrt{${l}^2+${w}^2+${h}^2}=\\sqrt{${l*l+w*w+h*h}}=${answer}`;
  return done(`From the cuboid diagram calculate its ${mode==='volume'?'volume':mode==='surface'?'total surface area':'space diagonal'}.`,[`The three edge lengths are ${m(l)}, ${m(w)} and ${m(h)}.`,mode==='volume'?'Multiply the three edge lengths.':mode==='surface'?'Add the three different face areas and double the sum.':'Use Pythagoras in three dimensions.',`${m(work)}.`],m(answer),V(mode==='volume'?`${l}*${w}*${h}`:mode==='surface'?`2*(${l}*${w}+${l}*${h}+${w}*${h})`:`sqrt(${l}^2+${w}^2+${h}^2)`,answer),fig);
 }
 if(kind==='tree'){
  const {a,ad,sa,sad,sb,sbd,mode='total'}=p;if(![a,ad,sa,sad,sb,sbd].every(Number.isInteger)||!(a>0&&a<ad&&sa>0&&sa<sad&&sb>0&&sb<sbd))throw Error('prob tree');
  const b=ad-a,num_=mode==='total'?a*sa*sbd+b*sb*sad:a*sa,den=mode==='total'?ad*sad*sbd:ad*sad,answer=fraction(num_,den),ansTex=frac(num_,den);
  const expr=mode==='total'?`(${a}/${ad})*(${sa}/${sad})+(${b}/${ad})*(${sb}/${sbd})`:`(${a}/${ad})*(${sa}/${sad})`;
  const fig={type:'tree',description:`Probability tree: P(A) = ${a}/${ad}; P(B) = ${b}/${ad}; P(S given A) = ${sa}/${sad}; P(S given B) = ${sb}/${sbd}.`,a,ad,sa,sad,sb,sbd};
  const f=(x,y)=>`\\tfrac{${x}}{${y}}`;
  return done(`Find ${m(mode==='total'?'P(S)':'P(A\\cap S)')}, the probability of ${mode==='total'?'success':m('A')+' and success'}, using the labelled probability tree.`,[`The first branches are ${m(`P(A)=${f(a,ad)}`)} and ${m(`P(B)=${f(b,ad)}`)}.`,`Multiply along a path to find the probability of reaching its end.`,mode==='total'?`Add the two success paths: ${m(`${f(a,ad)}\\times ${f(sa,sad)}+${f(b,ad)}\\times ${f(sb,sbd)}=${ansTex}`)}.`:`Take the path through ${m('A')} to success: ${m(`${f(a,ad)}\\times ${f(sa,sad)}=${ansTex}`)}.`],m(ansTex),V(expr,`(${num_})/(${den})`),fig);
 }
 if(kind==='dots'){
  const {rows,mode='total'}=p;if(!Number.isInteger(rows)||rows<2||rows>10)throw Error('triangle dots');
  const current=rows*(rows+1)/2,answer=mode==='next'?current+rows+1:current;
  const fig={type:'dots',description:`Triangular pattern of ${rows} rows holding 1 to ${rows} dots, ${current} dots in all.`,rows};
  return done(`Count ${mode==='next'?'the dots in the next triangular figure':'the dots shown'} using the pattern rule.`,[`The rows hold ${m(`1, 2, \\ldots, ${rows}`)} dots.`,`The figure shown has ${m(`\\tfrac{${rows}\\times ${rows+1}}{2}=${current}`)} dots.`,mode==='next'?`The next figure adds a row of ${m(rows+1)}, giving ${m(`${current}+${rows+1}=${answer}`)}.`:`So ${m(answer)} dots are shown.`],m(answer),V(mode==='next'?`${rows}*(${rows}+1)/2+${rows}+1`:`${rows}*(${rows}+1)/2`,answer),fig);
 }
 if(kind==='pascal'){
  const {n,k,mode='coefficient'}=p;
  if(!Number.isInteger(n)||n<3||n>8||!Number.isInteger(k)||k<0||k>n)throw Error('Pascal coefficients require 0≤k≤n');
  const factorial=m=>Array.from({length:m},(_,i)=>i+1).reduce((a,b)=>a*b,1);
  const binom=factorial(n)/(factorial(k)*factorial(n-k));
  const answer=mode==='rowSum'?2**n:binom;
  const numer=Array.from({length:k},(_,i)=>n-i);
  const denom=Array.from({length:k},(_,i)=>i+1);
  const expr=mode==='rowSum'?`2^${n}`:k?numer.join('*')+'/('+denom.join('*')+')':'1';
  const fig={type:'pascal',description:`Pascal's triangle down to row ${n}, with entry ${k} of row ${n} highlighted. Each entry is the sum of the two above it.`,n,k,mode};
  return done(`Using the labelled Pascal triangle, find ${mode==='rowSum'?`the sum of all the coefficients in row ${m(n)}`:`the binomial coefficient ${m(`\\binom{${n}}{${k}}`)}`}.`,[`Row ${m(n)} of Pascal's triangle gives the coefficients of ${m(`(a+b)^{${n}}`)}.`,mode==='rowSum'?`Putting ${m('a=b=1')}, their sum is ${m(`(1+1)^{${n}}=2^{${n}}`)}.`:`The entry is ${m(`\\binom{${n}}{${k}}=\\tfrac{${n}!}{${k}!\\,${n-k}!}`)}.`,`The exact result is ${m(answer)}.`],m(answer),V(expr,answer),fig);
 }
 if(kind==='interval'){
  const {a,b,lc=true,rc=false}=p;if(!Number.isInteger(a)||!Number.isInteger(b)||b-a<2||b-a>28)throw Error('integer interval');
  const answer=b-a-1+(lc?1:0)+(rc?1:0);
  const fig={type:'interval',description:`Number-line interval from ${a} to ${b}, with ${lc?'closed':'open'} left endpoint and ${rc?'closed':'open'} right endpoint.`,a,b,lc,rc};
  const ends=(lc?1:0)+(rc?1:0);
  return done('How many integers are included in the highlighted interval?', [`The endpoints are ${m(a)} and ${m(b)}.`,`There are ${m(b-a-1)} integers strictly between them.`,ends?`Adding the ${ends===2?'two filled endpoints':'filled endpoint'} gives ${m(answer)}.`:`Both endpoints are open, so the total stays ${m(answer)}.`],m(answer),V(`(${b})-(${a})-1+${lc?1:0}+${rc?1:0}`,answer),fig);
 }
 if(kind==='linesIntersection'){
  const {m1,m2,x,y}=p;if(![m1,m2,x,y].every(Number.isInteger)||m1===m2||x<-4||x>4)throw Error('intersection');
  const b1=y-m1*x,b2=y-m2*x;
  const points=[pt('A',[-5,-5*m1+b1]),pt('B',[5,5*m1+b1]),pt('C',[-5,-5*m2+b2]),pt('D',[5,5*m2+b2]),pt('X',[x,y])];
  const L1=poly([[m1,'x'],[b1,'']]),L2=poly([[m2,'x'],[b2,'']]);
  const fig={type:'plane',description:`Two lines y = ${plainPoly([[m1,'x'],[b1,'']])} and y = ${plainPoly([[m2,'x'],[b2,'']])} meeting at the labelled point X(${x}, ${y}).`,points,segments:[['A','B'],['C','D']],pointLabels:true};
  return done(`Read the two graphs and find their intersection ${m('X')}.`,[`The two lines are ${m(`y=${L1}`)} and ${m(`y=${L2}`)}.`,`Set ${m(`${L1}=${L2}`)} and solve: ${m(`x=${x}`)}.`,`Substituting gives ${m(`y=${y}`)}, so ${m('X='+pair(x,y))}.`],m(pair(x,y)),P([[`${m1}*(${x})+(${b1})`,y],[`${m2}*(${x})+(${b2})`,y]]),fig);
 }
 if(kind==='betweenLines'){
  const {m1,m2,end}=p;if(!Number.isInteger(m1)||!Number.isInteger(m2)||m1<=m2||m2<0||!Number.isInteger(end)||end<=0)throw Error('bounded region');
  const answer=(m1-m2)*end*end/2;
  const fig={type:'plane',description:`Two lines y = ${plainPoly([[m1,'x']])} and y = ${plainPoly([[m2,'x']])} from the origin bound a shaded triangle from x = 0 to x = ${end}.`,points:[pt('O',[0,0]),pt('U',[end,m1*end]),pt('L',[end,m2*end])],polygons:[{vertices:['O','U','L'],shade:true}],segments:[['O','U'],['O','L'],['U','L']]};
  return done('Calculate the area between the two graphs and the vertical boundary.',[`The vertical gap at ${m(`x=${end}`)} is ${m(`(${m1}-${m2})\\times ${end}=${(m1-m2)*end}`)}.`,`The shaded triangle has base ${m(end)} and height ${m((m1-m2)*end)}.`,`Its area is ${m(`\\tfrac{1}{2}\\times ${end}\\times ${(m1-m2)*end}=${num(answer)}`)} square units.`],`${m(num(answer))} square units`,V(`(${m1}-${m2})*${end}^2/2`,answer),fig);
 }
 if(kind==='squareGrid'){
  const {n}=p;if(!Number.isInteger(n)||n<3||n>12)throw Error('square-grid order');
  const fig={type:'square-grid',description:`A square array of ${n} rows and ${n} columns of unit tiles, ${n*n} tiles in all.`,n};
  return done('Find the side length of the square array shown, if each small tile has side 1 unit.',[`The array has ${m(n*n)} identical unit-square tiles.`,`A square of side ${m('s')} holds ${m('s^2')} tiles, so ${m(`s^2=${n*n}`)}.`,`The positive square root is ${m(`s=\\sqrt{${n*n}}=${n}`)}.`],m(n),V(`sqrt(${n*n})`,n),fig);
 }
 if(kind==='cubeGrid'){
  const {n}=p;if(!Number.isInteger(n)||n<2||n>7)throw Error('cube-grid order');
  const volume=n*n*n,fig={type:'cube-grid',description:`A solid cube built from unit cubes, ${n} along each edge, ${volume} unit cubes in all.`,n};
  return done(`A solid cube made of ${m(volume)} identical unit cubes is shown. How many unit cubes lie along one edge?`,[`All three edges of a cube hold the same number ${m('n')} of unit cubes.`,`The count is ${m(`n^3=${volume}`)}.`,`Its cube root is ${m(`n=\\sqrt[3]{${volume}}=${n}`)} cubes along each edge.`],m(n),{kind:'roots',f:`x^3-${volume}`,answers:[String(n)],degree:3},fig);
 }
 if(kind==='algebraArea'){
  const {a,b}=p;if(![a,b].every(Number.isInteger)||a<=0||b<=0||a>9||b>9)throw Error('area model strips');
  const total=a+b,constant=a*b;
  const fig={type:'algebra-area',description:`An area model splitting a rectangle with sides x + ${a} and x + ${b} into four labelled parts: x^2, ${plainPoly([[a,'x']])}, ${plainPoly([[b,'x']])} and ${constant}.`,a,b};
  return done(`Use the partitioned rectangle to factorise ${m(poly([[1,'x^2'],[total,'x'],[constant,'']]))}.`,[`The horizontal side is ${m(`x+${a}`)} and the vertical side is ${m(`x+${b}`)}.`,`The four parts have areas ${m('x^2')}, ${m(poly([[a,'x']]))}, ${m(poly([[b,'x']]))} and ${m(constant)}.`,`Their sum is ${m(poly([[1,'x^2'],[total,'x'],[constant,'']]))}, which factorises as ${m(`(x+${a})(x+${b})`)}.`],m(`(x+${a})(x+${b})`),P([[`${a}+${b}`,total],[`${a}*${b}`,constant],[`(2+${a})*(2+${b})`,`2^2+${total}*2+${constant}`],[`(-1+${a})*(-1+${b})`,`(-1)^2+${total}*(-1)+${constant}`]]),fig);
 }
 if(kind==='primeBars'){
  const {A,B}=p;
  if(!Array.isArray(A)||!Array.isArray(B)||A.length!==3||B.length!==3||[...A,...B].some(n=>!Number.isInteger(n)||n<0||n>5))throw Error('prime power diagrams');
  const power=[2,3,5],used=A.map((x,i)=>Math.max(x,B[i])),value=used.reduce((prod,e,i)=>prod*power[i]**e,1);
  const fig={type:'prime-bars',description:`Prime exponent columns for A and B: prime 2 exponents ${A[0]} and ${B[0]}; prime 3 exponents ${A[1]} and ${B[1]}; prime 5 exponents ${A[2]} and ${B[2]}.`,A,B};
  const factors=power.map((q,i)=>used[i]===0?'':used[i]===1?String(q):`${q}^{${used[i]}}`).filter(Boolean);
  return done(`Find ${m('\\operatorname{LCM}(A,B)')} from the prime-power bar chart.`,[`The chart compares the powers of ${m('2')}, ${m('3')} and ${m('5')} in ${m('A')} and ${m('B')}.`,`For each prime take the larger exponent: ${m(used.join(', '))}.`,`${m(`\\operatorname{LCM}=${factors.length?factors.join('\\times '):'1'}=${value}`)}.`],m(value),V(`2^${used[0]}*3^${used[1]}*5^${used[2]}`,value),fig);
 }
 if(kind==='slopeField'){
  const {m:k,c}=p;if(!Number.isInteger(k)||k<=0||k>4||!Number.isInteger(c)||Math.abs(c)>3)throw Error('slope field');
  const answer=2*k+c,fig={type:'slope-field',description:`Slope field for dy/dx = ${plainPoly([[k,'x']])} with a highlighted solution through the starting point (0, ${c}).`,m:k,c};
  const half=poly([[k,'x^2',2]]);
  return done(`The slope field satisfies ${m(`\\tfrac{dy}{dx}=${poly([[k,'x']])}`)}, and the highlighted curve passes through ${m(`y(0)=${c}`)}. Find ${m('y(2)')}.`,[`Integrating ${m(`\\tfrac{dy}{dx}=${poly([[k,'x']])}`)} gives ${m(`y=${half}+C`)}.`,`The marked starting point ${m(pair(0,c))} fixes ${m(`C=${c}`)}.`,`At ${m('x=2')}, ${m(`y(2)=${frac(k,2)==='1'?'':frac(k,2)+'\\times '}2^2${c?(c<0?'-'+(-c):'+'+c):''}=${answer}`)}.`],m(answer),V(`${k}/2*2^2+(${c})`,answer),fig);
 }
 throw Error('Unsupported advanced figure archetype '+kind);
}
