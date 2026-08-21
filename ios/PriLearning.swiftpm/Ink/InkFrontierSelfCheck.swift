// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Frontier representation self-check
//
// Guards the two representations required by the next model generation:
// (1) trace-provenance mathematical structure and (2) normalized online Pencil
// sequences. These checks are deterministic and independent of Vision.
// ─────────────────────────────────────────────────────────────────────────────
import CoreGraphics
import Foundation

enum InkFrontierSelfCheck {
    static func run() {
        var failures: [String] = []
        var checks = 0

        func check(_ name: String, _ condition: @autoclosure () -> Bool) {
            checks += 1
            if !condition() { failures.append(name) }
        }

        let symbols = [
            symbol("x", id: "n0_0", x: 0, y: 20, w: 18, h: 30, strokes: [0]),
            symbol("2", id: "n0_1", x: 18, y: 3, w: 10, h: 14, strokes: [1]),
            symbol("+", id: "n0_2", x: 36, y: 23, w: 14, h: 16, strokes: [2, 3]),
            symbol("(", id: "n0_3", x: 58, y: 14, w: 8, h: 38, strokes: [4]),
            symbol("y", id: "n0_4", x: 70, y: 21, w: 18, h: 30, strokes: [5, 6]),
            symbol(")", id: "n0_5", x: 91, y: 14, w: 8, h: 38, strokes: [7])
        ]
        let line = ReadingLine(text: "x^(2)+(y)", box: CGRect(x: 0, y: 3, width: 99, height: 49),
                               symbols: symbols, strokeIndexes: Array(0...7), unread: false)
        let reading = Reading(lines: [line], text: line.text, minConfidence: 0.94,
                              margin: 0.32, weakest: nil)
        let graph = InkStructureGraphBuilder.build(from: reading)

        check("graph retains every symbol", graph.nodes.count == symbols.count)
        check("graph retains exact trace coverage", graph.traceCoverage == 1)
        check("graph records right-of sequence",
              graph.edges.contains(where: { $0.kind == .rightOf && $0.from == "n0_0" && $0.to == "n0_1" }))
        check("graph records superscript relation",
              graph.edges.contains(where: { $0.kind == .superscriptOf && $0.from == "n0_1" && $0.to == "n0_0" }))
        check("graph pairs brackets",
              graph.edges.contains(where: { $0.kind == .bracketPair && $0.from == "n0_3" && $0.to == "n0_5" }))
        check("balanced structure has no bracket risk", !graph.riskFlags.contains("unbalanced-brackets"))

        let dynamicStroke = InkStroke(points: [
            InkPoint(x: 10, y: 20, w: 3, t: 0, force: 0.4, azimuth: 0.2, altitude: 1.0),
            InkPoint(x: 20, y: 25, w: 3.2, t: 0.01, force: 0.5, azimuth: 0.25, altitude: 0.95),
            InkPoint(x: 30, y: 35, w: 3.4, t: 0.02, force: 0.6, azimuth: 0.3, altitude: 0.9)
        ])
        let sequence = InkSequenceEncoder.encode(strokes: [dynamicStroke], maxFrames: 64)
        check("sequence emits all points", sequence.frames.count == 3 && sequence.originalPointCount == 3)
        check("sequence feature contract is stable", sequence.frames.allSatisfy { $0.vector.count == InkSequenceEncoder.featureCount })
        check("sequence normalizes page coordinates",
              sequence.frames.allSatisfy { $0.x >= 0 && $0.x <= 1 && $0.y >= 0 && $0.y <= 1 })
        check("sequence preserves real Pencil dynamics", sequence.dynamicsCoverage == 1)

        var approximate = symbols
        approximate[0] = ReadingSymbol(id: approximate[0].id, symbol: approximate[0].symbol,
                                       confidence: approximate[0].confidence,
                                       alternatives: approximate[0].alternatives,
                                       box: approximate[0].box,
                                       strokeIndexes: approximate[0].strokeIndexes,
                                       approximate: true)
        let riskyLine = ReadingLine(text: line.text, box: line.box, symbols: approximate,
                                    strokeIndexes: line.strokeIndexes, unread: false)
        let risky = InkStructureGraphBuilder.build(from: Reading(
            lines: [riskyLine], text: riskyLine.text, minConfidence: 0.70,
            margin: 0.05, weakest: nil
        ))
        check("approximate ownership becomes an explicit risk",
              risky.riskFlags.contains("approximate-trace-ownership"))
        check("weak candidate margin becomes an explicit risk",
              risky.riskFlags.contains("low-candidate-margin"))

        if failures.isEmpty {
            NSLog("PRIINK frontier PASS %d/%d", checks, checks)
        } else {
            NSLog("PRIINK frontier FAIL %d/%d: %@", checks - failures.count, checks,
                  failures.joined(separator: ", ") as NSString)
        }
    }

    private static func symbol(
        _ value: String,
        id: String,
        x: CGFloat,
        y: CGFloat,
        w: CGFloat,
        h: CGFloat,
        strokes: [Int]
    ) -> ReadingSymbol {
        ReadingSymbol(id: id, symbol: value, confidence: 0.94, alternatives: [],
                      box: CGRect(x: x, y: y, width: w, height: h),
                      strokeIndexes: strokes, approximate: false)
    }
}
