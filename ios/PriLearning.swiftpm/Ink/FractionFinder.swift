// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Stacked fractions
//
// Vision reads a line. A fraction written the way it is taught — numerator
// over a bar over denominator — is three lines of ink that mean one thing, and
// handing it to a line reader gets three unrelated readings back.
//
// So fractions are lifted out first. A bar is a long, flat stroke with ink
// both above and below it, and that ink sits WITHIN its span: a minus sign
// between two lines of working fails that test, because the working around it
// is much wider than the sign. What is left over is ordinary lines, and the
// fraction is read as (numerator)/(denominator) and put back where its bar was.
// ─────────────────────────────────────────────────────────────────────────────
import CoreGraphics
import Foundation

struct FractionBlock {
    var barIndex: Int
    var bar: CGRect
    var numerator: [Int]
    var denominator: [Int]
    var bounds: CGRect

    var allStrokeIndexes: [Int] { ([barIndex] + numerator + denominator).sorted() }
}

enum FractionFinder {

    static func find(in strokes: [InkStroke], pageGlyph: CGFloat) -> [FractionBlock] {
        // Widest bars first: in a nested fraction the outer bar must claim its
        // half of the page before an inner one takes ink out from under it.
        let bars = strokes.enumerated()
            .filter { isBarShaped($0.element, pageGlyph: pageGlyph) }
            .sorted { $0.element.bounds.width > $1.element.bounds.width }

        var used = Set<Int>()
        var blocks: [FractionBlock] = []

        for (barIndex, bar) in bars {
            guard !used.contains(barIndex) else { continue }
            let barBounds = bar.bounds
            // A little slack either side: a numerator often overhangs its bar
            // by a fraction of a glyph, and a bar is often drawn a touch short.
            let reach = barBounds.insetBy(dx: -0.30 * pageGlyph, dy: 0)
            let vertical = 2.1 * pageGlyph

            var above: [Int] = []
            var below: [Int] = []

            for (index, stroke) in strokes.enumerated() {
                guard index != barIndex, !used.contains(index), !stroke.isEmpty else { continue }
                let bounds = stroke.bounds
                guard bounds.midX >= reach.minX, bounds.midX <= reach.maxX else { continue }
                // Ink wider than the bar is the line the fraction sits on, not
                // part of the fraction.
                guard bounds.width <= barBounds.width + 0.6 * pageGlyph else { continue }
                let gap = bounds.midY - barBounds.midY
                guard abs(gap) > 0.12 * pageGlyph, abs(gap) < vertical else { continue }
                if gap < 0 { above.append(index) } else { below.append(index) }
            }

            guard !above.isEmpty, !below.isEmpty else { continue }

            var bounds = barBounds
            for index in above + below { bounds = bounds.union(strokes[index].bounds) }

            used.insert(barIndex)
            above.forEach { used.insert($0) }
            below.forEach { used.insert($0) }

            blocks.append(FractionBlock(
                barIndex: barIndex, bar: barBounds,
                numerator: above.sorted(), denominator: below.sorted(),
                bounds: bounds
            ))
        }

        return blocks.sorted { $0.bar.minX < $1.bar.minX }
    }

    /// Flat, long, and drawn in one nearly straight sweep. The straightness
    /// test is what separates a fraction bar from the long flat top of a '7'
    /// or the crossbar of a hand-drawn table.
    private static func isBarShaped(_ stroke: InkStroke, pageGlyph: CGFloat) -> Bool {
        let bounds = stroke.bounds
        guard bounds.width >= 1.15 * pageGlyph else { return false }
        guard bounds.height <= max(0.20 * pageGlyph, 3) else { return false }
        guard let first = stroke.points.first, let last = stroke.points.last else { return false }
        let chord = hypot(last.x - first.x, last.y - first.y)
        let length = stroke.pathLength
        guard length > 0 else { return false }
        return chord / length > 0.9
    }
}
