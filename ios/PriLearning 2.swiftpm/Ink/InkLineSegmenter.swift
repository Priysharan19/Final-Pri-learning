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
// distance. A superscript usually overlaps the top of its carrier line, but
// real Pencil writing often puts a power completely clear of the x-height.
// Those detached raised marks are attached in a second, geometry-constrained
// pass. The pass requires a compact raised mark, a full-height carrier
// immediately to its left, and a tight vertical gap, so a genuine next line is
// not collapsed into the line above or below it.
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
                let smallMark = item.element.bounds.height < 0.35 * glyphSize
                if smallMark {
                    let above = band.lowerBound - centre
                    let below = centre - band.upperBound
                    guard above <= 0.95 * glyphSize, below <= 0.45 * glyphSize else { continue }
                    let distance = max(0, max(above, below))
                    let score = glyphSize - distance
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
        groups = attachRaisedSatellites(groups, glyphSize: glyphSize)
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

    private static func attachRaisedSatellites(
        _ groups: [[(offset: Int, element: InkStroke)]],
        glyphSize: CGFloat
    ) -> [[(offset: Int, element: InkStroke)]] {
        guard groups.count > 1 else { return groups }
        var result = groups
        var changed = true

        while changed {
            changed = false
            outer: for satelliteIndex in result.indices {
                let satelliteStrokes = result[satelliteIndex].map(\.element)
                guard !satelliteStrokes.isEmpty, satelliteStrokes.count <= 4 else { continue }
                let satellite = union(of: satelliteStrokes)

                var bestTarget: Int?
                var bestScore = CGFloat.greatestFiniteMagnitude

                for targetIndex in result.indices where targetIndex != satelliteIndex {
                    let targetStrokes = result[targetIndex].map(\.element)
                    guard !targetStrokes.isEmpty else { continue }
                    let band = coreBand(of: targetStrokes, glyphSize: glyphSize)
                    let bandHeight = max(1, band.upperBound - band.lowerBound)
                    let targetHeight = max(bandHeight, lineGlyphHeight(targetStrokes, pageSize: glyphSize))
                    let satelliteExtent = max(satellite.width, satellite.height)

                    // Real Pencil powers are often almost body-height (especially
                    // handwritten 2/3/4). The old 0.88 limit turned them into
                    // separate lines. Size alone is not our safety gate: the
                    // strong raised-position + nearby-left-carrier constraints
                    // below distinguish a superscript from genuine next working.
                    guard satelliteExtent <= 1.15 * targetHeight else { continue }

                    let clearAbove = band.lowerBound - satellite.maxY
                    guard clearAbove <= 0.92 * targetHeight else { continue }
                    guard satellite.midY < band.lowerBound + 0.43 * targetHeight else { continue }
                    guard satellite.maxY < band.lowerBound + 0.82 * targetHeight else { continue }

                    var carrierGap = CGFloat.greatestFiniteMagnitude
                    for stroke in targetStrokes {
                        let box = stroke.bounds
                        guard box.height >= 0.42 * targetHeight else { continue }
                        let dx = satellite.minX - box.maxX
                        guard dx >= -0.24 * targetHeight, dx <= 0.90 * targetHeight else { continue }
                        guard satellite.midX >= box.midX - 0.08 * targetHeight else { continue }
                        carrierGap = min(carrierGap, max(0, dx))
                    }
                    guard carrierGap.isFinite else { continue }

                    let score = carrierGap + 0.8 * max(0, clearAbove)
                    if score < bestScore {
                        bestScore = score
                        bestTarget = targetIndex
                    }
                }

                guard let targetIndex = bestTarget else { continue }
                result[targetIndex].append(contentsOf: result[satelliteIndex])
                result.remove(at: satelliteIndex)
                changed = true
                break outer
            }
        }

        return result
    }

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
