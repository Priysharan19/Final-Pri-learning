// Domain-specific verification for the generated affine expectation question.
// E(X) is an operator, NOT the product E*X. Read only a question whose
// prompt establishes this meaning and a finite mean. The answer key and
// worked solution are deliberately never consulted. This is feedback only.
import { normalize, parse, withEvaluationBudget } from './expr.js';
import { exactOf, fraction, sameFraction } from './exact.js';
import { texToPlain, EXTENDED_TEX } from './texToPlain.js';

const add = (a,b) => fraction(a.n*b.d+b.n*a.d,a.d*b.d);
const neg = a => fraction(-a.n,a.d);
const sub = (a,b) => add(a,neg(b));
const mul = (a,b) => fraction(a.n*b.n,a.d*b.d);
const div = (a,b) => fraction(a.n*b.d,a.d*b.n);
const zero = () => fraction(0n);
const one = () => fraction(1n);
const show = a => a.d === 1n ? String(a.n) : String(a.n)+'/'+String(a.d);
const same = (a,b) => sameFraction(a.a,b.a) && sameFraction(a.b,b.b);
const scale = (p,k) => ({ a:mul(p.a,k), b:mul(p.b,k) });
const value = (p,mean) => add(mul(p.a,mean),p.b);

// Prove an affine expression by its coefficients, not by sampling.
// Nonlinear or undefined expressions remain unsupported.
function affine(ast, variable) {
  if (!ast) return null;
  const constant = exactOf(ast);
  if (constant) return { a:zero(), b:constant };
  if (ast.t === 'var' && ast.v === variable) return { a:one(), b:zero() };
  if (ast.t === 'group') return affine(ast.v,variable);
  if (ast.t === 'neg') { const p=affine(ast.v,variable); return p && scale(p,fraction(-1n)); }
  if (ast.t !== 'bin') return null;
  const l=affine(ast.l,variable), r=affine(ast.r,variable);
  if (!l || !r) return null;
  switch (ast.op) {
    case '+': return { a:add(l.a,r.a), b:add(l.b,r.b) };
    case '-': return { a:sub(l.a,r.a), b:sub(l.b,r.b) };
    case '*': return l.a.n===0n ? scale(r,l.b) : r.a.n===0n ? scale(l,r.b) : null;
    case '/': return r.a.n===0n && r.b.n!==0n ? scale(l,div(one(),r.b)) : null;
    default: return null;
  }
}
const parseAffine = (text, variable) => affine(parse(normalize(text)),variable);
const syntax = /^[0-9EX+*/().\s\-−×÷·]+$/u;
function side(text) {
  if (!text || text.length>200 || !syntax.test(text) || /\d\s+\d/.test(text)) return null;
  let t=text.replace(/\s+/g,''), rewritten='', usesExpectation=false, soleExpectation=false;
  for(let i=0;i<t.length;) {
    if(t[i]!=='E') { rewritten+=t[i++]; continue; }
    if(t[i+1]!=='(') return null;
    let end=i+2, depth=1;
    for(;end<t.length&&depth;end++) {
      if(t[end]==='(') depth++;
      else if(t[end]===')') depth--;
    }
    if(depth) return null;
    const inner=t.slice(i+2,end-1);
    if(!inner || /E/.test(inner)) return null;
    const p=parseAffine(inner,'X');
    if(!p) return null;
    // X inside the expectation becomes the symbolic mean M outside.
    rewritten+='(('+show(p.a)+')*M+('+show(p.b)+'))';
    usesExpectation=true; soleExpectation ||= i===0 && end===t.length; i=end;
  }
  if(/X/.test(rewritten)) return null;
  const p=parseAffine(rewritten,'M');
  return p && { ...p, usesExpectation, soleExpectation };
}

function readChain(text) {
  const parts=text.replace(/[−–]/g,'-').split('=').map(s=>s.trim());
  const continued=parts[0]==='';
  if(continued) parts.shift();
  const ps=parts.map(side);
  return ps.length && ps.every(Boolean) && (continued||ps.length>=2) ? {continued,ps} : null;
}

function sameChain(a,b) {
  return a && b && a.continued===b.continued && a.ps.length===b.ps.length &&
    a.ps.every((p,i)=>same(p,b.ps[i]) && p.usesExpectation===b.ps[i].usesExpectation &&
      p.soleExpectation===b.ps[i].soleExpectation);
}

const note = (text, message='Not checked: this mathematical claim could not be verified as affine expectation.') =>
  ({ text, status:'note', state:'unverified', unverified:true, note:message });

function questionMean(q) {
  if(q?.subtopic!=='y12-random-var' || q?._bank || q?.answerType!=='numeric' || Array.isArray(q?.boardScheme) || q?.stepcheck || q?._methodScheme) return null;
  const m=/^\$X\$ is a random variable with \$E\(X\) = (-?\d{1,8})\$\. Find \$E\(([^$]{1,80})\)\$\.$/.exec(String(q.prompt||''));
  if(!m) return null;
  try { if(!side('E('+m[2]+')')) return null; return fraction(BigInt(m[1])); } catch { return null; }
}

/** Null means the existing checker owns this question; a report means the
 * expectation context owns the page. Unsupported lines abstain, rather than
 * being misread by a generic algebra parser. Explicit continuations compare
 * against the student's own previous value; no hidden answer is used. */
export function stepCheckExpectation(q, working, opts=null) {
  return withEvaluationBudget(600000,()=>{
    const mean=questionMean(q);
    if(!mean || typeof working!=='string' || !working.trim()) return null;
    const raw=working.split('\n').map(s=>s.trim());
    // A recognizer's two readings must agree before either can be treated
    // as verified. Duplicate text with conflicting TeX remains ambiguous.
    const pairs=Array.isArray(opts?.latex)?opts.latex:[];
    const byText=new Map();
    for(const pair of pairs) {
      const key=String(pair?.text??'').trim(), tex=pair?.latex;
      if(!key || typeof tex!=='string' || !tex.trim()) continue;
      byText.set(key,byText.has(key)&&byText.get(key)!==tex?null:tex);
    }
    const lines=[], gaps=new Set(Array.isArray(opts?.gaps)?opts.gaps:[]);
    let previous=null, previousError=null, firstBreak=-1, diagnosis=null;
    for(const text of raw) {
      if(!text) { previous=null; previousError=null; continue; }
      const i=lines.length;
      if(gaps.has(i)) { previous=null; previousError=null; }
      if(i>=100 || text.length>200) { lines.push(note(text)); previous=null; previousError=null; continue; }
      let reading=null, agreed=false;
      try {
        reading=readChain(text);
        if(byText.has(text)) {
          const tex=byText.get(text);
          const plain=tex && tex.length<=800 ? texToPlain(tex,EXTENDED_TEX) : null;
          agreed=!!(plain && sameChain(reading,readChain(plain)));
          if(!agreed) reading=null;
        }
      } catch { reading=null; }
      if(!reading || (reading.continued&&!previous)) {
        lines.push(note(text)); previous=null; previousError=null; continue;
      }
      const {continued,ps}=reading;
      const chain=continued?[previous,...ps]:ps;
      let vs;
      try { vs=chain.map(p=>value(p,mean)); } catch { lines.push(note(text)); previous=null; previousError=null; continue; }
      const wrong=vs.findIndex(v=>!sameFraction(v,vs[0]));
      const prior=previous, inherited=continued?previousError:null; previous=ps[ps.length-1]; previousError=inherited;
      if(wrong>=0) {
        // A second OCR reading needs explicit reconciliation before a cross.
        // Do not claim the text is false if there is unresolved visual evidence.
        // Nor infer an independent new error from an earlier wrong given.
        if((pairs.length&&!agreed) || (firstBreak>=0 && chain.some(p=>p.usesExpectation))) {
          lines.push(note(text,'Not checked: the reading or earlier mistake needs confirmation.')); previous=null; previousError=null; continue;
        }
        const message='The two sides of this equality have different exact values ('+show(vs[0])+' and '+show(vs[wrong])+').';
        const dg={message,whyWrong:message,errorType:'expectation-equality',fromLine:continued?i:undefined};
        // The exact values prove the claim false; they do not necessarily prove
        // which expression the student intended, so do not invent a correction.
        lines.push({text,status:'break',state:'wrong',note:message,diagnosis:dg});
        previousError=i;
        if(firstBreak<0) {firstBreak=i;diagnosis=dg;}
        continue;
      }
      const given=!continued&&/^E\(X\)\s*=/.test(text.replace(/\s+/g,''))&&chain.length===2&&chain[0].usesExpectation&&same(chain[0],{a:one(),b:zero()})&&!chain[1].usesExpectation;
      const linear=!continued&&chain[0].soleExpectation&&chain.slice(1).some(p=>p.usesExpectation&&!p.soleExpectation&&same(p,chain[0]))&&chain.every(p=>!p.usesExpectation||same(p,chain[0]));
      const substituted=continued&&prior?.usesExpectation&&!previous.usesExpectation;
      const carried=inherited!==null;
      const msg=given?'Identifies the expected value given in the question.':
        linear?'Correct use of linearity of expectation: scale the mean by the coefficient and add the constant.':
        carried?'Correct continuation from the preceding line, using the given mean where needed.':
        substituted?'Correct substitution of the given expected value.':
        chain.some(p=>p.usesExpectation)?'Both sides have the same exact value using the given mean.':'Correct arithmetic: the expressions have equal exact values.';
      lines.push({text,status:'ok',state:given?'given':chain.some(p=>p.usesExpectation)?'verified':'arithmetic',note:msg,
        comment:msg,tickClass:given?'restated-function':linear?'expectation-linearity':substituted?'substitution-evaluated':chain.some(p=>p.usesExpectation)?'exact-value':'arithmetic-chain',
        ...(carried?{followsFromError:true,followsFrom:inherited+1}:{})});
    }
    const at=s=>lines.flatMap((l,i)=>l.state===s?[i+1]:[]);
    const unverified=at('unverified');
    return {lines,firstBreak,diagnosis,source:'value-chain',arithmetic:true,summary:{
      total:lines.length,checked:lines.filter(l=>l.status==='ok').length,given:at('given'),verified:at('verified'),
      arithmetic:at('arithmetic'),conditions:[],wrong:at('wrong'),unverified,unread:[],reason:unverified.length?'Some expressions need more context or a clearer reading.':null}};
  });
}
