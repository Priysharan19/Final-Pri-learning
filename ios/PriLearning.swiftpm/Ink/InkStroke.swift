// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Ink stroke model
//
// One representation of a stroke shared by everything native: the PencilKit
// canvas, native/local recognisers, the line segmenter, and the JSON the web
// layer receives. V2 deliberately preserves the signal a learned stroke model
// needs instead of reducing Pencil input to x/y alone.
//
// Coordinates are the ink surface's CSS-pixel space — (0, 0) at the top left
// of the writing area — exactly the space the web canvas uses.
// ─────────────────────────────────────────────────────────────────────────────
import CoreGraphics
import Foundation
import PencilKit

/// A sampled point along a stroke.
///
/// `t` is seconds from the start of this stroke; `force`, `azimuth` and
/// `altitude` come directly from PencilKit. Old saved strokes that only contain
/// x/y/w remain valid because every V2 field has a safe default.
struct InkPoint {
    var x: CGFloat
    var y: CGFloat
    var w: CGFloat
    var t: TimeInterval
    var force: CGFloat
    var azimuth: CGFloat
    var altitude: CGFloat

    init(
        x: CGFloat,
        y: CGFloat,
        w: CGFloat = 3,
        t: TimeInterval = 0,
        force: CGFloat = 0,
        azimuth: CGFloat = 0,
        altitude: CGFloat = .pi / 2
    ) {
        self.x = x
        self.y = y
        self.w = w
        self.t = t
        self.force = force
        self.azimuth = azimuth
        self.altitude = altitude
    }
}

struct InkStroke {
    var points: [InkPoint]

    var isEmpty: Bool { points.isEmpty }

    /// Tight bounds of the stroke's centreline. Zero-area strokes (a dot, a
    /// perfectly horizontal minus sign) are given a hairline extent so callers
    /// can divide by width or height without special-casing them.
    var bounds: CGRect {
        guard let first = points.first else { return .zero }
        var minX = first.x, maxX = first.x, minY = first.y, maxY = first.y
        for p in points {
            minX = min(minX, p.x); maxX = max(maxX, p.x)
            minY = min(minY, p.y); maxY = max(maxY, p.y)
        }
        return CGRect(x: minX, y: minY,
                      width: max(maxX - minX, 0.001),
                      height: max(maxY - minY, 0.001))
    }

    var pathLength: CGFloat {
        guard points.count > 1 else { return 0 }
        var total: CGFloat = 0
        for i in 1..<points.count {
            total += hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y)
        }
        return total
    }

    var meanWidth: CGFloat {
        guard !points.isEmpty else { return 0 }
        return points.reduce(0) { $0 + $1.w } / CGFloat(points.count)
    }

    var duration: TimeInterval { points.last?.t ?? 0 }
}

// MARK: - PencilKit bridge

enum StrokeCodec {

    /// 1.5 pt preserves corners without exploding the JSON payload. PencilKit
    /// interpolation also gives us force/orientation/time at every sampled point.
    private static let sampleStep: CGFloat = 1.5

    /// Convert one PencilKit stroke. Keeping this operation separate is important
    /// for the live bridge: a normal pen-up can encode just the newly completed
    /// stroke instead of resampling the student's entire page on every mark.
    static func stroke(from stroke: PKStroke) -> InkStroke {
        var points: [InkPoint] = []
        let transform = stroke.transform
        for point in stroke.path.interpolatedPoints(by: .distance(sampleStep)) {
            let location = point.location.applying(transform)
            points.append(InkPoint(
                x: location.x,
                y: location.y,
                w: point.size.width,
                t: point.timeOffset,
                force: point.force,
                azimuth: point.azimuth,
                altitude: point.altitude
            ))
        }
        // A tap has no interpolated span, but its pressure/orientation are still
        // useful and the dot must survive as a real mark.
        if points.isEmpty, let only = stroke.path.first {
            let location = only.location.applying(transform)
            points.append(InkPoint(
                x: location.x,
                y: location.y,
                w: only.size.width,
                t: only.timeOffset,
                force: only.force,
                azimuth: only.azimuth,
                altitude: only.altitude
            ))
        }
        return InkStroke(points: points)
    }

    static func strokes(from drawing: PKDrawing) -> [InkStroke] {
        drawing.strokes.map(stroke(from:))
    }

    /// Rebuild a drawing from strokes supplied by the web layer. V2 metadata is
    /// retained when present; legacy strokes fall back to neutral Pencil values.
    static func drawing(from strokes: [InkStroke], color: UIColor) -> PKDrawing {
        let ink = PKInk(.pen, color: color)
        let built: [PKStroke] = strokes.compactMap { stroke in
            guard !stroke.points.isEmpty else { return nil }
            let controlPoints: [PKStrokePoint] = stroke.points.enumerated().map { index, p in
                let fallbackTime = Double(index) / 120.0
                let time = p.t > 0 || index == 0 ? p.t : fallbackTime
                let width = max(1, p.w)
                return PKStrokePoint(
                    location: CGPoint(x: p.x, y: p.y),
                    timeOffset: time,
                    size: CGSize(width: width, height: width),
                    opacity: 1,
                    force: max(0, p.force),
                    azimuth: p.azimuth,
                    altitude: p.altitude > 0 ? p.altitude : .pi / 2
                )
            }
            let safePoints = controlPoints.count >= 2
                ? controlPoints
                : controlPoints + controlPoints
            let path = PKStrokePath(controlPoints: safePoints, creationDate: Date())
            return PKStroke(ink: ink, path: path)
        }
        return PKDrawing(strokes: built)
    }
}

// MARK: - JSON

extension InkStroke {
    /// Field names intentionally match the browser collector where possible:
    /// p=force, t=time, plus Pencil-specific azimuth/altitude. Existing web code
    /// ignores unknown fields, so this is backwards compatible immediately.
    var jsonObject: [String: Any] {
        ["points": points.map {
            [
                "x": Double($0.x),
                "y": Double($0.y),
                "w": Double($0.w),
                "t": $0.t,
                "p": Double($0.force),
                "azimuth": Double($0.azimuth),
                "altitude": Double($0.altitude)
            ] as [String: Any]
        }]
    }

    init?(json: Any) {
        guard let dict = json as? [String: Any],
              let raw = dict["points"] as? [[String: Any]] else { return nil }
        let parsed: [InkPoint] = raw.compactMap { p in
            guard let x = InkStroke.number(p["x"]),
                  let y = InkStroke.number(p["y"]) else { return nil }
            return InkPoint(
                x: x,
                y: y,
                w: InkStroke.number(p["w"]) ?? 3,
                t: InkStroke.double(p["t"]) ?? 0,
                force: InkStroke.number(p["p"]) ?? InkStroke.number(p["force"]) ?? 0,
                azimuth: InkStroke.number(p["azimuth"]) ?? 0,
                altitude: InkStroke.number(p["altitude"]) ?? .pi / 2
            )
        }
        guard !parsed.isEmpty else { return nil }
        self.points = parsed
    }

    private static func number(_ value: Any?) -> CGFloat? {
        if let n = value as? NSNumber { return CGFloat(n.doubleValue) }
        if let d = value as? Double { return CGFloat(d) }
        if let f = value as? CGFloat { return f }
        return nil
    }

    private static func double(_ value: Any?) -> Double? {
        if let n = value as? NSNumber { return n.doubleValue }
        if let d = value as? Double { return d }
        return nil
    }
}