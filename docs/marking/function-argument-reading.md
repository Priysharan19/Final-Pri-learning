# How a function's bare argument is read

Status: in force from 26 November 2026. Code: `client/src/engine/expr.js` (`FUNCTION_ARGUMENT_RULE`, `ambiguousReadings`), `client/src/engine/checker-core.js` (final answers), `client/src/engine/checker.js` (working lines). Tests: `client/test/function-argument-reading-check.mjs`, `server/test/function-argument-sweep-check.mjs`, `tools/function-argument-sweep.mjs`.

## The defect

Students write and type `sin2x`, `cos 3x`, `tan2θ`, `ln2x`, `sin^2 x`, `sin²x`, `cos^2(3x)`. The engine read `cos2x` as cos(2) times x, `sin^2 3x` as (sin 3)^2 times x and `sin²3x` as the exponent 23. A correct typed answer was refused, and an answer key serialised as `cos2x` marked `cos(2)*x` right. The same parser is the one reading typed answers, typed working lines and the handwriting reader's plain and LaTeX output, so one rule fixes every entry.

## The rule

1. Explicit brackets always win. `cos(2)x` is cos(2)·x and `sin(2x)` is sin(2x).
2. `sin cos tan sec cosec csc cot`, the inverse forms (`arcsin`, `asin` and the others), `ln` and `exp`, followed directly or after a space by a number and ONE variable or Greek letter, take that product as the argument; a number, π and one letter (`sin2πx`) is one product too. `cos2x` is cos(2x), `sin 3θ` is sin(3θ), `ln2x` is ln(2x), `cos2π` is cos(2π), `sin2πx` is sin(2πx).
3. A power on the name is the power of the whole value. `sin^2 x` and `sin²x` are (sin x)², `sin^2 3x` and `sin²3x` are (sin 3x)². A space or a superscript sign ends the exponent; it is never the digits 23.
4. The argument stops at the first `+` or `-`, at a closing bracket, at `*` or `/`, and at another function name. `sin2x cos3x` is sin(2x)·cos(3x), `sin2x+1` is sin(2x)+1.
5. A bare number is still a number. `cos2` is cos(2).
6. If the product is followed by a power, a factorial, a percent sign or a further factor that is not a function name (`sin2x^2`, `sin2xy`, `sin2x(x+1)`), nothing changes: the argument is read as it always was (one atom) and `sin x^2` stays (sin x)^2. The inverse function written as a power, `tan^-1 3x`, is also unchanged.
7. `e^2x`, `xe^-3x`, `sqrt2x`, `cbrt2x` and `log2x` (the 2 may be a base) have two readings that both parse, so the parser keeps the literal one (e^2·x, sqrt(2)·x, log(2)·x) and `ambiguousReadings` lists the others (e^(2x), sqrt(2x), log(2x) and log base 2 of x). A form is ambiguous ONLY when the number and the letter are juxtaposed with no operator. Any explicit `*`, `·`, `×` (`e^2*x`, `sqrt2·x`, `log2×x`) means what it says and has one reading.
   * A typed final answer is right when the literal reading or another reading equals the key, and no reading of it is a trap the question records.
   * A working line with one of these forms is judged under every reading. True under every reading: ticked. False under every reading: crossed, as before. True under one and false under the other: a note that asks for brackets, and no path ticks it (not the line checker, not the match to the worked solution, not a display overlay).
8. Working lines with a number-and-letter argument (rule 2) keep the every-reading rule that was already there: a calculus or proof line is ticked only when it is true under every reading, and crossed only when false under every reading.

## Not changed

`1/2x` is still (1/2)·x. `sin x^2` is still (sin x)^2. `x²3` is still x^23. Those are other questions, not this one.
