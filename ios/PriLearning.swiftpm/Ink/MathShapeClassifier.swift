// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Small, interpretable geometry classifiers for maths glyphs
//
// Vision is still the recogniser. These classifiers are deliberately narrow:
// they only intervene when the original Pencil strokes contain evidence that
// text OCR cannot see. They are not a second template recogniser and they do
// not guess from grammar alone.
// ─────────────────────────────────────────────────────────────────────────────
import CoreGraphics
import Foundation

enum MathShapeClassifier {

    private struct Cluster {
        var strokeIndexes: [Int]
        var bounds: CGRect
    }

    static func repair(
        _ glyphs: inout [DecodedGlyph],
        strokes: [InkStroke],
        glyphHeight: CGFloat
    ) {
        // Proportional OCR→stroke ownership is not evidence. Before any narrow
        // classifier runs, align the OCR sequence to the actual Pencil marks
        // with dynamic programming. This preserves unexplained ink and can drop
        // hallucinated OCR characters instead of stretching either side until
        // the counts happen to agree.
        realignApproximateOwnership(&glyphs, strokes: strokes, glyphHeight: glyphHeight)

        // Any ink that remains unexplained after alignment gets a second pass
        // for structures whose geometry is independently decisive.
        recoverApproximateLayout(&glyphs, strokes: strokes, glyphHeight: glyphHeight)

        for i in glyphs.indices where !glyphs[i].approximate {
            let indexes = glyphs[i].strokeIndexes.filter { strokes.indices.contains($0) }
            guard !indexes.isEmpty else { continue }
            let members = indexes.map { strokes[$0] }
            let original = glyphs[i].symbol

            // A handwritten y has two upper arms that meet, with one stroke
            // continuing well below the junction. That descender is strong
            // evidence a plain OCR "1" cannot see.
            if ["1", "l", "I", "|", "/", "v", "y"].contains(original),
               isY(members, glyphHeight: glyphHeight) {
                if original != "y" {
                    glyphs[i].alternatives = adding(original, confidence: glyphs[i].confidence,
                                                     to: glyphs[i].alternatives)
                }
                glyphs[i].symbol = "y"
                glyphs[i].confidence = max(glyphs[i].confidence, 0.86)
                continue
            }

            // A two-stroke diagonal cross is an x-shaped mark regardless of
            // whether OCR called it x, ×, *, 4 or k. We preserve the semantic
            // x-vs-multiply decision for MathDecoder.applyContext: geometry can
            // prove the shape, neighbours decide what that shape means.
            if ["4", "k", "x", "*", "×", "✕"].contains(original),
               isDiagonalCross(members, glyphHeight: glyphHeight) {
                if original != "*" {
                    glyphs[i].alternatives = adding(original, confidence: glyphs[i].confidence,
                                                     to: glyphs[i].alternatives)
                }
                glyphs[i].symbol = "*"
                glyphs[i].confidence = max(glyphs[i].confidence, 0.84)
                continue
            }

            // θ is an oval plus a genuine internal cross-stroke. OCR often
            // sees only the oval and returns 0/O. Requiring a closed loop AND
            // a separate bar makes this much narrower than "zero near a line".
            if ["0", "o", "O", "Q", "theta"].contains(original),
               isTheta(members, glyphHeight: glyphHeight) {
                if original != "theta" {
                    glyphs[i].alternatives = adding(original, confidence: glyphs[i].confidence,
                                                     to: glyphs[i].alternatives)
                }
                glyphs[i].symbol = "theta"
                glyphs[i].confidence = max(glyphs[i].confidence, 0.86)
            }
        }
    }

    // MARK: - Trace-to-symbol realignment

    private static func realignApproximateOwnership(
        _ glyphs: inout [DecodedGlyph],
        strokes: [InkStroke],
        glyphHeight: CGFloat
    ) {
        guard glyphs.contains(where: \.approximate), !glyphs.isEmpty else { return }

        let lineBox = glyphs.dropFirst().reduce(glyphs[0].box) { $0.union($1.box) }
        let minY = lineBox.minY - 0.45 * glyphHeight
        let maxY = lineBox.maxY + 0.45 * glyphHeight
        let minX = lineBox.minX - 0.45 * glyphHeight
        let maxX = lineBox.maxX + 1.35 * glyphHeight
        let indexes = strokes.indices.filter { index in
            let stroke = strokes[index]
            guard !stroke.isEmpty else { return false }
            let b = stroke.bounds
            return b.midY >= minY && b.midY <= maxY && b.midX >= minX && b.midX <= maxX
        }
        let lineClusters = clusters(indexes: indexes, strokes: strokes)
        guard !lineClusters.isEmpty else { return }

        var evidence: [Int: [String: Double]] = [:]
        for (position, glyph) in glyphs.enumerated() {
            var votes: [String: Double] = [glyph.symbol: max(0.05, min(1, glyph.confidence))]
            for alternative in glyph.alternatives {
                votes[alternative.symbol] = max(votes[alternative.symbol] ?? 0,
                                                max(0.02, min(1, alternative.confidence)))
            }
            let total = votes.values.reduce(0, +)
            evidence[position] = total > 0 ? votes.mapValues { $0 / total } : votes
        }

        let marks = lineClusters.map {
            InkSpatialMark(strokeIndexes: $0.strokeIndexes.sorted(), bounds: $0.bounds, isRaised: false)
        }
        let alignment = InkSymbolAligner.align(
            symbols: glyphs.map(\.symbol),
            agreement: evidence,
            marks: marks,
            strokes: strokes,
            glyphHeight: glyphHeight
        )

        let mappedCounts = Dictionary(grouping: alignment.symbolToMark.compactMap { $0 }, by: { $0 })
            .mapValues(\.count)
        var occurrence: [Int: Int] = [:]
        var rebuilt: [DecodedGlyph] = []
        rebuilt.reserveCapacity(glyphs.count)

        for (position, original) in glyphs.enumerated() {
            guard position < alignment.symbolToMark.count,
                  let markIndex = alignment.symbolToMark[position],
                  lineClusters.indices.contains(markIndex) else {
                // OCR hallucinated a symbol for which the trace has no owner.
                // Dropping it is safer than assigning a neighbouring stroke and
                // then teaching personalization from the false ownership.
                continue
            }

            let cluster = lineClusters[markIndex]
            var glyph = original
            let count = mappedCounts[markIndex] ?? 1
            let order = occurrence[markIndex, default: 0]
            occurrence[markIndex] = order + 1

            if count > 1 {
                // Joined handwriting: preserve both OCR symbols but partition
                // the visual box so ordering and downstream layout stay sane.
                let slice = cluster.bounds.width / CGFloat(count)
                glyph.box = CGRect(x: cluster.bounds.minX + CGFloat(order) * slice,
                                   y: cluster.bounds.minY,
                                   width: max(slice, 0.001),
                                   height: cluster.bounds.height)
            } else {
                glyph.box = cluster.bounds
            }
            glyph.strokeIndexes = cluster.strokeIndexes.sorted()
            glyph.approximate = alignment.approximateSymbols.contains(position) || count > 1
            rebuilt.append(glyph)
        }

        if !rebuilt.isEmpty {
            glyphs = rebuilt
            if MathInkRecognizer.trace {
                NSLog("PRIINK   trace-align symbols=%d marks=%d unmatched=%d cost=%.3f",
                      rebuilt.count, lineClusters.count, alignment.unmatchedMarks.count,
                      alignment.totalCost)
            }
        }
    }

    // MARK: - Count-mismatch structural recovery

    private static func recoverApproximateLayout(
        _ glyphs: inout [DecodedGlyph],
        strokes: [InkStroke],
        glyphHeight: CGFloat
    ) {
        // Realignment may correctly DROP every approximate OCR hallucination,
        // leaving only exact surviving glyphs while genuine trailing ink is
        // still unexplained. Recovery must therefore be driven by trace
        // ownership, not by the existence of an approximate glyph.
        guard !glyphs.isEmpty else { return }

        let lineBox = glyphs.dropFirst().reduce(glyphs[0].box) { $0.union($1.box) }
        let minY = lineBox.minY - 0.35 * glyphHeight
        let maxY = lineBox.maxY + 0.35 * glyphHeight
        let minX = lineBox.minX - 0.35 * glyphHeight
        // A missing final `=1`, bracket or other narrow structure can span more
        // than one glyph beyond the last OCR-owned box. This is only a SEARCH
        // window: actual insertion still requires decisive geometry below.
        let maxX = lineBox.maxX + 2.20 * glyphHeight

        let indexes = strokes.indices.filter { index in
            let stroke = strokes[index]
            guard !stroke.isEmpty else { return false }
            let b = stroke.bounds
            return b.midY >= minY && b.midY <= maxY && b.midX >= minX && b.midX <= maxX
        }
        let lineClusters = clusters(indexes: indexes, strokes: strokes)
        // Matching counts are never a trust signal. Geometry may re-anchor only
        // structures that are independently proven by the predicates below.
        guard !lineClusters.isEmpty else { return }

        for cluster in lineClusters {
            let members = cluster.strokeIndexes.map { strokes[$0] }
            guard let proven = structuralSymbol(members, glyphHeight: glyphHeight) else { continue }

            if let owner = glyphs.indices.first(where: {
                !Set(glyphs[$0].strokeIndexes).isDisjoint(with: cluster.strokeIndexes)
            }) {
                guard glyphs[owner].approximate else { continue }
                let old = glyphs[owner].symbol
                if old != proven {
                    glyphs[owner].alternatives = adding(old, confidence: glyphs[owner].confidence,
                                                        to: glyphs[owner].alternatives)
                }
                glyphs[owner].symbol = proven
                glyphs[owner].box = cluster.bounds
                glyphs[owner].strokeIndexes = cluster.strokeIndexes.sorted()
                glyphs[owner].confidence = max(glyphs[owner].confidence, 0.83)
                glyphs[owner].approximate = false
            } else {
                glyphs.append(DecodedGlyph(
                    symbol: proven,
                    box: cluster.bounds,
                    confidence: 0.83,
                    alternatives: [],
                    isSuperscript: false,
                    strokeIndexes: cluster.strokeIndexes.sorted(),
                    approximate: false
                ))
            }
        }

        // Approximate glyph ownership is an interpolation guess, not evidence.
        // It must never hide a real spatial mark from the recovery pass. Only
        // stroke indexes attached to exact/re-anchored glyphs are authoritative.
        // If the guessed owner is the best place to put a recovered `1`, reuse
        // that glyph rather than appending a duplicate.
        let exactOwned = Set(glyphs.filter { !$0.approximate }.flatMap(\.strokeIndexes))
        for cluster in lineClusters where Set(cluster.strokeIndexes).isDisjoint(with: exactOwned) {
            let members = cluster.strokeIndexes.map { strokes[$0] }
            guard isLikelyOne(members, glyphHeight: glyphHeight) else { continue }
            let hasEqualsToLeft = glyphs.contains {
                $0.symbol == "=" && !$0.approximate && $0.box.maxX <= cluster.bounds.midX
                    && cluster.bounds.midX - $0.box.maxX <= 1.25 * glyphHeight
            }
            guard hasEqualsToLeft else { continue }

            if let approximateOwner = glyphs.indices.first(where: {
                glyphs[$0].approximate
                    && !Set(glyphs[$0].strokeIndexes).isDisjoint(with: cluster.strokeIndexes)
            }) {
                let old = glyphs[approximateOwner].symbol
                if old != "1" {
                    glyphs[approximateOwner].alternatives = adding(
                        old, confidence: glyphs[approximateOwner].confidence,
                        to: glyphs[approximateOwner].alternatives
                    )
                }
                glyphs[approximateOwner].symbol = "1"
                glyphs[approximateOwner].box = cluster.bounds
                glyphs[approximateOwner].strokeIndexes = cluster.strokeIndexes.sorted()
                glyphs[approximateOwner].confidence = max(glyphs[approximateOwner].confidence, 0.68)
                glyphs[approximateOwner].alternatives = adding(
                    "l", confidence: 0.24,
                    to: adding("I", confidence: 0.18, to: glyphs[approximateOwner].alternatives)
                )
                glyphs[approximateOwner].approximate = false
            } else {
                glyphs.append(DecodedGlyph(
                    symbol: "1",
                    box: cluster.bounds,
                    confidence: 0.68,
                    alternatives: [("l", 0.24), ("I", 0.18)],
                    isSuperscript: false,
                    strokeIndexes: cluster.strokeIndexes.sorted(),
                    approximate: false
                ))
            }
        }

        glyphs.sort { lhs, rhs in
            if abs(lhs.box.midX - rhs.box.midX) > 0.5 { return lhs.box.midX < rhs.box.midX }
            return lhs.box.midY < rhs.box.midY
        }
    }

    private static func clusters(indexes: [Int], strokes: [InkStroke]) -> [Cluster] {
        let ordered = indexes.sorted { strokes[$0].bounds.minX < strokes[$1].bounds.minX }
        var result: [Cluster] = []
        for index in ordered {
            let bounds = strokes[index].bounds
            if var last = result.last {
                let overlap = min(bounds.maxX, last.bounds.maxX) - max(bounds.minX, last.bounds.minX)
                let reference = max(min(bounds.width, last.bounds.width), 1)
                let centreInside = bounds.midX >= last.bounds.minX && bounds.midX <= last.bounds.maxX
                if overlap >= 0.32 * reference || centreInside {
                    last.strokeIndexes.append(index)
                    last.bounds = last.bounds.union(bounds)
                    result[result.count - 1] = last
                    continue
                }
            }
            result.append(Cluster(strokeIndexes: [index], bounds: bounds))
        }
        return result
    }

    private static func structuralSymbol(_ strokes: [InkStroke], glyphHeight: CGFloat) -> String? {
        if isEquals(strokes, glyphHeight: glyphHeight) { return "=" }
        if let bracket = bracket(strokes, glyphHeight: glyphHeight) { return bracket }
        if isDiagonalCross(strokes, glyphHeight: glyphHeight) { return "*" }
        if isTheta(strokes, glyphHeight: glyphHeight) { return "theta" }
        return nil
    }

    private static func isEquals(_ strokes: [InkStroke], glyphHeight: CGFloat) -> Bool {
        guard strokes.count == 2 else { return false }
        let a = strokes[0], b = strokes[1]
        guard isHorizontal(a), isHorizontal(b) else { return false }
        let ab = a.bounds, bb = b.bounds
        let narrow = min(ab.width, bb.width)
        let wide = max(ab.width, bb.width)
        guard narrow >= 0.28 * glyphHeight,
              narrow / max(wide, 1) >= 0.58 else { return false }
        let overlap = min(ab.maxX, bb.maxX) - max(ab.minX, bb.minX)
        let separation = abs(ab.midY - bb.midY)
        return overlap >= 0.62 * narrow
            && separation >= 0.08 * glyphHeight
            && separation <= 0.48 * glyphHeight
    }

    private static func isHorizontal(_ stroke: InkStroke) -> Bool {
        guard let first = stroke.points.first, let last = stroke.points.last,
              stroke.pathLength > 0 else { return false }
        let dx = last.x - first.x, dy = last.y - first.y
        let chord = hypot(dx, dy)
        return chord > 2 && chord / stroke.pathLength >= 0.80
            && abs(dx) >= 0.90 * chord && abs(dy) <= 0.32 * chord
    }

    private static func bracket(_ strokes: [InkStroke], glyphHeight: CGFloat) -> String? {
        guard strokes.count == 1 else { return nil }
        let stroke = strokes[0]
        let box = stroke.bounds
        guard box.height >= 0.60 * glyphHeight,
              box.width <= 0.62 * max(box.height, 1) else { return nil }
        return bow(of: stroke)
    }

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
            let side = ((p.x - first.x) * dy - (p.y - first.y) * dx) / chord
            if side > 0.5 { positive += 1 } else if side < -0.5 { negative += 1 }
            if abs(side) > abs(extreme) { extreme = side }
        }
        let counted = positive + negative
        guard counted >= 3,
              CGFloat(max(positive, negative)) / CGFloat(counted) >= 0.85,
              abs(extreme) >= 0.11 * stroke.bounds.height else { return nil }
        let downward = dy >= 0
        let bulgesLeft = downward ? extreme < 0 : extreme > 0
        return bulgesLeft ? "(" : ")"
    }

    private static func isLikelyOne(_ strokes: [InkStroke], glyphHeight: CGFloat) -> Bool {
        guard strokes.count == 1 else { return false }
        let stroke = strokes[0], box = stroke.bounds
        guard box.height >= 0.46 * glyphHeight,
              box.width <= 0.34 * max(box.height, 1),
              lineStraightness(stroke) >= 0.78 else { return false }
        return bow(of: stroke) == nil
    }

    // MARK: - y / 1

    private static func isY(_ strokes: [InkStroke], glyphHeight: CGFloat) -> Bool {
        guard strokes.count == 2 else { return false }
        let sorted = strokes.sorted { $0.bounds.height > $1.bounds.height }
        let long = sorted[0], short = sorted[1]
        let union = long.bounds.union(short.bounds)
        guard union.height >= 0.55 * glyphHeight,
              union.width >= 0.28 * glyphHeight,
              long.bounds.maxY - short.bounds.maxY >= 0.24 * union.height,
              abs(long.bounds.minY - short.bounds.minY) <= 0.28 * union.height,
              lineStraightness(long) >= 0.70,
              lineStraightness(short) >= 0.70 else { return false }

        guard let l0 = long.points.first, let l1 = long.points.last,
              let s0 = short.points.first, let s1 = short.points.last else { return false }
        let longLean = (l1.x - l0.x) * (l1.y - l0.y)
        let shortLean = (s1.x - s0.x) * (s1.y - s0.y)
        guard longLean * shortLean < 0 else { return false }

        return minimumPointDistance(long, short) <= 0.18 * union.height
    }

    private static func minimumPointDistance(_ a: InkStroke, _ b: InkStroke) -> CGFloat {
        var best = CGFloat.greatestFiniteMagnitude
        for p in a.points {
            for q in b.points {
                best = min(best, hypot(p.x - q.x, p.y - q.y))
            }
        }
        return best
    }

    // MARK: - x / × / 4

    private static func isDiagonalCross(_ strokes: [InkStroke], glyphHeight: CGFloat) -> Bool {
        guard strokes.count == 2 else { return false }
        let a = strokes[0], b = strokes[1]
        guard isStraightDiagonal(a), isStraightDiagonal(b) else { return false }

        let union = a.bounds.union(b.bounds)
        guard union.height >= 0.30 * glyphHeight,
              union.width >= 0.22 * glyphHeight,
              union.width / max(union.height, 1) > 0.35,
              union.width / max(union.height, 1) < 2.4 else { return false }

        guard let a0 = a.points.first, let a1 = a.points.last,
              let b0 = b.points.first, let b1 = b.points.last else { return false }
        let ady = a1.y - a0.y, bdy = b1.y - b0.y
        let adx = a1.x - a0.x, bdx = b1.x - b0.x
        guard adx * ady * bdx * bdy < 0 else { return false }

        return interiorIntersection(
            CGPoint(x: a0.x, y: a0.y), CGPoint(x: a1.x, y: a1.y),
            CGPoint(x: b0.x, y: b0.y), CGPoint(x: b1.x, y: b1.y)
        )
    }

    private static func isStraightDiagonal(_ stroke: InkStroke) -> Bool {
        guard let first = stroke.points.first, let last = stroke.points.last else { return false }
        let dx = last.x - first.x, dy = last.y - first.y
        let chord = hypot(dx, dy)
        guard chord > 2, stroke.pathLength > 0,
              chord / stroke.pathLength >= 0.78 else { return false }
        return abs(dx) >= 0.28 * chord && abs(dy) >= 0.28 * chord
    }

    private static func interiorIntersection(
        _ p: CGPoint, _ p2: CGPoint, _ q: CGPoint, _ q2: CGPoint
    ) -> Bool {
        let r = CGPoint(x: p2.x - p.x, y: p2.y - p.y)
        let s = CGPoint(x: q2.x - q.x, y: q2.y - q.y)
        let denominator = cross(r, s)
        guard abs(denominator) > 0.0001 else { return false }
        let qp = CGPoint(x: q.x - p.x, y: q.y - p.y)
        let t = cross(qp, s) / denominator
        let u = cross(qp, r) / denominator
        return t > 0.12 && t < 0.88 && u > 0.12 && u < 0.88
    }

    private static func cross(_ a: CGPoint, _ b: CGPoint) -> CGFloat {
        a.x * b.y - a.y * b.x
    }

    // MARK: - theta / zero

    private static func isTheta(_ strokes: [InkStroke], glyphHeight: CGFloat) -> Bool {
        guard strokes.count == 2 else { return false }
        let pairs = [(strokes[0], strokes[1]), (strokes[1], strokes[0])]
        for (loop, bar) in pairs where isClosedLoop(loop, glyphHeight: glyphHeight) {
            let box = loop.bounds
            let barBox = bar.bounds
            guard barBox.width >= 0.42 * box.width,
                  barBox.height <= max(0.24 * box.height, 4),
                  barBox.midY > box.minY + 0.18 * box.height,
                  barBox.midY < box.maxY - 0.18 * box.height,
                  barBox.midX > box.minX - 0.12 * box.width,
                  barBox.midX < box.maxX + 0.12 * box.width else { continue }
            if lineStraightness(bar) >= 0.78 { return true }
        }
        return false
    }

    private static func isClosedLoop(_ stroke: InkStroke, glyphHeight: CGFloat) -> Bool {
        guard stroke.points.count >= 8,
              let first = stroke.points.first, let last = stroke.points.last else { return false }
        let box = stroke.bounds
        let diagonal = hypot(box.width, box.height)
        guard box.height >= 0.30 * glyphHeight,
              box.width >= 0.18 * glyphHeight,
              diagonal > 1,
              hypot(last.x - first.x, last.y - first.y) <= 0.28 * diagonal else { return false }
        return stroke.pathLength >= 1.8 * diagonal
    }

    private static func lineStraightness(_ stroke: InkStroke) -> CGFloat {
        guard let first = stroke.points.first, let last = stroke.points.last,
              stroke.pathLength > 0 else { return 0 }
        return hypot(last.x - first.x, last.y - first.y) / stroke.pathLength
    }

    private static func adding(
        _ symbol: String,
        confidence: Double,
        to existing: [(symbol: String, confidence: Double)]
    ) -> [(symbol: String, confidence: Double)] {
        guard !existing.contains(where: { $0.symbol == symbol }) else { return existing }
        return existing + [(symbol, min(0.95, max(0.35, confidence)))]
    }
}
