// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Selective acceptance regression checks
// ─────────────────────────────────────────────────────────────────────────────
import CoreGraphics
import Foundation

enum InkAcceptanceSelfCheck {
    static func run() {
        var failures: [String] = []
        var checks = 0
        func check(_ name: String, _ condition: @autoclosure () -> Bool) {
            checks += 1
            if !condition() { failures.append(name) }
        }

        let cleanSymbol = ReadingSymbol(
            id: "n0_0", symbol: "x", confidence: 0.96,
            alternatives: [("*", 0.18)], box: CGRect(x: 0, y: 0, width: 20, height: 28),
            strokeIndexes: [0, 1], approximate: false
        )
        let cleanLine = ReadingLine(text: "x", box: cleanSymbol.box, symbols: [cleanSymbol],
                                    strokeIndexes: [0, 1], unread: false)
        let cleanReading = Reading(lines: [cleanLine], text: "x", minConfidence: 0.96,
                                   margin: 0.78, weakest: nil)
        let cleanGraph = InkStructureGraphBuilder.build(from: cleanReading)
        let cleanDecision = InkAcceptancePolicy.evaluate(reading: cleanReading, structure: cleanGraph)
        check("clean independent evidence may auto-accept",
              cleanDecision.status == .accept && cleanDecision.autoAccept)

        var approximate = cleanSymbol
        approximate = ReadingSymbol(id: cleanSymbol.id, symbol: cleanSymbol.symbol,
                                    confidence: cleanSymbol.confidence,
                                    alternatives: cleanSymbol.alternatives, box: cleanSymbol.box,
                                    strokeIndexes: cleanSymbol.strokeIndexes, approximate: true)
        let approxLine = ReadingLine(text: "x", box: approximate.box, symbols: [approximate],
                                     strokeIndexes: [0, 1], unread: false)
        let approxReading = Reading(lines: [approxLine], text: "x", minConfidence: 0.96,
                                    margin: 0.78, weakest: nil)
        let approxGraph = InkStructureGraphBuilder.build(from: approxReading)
        let approxDecision = InkAcceptancePolicy.evaluate(reading: approxReading, structure: approxGraph)
        check("approximate ownership never silently auto-accepts", !approxDecision.autoAccept)
        check("approximate ownership names its reason",
              approxDecision.reasons.contains("approximate-trace-ownership"))

        let weakReading = Reading(lines: [cleanLine], text: "x", minConfidence: 0.43,
                                  margin: 0.03,
                                  weakest: ("n0_0", 0, "x", 0.43, [("*", 0.40)]))
        let weakGraph = InkStructureGraphBuilder.build(from: weakReading)
        let weakDecision = InkAcceptancePolicy.evaluate(reading: weakReading, structure: weakGraph)
        check("severe ambiguity requests clarification",
              weakDecision.status == .clarify && !weakDecision.autoAccept)
        check("clarification points to the weakest symbol", weakDecision.focusSymbolID == "n0_0")

        let unreadLine = ReadingLine(text: "", box: cleanLine.box, symbols: [],
                                     strokeIndexes: [0, 1], unread: true)
        let unreadReading = Reading(lines: [unreadLine], text: "?", minConfidence: 0.2,
                                    margin: 0, weakest: nil)
        let unreadGraph = InkStructureGraphBuilder.build(from: unreadReading)
        let unreadDecision = InkAcceptancePolicy.evaluate(reading: unreadReading, structure: unreadGraph)
        check("unread ink can never be authoritative", !unreadDecision.autoAccept)

        let empty = Reading(lines: [], text: "", minConfidence: 1, margin: 1, weakest: nil)
        let emptyDecision = InkAcceptancePolicy.evaluate(
            reading: empty, structure: InkStructureGraphBuilder.build(from: empty)
        )
        check("empty input is not an accepted reading", emptyDecision.status == .empty && !emptyDecision.autoAccept)

        if failures.isEmpty {
            NSLog("PRIINK acceptance PASS %d/%d", checks, checks)
        } else {
            NSLog("PRIINK acceptance FAIL %d/%d: %@", checks - failures.count, checks,
                  failures.joined(separator: ", ") as NSString)
        }
    }
}
