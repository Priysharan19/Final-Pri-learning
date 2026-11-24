const A = await import('./client/src/engine/arithmeticLines.js');
const i=A.infoOf('(π/4) - π/4'); console.log(i&&i.value);
const j=A.infoOf('(4/2)*((1/3) - (1/3))'); console.log(j&&JSON.stringify(j.ast));
