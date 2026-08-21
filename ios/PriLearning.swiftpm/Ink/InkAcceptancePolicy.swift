// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Selective handwriting acceptance
//
// High recognition accuracy is not enough for marking. A recognizer that is
// 99% correct but confidently invents the remaining 1% can mark correct work as
// wrong. This policy separates perception from the decision to trust perception:
// uncertain readings are routed for another expert / one-tap clarification
// instead of being silently auto-accepted.
//
// The thresholds below are deliberately conservative PROVISIONAL evidence gates,
// not calibrated probabilities. They must eventually be fitted on a locked,
// writer-separated real Apple Pencil calibration set.
// ─────────────────────────────────────────────────────────────────────────────
import Foundation

enum InkAcceptanceStatus: String {
    case empty
    case accept
    case review
    case clarify
}

struct InkAcceptanceDecision {
    let status: InkAcceptanceStatus
    let autoAccept: Bool
    let policy: String
    let reasons: [String]
    let focusSymbolID: String?
}

enum InkAcceptancePolicy {
    static let policyName = "selective-v2-structural"

    static func evaluate(
        reading: Reading,
        structure: InkStructureGraph,
        countEvidence: InkSymbolCountEvidence? = nil,
        tree: InkExpressionTree? = nil
    ) -> InkAcceptanceDecision {
        guard !reading.text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
            return InkAcceptanceDecision(status: .empty, autoAccept: false, policy: policyName,
                                         reasons: ["no-reading"], focusSymbolID: nil)
        }

        var reasons: [String] = []
        if reading.lines.contains(where: \.unread) { reasons.append("unread-line") }
        if structure.riskFlags.contains("unbalanced-brackets") { reasons.append("unbalanced-brackets") }
        if structure.riskFlags.contains("approximate-trace-ownership") { reasons.append("approximate-trace-ownership") }
        if structure.traceCoverage < 0.98 { reasons.append("incomplete-exact-trace-coverage") }
        if reading.minConfidence < 0.88 { reasons.append("recognition-confidence-below-auto-accept") }
        if reading.margin < 0.18 { reasons.append("candidate-margin-below-auto-accept") }
        if structure.evidenceScore < 0.84 { reasons.append("structural-evidence-below-auto-accept") }
        if let countEvidence, countEvidence.mismatch {
            reasons.append("independent-symbol-count-mismatch")
        }
        if let tree {
            reasons.append(contentsOf: tree.riskFlags)
            if tree.sourceCoverage < 0.995 { reasons.append("expression-tree-source-gap") }
        }
        reasons = unique(reasons)

        let focus = reading.weakest?.id

        // These are direct signs that the current interpretation is too weak to
        // even be treated as a plausible automatic result. Ask the student to
        // resolve the smallest ambiguous unit instead of guessing.
        let severeCountMismatch = countEvidence.map { $0.mismatch && $0.confidence >= 0.85 } ?? false
        let severeTreeGap = tree.map { $0.sourceCoverage < 0.90 } ?? false
        let severe = reading.lines.contains(where: \.unread)
            || structure.riskFlags.contains("unbalanced-brackets")
            || reading.minConfidence < 0.55
            || reading.margin < 0.06
            || structure.traceCoverage < 0.75
            || severeCountMismatch
            || severeTreeGap

        if severe {
            return InkAcceptanceDecision(status: .clarify, autoAccept: false, policy: policyName,
                                         reasons: reasons.isEmpty ? ["insufficient-evidence"] : reasons,
                                         focusSymbolID: focus)
        }

        // Auto-accept only when the independent evidence channels agree: the
        // local recognizer is confident, alternatives are separated, trace
        // ownership is exact, the 2-D tree is fully backed by symbols and the
        // geometry-only count does not indicate a lost/duplicated object.
        if reasons.isEmpty && structure.riskFlags.isEmpty {
            return InkAcceptanceDecision(status: .accept, autoAccept: true, policy: policyName,
                                         reasons: [], focusSymbolID: focus)
        }

        // A plausible but non-clean result should first be offered to another
        // expert (future Core ML/MyScript/Mathpix ensemble). If no rescue expert
        // is available, the UI treats REVIEW exactly like CLARIFY: never mark it
        // silently from this reading alone.
        return InkAcceptanceDecision(status: .review, autoAccept: false, policy: policyName,
                                     reasons: reasons.isEmpty ? structure.riskFlags : reasons,
                                     focusSymbolID: focus)
    }

    private static func unique(_ values: [String]) -> [String] {
        var seen = Set<String>()
        return values.filter { seen.insert($0).inserted }
    }
}

extension InkAcceptanceDecision {
    var jsonObject: [String: Any] {
        var out: [String: Any] = [
            "status": status.rawValue,
            "autoAccept": autoAccept,
            "policy": policy,
            "reasons": reasons
        ]
        out["focusSymbol"] = focusSymbolID ?? NSNull()
        return out
    }
}
