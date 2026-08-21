// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Independent symbol-count evidence
//
// A recognizer can produce a plausible equation while silently dropping one
// visible mark.  Counting the recognizer's own output cannot detect that class
// of error, so this channel estimates top-level mathematical objects directly
// from Pencil geometry.  It deliberately knows no symbol labels.
//
// The estimate is conservative: stacked fractions are one top-level object and
// overlapping/crossing strokes are grouped into one primitive.  Ambiguous
// geometry lowers confidence instead of manufacturing a precise count.
// ─────────────────────────────────────────────────────────────────────────────
import CoreGraphics
import Foundation

struct InkSymbolCountEvidence {
    let estimatedTopLevelCount: Int
    let recognizedTopLevelCount: Int
    let confidence: Double
    let groupStrokeIndexes: [[Int]]
    let fractionCount: Int
    let mismatch: Bool
    let source: String

    var jsonObject: [String: Any] {
        [
            "estimatedTopLevelCount": estimatedTopLevelCount,
            "recognizedTopLevelCount": recognizedTopLevelCount,
            "confidence": confidence,
            "groups": groupStrokeIndexes,
            "fractionCount": fractionCount,
            "mismatch": mismatch,
            "source": source
        ]
    }
}

enum InkSymbolCountEstimator {
    private struct Group {
        var indexes: [Int]
        var bounds: CGRect
    }

    static func evaluate(reading: Reading, strokes: [InkStroke]) -> InkSymbolCountEvidence {
        let estimate = estimate(strokes: strokes)
        let recognized = reading.lines.reduce(0) { $0 + $1.symbols.count }
        let trustedMismatch = estimate.confidence >= 0.72 && estimate.count != recognized
        return InkSymbolCountEvidence(
            estimatedTopLevelCount: estimate.count,
            recognizedTopLevelCount: recognized,
            confidence: estimate.confidence,
            groupStrokeIndexes: estimate.groups,
            fractionCount: estimate.fractionCount,
            mismatch: trustedMismatch,
            source: "geometry-count-v1"
        )
    }

    static func estimate(strokes: [InkStroke]) -> (
        count: Int, confidence: Double, groups: [[Int]], fractionCount: Int
    ) {
        let liveIndexes = strokes.indices.filter { !strokes[$0].isEmpty }
        guard !liveIndexes.isEmpty else { return (0, 1, [], 0) }

        let pageGlyph = max(1, InkLineSegmenter.pageGlyphSize(strokes))
        let fractions = FractionFinder.find(in: strokes, pageGlyph: pageGlyph)
        let fractionTraceSets = fractions.map { Set($0.allStrokeIndexes) }
        let consumed = Set(fractions.flatMap(\.allStrokeIndexes))
        let residual = liveIndexes.filter { !consumed.contains($0) }

        // Group remaining ink into broad writing lines first.  This prevents
        // symbols above one another on separate lines from being merged simply
        // because they share an x coordinate.
        var lines: [[Int]] = []
        let ordered = residual.sorted {
            if abs(strokes[$0].bounds.midY - strokes[$1].bounds.midY) > 0.35 * pageGlyph {
                return strokes[$0].bounds.midY < strokes[$1].bounds.midY
            }
            return strokes[$0].bounds.minX < strokes[$1].bounds.minX
        }
        for index in ordered {
            let box = strokes[index].bounds
            if let lineIndex = lines.indices.min(by: {
                abs(lineMidY(lines[$0], strokes: strokes) - box.midY)
                    < abs(lineMidY(lines[$1], strokes: strokes) - box.midY)
            }), abs(lineMidY(lines[lineIndex], strokes: strokes) - box.midY) <= 0.72 * pageGlyph {
                lines[lineIndex].append(index)
            } else {
                lines.append([index])
            }
        }

        var groups: [Group] = []
        var ambiguityPenalty = 0.0
        for line in lines {
            let xOrdered = line.sorted { strokes[$0].bounds.minX < strokes[$1].bounds.minX }
            var local: [Group] = []
            for index in xOrdered {
                let box = strokes[index].bounds
                if let candidate = bestGroup(for: box, in: local, pageGlyph: pageGlyph) {
                    let previous = local[candidate].bounds
                    local[candidate].indexes.append(index)
                    local[candidate].bounds = previous.union(box)
                    // Very wide merged groups can represent adjacent symbols
                    // whose ink nearly touched.  Keep the grouping but admit
                    // that the count is less certain.
                    if local[candidate].bounds.width > 1.65 * pageGlyph {
                        ambiguityPenalty += 0.08
                    }
                } else {
                    local.append(Group(indexes: [index], bounds: box))
                }
            }
            groups.append(contentsOf: local)
        }

        // A fraction is one top-level expression object even though it owns
        // many traces and recursively contains numerator/denominator symbols.
        let fractionGroups = fractionTraceSets.map { Array($0).sorted() }
        let allGroups = (groups.map { $0.indexes.sorted() } + fractionGroups)
            .sorted { lhs, rhs in
                let a = lhs.compactMap { strokes.indices.contains($0) ? strokes[$0].bounds.minX : nil }.min() ?? 0
                let b = rhs.compactMap { strokes.indices.contains($0) ? strokes[$0].bounds.minX : nil }.min() ?? 0
                return a < b
            }

        // Confidence reflects geometric separability, not recognition quality.
        // Dense pages, huge merged groups and very tiny isolated marks are the
        // main reasons to distrust a pure geometry count.
        let tiny = groups.filter { group in
            group.bounds.width < 0.08 * pageGlyph && group.bounds.height < 0.08 * pageGlyph
        }.count
        ambiguityPenalty += min(0.18, Double(tiny) * 0.025)
        ambiguityPenalty += min(0.12, Double(max(0, lines.count - 3)) * 0.03)
        let confidence = max(0.45, min(0.94, 0.90 - ambiguityPenalty))
        return (allGroups.count, confidence, allGroups, fractions.count)
    }

    private static func lineMidY(_ indexes: [Int], strokes: [InkStroke]) -> CGFloat {
        guard !indexes.isEmpty else { return 0 }
        let values = indexes.compactMap { strokes.indices.contains($0) ? strokes[$0].bounds.midY : nil }
        guard !values.isEmpty else { return 0 }
        return values.reduce(0, +) / CGFloat(values.count)
    }

    private static func bestGroup(for box: CGRect, in groups: [Group], pageGlyph: CGFloat) -> Int? {
        var best: (index: Int, score: CGFloat)?
        for (index, group) in groups.enumerated() {
            let other = group.bounds
            let xOverlap = max(0, min(box.maxX, other.maxX) - max(box.minX, other.minX))
            let minWidth = max(1, min(box.width, other.width))
            let overlapRatio = xOverlap / minWidth
            let centerDistance = abs(box.midX - other.midX)
            let verticalGap = max(0, max(box.minY, other.minY) - min(box.maxY, other.maxY))

            // Same-symbol multi-stroke marks usually overlap in x (x, =, θ,
            // i, !), or have nearly the same centre.  Adjacent symbols may
            // touch at an edge but should not merge merely for being close.
            let compatible = overlapRatio >= 0.28
                || (centerDistance <= 0.26 * pageGlyph && verticalGap <= 0.62 * pageGlyph)
            guard compatible else { continue }
            let score = centerDistance / pageGlyph + 0.35 * verticalGap / pageGlyph - 0.5 * overlapRatio
            if best == nil || score < best!.score { best = (index, score) }
        }
        return best?.index
    }
}
