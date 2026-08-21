// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Independence-aware handwriting expert fusion
//
// Frontier HMER systems are complementary rather than interchangeable. A
// raster OCR model, an online-stroke model and a structural math recognizer can
// fail for different reasons; several resized views of the SAME OCR model do
// not constitute independent evidence. This file encodes that distinction.
//
// The fusion layer is deliberately conservative:
// - no external expert can silently replace a local interpretation;
// - duplicate views from one model family count once;
// - uncalibrated experts can reveal disagreement but cannot promote acceptance;
// - hard visual-confusion disagreements force clarification;
// - symbol-count disagreement is evidence of under/over recognition;
// - structural/trace risk blocks consensus rescue;
// - a local CLARIFY decision is never promoted automatically.
//
// Production calibration must be fitted on a locked, writer-separated real
// Apple Pencil set. Until then providers set `calibratedForProduction = false`.
// ─────────────────────────────────────────────────────────────────────────────
import Foundation

struct InkExpertHypothesis: Sendable {
    let text: String
    let confidence: Double
    let sourceID: String
    /// Sources sharing an independence group reuse substantially the same model
    /// or representation and therefore count as ONE vote.
    let independenceGroup: String
    let calibratedForProduction: Bool
    /// Optional independent estimate of semantic symbol count. A provider that
    /// cannot produce a trustworthy count should leave this nil rather than
    /// deriving a fake-precise number from its output string.
    let symbolCount: Int?

    init(
        text: String,
        confidence: Double,
        sourceID: String,
        independenceGroup: String,
        calibratedForProduction: Bool = false,
        symbolCount: Int? = nil
    ) {
        self.text = text
        self.confidence = min(1, max(0, confidence))
        self.sourceID = sourceID
        self.independenceGroup = independenceGroup
        self.calibratedForProduction = calibratedForProduction
        self.symbolCount = symbolCount
    }
}

struct InkExpertFusionResult {
    let text: String
    let status: InkAcceptanceStatus
    let autoAccept: Bool
    let reasons: [String]
    let agreeingGroups: [String]
    let disagreeingGroups: [String]

    var jsonObject: [String: Any] {
        [
            "text": text,
            "status": status.rawValue,
            "autoAccept": autoAccept,
            "reasons": reasons,
            "agreeingGroups": agreeingGroups,
            "disagreeingGroups": disagreeingGroups
        ]
    }
}

enum InkExpertFusion {
    private static let trustedExpertFloor = 0.90
    private static let rescueLocalConfidenceFloor = 0.65
    private static let rescueLocalMarginFloor = 0.08
    private static let rescueTraceCoverageFloor = 0.98
    private static let rescueStructureFloor = 0.82
    private static let independentExpertsForRescue = 2

    private static let confusionFamilies: [Set<String>] = [
        ["1", "l", "I", "|", "y"],
        ["0", "o", "O", "theta"],
        ["2", "z", "Z"],
        ["5", "s", "S"],
        ["6", "b", "G"],
        ["7", "T", "1"],
        ["8", "B", "3"],
        ["9", "g", "q", "4"],
        ["x", "*", "×", "✕", "4", "k"],
        ["r", "v", "u"],
        ["+", "t"],
        ["c", "("]
    ]

    static func fuse(
        local reading: Reading,
        localDecision: InkAcceptanceDecision,
        structure: InkStructureGraph,
        experts rawExperts: [InkExpertHypothesis]
    ) -> InkExpertFusionResult {
        let local = canonical(reading.text)
        guard !local.isEmpty else {
            return InkExpertFusionResult(text: reading.text, status: .empty, autoAccept: false,
                                         reasons: ["no-local-reading"], agreeingGroups: [], disagreeingGroups: [])
        }

        // Independence-aware dedupe: keep only the strongest hypothesis from a
        // model family. Multiple crops/raster scales may improve that model's
        // internal inference, but they must not multiply its vote externally.
        var byGroup: [String: InkExpertHypothesis] = [:]
        for expert in rawExperts where !expert.independenceGroup.isEmpty {
            let current = byGroup[expert.independenceGroup]
            if current == nil || expert.confidence > current!.confidence {
                byGroup[expert.independenceGroup] = expert
            }
        }
        let experts = Array(byGroup.values)

        let agreeing = experts.filter { canonical($0.text) == local }
        let disagreeing = experts.filter { canonical($0.text) != local && !canonical($0.text).isEmpty }
        let agreeingGroups = agreeing.map(\.independenceGroup).sorted()
        let disagreeingGroups = disagreeing.map(\.independenceGroup).sorted()

        var reasons: [String] = []
        let localCount = semanticTokens(reading.text).count
        let explicitCountMismatch = experts.contains { expert in
            guard let count = expert.symbolCount else { return false }
            return count != localCount
        }
        if explicitCountMismatch { reasons.append("independent-symbol-count-mismatch") }

        let hardConfusion = disagreeing.contains {
            differsOnlyByHardConfusion(local, canonical($0.text))
        }
        if hardConfusion { reasons.append("hard-visual-confusion-disagreement") }

        let trusted = experts.filter {
            $0.calibratedForProduction && $0.confidence >= trustedExpertFloor
        }
        let trustedAgreeing = trusted.filter { canonical($0.text) == local }
        let trustedAlternatives = Dictionary(grouping: trusted.filter { canonical($0.text) != local }) {
            canonical($0.text)
        }
        let strongAlternative = trustedAlternatives
            .filter { !$0.key.isEmpty && Set($0.value.map(\.independenceGroup)).count >= independentExpertsForRescue }
            .max { lhs, rhs in lhs.value.count < rhs.value.count }

        // Local clarification is an explicit safety decision. More inference
        // may suggest what to show in the picker, but it never turns ambiguous
        // ink into an automatic mark behind the student's back.
        if localDecision.status == .clarify {
            reasons.append("local-clarification-is-sticky")
            return InkExpertFusionResult(text: reading.text, status: .clarify, autoAccept: false,
                                         reasons: unique(reasons), agreeingGroups: agreeingGroups,
                                         disagreeingGroups: disagreeingGroups)
        }

        // Two calibrated, genuinely independent experts agreeing on a DIFFERENT
        // expression is strong evidence that the local result deserves another
        // look, but not authority to overwrite the student's ink.
        if let alternative = strongAlternative {
            reasons.append("multiple-calibrated-experts-disagree-with-local")
            if !alternative.key.isEmpty { reasons.append("alternative-requires-student-confirmation") }
            return InkExpertFusionResult(text: reading.text, status: .clarify, autoAccept: false,
                                         reasons: unique(reasons), agreeingGroups: agreeingGroups,
                                         disagreeingGroups: disagreeingGroups)
        }

        // A known lookalike conflict or independent count conflict is exactly
        // where majority/context guessing is dangerous. Route it to one-tap
        // clarification even if the local model had initially been confident.
        if hardConfusion || explicitCountMismatch {
            return InkExpertFusionResult(text: reading.text, status: .clarify, autoAccept: false,
                                         reasons: unique(reasons), agreeingGroups: agreeingGroups,
                                         disagreeingGroups: disagreeingGroups)
        }

        if localDecision.autoAccept {
            // External evidence is advisory for a clean local reading. A single
            // dissent is not enough to demote it; two trusted independent
            // dissenters were already caught by `strongAlternative` above.
            return InkExpertFusionResult(text: reading.text, status: .accept, autoAccept: true,
                                         reasons: [], agreeingGroups: agreeingGroups,
                                         disagreeingGroups: disagreeingGroups)
        }

        let structuralClean = structure.riskFlags.isEmpty
            && structure.traceCoverage >= rescueTraceCoverageFloor
            && structure.evidenceScore >= rescueStructureFloor
        let localPlausible = reading.minConfidence >= rescueLocalConfidenceFloor
            && reading.margin >= rescueLocalMarginFloor
        let independentTrustedAgreement = Set(trustedAgreeing.map(\.independenceGroup)).count

        // Consensus rescue is intentionally narrow. It upgrades only a
        // BORDERLINE local REVIEW to ACCEPT when two calibrated independent
        // experts corroborate the SAME reading and provenance/structure are
        // already clean. It never changes the text itself.
        if localDecision.status == .review,
           structuralClean,
           localPlausible,
           independentTrustedAgreement >= independentExpertsForRescue {
            reasons.append("independent-calibrated-consensus-rescue")
            return InkExpertFusionResult(text: reading.text, status: .accept, autoAccept: true,
                                         reasons: reasons, agreeingGroups: agreeingGroups,
                                         disagreeingGroups: disagreeingGroups)
        }

        if !structuralClean { reasons.append("structure-blocks-consensus-rescue") }
        if !localPlausible { reasons.append("local-evidence-too-weak-for-rescue") }
        if independentTrustedAgreement < independentExpertsForRescue {
            reasons.append("insufficient-independent-calibrated-agreement")
        }
        return InkExpertFusionResult(text: reading.text, status: .review, autoAccept: false,
                                     reasons: unique(reasons), agreeingGroups: agreeingGroups,
                                     disagreeingGroups: disagreeingGroups)
    }

    private static func canonical(_ raw: String) -> String {
        raw
            .replacingOccurrences(of: "\\(", with: "")
            .replacingOccurrences(of: "\\)", with: "")
            .replacingOccurrences(of: "\\[", with: "")
            .replacingOccurrences(of: "\\]", with: "")
            .replacingOccurrences(of: "×", with: "*")
            .replacingOccurrences(of: "✕", with: "*")
            .replacingOccurrences(of: "π", with: "pi")
            .replacingOccurrences(of: "θ", with: "theta")
            .filter { !$0.isWhitespace }
    }

    private static func differsOnlyByHardConfusion(_ lhs: String, _ rhs: String) -> Bool {
        let a = semanticTokens(lhs)
        let b = semanticTokens(rhs)
        guard a.count == b.count else { return false }
        var difference: (String, String)?
        for (x, y) in zip(a, b) where x != y {
            if difference != nil { return false }
            difference = (x, y)
        }
        guard let difference else { return false }
        return confusionFamilies.contains { family in
            family.contains(difference.0) && family.contains(difference.1)
        }
    }

    /// Lightweight semantic tokenization used only for consistency checks. It
    /// keeps common multi-character math names atomic and otherwise preserves
    /// each visible symbol. This is NOT the expression parser.
    private static func semanticTokens(_ raw: String) -> [String] {
        let text = canonical(raw)
        let names = ["theta", "sqrt", "sin", "cos", "tan", "sec", "csc", "cot", "log", "ln", "pi"]
        var out: [String] = []
        var i = text.startIndex
        while i < text.endIndex {
            let tail = text[i...]
            if let name = names.first(where: { tail.hasPrefix($0) }) {
                out.append(name)
                i = text.index(i, offsetBy: name.count)
            } else {
                out.append(String(text[i]))
                i = text.index(after: i)
            }
        }
        return out
    }

    private static func unique(_ values: [String]) -> [String] {
        var seen = Set<String>()
        return values.filter { seen.insert($0).inserted }
    }
}

extension OnlineInkHypothesis {
    /// External providers start uncalibrated. Promotion is enabled only after
    /// a provider/version has passed the locked writer-separated calibration
    /// protocol; until then its agreement is useful for diagnostics and its
    /// disagreement can still trigger a safer clarification.
    func fusionEvidence(
        independenceGroup: String? = nil,
        calibratedForProduction: Bool = false,
        symbolCount: Int? = nil
    ) -> InkExpertHypothesis {
        InkExpertHypothesis(
            text: text.isEmpty ? (latex ?? "") : text,
            confidence: confidence,
            sourceID: source,
            independenceGroup: independenceGroup ?? source,
            calibratedForProduction: calibratedForProduction,
            symbolCount: symbolCount
        )
    }
}
