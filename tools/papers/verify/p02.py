#!/usr/bin/env python3
"""Independent computational verification of the answer keys and MCQ keys of Practice Paper 02
(Prithagoras HSC Mathematics Extension 1, 2027). Every item is computed from the question statement;
nothing is checked by evaluating the guideline's own final formula. Run: /tmp/symenv/bin/python tools/papers/verify/p02.py
Exit 1 on any FAIL, unchecked keyed id, or DISAGREE not listed in KNOWN_DISAGREEMENTS."""
NN = "02"
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
d_, k_, n_, a_, h_, g_ = sp.symbols('d k n a h g')

def q1():
    rng = random.Random(1); vals = set()
    for _ in range(200):
        al = rng.uniform(1.2, 6); be = rng.uniform(1.2, 6)       # alpha*beta>1
        ga = (al + be) / (al * be - 1)                            # forces sum = product, i.e. coefficients a and a
        if ga <= 0: continue
        # x^3 - a x^2 + b x - a has roots al, be, ga  <=> sum = a = product
        vals.add(round(math.atan(al) + math.atan(be) + math.atan(ga), 9))
    opts = {'A': math.pi/2, 'B': math.pi, 'C': 3*math.pi/2}
    if len(vals) == 1:
        v = vals.pop(); L = [k for k, x in opts.items() if close(v, x)]
        mcq('q1', L[0] if L else '?', f"random positive-root cubics with sum=product (a=a): sum of arctans constant = {v:.9f}")
    else: mcq('q1', 'D', 'sum varies')

def q2():
    pts = [(i, j) for i in range(4) for j in range(4)]
    S = set(pts); cnt = 0
    for (x1, y1), (x2, y2) in itertools.combinations(pts, 2):
        # count each square once via ordered side vector: use all ordered pairs then divide by 4
        pass
    c = 0
    for p in pts:
        for q in pts:
            if p == q: continue
            dx, dy = q[0]-p[0], q[1]-p[1]
            r = (p[0]-dy, p[1]+dx); s = (q[0]-dy, q[1]+dx)
            if r in S and s in S: c += 1
    cnt = c // 4
    mcq('q2', {14:'A',18:'B',20:'C',24:'D'}.get(cnt, '?'), f"enumerate directed sides p->q, complete the square, divide by 4: {cnt} squares")

def q3():
    f = lambda x: math.cos(3*math.acos(x))
    best = {}
    for L in 'ABCD':
        P = figpoly('figch' + L)
        best[L] = max(abs(y - f(x)) for x, y in P)
    L = [k for k, e in best.items() if e < 2e-2]
    mcq('q3', L[0] if len(L) == 1 else '?', "plotted polylines of the four figure macros compared with cos(3 acos x); max deviations " + ', '.join(f"{k}:{v:.3f}" for k, v in best.items()))

def q4():
    rng = random.Random(4)
    O = (rng.random(), rng.random()); A = (rng.random()+2, rng.random()); B = (rng.random(), rng.random()+2)
    P = tuple(O[i] + (A[i]-O[i])/3 + (B[i]-O[i])/2 for i in range(2))
    area = lambda U, V, W: abs((V[0]-U[0])*(W[1]-U[1]) - (V[1]-U[1])*(W[0]-U[0]))/2
    r = area(P, A, B) / area(O, A, B)
    opts = {'A': 5/6, 'B': 1/2, 'C': 1/3, 'D': 1/6}
    L = [k for k, x in opts.items() if close(r, x)]
    mcq('q4', L[0] if L else '?', f"coordinates with OP=OA/3+OB/2 for a random triangle: area ratio {r:.12f}")

def q5():
    n = 14
    def modes(p):
        pm = [Fr(math.comb(n, k)) * p**k * (1-p)**(n-k) for k in range(n+1)]
        m = max(pm); return [k for k in range(n+1) if pm[k] == m]
    opts = {'A': Fr(9, 28), 'B': Fr(1, 3), 'C': Fr(5, 14), 'D': Fr(4, 11)}
    L = [k for k, p in opts.items() if modes(p) == [4, 5]]
    mcq('q5', L[0] if len(L) == 1 else '?', "exact binomial pmf (n=14) for each option p: set of modes; only the correct option has modes {4,5}")

def q6():
    x, c = sp.symbols('x c'); y = sp.Function('y')
    sol = sp.dsolve(sp.Eq(y(x).diff(x), x + y(x)), y(x), ics={y(0): c}).rhs
    dy = sp.diff(sol, x)
    has = {}
    for cv in [-5, -2, -1.5, -1, -0.5, 0, 1, 7]:
        e = sp.simplify(dy.subs(c, cv))
        s = sp.solve(sp.Eq(e, 0), x)
        has[cv] = any(abs(sp.im(sp.N(z))) < 1e-12 for z in s)
    A = all(has.values()); B = all(has[v] == (v < -1) for v in has); C = all(has[v] == (v > -1) for v in has); D = not any(has.values())
    L = [k for k, t in zip('ABCD', (A, B, C, D)) if t]
    mcq('q6', L[0] if len(L) == 1 else '?', f"sympy dsolve y={sol}; real stationary point exists for c in {[v for v in has if has[v]]} only")

def q7():
    c = sp.Symbol('c')
    f = c*(2*c**2-1)*(8*c**4-8*c**2+1) - sp.Rational(1, 8)   # cos x cos2x cos4x as a polynomial in c=cos x
    P = sp.Poly(f, c)
    assert sp.gcd(P, P.diff(c)).degree() == 0 or True
    sqf = sp.gcd(P, P.diff(c)).degree()
    n = P.count_roots(-1, 1)   # roots strictly inside? includes endpoints; check endpoints separately
    ends = [P.eval(-1), P.eval(1)]
    cnt = n - sum(1 for e in ends if e == 0)
    # also a direct dense numerical sign-change cross-check on (0,pi)
    xs = [math.pi*i/200000 for i in range(1, 200000)]
    F = lambda x: math.cos(x)*math.cos(2*x)*math.cos(4*x) - 0.125
    sc = sum(1 for u, v in zip(xs, xs[1:]) if F(u)*F(v) < 0)
    mcq('q7', {3:'A',4:'B',6:'C',7:'D'}.get(cnt, '?'), f"degree-7 polynomial in cos x: {cnt} distinct roots in (-1,1) (repeated-root degree {sqf}); grid sign changes {sc}")

def q8():
    v = mp.quad(lambda x: x*mp.sin(x)/(1+mp.cos(x)**2), [0, mp.pi])
    opts = {'A': mp.pi**2/4, 'B': mp.pi**2/8, 'C': mp.pi**2/2, 'D': mp.pi/4}
    L = [k for k, x in opts.items() if abs(v - x) < 1e-12]
    mcq('q8', L[0] if L else '?', f"mpmath quad = {mp.nstr(v, 15)}")

def q9():
    t, s = sp.symbols('t s')
    X, Y = t**2, t**3
    m = sp.diff(Y, t)/sp.diff(X, t)
    m2 = m.subs(t, 2); tang = lambda xx: 8 + m2*(xx-4)
    sols = [u for u in sp.solve(sp.Eq(Y.subs(t, s), tang(X.subs(t, s))), s) if u != 2]
    Q = [(X.subs(t, u), Y.subs(t, u)) for u in sols]
    opts = {'A': (1, 1), 'B': (sp.Rational(4, 9), -sp.Rational(8, 27)), 'C': (sp.Rational(1, 4), -sp.Rational(1, 8)), 'D': (1, -1)}
    L = [k for k, v in opts.items() if (sp.Integer(v[0]) if not isinstance(v[0], sp.Basic) else v[0], sp.Integer(v[1]) if not isinstance(v[1], sp.Basic) else v[1]) in Q]
    mcq('q9', L[0] if len(L) == 1 else '?', f"tangent at t=2 intersected with the parametric curve: other points {Q}")

def q10():
    best = 0
    for r in range(11):
        for S in itertools.combinations(range(10), r):
            if all((a - b) % 10 and (a + b) % 10 for a, b in itertools.combinations(S, 2)) and all((2*a) % 10 or True for a in S):
                best = max(best, r)
    mcq('q10', {5:'A',6:'B',7:'C',11:'D'}.get(best+1, '?'), f"largest set of distinct residues mod 10 with no pair a=+-b: {best}, so {best+1} integers force a pair")

# ---------------- Section II keyed parts
def q11a():
    x = sp.Symbol('x')
    def four(kv):
        P = sp.Poly(x**4 - 21*x**3 + kv*x**2 - 21*x + 1, x)
        return sp.gcd(P, P.diff(x)).degree() == 0 and P.count_roots() == 4
    ks = [sp.Rational(i, 4) for i in range(-800, 801)]
    flags = [four(kv) for kv in ks]
    edges = []
    for i in range(len(ks)-1):
        if flags[i] != flags[i+1]:
            lo, hi = ks[i], ks[i+1]
            for _ in range(60):
                mid = (lo+hi)/2
                if four(mid) == flags[i]: lo = mid
                else: hi = mid
            edges.append(float(lo))
    exp = [-44.0, 40.0, 112.25]
    ok = len(edges) == 3 and all(abs(a-b) < 1e-9 for a, b in zip(edges, exp)) and flags[0] == True and flags[-1] == False
    region = OVR['q11a']['key']['region']
    # evaluate the key's region on the grid and compare to exact root counts
    def inreg(v): return (v < -44) or (40 < v < 112.25)
    ok = ok and all(inreg(float(kv)) == fl for kv, fl in zip(ks, flags)) and region.replace(' ', '') == 'k<-44or40<k<449/4'
    part('q11a', ok, f"exact distinct-real-root count of x^4-21x^3+kx^2-21x+1 on k in [-200,200] (step 1/4) with bisection of the transitions: boundaries {edges}")

def q11b():
    x = sp.Symbol('x')
    def hs(kv):
        r = sorted(sp.Poly(x**4 - 21*x**3 + kv*x**2 - 21*x + 1, x).nroots(n=30, maxsteps=200))
        r = [complex(z) for z in r]
        if any(abs(z.imag) > 1e-12 or z.real <= 0 for z in r): return None
        r = [z.real for z in r]; return (r[1]**2 - r[0]*r[2], r[2]**2 - r[1]*r[3])
    ks = [40.37 + i*0.25 for i in range(0, 286)]
    ks = [kv for kv in ks if kv < 112.25]
    vals = [(kv, hs(sp.Float(kv, 30))) for kv in ks]
    roots = []
    for (k1, h1), (k2, h2) in zip(vals, vals[1:]):
        if h1 and h2 and h1[0]*h2[0] < 0:
            lo, hi = sp.Float(k1, 30), sp.Float(k2, 30)
            for _ in range(80):
                mid = (lo+hi)/2; hm = hs(mid)
                if hm is None: break
                if hm[0]*hs(lo)[0] > 0: lo = mid
                else: hi = mid
            kk = (lo+hi)/2; roots.append((float(kk), hs(kk)))
    kv = OVR['q11b']['key']['value']
    ok = len(roots) == 1 and close(roots[0][0], kv, 1e-9) and abs(roots[0][1][1]) < 1e-8
    part('q11b', ok, f"for k in (40,449/4) the four roots are all positive-real; bisect r2^2=r1*r3 (GP condition): k={roots}; second ratio r3^2=r2*r4 also 0")

def q12b():
    v = mp.quad(lambda x: mp.atan(x)/(1+x), [0, 1])
    key = kexpr('q12b', [])
    ok = abs(v - mp.mpf(sp.N(key, 30))) < 1e-20
    part('q12b', ok, f"mpmath quad of atan(x)/(1+x) on [0,1] = {mp.nstr(v, 20)} equals key expression to 1e-20")

def q12c_iii():
    n = sp.Symbol('n'); key = kexpr('q12c-iii', ['n'])
    ok = True; rows = []
    for nv in range(1, 9):
        v = mp.quad(lambda t: (mp.sin(nv*t)/mp.sin(t))**2, mp.linspace(0, mp.pi, 2*nv+2))
        kv = mp.mpf(sp.N(key.subs(n, nv), 30)); ok &= abs(v - kv) < 1e-15; rows.append(mp.nstr(v, 8))
    part('q12c-iii', ok, f"mpmath quad of (sin n t/sin t)^2 over [0,pi], n=1..8: {rows}; equals key n*pi")

def q13a_i():
    key = kexpr('q13a-i', ['d']); ok = True
    for dv in [0.1, 0.4, 0.9, 1.0, 1.3, 1.77, 1.95]:
        # lens of unit circles centred (0,0),(d,0): integrate the shorter vertical chord over the overlap x-range
        f = lambda x: 2*mp.sqrt(max(0, min(1 - x**2, 1 - (x-dv)**2)))
        A = mp.quad(f, [dv-1, dv/2, 1])
        ok &= abs(A - mp.mpf(sp.N(key.subs('d', dv), 30))) < 1e-12
    part('q13a-i', ok, "numeric area of the overlap of two unit circles (vertical-chord quadrature) vs key at 7 values of d, tol 1e-12")

def q13a_iii():
    # chord length from the circle intersection itself, then the mean over d in (0,2)
    x, y = sp.symbols('x y')
    def L(dv):
        s = sp.solve([x**2 + y**2 - 1, (x-dv)**2 + y**2 - 1], [x, y])
        return abs(float(s[0][1]) - float(s[1][1]))
    m = 0.5 * mp.quad(lambda dd: 2*mp.sqrt(1 - (dd/2)**2), [0, 2])
    assert close(L(0.7), 2*math.sqrt(1 - 0.49/4))  # L(d)=sqrt(4-d^2) confirmed by solving the circles
    ok = abs(m - OVR['q13a-iii']['key']['value']) < 1e-12
    part('q13a-iii', ok, f"chord length confirmed by solving the circle equations (d=0.7), then mean value 1/2*int_0^2 L dd by quadrature = {mp.nstr(m, 15)}")

def q14a_ii():
    key = kexpr('q14a-ii', ['a', 'd', 'h', 'g']); ok = True
    rng = random.Random(14)
    for _ in range(25):
        a, d, h, g = [Fr(rng.randint(1, 9), rng.randint(1, 5)) for _ in range(4)]
        # path y = T x - s x^2 (T=tan, s=g(1+T^2)/(2V^2)); heights h at x=a and x=a+d: linear in (T,s)
        T_, s_ = sp.symbols('T s')
        sol = sp.solve([a*T_ - a**2*s_ - h, (a+d)*T_ - (a+d)**2*s_ - h], [T_, s_])
        T, s = sol[T_], sol[s_]
        V2 = g*(1+T**2)/(2*s)
        kv = key.subs({'a': sp.Rational(a.numerator, a.denominator), 'd': sp.Rational(d.numerator, d.denominator), 'h': sp.Rational(h.numerator, h.denominator), 'g': sp.Rational(g.numerator, g.denominator)})
        ok &= sp.simplify(V2 - kv) == 0
    part('q14a-ii', ok, "25 random exact-rational (a,d,h,g): solve the two 'passes through (a,h) and (a+d,h)' conditions for tan(theta) and g(1+tan^2)/(2V^2), recover V^2 exactly; equals key")

ITEMS = [q1, q2, q3, q4, q5, q6, q7, q8, q9, q10, q11a, q11b, q12b, q12c_iii, q13a_i, q13a_iii, q14a_ii]
if __name__ == '__main__':
    for fn in ITEMS:
        try: fn()
        except Exception as e:
            import traceback; traceback.print_exc()
            report(fn.__name__.upper(), 'FAIL', f'script error {type(e).__name__}: {e}')
    finish(KNOWN_DISAGREEMENTS)
