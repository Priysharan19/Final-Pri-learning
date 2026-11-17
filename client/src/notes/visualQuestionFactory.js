// Diagram geometry, plotted data and arithmetic are the single structured source of truth.
// Notes are study examples, not authenticated grading items. No copied question artwork.
// Questions, steps and answers are TeX ($…$, via texFormat.js); `verify` stays in engine syntax;
// figure descriptions are plain text for screen readers.
import { m, num, paren, sq, plus, minus, times, frac, ratio, surd, poly, shiftParen, pair, text, plainPoly, plainShift, plainPair } from './texFormat.js';

export function makeVisualExample(kind,p){
  const round=n=>Number(n.toFixed(6)), val=(expr,answer)=>({kind:'value',expr:String(expr),answer:String(answer)}), pairs=items=>({kind:'values',pairs:items.map(([a,b])=>[String(a),String(b)])});
  const pt=(id,xy)=>({id,x:xy[0],y:xy[1],label:id});
  const diagram=(type,description,points,extra={})=>({type,description,points,grid:type==='plane',...extra});
  const done=(question,steps,answer,verify,figure)=>{
    if(!steps.length||!figure?.description||!verify)throw Error('Incomplete visual question');
    return {question:(p.context?p.context+': ':'')+question,steps,answer:String(answer),verify,figure};
  };
  const P=xy=>pair(xy[0],xy[1]), plainP=xy=>plainPair(xy[0],xy[1]);
  // √s written exactly, simplified when it can be, with a 2 d.p. value when it is irrational.
  const root=(s,len)=>{const e=surd(s),r=`\\sqrt{${s}}`;return {chain:r+(e===r?'':'='+e)+(Number.isInteger(len)?'':`\\approx ${num(Math.round(len*100)/100)}`),value:Number.isInteger(len)?e:`${e}\\approx ${num(Math.round(len*100)/100)}`};};
  if(kind==='gradient'){
    const {A,B}=p,dx=B[0]-A[0],dy=B[1]-A[1];if(!dx)throw Error('vertical gradient');
    const g=frac(dy,dx);
    return done(`Read the graph and calculate the gradient of segment ${m('AB')}.`,[`The labelled points are ${m('A'+P(A))} and ${m('B'+P(B))}.`,`Rise ${m(`=${minus(B[1],A[1])}=${num(dy)}`)}; run ${m(`=${minus(B[0],A[0])}=${num(dx)}`)}.`,`Gradient ${m(`=\\tfrac{\\text{rise}}{\\text{run}}=\\tfrac{${num(dy)}}{${num(dx)}}${g===`\\tfrac{${num(dy)}}{${num(dx)}}`?'':'='+g}`)}.`],m(g),val(`(${dy})/(${dx})`,round(dy/dx)),diagram('plane',`Segment from A${plainP(A)} to B${plainP(B)}`,[pt('A',A),pt('B',B)],{segments:[['A','B']]}));
  }
  if(kind==='midpoint'){
    const {A,B}=p,x=round((A[0]+B[0])/2),y=round((A[1]+B[1])/2);
    return done(`Find the midpoint of the plotted segment ${m('AB')}.`,[`Read ${m('A'+P(A))} and ${m('B'+P(B))}.`,`Average the ${m('x')}-coordinates: ${m(`\\tfrac{${plus(A[0],B[0])}}{2}=${num(x)}`)}.`,`Average the ${m('y')}-coordinates: ${m(`\\tfrac{${plus(A[1],B[1])}}{2}=${num(y)}`)}.`],m(pair(x,y)),pairs([[`(${A[0]}+${B[0]})/2`,x],[`(${A[1]}+${B[1]})/2`,y]]),diagram('plane',`Line segment with endpoints A${plainP(A)} and B${plainP(B)}`,[pt('A',A),pt('B',B)],{segments:[['A','B']]}));
  }
  if(kind==='distance'){
    const {A,B}=p,dx=B[0]-A[0],dy=B[1]-A[1],s=dx*dx+dy*dy,len=round(Math.sqrt(s));
    const rt=root(s,len);
    return done(`Find the length of segment ${m('AB')} using the coordinate graph.`,[`The horizontal displacement is ${m(num(dx))} and the vertical displacement is ${m(num(dy))}.`,`By Pythagoras, ${m(`AB^2=${sq(dx)}+${sq(dy)}=${s}`)}.`,`So ${m(`AB=${rt.chain}`)}.`],`${m(rt.value)} units`,val(`sqrt((${dx})^2+(${dy})^2)`,len),diagram('plane',`Segment A${plainP(A)} to B${plainP(B)}`,[pt('A',A),pt('B',B)],{segments:[['A','B']]}));
  }
  if(kind==='triangleArea'){
    const {A,B,C}=p,det=(B[0]-A[0])*(C[1]-A[1])-(B[1]-A[1])*(C[0]-A[0]),area=round(Math.abs(det)/2);if(!area)throw Error('degenerate');
    return done(`Determine the area of triangle ${m('ABC')} from its drawn coordinates.`,[`The plotted vertices are ${m('A'+P(A))}, ${m('B'+P(B))} and ${m('C'+P(C))}.`,`Twice the signed area is ${m(`(x_B-x_A)(y_C-y_A)-(y_B-y_A)(x_C-x_A)=${times(B[0]-A[0],C[1]-A[1])}-${paren(B[1]-A[1])}\\times ${paren(C[0]-A[0])}=${det}`)}.`,`The area is half its absolute value: ${m(`\\tfrac{|${det}|}{2}=${num(area)}`)}.`],`${m(num(area))} square units`,val(`abs((${B[0]-A[0]})*(${C[1]-A[1]})-(${B[1]-A[1]})*(${C[0]-A[0]}))/2`,area),diagram('plane',`Triangle with vertices A${plainP(A)}, B${plainP(B)}, C${plainP(C)}`,[pt('A',A),pt('B',B),pt('C',C)],{polygons:[{vertices:['A','B','C'],shade:true}]}));
  }
  if(['barSum','barMean','barProb','barDifference'].includes(kind)){
    const {labels,values}=p;
    if(!Array.isArray(labels)||labels.length<3||labels.length!==values.length||values.some(x=>!Number.isInteger(x)||x<0))throw Error('bad bars');
    const total=values.reduce((a,b)=>a+b,0),mean=round(total/values.length),large=Math.max(...values),small=Math.min(...values),fig={type:'bars',description:labels.map((label,i)=>`${label}: ${values[i]}`).join('; '),labels,values};
    const sum=values.join('+');
    if(kind==='barSum')return done('Use every bar to calculate the total frequency.',[`Read the bars: ${labels.map((x,i)=>`${x}: ${m(values[i])}`).join('; ')}.`,`Add the frequencies: ${m(sum)}.`,`The total is ${m(total)}.`],m(total),val(sum,total),fig);
    if(kind==='barMean')return done('Calculate the mean of the bar heights (one height per category).',[`The ${m(values.length)} heights are ${m(values.join(', '))}.`,`Their sum is ${m(`${sum}=${total}`)}.`,`Mean ${m(`=\\tfrac{${total}}{${values.length}}=${ratio(total,values.length)}`)}.`],m(ratio(total,values.length)),val(`(${sum})/${values.length}`,mean),fig);
    if(kind==='barDifference')return done('By how much does the tallest bar exceed the shortest?',[`The tallest bar has height ${m(large)}.`,`The shortest bar has height ${m(small)}.`,`Difference ${m(`=${large}-${small}=${large-small}`)}.`],m(large-small),val(`${large}-${small}`,large-small),fig);
    const i=labels.indexOf(p.favourable);if(i<0||!total)throw Error('bad favourable');
    const count=values[i],fraction=round(count/total),f=frac(count,total);
    return done(`One recorded item is chosen at random. Find ${m(`P(${text(p.favourable)})`)}.`,[`The chosen category has frequency ${m(count)}.`,`The total frequency is ${m(total)}.`,`Probability ${m(`=\\tfrac{${count}}{${total}}${f===`\\tfrac{${count}}{${total}}`?'':'='+f}`)}.`],m(f),val(`${count}/${total}`,fraction),fig);
  }
  if(kind==='lineIntercept'){
    const {m:k,b}=p,A=[-3,-3*k+b],B=[3,3*k+b],line=poly([[k,'x'],[b,'']]);
    return done(`Determine the ${m('y')}-intercept from the straight-line graph.`,[`The ${m('y')}-axis is the line ${m('x=0')}.`,`The plotted line is ${m(`y=${line}`)}.`,`At ${m('x=0')}, ${m(`y=${b}`)}, so the intercept is ${m(b)}.`],m(b),val(`${k}*0+(${b})`,b),diagram('plane',`Straight line y = ${plainPoly([[k,'x'],[b,'']])} drawn from ${plainP(A)} to ${plainP(B)}; y-intercept ${b}`,[pt('P',A),pt('Q',B)],{segments:[['P','Q']],pointLabels:false}));
  }
  if(kind==='parabolaVertex'){
    const {a,h,k}=p;if(!a)throw Error('not parabola');
    const b=-2*a*h,c=a*h*h+k;
    return done(`Read the vertex ${m('V')} and the axis of symmetry of the parabola.`,[`The turning point on the graph is ${m('V'+pair(h,k))}.`,`In vertex form ${m(`y=${poly([[a,shiftParen('x',h)+'^2'],[k,'']])}`)}, the square is zero at ${m(`x=${h}`)}.`,`The axis of symmetry is ${m(`x=${h}`)}, and ${m(k)} is the ${a>0?'minimum':'maximum'} value.`],`${m('V='+pair(h,k))}; axis ${m(`x=${h}`)}`,pairs([[`${a}*((${h})-(${h}))^2+(${k})`,k],[`(${b})^2-4*(${a})*(${c})`,-4*a*k]]),diagram('plane',`Parabola y = ${plainPoly([[a,'x^2'],[b,'x'],[c,'']])} with vertex V${plainPair(h,k)}`,[pt('V',[h,k])],{curves:[{type:'quadratic',a,b,c,xmin:h-3,xmax:h+3}]}));
  }
  if(kind==='rightTriangle'){
    const {u,v}=p;if(!(u>0&&v>0))throw Error('legs');
    const sq2=u*u+v*v,len=round(Math.sqrt(sq2)),rt=root(sq2,len);
    const fig=diagram('geometry',`Right triangle A(0, 0), B(${u}, 0), C(0, ${v}) with AB = ${u} and AC = ${v}`,[pt('A',[0,0]),pt('B',[u,0]),pt('C',[0,v])],{segments:[['A','B'],['B','C'],['C','A']],sideLabels:[{a:'A',b:'B',text:String(u)},{a:'A',b:'C',text:String(v)}],rightAngles:['A']});
    return done(`Using the labelled perpendicular sides, find the hypotenuse ${m('BC')}.`,[`Angle ${m('A')} is a right angle, so ${m('BC^2=AB^2+AC^2')}.`,`From the diagram, ${m(`BC^2=${u}^2+${v}^2=${sq2}`)}.`,`Hence ${m(`BC=${rt.chain}`)}.`],`${m(rt.value)} units`,val(`sqrt(${u}^2+${v}^2)`,len),fig);
  }
  if(kind==='circleChord'){
    const {r,d}=p,half=Math.sqrt(r*r-d*d);if(!(r>d&&d>0&&Number.isInteger(half)))throw Error('needs Pythagorean pair');
    const fig=diagram('geometry',`Circle with centre O(0, 0) and radius ${r}; chord AB with perpendicular OM = ${d}, A(${d}, ${half}), B(${d}, ${-half})`,[pt('O',[0,0]),pt('M',[d,0]),pt('A',[d,half]),pt('B',[d,-half])],{circles:[{cx:0,cy:0,r}],segments:[['A','B'],['O','M'],['O','A'],['M','A']],sideLabels:[{a:'O',b:'M',text:String(d)},{a:'O',b:'A',text:String(r)}],rightAngles:['M']});
    return done(`The segment ${m('OM')} from the centre is perpendicular to the chord ${m('AB')}. Find the length of the whole chord from the marked dimensions.`,[`Triangle ${m('OMA')} is right-angled, with radius ${m(`OA=${r}`)} and distance ${m(`OM=${d}`)}.`,`Half the chord is ${m(`AM=\\sqrt{${r}^2-${d}^2}=${half}`)}.`,`So the chord is ${m(`AB=2\\times ${half}=${2*half}`)}.`],`${m(2*half)} units`,val(`2*sqrt(${r}^2-${d}^2)`,2*half),fig);
  }
  if(kind==='vectors'){
    const {u,v}=p,dot=u[0]*v[0]+u[1]*v[1];
    return done('Find the dot product of the two arrows shown on the grid.',[`Read ${m('\\mathbf{u}='+P(u))} and ${m('\\mathbf{v}='+P(v))} from the arrow tips.`,`${m(`\\mathbf{u}\\cdot\\mathbf{v}=${times(u[0],v[0])}+${paren(u[1])}\\times ${paren(v[1])}`)}.`,`The dot product is ${m(dot)}.`],m(dot),val(`(${u[0]})*(${v[0]})+(${u[1]})*(${v[1]})`,dot),diagram('plane',`Vectors u = ${plainP(u)} and v = ${plainP(v)} drawn from the origin O`,[pt('O',[0,0]),pt('u',u),pt('v',v)],{segments:[['O','u'],['O','v']],arrows:[['O','u'],['O','v']]}));
  }
  if(kind==='trapezoid'){
    const {bottom,top,height}=p;if(!(bottom>top&&top>0&&height>0))throw Error('trapezium');
    const area=round((bottom+top)*height/2),fig=diagram('geometry',`Trapezium ABCD; parallel sides AB = ${bottom} and CD = ${top}, height DA = ${height}`,[pt('A',[0,0]),pt('B',[bottom,0]),pt('C',[top,height]),pt('D',[0,height])],{polygons:[{vertices:['A','B','C','D'],shade:true}],segments:[['A','B'],['B','C'],['C','D'],['D','A']],sideLabels:[{a:'A',b:'B',text:String(bottom)},{a:'D',b:'C',text:String(top)},{a:'D',b:'A',text:String(height)}],rightAngles:['A']});
    return done('Find the area of the shaded trapezium using the diagram labels.',[`The parallel sides are ${m(bottom)} and ${m(top)}.`,`The perpendicular height is ${m(height)}.`,`Area ${m(`=\\tfrac{1}{2}(${bottom}+${top})\\times ${height}=${num(area)}`)}.`],`${m(num(area))} square units`,val(`(${bottom}+${top})*${height}/2`,area),fig);
  }
  if(kind==='integralArea'){
    const {m:k,end}=p;if(!(k>0&&end>0))throw Error('bounded region');
    const h=k*end,area=round(k*end*end/2),fig=diagram('plane',`Shaded region enclosed by y = ${plainPoly([[k,'x']])}, the x-axis and x = ${end}`,[pt('O',[0,0]),pt('R',[end,0]),pt('P',[end,h])],{polygons:[{vertices:['O','R','P'],shade:true}],segments:[['O','P'],['R','P']]});
    return done(`Find the exact area of the shaded region between the line and the ${m('x')}-axis.`,[`The base runs from ${m('x=0')} to ${m(`x=${end}`)}.`,`The height of the triangular region is ${m(`${times(k,end)}=${num(h)}`)}.`,`Area ${m(`=\\tfrac{1}{2}\\times ${end}\\times ${num(h)}=${num(area)}`)}.`],`${m(num(area))} square units`,val(`${k}*${end}^2/2`,area),fig);
  }
  if(kind==='lpMax'){
    const {vertices,objective}=p,points=vertices.map((xy,i)=>pt(String.fromCharCode(65+i),xy)),scores=points.map(q=>[q.id,objective[0]*q.x+objective[1]*q.y]),best=scores.reduce((a,b)=>a[1]>=b[1]?a:b);
    const Z=poly([[objective[0],'x'],[objective[1],'y']]);
    return done(`The shaded polygon is the feasible region. Maximise ${m(`Z=${Z}`)}.`,[`A linear objective on a bounded polygon takes its maximum at a vertex.`,`Evaluate ${m('Z')} at the plotted vertices: ${scores.map(([id,n])=>`at ${m(id)}, ${m(`Z=${n}`)}`).join('; ')}.`,`The maximum is ${m(best[1])} at ${m(best[0])}.`],`${m(best[1])} at ${m(best[0])}`,pairs(points.map(q=>[`${objective[0]}*(${q.x})+${objective[1]}*(${q.y})`,objective[0]*q.x+objective[1]*q.y])),diagram('plane',`Shaded feasible polygon with vertices ${points.map(q=>q.id+plainPair(q.x,q.y)).join('; ')}`,points,{polygons:[{vertices:points.map(q=>q.id),shade:true}]}));
  }
  if(kind==='numberDistance'){
    const {a,b}=p;if(a===b)throw Error('same point');
    const d=Math.abs(b-a);
    return done(`How many units apart are ${m('A')} and ${m('B')} on this number line?`, [`The marked positions are ${m(`A=${a}`)} and ${m(`B=${b}`)}.`,`The signed difference is ${m(`${minus(b,a)}=${b-a}`)}.`,`The distance is its absolute value, ${m(d)}.`],`${m(d)} units`,val(`abs((${b})-(${a}))`,d),{type:'numberline',description:`Number line with A at ${a} and B at ${b}`,marks:[{id:'A',value:a},{id:'B',value:b}],min:Math.min(a,b)-3,max:Math.max(a,b)+3});
  }
  throw Error('Unsupported diagram archetype '+kind);
}
