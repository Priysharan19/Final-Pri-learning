#!/usr/bin/env python3
"""Independent computational verification of the answer keys and MCQ keys of Practice Paper 04
(Prithagoras HSC Mathematics Extension 1, 2027). Every item is computed from the question statement;
nothing is checked by evaluating the guideline's own final formula. Run: /tmp/symenv/bin/python tools/papers/verify/p04.py
Exit 1 on any FAIL, unchecked keyed id, or DISAGREE not listed in KNOWN_DISAGREEMENTS."""
NN = "04"
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
    x = sp.Symbol('x'); r = sp.Poly(x**3 - 2*x**2 + 3*x - 4, x).nroots(n=30)
    v = (r[0]+r[1])*(r[1]+r[2])*(r[2]+r[0])
    ok = abs(sp.im(v)) < 1e-20
    mcq('q1', {-2:'A',2:'B',4:'C',10:'D'}.get(int(round(float(sp.re(v)))) if ok and abs(sp.re(v) - round(float(sp.re(v)))) < 1e-20 else 99, '?'), f"numeric roots of the cubic: (a+b)(b+c)(c+a) = {sp.N(sp.re(v), 20)}")

def q2():
    b = figtext('figgrid')
    sh = re.search(r'\\fill\[[^\]]*\] \((\d+),(\d+)\) rectangle \((\d+),(\d+)\)', b)
    x0, y0, x1, y1 = map(int, sh.groups())
    xs = sorted({int(float(m)) for m in re.findall(r'\((\d+\.\d+),0\.000\) -- \(\d+\.\d+,3\.000\)', b)})
    ys = sorted({int(float(m)) for m in re.findall(r'\(0\.000,(\d+\.\d+)\) -- \(4\.000,\d+\.\d+\)', b)})
    n = sum(1 for l, r in itertools.combinations(xs, 2) for lo, hi in itertools.combinations(ys, 2) if l <= x0 and r >= x1 and lo <= y0 and hi >= y1)
    mcq('q2', {12:'A',18:'B',24:'C',36:'D'}.get(n, '?'), f"grid lines x={xs}, y={ys} read from the figure; shaded square ({x0},{y0}); rectangles from grid lines containing it: {n}")

def q3():
    T = 1.0; per = 8.0
    def pos(s):               # guard position after arc length s, starting at midpoint (1,0) of the right wall, moving anticlockwise
        s %= per
        if s <= 1: return (1, s)
        if s <= 3: return (1 - (s-1), 1)
        if s <= 5: return (-1, 1 - (s-3))
        if s <= 7: return (-1 + (s-5), -1)
        return (1, -1 + (s-7))
    def om(tt):               # tt = t/T ; omega = d(theta)/dt by central difference of the unwrapped angle
        h = 1e-6; s = per*tt
        a1 = math.atan2(pos(s+per*h)[1], pos(s+per*h)[0]); a0 = math.atan2(pos(s-per*h)[1], pos(s-per*h)[0])
        d = a1 - a0
        d = (d + math.pi) % (2*math.pi) - math.pi
        return d / (2*h)
    M = max(om(i/4000) for i in range(0, 4001))
    ok = {}
    for L in 'ABCD':
        P = figpoly('figinv' + L)
        ok[L] = max(abs(y/2.9 - om(x/8.8)/M) for x, y in P if x > 0)
    good = [k for k, e in ok.items() if e < 0.03]
    mcq('q3', good[0] if len(good) == 1 else '?', f"numerical d(theta)/dt of the guard's bearing (square walls, start at a wall midpoint) normalised by its maximum vs each plotted curve (axes M at 2.9, T at 8.8): max errors " + ', '.join(f"{k}:{v:.3f}" for k, v in ok.items()))

def q4():
    a = sp.Matrix([2, 0]); bx = sp.Rational(1, 2); b = sp.Matrix([bx, sp.sqrt(9 - bx**2)])
    assert a.dot(b) == 1 and a.dot(a) == 4 and sp.simplify(b.dot(b)) == 9
    A = sp.Abs(a[0]*b[1] - a[1]*b[0]) / 2
    opts = {'A': sp.sqrt(35)/2, 'B': sp.sqrt(35), 'C': 3, 'D': sp.sqrt(37)/2}
    L = [k for k, v in opts.items() if sp.simplify(A - v) == 0]
    mcq('q4', L[0] if L else '?', f"coordinates a=(2,0), b=(1/2, sqrt(35)/2): area = |a x b|/2 = {A}")

def q5():
    mu, sd = 0.2, math.sqrt(0.2*0.8/100); z = (0.28 - mu)/sd
    tail_given = (1 - 0.95)/2                          # from the stated P(-2<Z<2)=0.95 and symmetry
    tail_true = float(mp.erfc(z/mp.sqrt(2))/2)
    opts = {'A': 0.16, 'B': 0.05, 'C': 0.025, 'D': 0.0015}
    near = lambda t: min(opts, key=lambda k: abs(opts[k] - t))
    mcq('q5', near(tail_given) if near(tail_given) == near(tail_true) else '?', f"z={z:.6f}; tail from the given 0.95 = {tail_given}, exact normal tail {tail_true:.5f}; nearest option the same")

def q6():
    x = sp.Symbol('x'); v = sp.integrate(x*(1-x)**99, (x, 0, 1))
    opts = {'A': sp.Rational(1, 100), 'B': sp.Rational(1, 9900), 'C': sp.Rational(1, 10000), 'D': sp.Rational(1, 10100)}
    L = [k for k, o in opts.items() if o == v]
    mcq('q6', L[0] if L else '?', f"sympy exact integral = {v}")

def q7():
    v = mp.asin(mp.sin(10))
    opts = {'A': 3*mp.pi - 10, 'B': 10 - 3*mp.pi, 'C': 10 - 2*mp.pi, 'D': 4*mp.pi - 10}
    L = [k for k, o in opts.items() if abs(o - v) < 1e-20]
    mcq('q7', L[0] if L else '?', f"mpmath asin(sin 10) = {mp.nstr(v, 15)}")

def q8():
    x = sp.Symbol('x'); y = sp.Function('y')
    sol = sp.dsolve(sp.Eq(y(x).diff(x), y(x)**2), y(x), ics={y(0): 1}).rhs
    poles = sp.solve(sp.denom(sp.together(sol)), x)
    # numerical integration towards the pole confirms blow-up from the left and that the ODE is satisfied
    f = mp.odefun(lambda t, u: u**2, 0, 1)
    grows = f(mp.mpf('0.999')) > 900
    reg = {'A': (not poles), 'B': poles == [1] and grows, 'C': poles == [sp.E], 'D': False}
    L = [k for k, v in reg.items() if v]
    mcq('q8', L[0] if len(L) == 1 else '?', f"dsolve y={sol}, singularity at x={poles}; numeric y(0.999)={mp.nstr(f(mp.mpf('0.999')), 6)}; the branch containing x=0 is x<1")

def q9():
    u = sp.symbols('ux uy', real=True); c = 3
    s = sp.solve([u[0]**2 + u[1]**2 - 25, u[0] + c], u, dict=True)         # resultant has no component along the river
    sp_ = [abs(v[u[1]]) for v in s][0]
    t = sp.Integer(120)/sp_
    mcq('q9', {24:'A',30:'B',40:'C',15:'D'}.get(int(t), '?'), f"heading speed 5 with across-river resultant: crossing speed {sp_}, time {t}")

def q10():
    n = 100
    V = list(range(2, n+1)); adj = {v: {w for w in V if w != v and math.gcd(v, w) > 1} for v in V}
    best = [0]
    def expand(R, P):
        # greedy colouring bound (Tomita-Seki)
        order, colors = [], []
        Q = list(P); col = 0
        while Q:
            col += 1; U = list(Q)
            while U:
                v = U[0]; order.append(v); colors.append(col)
                Q.remove(v); U = [u for u in U if u not in adj[v] and u != v]
        for i in range(len(order)-1, -1, -1):
            if len(R) + colors[i] <= best[0]: return
            v = order[i]; Rn = R + [v]; Pn = [w for w in P if w in adj[v]]
            if Pn: expand(Rn, Pn)
            elif len(Rn) > best[0]: best[0] = len(Rn)
            P = [w for w in P if w != v]
    sys.setrecursionlimit(10000)
    expand([], V)
    # 1 is coprime to everything so it can never be in a pairwise non-coprime set; answer = max+1
    mcq('q10', {26:'A',50:'B',51:'C',67:'D'}.get(best[0]+1, '?'), f"exact maximum clique of the 'share a factor >1' graph on 2..100: {best[0]} integers can be chosen with no coprime pair, so {best[0]+1} must be chosen")

# ----------------------------------------------------------- keyed parts
def q11b():
    v = mp.tan(mp.pi/12)
    # also confirm the identity of the first half numerically for a spread of x>0
    ok_id = all(abs(mp.atan((mp.sqrt(1+x*x)-1)/x) - mp.atan(x)/2) < 1e-25 for x in [mp.mpf(s) for s in ('0.01', '0.3', '1', '2.5', '40')])
    part('q11b', ok_id and abs(v - OVR['q11b']['key']['value']) < 1e-14, f"mpmath tan(pi/12) = {mp.nstr(v, 16)}; identity checked at 5 values of x")

def q11d():
    n = sp.Symbol('n'); ke = kexpr('q11d', ['n']); ok = True
    for N in range(1, 7):
        good = 0
        for roll in itertools.product(range(1, 7), repeat=N):
            pr = 1
            for r in roll: pr *= r
            good += (pr % 6 == 0)
        ok &= (sp.Rational(good, 6**N) == ke.subs(n, N))
    part('q11d', ok, "enumerate all 6^N rolls, N=1..6: exact P(product divisible by 6) equals the key")

def q12a():
    a, b = sp.symbols('a b')
    c60 = sp.Rational(1, 2); s60 = sp.sqrt(3)/2
    P = {'A': sp.Matrix([1, 0]), 'B': sp.Matrix([c60, s60]), 'C': sp.Matrix([-c60, s60]), 'D': sp.Matrix([-1, 0]), 'E': sp.Matrix([-c60, -s60]), 'F': sp.Matrix([c60, -s60])}
    M = (P['C'] + P['D'])/2
    s, t = sp.symbols('s t')
    sol = sp.solve(list(P['A'] + s*(M - P['A']) - t*(P['E'] - P['B']) - P['B']), [s, t], dict=True)[0]
    X = P['A'] + sol[s]*(M - P['A'])
    la, mu = sp.symbols('la mu'); co = sp.solve(list(la*P['A'] + mu*P['B'] - X), [la, mu], dict=True)[0]
    ke = kexpr('q12a', ['a', 'b'])
    ok = sp.simplify(ke.coeff(a) - co[la]) == 0 and sp.simplify(ke.coeff(b) - co[mu]) == 0
    part('q12a', ok, f"regular hexagon coordinates (A at angle 0, B at 60 degrees...), X = AM intersect BE solved; OX = {co[la]} a + {co[mu]} b equals the key")

def q12b():
    @sp.cacheit
    def reach(x, y):                       # probability of ever standing at lattice point (x,y)
        if (x, y) == (0, 0): return sp.Integer(1)
        pr = sp.Integer(0)
        if x > 0:                          # arrive from (x-1,y) by going east
            pr += reach(x-1, y) * (sp.Rational(1, 2) if y < 4 else 1)
        if y > 0:                          # arrive from (x,y-1) by going north
            pr += reach(x, y-1) * (sp.Rational(1, 2) if x < 4 else 1)
        return pr
    v = reach(2, 4)
    ok = v == sp.Rational(OVR['q12b']['key']['n'], OVR['q12b']['key']['d']) and reach(4, 4) == 1
    part('q12b', ok, f"exact random-walk DP on the 4x4 street grid (fair toss at interior corners, forced moves on the top/right edges): P(visit T=(2,4)) = {v}; P(reach B)=1 checked")

def q13a_iii():
    a = mp.mpf(2); mp.mp.dps = 20
    xf = lambda y: a*mp.log((a + mp.sqrt(a*a - y*y))/y) - mp.sqrt(a*a - y*y)        # tractrix, x as a function of y
    # it must satisfy dx/dy = -sqrt(a^2-y^2)/y (the stated differential equation dy/dx = -y/sqrt(a^2-y^2))
    okde = all(abs(mp.diff(xf, y) + mp.sqrt(a*a - y*y)/y) < 1e-12 for y in (mp.mpf('0.3'), mp.mpf('1.1'), mp.mpf('1.8')))
    ok = okde; rows = []
    for h in (mp.mpf('0.5'), mp.mpf('1.3'), mp.mpf('1.9')):
        # volume of revolution about the x-axis of the region under the path from x=0 to the boat's position: pi * int y^2 dx, dx = x'(y) dy
        vol = mp.pi * mp.quad(lambda y: y*y * (-mp.diff(xf, y)), [h, a])
        key = mp.mpf(sp.N(kexpr('q13a-iii', ['a', 'y']).subs({'a': 2, 'y': sp.Float(str(h), 20)}), 20))
        rows.append((float(h), float(vol), float(key))); ok &= abs(vol - key)/key < 1e-8
    mp.mp.dps = 30
    part('q13a-iii', ok, f"tractrix x(y) verified to satisfy the stated ODE; volume of revolution pi*int y^2 dx by quadrature along the tractrix x(y) (a=2): (h, numeric, key)={[tuple(round(z,5) for z in r) for r in rows]}; agreement 1e-8 relative")

def q13b_ii():
    a, b = sp.symbols('a b'); ke = kexpr('q13b-ii', ['a', 'b']); ok = True
    for av, bv in [(2, 1), (3, 2), (sp.Rational(5, 2), sp.Rational(3, 2)), (7, 1)]:
        m = mp.quad(lambda t: mp.mpf(sp.N(av))*mp.cos(t) + mp.mpf(sp.N(bv))*mp.sin(t), [0, mp.pi/2]) / (mp.pi/2)
        ok &= abs(m - mp.mpf(sp.N(ke.subs({'a': av, 'b': bv}), 30))) < 1e-20
    part('q13b-ii', ok, "mean of a cos t + b sin t over [0,pi/2] by quadrature for 4 (a,b) equals the key; equals perimeter/pi")

def q13b_iii():
    ke = kexpr('q13b-iii', ['a', 'b']); ok = True
    for av, bv in [(3, 2), (5, 1), (2, 1.9), (10, 7), (4, 0.5)]:
        av, bv = mp.mpf(av), mp.mpf(bv)
        w = lambda t: av*mp.cos(t) + bv*mp.sin(t) - av
        grid = [mp.pi/2*i/4000 for i in range(1, 4000)]
        sgn = [w(t) > 0 for t in grid]
        flips = sum(1 for i in range(len(sgn)-1) if sgn[i] != sgn[i+1])
        ts = mp.findroot(w, [g for g, s0, s1 in zip(grid, sgn, sgn[1:]) if s0 != s1][0])
        prob = ts/(mp.pi/2)
        ok &= flips == 1 and sgn[0] and abs(prob - mp.mpf(sp.N(ke.subs({'a': sp.Float(str(av), 30), 'b': sp.Float(str(bv), 30)}), 30))) < 1e-15
    part('q13b-iii', ok, "5 (a,b) with a>b: w(theta)=a cos+b sin > a only on one initial interval (grid sign changes = 1); its end found by root-finding, probability = length/(pi/2) equals the key")

def _H(x, V, g):
    f = lambda th: x*mp.tan(th) - g*x*x/(2*V*V*mp.cos(th)**2)
    lo, hi = mp.mpf('1e-9'), mp.pi/2 - mp.mpf('1e-9'); gr = (mp.sqrt(5)-1)/2
    c, d = hi - gr*(hi-lo), lo + gr*(hi-lo)
    for _ in range(120):
        if f(c) > f(d): hi = d
        else: lo = c
        c, d = hi - gr*(hi-lo), lo + gr*(hi-lo)
    return f((lo+hi)/2)

def q14a_i():
    mp.mp.dps = 25; ke = kexpr('q14a-i', ['x', 'V', 'g']); ok = True
    for V, g, x in [(10, 9.8, 3), (7, 9.8, 1.5), (3, 10, 0.4), (20, 10, 33)]:
        V, g, x = mp.mpf(V), mp.mpf(g), mp.mpf(x)
        ok &= abs(_H(x, V, g) - mp.mpf(sp.N(ke.subs({'x': sp.Float(str(x), 25), 'V': sp.Float(str(V), 25), 'g': sp.Float(str(g), 25)}), 25))) < 1e-12
    mp.mp.dps = 30
    part('q14a-i', ok, "golden-section maximisation over launch angle of the trajectory height above x, 4 (V,g,x); equals the key to 1e-12")

def q14a_ii():
    mp.mp.dps = 15; ke = kexpr('q14a-ii', ['V', 'g']); ok = True
    for V, g in [(6, 10), (4, 9.8)]:
        V, g = mp.mpf(V), mp.mpf(g)
        R = V*V/g
        vol = mp.quad(lambda r: 2*mp.pi*r*max(_H(r, V, g), 0), [0, R/2, R], maxdegree=5)
        key = mp.mpf(sp.N(ke.subs({'V': sp.Float(str(V), 15), 'g': sp.Float(str(g), 15)}), 15))
        ok &= abs(vol - key)/key < 1e-5
    mp.mp.dps = 30
    part('q14a-ii', ok, "volume of the reachable region = int 2*pi*r*Hmax(r) dr with Hmax(r) found numerically by maximising over the angle, 2 (V,g); equals the key to 1e-5 relative")

def q14a_iii():
    mp.mp.dps = 20; ke = kexpr('q14a-iii', ['V', 'g', 'theta']); ok = True
    for V, g, th in [(10, 9.8, 70), (8, 10, 62), (6, 9.8, 80)]:
        V, g, th = mp.mpf(V), mp.mpf(g), mp.radians(th); R = V*V/g
        jet = lambda x: x*mp.tan(th) - g*x*x/(2*V*V*mp.cos(th)**2)
        D = lambda x: _H(x, V, g) - jet(x)
        lo, hi = mp.mpf('1e-6'), R - mp.mpf('1e-6'); gr = (mp.sqrt(5)-1)/2
        c, d = hi - gr*(hi-lo), lo + gr*(hi-lo)
        for _ in range(60):
            if D(c) < D(d): hi = d
            else: lo = c
            c, d = hi - gr*(hi-lo), lo + gr*(hi-lo)
        xt = (lo+hi)/2
        kv = mp.mpf(sp.N(ke.subs({'V': sp.Float(str(V), 20), 'g': sp.Float(str(g), 20), 'theta': sp.Float(str(th), 20)}), 20))
        ok &= abs(xt - kv) < 1e-4 and abs(D(xt)) < 1e-8
    mp.mp.dps = 30
    part('q14a-iii', ok, "the jet's gap to the (numerically maximised) boundary height is minimised, at gap 0, at the touching distance; 3 (V,g,theta) agree with the key to 1e-4")

def q14b_iii():
    ps = sp.Symbol('p'); pr = {i: ps for i in range(1, 6)}
    edges = {1: ('A', 'C'), 2: ('A', 'D'), 3: ('C', 'D'), 4: ('C', 'B'), 5: ('D', 'B')}
    def conn(state):
        comp = {'A', }; changed = True
        while changed:
            changed = False
            for i, (u, v) in edges.items():
                if state[i-1] and ((u in comp) != (v in comp)): comp |= {u, v}; changed = True
        return 'B' in comp
    R = 0
    for st in itertools.product([0, 1], repeat=5):
        if conn(st): R += sp.prod([ps if s else 1-ps for s in st])
    R = sp.expand(R)
    sol = sp.solve_univariate_inequality(R - ps > 0, ps, relational=False, domain=sp.Interval.open(0, 1))
    reg = OVR['q14b-iii']['key']['region'].replace(' ', '')
    ok = R == sp.expand(2*ps**2 + 2*ps**3 - 5*ps**4 + 2*ps**5) and sol == sp.Interval.open(sp.Rational(1, 2), 1) and reg == '1/2<p<1'
    part('q14b-iii', ok, f"enumerate the 32 switch states of the bridge network (A-C,A-D,C-D,C-B,D-B), R(p) = {R}; R(p) > p on (0,1) solved exactly: {sol}")

ITEMS = [q1, q2, q3, q4, q5, q6, q7, q8, q9, q10, q11b, q11d, q12a, q12b, q13a_iii, q13b_ii, q13b_iii, q14a_i, q14a_ii, q14a_iii, q14b_iii]
if __name__ == '__main__':
    for fn in ITEMS:
        try: fn()
        except Exception as e:
            import traceback; traceback.print_exc()
            report(fn.__name__.upper(), 'FAIL', f'script error {type(e).__name__}: {e}')
    finish(KNOWN_DISAGREEMENTS)
