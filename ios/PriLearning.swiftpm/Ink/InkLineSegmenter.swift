// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Line segmentation
//
// Splits a page of ink into the lines the student actually wrote, before any
// reading happens. Vision does its own line finding, but doing it here first
// buys three things Vision cannot give on its own:
//
//   · every line is rendered to its own image and scaled to the height Vision
//     reads best at, so a small line is not penalised for sharing a page with
//     a big one;
//   · a line that Vision returns nothing for is identifiable, and can be
//     handed back to the web engine rather than silently vanishing;
//   · recognised characters map back to the strokes that made them, which is
//     what tap-to-correct and "learn from this correction" need.
//
// Grouping is by vertical OVERLAP against a line's core band, not by centre
// distance. A superscript sits high but still inside its line's band, so it
// joins; the next line down sits clear of the band even when a descender from
// the line above reaches into its space, because the band is built from the
// median top and bottom of the line's full-height glyphs rather than from the
// union of everything in it.
// ─────────────────────────────────────────────────────────────────────────────
import CoreGraphics
import Foundation

struct InkLine {
    /// Indices into the original stroke array, in reading order (left to right).
    var strokeIndexes: [Int]
    var strokes: [InkStroke]
    /// Union of every member stroke, descenders and superscripts included.
    var bounds: CGRect
    /// The band ordinary full-height glyphs occupy — the line's "body".
    var band: ClosedRange<CGFloat>
    /// Typical glyph size on this line; the scale everything else is measured in.
    var glyphHeight: CGFloat
}

enum InkLineSegmenter {

    /// Typical glyph size across the whole page: the median of each stroke's
    /// larger extent. A stroke-height median alone is dragged down by minus
    /// signs and fraction bars, which are wide rather than tall.
    static func pageGlyphSize(_ strokes: [InkStroke]) -> CGFloat {
        let extents = strokes
            .filter { !$0.isEmpty }
            .map { max($0.bounds.width, $0.bounds.height) }
            .sorted()
        guard !extents.isEmpty else { return 24 }
        return max(8, extents[extents.count / 2])
    }

    static func segment(_ strokes: [InkStroke]) -> [InkLine] {
        let indexed = strokes.enumerated().filter { !$0.element.isEmpty }
        guard !indexed.isEmpty else { return [] }

        let glyphSize = pageGlyphSize(strokes)

        // Reading order first. Grouping left to right means a line's band is
        // built from its own early glyphs, which is the same evidence a reader
        // uses when they decide the next mark belongs to the line they are on.
        let ordered = indexed.sorted { $0.element.bounds.minX < $1.element.bounds.minX }

        var groups: [[(offset: Int, element: InkStroke)]] = []

        for item in ordered {
            let strokeRange = item.element.bounds.minY...item.element.bounds.maxY
            var bestGroup = -1
            var bestOverlap: CGFloat = 0

            for (index, group) in groups.enumerated() {
                let band = coreBand(of: group.map(\.element), glyphSize: glyphSize)
                let overlap = min(strokeRange.upperBound, band.upperBound)
                    - max(strokeRange.lowerBound, band.lowerBound)
                let reference = min(item.element.bounds.height, band.upperBound - band.lowerBound)
                let centre = item.element.bounds.midY

                // A dot, a decimal point or a minus sign is far shorter than
                // the band, and the dot of an 'i' does not touch the band at
                // all — it floats above it. Requiring overlap for those marks
                // put "sin(x)" on two lines, the dot on one and the rest on
                // the other. Small marks are judged on how far from the band
                // they sit; anything full height is judged on overlap.
                let height = item.element.bounds.height
                let width = item.element.bounds.width
                let bandHeight = max(1, band.upperBound - band.lowerBound)
                let smallMark = height < 0.35 * glyphSize
                // A power such as the `2` in x² is not always tiny enough for
                // the dot rule. It is compact and raised relative to the body
                // band, which is strong evidence that it belongs to the same
                // written line instead of opening a phantom third line.
                let compactRaisedMark = height < 0.92 * glyphSize
                    && width <= 1.05 * glyphSize
                    && centre < band.lowerBound + 0.58 * bandHeight
                if smallMark || compactRaisedMark {
                    let above = band.lowerBound - centre
                    let below = centre - band.upperBound
                    let aboveAllowance = compactRaisedMark ? 1.10 * glyphSize : 0.95 * glyphSize
                    guard above <= aboveAllowance, below <= 0.45 * glyphSize else { continue }
                    let distance = max(0, max(above, below))
                    let score = glyphSize - distance      // nearer band wins
                    if score > bestOverlap { bestOverlap = score; bestGroup = index }
                    continue
                }

                guard overlap > 0, overlap >= 0.34 * max(reference, 1) else { continue }
                if overlap > bestOverlap {
                    bestOverlap = overlap
                    bestGroup = index
                }
            }

            if bestGroup >= 0 {
                groups[bestGroup].append(item)
            } else {
                groups.append([item])
            }
        }

        groups = mergeOverlappingGroups(groups, glyphSize: glyphSize)

        return groups
            .map { group -> InkLine in
                let sorted = group.sorted { $0.element.bounds.minX < $1.element.bounds.minX }
                let members = sorted.map(\.element)
                return InkLine(
                    strokeIndexes: sorted.map(\.offset),
                    strokes: members,
                    bounds: union(of: members),
                    band: coreBand(of: members, glyphSize: glyphSize),
                    glyphHeight: lineGlyphHeight(members, pageSize: glyphSize)
                )
            }
            .sorted { $0.band.lowerBound < $1.band.lowerBound }
    }

    // MARK: - Helpers

    /// The vertical band a line's ordinary glyphs occupy. Built from the median
    /// top and median bottom of full-height members so one descender or one
    /// superscript cannot stretch the line's claim over its neighbours.
    private static func coreBand(of strokes: [InkStroke], glyphSize: CGFloat) -> ClosedRange<CGFloat> {
        let tall = strokes.filter { $0.bounds.height >= 0.45 * glyphSize }
        let sample = tall.isEmpty ? strokes : tall
        guard !sample.isEmpty else { return 0...0 }
        let tops = sample.map { $0.bounds.minY }.sorted()
        let bottoms = sample.map { $0.bounds.maxY }.sorted()
        let top = tops[tops.count / 2]
        let bottom = bottoms[bottoms.count / 2]
        return top...max(bottom, top + 1)
    }

    private static func lineGlyphHeight(_ strokes: [InkStroke], pageSize: CGFloat) -> CGFloat {
        let heights = strokes.map { $0.bounds.height }.filter { $0 >= 0.3 * pageSize }.sorted()
        guard !heights.isEmpty else { return pageSize }
        return max(8, heights[heights.count / 2])
    }

    private static func union(of strokes: [InkStroke]) -> CGRect {
        strokes.dropFirst().reduce(strokes.first?.bounds ?? .zero) { $0.union($1.bounds) }
    }

    /// Left-to-right grouping can open a second line for ink that belongs to
    /// one already open — a lone superscript written before the rest of its
    /// line catches up, say. Bands that substantially share space are the same
    /// line, so they are folded together once every stroke has been placed.
    private static func mergeOverlappingGroups(
        _ groups: [[(offset: Int, element: InkStroke)]],
        glyphSize: CGFloat
    ) -> [[(offset: Int, element: InkStroke)]] {
        var result = groups
        var merged = true
        while merged {
            merged = false
            outer: for i in 0..<result.count {
                for j in (i + 1)..<result.count {
                    let a = coreBand(of: result[i].map(\.element), glyphSize: glyphSize)
                    let b = coreBand(of: result[j].map(\.element), glyphSize: glyphSize)
                    let overlap = min(a.upperBound, b.upperBound) - max(a.lowerBound, b.lowerBound)
                    let smaller = min(a.upperBound - a.lowerBound, b.upperBound - b.lowerBound)
                    guard overlap > 0.55 * max(smaller, 1) else { continue }
                    result[i].append(contentsOf: result[j])
                    result.remove(at: j)
                    merged = true
                    break outer
                }
            }
        }
        return result
    }
}
