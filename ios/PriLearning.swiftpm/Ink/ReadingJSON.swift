// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Reading → page
//
// The native reading keeps the legacy web-engine fields stable, then adds a
// trace-provenance structure graph and a selective trust decision. Existing
// consumers continue to read the same text/symbol keys; newer consumers can
// refuse to mark an uncertain reading instead of treating every OCR string as
// authoritative.
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
    var jsonObject: [String: Any] {
        let structure = InkStructureGraphBuilder.build(from: self)
        let decision = InkAcceptancePolicy.evaluate(reading: self, structure: structure)
        var payload: [String: Any] = [
            "lines": lines.map(\.jsonObject),
            "text": text,
            "minConf": minConfidence,
            "margin": margin,
            "structure": structure.jsonObject,
            "decision": decision.jsonObject,
            // Redundant top-level boolean keeps the safety property easy for
            // legacy web code to consume without understanding policy details.
            "safeToAutoAccept": decision.autoAccept
        ]
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
