// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Reading → page
//
// The native reading keeps the legacy web-engine fields stable, then adds
// trace-provenance structure, a mathematical expression tree, independent
// geometry count evidence and a selective trust/refinement decision. Existing
// consumers continue to read the same text/symbol keys.
// ─────────────────────────────────────────────────────────────────────────────
import CoreGraphics
import Foundation

private func alternativesJSON(_ alternatives: [(symbol: String, confidence: Double)]) -> [[String: Any]] {
    alternatives.map { ["sym": $0.symbol, "conf": $0.confidence] }
}

private func symbolBoxJSON(_ box: CGRect) -> [String: Any] {
    [
        "x1": Double(box.minX), "y1": Double(box.minY),
        "x2": Double(box.maxX), "y2": Double(box.maxY),
        "w": Double(box.width), "h": Double(box.height),
        "cx": Double(box.midX), "cy": Double(box.midY)
    ]
}

extension ReadingSymbol {
    var jsonObject: [String: Any] {
        [
            "id": id,
            "sym": symbol,
            "conf": confidence,
            "alts": alternativesJSON(alternatives),
            "strokeIdxs": strokeIndexes,
            "approx": approximate,
            "box": symbolBoxJSON(box)
        ]
    }
}

extension ReadingLine {
    var jsonObject: [String: Any] {
        [
            "text": text,
            "box": ["x": Double(box.minX), "y": Double(box.minY),
                    "w": Double(box.width), "h": Double(box.height)],
            "symbols": symbols.map(\.jsonObject),
            "strokeIdxs": strokeIndexes,
            "unread": unread
        ]
    }
}

extension Reading {
    /// Compatibility payload for callers that do not have the source stroke
    /// snapshot. It still contains the structural tree and selective decision,
    /// but cannot claim geometry-only count evidence or refinement regions.
    var jsonObject: [String: Any] {
        buildJSON(strokes: nil)
    }

    /// Full production payload. Passing the immutable recognition snapshot lets
    /// independent geometry count and local-refinement planning use the exact
    /// traces that generated this reading.
    func jsonObject(strokes: [InkStroke]) -> [String: Any] {
        buildJSON(strokes: strokes)
    }

    private func buildJSON(strokes: [InkStroke]?) -> [String: Any] {
        let structure = InkStructureGraphBuilder.build(from: self)
        let tree = InkExpressionTreeBuilder.build(reading: self, structure: structure)
        let countEvidence = strokes.map { InkSymbolCountEstimator.evaluate(reading: self, strokes: $0) }
        let decision = InkAcceptancePolicy.evaluate(
            reading: self, structure: structure, countEvidence: countEvidence, tree: tree
        )

        var payload: [String: Any] = [
            "lines": lines.map(\.jsonObject),
            "text": text,
            "minConf": minConfidence,
            "margin": margin,
            "structure": structure.jsonObject,
            "tree": tree.jsonObject,
            "decision": decision.jsonObject,
            // Redundant top-level boolean keeps the safety property easy for
            // legacy web code to consume without understanding policy details.
            "safeToAutoAccept": decision.autoAccept
        ]

        if let strokes, let countEvidence {
            let refinement = InkRefinementPlanner.plan(
                reading: self, structure: structure, countEvidence: countEvidence, strokes: strokes
            )
            payload["symbolCountEvidence"] = countEvidence.jsonObject
            payload["refinement"] = refinement.jsonObject
        } else {
            payload["symbolCountEvidence"] = NSNull()
            payload["refinement"] = NSNull()
        }

        if let weakest {
            payload["weakest"] = [
                "id": weakest.id,
                "index": weakest.index,
                "sym": weakest.symbol,
                "conf": weakest.confidence,
                "alts": alternativesJSON(weakest.alternatives)
            ]
        } else {
            payload["weakest"] = NSNull()
        }
        return payload
    }
}
