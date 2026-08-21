// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Structural intelligence regression checks
// ─────────────────────────────────────────────────────────────────────────────
import CoreGraphics
import Foundation

enum InkStructuralIntelligenceSelfCheck {
    static func run() {
        var failures: [String] = []
        var checks = 0
        func check(_ name: String, _ condition: @autoclosure () -> Bool) {
            checks += 1
            if !condition() { failures.append(name) }
        }

        func symbol(_ id: String, _ value: String, _ box: CGRect, _ stroke: Int,
                    confidence: Double = 0.96,
                    alternatives: [(symbol: String, confidence: Double)] = []) -> ReadingSymbol {
            ReadingSymbol(id: id, symbol: value, confidence: confidence,
                          alternatives: alternatives, box: box,
                          strokeIndexes: [stroke], approximate: false)
        }

        func line(_ symbols: [ReadingSymbol], text: String) -> ReadingLine {
            let box = symbols.dropFirst().reduce(symbols.first?.box ?? .zero) { $0.union($1.box) }
            return ReadingLine(text: text, box: box, symbols: symbols,
                               strokeIndexes: symbols.flatMap(\.strokeIndexes), unread: false)
        }

        func reading(_ lines: [ReadingLine], text: String,
                     minConfidence: Double = 0.96, margin: Double = 0.70) -> Reading {
            Reading(lines: lines, text: text, minConfidence: minConfidence,
                    margin: margin, weakest: nil)
        }

        func stroke(_ x: CGFloat, _ y: CGFloat, _ height: CGFloat = 20) -> InkStroke {
            InkStroke(points: [
                InkPoint(x: x, y: y, w: 3),
                InkPoint(x: x + 1, y: y + height, w: 3)
            ])
        }

        // Power: a smaller raised glyph must become a nested exponent, while
        // both source symbols and both source traces remain represented.
        let x = symbol("n0_0", "x", CGRect(x: 0, y: 20, width: 18, height: 28), 0)
        let two = symbol("n0_1", "2", CGRect(x: 20, y: 2, width: 9, height: 11), 1)
        let powerLine = line([x, two], text: "x^(2)")
        let powerReading = reading([powerLine], text: "x^(2)")
        let powerGraph = InkStructureGraphBuilder.build(from: powerReading)
        let powerTree = InkExpressionTreeBuilder.build(reading: powerReading, structure: powerGraph)
        check("raised glyph creates superscript relation",
              powerGraph.edges.contains { $0.kind == .superscriptOf })
        check("expression tree creates a power node",
              powerTree.root.children.first?.children.first?.kind == .power)
        check("power tree preserves all source symbols", powerTree.sourceCoverage == 1)

        // Function call: sin(x) is one semantic call with an argument group,
        // not six unrelated glyphs in the structural representation.
        let functionValues = ["s", "i", "n", "(", "x", ")"]
        let functionSymbols = functionValues.enumerated().map { index, value in
            symbol("f\(index)", value,
                   CGRect(x: CGFloat(index * 13), y: 20, width: 10, height: 24), index)
        }
        let functionReading = reading([line(functionSymbols, text: "sin(x)")], text: "sin(x)")
        let functionGraph = InkStructureGraphBuilder.build(from: functionReading)
        let functionTree = InkExpressionTreeBuilder.build(reading: functionReading, structure: functionGraph)
        let functionNode = functionTree.root.children.first?.children.first
        check("function letters collapse into functionCall", functionNode?.kind == .functionCall)
        check("function call preserves its name", functionNode?.value == "sin")
        check("function call owns an argument group", functionNode?.children.first?.kind == .group)

        // Fraction recognition already produces a composite symbol; the tree
        // must expose numerator and denominator explicitly instead of leaving a
        // marker to reverse-engineer the serialized string.
        let fraction = symbol("frac", "(1)/(2)", CGRect(x: 0, y: 0, width: 35, height: 45), 0)
        let fractionReading = reading([line([fraction], text: "(1)/(2)")], text: "(1)/(2)")
        let fractionTree = InkExpressionTreeBuilder.build(
            reading: fractionReading, structure: InkStructureGraphBuilder.build(from: fractionReading)
        )
        let fractionNode = fractionTree.root.children.first?.children.first
        check("fraction becomes structural fraction node", fractionNode?.kind == .fraction)
        check("fraction exposes numerator and denominator", fractionNode?.children.map(\.kind) == [.numerator, .denominator])

        // Geometry-only counting must not simply parrot the OCR string.
        let countStrokes = [stroke(0, 0), stroke(32, 0), stroke(64, 0)]
        let countEstimate = InkSymbolCountEstimator.estimate(strokes: countStrokes)
        check("geometry count sees three separated primitives", countEstimate.count == 3)

        let onlyTwo = [
            symbol("c0", "1", CGRect(x: 0, y: 0, width: 5, height: 20), 0),
            symbol("c1", "1", CGRect(x: 32, y: 0, width: 5, height: 20), 1)
        ]
        let shortReading = reading([line(onlyTwo, text: "11")], text: "11")
        let countEvidence = InkSymbolCountEstimator.evaluate(reading: shortReading, strokes: countStrokes)
        check("independent count detects a dropped top-level object", countEvidence.mismatch)

        let shortGraph = InkStructureGraphBuilder.build(from: shortReading)
        let shortTree = InkExpressionTreeBuilder.build(reading: shortReading, structure: shortGraph)
        let countDecision = InkAcceptancePolicy.evaluate(
            reading: shortReading, structure: shortGraph,
            countEvidence: countEvidence, tree: shortTree
        )
        check("high-confidence count mismatch cannot auto-accept", !countDecision.autoAccept)

        // Very weak hard-confusion glyphs should generate a tiny targeted
        // refinement request rather than re-running every recognizer over page.
        let weak = symbol(
            "weak", "x", CGRect(x: 10, y: 10, width: 18, height: 20), 0,
            confidence: 0.48, alternatives: [("*", 0.45), ("4", 0.30)]
        )
        let weakReading = Reading(
            lines: [line([weak], text: "x")], text: "x",
            minConfidence: 0.48, margin: 0.03,
            weakest: ("weak", 0, "x", 0.48, [("*", 0.45)])
        )
        let weakGraph = InkStructureGraphBuilder.build(from: weakReading)
        let weakCount = InkSymbolCountEstimator.evaluate(reading: weakReading, strokes: [stroke(10, 10)])
        let weakPlan = InkRefinementPlanner.plan(
            reading: weakReading, structure: weakGraph,
            countEvidence: weakCount, strokes: [stroke(10, 10)]
        )
        check("weak hard confusion produces local refinement region",
              weakPlan.regions.first?.symbolID == "weak")
        check("hard confusion requests stroke-native and specialist evidence",
              weakPlan.regions.first?.strategies.contains(.strokeNative) == true
                && weakPlan.regions.first?.strategies.contains(.externalMathSpecialist) == true)
        check("severe unresolved ambiguity routes to clarification", weakPlan.shouldClarifyIfUnresolved)

        let fullPayload = weakReading.jsonObject(strokes: [stroke(10, 10)])
        check("full reading payload carries tree count and refinement",
              fullPayload["tree"] != nil
                && fullPayload["symbolCountEvidence"] != nil
                && fullPayload["refinement"] != nil)
        check("full structural payload remains valid JSON", JSONSerialization.isValidJSONObject(fullPayload))

        if failures.isEmpty {
            NSLog("PRIINK structural PASS %d/%d", checks, checks)
        } else {
            NSLog("PRIINK structural FAIL %d/%d: %@", checks - failures.count, checks,
                  failures.joined(separator: ", ") as NSString)
        }
    }
}
