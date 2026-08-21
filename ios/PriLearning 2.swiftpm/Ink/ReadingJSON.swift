// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Reading → page
//
// The native reading is handed over in EXACTLY the shape the web engine has
// always returned: same keys, same box conventions, same per-symbol
// alternatives. Everything downstream — the reading panel, tap-to-correct,
// "check this reading first", the ✓/✗ overlay, Step Check, the marker — is
// untouched by where the reading came from.
// ─────────────────────────────────────────────────────────────────────────────
import CoreGraphics
import Foundation

private func alternativesJSON(_ alternatives: [(symbol: String, confidence: Double)]) -> [[String: Any]] {
    alternatives.map { ["sym": $0.symbol, "conf": $0.confidence] }
}

/// Symbol boxes are the bbox form the web engine emits; line boxes are the
/// {x, y, w, h} form the ✓/✗ overlay positions itself with.
/// Every number is a Double: CGFloat is not a JSON type, and JSONSerialization
/// answers an object graph containing one with nil rather than an error.
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
        var payload: [String: Any] = [
            "lines": lines.map(\.jsonObject),
            "text": text,
            "minConf": minConfidence,
            "margin": margin
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
