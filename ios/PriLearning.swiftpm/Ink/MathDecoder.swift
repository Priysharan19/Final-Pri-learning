// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Maths decoder
//
// Vision reads handwriting as PROSE. It is very good at deciding which marks
// are which, and it knows nothing about what a maths line is allowed to say —
// so it hands back "108×" for 108x, "22" where a 2 multiplies an x, and a
// squared term flattened to a digit sitting on the baseline.
//
// This is the layer that reads Vision's answer as maths:
//
//   1. alphabet   — one spelling for each mark: ×·∙ → *, −–— → -, π → pi …
//   2. geometry   — narrowly targeted stroke evidence repairs confusions text
//                   OCR cannot see, such as a crossed x reported as a 4
//   3. context    — letter/digit twins settled by their neighbours, an 'x'
//                   told apart from a times sign by what follows it
//   4. layout     — a glyph's box against the line's body band decides whether
//                   it is a power; runs of raised glyphs become ^(…)
//   5. grammar    — each of Vision's candidate readings scored as maths, so
//                   the one that IS a well-formed line wins over the one that
//                   merely scored highest as English
//
// The output grammar is exactly the one the typed-answer parser, the marker
// and Step Check already take: ^(…), (…)/(…), sqrt(…), pi, theta, *, <=, >=.
// ─────────────────────────────────────────────────────────────────────────────
import CoreGraphics
import Foundation

/// One recognised mark, ready for the reading panel and tap-to-correct.
struct DecodedGlyph {
    var symbol: String
    var box: CGRect
    var confidence: Double
    var alternatives: [(symbol: String, confidence: Double)]
    var isSuperscript: Bool
    /// Indices into the page's stroke array — what "learn from this
    /// correction" re-trains on, and what the picker highlights.
    var strokeIndexes: [Int] = []
    /// True when the character could not be tied to one mark exactly, because
    /// Vision returned a different number of characters than there are marks.
    /// The box is then a fair guess rather than a fact, and nothing is learnt
    /// from a correction on it.
    var approximate = false
}

enum MathAlphabet {

    /// Marks that mean the same thing under several Unicode spellings, plus
    /// the named constants the grammar spells out in letters.
    static let canonical: [Character: String] = [
        "×": "*", "✕": "*", "·": "*", "∙": "*", "⋅": "*", "х": "x",
        "÷": "/", "⁄": "/", "∕": "/",
        "−": "-", "–": "-", "—": "-", "‒": "-", "―": "-", "‐": "-", "­": "-",
        "≠": "!=", "≤": "<=", "≥": ">=", "≈": "=",
        "π": "pi", "θ": "theta", "ϴ": "theta", "Θ": "theta", "√": "sqrt",
        "∞": "inf", "′": "'", "“": "", "”": "", "‘": "", "’": "", "\"": "",
        "，": ",", "。": ".", "：": ":", "；": ";"
    ]

    /// Shape twins that carry no evidence of their own — an 'l' and a '1' are
    /// the same ink — so neighbouring digits settle them outright.
    static let identicalToDigit: [String: String] = [
        "l": "1", "I": "1", "|": "1", "ǀ": "1", "O": "0", "o": "0", "Q": "0"
    ]

    /// Twins that do differ in shape, so they flip only inside a run that is
    /// otherwise entirely numeric.
    static let shapedToDigit: [String: String] = [
        "S": "5", "s": "5", "Z": "2", "z": "2", "B": "8",
        "G": "6", "b": "6", "g": "9", "q": "9", "D": "0", "T": "7", "J": "7"
    ]

    /// Capitals a student writing maths means as the lower-case variable.
    /// LHS and RHS are the exceptions the grammar spells in capitals, and are
    /// locked before this runs.
    static let capitalVariables: Set<String> = ["X", "Y", "N", "T", "M", "K", "U", "V", "W", "P", "R"]

    static let functionNames = ["sqrt", "sin", "cos", "tan", "sec", "csc", "cot", "log", "ln"]

    static let binaryOperators: Set<String> = ["+", "-", "*", "/", "=", "<", ">", "<=", ">=", "!=", "±"]

    static func isDigit(_ s: String) -> Bool { s.count == 1 && s.first!.isNumber }
    static func isLetter(_ s: String) -> Bool { s.count == 1 && s.first!.isLetter }
}

// MARK: - Grammar score

enum MathGrammar {

    /// How much a string looks like a line of maths, in 0…1. Used to choose
    /// between Vision's candidate readings: its own ranking is by how likely
    /// the marks are, which on a maths line is only half the question.
    static func score(_ text: String) -> Double {
        let s = text.trimmingCharacters(in: .whitespaces)
        guard !s.isEmpty else { return 0 }

        var score = 0.5

        // Brackets that close what they open. Keep () and [] distinct so a
        // candidate cannot gain credit by closing one kind with the other.
        var stack: [Character] = []
        var brokeBrackets = false
        for ch in s {
            if ch == "(" || ch == "[" { stack.append(ch) }
            if ch == ")" || ch == "]" {
                let expected: Character = ch == ")" ? "(" : "["
                if stack.last == expected { stack.removeLast() }
                else { brokeBrackets = true }
            }
        }
        if !stack.isEmpty || brokeBrackets { score -= 0.22 }
        else if s.contains("(") || s.contains("[") { score += 0.04 }

        // A line normally states one thing.
        let equals = s.filter { $0 == "=" }.count
        if equals == 1 { score += 0.16 }
        if equals > 2 { score -= 0.14 }

        // Operators need something on both sides. A leading minus is a sign,
        // not a break, and so is one straight after '=', '(' or another
        // operator — "x = -3" and "2^(-1)" are ordinary maths. A leading '='
        // is also valid in handwritten working: students commonly continue an
        // equality on the next line as "= ...". Treat that as positive maths
        // evidence instead of making the wrong leading '-' artificially win.
        let chars = Array(s)
        for (i, ch) in chars.enumerated() {
            guard "+*/=<>^".contains(ch) else { continue }
            if i == 0 {
                if ch == "=" && i + 1 < chars.count { score += 0.05 }
                else { score -= 0.16 }
            } else if i == chars.count - 1 {
                score -= 0.16
            } else if "+*/=<>^".contains(chars[i - 1]) && !(ch == "=" && chars[i - 1] == "!") {
                score -= 0.12
            }
        }
        if let last = chars.last, "+-*/=<>^".contains(last) { score -= 0.12 }

        // Decimal points are meaningful inside numbers and suspicious as a run
        // of punctuation, a common OCR artefact from Pencil taps/noise.
        for i in chars.indices where chars[i] == "." {
            let left = i > 0 && chars[i - 1].isNumber
            let right = i + 1 < chars.count && chars[i + 1].isNumber
            if left && right { score += 0.025 } else { score -= 0.06 }
        }

        // Characters that have no business on a maths line at all.
        let allowed = CharacterSet(charactersIn:
            "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ+-*/=^().,[]<>!'°%±:| ")
        let stray = s.unicodeScalars.filter { !allowed.contains($0) }.count
        score -= min(0.3, Double(stray) * 0.1)

        // Long alphabetic runs are Vision falling back on English. Function
        // names are the legitimate ones and are not counted against it.
        for run in s.split(whereSeparator: { !$0.isLetter }) {
            let word = String(run).lowercased()
            if MathAlphabet.functionNames.contains(word) || word == "lhs" || word == "rhs" {
                score += 0.04
                continue
            }
            if run.count >= 3 { score -= 0.09 * Double(run.count - 2) }
        }

        return min(1, max(0, score))
    }
}

// MARK: - Decoder

enum MathDecoder {

    /// Find the function names and pin them down before anything else runs.
    /// Without this "sin" is three unrelated marks, and the letter-to-digit
    /// pass is entitled to read the s as a 5. Returns the indexes it locked.
    static func lockFunctionNames(_ glyphs: inout [DecodedGlyph]) -> Set<Int> {
        // Longest first, so "cos" is never taken as "c" then something else,
        // and "sqrt" is not read as "s" followed by "qrt".
        let names = ["sqrt", "sin", "cos", "tan", "sec", "csc", "cot", "log", "lhs", "rhs", "ln"]
        var locked: Set<Int> = []
        var i = 0
        while i < glyphs.count {
            var matched = 0
            for name in names {
                let letters = Array(name)
                guard i + letters.count <= glyphs.count else { continue }
                let run = (0..<letters.count).map { glyphs[i + $0].symbol.lowercased() }
                guard run == letters.map(String.init) else { continue }
                // A name only counts as one when it stands alone — "sin" in
                // the middle of a longer run of letters is not a function.
                let beforeIsLetter = i > 0 && MathAlphabet.isLetter(glyphs[i - 1].symbol)
                let after = i + letters.count
                let afterIsLetter = after < glyphs.count && MathAlphabet.isLetter(glyphs[after].symbol)
                guard !beforeIsLetter, !afterIsLetter else { continue }
                let capitalised = name == "lhs" || name == "rhs"
                for k in 0..<letters.count {
                    glyphs[i + k].symbol = capitalised
                        ? String(letters[k]).uppercased()
                        : String(letters[k])
                    locked.insert(i + k)
                }
                matched = letters.count
                break
            }
            i += matched > 0 ? matched : 1
        }
        return locked
    }

    /// Settle letter/digit twins, times-sign versus x, and stray capitals,
    /// using each glyph's neighbours. Glyphs already locked (a function name,
    /// a user correction) are passed through untouched.
    static func applyContext(_ glyphs: inout [DecodedGlyph], locked: Set<Int>) {
        let symbols = glyphs.map(\.symbol)

        func isNumericish(_ i: Int) -> Bool {
            guard i >= 0, i < symbols.count else { return false }
            return MathAlphabet.isDigit(symbols[i]) || symbols[i] == "."
        }
        let numericLine = symbols.enumerated().allSatisfy { index, s in
            locked.contains(index) || MathAlphabet.isDigit(s) || "+-*/=.,()[]^:%°".contains(s)
                || MathAlphabet.identicalToDigit[s] != nil || MathAlphabet.shapedToDigit[s] != nil
        }

        for i in glyphs.indices where !locked.contains(i) {
            let symbol = glyphs[i].symbol
            let leftDigit = isNumericish(i - 1)
            let rightDigit = isNumericish(i + 1)

            // '*' out of Vision — or out of the diagonal-cross geometry pass —
            // is an x-shaped mark. It is only multiplication when both sides
            // make the semantics unambiguous.
            if symbol == "*" {
                let next = i + 1 < symbols.count ? symbols[i + 1] : ""
                let rightIsOperand = MathAlphabet.isDigit(next) || MathAlphabet.isLetter(next)
                    || next == "(" || next == "[" || next == "sqrt"
                // A power hanging off the mark settles it on its own: nothing
                // is ever raised to a power off a times sign, so "2x^3" read
                // as 2 × 3 with the 3 up in the air is really 2, x, 3.
                let nextIsPower = i + 1 < glyphs.count && glyphs[i + 1].isSuperscript
                if !rightIsOperand || nextIsPower {
                    glyphs[i].symbol = "x"
                    glyphs[i].alternatives = mergedAlternatives(["*"], into: glyphs[i].alternatives)
                } else if !leftDigit || !MathAlphabet.isDigit(next) {
                    // digit × digit is the one case that is unambiguously a
                    // product; anything else beside an 'x'-shaped mark reads
                    // as the variable, which is what a maths line is full of.
                    glyphs[i].symbol = "x"
                    glyphs[i].alternatives = mergedAlternatives(["*"], into: glyphs[i].alternatives)
                }
                continue
            }

            if let twin = MathAlphabet.identicalToDigit[symbol] {
                // On its own — a numerator, a one-mark answer — there is no
                // context to settle it, and an 'I' or an 'O' alone on a maths
                // line is not a thing anyone writes. It is a 1 and a 0.
                let alone = glyphs.count == 1
                if leftDigit || rightDigit || alone {
                    glyphs[i].symbol = twin
                    glyphs[i].alternatives = mergedAlternatives([symbol], into: glyphs[i].alternatives)
                }
                continue
            }

            if let twin = MathAlphabet.shapedToDigit[symbol] {
                if (leftDigit && rightDigit) || (numericLine && (leftDigit || rightDigit)) {
                    glyphs[i].symbol = twin
                    glyphs[i].alternatives = mergedAlternatives([symbol], into: glyphs[i].alternatives)
                }
                continue
            }

            if MathAlphabet.capitalVariables.contains(symbol) {
                glyphs[i].symbol = symbol.lowercased()
                glyphs[i].alternatives = mergedAlternatives([symbol], into: glyphs[i].alternatives)
            }
        }

        // Some ambiguities cannot be proved from geometry. Do not silently
        // rewrite them: lower false confidence and make the useful alternative
        // available to the existing "check this reading" UI instead.
        for i in glyphs.indices where !locked.contains(i) {
            let next = i + 1 < glyphs.count ? glyphs[i + 1].symbol : ""
            if glyphs[i].symbol == "1", i == 0, next == "=" {
                glyphs[i].alternatives = mergedAlternatives(["y"], into: glyphs[i].alternatives)
                glyphs[i].confidence = min(glyphs[i].confidence, 0.78)
            }
            if glyphs[i].symbol == "4",
               (i > 0 || i + 1 < glyphs.count),
               !numericLine {
                glyphs[i].alternatives = mergedAlternatives(["x"], into: glyphs[i].alternatives)
            }
        }
    }

    /// Brackets, x-shaped marks and theta recovered from the original ink.
    ///
    /// Vision reads a hand-drawn '(' as a '1' or an 'l' very readily — upright,
    /// narrow, one stroke, and on a maths line a lone '1' is perfectly ordinary
    /// so nothing in the text argues against it. The ink does: a bracket BOWS,
    /// consistently, to one side of the line joining its ends, and a '1' does
    /// not. Which side it bows to says which bracket it is.
    static func repairBrackets(
        _ glyphs: inout [DecodedGlyph],
        strokes: [InkStroke],
        glyphHeight: CGFloat
    ) {
        // Do the narrow classifiers first. Bracket rollback below only rolls
        // back bracket guesses, not geometry already proven by two independent
        // strokes.
        MathShapeClassifier.repair(&glyphs, strokes: strokes, glyphHeight: glyphHeight)

        let upright: Set<String> = ["1", "l", "I", "|", "/", "\\", "t", "i", "j"]
        let original = glyphs.map(\.symbol)
        var changed = false
        for i in glyphs.indices {
            guard upright.contains(glyphs[i].symbol),
                  glyphs[i].strokeIndexes.count == 1,
                  let index = glyphs[i].strokeIndexes.first,
                  strokes.indices.contains(index)
            else { continue }
            let stroke = strokes[index]
            let box = stroke.bounds
            // Bracket-shaped: tall, narrow, and as tall as the line's body.
            guard box.height >= 0.72 * glyphHeight, box.width <= 0.55 * box.height else { continue }
            guard let bracket = bow(of: stroke) else { continue }
            glyphs[i].alternatives = mergedAlternatives([glyphs[i].symbol], into: glyphs[i].alternatives)
            glyphs[i].symbol = bracket
            changed = true
        }
        guard changed else { return }
        // Brackets that do not close what they open are worse maths than the
        // digits they replaced, so a repair that lowers the line's grammar
        // score is undone rather than argued with.
        let after = glyphs.map(\.symbol).joined()
        if MathGrammar.score(after) < MathGrammar.score(original.joined()) {
            for (i, symbol) in zip(glyphs.indices, original) { glyphs[i].symbol = symbol }
        }
    }

    /// Which way a stroke bends away from its own chord, if it bends at all.
    private static func bow(of stroke: InkStroke) -> String? {
        let points = stroke.points
        guard points.count >= 5,
              let first = points.first, let last = points.last else { return nil }
        let dx = last.x - first.x, dy = last.y - first.y
        let chord = hypot(dx, dy)
        guard chord > 1 else { return nil }

        var extreme: CGFloat = 0
        var positive = 0, negative = 0
        for p in points.dropFirst().dropLast() {
            // Signed distance from the chord: positive on one side, negative
            // on the other. Sideways bulge is what a bracket has and a '1',
            // however slanted, has not.
            let side = ((p.x - first.x) * dy - (p.y - first.y) * dx) / chord
            if side > 0.5 { positive += 1 } else if side < -0.5 { negative += 1 }
            if abs(side) > abs(extreme) { extreme = side }
        }
        let counted = positive + negative
        guard counted >= 3 else { return nil }
        // One-sided, and deep enough that it is a bend and not a wobble.
        let onesided = CGFloat(max(positive, negative)) / CGFloat(counted) >= 0.85
        guard onesided, abs(extreme) >= 0.11 * stroke.bounds.height else { return nil }

        // The signed side is the cross product of (point - start) with the
        // chord. Drawn top to bottom, a stroke bulging LEFT gives a negative
        // one; drawn bottom to top the sign flips with the chord.
        let downward = dy >= 0
        let bulgesLeft = downward ? extreme < 0 : extreme > 0
        return bulgesLeft ? "(" : ")"
    }

    /// Flatten decoded glyphs into the expression grammar the rest of the app
    /// speaks: powers wrapped in ^(…), a radical taking everything that sits
    /// under its bar.
    static func assemble(_ glyphs: [DecodedGlyph], radicalSpans: [Int: CGFloat] = [:]) -> String {
        var out = ""
        var i = 0
        var closeAt: [Int: Int] = [:]   // glyph index → how many ')' to emit before it

        // A radical covers every glyph that starts before its bar ends.
        for (index, endX) in radicalSpans {
            var last = index
            for j in (index + 1)..<glyphs.count where glyphs[j].box.minX < endX { last = j }
            if last > index { closeAt[last + 1, default: 0] += 1 }
            else { closeAt[index + 1, default: 0] += 1 }
        }

        var superscriptOpen = false
        while i < glyphs.count {
            if let closes = closeAt[i] { out += String(repeating: ")", count: closes) }

            let glyph = glyphs[i]
            if glyph.isSuperscript && !superscriptOpen {
                out += "^("
                superscriptOpen = true
            } else if !glyph.isSuperscript && superscriptOpen {
                out += ")"
                superscriptOpen = false
            }

            out += glyph.symbol
            if radicalSpans[i] != nil { out += "(" }
            i += 1
        }
        if superscriptOpen { out += ")" }
        if let closes = closeAt[glyphs.count] { out += String(repeating: ")", count: closes) }
        return out
    }

    private static func mergedAlternatives(
        _ extra: [String],
        into existing: [(symbol: String, confidence: Double)]
    ) -> [(symbol: String, confidence: Double)] {
        var result = existing
        for symbol in extra where !result.contains(where: { $0.symbol == symbol }) {
            result.append((symbol, 0.35))
        }
        return result
    }
}
