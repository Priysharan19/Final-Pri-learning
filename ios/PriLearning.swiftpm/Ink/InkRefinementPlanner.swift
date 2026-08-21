// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Confidence-guided local refinement
//
// Expensive recognizers should not re-read an entire page every time one glyph
// is uncertain.  This planner identifies the smallest trace-backed regions that
// deserve another pass and records which evidence channels are worth invoking.
// It never changes recognized text by itself.
// ─────────────────────────────────────────────────────────────────────────────
import CoreGraphics
import Foundation

enum InkRefinementStrategy: String {
    case strokeNative = "stroke-native"
    case tightRaster = "tight-raster"
    case expandedContextRaster = "expanded-context-raster"
    case expressionTree = "expression-tree"
    case independentSymbolCount = "independent-symbol-count"
    case externalMathSpecialist = "external-math-specialist"
    case studentClarification = "student-clarification"
}

struct InkRefinementRegion {
    let id: String
    let symbolID: String?
    let strokeIndexes: [Int]
    let box: CGRect
    let priority: Int
    let reasons: [String]
    let strategies: [InkRefinementStrategy]

    var jsonObject: [String: Any] {
        var object: [String: Any] = [
            "id": id,
            "strokeIdxs": strokeIndexes,
            "priority": priority,
            "reasons": reasons,
            "strategies": strategies.map(\.rawValue),
            "box": [
                "x1": Double(box.minX), "y1": Double(box.minY),
                "x2": Double(box.maxX), "y2": Double(box.maxY)
            ]
        ]
        object["symbolID"] = symbolID ?? NSNull()
        return object
    }
}

struct InkRefinementPlan {
    let regions: [InkRefinementRegion]
    let requiresAdditionalExpert: Bool
    let shouldClarifyIfUnresolved: Bool

    var jsonObject: [String: Any] {
        [
            "regions": regions.map(\.jsonObject),
            "requiresAdditionalExpert": requiresAdditionalExpert,
            "shouldClarifyIfUnresolved": shouldClarifyIfUnresolved
        ]
    }
}

enum InkRefinementPlanner {
    private static let hardFamilies: [Set<String>] = [
        ["1", "l", "I", "|", "y"], ["0", "o", "O", "theta"],
        ["2", "z", "Z"], ["5", "s", "S"], ["8", "B", "3"],
        ["9", "g", "q", "4"], ["x", "*", "×", "✕", "4", "k"],
        ["+", "t"], ["c", "("]
    ]

    static func plan(
        reading: Reading,
        structure: InkStructureGraph,
        countEvidence: InkSymbolCountEvidence,
        strokes: [InkStroke]
    ) -> InkRefinementPlan {
        var regions: [InkRefinementRegion] = []
        let symbols = reading.lines.flatMap(\.symbols)

        for symbol in symbols {
            let rival = symbol.alternatives.first?.confidence ?? 0
            let margin = max(0, symbol.confidence - rival)
            var reasons: [String] = []
            var priority = 0

            if symbol.approximate {
                reasons.append("approximate-trace-ownership")
                priority = max(priority, 95)
            }
            if symbol.confidence < 0.55 {
                reasons.append("very-low-symbol-confidence")
                priority = max(priority, 100)
            } else if symbol.confidence < 0.82 {
                reasons.append("low-symbol-confidence")
                priority = max(priority, 78)
            }
            if margin < 0.06 {
                reasons.append("very-low-local-margin")
                priority = max(priority, 98)
            } else if margin < 0.16 {
                reasons.append("low-local-margin")
                priority = max(priority, 82)
            }
            if hasHardConfusion(symbol) {
                reasons.append("hard-confusion-family")
                priority = max(priority, 90)
            }
            guard !reasons.isEmpty else { continue }

            let indexes = symbol.strokeIndexes.filter { strokes.indices.contains($0) && !strokes[$0].isEmpty }
            let box = indexes.compactMap { strokes[$0].bounds }.reduce(symbol.box) { $0.union($1) }
            var strategies: [InkRefinementStrategy] = [.tightRaster, .expandedContextRaster]
            if !indexes.isEmpty { strategies.insert(.strokeNative, at: 0) }
            if symbol.approximate { strategies.append(.expressionTree) }
            if hasHardConfusion(symbol) { strategies.append(.externalMathSpecialist) }
            if priority >= 95 { strategies.append(.studentClarification) }

            regions.append(InkRefinementRegion(
                id: "refine-\(symbol.id)", symbolID: symbol.id,
                strokeIndexes: indexes, box: box, priority: priority,
                reasons: unique(reasons), strategies: uniqueStrategies(strategies)
            ))
        }

        if countEvidence.mismatch || structure.riskFlags.contains("unbalanced-brackets") {
            let indexes = Array(Set(strokes.indices.filter { !strokes[$0].isEmpty })).sorted()
            let box = indexes.compactMap { strokes[$0].bounds }.reduce(CGRect.null) { $0.union($1) }
            var reasons: [String] = []
            if countEvidence.mismatch { reasons.append("geometry-symbol-count-mismatch") }
            if structure.riskFlags.contains("unbalanced-brackets") { reasons.append("unbalanced-brackets") }
            regions.append(InkRefinementRegion(
                id: "refine-expression", symbolID: nil, strokeIndexes: indexes,
                box: box.isNull ? .zero : box, priority: 99, reasons: reasons,
                strategies: [.independentSymbolCount, .expressionTree,
                             .externalMathSpecialist, .studentClarification]
            ))
        }

        // Re-reading ten regions would destroy latency and usually means the
        // whole expression is not trustworthy anyway. Keep only the most useful
        // local requests; a global structural region wins ties.
        regions.sort {
            if $0.priority != $1.priority { return $0.priority > $1.priority }
            return $0.strokeIndexes.count < $1.strokeIndexes.count
        }
        let selected = Array(regions.prefix(4))
        let requiresExpert = selected.contains { region in
            region.strategies.contains(.externalMathSpecialist)
                || region.strategies.contains(.strokeNative)
        }
        let clarify = selected.contains { $0.strategies.contains(.studentClarification) }
            || countEvidence.mismatch
        return InkRefinementPlan(regions: selected, requiresAdditionalExpert: requiresExpert,
                                 shouldClarifyIfUnresolved: clarify)
    }

    private static func hasHardConfusion(_ symbol: ReadingSymbol) -> Bool {
        let candidates = [symbol.symbol] + symbol.alternatives.prefix(4).map(\.symbol)
        guard candidates.count >= 2 else { return false }
        for family in hardFamilies {
            let matches = Set(candidates.filter { family.contains($0) })
            if matches.count >= 2 { return true }
        }
        return false
    }

    private static func unique(_ values: [String]) -> [String] {
        var seen = Set<String>()
        return values.filter { seen.insert($0).inserted }
    }

    private static func uniqueStrategies(_ values: [InkRefinementStrategy]) -> [InkRefinementStrategy] {
        var seen = Set<String>()
        return values.filter { seen.insert($0.rawValue).inserted }
    }
}
