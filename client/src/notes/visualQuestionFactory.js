// Diagram geometry, plotted data and arithmetic are the single structured source of truth.
// Notes are study examples, not authenticated grading items. No copied question artwork.
export function makeVisualExample(kind,p){
  const round=n=>Number(n.toFixed(6)), val=(expr,answer)=>({kind:'value',expr:String(expr),answer:String(answer)}), pairs=items=>({kind:'values',pairs:items.map(([a,b])=>[String(a),String(b)])});
  const pt=(id,xy)=>({id,x:xy[0],y:xy[1],label:id});
  const diagram=(type,description,points,extra={})=>({type,description,points,grid:type==='plane',...extra});
  const done=(question,steps,answer,verify,figure)=>{
    if(!steps.length||!figure?.description||!verify)throw Error('Incomplete visual question');
    return {question:(p.context?p.context+': ':'')+question,steps,answer:String(answer),verify,figure};
  };
  if(kind==='gradient'){
    const {A,B}=p,dx=B[0]-A[0],dy=B[1]-A[1];if(!dx)throw Error('vertical gradient');
    return done('Read the graph and calculate the gradient of segment AB.',[`The labelled points are A=(${A}) and B=(${B}).`,`Rise=${dy}; run=${dx}.`,`Gradient=rise/run=${round(dy/dx)}.`],round(dy/dx),val(`(${dy})/(${dx})`,round(dy/dx)),diagram('plane',`Segment from A(${A}) to B(${B})`,[pt('A',A),pt('B',B)],{segments:[['A','B']]}));
  }
  if(kind==='midpoint'){
    const {A,B}=p,x=round((A[0]+B[0])/2),y=round((A[1]+B[1])/2);
    return done('Find the midpoint of the plotted segment AB.',[`Read A=(${A}) and B=(${B}).`,`Average x values: (${A[0]}+${B[0]})/2=${x}.`,`Average y values: (${A[1]}+${B[1]})/2=${y}.`],`(${x}, ${y})`,pairs([[`(${A[0]}+${B[0]})/2`,x],[`(${A[1]}+${B[1]})/2`,y]]),diagram('plane',`Line segment with endpoints A(${A}) and B(${B})`,[pt('A',A),pt('B',B)],{segments:[['A','B']]}));
  }
  if(kind==='distance'){
    const {A,B}=p,dx=B[0]-A[0],dy=B[1]-A[1],s=dx*dx+dy*dy,len=round(Math.sqrt(s));
    return done('Find the length of segment AB using the coordinate graph.',[`Horizontal displacement ${dx}; vertical displacement ${dy}.`,`Use Pythagoras: AB²=(${dx})²+(${dy})²=${s}.`,`Thus length=sqrt(${s})=${len}.`],`${len} units`,val(`sqrt((${dx})^2+(${dy})^2)`,len),diagram('plane',`Segment A(${A}) to B(${B})`,[pt('A',A),pt('B',B)],{segments:[['A','B']]}));
  }
  if(kind==='triangleArea'){
    const {A,B,C}=p,det=(B[0]-A[0])*(C[1]-A[1])-(B[1]-A[1])*(C[0]-A[0]),area=round(Math.abs(det)/2);if(!area)throw Error('degenerate');
    return done('Determine the area of triangle ABC from its drawn coordinates.',[`The plotted vertices are A=(${A}), B=(${B}), C=(${C}).`,`The signed doubled area is (${B[0]-A[0]})(${C[1]-A[1]})−(${B[1]-A[1]})(${C[0]-A[0]})=${det}.`,`Half its absolute value is ${area}.`],`${area} square units`,val(`abs((${B[0]-A[0]})*(${C[1]-A[1]})-(${B[1]-A[1]})*(${C[0]-A[0]}))/2`,area),diagram('plane',`Triangle vertices A(${A}), B(${B}), C(${C})`,[pt('A',A),pt('B',B),pt('C',C)],{polygons:[{vertices:['A','B','C'],shade:true}]}));
  }
  if(['barSum','barMean','barProb','barDifference'].includes(kind)){
    const {labels,values}=p;
    if(!Array.isArray(labels)||labels.length<3||labels.length!==values.length||values.some(x=>!Number.isInteger(x)||x<0))throw Error('bad bars');
    const total=values.reduce((a,b)=>a+b,0),mean=round(total/values.length),large=Math.max(...values),small=Math.min(...values),fig={type:'bars',description:labels.map((label,i)=>`${label}: ${values[i]}`).join('; '),labels,values};
    if(kind==='barSum')return done('Use every bar to calculate the total frequency.',[`Read the categories: ${labels.map((x,i)=>x+'='+values[i]).join(', ')}.`,`Sum the frequencies: ${values.join('+')}.`,`The total is ${total}.`],total,val(values.join('+'),total),fig);
    if(kind==='barMean')return done('Calculate the mean of the numerical bar heights (one height per category).',[`The ${values.length} heights are ${values.join(', ')}.`,`Their sum is ${total}.`,`Mean=${total}/${values.length}=${mean}.`],mean,val(`(${values.join('+')})/${values.length}`,mean),fig);
    if(kind==='barDifference')return done('By how much does the tallest bar exceed the shortest?',[`Highest bar height=${large}.`,`Lowest bar height=${small}.`,`Difference=${large}-${small}=${large-small}.`],large-small,val(`${large}-${small}`,large-small),fig);
    const i=labels.indexOf(p.favourable);if(i<0||!total)throw Error('bad favourable');
    const count=values[i],fraction=round(count/total);
    return done(`A uniformly random recorded item is selected. Find P(${p.favourable}).`,[`The selected category has frequency ${count}.`,`The total frequency is ${total}.`,`Probability=${count}/${total}=${fraction}.`],`${count}/${total}`,val(`${count}/${total}`,fraction),fig);
  }
  if(kind==='lineIntercept'){
    const {m,b}=p,A=[-3,-3*m+b],B=[3,3*m+b];
    return done('Determine the y-intercept from the straight-line graph.',[`The y-axis is x=0.`,`The plotted line has the form y=${m}x+(${b}).`,`At x=0 the intercept is y=${b}.`],b,val(`${m}*0+(${b})`,b),diagram('plane',`Straight-line plot from (${A}) to (${B}); y-intercept ${b}`,[pt('P',A),pt('Q',B)],{segments:[['P','Q']],pointLabels:false}));
  }
  if(kind==='parabolaVertex'){
    const {a,h,k}=p;if(!a)throw Error('not parabola');
    const b=-2*a*h,c=a*h*h+k;
    return done('Read the vertex V and the axis of symmetry of the parabola.',[`The turning point on the graph is V=(${h},${k}).`,`In vertex form y=${a}(x−${h})²+(${k}), the square vanishes at x=${h}.`,`The symmetry axis is x=${h}; ${k} is the ${a>0?'minimum':'maximum'}.`],`V=(${h}, ${k}); axis x=${h}`,pairs([[`${a}*(${h}-${h})^2+(${k})`,k],[`${b}^2-4*(${a})*(${c})`,-4*a*k]]),diagram('plane',`Parabola y=${a}x²+(${b})x+(${c}), vertex V(${h},${k})`,[pt('V',[h,k])],{curves:[{type:'quadratic',a,b,c,xmin:h-3,xmax:h+3}]}));
  }
  if(kind==='rightTriangle'){
    const {u,v}=p;if(!(u>0&&v>0))throw Error('legs');
    const sq=u*u+v*v,len=round(Math.sqrt(sq));
    const fig=diagram('geometry',`Right triangle A(0,0), B(${u},0), C(0,${v}) with AB=${u} and AC=${v}`,[pt('A',[0,0]),pt('B',[u,0]),pt('C',[0,v])],{segments:[['A','B'],['B','C'],['C','A']],sideLabels:[{a:'A',b:'B',text:String(u)},{a:'A',b:'C',text:String(v)}],rightAngles:['A']});
    return done('Using the labelled perpendicular sides, find the hypotenuse BC.',[`Angle A is right-angled: BC²=AB²+AC².`,`From the diagram, BC²=${u}²+${v}²=${sq}.`,`Hence BC=sqrt(${sq})=${len}.`],`${len} units`,val(`sqrt(${u}^2+${v}^2)`,len),fig);
  }
  if(kind==='circleChord'){
    const {r,d}=p,half=Math.sqrt(r*r-d*d);if(!(r>d&&d>0&&Number.isInteger(half)))throw Error('needs Pythagorean pair');
    const fig=diagram('geometry',`Circle centre O(0,0), radius ${r}; chord AB meets perpendicular OM=${d}, A(${d},${half}), B(${d},${-half})`,[pt('O',[0,0]),pt('M',[d,0]),pt('A',[d,half]),pt('B',[d,-half])],{circles:[{cx:0,cy:0,r}],segments:[['A','B'],['O','M'],['O','A']],sideLabels:[{a:'O',b:'M',text:String(d)},{a:'O',b:'A',text:String(r)}],rightAngles:['M']});
    return done('The centre-to-chord segment OM is perpendicular to AB. Find the entire chord length using the marked dimensions.',[`Triangle OMA is right-angled with radius OA=${r} and distance OM=${d}.`,`Half the chord AM=sqrt(${r}²−${d}²)=${half}.`,`Therefore chord AB=${2*half}.`],`${2*half} units`,val(`2*sqrt(${r}^2-${d}^2)`,2*half),fig);
  }
  if(kind==='vectors'){
    const {u,v}=p,dot=u[0]*v[0]+u[1]*v[1];
    return done('Find the dot product of the two arrows shown on the grid.',[`Read u=(${u}) and v=(${v}) from the arrow tips.`,`Compute u·v=(${u[0]})(${v[0]})+(${u[1]})(${v[1]}).`,`The dot product equals ${dot}.`],dot,val(`(${u[0]})*(${v[0]})+(${u[1]})*(${v[1]})`,dot),diagram('plane',`Vectors u=(${u}), v=(${v}) start from origin O`,[pt('O',[0,0]),pt('u',u),pt('v',v)],{segments:[['O','u'],['O','v']],arrows:[['O','u'],['O','v']]}));
  }
  if(kind==='trapezoid'){
    const {bottom,top,height}=p;if(!(bottom>top&&top>0&&height>0))throw Error('trapezium');
    const area=round((bottom+top)*height/2),fig=diagram('geometry',`Trapezium ABCD; AB=${bottom}, CD=${top} parallel, height DA=${height}`,[pt('A',[0,0]),pt('B',[bottom,0]),pt('C',[top,height]),pt('D',[0,height])],{polygons:[{vertices:['A','B','C','D'],shade:true}],sideLabels:[{a:'A',b:'B',text:String(bottom)},{a:'D',b:'C',text:String(top)},{a:'D',b:'A',text:String(height)}],rightAngles:['A']});
    return done('Find the area of the shaded trapezium using the diagram labels.',[`Parallel edges are ${bottom} and ${top}.`,`The perpendicular height is ${height}.`,`Area=(${bottom}+${top})×${height}/2=${area}.`],`${area} square units`,val(`(${bottom}+${top})*${height}/2`,area),fig);
  }
  if(kind==='integralArea'){
    const {m,end}=p;if(!(m>0&&end>0))throw Error('bounded region');
    const h=m*end,area=round(m*end*end/2),fig=diagram('plane',`Shaded region enclosed by y=${m}x, x=0, y=0 and x=${end}`,[pt('O',[0,0]),pt('R',[end,0]),pt('P',[end,h])],{polygons:[{vertices:['O','R','P'],shade:true}],segments:[['O','P'],['R','P']]});
    return done('Determine the exact shaded area bounded by the straight-line graph and x-axis.',[`The base is from x=0 to x=${end}.`,`The vertical height of the triangular region is ${m}×${end}=${h}.`,`Area=1/2×${end}×${h}=${area}.`],`${area} square units`,val(`${m}*${end}^2/2`,area),fig);
  }
  if(kind==='lpMax'){
    const {vertices,objective}=p,points=vertices.map((xy,i)=>pt(String.fromCharCode(65+i),xy)),scores=points.map(q=>[q.id,objective[0]*q.x+objective[1]*q.y]),best=scores.reduce((a,b)=>a[1]>=b[1]?a:b);
    return done(`The shaded polygon is feasible. Maximise Z=${objective[0]}x+${objective[1]}y.`,[`A linear objective on a bounded polygon attains its maximum at a vertex.`,`Evaluate the plotted vertices: ${scores.map(([id,n])=>id+'='+n).join(', ')}.`,`The maximum is ${best[1]} at ${best[0]}.`],`${best[1]} at ${best[0]}`,pairs(points.map(q=>[`${objective[0]}*(${q.x})+${objective[1]}*(${q.y})`,objective[0]*q.x+objective[1]*q.y])),diagram('plane',`Shaded feasible polygon with vertices ${points.map(q=>q.id+'('+q.x+','+q.y+')').join('; ')}`,points,{polygons:[{vertices:points.map(q=>q.id),shade:true}]}));
  }
  if(kind==='numberDistance'){
    const {a,b}=p;if(a===b)throw Error('same point');
    const d=Math.abs(b-a);
    return done('How many units separate A and B on this number line?', [`The positions shown are A=${a}, B=${b}.`,`Signed difference is (${b})−(${a})=${b-a}.`,`Distance is the absolute value, ${d}.`],`${d} units`,val(`abs((${b})-(${a}))`,d),{type:'numberline',description:`Number line A=${a} and B=${b}`,marks:[{id:'A',value:a},{id:'B',value:b}],min:Math.min(a,b)-3,max:Math.max(a,b)+3});
  }
  throw Error('Unsupported diagram archetype '+kind);
}
