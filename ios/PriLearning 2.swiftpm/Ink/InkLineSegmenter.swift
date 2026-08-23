// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Line segmentation
//
// Splits a page of ink into the lines the student actually wrote, before any
// reading happens. Vision does its own line finding, but doing it here first
// buys three things Vision cannot give on its own:
//
//   · every line is rendered to its own image and scaled to the height Vision
//     reads best at, so a small line is not penalised for sharing a page with a
//     big one;
//   · a line that Vision returns nothing for is identifiable, and can be handed
//     back to the web engine rather than silently vanishing;
//   · recognised characters map back to the strokes that made them, which is
//     what tap-to-correct and "learn from this correction" need.
//
// Primary grouping is by vertical overlap against a line's core band. Maths then
// needs two structural repair passes:
//   1. detached raised marks (powers) attach to a full-height carrier on the left;
//   2. compact 2D satellites (integral limits / evaluation bounds) attach only
//      when geometry AND original Pencil stroke order agree on the same body line.
//
// The second rule matters for calculus: an upper/lower integral limit is not a
// separate line just because it sits clear of x-height. Stroke order is only a
// supporting cue — InkPoint.t resets at each PKStroke, so we never pretend it is
// a page-wide clock.
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
        groups = attachCompactMathSatellites(groups, glyphSize: glyphSize)
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

    private static func attachCompactMathSatellites(
        _ groups: [[(offset: Int, element: InkStroke)]],
        glyphSize: CGFloat
    ) -> [[(offset: Int, element: InkStroke)]] {
        guard groups.count > 1 else { return groups }
        var result = groups
        var changed = true

        while changed {
            changed = false
            outer: for satelliteIndex in result.indices {
                let satelliteGroup = result[satelliteIndex]
                let satelliteStrokes = satelliteGroup.map(\.element)
                guard !satelliteStrokes.isEmpty, satelliteStrokes.count <= 5 else { continue }
                let satellite = union(of: satelliteStrokes)

                var bestTarget: Int?
                var bestScore = CGFloat.greatestFiniteMagnitude

                for targetIndex in result.indices where targetIndex != satelliteIndex {
                    let targetGroup = result[targetIndex]
                    let targetStrokes = targetGroup.map(\.element)
                    guard !targetStrokes.isEmpty else { continue }

                    let targetBounds = union(of: targetStrokes)
                    let band = coreBand(of: targetStrokes, glyphSize: glyphSize)
                    let bandHeight = max(1, band.upperBound - band.lowerBound)
                    let targetHeight = max(bandHeight, lineGlyphHeight(targetStrokes, pageSize: glyphSize))
                    let satelliteExtent = max(satellite.width, satellite.height)

                    let substantialTarget = targetStrokes.count >= 3
                        || targetBounds.width >= 2.0 * targetHeight
                        || targetBounds.height >= 1.45 * targetHeight
                    guard substantialTarget else { continue }
                    guard satelliteExtent <= 1.10 * targetHeight else { continue }

                    let aboveGap = band.lowerBound - satellite.maxY
                    let belowGap = satellite.minY - band.upperBound
                    let verticalGap = max(0, max(aboveGap, belowGap))
                    guard verticalGap <= 0.95 * targetHeight else { continue }

                    let horizontalGap = max(0, max(
                        targetBounds.minX - satellite.maxX,
                        satellite.minX - targetBounds.maxX
                    ))
                    guard horizontalGap <= 0.72 * targetHeight else { continue }

                    let inExpandedSpan = satellite.midX >= targetBounds.minX - 0.38 * targetHeight
                        && satellite.midX <= targetBounds.maxX + 0.38 * targetHeight
                    guard inExpandedSpan else { continue }

                    var orderGap = Int.max
                    for s in satelliteGroup {
                        for t in targetGroup {
                            orderGap = min(orderGap, abs(s.offset - t.offset))
                        }
                    }
                    guard orderGap <= 6 else { continue }

                    let displaced = satellite.midY < band.lowerBound + 0.30 * targetHeight
                        || satellite.midY > band.upperBound - 0.18 * targetHeight
                    guard displaced else { continue }

                    let score = verticalGap
                        + 0.35 * horizontalGap
                        + 0.08 * targetHeight * CGFloat(orderGap)
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
