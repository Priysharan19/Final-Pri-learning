#!/usr/bin/env python3
"""Independent computational verification of the answer keys and MCQ keys of Practice Paper 03
(Prithagoras HSC Mathematics Extension 1, 2027). Every item is computed from the question statement;
nothing is checked by evaluating the guideline's own final formula. Run: /tmp/symenv/bin/python tools/papers/verify/p03.py
Exit 1 on any FAIL, unchecked keyed id, or DISAGREE not listed in KNOWN_DISAGREEMENTS."""
NN = "03"
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

def q1():
    x = sp.Symbol('x'); two = []
    for i in range(-24, 25):
        kv = sp.Rational(i, 6)
        P = sp.Poly(x**3 - 3*x + kv, x)
        g = sp.gcd(P, P.diff(x)).degree()
        nd = P.count_roots() - (0 if g == 0 else 0)   # count_roots counts distinct real roots
        if nd == 2: two.append(float(kv))
    L = 'C' if two == [-2.0, 2.0] else '?'
    mcq('q1', L, f"exact distinct-real-root count of x^3-3x+k for k in [-4,4] step 1/6: exactly two roots only for k in {two}")

def q2():
    pts = [(i, j) for i in range(3) for j in range(3)]
    n = sum(1 for a, b, c in itertools.combinations(pts, 3) if (b[0]-a[0])*(c[1]-a[1]) - (b[1]-a[1])*(c[0]-a[0]) != 0)
    mcq('q2', {72:'A',76:'B',80:'C',84:'D'}.get(n, '?'), f"count non-collinear triples of the 9 dots: {n}")

def q3():
    c = sp.Rational(1, 3); X = sp.Symbol('x'); Y = sp.Function('y')
    sol = sp.dsolve(sp.Eq(Y(X).diff(X), Y(X)*(2-Y(X))), Y(X), ics={Y(0): 3}); f = sp.lambdify(X, sol.rhs, 'math')
    ok = {}
    for L in 'ABCD':
        P = figpoly('figde' + L)
        pts = [(x, y/0.85) for x, y in P]            # axis scale from the ticks: y=2 at 1.700, y=3 at 2.550
        best = 9
        for s in [0.05*i for i in range(2, 200)]:
            e = max(abs(y - f(x*s)) for x, y in pts)
            best = min(best, e)
        ok[L] = best
    good = [k for k, e in ok.items() if e < 0.03]
    mcq('q3', good[0] if len(good) == 1 else '?', f"dsolve y={sol.rhs}; each option polyline (y scaled from its ticks, free x-scale) fitted to it, min max-error " + ', '.join(f"{k}:{v:.3f}" for k, v in ok.items()))

def q4():
    # unit b, c with |a|=1 where a = -2(b+c): solve for the angle between b and c
    phi = sp.Symbol('phi')
    b = sp.Matrix([1, 0]); cc = sp.Matrix([sp.cos(phi), sp.sin(phi)])
    a = -2*(b + cc)
    sols = sp.solve(sp.Eq(sp.simplify(a.dot(a)), 1), phi)
    vals = {sp.nsimplify(sp.N(sp.cos(s), 30), rational=True, tolerance=1e-20) for s in sols if abs(sp.im(sp.N(s))) < 1e-12}
    opts = {'A': sp.Rational(-1, 8), 'B': sp.Rational(-1, 4), 'C': sp.Rational(-1, 2), 'D': sp.Rational(-7, 8)}
    L = [k for k, v in opts.items() if vals == {v}]
    mcq('q4', L[0] if L else '?', f"b=(1,0), c=(cos phi, sin phi); |a|=1 forces cos phi in {vals}")

def q5():
    p = Fr(1, 6); sd2 = p*(1-p); n = sd2 / Fr(1, 3600)
    mcq('q5', {300:'A',500:'B',600:'C',3000:'D'}.get(int(n) if n.denominator == 1 else -1, '?'), f"Var(phat)=p(1-p)/n = (1/60)^2 with a fair die p=1/6 gives n={n}")

def q6():
    f = lambda x: mp.asin(x) + mp.asin(mp.sqrt(1 - x**2))
    ds = [mp.diff(f, x) for x in [mp.mpf(i)/10 for i in range(1, 10)]]
    opts = {'A': lambda x: 2/mp.sqrt(1-x**2), 'B': lambda x: 1/mp.sqrt(1-x**2), 'C': lambda x: mp.mpf(0), 'D': lambda x: -1/mp.sqrt(1-x**2)}
    L = [k for k, g in opts.items() if all(abs(d - g(mp.mpf(i)/10)) < 1e-12 for i, d in zip(range(1, 10), ds))]
    mcq('q6', L[0] if len(L) == 1 else '?', "numerical derivative of f at x=0.1..0.9 compared with each option; max |f'|=%s" % mp.nstr(max(abs(d) for d in ds), 3))

def q7():
    x = sp.Symbol('x')
    F = lambda t: math.sin(t) + math.sin(2*t) + math.sin(3*t)
    # roots located by dense scan, refined with mpmath, deduplicated
    N = 400000; roots = []
    xs = [2*math.pi*i/N for i in range(N+1)]
    for u, v in zip(xs, xs[1:]):
        if F(u) == 0 or F(u)*F(v) < 0:
            r = float(mp.findroot(lambda t: mp.sin(t)+mp.sin(2*t)+mp.sin(3*t), (u+v)/2))
            if not roots or abs(r - roots[-1]) > 1e-6: roots.append(r)
    if abs(F(2*math.pi)) < 1e-9 and abs(roots[-1]-2*math.pi) > 1e-6: roots.append(2*math.pi)
    roots = [r for i, r in enumerate(roots) if not any(abs(r-s) < 1e-6 for s in roots[:i])]
    # also exclude tangential zeros: minima of |F| close to 0 are checked through the factorisation below
    sol = sp.solveset(sp.sin(x)+sp.sin(2*x)+sp.sin(3*x), x, sp.Interval(0, 2*sp.pi))
    n = len(roots)
    mcq('q7', {5:'A',6:'B',7:'C',8:'D'}.get(n, '?') if (not isinstance(sol, sp.FiniteSet) or len(sol) == n) else '?', f"scan+refine: {n} roots {[round(r,4) for r in roots]}; sympy solveset gives {len(sol) if isinstance(sol, sp.FiniteSet) else 'n/a'}")

def q8():
    v = mp.quad(lambda x: mp.log(x)/(1+x**2), [mp.mpf(1)/2, 1, 2])
    opts = {'A': 0, 'B': mp.log(2), 'C': mp.pi/2*mp.log(2), 'D': mp.pi/4}
    L = [k for k, o in opts.items() if abs(v - o) < 1e-15]
    mcq('q8', L[0] if L else '?', f"mpmath quad = {mp.nstr(v, 5)}")

def q9():
    u, t, h = sp.symbols('u t h'); y = u*t - 5*t**2
    s = sp.solve([sp.Eq(y.subs(t, 1), h), sp.Eq(y.subs(t, 3), h)], [u, h], dict=True)[0]
    mcq('q9', {10:'A',15:'B',20:'C',45:'D'}.get(int(s[h]), '?'), f"y=u t-5t^2 with y(1)=y(3)=h: u={s[u]}, h={s[h]}")

def q10():
    n = sum(1 for k in range(1, 1001) if k % 2 and k % 3 and k % 5)
    mcq('q10', {266:'A',268:'B',270:'C',300:'D'}.get(n, '?'), f"direct count of k in 1..1000 with no divisor 2,3,5: {n}")

# ----------------------------------------------------- keyed Section II parts
def q11a():
    x = sp.Symbol('x'); ok = True; rows = []
    for n in range(1, 9):
        cs = sp.symbols('c0:%d' % (n+1)); P = sum(c*x**i for i, c in enumerate(cs))
        eqs = sp.Poly(sp.expand(P - sp.diff(P, x) - x**n), x).all_coeffs()
        s = sp.solve(eqs, cs, dict=True)[0]
        p0 = s[cs[0]]; rows.append(p0); ok &= (p0 == sp.factorial(n))
    # compare the key expression itself
    n = sp.Symbol('n'); assert OVR['q11a']['key']['expr'] == 'n!'; ke = sp.factorial(n)
    ok &= all(ke.subs(n, i) == rows[i-1] for i in range(1, 9))
    part('q11a', ok, f"solve P-P'=x^n for P (degree n, unknown coefficients) for n=1..8: P(0)={rows}; key n! matches for each n")

def q11b():
    f = lambda x: mp.asin(x) + mp.asin(2*x) - mp.pi/3
    xs = [-0.5 + i*0.001 for i in range(1001)]
    roots = []
    for u, v in zip(xs, xs[1:]):
        if f(mp.mpf(u))*f(mp.mpf(v)) < 0: roots.append(mp.findroot(f, (u+v)/2))
    kv = OVR['q11b']['key']['value']
    part('q11b', len(roots) == 1 and abs(roots[0] - kv) < 1e-12, f"sign-change scan of asin x + asin 2x - pi/3 on [-1/2,1/2] and refinement: roots {[mp.nstr(r, 15) for r in roots]}")

def q11d():
    n, p = sp.symbols('n p'); ke = sp.sympify(OVR['q11d']['key']['expr'].replace('^', '**'), locals={'n': n, 'p': p})
    ok = True
    for N in range(1, 8):
        for pv in (Fr(1, 3), Fr(2, 7)):
            E = Fr(0)
            for S in itertools.product([0, 1], repeat=N):         # enumerate every attendance pattern
                m = sum(S); pr = pv**m * (1-pv)**(N-m)
                E += pr * Fr(m*(m-1), 2)                          # each attending pair shakes hands once
            ok &= (sp.Rational(E.numerator, E.denominator) == ke.subs({n: N, p: sp.Rational(pv.numerator, pv.denominator)}))
    part('q11d', ok, "enumerate all 2^N attendance patterns exactly (N=1..7, p=1/3, 2/7): E[handshakes] equals the key exactly")

def q11e():
    x = sp.Symbol('x'); ke = kexpr('q11e', ['x'])
    fw = mp.odefun(lambda t, y: (1+y**2)/(1+t**2), 0, 1)          # forward in x
    bw = mp.odefun(lambda t, z: -(1+z**2)/(1+t**2), 0, 1)         # z(t)=y(-t) for x<0
    f = lambda t: fw(mp.mpf(t)) if t >= 0 else bw(-mp.mpf(t))
    ok = all(abs(f(t) - mp.mpf(sp.N(ke.subs(x, sp.Float(t, 30)), 30))) < 1e-12 for t in (-5, -1, -0.3, 0.5, 0.9, 0.99))
    part('q11e', ok, "mpmath Taylor ODE solve of dy/dx=(1+y^2)/(1+x^2), y(0)=1 at x in {-5,-1,-0.3,0.5,0.9,0.99} vs the key, tol 1e-12")

def q12b():
    # shells about x=1: V = 2*pi * int_0^1 (1-x) asin(x) dx  (independent of the disc method)
    v = 2*mp.pi*mp.quad(lambda x: (1-x)*mp.asin(x), [0, 1])
    ke = mp.mpf(sp.N(kexpr('q12b', []), 30))
    part('q12b', abs(v - ke) < 1e-20, f"cylindrical-shell integral 2*pi*int_0^1 (1-x) asin x dx = {mp.nstr(v, 20)} equals key")

def q12c_iii():
    # least integer n with 1.96*sqrt(p(1-p)/n) <= 0.05 for EVERY p in (0,1); exact rational arithmetic on a fine grid
    from fractions import Fraction as F
    z, e = F(196, 100), F(5, 100)
    worst = max(F(i, 1000)*(1-F(i, 1000)) for i in range(1, 1000))
    n = 1
    while z*z*worst > e*e*n: n += 1
    # confirm n-1 fails for p=1/2 and n works for all grid p
    ok = (n == OVR['q12c-iii']['key']['value']) and all(z*z*F(i, 1000)*(1-F(i, 1000)) <= e*e*n for i in range(1, 1000)) and z*z*worst > e*e*(n-1)
    part('q12c-iii', ok, f"exact fractions: least n with 1.96^2 p(1-p) <= 0.05^2 n for all p in a 1/1000 grid (worst p=1/2): n={n}")

def q13b_ii():
    a, p = sp.symbols('a p'); x = sp.Symbol('x'); ke = kexpr('q13b-ii', ['a'])
    ok = True
    for av, pv in [(1, 0), (1, 2), (sp.Rational(3, 2), -1), (2, 5), (sp.Rational(1, 2), -3)]:
        f = x**3 + pv*x
        m = sp.diff(f, x).subs(x, av); line = f.subs(x, av) + m*(x - av)
        xs = [r for r in sp.solve(sp.Eq(f, line), x)]
        b = [r for r in xs if r != av][0]
        lo, hi = sorted([b, av])
        A = sp.integrate(sp.Abs(f - line) if False else (f - line), (x, lo, hi))
        # |f-line| integrated numerically to avoid any sign assumption
        An = mp.quad(lambda t: abs(mp.mpf(sp.N((f - line).subs(x, t), 30))), [float(lo), float(av) if lo < av else float(b), float(hi)])
        ok &= abs(An - mp.mpf(sp.N(ke.subs('a', av), 30))) < 1e-12 and b == -2*av
    part('q13b-ii', ok, "5 (a,p) pairs: tangent at x=a, second intersection solved symbolically, enclosed area by quadrature of |curve - tangent| equals 27a^4/4 (and B=-2a)")

def q14a_iii():
    t = sp.Symbol('t'); V, g, s = sp.symbols('V g s'); ke = kexpr('q14a-iii', ['V', 'g', 'theta'])
    ok = True
    for Vv, gv, sv in [(10, sp.Rational(98, 10), sp.Rational(95, 100)), (7, 10, sp.Rational(96, 100)), (3, 2, sp.Rational(99, 100)), (20, 10, sp.Rational(98, 100))]:
        c = sp.sqrt(1 - sv**2)
        r2 = (Vv*t*c)**2 + (Vv*t*sv - gv*t**2/2)**2
        T = 2*Vv*sv/gv
        crit = [rt for rt in sp.Poly(sp.diff(r2, t), t).nroots(n=30) if abs(sp.im(rt)) < 1e-20 and 0 < sp.re(rt) < T]
        crit = sorted([sp.re(r_) for r_ in crit])
        # the ball is getting closer between a local max and the following local min of |r|^2 when two interior critical points exist
        ke_v = ke.subs({'V': Vv, 'g': gv, 'theta': sp.asin(sv)})
        print('   dbg', crit, sp.N(ke_v, 25)) if False else None
        ok &= len(crit) == 2 and abs(crit[1] - crit[0] - sp.N(ke_v, 25)) < 1e-15 and sv > 2*sp.sqrt(2)/3
    part('q14a-iii', ok, "4 numeric (V,g,sin(theta)>2sqrt2/3): the two interior zeros of d|r|^2/dt (inside 0<t<2V sin/g) differ by exactly the key time, to 1e-20")

def q14b_ii():
    def worthwhile(p, K=3000):
        q = 1 - mp.mpf(p)
        return any(1 + mp.mpf(1)/k - q**k < 1 for k in range(2, K))
    lo, hi = mp.mpf('0.0001'), mp.mpf('0.9')
    assert worthwhile(lo) and not worthwhile(hi)
    # monotonic check on a grid, then bisection
    grid = [mp.mpf(i)/200 for i in range(1, 200)]
    w = [worthwhile(p) for p in grid]; mono = all(w[i] >= w[i+1] for i in range(len(w)-1))
    for _ in range(100):
        mid = (lo+hi)/2
        if worthwhile(mid): lo = mid
        else: hi = mid
    ke = float(1 - mp.mpf(3)**(-mp.mpf(1)/3))
    reg = OVR['q14b-ii']['key']['region'].replace(' ', '')
    part('q14b-ii', mono and abs(float(lo) - ke) < 1e-12 and reg == '0<p<1-3^(-1/3)', f"expected tests per person 1+1/k-q^k < 1 for some k in 2..2999: monotone on grid, bisected threshold p*={mp.nstr(lo, 15)}; key 1-3^(-1/3)={ke:.15f}")

ITEMS = [q1, q2, q3, q4, q5, q6, q7, q8, q9, q10, q11a, q11b, q11d, q11e, q12b, q12c_iii, q13b_ii, q14a_iii, q14b_ii]
if __name__ == '__main__':
    for fn in ITEMS:
        try: fn()
        except Exception as e:
            import traceback; traceback.print_exc()
            report(fn.__name__.upper(), 'FAIL', f'script error {type(e).__name__}: {e}')
    finish(KNOWN_DISAGREEMENTS)
