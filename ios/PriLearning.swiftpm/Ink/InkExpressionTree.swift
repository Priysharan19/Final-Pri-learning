// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Trace-backed mathematical expression tree
//
// LaTeX/text is a serialization, not mathematical truth.  This tree lifts the
// trace-provenance graph into nested mathematical objects so downstream marking
// can reason about powers, subscripts, groups, functions and fractions without
// forgetting which Pencil traces produced them.
// ─────────────────────────────────────────────────────────────────────────────
import Foundation

enum InkExpressionTreeKind: String {
    case document
    case line
    case sequence
    case symbol
    case group
    case functionCall
    case power
    case subscript
    case fraction
    case numerator
    case denominator
}

struct InkExpressionTreeNode {
    let id: String
    let kind: InkExpressionTreeKind
    let value: String?
    let confidence: Double
    let sourceSymbolIDs: [String]
    let strokeIndexes: [Int]
    let children: [InkExpressionTreeNode]

    var jsonObject: [String: Any] {
        var object: [String: Any] = [
            "id": id,
            "kind": kind.rawValue,
            "confidence": confidence,
            "sourceSymbolIDs": sourceSymbolIDs,
            "strokeIdxs": strokeIndexes,
            "children": children.map(\.jsonObject)
        ]
        object["value"] = value ?? NSNull()
        return object
    }
}

struct InkExpressionTree {
    let root: InkExpressionTreeNode
    let sourceCoverage: Double
    let unresolvedRelationCount: Int
    let riskFlags: [String]

    var jsonObject: [String: Any] {
        [
            "root": root.jsonObject,
            "sourceCoverage": sourceCoverage,
            "unresolvedRelationCount": unresolvedRelationCount,
            "riskFlags": riskFlags
        ]
    }
}

enum InkExpressionTreeBuilder {
    private static let functionNames = ["sqrt", "sin", "cos", "tan", "sec", "csc", "cot", "log", "ln"]

    static func build(reading: Reading, structure: InkStructureGraph) -> InkExpressionTree {
        var lineNodes: [InkExpressionTreeNode] = []
        for (lineIndex, line) in reading.lines.enumerated() {
            let ordered = line.symbols.sorted {
                if abs($0.box.midX - $1.box.midX) > 0.5 { return $0.box.midX < $1.box.midX }
                return $0.box.midY < $1.box.midY
            }
            let children = buildSequence(ordered, edges: structure.edges, scope: "l\(lineIndex)")
            lineNodes.append(InkExpressionTreeNode(
                id: "tree-line-\(lineIndex)",
                kind: .line,
                value: line.text,
                confidence: minimumConfidence(children),
                sourceSymbolIDs: unique(children.flatMap(\.sourceSymbolIDs)),
                strokeIndexes: uniqueInts(children.flatMap(\.strokeIndexes)),
                children: children
            ))
        }

        let allSourceIDs = Set(reading.lines.flatMap(\.symbols).map(\.id))
        let representedIDs = Set(lineNodes.flatMap(\.sourceSymbolIDs))
        let coverage = allSourceIDs.isEmpty
            ? 1
            : Double(representedIDs.intersection(allSourceIDs).count) / Double(allSourceIDs.count)

        let unresolved = structure.edges.filter { edge in
            !representedIDs.contains(edge.from) || !representedIDs.contains(edge.to)
        }.count
        var risks: [String] = []
        if coverage < 0.999 { risks.append("tree-source-coverage-incomplete") }
        if unresolved > 0 { risks.append("unresolved-structural-relations") }
        if lineNodes.isEmpty && !reading.text.isEmpty { risks.append("tree-empty-for-nonempty-reading") }

        let root = InkExpressionTreeNode(
            id: "tree-root",
            kind: .document,
            value: reading.text,
            confidence: minimumConfidence(lineNodes),
            sourceSymbolIDs: unique(lineNodes.flatMap(\.sourceSymbolIDs)),
            strokeIndexes: uniqueInts(lineNodes.flatMap(\.strokeIndexes)),
            children: lineNodes
        )
        return InkExpressionTree(root: root, sourceCoverage: coverage,
                                 unresolvedRelationCount: unresolved, riskFlags: risks)
    }

    private static func buildSequence(
        _ symbols: [ReadingSymbol],
        edges: [InkStructureEdge],
        scope: String
    ) -> [InkExpressionTreeNode] {
        guard !symbols.isEmpty else { return [] }
        let superscripts = Dictionary(grouping: edges.filter { $0.kind == .superscriptOf }, by: \.to)
        let subscripts = Dictionary(grouping: edges.filter { $0.kind == .subscriptOf }, by: \.to)
        let attachedIDs = Set((superscripts.values.flatMap { $0 } + subscripts.values.flatMap { $0 }).map(\.from))
        let byID = Dictionary(uniqueKeysWithValues: symbols.map { ($0.id, $0) })

        var result: [InkExpressionTreeNode] = []
        var index = 0
        while index < symbols.count {
            let symbol = symbols[index]
            if attachedIDs.contains(symbol.id) {
                index += 1
                continue
            }

            if let function = functionMatch(symbols, start: index),
               function.endIndex < symbols.count,
               symbols[function.endIndex].symbol == "(",
               let close = matchingBracket(symbols, openIndex: function.endIndex) {
                let nameSymbols = Array(symbols[index..<function.endIndex])
                let argumentSymbols = close > function.endIndex + 1
                    ? Array(symbols[(function.endIndex + 1)..<close])
                    : []
                let argumentChildren = buildSequence(argumentSymbols, edges: edges,
                                                     scope: "\(scope)-fn-\(index)")
                let functionIDs = nameSymbols.map(\.id)
                let bracketIDs = [symbols[function.endIndex].id, symbols[close].id]
                let allIDs = functionIDs + bracketIDs + argumentChildren.flatMap(\.sourceSymbolIDs)
                let allStrokes = nameSymbols.flatMap(\.strokeIndexes)
                    + symbols[function.endIndex].strokeIndexes
                    + symbols[close].strokeIndexes
                    + argumentChildren.flatMap(\.strokeIndexes)
                let argument = InkExpressionTreeNode(
                    id: "tree-\(scope)-arg-\(index)", kind: .group, value: nil,
                    confidence: minimumConfidence(argumentChildren),
                    sourceSymbolIDs: unique(argumentChildren.flatMap(\.sourceSymbolIDs)),
                    strokeIndexes: uniqueInts(argumentChildren.flatMap(\.strokeIndexes)),
                    children: argumentChildren
                )
                result.append(InkExpressionTreeNode(
                    id: "tree-\(scope)-fn-\(index)", kind: .functionCall,
                    value: function.name,
                    confidence: min(nameSymbols.map(\.confidence).min() ?? 1, argument.confidence),
                    sourceSymbolIDs: unique(allIDs), strokeIndexes: uniqueInts(allStrokes),
                    children: [argument]
                ))
                index = close + 1
                continue
            }

            if symbol.symbol == "(", let close = matchingBracket(symbols, openIndex: index) {
                let innerSymbols = close > index + 1 ? Array(symbols[(index + 1)..<close]) : []
                let inner = buildSequence(innerSymbols, edges: edges, scope: "\(scope)-g-\(index)")
                let ids = [symbol.id, symbols[close].id] + inner.flatMap(\.sourceSymbolIDs)
                let strokes = symbol.strokeIndexes + symbols[close].strokeIndexes + inner.flatMap(\.strokeIndexes)
                result.append(InkExpressionTreeNode(
                    id: "tree-\(scope)-group-\(index)", kind: .group, value: nil,
                    confidence: min(symbol.confidence, symbols[close].confidence,
                                    minimumConfidence(inner)),
                    sourceSymbolIDs: unique(ids), strokeIndexes: uniqueInts(strokes), children: inner
                ))
                index = close + 1
                continue
            }

            var node = leafNode(symbol, id: "tree-\(scope)-s-\(index)")
            if let exponentEdges = superscripts[symbol.id], !exponentEdges.isEmpty {
                let exponentSymbols = exponentEdges.compactMap { byID[$0.from] }
                let exponentChildren = exponentSymbols.map {
                    leafNode($0, id: "tree-\(scope)-exp-\($0.id)")
                }
                let exponent = InkExpressionTreeNode(
                    id: "tree-\(scope)-exponent-\(index)", kind: .sequence, value: nil,
                    confidence: minimumConfidence(exponentChildren),
                    sourceSymbolIDs: unique(exponentChildren.flatMap(\.sourceSymbolIDs)),
                    strokeIndexes: uniqueInts(exponentChildren.flatMap(\.strokeIndexes)),
                    children: exponentChildren
                )
                node = InkExpressionTreeNode(
                    id: "tree-\(scope)-power-\(index)", kind: .power, value: nil,
                    confidence: min(node.confidence, exponent.confidence),
                    sourceSymbolIDs: unique(node.sourceSymbolIDs + exponent.sourceSymbolIDs),
                    strokeIndexes: uniqueInts(node.strokeIndexes + exponent.strokeIndexes),
                    children: [node, exponent]
                )
            }
            if let subscriptEdges = subscripts[symbol.id], !subscriptEdges.isEmpty {
                let subscriptSymbols = subscriptEdges.compactMap { byID[$0.from] }
                let subChildren = subscriptSymbols.map {
                    leafNode($0, id: "tree-\(scope)-sub-\($0.id)")
                }
                let sub = InkExpressionTreeNode(
                    id: "tree-\(scope)-subscript-value-\(index)", kind: .sequence, value: nil,
                    confidence: minimumConfidence(subChildren),
                    sourceSymbolIDs: unique(subChildren.flatMap(\.sourceSymbolIDs)),
                    strokeIndexes: uniqueInts(subChildren.flatMap(\.strokeIndexes)),
                    children: subChildren
                )
                node = InkExpressionTreeNode(
                    id: "tree-\(scope)-subscript-\(index)", kind: .subscript, value: nil,
                    confidence: min(node.confidence, sub.confidence),
                    sourceSymbolIDs: unique(node.sourceSymbolIDs + sub.sourceSymbolIDs),
                    strokeIndexes: uniqueInts(node.strokeIndexes + sub.strokeIndexes),
                    children: [node, sub]
                )
            }
            result.append(node)
            index += 1
        }
        return result
    }

    private static func leafNode(_ symbol: ReadingSymbol, id: String) -> InkExpressionTreeNode {
        if let parts = fractionParts(symbol.symbol) {
            let numerator = InkExpressionTreeNode(
                id: "\(id)-num", kind: .numerator, value: parts.numerator,
                confidence: symbol.confidence,
                sourceSymbolIDs: [symbol.id], strokeIndexes: symbol.strokeIndexes, children: []
            )
            let denominator = InkExpressionTreeNode(
                id: "\(id)-den", kind: .denominator, value: parts.denominator,
                confidence: symbol.confidence,
                sourceSymbolIDs: [symbol.id], strokeIndexes: symbol.strokeIndexes, children: []
            )
            return InkExpressionTreeNode(
                id: id, kind: .fraction, value: symbol.symbol, confidence: symbol.confidence,
                sourceSymbolIDs: [symbol.id], strokeIndexes: symbol.strokeIndexes,
                children: [numerator, denominator]
            )
        }
        return InkExpressionTreeNode(
            id: id, kind: .symbol, value: symbol.symbol, confidence: symbol.confidence,
            sourceSymbolIDs: [symbol.id], strokeIndexes: symbol.strokeIndexes, children: []
        )
    }

    private static func functionMatch(
        _ symbols: [ReadingSymbol], start: Int
    ) -> (name: String, endIndex: Int)? {
        for name in functionNames {
            let letters = Array(name).map(String.init)
            guard start + letters.count <= symbols.count else { continue }
            let run = symbols[start..<(start + letters.count)].map { $0.symbol.lowercased() }
            if run == letters { return (name, start + letters.count) }
        }
        // `sqrt` can also arrive as one canonical symbol rather than four OCR
        // letters. Treat that representation as the same function.
        if symbols[start].symbol.lowercased() == "sqrt" { return ("sqrt", start + 1) }
        return nil
    }

    private static func matchingBracket(_ symbols: [ReadingSymbol], openIndex: Int) -> Int? {
        guard symbols.indices.contains(openIndex), symbols[openIndex].symbol == "(" else { return nil }
        var depth = 0
        for index in openIndex..<symbols.count {
            if symbols[index].symbol == "(" { depth += 1 }
            if symbols[index].symbol == ")" {
                depth -= 1
                if depth == 0 { return index }
                if depth < 0 { return nil }
            }
        }
        return nil
    }

    private static func fractionParts(_ raw: String) -> (numerator: String, denominator: String)? {
        guard raw.hasPrefix("("), raw.hasSuffix(")"),
              let range = raw.range(of: ")/(") else { return nil }
        let numeratorStart = raw.index(after: raw.startIndex)
        let numerator = String(raw[numeratorStart..<range.lowerBound])
        let denominatorStart = range.upperBound
        let denominatorEnd = raw.index(before: raw.endIndex)
        guard denominatorStart <= denominatorEnd else { return nil }
        let denominator = String(raw[denominatorStart..<denominatorEnd])
        guard !numerator.isEmpty, !denominator.isEmpty else { return nil }
        return (numerator, denominator)
    }

    private static func minimumConfidence(_ nodes: [InkExpressionTreeNode]) -> Double {
        nodes.map(\.confidence).min() ?? 1
    }

    private static func unique(_ values: [String]) -> [String] {
        var seen = Set<String>()
        return values.filter { seen.insert($0).inserted }
    }

    private static func uniqueInts(_ values: [Int]) -> [Int] {
        Array(Set(values)).sorted()
    }
}
