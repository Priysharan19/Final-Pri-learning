// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Trace-to-symbol alignment
//
// Whole-line OCR is useful because context improves recognition, but the text
// it returns is not a trustworthy statement about which Pencil strokes created
// which symbol. In mathematical handwriting that ownership is structural data:
// it determines powers, fractions, corrections and whether a small mark was
// omitted or hallucinated.
//
// This aligner treats OCR text and spatial ink as two noisy observations of the
// same sequence and aligns them with dynamic programming. It is intentionally
// deterministic and model-free: appearance confidence, stroke geometry and
// sequence order contribute independent costs. Unmatched ink is preserved for
// later structural recovery instead of being silently consumed by proportional
// interpolation.
// ─────────────────────────────────────────────────────────────────────────────
import CoreGraphics
import Foundation

struct InkSpatialMark {
    var strokeIndexes: [Int]
    var bounds: CGRect
    var isRaised: Bool
}

struct InkSymbolAlignment {
    /// OCR symbol index → spatial mark index. `nil` means OCR produced a symbol
    /// for which the Pencil trace has no defensible owner.
    var symbolToMark: [Int?]
    /// Symbols whose ownership is useful but not strong enough to learn from.
    var approximateSymbols: Set<Int>
    /// Real ink that OCR did not explain. Geometry/structure gets first chance
    /// to recover these marks rather than allowing them to disappear.
    var unmatchedMarks: Set<Int>
    var totalCost: Double
}

enum InkSymbolAligner {

    private enum Step {
        case match
        case dropSymbol
        case leaveMark
        case twoSymbolsOneMark
    }

    static func align(
        symbols: [String],
        agreement: [Int: [String: Double]],
        marks: [InkSpatialMark],
        strokes: [InkStroke],
        glyphHeight: CGFloat
    ) -> InkSymbolAlignment {
        let n = symbols.count
        let m = marks.count
        guard n > 0 else {
            return InkSymbolAlignment(symbolToMark: [], approximateSymbols: [],
                                      unmatchedMarks: Set(0..<m), totalCost: Double(m) * 0.72)
        }
        guard m > 0 else {
            return InkSymbolAlignment(symbolToMark: [Int?](repeating: nil, count: n),
                                      approximateSymbols: Set(0..<n), unmatchedMarks: [],
                                      totalCost: Double(n))
        }

        let infinity = Double.greatestFiniteMagnitude / 4
        var cost = Array(repeating: Array(repeating: infinity, count: m + 1), count: n + 1)
        var back = Array(repeating: Array<Step?>(repeating: nil, count: m + 1), count: n + 1)
        cost[0][0] = 0

        for i in 1...n {
            cost[i][0] = cost[i - 1][0] + dropSymbolCost(symbols[i - 1], support: support(
                symbol: symbols[i - 1], position: i - 1, agreement: agreement
            ))
            back[i][0] = .dropSymbol
        }
        for j in 1...m {
            cost[0][j] = cost[0][j - 1] + leaveMarkCost(marks[j - 1], strokes: strokes,
                                                       glyphHeight: glyphHeight)
            back[0][j] = .leaveMark
        }

        for i in 1...n {
            for j in 1...m {
                let symbol = symbols[i - 1]
                let mark = marks[j - 1]
                let local = matchCost(
                    symbol: symbol,
                    symbolIndex: i - 1,
                    symbolCount: n,
                    mark: mark,
                    markIndex: j - 1,
                    markCount: m,
                    agreement: agreement,
                    strokes: strokes,
                    glyphHeight: glyphHeight
                )
                var best = cost[i - 1][j - 1] + local
                var step: Step = .match

                let drop = cost[i - 1][j] + dropSymbolCost(
                    symbol,
                    support: support(symbol: symbol, position: i - 1, agreement: agreement)
                )
                if drop < best {
                    best = drop
                    step = .dropSymbol
                }

                let leave = cost[i][j - 1] + leaveMarkCost(mark, strokes: strokes,
                                                           glyphHeight: glyphHeight)
                if leave < best {
                    best = leave
                    step = .leaveMark
                }

                // Joined handwriting can produce one spatial cluster for two
                // characters. Keep that case explicit rather than forcing one
                // character to vanish. Both symbols retain approximate
                // ownership of the same mark and are never used for learning.
                if i >= 2, canShareMark(mark, strokes: strokes, glyphHeight: glyphHeight) {
                    let first = symbols[i - 2]
                    let second = symbols[i - 1]
                    let share = cost[i - 2][j - 1]
                        + sharedMarkCost(first: first, second: second, mark: mark,
                                         strokes: strokes, glyphHeight: glyphHeight)
                    if share < best {
                        best = share
                        step = .twoSymbolsOneMark
                    }
                }

                cost[i][j] = best
                back[i][j] = step
            }
        }

        var mapping = [Int?](repeating: nil, count: n)
        var approximate = Set<Int>()
        var usedMarks = Set<Int>()
        var i = n
        var j = m

        while i > 0 || j > 0 {
            guard let step = back[i][j] else { break }
            switch step {
            case .match:
                let symbolIndex = i - 1
                let markIndex = j - 1
                mapping[symbolIndex] = markIndex
                usedMarks.insert(markIndex)
                let local = matchCost(
                    symbol: symbols[symbolIndex],
                    symbolIndex: symbolIndex,
                    symbolCount: n,
                    mark: marks[markIndex],
                    markIndex: markIndex,
                    markCount: m,
                    agreement: agreement,
                    strokes: strokes,
                    glyphHeight: glyphHeight
                )
                if n != m || local > 0.56 { approximate.insert(symbolIndex) }
                i -= 1
                j -= 1

            case .dropSymbol:
                approximate.insert(i - 1)
                i -= 1

            case .leaveMark:
                j -= 1

            case .twoSymbolsOneMark:
                let markIndex = j - 1
                mapping[i - 2] = markIndex
                mapping[i - 1] = markIndex
                approximate.insert(i - 2)
                approximate.insert(i - 1)
                usedMarks.insert(markIndex)
                i -= 2
                j -= 1
            }
        }

        let unmatched = Set(0..<m).subtracting(usedMarks)
        return InkSymbolAlignment(symbolToMark: mapping,
                                  approximateSymbols: approximate,
                                  unmatchedMarks: unmatched,
                                  totalCost: cost[n][m])
    }

    // MARK: - Costs

    private static func support(
        symbol: String,
        position: Int,
        agreement: [Int: [String: Double]]
    ) -> Double {
        min(1, max(0, agreement[position]?[symbol] ?? 0.55))
    }

    private static func dropSymbolCost(_ symbol: String, support: Double) -> Double {
        // Strongly supported OCR is expensive to discard; weak punctuation and
        // stray prose are cheap enough for real ink to overrule.
        let punctuationDiscount = [".", ",", "'", "|"].contains(symbol) ? 0.08 : 0
        return 0.72 + 0.30 * support - punctuationDiscount
    }

    private static func leaveMarkCost(
        _ mark: InkSpatialMark,
        strokes: [InkStroke],
        glyphHeight: CGFloat
    ) -> Double {
        let members = members(of: mark, strokes: strokes)
        // A decisive structural mark should be preserved for the structural
        // recovery pass instead of being forced under a nearby OCR character.
        if looksEquals(members, glyphHeight: glyphHeight)
            || looksHorizontal(members)
            || looksVerticalOne(members, glyphHeight: glyphHeight)
            || looksDot(mark.bounds, glyphHeight: glyphHeight) {
            return 0.58
        }
        return 0.72
    }

    private static func matchCost(
        symbol: String,
        symbolIndex: Int,
        symbolCount: Int,
        mark: InkSpatialMark,
        markIndex: Int,
        markCount: Int,
        agreement: [Int: [String: Double]],
        strokes: [InkStroke],
        glyphHeight: CGFloat
    ) -> Double {
        let candidateSupport = support(symbol: symbol, position: symbolIndex, agreement: agreement)
        let appearance = 0.34 * (1 - candidateSupport)
        let geometry = geometryPenalty(symbol: symbol, mark: mark, strokes: strokes,
                                       glyphHeight: glyphHeight)

        // Sequence order already does most of the positional work. This small
        // term only prevents a count mismatch from dragging the first or last
        // symbol across half a line when leaving one mark unmatched is cheaper.
        let symbolPosition = (Double(symbolIndex) + 0.5) / Double(max(symbolCount, 1))
        let markPosition = (Double(markIndex) + 0.5) / Double(max(markCount, 1))
        let position = 0.16 * abs(symbolPosition - markPosition)
        return max(0, appearance + geometry + position)
    }

    private static func sharedMarkCost(
        first: String,
        second: String,
        mark: InkSpatialMark,
        strokes: [InkStroke],
        glyphHeight: CGFloat
    ) -> Double {
        let members = members(of: mark, strokes: strokes)
        var cost = 0.70
        if mark.bounds.width >= 0.72 * glyphHeight { cost -= 0.18 }
        if MathAlphabet.isLetter(first) && MathAlphabet.isLetter(second) { cost -= 0.08 }
        if members.count >= 2 { cost -= 0.05 }
        return max(0.34, cost)
    }

    private static func canShareMark(
        _ mark: InkSpatialMark,
        strokes: [InkStroke],
        glyphHeight: CGFloat
    ) -> Bool {
        let members = members(of: mark, strokes: strokes)
        return mark.bounds.width >= 0.58 * glyphHeight || members.count >= 3
    }

    private static func geometryPenalty(
        symbol: String,
        mark: InkSpatialMark,
        strokes: [InkStroke],
        glyphHeight: CGFloat
    ) -> Double {
        let members = members(of: mark, strokes: strokes)
        let box = mark.bounds
        let lower = symbol.lowercased()

        if symbol == "=" { return looksEquals(members, glyphHeight: glyphHeight) ? -0.16 : 1.18 }
        if symbol == "-" || symbol == "_" {
            return members.count == 1 && looksHorizontal(members) ? -0.10 : 0.78
        }
        if ["1", "l", "i", "I", "|"].contains(symbol) {
            return looksVerticalOne(members, glyphHeight: glyphHeight) ? -0.10 : 0.46
        }
        if symbol == "." {
            return looksDot(box, glyphHeight: glyphHeight) ? -0.12 : 0.82
        }
        if symbol == "," {
            return box.height <= 0.36 * glyphHeight && box.width <= 0.30 * glyphHeight ? -0.06 : 0.58
        }
        if ["x", "*", "×", "✕"].contains(symbol) {
            return looksDiagonalCross(members, glyphHeight: glyphHeight) ? -0.12 : 0.32
        }
        if ["(", ")", "[", "]"].contains(symbol) {
            let tallNarrow = box.height >= 0.50 * glyphHeight && box.width <= 0.72 * max(box.height, 1)
            return tallNarrow ? -0.04 : 0.34
        }
        if ["0", "o", "O", "theta"].contains(symbol) {
            return looksLoop(members, glyphHeight: glyphHeight) ? -0.08 : 0.20
        }

        // A tiny Pencil tap is unlikely to be an ordinary alphanumeric glyph.
        if looksDot(box, glyphHeight: glyphHeight)
            && (MathAlphabet.isDigit(symbol) || MathAlphabet.isLetter(symbol)) {
            return 0.46
        }
        // Raised ink should not be preferred for a binary operator.
        if mark.isRaised && MathAlphabet.binaryOperators.contains(symbol) { return 0.30 }
        // English words are not handled here. The grammar/beam layer is the
        // right place for semantic judgement; alignment only owns trace shape.
        _ = lower
        return 0
    }

    // MARK: - Narrow geometry predicates

    private static func members(of mark: InkSpatialMark, strokes: [InkStroke]) -> [InkStroke] {
        mark.strokeIndexes.compactMap { strokes.indices.contains($0) ? strokes[$0] : nil }
    }

    private static func looksDot(_ box: CGRect, glyphHeight: CGFloat) -> Bool {
        max(box.width, box.height) <= max(4, 0.22 * glyphHeight)
    }

    private static func looksHorizontal(_ members: [InkStroke]) -> Bool {
        guard members.count == 1, let stroke = members.first,
              let first = stroke.points.first, let last = stroke.points.last,
              stroke.pathLength > 1 else { return false }
        let dx = last.x - first.x, dy = last.y - first.y
        let chord = hypot(dx, dy)
        return chord / stroke.pathLength >= 0.78
            && abs(dx) >= 0.88 * chord && abs(dy) <= 0.38 * chord
    }

    private static func looksEquals(_ members: [InkStroke], glyphHeight: CGFloat) -> Bool {
        guard members.count == 2 else { return false }
        let a = [members[0]], b = [members[1]]
        guard looksHorizontal(a), looksHorizontal(b) else { return false }
        let ab = members[0].bounds, bb = members[1].bounds
        let narrow = min(ab.width, bb.width)
        let wide = max(ab.width, bb.width)
        let overlap = min(ab.maxX, bb.maxX) - max(ab.minX, bb.minX)
        let separation = abs(ab.midY - bb.midY)
        return narrow >= 0.24 * glyphHeight
            && narrow / max(wide, 1) >= 0.54
            && overlap >= 0.55 * narrow
            && separation >= 0.06 * glyphHeight
            && separation <= 0.52 * glyphHeight
    }

    private static func looksVerticalOne(_ members: [InkStroke], glyphHeight: CGFloat) -> Bool {
        guard members.count == 1, let stroke = members.first,
              let first = stroke.points.first, let last = stroke.points.last,
              stroke.pathLength > 1 else { return false }
        let box = stroke.bounds
        let dx = last.x - first.x, dy = last.y - first.y
        let chord = hypot(dx, dy)
        return box.height >= 0.40 * glyphHeight
            && box.width <= 0.38 * max(box.height, 1)
            && chord / stroke.pathLength >= 0.72
            && abs(dy) >= 0.78 * chord
    }

    private static func looksDiagonalCross(_ members: [InkStroke], glyphHeight: CGFloat) -> Bool {
        guard members.count == 2 else { return false }
        let a = members[0], b = members[1]
        guard let a0 = a.points.first, let a1 = a.points.last,
              let b0 = b.points.first, let b1 = b.points.last else { return false }
        let box = a.bounds.union(b.bounds)
        guard box.height >= 0.24 * glyphHeight, box.width >= 0.18 * glyphHeight else { return false }
        let adx = a1.x - a0.x, ady = a1.y - a0.y
        let bdx = b1.x - b0.x, bdy = b1.y - b0.y
        let achord = hypot(adx, ady), bchord = hypot(bdx, bdy)
        guard achord > 2, bchord > 2,
              a.pathLength > 0, b.pathLength > 0,
              achord / a.pathLength >= 0.72,
              bchord / b.pathLength >= 0.72,
              abs(adx) >= 0.25 * achord, abs(ady) >= 0.25 * achord,
              abs(bdx) >= 0.25 * bchord, abs(bdy) >= 0.25 * bchord,
              adx * ady * bdx * bdy < 0 else { return false }
        return segmentsIntersect(
            CGPoint(x: a0.x, y: a0.y), CGPoint(x: a1.x, y: a1.y),
            CGPoint(x: b0.x, y: b0.y), CGPoint(x: b1.x, y: b1.y)
        )
    }

    private static func segmentsIntersect(
        _ p: CGPoint, _ p2: CGPoint, _ q: CGPoint, _ q2: CGPoint
    ) -> Bool {
        let r = CGPoint(x: p2.x - p.x, y: p2.y - p.y)
        let s = CGPoint(x: q2.x - q.x, y: q2.y - q.y)
        let denominator = r.x * s.y - r.y * s.x
        guard abs(denominator) > 0.0001 else { return false }
        let qp = CGPoint(x: q.x - p.x, y: q.y - p.y)
        let t = (qp.x * s.y - qp.y * s.x) / denominator
        let u = (qp.x * r.y - qp.y * r.x) / denominator
        return t > 0.08 && t < 0.92 && u > 0.08 && u < 0.92
    }

    private static func looksLoop(_ members: [InkStroke], glyphHeight: CGFloat) -> Bool {
        guard let stroke = members.max(by: { $0.pathLength < $1.pathLength }),
              stroke.points.count >= 7,
              let first = stroke.points.first, let last = stroke.points.last else { return false }
        let box = stroke.bounds
        let diagonal = hypot(box.width, box.height)
        guard box.height >= 0.28 * glyphHeight,
              box.width >= 0.16 * glyphHeight,
              diagonal > 1 else { return false }
        return hypot(last.x - first.x, last.y - first.y) <= 0.34 * diagonal
            && stroke.pathLength >= 1.65 * diagonal
    }
}
