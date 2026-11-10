// Pri Learning · Grade 9 Ganita Manjari mastery generators.
// Numeric payloads deliberately use the normal PracticeBase -> InkAnswer path.
//
// Widened Nov 2026 (L5, tools/distinct-questions.mjs): every cell used to draw
// from a handful of fixed items or a few small pick-lists — some cells served
// 2–8 different questions in all. Each cell now draws from wide integer ranges
// and two or three question shapes of the same skill, so the space of distinct
// questions is measured in millions rather than tens. The SKILL each cell
// practises, its answer type (numeric or MCQ), its hint ladder and worked
// solution are unchanged in kind; every number is drawn from the seed and every
// answer is computed from the parameters, never typed.
import { ri, mcq } from '../qhelpers.js';

const pick = (rng, xs) => xs[Math.floor(rng() * xs.length)];
const nzi = (rng, a, b) => { let v = 0; while (v === 0) v = ri(rng, a, b); return v; };
const gcd = (a,b) => { a=Math.abs(a); b=Math.abs(b); while (b) [a,b]=[b,a%b]; return a || 1; };
const q = (prompt,value,hints,steps,extra={}) => ({ prompt, answerType:'numeric', answer:{value}, hints, steps:steps.map(([h,d])=>({h,d})), ...extra });
const qFrac = (prompt,n,d,hints,steps,extra={}) => { const g=gcd(n,d); n/=g; d/=g; if(d<0){n=-n;d=-d;} return q(prompt,n/d,hints,steps,{answer:{value:n/d,simplestFraction:{n,d}},inputHint:`e.g. ${n}/${d}`,...extra}); };
const qMcq = (rng,prompt,correct,wrong,hints,steps) => { const m=mcq(rng,correct,wrong.map(([text,why])=>({text,why}))); return {prompt,answerType:'mcq',answer:{correctIndex:m.correctIndex,optionTraps:m.optionTraps},mcqOptions:m.options,hints,steps:steps.map(([h,d])=>({h,d}))}; };

// ── Clean algebra text ──────────────────────────────────────────────────────
/** c·v written as a textbook does: x, -x, 3x (c ≠ 0). */
const cv = (c, v) => (c === 1 ? v : c === -1 ? `-${v}` : `${c}${v}`);
/** " + 5" / " - 5" / "" after another term. */
const tail = k => (k === 0 ? '' : k > 0 ? ` + ${k}` : ` - ${-k}`);
/** " + 3x" / " - x" / "" after another term. */
const tailv = (c, v) => (c === 0 ? '' : c > 0 ? ` + ${cv(c, v)}` : ` - ${cv(-c, v)}`);
/** ax + b. */
const linx = (a, b, v = 'x') => `${cv(a, v)}${tail(b)}`;
/** A number in brackets when negative. */
const br = n => (n < 0 ? `(${n})` : `${n}`);
/** A fraction in LaTeX, reduced, sign in front. */
const fr = (n, d) => { const g = gcd(n, d); n /= g; d /= g; if (d < 0) { n = -n; d = -d; } return d === 1 ? `${n}` : `${n < 0 ? '-' : ''}\\frac{${Math.abs(n)}}{${d}}`; };
const QUADS = ['Quadrant I', 'Quadrant II', 'Quadrant III', 'Quadrant IV'];
const quadOf = (x, y) => (x > 0 ? (y > 0 ? 'Quadrant I' : 'Quadrant IV') : (y > 0 ? 'Quadrant II' : 'Quadrant III'));

// ── Coordinate geometry ─────────────────────────────────────────────────────
const TRIPLES = [[3,4,5],[5,12,13],[8,15,17],[7,24,25],[20,21,29],[9,40,41],[12,35,37],[11,60,61],[28,45,53],[33,56,65]];
const coordinate = (rng,diff) => {
  if(diff===1){
    const x=nzi(rng,-99,99),y=nzi(rng,-99,99);
    const form=pick(rng,['point','reflect-x','reflect-y']);
    const [px,py]=form==='reflect-x'?[x,-y]:form==='reflect-y'?[-x,y]:[x,y];
    const c=quadOf(px,py);
    const prompt=form==='point'?`In which quadrant does $P(${x},${y})$ lie?`:`The point $P(${x},${y})$ is reflected in the ${form==='reflect-x'?'x':'y'}-axis. In which quadrant does its image lie?`;
    return qMcq(rng,prompt,c,QUADS.filter(v=>v!==c).map(v=>[v,'Check the sign pair (x,y) of the point you are asked about.']),
      [form==='point'?'Read the sign of x.':`Reflecting in the ${form==='reflect-x'?'x-axis changes the sign of y':'y-axis changes the sign of x'}.`,'Read the signs of the coordinates you end with.','Match the sign pair to the quadrant convention.'],
      [['Point',form==='point'?`$P(${x},${y})$`:`Image $P'(${px},${py})$`],['Signs',`$x$ is ${px>0?'positive':'negative'}, $y$ is ${py>0?'positive':'negative'}.`],['Conclusion',c]]);
  }
  if(diff===2){
    const horizontal=rng()<.5,fixed=ri(rng,-60,60),a=ri(rng,-90,-1),b=ri(rng,1,90),dist=b-a;
    const A=horizontal?`A(${a},${fixed})`:`A(${fixed},${a})`,B=horizontal?`B(${b},${fixed})`:`B(${fixed},${b})`;
    if(rng()<.5) return q(`Find the distance between $${A}$ and $${B}$.`,dist,['Identify the coordinate that stays fixed.','The segment is parallel to an axis.','Take the absolute difference of the changing coordinates.'],[['Structure',horizontal?'Equal y-coordinates: horizontal segment.':'Equal x-coordinates: vertical segment.'],['Difference',`$|${b}-(${a})|=${dist}$`],['Answer',`$${dist}$ units`]]);
    const s=a+b;
    return qFrac(`Find the ${horizontal?'x':'y'}-coordinate of the midpoint of $${A}$ and $${B}$.`,s,2,['The midpoint averages the coordinates.','Add the two changing coordinates.','Divide by 2.'],[['Average',`$\\frac{${a}+${b}}{2}$`],['Simplify',`$\\frac{${s}}{2}$`],['Answer',`$${fr(s,2)}$`]]);
  }
  if(diff===3){
    let [dx,dy,h]=pick(rng,TRIPLES); const k=ri(rng,1,Math.max(1,Math.floor(60/Math.max(dx,dy))));
    dx*=k; dy*=k; h*=k; if(rng()<.5)[dx,dy]=[dy,dx];
    const x1=ri(rng,-40,40),y1=ri(rng,-40,40),x2=x1+(rng()<.5?-dx:dx),y2=y1+(rng()<.5?-dy:dy);
    return q(`Find the distance between $P(${x1},${y1})$ and $Q(${x2},${y2})$.`,h,['Use coordinate differences as perpendicular legs.','Apply the Baudhāyana–Pythagoras relation.','Distance is the positive square root.'],[['Differences',`$\\Delta x=${x2-x1},\\ \\Delta y=${y2-y1}$`],['Distance',`$PQ=\\sqrt{(${x2-x1})^2+(${y2-y1})^2}=\\sqrt{${h*h}}$`],['Answer',`$PQ=${h}$ units`]]);
  }
  const x1=ri(rng,-200,150),x2=x1+ri(rng,3,250),y1=ri(rng,-200,150),y2=y1+ri(rng,3,250),w=x2-x1,ht=y2-y1;
  if(rng()<.5) return q(`Opposite vertices of an axis-aligned rectangle are $A(${x1},${y1})$ and $C(${x2},${y2})$. Find its area.`,w*ht,['Use coordinate differences for the side lengths.','Width is $|x_2-x_1|$ and height is $|y_2-y_1|$.','Multiply the perpendicular lengths.'],[['Width',`$${w}$`],['Height',`$${ht}$`],['Area',`$${w}\\times${ht}=${w*ht}$ square units`]]);
  return q(`Opposite vertices of an axis-aligned rectangle are $A(${x1},${y1})$ and $C(${x2},${y2})$. Find its perimeter.`,2*(w+ht),['Use coordinate differences for the side lengths.','Width is $|x_2-x_1|$ and height is $|y_2-y_1|$.','Perimeter is twice the sum of the sides.'],[['Width',`$${w}$`],['Height',`$${ht}$`],['Perimeter',`$2(${w}+${ht})=${2*(w+ht)}$ units`]]);
};

// ── Linear polynomials ──────────────────────────────────────────────────────
const polyText = cs => { let out=''; cs.forEach(([c,p])=>{ if(!c) return; const body=p===0?`${Math.abs(c)}`:`${Math.abs(c)===1?'':Math.abs(c)}x${p===1?'':`^${p}`}`; out+=out?` ${c<0?'-':'+'} ${body}`:`${c<0?'-':''}${body}`; }); return out||'0'; };
const polynomials = (rng,diff) => {
  if(diff===1){
    const deg=ri(rng,0,4),cs=[];
    for(let p=deg;p>=0;p--){ const c=p===deg?nzi(rng,-12,12):(rng()<.6?ri(rng,-15,15):0); cs.push([c,p]); }
    // Written in a mixed order sometimes, so the highest power is not always first.
    const shown=rng()<.4?[...cs].reverse():cs;
    const text=polyText(shown);
    return qMcq(rng,`What is the degree of $${text}$?`,String(deg),['0','1','2','3','4'].filter(x=>x!==String(deg)).slice(0,3).map(x=>[x,'Degree is the highest exponent with non-zero coefficient.']),['Ignore coefficient size and term order.','Find the highest power present.','A non-zero constant has degree 0.'],[['Polynomial',`$${text}$`],['Highest power',String(deg)],['Answer',`degree $=${deg}$`]]);
  }
  if(diff===2){
    if(rng()<.5){ const a=nzi(rng,-25,25),b=ri(rng,-99,99),x=nzi(rng,-15,15),v=a*x+b;
      return q(`Evaluate $${linx(a,b)}$ at $x=${x}$.`,v,['Substitute x using brackets.','Multiply before adding the constant.','Control the sign if x is negative.'],[['Substitute',`$${a}${br(x)===String(x)?`(${x})`:br(x)}${tail(b)}$`],['Simplify',`$${a*x}${tail(b)}$`],['Answer',`$${v}$`]]); }
    const a=nzi(rng,-9,9),b=ri(rng,-20,20),c=ri(rng,-40,40),x=nzi(rng,-8,8),v=a*x*x+b*x+c;
    return q(`Evaluate $p(x)=${cv(a,'x^2')}${tailv(b,'x')}${tail(c)}$ at $x=${x}$.`,v,['Substitute x using brackets.','Square first, then multiply, then add.','Control the signs term by term.'],[['Substitute',`$${a}(${x})^2${b?` ${b<0?'-':'+'} ${Math.abs(b)}(${x})`:''}${tail(c)}$`],['Simplify',`$${a*x*x}${tail(b*x)}${tail(c)}$`],['Answer',`$p(${x})=${v}$`]]);
  }
  if(diff===3){
    const a=nzi(rng,-50,50),b=ri(rng,-500,500),x1=ri(rng,-100,100),x2=x1+ri(rng,1,40),y1=a*x1+b,y2=a*x2+b;
    if(rng()<.5) return q(`A linear relation passes through $(${x1},${y1})$ and $(${x2},${y2})$. Find its slope.`,a,['Slope is change in y divided by change in x.','Subtract coordinates in the same order.','The rate is constant for a linear relation.'],[['Changes',`$\\Delta y=${y2-y1},\\ \\Delta x=${x2-x1}$`],['Slope',`$a=\\frac{${y2-y1}}{${x2-x1}}$`],['Answer',`$a=${a}$`]]);
    return q(`A linear relation $y=ax+b$ passes through $(${x1},${y1})$ and $(${x2},${y2})$. Find $b$.`,b,['Find the slope first.','Substitute one point into $y=ax+b$.','Solve for b.'],[['Slope',`$a=\\frac{${y2-y1}}{${x2-x1}}=${a}$`],['Substitute',`$${y1}=${a}(${x1})+b$`],['Answer',`$b=${b}$`]]);
  }
  const a=ri(rng,2,40),b=ri(rng,10,900),x=ri(rng,2,99),y=a*x+b;
  const ctx=pick(rng,[['A taxi fare in rupees follows','km'],['A plumber\'s charge in rupees follows','hours'],['A phone plan\'s monthly bill in rupees follows','GB of data'],['The cost in rupees of printing follows','hundred pages']]);
  return q(`${ctx[0]} $y=${a}x+${b}$, where $x$ is the number of ${ctx[1]}. If $y=${y}$, find $x$.`,x,['Set the linear expression equal to the stated output.','Subtract the fixed intercept.','Divide by the rate.'],[['Equation',`$${y}=${a}x+${b}$`],['Isolate',`$${a}x=${y-b}$`],['Answer',`$x=${x}$`]]);
};

// ── Number systems ──────────────────────────────────────────────────────────
const isSquare = n => Number.isInteger(Math.sqrt(n));
const numbers = (rng,diff) => {
  if(diff===1){
    const kind=pick(rng,['natural','negative','fraction','decimal','surd','root-square','pi-multiple']);
    let shown,c;
    if(kind==='natural'){const n=ri(rng,1,9999);shown=`$${n}$`;c='Natural';}
    else if(kind==='negative'){const n=-ri(rng,1,9999);shown=`$${n}$`;c='Integer';}
    else if(kind==='fraction'){let p=nzi(rng,-99,99),d=ri(rng,2,60);if(p%d===0)p+=1;shown=`$${fr(p,d)}$`;c=fr(p,d).includes('frac')?'Rational':(Number(fr(p,d))>0?'Natural':'Integer');}
    else if(kind==='decimal'){const n=ri(rng,1,9999),dp=ri(rng,1,3),v=(n/10**dp).toFixed(dp);shown=`$${v}$`;c=Number(v)%1===0?'Natural':'Rational';}
    else if(kind==='surd'){let n=ri(rng,2,400);while(isSquare(n))n+=1;shown=`$\\sqrt{${n}}$`;c='Irrational';}
    else if(kind==='root-square'){const r=ri(rng,2,40);shown=`$\\sqrt{${r*r}}$`;c='Natural';}
    else {const k=nzi(rng,2,30);shown=`$${k}\\pi$`;c='Irrational';}
    return qMcq(rng,`Which is the most specific listed classification of ${shown}?`,c,['Natural','Integer','Rational','Irrational'].filter(x=>x!==c).map(x=>[x,'Use the nested number-set hierarchy.']),['Recall $\\mathbb N\\subset\\mathbb Z\\subset\\mathbb Q\\subset\\mathbb R$.','Simplify the number first: a root of a perfect square is a whole number.','A ratio of integers is rational; a non-square root or a non-zero multiple of $\\pi$ is irrational.'],[['Value',shown],['Hierarchy','$\\mathbb N\\subset\\mathbb Z\\subset\\mathbb Q\\subset\\mathbb R$'],['Answer',c]]);
  }
  if(diff===2){
    const a=nzi(rng,-40,40),b=ri(rng,2,40),c=nzi(rng,-40,40),d=ri(rng,2,40),op=pick(rng,['+','-']);
    const n=op==='+'?a*d+c*b:a*d-c*b,den=b*d;
    return qFrac(`Find $\\frac{${a}}{${b}}${op}\\frac{${c}}{${d}}$ in simplest form.`,n,den,['Use a common denominator.','Combine signed numerators.','Reduce the result.'],[['Common denominator',`$${den}$`],['Combine',`$\\frac{${a*d}${op==='+'?tail(c*b):tail(-c*b)}}{${den}}=\\frac{${n}}{${den}}$`],['Simplify',`$${fr(n,den)}$`]]);
  }
  if(diff===3){
    // n / (2^i 5^j m): terminating exactly when, after reduction, m's factors are gone.
    const i=ri(rng,0,6),j=ri(rng,0,5),m=pick(rng,[1,1,3,7,9,11,13,21,27,33,49]);
    const den=(2**i)*(5**j)*m; if(den<2) return numbers(rng,diff);
    let n=ri(rng,1,999); while(gcd(n,den)!==1) n+=1;
    const c=m===1?'Terminating':'Repeating';
    const fact=[i?`2^{${i}}`:'',j?`5^{${j}}`:'',m>1?String(m):''].filter(Boolean).join('\\times');
    return qMcq(rng,`Without long division, classify the decimal expansion of $\\frac{${n}}{${den}}$.`,c,['Terminating','Repeating','Irrational','Undefined'].filter(x=>x!==c).map(x=>[x,'Reduce first, then inspect denominator prime factors.']),['Reduce the fraction.','Factor the denominator.','Only prime factors 2 and 5 give a terminating rational decimal.'],[['Fraction',`$\\frac{${n}}{${den}}$ is in lowest terms`],['Denominator',`$${den}=${fact}$`],['Answer',c==='Terminating'?'Only factors 2 and/or 5: Terminating':'A prime factor other than 2 or 5 remains: Repeating']]);
  }
  // Recurring decimals to fractions: k.\overline{ab} or k.a\overline{bc}.
  const k=ri(rng,0,999);
  if(rng()<.5){
    let ab=ri(rng,1,98); if(ab%11===0) ab+=1;          // a genuine two-digit period
    const s=String(ab).padStart(2,'0'),N=99*k+ab;
    return qFrac(`Write $${k}.\\overline{${s}}$ as a fraction in simplest form.`,N,99,['Let the decimal equal x.','Multiply by 100 to shift one whole period.','Subtract to cancel the repeating tail.'],[['Let',`$x=${k}.${s}${s}\\ldots$`],['Subtract',`$100x-x=${100*k+ab}-${k}$, so $99x=${N}$`],['Answer',`$x=${fr(N,99)}$`]]);
  }
  const a=ri(rng,0,9); let bc=ri(rng,1,98); if(bc%11===0) bc+=1;
  const s=String(bc).padStart(2,'0'),big=1000*k+100*a+bc,small=10*k+a,N=big-small;
  return qFrac(`Write $${k}.${a}\\overline{${s}}$ as a fraction in simplest form.`,N,990,['Let the decimal equal x.','Multiply by 1000 and by 10 so the repeating tails line up.','Subtract to cancel the repeating tail.'],[['Let',`$x=${k}.${a}${s}${s}\\ldots$`],['Subtract',`$1000x-10x=${big}-${small}$, so $990x=${N}$`],['Answer',`$x=${fr(N,990)}$`]]);
};

// ── Algebraic identities ────────────────────────────────────────────────────
/** (x - r)(x - s) for roots r, s, in one canonical factor order (smaller root first). */
export const factorised = (r, s) => { const fac = t => `(x${t > 0 ? '-' : '+'}${Math.abs(t)})`; const [a, b] = r <= s ? [r, s] : [s, r]; return `${fac(a)}${fac(b)}`; };
const identities = (rng,diff) => {
  if(diff===1){
    const a=ri(rng,1,999)*10,b=ri(rng,1,9),form=pick(rng,['plus','minus','product']);
    if(form==='plus'){const n=a+b,v=n*n;return q(`Use an identity to find $${n}^2$.`,v,['Write the number as a convenient sum.','Use $(a+b)^2=a^2+2ab+b^2$.','Evaluate the three simple terms.'],[['Rewrite',`$${n}=${a}+${b}$`],['Identity',`$(${a}+${b})^2=${a*a}+${2*a*b}+${b*b}$`],['Answer',`$${v}$`]]);}
    if(form==='minus'){const n=a-b,v=n*n;return q(`Use an identity to find $${n}^2$.`,v,['Write the number as a convenient difference.','Use $(a-b)^2=a^2-2ab+b^2$.','Evaluate the three simple terms.'],[['Rewrite',`$${n}=${a}-${b}$`],['Identity',`$(${a}-${b})^2=${a*a}-${2*a*b}+${b*b}$`],['Answer',`$${v}$`]]);}
    const v=a*a-b*b;return q(`Use an identity to find $${a+b}\\times${a-b}$.`,v,['Both numbers are the same distance from a round number.','Use $(a+b)(a-b)=a^2-b^2$.','Square the round number and the distance.'],[['Rewrite',`$(${a}+${b})(${a}-${b})$`],['Identity',`$${a}^2-${b}^2=${a*a}-${b*b}$`],['Answer',`$${v}$`]]);
  }
  if(diff===2){
    const A=ri(rng,1,15),B=ri(rng,1,15),sign=pick(rng,[1,-1]),u=pick(rng,['x','a','p','m']),w=pick(rng,['y','b','q','n']);
    if(A===B) return identities(rng,diff);
    const mid=2*A*B,first=cv(A*A,`${u}^2`),last=cv(B*B,`${w}^2`),Au=cv(A,u),Bw=cv(B,w);
    const right=`(${Au}${sign>0?'+':'-'}${Bw})^2`;
    return qMcq(rng,`Factor $${first}${sign>0?'+':'-'}${mid}${u}${w}+${last}$.`,right,[[`(${Au}${sign>0?'-':'+'}${Bw})^2`,'The sign of the middle term decides the sign inside the bracket.'],[`(${Au}${sign>0?'+':'-'}${Bw})(${Au}${sign>0?'-':'+'}${Bw})`,'That product is a difference of squares, with no middle term.'],[`(${cv(A*A,u)}${sign>0?'+':'-'}${cv(B*B,w)})^2`,'Take the square roots of the end coefficients.']],['Recognise two perfect-square end terms.','Check whether the middle term is twice the product of their roots.','Apply the perfect-square identity.'],[['Roots',`$\\sqrt{${first}}=${Au}$, $\\sqrt{${last}}=${Bw}$`],['Middle',`$2(${Au})(${Bw})=${mid}${u}${w}$`],['Factor',`$${right}$`]]);
  }
  if(diff===3){
    const a=ri(rng,12,999),b=ri(rng,1,a-1),v=a*a-b*b;
    return q(`Evaluate $${a}^2-${b}^2$ using a factor identity.`,v,['Recognise a difference of squares.','Use $a^2-b^2=(a-b)(a+b)$.','Multiply the two factors.'],[['Identity','$a^2-b^2=(a-b)(a+b)$'],['Factors',`$(${a}-${b})(${a}+${b})$`],['Answer',`$${a-b}\\times${a+b}=${v}$`]]);
  }
  const r1=nzi(rng,-15,15),r2=nzi(rng,-15,15),sum=r1+r2,prod=r1*r2;
  const right=factorised(r1,r2);
  // Distractors are other factorisations, deduplicated by the quadratic they
  // expand to (so (x-3)(x+3) and (x+3)(x-3) are one option), never equal to
  // the right one, plus a not-a-product trap when it reads sensibly.
  const wrong=[]; const seenPoly=new Set([`${sum}|${prod}`]);
  for(const [a,b,why] of [[-r1,-r2,'These factors give the opposite middle coefficient.'],[r1,-r2,'Check the constant term: the product has the wrong sign or size.'],[-r1,r2,'Check the constant term: the product has the wrong sign or size.'],[r1+1,r2-1,'Expand: the constant term does not match.'],[r1,r2+1,'Expand: neither coefficient matches.']]){
    if(a===0||b===0) continue;
    const key=`${a+b}|${a*b}`; if(seenPoly.has(key)) continue; seenPoly.add(key);
    wrong.push([factorised(a,b),why]);
  }
  if(sum!==0) wrong.splice(2,0,[`x(x${tail(-sum)})${tail(prod)}`,'This is not a product of factors.']);
  return qMcq(rng,`Factor $x^2${tailv(-sum,'x')}${tail(prod)}$.`,right,wrong.slice(0,3),['For $x^2+bx+c$, seek two numbers with sum b and product c.','Mind the signs of the two numbers.','Check by expansion.'],[['Need',`two numbers with sum $${-sum}$ and product $${prod}$: $${-r1}$ and $${-r2}$`],['Factors',`$${right}$`],['Check','Expanding reproduces the quadratic.']]);
};

// ── Circles ─────────────────────────────────────────────────────────────────
const circles = (rng,diff) => {
  if(diff===1){
    const r=ri(rng,2,999),unit=pick(rng,['cm','mm','m']);
    if(rng()<.5) return q(`A circle has radius $${r}$ ${unit}. Find the length of its longest chord.`,2*r,['The longest chord passes through the centre.','Such a chord is a diameter.','Diameter is twice the radius.'],[['Property','Longest chord = diameter.'],['Compute',`$2r=2(${r})$`],['Answer',`$${2*r}$ ${unit}`]],{answerSuffix:` ${unit}`});
    const d=2*r;return q(`The longest chord of a circle is $${d}$ ${unit}. Find its radius.`,r,['The longest chord passes through the centre.','Such a chord is a diameter.','Radius is half the diameter.'],[['Property','Longest chord = diameter.'],['Compute',`$${d}\\div2$`],['Answer',`$${r}$ ${unit}`]],{answerSuffix:` ${unit}`});
  }
  if(diff===2){
    const inscribed=ri(rng,5,89),angle=2*inscribed;
    if(rng()<.5) return q(`A chord subtends $${angle}^\\circ$ at the centre. Find the angle subtended by the same arc at a point on the remaining circle.`,inscribed,['Use the central-angle/inscribed-angle theorem.','The angle at the centre is twice the angle at the circumference on the same arc.','Divide the central angle by 2.'],[['Theorem','$\\angle\\text{centre}=2\\angle\\text{circumference}$'],['Compute',`$${angle}/2=${inscribed}$`],['Answer',`$${inscribed}^\\circ$`]],{answerSuffix:'°'});
    return q(`An arc subtends $${inscribed}^\\circ$ at a point on the remaining part of a circle. Find the angle it subtends at the centre.`,angle,['Use the central-angle/inscribed-angle theorem.','The angle at the centre is twice the angle at the circumference on the same arc.','Double the given angle.'],[['Theorem','$\\angle\\text{centre}=2\\angle\\text{circumference}$'],['Compute',`$2\\times${inscribed}=${angle}$`],['Answer',`$${angle}^\\circ$`]],{answerSuffix:'°'});
  }
  if(diff===3){
    const a=ri(rng,20,160),b=180-a;
    if(rng()<.5) return q(`One angle of a cyclic quadrilateral is $${a}^\\circ$. Find the opposite angle.`,b,['Opposite angles of a cyclic quadrilateral are supplementary.','Their sum is $180^\\circ$.','Subtract the given angle from 180.'],[['Property','$A+C=180^\\circ$'],['Compute',`$180-${a}=${b}$`],['Answer',`$${b}^\\circ$`]],{answerSuffix:'°'});
    // Opposite angles (2x + m) and (x + k): 3x + m + k = 180, with both angles positive.
    const m=ri(rng,1,60),k=ri(rng,1,60),s=180-m-k;
    if(s%3!==0) return circles(rng,diff);
    const X=s/3;
    return q(`In a cyclic quadrilateral $ABCD$, $\\angle A=(2x+${m})^\\circ$ and $\\angle C=(x+${k})^\\circ$. Find $x$.`,X,['Opposite angles of a cyclic quadrilateral are supplementary.','Add the two expressions and set the sum to $180^\\circ$.','Solve the linear equation.'],[['Property','$\\angle A+\\angle C=180^\\circ$'],['Equation',`$3x+${m+k}=180$`],['Answer',`$x=${X}$`]]);
  }
  let [a,b,h]=pick(rng,TRIPLES); const k=ri(rng,1,Math.max(1,Math.floor(120/h))); a*=k; b*=k; h*=k; if(rng()<.5)[a,b]=[b,a];
  if(rng()<.5) return q(`A circle has radius $${h}$ and a chord is $${a}$ units from the centre. Find the chord length.`,2*b,['The perpendicular from the centre to a chord bisects the chord.','A radius, half-chord and centre-distance form a right triangle.','Use $r^2=d^2+(c/2)^2$.'],[['Right triangle',`$(c/2)^2=${h*h}-${a*a}=${b*b}$`],['Half chord',`$c/2=\\sqrt{${b*b}}=${b}$`],['Answer',`$c=${2*b}$ units`]]);
  return q(`A chord of length $${2*b}$ lies in a circle of radius $${h}$. Find the distance of the chord from the centre.`,a,['The perpendicular from the centre to a chord bisects the chord.','A radius, half-chord and centre-distance form a right triangle.','Use $d^2=r^2-(c/2)^2$.'],[['Half chord',`$c/2=${b}$`],['Right triangle',`$d^2=${h*h}-${b*b}=${a*a}$`],['Answer',`$d=${a}$ units`]]);
};

// ── Perimeter and area ──────────────────────────────────────────────────────
const mensuration = (rng,diff) => {
  if(diff===1){
    const r=7*ri(rng,1,140),c=44*r/7;
    if(rng()<.5) return q(`Using $\\pi\\approx22/7$, find the circumference of a circle of radius $${r}$ cm.`,c,['Use $C=2\\pi r$.','Substitute $\\pi=22/7$.','Cancel before multiplying.'],[['Formula','$C=2\\pi r$'],['Substitute',`$2\\times\\frac{22}{7}\\times${r}$`],['Answer',`$${c}$ cm`]],{answerSuffix:' cm'});
    return q(`Using $\\pi\\approx22/7$, a circle has circumference $${c}$ cm. Find its radius.`,r,['Use $C=2\\pi r$.','Substitute $\\pi=22/7$ and the circumference.','Solve for r.'],[['Formula','$C=2\\pi r$'],['Substitute',`$${c}=2\\times\\frac{22}{7}\\times r$`],['Answer',`$r=${r}$ cm`]],{answerSuffix:' cm'});
  }
  if(diff===2){
    const r=7*ri(rng,1,60),theta=pick(rng,[30,36,40,45,60,72,90,120,135,144,150,180,210,240,270,300,315,330]);
    const n=44*r*theta,d=7*360;
    return qFrac(`Using $\\pi\\approx22/7$, find the arc length for radius $${r}$ cm and central angle $${theta}^\\circ$.`,n,d,['An arc is the same fraction of circumference as its central angle is of a full turn.','Use $L=(\\theta/360)2\\pi r$.','Cancel factors before multiplying.'],[['Formula','$L=\\frac{\\theta}{360}\\,2\\pi r$'],['Substitute',`$\\frac{${theta}}{360}\\times2\\times\\frac{22}{7}\\times${r}$`],['Answer',`$${fr(n,d)}$ cm`]],{answerSuffix:' cm'});
  }
  if(diff===3){
    const form=pick(rng,['triangle','heron','trapezium']);
    if(form==='triangle'){const b=ri(rng,3,199),h=ri(rng,2,150);return qFrac(`A triangle has base $${b}$ cm and perpendicular height $${h}$ cm. Find its area.`,b*h,2,['Area depends on a base and its perpendicular height.','Use $A=\\frac12 bh$.','Multiply, then halve.'],[['Formula','$A=\\frac12 bh$'],['Substitute',`$\\frac12(${b})(${h})$`],['Answer',`$${fr(b*h,2)}$ cm$^2$`]],{answerSuffix:' cm²'});}
    if(form==='trapezium'){const a=ri(rng,3,120),b=a+ri(rng,1,80),h=ri(rng,2,90);return qFrac(`A trapezium has parallel sides $${a}$ cm and $${b}$ cm, $${h}$ cm apart. Find its area.`,(a+b)*h,2,['Area is the average of the parallel sides times the distance between them.','Use $A=\\frac12(a+b)h$.','Add, multiply, then halve.'],[['Formula','$A=\\frac12(a+b)h$'],['Substitute',`$\\frac12(${a}+${b})(${h})$`],['Answer',`$${fr((a+b)*h,2)}$ cm$^2$`]],{answerSuffix:' cm²'});}
    // Heron with an integer area: scale a Heronian triangle.
    const [x,y,z]=pick(rng,[[13,14,15],[5,5,6],[5,5,8],[10,13,13],[9,10,17],[13,20,21],[11,13,20],[7,15,20],[10,17,21],[13,13,24]]); const k=ri(rng,1,12);
    const A=x*k,B=y*k,C=z*k,s=(A+B+C)/2,area=Math.round(Math.sqrt(s*(s-A)*(s-B)*(s-C)));
    return q(`Find the area of a triangle with sides $${A}$ cm, $${B}$ cm and $${C}$ cm.`,area,['Use Heron\'s formula.','Find the semi-perimeter first.','$A=\\sqrt{s(s-a)(s-b)(s-c)}$.'],[['Semi-perimeter',`$s=\\frac{${A}+${B}+${C}}{2}=${s}$`],['Heron',`$A=\\sqrt{${s}\\times${s-A}\\times${s-B}\\times${s-C}}$`],['Answer',`$${area}$ cm$^2$`]],{answerSuffix:' cm²'});
  }
  const r=7*ri(rng,1,40),theta=pick(rng,[30,36,40,45,60,72,90,120,135,144,150,180,210,240,270,300,315,330]),n=22*r*r*theta,d=7*360;
  return qFrac(`Using $\\pi\\approx22/7$, find the area of a sector of radius $${r}$ cm and angle $${theta}^\\circ$.`,n,d,['A sector is an angle fraction of the full circle area.','Use $A=(\\theta/360)\\pi r^2$.','Substitute the stated approximation for pi.'],[['Formula','$A=\\frac\\theta{360}\\pi r^2$'],['Substitute',`$\\frac{${theta}}{360}\\times\\frac{22}{7}\\times${r}^2$`],['Answer',`$${fr(n,d)}$ cm$^2$`]],{answerSuffix:' cm²'});
};

// ── Probability ─────────────────────────────────────────────────────────────
const probability = (rng,diff) => {
  if(diff===1){
    // A bag of counters: classify an event on the probability scale.
    const total=ri(rng,2,200),fav=ri(rng,0,total),colour=pick(rng,['red','blue','green','yellow','white']);
    const p=fav/total,c=fav===0?'Impossible':fav===total?'Certain':p<0.5?'Less likely':p>0.5?'More likely':'Even chance';
    return qMcq(rng,`A bag holds $${total}$ counters, $${fav}$ of them ${colour}. One counter is drawn at random. Classify the event "the counter is ${colour}".`,c,['Impossible','Less likely','Even chance','More likely','Certain'].filter(x=>x!==c).slice(0,3).map(x=>[x,'Compare the favourable counters with half of all the counters.']),['List what can happen.','Compare favourable outcomes with all outcomes.','Translate probability 0, below 1/2, 1/2, above 1/2 or 1 into language.'],[['Probability',`$\\frac{${fav}}{${total}}$`],['Compare',fav===0?'No counter is favourable.':fav===total?'Every counter is favourable.':`$${fav}$ against half of $${total}$, which is $${total/2}$`],['Answer',c]]);
  }
  if(diff===2){
    const trials=ri(rng,20,2000),hits=ri(rng,1,trials-1),ctx=pick(rng,['a drawing pin lands point up','a seed germinates','a free throw goes in','a bus arrives on time','a coin shows heads']);
    return qFrac(`In $${trials}$ trials, ${ctx} $${hits}$ times. Find the experimental probability of this outcome.`,hits,trials,['Experimental probability is relative frequency.','Use occurrences divided by trials.','Simplify the fraction.'],[['Formula','$P_{exp}=\\frac{\\text{occurrences}}{\\text{trials}}$'],['Substitute',`$\\frac{${hits}}{${trials}}$`],['Answer',`$${fr(hits,trials)}$`]]);
  }
  if(diff===3){
    // A fair die with any number of faces from 4 to 30 (a common game spinner/die).
    const n=ri(rng,4,30),ev=pick(rng,['prime','even','odd','a multiple of 3','greater than','a factor of']);
    const t=ev==='greater than'?ri(rng,1,n-1):ev==='a factor of'?ri(rng,6,60):0;
    const isPrime=k=>k>1&&[...Array(k).keys()].slice(2).every(j=>k%j);
    const test=k=>ev==='prime'?isPrime(k):ev==='even'?k%2===0:ev==='odd'?k%2===1:ev==='a multiple of 3'?k%3===0:ev==='greater than'?k>t:t%k===0;
    const fav=[...Array(n).keys()].map(i=>i+1).filter(test);
    if(!fav.length) return probability(rng,diff);
    const label=ev==='greater than'?`greater than ${t}`:ev==='a factor of'?`a factor of ${t}`:ev;
    return qFrac(`A fair $${n}$-sided die, numbered $1$ to $${n}$, is rolled once. Find $P(\\text{${label}})$.`,fav.length,n,['Write the sample space.','Count favourable outcomes.','Divide favourable by total equally likely outcomes.'],[['Sample space',`$${n}$ equally likely outcomes: $1,2,\\ldots,${n}$.`],['Favourable',`${fav.length}: ${fav.join(', ')}`],['Probability',`$${fr(fav.length,n)}$`]]);
  }
  const red=ri(rng,1,40),blue=ri(rng,1,40),green=ri(rng,1,40),total=red+blue+green,not=pick(rng,['red','blue','green']);
  const non=total-({red,blue,green})[not];
  return qFrac(`A spinner has $${red}$ equal red, $${blue}$ equal blue and $${green}$ equal green sectors. Find $P(\\text{not ${not}})$.`,non,total,['All equal sectors are equally likely.',`Not ${not} means one of the other two colours.`,'Add favourable sectors, then divide by total sectors.'],[['Total',`$${red}+${blue}+${green}=${total}$`],[`Not ${not}`,`$${total}-${({red,blue,green})[not]}=${non}$`],['Probability',`$${fr(non,total)}$`]]);
};

// ── Sequences and progressions ──────────────────────────────────────────────
const sequences = (rng,diff) => {
  if(diff===1){const a=ri(rng,-200,200),d=nzi(rng,-30,30),n=ri(rng,5,100),term=a+(n-1)*d;return q(`An AP starts at $${a}$ with common difference $${d}$. Find its $${n}$th term.`,term,['Use $t_n=a+(n-1)d$.','There are n-1 jumps from term 1 to term n.','Substitute carefully.'],[['Formula','$t_n=a+(n-1)d$'],['Substitute',`$${a}+(${n}-1)${br(d)}$`],['Answer',`$${term}$`]]);}
  if(diff===2){const a=ri(rng,-200,200),d=nzi(rng,-25,25),n=ri(rng,8,120),target=a+(n-1)*d;return q(`In the AP with first term $${a}$ and common difference $${d}$, which term equals $${target}$?`,n,['Set $a+(n-1)d$ equal to the target.','Solve the resulting linear equation for n.','A valid term index must be a natural number.'],[['Equation',`$${target}=${a}+(n-1)${br(d)}$`],['Solve',`$n-1=${n-1}$`],['Answer',`$n=${n}$`]]);}
  if(diff===3){const a=ri(rng,-100,200),d=nzi(rng,-12,20),n=ri(rng,6,80),S=n*(2*a+(n-1)*d)/2;return q(`Find the sum of the first $${n}$ terms of the AP with first term $${a}$ and common difference $${d}$.`,S,['Find the nth term or use the direct AP sum formula.','Use $S_n=\\frac n2[2a+(n-1)d]$.','Simplify inside brackets first.'],[['Formula','$S_n=\\frac n2[2a+(n-1)d]$'],['Substitute',`$\\frac{${n}}2[${2*a}+${n-1}\\times${br(d)}]$`],['Answer',`$S_{${n}}=${S}$`]]);}
  const a=nzi(rng,-30,30),r=pick(rng,[-5,-4,-3,-2,2,3,4,5,6,7]),n=ri(rng,3,Math.abs(r)>=5?6:9),term=a*(r**(n-1));
  return q(`A GP has first term $${a}$ and common ratio $${r}$. Find its $${n}$th term.`,term,['A GP changes multiplicatively, not additively.','Use $t_n=ar^{n-1}$.','Count n-1 ratio multiplications.'],[['Formula','$t_n=ar^{n-1}$'],['Substitute',`$${a}\\times${br(r)}^{${n-1}}$`],['Answer',`$${term}$`]]);
};

export const NCERT_CLASS9_GENERATORS = Object.freeze({
  'c9-coordinate-geometry-ncert-mastery': coordinate,
  'c9-linear-polynomials-ncert-mastery': polynomials,
  'c9-number-systems-ncert-mastery': numbers,
  'c9-algebraic-identities-ncert-mastery': identities,
  'c9-circles-ncert-mastery': circles,
  'c9-perimeter-area-ncert-mastery': mensuration,
  'c9-probability-ncert-mastery': probability,
  'c9-sequences-progressions-ncert-mastery': sequences
});
