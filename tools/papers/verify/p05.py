#!/usr/bin/env python3
"""Independent computational verification of the answer keys and MCQ keys of Practice Paper 05
(Prithagoras HSC Mathematics Extension 1, 2027). Every item is computed from the question statement;
nothing is checked by evaluating the guideline's own final formula. Run: /tmp/symenv/bin/python tools/papers/verify/p05.py
Exit 1 on any FAIL, unchecked keyed id, or DISAGREE not listed in KNOWN_DISAGREEMENTS."""
NN = "05"
# ---- shared harness (copied into each verify script) ----
import json, os, re, sys, math, itertools, random
from fractions import Fraction as Fr
import sympy as sp
import mpmath as mp
mp.mp.dps = 30
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', '..'))
OVR = json.load(open(os.path.join(ROOT, 'tools/papers/overrides/ext1-2027-p%s.json' % NN)))['keys']
STR = json.load(open(os.path.join(ROOT, 'server/content/papers/nsw-ext1/structured/ext1-2027-p%s.json' % NN)))
FIGS_TEX = "/Users/priysharantripathi/Desktop/Tuitions/Papers/EXT 1/Prithagoras - rebuilt 2026-11-18/LaTeX sources/work/Paper %s/LaTeX/E1-%s_figs.tex" % (NN, NN)
GUIDE_MCQ = {}
for _s in STR['sections']:
    for _q in _s['questions']:
        for _p in _q['parts']:
            if (_p.get('key') or {}).get('type') == 'mcq':
                GUIDE_MCQ[_p['id']] = _p['key']['answer']
RES = []          # (id, status)
CHECKED = set()
def report(item, status, method):
    RES.append((item, status)); print(f"{item} {status} ({method})", flush=True)
def close(a, b, tol=1e-9):
    return abs(a - b) <= tol * max(1.0, abs(a), abs(b))
def mcq(item, letter, method):
    g = GUIDE_MCQ[item]
    if letter == g:
        report(item, 'PASS', f"computed {letter} = guideline {g}; {method}")
    else:
        report(item, 'DISAGREE', f"computed {letter} but guideline {g}; {method}")
def part(item, ok, method, keyed=True):
    if keyed: CHECKED.add(item)
    report(item, 'PASS' if ok else 'FAIL', method)
def unverified(item, why): report(item, 'UNVERIFIED', why)
def kexpr(item, syms):
    """sympy expression of the key's expr (engine syntax) for the override file"""
    s = OVR[item]['key']['expr'].replace('^', '**')
    loc = {k: sp.Symbol(k) for k in syms}
    loc.update({'ln': sp.log, 'pi': sp.pi, 'e': sp.E, 'asin': sp.asin, 'acos': sp.acos, 'atan': sp.atan,
                'sqrt': sp.sqrt, 'sin': sp.sin, 'cos': sp.cos, 'tan': sp.tan, 'nCr': sp.binomial})
    return sp.sympify(s, locals=loc)
def figpoly(name):
    """points of the 1.3pt curve of a TikZ figure macro in the paper's _figs.tex"""
    t = open(FIGS_TEX).read()
    i = t.index('\\newcommand{\\%s}' % name)
    j = t.find('\\newcommand', i + 10)
    blk = t[i: j if j > 0 else len(t)]
    m = re.search(r'line width=1\.3pt\]((?: ?\([-\d.]+,[-\d.]+\) ?(?:--)?)+)', blk)
    return [(float(a), float(b)) for a, b in re.findall(r'\(([-\d.]+),([-\d.]+)\)', m.group(1))]
def finish(known):
    CHECKED_ALL = set(OVR.keys())
    missing = sorted(CHECKED_ALL - CHECKED)
    nk = sum(1 for i, s in RES if s == 'PASS' and i in OVR)
    nm = sum(1 for i, s in RES if s == 'PASS' and i in GUIDE_MCQ)
    nd = sum(1 for i, s in RES if s == 'DISAGREE' and i in GUIDE_MCQ)
    nu = sum(1 for i, s in RES if s == 'UNVERIFIED')
    bad = [i for i, s in RES if s == 'FAIL']
    unk = [i for i, s in RES if s == 'DISAGREE' and i not in known]
    # a DISAGREE on a keyed part means the key must not be shipped
    shipped_dis = [i for i, s in RES if s == 'DISAGREE' and i in OVR]
    kd = [i for i, s_ in RES if s_ == 'DISAGREE' and i in known]
    if kd: print('KNOWN DISAGREEMENTS (author guideline differs from computation; no key shipped):', kd)
    if missing: print('KEYED IDS WITHOUT A CHECK:', missing)
    if unk: print('DISAGREE NOT IN KNOWN_DISAGREEMENTS:', unk)
    if shipped_dis: print('DISAGREE ON A SHIPPED KEY:', shipped_dis)
    print(f"PAPER {NN}: {nk} keyed parts PASS, {nm} MCQ PASS, {nd} MCQ DISAGREE, {nu} UNVERIFIED")
    sys.exit(1 if (bad or missing or unk or shipped_dis) else 0)
KNOWN_DISAGREEMENTS = set()

def figtext(name):
    t = open(FIGS_TEX).read(); i = t.index('\\newcommand{\\%s}' % name); j = t.find('\\newcommand', i + 10)
    return t[i: j if j > 0 else len(t)]

def q1():
    x = sp.Symbol('x'); P = sp.Poly((x-1)*(x-2)*(x-3)*(x-4) + 1, x)
    n = len(sp.real_roots(P, multiple=False)) if False else len(set(sp.real_roots(P)))
    mcq('q1', {0:'A',2:'B',3:'C',4:'D'}.get(n, '?'), f"exact real roots of (x-1)(x-2)(x-3)(x-4)+1: {sorted(set(sp.real_roots(P)), key=float)} -> {n} different")

def q2():
    ks = set()
    for ph in (0.3, 0.9, 1.7, 2.6):
        a = sp.Matrix([3, 0]); b = 2*sp.Matrix([sp.cos(ph), sp.sin(ph)]); k = sp.Symbol('k', positive=True)
        s = sp.solve(sp.Eq((a + k*b).dot(a - k*b), 0), k)
        ks |= {round(float(v), 9) for v in s}
    opts = {'A': 1.5, 'B': 2/3, 'C': 9/4, 'D': math.sqrt(6)/2}
    L = [c for c, v in opts.items() if ks == {round(v, 9)}]
    mcq('q2', L[0] if L else '?', f"vectors a=(3,0), b=2(cos t, sin t) at 4 angles: positive k solving (a+kb).(a-kb)=0 is always {ks}")

def q3():
    p = sp.Symbol('p', positive=True); ok = {c: True for c in 'ABCD'}
    for n in range(2, 9):
        sol = [s for s in sp.solve(sp.Eq((1-p)**n, n*p*(1-p)**(n-1)), p) if 0 < s < 1]
        assert len(sol) == 1; pv = sol[0]; mean = n*pv
        for c, val in {'A': pv, 'B': 1, 'C': n*(1-pv), 'D': 1-pv}.items(): ok[c] &= sp.simplify(mean - val) == 0
    L = [c for c, v in ok.items() if v]
    mcq('q3', L[0] if len(L) == 1 else '?', "for n=2..8 solve P(X=0)=P(X=1) for p exactly, mean np compared with each option")

def q4():
    f = lambda x: x**3 + x
    g = lambda y: mp.findroot(lambda x: f(x) - y, 2)
    d = mp.diff(g, 10)
    opts = {'A': mp.mpf(1)/301, 'B': 13, 'C': mp.mpf(1)/13, 'D': mp.mpf(1)/10}
    L = [c for c, v in opts.items() if abs(d - v) < 1e-15]
    mcq('q4', L[0] if L else '?', f"inverse function by root-finding, numerical derivative at 10 = {mp.nstr(d, 15)}")

def q5():
    pts = [(i, j, 3-i-j) for i in range(4) for j in range(4-i)]
    share = lambda p, q: any(p[m] == q[m] for m in range(3))
    n = 0
    for a, b, c in itertools.combinations(pts, 3):
        if share(a, b) and share(b, c) and share(a, c) and not any(a[m] == b[m] == c[m] for m in range(3)): n += 1
    mcq('q5', {9:'A',10:'B',13:'C',16:'D'}.get(n, '?'), f"triangular lattice with 3 divisions (10 nodes): triples joined pairwise by grid lines and not collinear: {n}")

def q6():
    t = sp.Symbol('t'); x = sp.Symbol('x')
    opts = {'A': ((1+t)/(1-t))**2, 'B': (1+t)/(1-t), 'C': (1+t**2)/(1-t**2), 'D': ((1+t**2)/(1-t**2))**2}
    good = {c: True for c in opts}
    for xv in [-1.4, -0.9, -0.3, 0.2, 0.8, 1.3]:
        lhs = (1 + math.sin(xv))/(1 - math.sin(xv)); tv = math.tan(xv/2)
        for c, e in opts.items(): good[c] &= abs(float(e.subs(t, tv)) - lhs) < 1e-12
    L = [c for c, v in good.items() if v]
    mcq('q6', L[0] if len(L) == 1 else '?', "numerical comparison at 6 values of x in (-pi/2,pi/2)")

def q7():
    errs = {}
    for L in 'ABCD':
        P = figpoly('figwh' + L)
        errs[L] = max(abs(y/1.15 - 2*abs(math.sin(math.pi*x/2.765))) for x, y in P)
    good = [k for k, e in errs.items() if e < 0.03]
    mcq('q7', good[0] if len(good) == 1 else '?', "d = chord length from the bottom point = |2 sin(pi t/T)| from coordinates of a point on the unit circle; plotted curves (T at 2.765, d=2 at 2.3): max errors " + ', '.join(f"{k}:{v:.3f}" for k, v in errs.items()))

def q8():
    b = figtext('figfield')
    segs = [tuple(map(float, m)) for m in re.findall(r'\\draw\[line width=0\.8pt\] \(([-\d.]+),([-\d.]+)\) -- \(([-\d.]+),([-\d.]+)\);', b)]
    opts = {'A': lambda x, y: x*x - y, 'B': lambda x, y: y - x*x, 'C': lambda x, y: x - y*y, 'D': lambda x, y: y*y - x}
    errs = {c: 0.0 for c in opts}
    for (x0, y0, x1, y1) in segs:
        cx, cy = round((x0+x1)/2*2)/2, round((y0+y1)/2*2)/2     # field points lie on a 1/2 lattice
        ang = math.atan2(y1-y0, x1-x0); ang = (ang + math.pi/2) % math.pi - math.pi/2
        for c, f in opts.items():
            errs[c] = max(errs[c], abs(math.atan(f(cx, cy)) - ang))
    good = [c for c, e in errs.items() if e < 0.05]
    mcq('q8', good[0] if len(good) == 1 else '?', f"{len(segs)} slope-field segments read from the figure, angle of each vs atan(f(x,y)) at its midpoint: max angle errors " + ', '.join(f"{k}:{v:.3f}" for k, v in errs.items()))

def q9():
    g = 9.8; V = 17.0; th = math.pi/4
    # simulate flight in small steps (semi-exact via the quadratic) and take height max and landing distance
    T = 2*V*math.sin(th)/g
    ts = [T*i/200000 for i in range(200001)]
    H = max(V*math.sin(th)*t - 0.5*g*t*t for t in ts)
    R = V*math.cos(th)*T
    r = R/H
    opts = {'A': 2, 'B': 2*math.sqrt(2), 'C': 8, 'D': 4}
    L = [c for c, v in opts.items() if abs(r - v) < 1e-6]
    mcq('q9', L[0] if L else '?', f"time-stepped flight at 45 degrees: range/H = {r:.8f}")

def q10():
    # conflict graph on 1..30: edge when sum is 31; maximum independent set by exhaustive search per component
    adj = {v: {31 - v} for v in range(1, 31)}
    seen, comps = set(), []
    for v in adj:
        if v in seen: continue
        c = {v} | adj[v]; seen |= c; comps.append(sorted(c))
    mis = 0
    for c in comps:
        best = 0
        for r in range(len(c)+1):
            for S in itertools.combinations(c, r):
                if all(31 - a != b for a in S for b in S): best = max(best, r)
        mis += best
    mcq('q10', {14:'A',15:'B',16:'C',17:'D'}.get(mis+1, '?'), f"largest subset of 1..30 with no two summing to 31 has {mis} elements, so {mis+1} integers force a pair")

# ------------------------------------------------------------- keyed parts
def q11a():
    x, k = sp.symbols('x k'); P = lambda z: z**3 - 3*z + k
    res = sp.factor(sp.resultant(P(x), P(x+1), x))
    ks = sorted([float(r) for r in sp.real_roots(sp.Poly(res, k))])
    # confirm each k really has two zeros differing by 1
    ok = len(ks) == 2
    for kv in ks:
        rr = [complex(z) for z in sp.Poly(x**3 - 3*x + sp.nsimplify(kv, [sp.sqrt(33)]), x).nroots(n=30)]
        ok &= any(abs(abs(u - v) - 1) < 1e-8 for u, v in itertools.combinations(rr, 2))
    key = sorted(OVR['q11a']['key']['values'])
    ok &= len(key) == 2 and all(abs(a - b) < 1e-12 for a, b in zip(ks, key))
    part('q11a', ok, f"resultant of P(x) and P(x+1) in x, real roots in k: {ks}; each k checked to have two zeros differing by 1")

def q11b():
    f = lambda x: mp.sin(x)*mp.sin(mp.pi/3 - x)*mp.sin(mp.pi/3 + x) - mp.mpf(1)/8
    xs = [mp.pi*i/20000 for i in range(1, 20000)]
    roots = [mp.findroot(f, (u+v)/2) for u, v in zip(xs, xs[1:]) if f(u)*f(v) < 0]
    key = sorted(OVR['q11b']['key']['values'])
    ok = len(roots) == 4 and len(key) == 4 and all(abs(a - b) < 1e-12 for a, b in zip(sorted(roots), key))
    part('q11b', ok, f"sign-change scan of the product - 1/8 on (0,pi) and refinement: {[mp.nstr(r, 12) for r in sorted(roots)]}")

def q11d():
    # The word PRITHAGORAS (11 letters; the A's and the R's repeat). The guideline was written for the 10-letter word PRITAGORAS and was
    # not recomputed when the brand was respelled (19 Nov 2026); the corrected answer is verified three independent ways.
    from sympy.utilities.iterables import multiset_permutations
    word = 'PRITHAGORAS'
    L = len(word)
    assert L == 11 and word.count('A') == 2 and word.count('R') == 2 and len(set(word)) == 9
    # 1 · brute force over EVERY distinct arrangement of the multiset (11!/(2!2!) = 9,979,200 of them)
    seen = 0; good = 0
    for w in multiset_permutations(list(word)):
        seen += 1
        ok = True
        for k in range(L - 1):
            if w[k] == w[k + 1] and w[k] in 'AR': ok = False; break
        good += ok
    # 2 · inclusion-exclusion
    allp = math.factorial(L) // 4; ta = math.factorial(L - 1) // 2; both = math.factorial(L - 2)
    ie = allp - 2 * ta + both
    # 3 · place the A's, then the R's, in non-adjacent places; the other seven letters are distinct
    cnt = 0
    for A in itertools.combinations(range(L), 2):
        if A[1] - A[0] == 1: continue
        rest = [i for i in range(L) if i not in A]
        for R in itertools.combinations(rest, 2):
            if R[1] - R[0] == 1: continue
            cnt += 1
    placed = cnt * math.factorial(7)
    key = OVR['q11d']['key']['value']
    old10 = math.factorial(10) // 4 - 2 * (math.factorial(9) // 2) + math.factorial(8)   # what the 10-letter word PRITAGORAS gives: 584,640
    part('q11d', seen == allp and good == ie == placed == int(key) == 6713280 and old10 == 584640,
         f"PRITHAGORAS: brute force over all {seen} distinct arrangements = {good}; inclusion-exclusion = {ie} (total {allp}, A's together {ta}, both pairs {both}); placements {cnt} x 7! = {placed}; the old guideline's 584640 is the 10-letter PRITAGORAS ({old10})")

def q11e():
    v = mp.quad(lambda x: (x*x + 1)/(x**4 - x*x + 1), [1, (1 + mp.sqrt(5))/2])
    part('q11e', abs(v - OVR['q11e']['key']['value']) < 1e-15, f"mpmath quad = {mp.nstr(v, 20)} = pi/4")

def q12b():
    # area by Green's theorem (1/2) closed integral of x dy - y dx over the stated parametric curve
    A = mp.quad(lambda t: (mp.cos(t)**3*3*mp.sin(t)**2*mp.cos(t) + mp.sin(t)**3*3*mp.cos(t)**2*mp.sin(t))/2, mp.linspace(0, 2*mp.pi, 9))
    ke = mp.mpf(sp.N(kexpr('q12b', []), 30))
    part('q12b', abs(A - ke) < 1e-20, f"Green's theorem area of x=cos^3 t, y=sin^3 t: {mp.nstr(A, 20)} equals key")

def q12c_i():
    n, p = sp.symbols('n p'); ke = kexpr('q12c-i', ['n', 'p']); ok = True
    for N in range(3, 9):
        for pv in (Fr(1, 5), Fr(2, 3)):
            tot = sum(Fr(math.comb(N, j))*pv**j*(1-pv)**(N-j) for j in (0, 1))     # P(at most one defective)
            ok &= sp.Rational(tot.numerator, tot.denominator) == ke.subs({'n': N, 'p': sp.Rational(pv.numerator, pv.denominator)})
    part('q12c-i', ok, "exact binomial P(at most 1 defective) for n=3..8, p=1/5, 2/3 equals the key")

def q12c_iii():
    ke = kexpr('q12c-iii', ['n']); ok = True
    for N in range(3, 11):
        A = lambda p: (1-p)**N + N*p*(1-p)**(N-1)
        # evaluate A from the binomial sum itself
        Ab = lambda p: sum(mp.binomial(N, j)*p**j*(1-p)**(N-j) for j in (0, 1))
        dA = lambda p: mp.diff(Ab, p)
        lo, hi = mp.mpf('1e-6'), 1 - mp.mpf('1e-6'); gr = (mp.sqrt(5)-1)/2
        c, d = hi - gr*(hi-lo), lo + gr*(hi-lo)
        for _ in range(100):
            if -dA(c) > -dA(d): hi = d
            else: lo = c
            c, d = hi - gr*(hi-lo), lo + gr*(hi-lo)
        ok &= abs((lo+hi)/2 - mp.mpf(sp.N(ke.subs('n', N), 30))) < 1e-9
    part('q12c-iii', ok, "A(p) from the binomial sum, steepest descent point by golden-section search of -A'(p) for n=3..10 equals 1/(n-1) to 1e-9")

def q13a_i():
    ke = kexpr('q13a-i', ['a', 'b', 'theta']); ok = True
    for av, bv, th in [(5, 3, 0.7), (2, 1, 2.5), (7, 4, 3.0), (3, 0.5, 1.1)]:
        M = (av, 0); H = (bv*math.cos(th), bv*math.sin(th))
        d = math.hypot(M[0]-H[0], M[1]-H[1])
        ok &= abs(d - float(ke.subs({'a': av, 'b': bv, 'theta': th}))) < 1e-12
    part('q13a-i', ok, "distance between tips from coordinates M=(a,0), H=(b cos t, b sin t) at 4 (a,b,theta) equals the key")

def _dd(av, bv):
    d = lambda th: mp.sqrt((av - bv*mp.cos(th))**2 + (bv*mp.sin(th))**2)
    return d, (lambda th: mp.diff(d, th))

def q13a_iii():
    ke = kexpr('q13a-iii', ['a', 'b']); ok = True
    for av, bv in [(5, 3), (2, 1), (7, 4), (3, 0.5), (10, 9)]:
        av, bv = mp.mpf(av), mp.mpf(bv); d, dd = _dd(av, bv)
        lo, hi = mp.mpf('1e-5'), mp.pi - mp.mpf('1e-5'); gr = (mp.sqrt(5)-1)/2
        c, e = hi - gr*(hi-lo), lo + gr*(hi-lo)
        for _ in range(100):
            if dd(c) > dd(e): hi = e
            else: lo = c
            c, e = hi - gr*(hi-lo), lo + gr*(hi-lo)
        ok &= abs(mp.cos((lo+hi)/2) - mp.mpf(sp.N(ke.subs({'a': sp.Float(str(av), 30), 'b': sp.Float(str(bv), 30)}), 30))) < 1e-9
    part('q13a-iii', ok, "maximise d'(theta) of the tip distance (coordinates) by golden-section search for 5 (a>b); cos at the maximiser equals b/a to 1e-9")

def q13a_iv():
    ke = kexpr('q13a-iv', ['b', 'omega']); ok = True
    for av, bv in [(5, 3), (2, 1), (7, 4), (3, 0.5), (10, 9)]:
        av, bv = mp.mpf(av), mp.mpf(bv); d, dd = _dd(av, bv)
        best = max(dd(mp.pi*i/4000) for i in range(1, 4000))
        best = max(best, max(dd(mp.pi*i/4000 + s) for i in range(1, 4000, 200) for s in (mp.mpf('1e-5'), -mp.mpf('1e-5'))))
        ok &= abs(best - mp.mpf(sp.N(ke.subs({'b': sp.Float(str(bv), 30), 'omega': 1}), 30))) < 1e-5
    part('q13a-iv', ok, "greatest value of d'(theta) (omega=1) over a fine grid for 5 (a>b) equals b to 1e-5 (grid max is a lower bound, within 1e-5)")

def q13b_ii():
    key = OVR['q13b-ii']['key']; ok = key['lhs'].replace(' ', '') == 'U*sin(alpha)' and key['rhs'].replace(' ', '') == 'W*sin(beta)'
    rng = random.Random(5)
    def pq(U, al, W, be, dd, t): return (dd - (U*math.cos(al) + W*math.cos(be))*t, (W*math.sin(be) - U*math.sin(al))*t)
    for _ in range(30):
        U, W, d = rng.uniform(5, 30), rng.uniform(5, 30), rng.uniform(5, 50)
        al = rng.uniform(0.2, 1.3); be0 = rng.uniform(0.2, 1.3)
        # case 1: choose beta so that U sin(alpha)=W sin(beta) (if possible) -> collide at t=d/(U cos a+W cos b)
        s = U*math.sin(al)/W
        if s < 1:
            be = math.asin(s); t = d/(U*math.cos(al) + W*math.cos(be))
            px, py = pq(U, al, W, be, d, t); ok &= abs(px) < 1e-9 and abs(py) < 1e-9
        # case 2: condition false -> the separation never vanishes: min over t>0 of |PQ| is >0
        if abs(U*math.sin(al) - W*math.sin(be0)) > 1e-3:
            m = U*math.cos(al) + W*math.cos(be0); n = W*math.sin(be0) - U*math.sin(al); ts = d*m/(m*m + n*n)
            px, py = pq(U, al, W, be0, d, ts); ok &= math.hypot(px, py) > 1e-6
    part('q13b-ii', ok, "30 random (U,W,alpha,beta,d): choosing beta to satisfy U sin(alpha)=W sin(beta) gives PQ=0 at t=d/(U cos+W cos); otherwise the minimum of |PQ| over t is positive")

def q13b_iii():
    ke = kexpr('q13b-iii', ['d', 'U', 'W', 'alpha', 'beta']); ok = True
    rng = random.Random(6)
    for _ in range(12):
        d, U, W = rng.uniform(5, 50), rng.uniform(5, 30), rng.uniform(5, 30)
        al, be = rng.uniform(0.2, 1.3), rng.uniform(0.2, 1.3)
        f = lambda t: mp.sqrt((d - (U*mp.cos(al) + W*mp.cos(be))*t)**2 + ((W*mp.sin(be) - U*mp.sin(al))*t)**2)
        lo, hi = mp.mpf(0), mp.mpf(2*d)/(U*mp.cos(al) + W*mp.cos(be)); gr = (mp.sqrt(5)-1)/2
        c, e = hi - gr*(hi-lo), lo + gr*(hi-lo)
        for _ in range(150):
            if f(c) < f(e): hi = e
            else: lo = c
            c, e = hi - gr*(hi-lo), lo + gr*(hi-lo)
        ok &= abs(f((lo+hi)/2) - mp.mpf(sp.N(ke.subs({'d': d, 'U': U, 'W': W, 'alpha': al, 'beta': be}), 30))) < 1e-9
    part('q13b-iii', ok, "12 random parameter sets: minimum of |PQ(t)| from the position vectors by golden-section search equals the key to 1e-9")

def q14a_i():
    ke = kexpr('q14a-i', ['Q', 'k']); ok = True
    for Qv, kv, A in [(2, 1, 3), (5, 2, 1), (1.5, 0.7, 4)]:
        # integrate A h' = Q - k sqrt(h) to equilibrium with RK4 (float) and root-find the zero of the rate
        h = 0.0; dt = 0.001
        f = lambda hh: (Qv - kv*math.sqrt(max(hh, 0)))/A
        for _ in range(int(60*A/kv/dt)):
            k1 = f(h); k2 = f(h + dt*k1/2); k3 = f(h + dt*k2/2); k4 = f(h + dt*k3); h += dt*(k1 + 2*k2 + 2*k3 + k4)/6
        zero = mp.findroot(lambda hh: Qv - kv*mp.sqrt(hh), 1)
        kk = float(ke.subs({'Q': Qv, 'k': kv}))
        ok &= abs(zero - kk) < 1e-10 and abs(h - kk) < 1e-3*kk
    part('q14a-i', ok, "root of the net inflow Q-k sqrt(h)=0 and a long RK4 integration of A h' = Q-k sqrt(h) both settle at the key depth, 3 parameter sets")

def q14a_iii():
    ke = kexpr('q14a-iii', ['A', 'Q', 'k']); ok = True
    for A, Qv, kv in [(3, 2, 1), (1, 5, 2), (4, 1.5, 0.7)]:
        H = (Qv/kv)**2; target = H/4
        # time by integrating dt = A dh/(Q - k sqrt(h))
        T1 = mp.quad(lambda h: A/(Qv - kv*mp.sqrt(h)), [0, target])
        # independent forward simulation of the tank (RK4, small step) until the depth first reaches H/4
        h = 0.0; t = 0.0; dt = 1e-4
        f = lambda hh: (Qv - kv*math.sqrt(max(hh, 0)))/A
        while h < target:
            k1 = f(h); k2 = f(h + dt*k1/2); k3 = f(h + dt*k2/2); k4 = f(h + dt*k3); h += dt*(k1 + 2*k2 + 2*k3 + k4)/6; t += dt
        kk = float(ke.subs({'A': A, 'Q': Qv, 'k': kv}))
        ok &= abs(T1 - kk) < 1e-12 and abs(t - kk) < 1e-3*kk
    part('q14a-iii', ok, "time to reach H/4 from dt=A dh/(Q-k sqrt h) by quadrature (1e-12) and by an RK4 forward simulation (1e-3), 3 parameter sets; equals the key")

def q14b_i():
    n, p = sp.symbols('n p'); ke = kexpr('q14b-i', ['n', 'p']); ok = True
    for N in range(1, 8):
        for pv in (Fr(1, 6), Fr(2, 5)):
            E = Fr(0)
            for bust in itertools.product([0, 1], repeat=N):          # every outcome of the N rolls
                pr = Fr(1)
                for b in bust: pr *= pv if b else 1-pv
                E += pr * (0 if any(bust) else N)
            ok &= sp.Rational(E.numerator, E.denominator) == ke.subs({'n': N, 'p': sp.Rational(pv.numerator, pv.denominator)})
    part('q14b-i', ok, "exact enumeration of all 2^n bust/no-bust outcomes, n=1..7, p=1/6, 2/5: expected score equals the key")

def q14b_ii():
    E = {n: n*Fr(5, 6)**n for n in range(1, 400)}
    m = max(E.values()); arg = sorted(n for n, v in E.items() if v == m)
    key = sorted(OVR['q14b-ii']['key']['values'])
    part('q14b-ii', arg == [5, 6] and key == [5, 6], f"exact fractions n(5/6)^n for n=1..399: maximum attained at n={arg}")

ITEMS = [q1, q2, q3, q4, q5, q6, q7, q8, q9, q10, q11a, q11b, q11d, q11e, q12b, q12c_i, q12c_iii, q13a_i, q13a_iii, q13a_iv, q13b_ii, q13b_iii, q14a_i, q14a_iii, q14b_i, q14b_ii]
if __name__ == '__main__':
    for fn in ITEMS:
        try: fn()
        except Exception as e:
            import traceback; traceback.print_exc()
            report(fn.__name__.upper(), 'FAIL', f'script error {type(e).__name__}: {e}')
    finish(KNOWN_DISAGREEMENTS)
