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

    static func repair(
        _ glyphs: inout [DecodedGlyph],
        strokes: [InkStroke],
        glyphHeight: CGFloat
    ) {
        for i in glyphs.indices where !glyphs[i].approximate {
            let indexes = glyphs[i].strokeIndexes.filter { strokes.indices.contains($0) }
            guard !indexes.isEmpty else { continue }
            let members = indexes.map { strokes[$0] }
            let original = glyphs[i].symbol

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
        // The two diagonals must lean opposite ways.
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
        // Reject the horizontal and vertical members of +/t.
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
        // Endpoint kisses are not a handwritten x; both strokes should cross
        // through one another with useful ink on all four arms.
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
