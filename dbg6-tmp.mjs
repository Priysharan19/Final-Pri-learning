const A = await import('./client/src/engine/arithmeticLines.js');
const a=A.infoOf(A.cleanStatement('(3) - (x^(2) + 4x + 6)')), b=A.infoOf(A.cleanStatement('-x^(2) - 4x - 6'));
console.log(a&&a.vars, b&&b.vars, A.sameAsWritten(a,b));
