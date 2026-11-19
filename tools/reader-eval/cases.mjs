// SYNTHETIC evaluation cases for the server handwriting reader.
// Ground truth is the text the "student" wrote. Images are typeset in
// handwriting-style system fonts (gen-images.mjs): NOT real student ink.
// Markup (rendering only): x^2 -> superscript, {a/b} -> stacked fraction,
// sqrt[...] -> radical with bar, int[a,b] -> integral with limits.
// `words`: English words that must come back as words, not fused into maths.
// `primes`: how many prime marks the lines contain.
export const CASES = [
  // primes
  { id: 'prime-1', lines: ["y' = 6x^2 + 18x"], primes: 1 },
  { id: 'prime-2', lines: ["Let y' = 0"], primes: 1, words: ['Let'] },
  { id: 'prime-3', lines: ["f'(x) = 3x^2 - 12"], primes: 1 },
  { id: 'prime-4', lines: ["f''(x) = 6x", "f''(2) = 12 > 0"], primes: 4 },
  { id: 'prime-5', lines: ["dy/dx = 2x + 5", "y' = 0 when x = 3"], primes: 1, words: ['when'] },
  { id: 'prime-6', lines: ["y'' = -4 sin 2x"], primes: 2 },
  { id: 'prime-7', lines: ["g'(t) = 4t - 8", "g'(t) = 0"], primes: 2 },
  { id: 'prime-8', lines: ["Let y' = 0 and y'' < 0"], primes: 3, words: ['Let', 'and'] },
  // pi, theta, greek
  { id: 'greek-1', lines: ["V = πr^2 h"] },
  { id: 'greek-2', lines: ["h = 5 sin πt"] },
  { id: 'greek-3', lines: ["θ = π/3"] },
  { id: 'greek-4', lines: ["cos θ = 0.6", "θ = 53.1°"] },
  { id: 'greek-5', lines: ["A = 12πt + 4"] },
  { id: 'greek-6', lines: ["x = π/6 or x = 5π/6"], words: ['or'] },
  // Let / words
  { id: 'word-1', lines: ["Let u = 3x + 1"], words: ['Let'] },
  { id: 'word-2', lines: ["Let x = 2", "So y = 7"], words: ['Let', 'So'] },
  { id: 'word-3', lines: ["Sub x = 4 into y = 3x - 2"], words: ['Sub', 'into'] },
  { id: 'word-4', lines: ["When t = 0, h = 12"], words: ['When'] },
  { id: 'word-5', lines: ["Hence x = 5"], words: ['Hence'] },
  { id: 'word-6', lines: ["Let the width be w", "w(w + 4) = 60"], words: ['Let', 'the', 'width', 'be'] },
  { id: 'word-7', lines: ["Since a > 0, parabola is concave up"], words: ['Since', 'parabola', 'is', 'concave', 'up'] },
  { id: 'word-8', lines: ["Then 2x = 10"], words: ['Then'] },
  // therefore
  { id: 'therefore-1', lines: ["∴ x = 4"] },
  { id: 'therefore-2', lines: ["2x + 3 = 11", "2x = 8", "∴ x = 4"] },
  { id: 'therefore-3', lines: ["∴ y = 3x - 2"] },
  { id: 'therefore-4', lines: ["∴ area = 24 cm^2"] },
  // or / and
  { id: 'or-1', lines: ["x = 0 or x = -3"], words: ['or'] },
  { id: 'or-2', lines: ["x = 2 or x = 5"], words: ['or'] },
  { id: 'or-3', lines: ["x = -1 and x = 4"], words: ['and'] },
  { id: 'or-4', lines: ["x(x + 3) = 0", "x = 0 or x = -3"], words: ['or'] },
  { id: 'or-5', lines: ["x < -2 or x > 3"], words: ['or'] },
  { id: 'or-6', lines: ["a = 3 and b = -1"], words: ['and'] },
  // max / min
  { id: 'max-1', lines: ["max = 25 at x = 5"], words: ['max', 'at'] },
  { id: 'max-2', lines: ["min = -4 when x = 2"], words: ['min', 'when'] },
  { id: 'max-3', lines: ["max value = 17"], words: ['max', 'value'] },
  { id: 'max-4', lines: ["Max profit = $450"], words: ['Max', 'profit'] },
  // fractions
  { id: 'frac-1', lines: ["x = {3/4}"] },
  { id: 'frac-2', lines: ["{x + 1/x - 2} = 3"] },
  { id: 'frac-3', lines: ["P(A) = {5/12}"] },
  { id: 'frac-4', lines: ["m = {y2 - y1/x2 - x1}"] },
  // integrals
  { id: 'int-1', lines: ["∫ 2x dx = x^2 + c"] },
  { id: 'int-2', lines: ["int[0,3] x^2 dx = 9"] },
  { id: 'int-3', lines: ["∫ cos 2x dx = {1/2} sin 2x + c"] },
  { id: 'int-4', lines: ["A = int[1,4] (x + 2) dx"] },
  // powers, surds
  { id: 'pow-1', lines: ["(x + 3)^2 = x^2 + 6x + 9"] },
  { id: 'pow-2', lines: ["x = sqrt[12] = 2sqrt[3]"] },
  { id: 'pow-3', lines: ["2^(x+1) = 16"] },
  { id: 'pow-4', lines: ["x^2 - 5x + 6 = 0", "(x - 2)(x - 3) = 0"] },
  // units
  { id: 'unit-1', lines: ["v = 12 m/s"] },
  { id: 'unit-2', lines: ["V = 150 cm^3"] },
  { id: 'unit-3', lines: ["d = 4.5 km", "t = 0.75 h"] },
  { id: 'unit-4', lines: ["cost = $12.50 per kg"], words: ['cost', 'per'] }
];
