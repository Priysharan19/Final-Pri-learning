// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Trace-provenance mathematical structure graph
//
// A recognizer should not end at a LaTeX/string guess.  This graph preserves
// which Pencil traces produced each symbol and the 2-D relations among symbols,
// so downstream marking, correction learning and future neural experts can use
// mathematical structure without losing provenance.
// ─────────────────────────────────────────────────────────────────────────────
import CoreGraphics
import Foundation

enum InkRelationKind: String {
    case rightOf
    case superscriptOf
    case subscriptOf
    case bracketPair
    case insideBrackets
}

struct InkStructureNode {
    let id: String
    let symbol: String
    let lineIndex: Int
    let box: CGRect
    let confidence: Double
    let alternatives: [(symbol: String, confidence: Double)]
    let strokeIndexes: [Int]
    let approximate: Bool
}

struct InkStructureEdge {
    let from: String
    let to: String
    let kind: InkRelationKind
    let confidence: Double
}

struct InkStructureGraph {
    let nodes: [InkStructureNode]
    let edges: [InkStructureEdge]
    let traceCoverage: Double
    let approximateNodeFraction: Double
    /// A deterministic evidence-quality summary used for diagnostics/routing.
    /// It is deliberately NOT advertised as a calibrated probability.
    let evidenceScore: Double
    let riskFlags: [String]
}

enum InkStructureGraphBuilder {
    static func build(from reading: Reading) -> InkStructureGraph {
        var nodes: [InkStructureNode] = []
        var edges: [InkStructureEdge] = []
        var allTraceIndexes = Set<Int>()
        var exactTraceIndexes = Set<Int>()

        for (lineIndex, line) in reading.lines.enumerated() {
            allTraceIndexes.formUnion(line.strokeIndexes)
            let ordered = line.symbols.sorted { lhs, rhs in
                if abs(lhs.box.midX - rhs.box.midX) > 0.5 { return lhs.box.midX < rhs.box.midX }
                return lhs.box.midY < rhs.box.midY
            }

            for symbol in ordered {
                nodes.append(InkStructureNode(
                    id: symbol.id,
                    symbol: symbol.symbol,
                    lineIndex: lineIndex,
                    box: symbol.box,
                    confidence: symbol.confidence,
                    alternatives: symbol.alternatives,
                    strokeIndexes: symbol.strokeIndexes,
                    approximate: symbol.approximate
                ))
                if !symbol.approximate { exactTraceIndexes.formUnion(symbol.strokeIndexes) }
            }

            for i in 1..<ordered.count {
                edges.append(InkStructureEdge(from: ordered[i - 1].id, to: ordered[i].id,
                                              kind: .rightOf, confidence: 0.98))
            }

            addVerticalRelations(ordered, edges: &edges)
            addBracketRelations(ordered, edges: &edges)
        }

        // Fraction/composite traces can be consumed by a structural block and
        // omitted from a line's ordinary stroke list.  Include every trace that
        // any symbol owns so coverage does not punish correctly recovered math.
        for node in nodes { allTraceIndexes.formUnion(node.strokeIndexes) }

        let coverage = allTraceIndexes.isEmpty
            ? 1
            : Double(exactTraceIndexes.count) / Double(allTraceIndexes.count)
        let approximateCount = nodes.filter(\.approximate).count
        let approximateFraction = nodes.isEmpty ? 0 : Double(approximateCount) / Double(nodes.count)

        var flags: [String] = []
        if approximateCount > 0 { flags.append("approximate-trace-ownership") }
        if coverage < 0.90 { flags.append("low-exact-trace-coverage") }
        if reading.margin < 0.10 { flags.append("low-candidate-margin") }
        if reading.lines.contains(where: \.unread) { flags.append("unread-line") }
        if hasUnbalancedBrackets(nodes) { flags.append("unbalanced-brackets") }

        let score = clamp(
            0.45 * reading.minConfidence
            + 0.25 * reading.margin
            + 0.30 * coverage
            - 0.20 * approximateFraction
            - (flags.contains("unbalanced-brackets") ? 0.12 : 0)
        )
        return InkStructureGraph(nodes: nodes, edges: edges, traceCoverage: coverage,
                                 approximateNodeFraction: approximateFraction,
                                 evidenceScore: score, riskFlags: flags)
    }

    private static func addVerticalRelations(
        _ symbols: [ReadingSymbol],
        edges: inout [InkStructureEdge]
    ) {
        guard symbols.count >= 2 else { return }
        let bodyHeights = symbols.map(\.box.height).filter { $0 > 0.5 }.sorted()
        guard !bodyHeights.isEmpty else { return }
        let bodyHeight = max(bodyHeights[bodyHeights.count / 2], 1)

        for index in 1..<symbols.count {
            let current = symbols[index]
            guard current.box.height <= 0.82 * bodyHeight else { continue }

            // Attach to the nearest preceding symbol that ends before or around
            // this mark.  This is a graph relation, not a rewrite of the text.
            let candidates = symbols[..<index].filter {
                $0.box.midX <= current.box.midX && current.box.midX - $0.box.maxX <= 1.25 * bodyHeight
            }
            guard let base = candidates.min(by: {
                abs(current.box.midX - $0.box.maxX) < abs(current.box.midX - $1.box.maxX)
            }) else { continue }

            if current.box.maxY <= base.box.midY + 0.18 * bodyHeight {
                edges.append(InkStructureEdge(from: current.id, to: base.id,
                                              kind: .superscriptOf, confidence: 0.86))
            } else if current.box.minY >= base.box.midY + 0.18 * bodyHeight {
                edges.append(InkStructureEdge(from: current.id, to: base.id,
                                              kind: .subscriptOf, confidence: 0.78))
            }
        }
    }

    private static func addBracketRelations(
        _ symbols: [ReadingSymbol],
        edges: inout [InkStructureEdge]
    ) {
        var stack: [Int] = []
        for (index, symbol) in symbols.enumerated() {
            if symbol.symbol == "(" || symbol.symbol == "[" {
                stack.append(index)
            } else if symbol.symbol == ")" || symbol.symbol == "]", let openIndex = stack.popLast() {
                let open = symbols[openIndex]
                let pairMatches = (open.symbol == "(" && symbol.symbol == ")")
                    || (open.symbol == "[" && symbol.symbol == "]")
                guard pairMatches else { continue }
                edges.append(InkStructureEdge(from: open.id, to: symbol.id,
                                              kind: .bracketPair, confidence: 0.98))
                if index > openIndex + 1 {
                    for inner in symbols[(openIndex + 1)..<index] {
                        edges.append(InkStructureEdge(from: open.id, to: inner.id,
                                                      kind: .insideBrackets, confidence: 0.90))
                    }
                }
            }
        }
    }

    private static func hasUnbalancedBrackets(_ nodes: [InkStructureNode]) -> Bool {
        var round = 0
        var square = 0
        for node in nodes {
            switch node.symbol {
            case "(": round += 1
            case ")": round -= 1
            case "[": square += 1
            case "]": square -= 1
            default: break
            }
            if round < 0 || square < 0 { return true }
        }
        return round != 0 || square != 0
    }

    private static func clamp(_ value: Double) -> Double { min(1, max(0, value)) }
}

extension InkStructureGraph {
    var jsonObject: [String: Any] {
        [
            "nodes": nodes.map { node in
                [
                    "id": node.id,
                    "sym": node.symbol,
                    "line": node.lineIndex,
                    "conf": node.confidence,
                    "strokeIdxs": node.strokeIndexes,
                    "approx": node.approximate,
                    "box": [
                        "x1": Double(node.box.minX), "y1": Double(node.box.minY),
                        "x2": Double(node.box.maxX), "y2": Double(node.box.maxY)
                    ],
                    "alts": node.alternatives.map { ["sym": $0.symbol, "conf": $0.confidence] }
                ] as [String: Any]
            },
            "edges": edges.map { edge in
                ["from": edge.from, "to": edge.to,
                 "kind": edge.kind.rawValue, "conf": edge.confidence]
            },
            "traceCoverage": traceCoverage,
            "approxNodeFraction": approximateNodeFraction,
            "evidenceScore": evidenceScore,
            "riskFlags": riskFlags
        ]
    }
}
