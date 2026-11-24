const A = await import('./client/src/engine/arithmeticLines.js');
const PAGE_A = ['y = 2x^3 + 9x^2', 'y′ = 6x^2 + 18x', 'for stationary points y′ = 0', '0 = 6x^2 + 18x', '0 = 6x[x + 3]', 'x = 0 or x = -3', 'y(0) = 0', 'smallest (0,0)'];
const r=A.stepCheckArithmetic(PAGE_A.join('\n'));console.log(r.lines.map(l=>l.status[0]+'|'+(l.note||'').slice(0,70)).join('\n'));
