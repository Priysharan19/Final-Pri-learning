// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Deterministic expert-fusion safety checks
// ─────────────────────────────────────────────────────────────────────────────
import CoreGraphics
import Foundation

enum InkExpertFusionSelfCheck {
    static func run() {
        var failures: [String] = []
        var checks = 0
        func check(_ name: String, _ condition: @autoclosure () -> Bool) {
            checks += 1
            if !condition() { failures.append(name) }
        }

        let local = reading("x=3", confidence: 0.86, margin: 0.14)
        let graph = InkStructureGraphBuilder.build(from: local)
        let review = InkAcceptanceDecision(status: .review, autoAccept: false,
                                           policy: "selfcheck", reasons: ["borderline"], focusSymbolID: nil)
        let accept = InkAcceptanceDecision(status: .accept, autoAccept: true,
                                           policy: "selfcheck", reasons: [], focusSymbolID: nil)
        let clarify = InkAcceptanceDecision(status: .clarify, autoAccept: false,
                                            policy: "selfcheck", reasons: ["ambiguous"], focusSymbolID: "n0_0")

        let clean = InkExpertFusion.fuse(local: local, localDecision: accept, structure: graph, experts: [])
        check("clean local acceptance survives with no experts", clean.autoAccept && clean.status == .accept)

        let duplicateVision = InkExpertFusion.fuse(
            local: local, localDecision: review, structure: graph,
            experts: [
                expert("x=3", group: "vision", calibrated: true, confidence: 0.99),
                expert("x=3", source: "vision-large", group: "vision", calibrated: true, confidence: 0.98),
                expert("x=3", source: "vision-fast", group: "vision", calibrated: true, confidence: 0.97)
            ]
        )
        check("three views of one model count as one expert", !duplicateVision.autoAccept)
        check("same-family votes are deduplicated", duplicateVision.agreeingGroups == ["vision"])

        let loneExternal = InkExpertFusion.fuse(
            local: local, localDecision: review, structure: graph,
            experts: [expert("x=8", group: "mathpix", calibrated: true, confidence: 0.99)]
        )
        check("one high-confidence external expert cannot overwrite local", loneExternal.text == "x=3" && !loneExternal.autoAccept)

        let uncalibratedAgreement = InkExpertFusion.fuse(
            local: local, localDecision: review, structure: graph,
            experts: [
                expert("x=3", group: "mathpix", calibrated: false, confidence: 0.99),
                expert("x=3", group: "myscript", calibrated: false, confidence: 0.99)
            ]
        )
        check("uncalibrated agreement cannot promote review", !uncalibratedAgreement.autoAccept)

        let calibratedAgreement = InkExpertFusion.fuse(
            local: local, localDecision: review, structure: graph,
            experts: [
                expert("x=3", group: "mathpix", calibrated: true, confidence: 0.96),
                expert("x=3", group: "myscript", calibrated: true, confidence: 0.95)
            ]
        )
        check("two calibrated independent experts may rescue clean borderline review",
              calibratedAgreement.autoAccept && calibratedAgreement.status == .accept)

        let approximate = reading("x=3", confidence: 0.86, margin: 0.14, approximate: true)
        let riskyGraph = InkStructureGraphBuilder.build(from: approximate)
        let structuralRisk = InkExpertFusion.fuse(
            local: approximate, localDecision: review, structure: riskyGraph,
            experts: [
                expert("x=3", group: "mathpix", calibrated: true, confidence: 0.96),
                expert("x=3", group: "myscript", calibrated: true, confidence: 0.95)
            ]
        )
        check("trace/structure risk blocks consensus rescue", !structuralRisk.autoAccept)

        let ambiguousLocal = reading("1=3", confidence: 0.95, margin: 0.50)
        let ambiguousGraph = InkStructureGraphBuilder.build(from: ambiguousLocal)
        let hardConfusion = InkExpertFusion.fuse(
            local: ambiguousLocal, localDecision: accept, structure: ambiguousGraph,
            experts: [expert("y=3", group: "stroke-net", calibrated: false, confidence: 0.70)]
        )
        check("hard confusion disagreement forces clarification",
              hardConfusion.status == .clarify && !hardConfusion.autoAccept)

        let countMismatch = InkExpertFusion.fuse(
            local: local, localDecision: accept, structure: graph,
            experts: [expert("x=3", group: "count-head", calibrated: false,
                            confidence: 0.75, symbolCount: 4)]
        )
        check("independent symbol-count mismatch forces clarification",
              countMismatch.status == .clarify && !countMismatch.autoAccept)

        let calibratedOpposition = InkExpertFusion.fuse(
            local: local, localDecision: accept, structure: graph,
            experts: [
                expert("x=8", group: "mathpix", calibrated: true, confidence: 0.97),
                expert("x=8", group: "myscript", calibrated: true, confidence: 0.96)
            ]
        )
        check("two trusted independent dissenters demote local acceptance rather than overwrite",
              calibratedOpposition.status == .clarify && !calibratedOpposition.autoAccept
                && calibratedOpposition.text == "x=3")

        let stickyClarify = InkExpertFusion.fuse(
            local: local, localDecision: clarify, structure: graph,
            experts: [
                expert("x=3", group: "mathpix", calibrated: true, confidence: 1.0),
                expert("x=3", group: "myscript", calibrated: true, confidence: 1.0)
            ]
        )
        check("local clarify can never be promoted silently", stickyClarify.status == .clarify && !stickyClarify.autoAccept)

        if failures.isEmpty {
            NSLog("PRIINK fusion PASS %d/%d", checks, checks)
        } else {
            NSLog("PRIINK fusion FAIL %d/%d: %@", checks - failures.count, checks,
                  failures.joined(separator: ", ") as NSString)
        }
    }

    private static func expert(
        _ text: String,
        source: String = "expert",
        group: String,
        calibrated: Bool,
        confidence: Double,
        symbolCount: Int? = nil
    ) -> InkExpertHypothesis {
        InkExpertHypothesis(text: text, confidence: confidence, sourceID: source,
                            independenceGroup: group, calibratedForProduction: calibrated,
                            symbolCount: symbolCount)
    }

    private static func reading(
        _ text: String,
        confidence: Double,
        margin: Double,
        approximate: Bool = false
    ) -> Reading {
        let chars = Array(text)
        let symbols: [ReadingSymbol] = chars.enumerated().map { index, char in
            ReadingSymbol(
                id: "n0_\(index)", symbol: String(char), confidence: confidence,
                alternatives: [],
                box: CGRect(x: CGFloat(index) * 18, y: 0, width: 12, height: 24),
                strokeIndexes: [index], approximate: approximate
            )
        }
        let line = ReadingLine(
            text: text,
            box: CGRect(x: 0, y: 0, width: max(12, CGFloat(chars.count) * 18), height: 24),
            symbols: symbols,
            strokeIndexes: Array(symbols.indices),
            unread: false
        )
        return Reading(lines: [line], text: text, minConfidence: confidence,
                       margin: margin, weakest: nil)
    }
}
