// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Ink stroke model
//
// One representation of a stroke shared by everything native: the PencilKit
// canvas, the rasteriser that feeds Vision, the line segmenter, and the JSON
// the web layer receives so its own engine, drafts and replay keep working.
//
// Coordinates are the ink surface's own CSS-pixel space — (0, 0) at the top
// left of the writing area — which is exactly the space the web canvas used,
// so every downstream consumer of a stroke list is unchanged.
// ─────────────────────────────────────────────────────────────────────────────
import CoreGraphics
import Foundation
import PencilKit

/// A single sampled point along a stroke.
///
/// `x`, `y` and `w` remain the backwards-compatible drawing contract. The
/// optional values preserve the ONLINE ink signal PencilKit already captured:
/// time, pressure and Pencil orientation. Older saved attempts simply leave
/// them nil. Keeping these features matters because a handwriting engine can
/// distinguish shapes that raster OCR sees as identical by how the mark was
/// produced, not only by its final pixels.
struct InkPoint {
    var x: CGFloat
    var y: CGFloat
    var w: CGFloat
    var t: TimeInterval? = nil
    var force: CGFloat? = nil
    var azimuth: CGFloat? = nil
    var altitude: CGFloat? = nil
}

struct InkStroke {
    var points: [InkPoint]

    var isEmpty: Bool { points.count < 1 }

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

    /// Mean ink width, used to scale the pen when re-drawing for recognition.
    var meanWidth: CGFloat {
        guard !points.isEmpty else { return 0 }
        return points.reduce(0) { $0 + $1.w } / CGFloat(points.count)
    }

    /// Duration and pressure are deliberately optional. Synthetic benchmark
    /// strokes and old drafts have no timing signal; real Pencil strokes do.
    var duration: TimeInterval? {
        guard let first = points.compactMap(\.t).first,
              let last = points.compactMap(\.t).last,
              last >= first else { return nil }
        return last - first
    }

    var meanForce: CGFloat? {
        let values = points.compactMap(\.force)
        guard !values.isEmpty else { return nil }
        return values.reduce(0, +) / CGFloat(values.count)
    }
}

// MARK: - PencilKit bridge

enum StrokeCodec {

    /// Sampling step along a PencilKit path, in points. PencilKit stores a
    /// spline rather than the raw samples, so the step — not the input rate —
    /// decides how much shape survives. 1.5pt keeps the corners a recogniser
    /// needs (the join of a '4', the cusp of a 'v') without producing lists so
    /// long that JSON encoding shows up while the pen is still moving.
    private static let sampleStep: CGFloat = 1.5

    /// Convert one final PencilKit stroke. The drawing surface uses this on the
    /// ordinary pen path so finishing one stroke never has to re-sample every
    /// stroke already on the page.
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
        // A tap leaves a path with a single control point and no interpolated
        // span — the dot of an 'i' is a real glyph, so it is kept rather than
        // dropped for being zero length.
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

    /// Rebuild a drawing from strokes the web layer supplies — restoring a
    /// saved draft, or replaying an attempt. Rich Pencil signal is restored
    /// when present and sensible defaults keep old x/y/w-only drafts valid.
    static func drawing(from strokes: [InkStroke], color: UIColor) -> PKDrawing {
        let ink = PKInk(.pen, color: color)
        let built: [PKStroke] = strokes.compactMap { stroke in
            guard !stroke.points.isEmpty else { return nil }
            var syntheticTime: TimeInterval = 0
            let controlPoints: [PKStrokePoint] = stroke.points.map { p in
                defer { syntheticTime += 1.0 / 120.0 }
                let width = max(1, p.w)
                return PKStrokePoint(
                    location: CGPoint(x: p.x, y: p.y),
                    timeOffset: p.t ?? syntheticTime,
                    size: CGSize(width: width, height: width),
                    opacity: 1,
                    force: p.force ?? 1,
                    azimuth: p.azimuth ?? 0,
                    altitude: p.altitude ?? .pi / 2
                )
            }
            // PKStrokePath needs at least two control points to describe a
            // span; a single-point tap is given a second coincident point so
            // it renders as the dot it was.
            let path = controlPoints.count >= 2
                ? PKStrokePath(controlPoints: controlPoints, creationDate: Date())
                : PKStrokePath(controlPoints: controlPoints + controlPoints, creationDate: Date())
            return PKStroke(ink: ink, path: path)
        }
        return PKDrawing(strokes: built)
    }
}

// MARK: - JSON

extension InkStroke {
    /// CGFloat is not a JSON type — JSONSerialization refuses an object graph
    /// containing one and hands back nil, which would mean the page silently
    /// never hearing about a single stroke. Every number crossing the bridge
    /// is a Double. Optional online-signal fields are additive, so older web
    /// code that only reads x/y/w remains compatible.
    var jsonObject: [String: Any] {
        ["points": points.map { p -> [String: Any] in
            var object: [String: Any] = [
                "x": Double(p.x), "y": Double(p.y), "w": Double(p.w)
            ]
            if let t = p.t { object["t"] = t }
            if let force = p.force { object["p"] = Double(force) }
            if let azimuth = p.azimuth { object["az"] = Double(azimuth) }
            if let altitude = p.altitude { object["alt"] = Double(altitude) }
            return object
        }]
    }

    init?(json: Any) {
        guard let dict = json as? [String: Any],
              let raw = dict["points"] as? [[String: Any]] else { return nil }
        let parsed: [InkPoint] = raw.compactMap { p in
            guard let x = InkStroke.number(p["x"]), let y = InkStroke.number(p["y"]) else { return nil }
            return InkPoint(
                x: x,
                y: y,
                w: InkStroke.number(p["w"]) ?? 3,
                t: InkStroke.time(p["t"]),
                force: InkStroke.number(p["p"]),
                azimuth: InkStroke.number(p["az"]),
                altitude: InkStroke.number(p["alt"])
            )
        }
        guard !parsed.isEmpty else { return nil }
        self.points = parsed
    }

    /// A JavaScript number arrives as NSNumber; the same value built natively
    /// arrives as CGFloat or Double. All three are read the same way.
    private static func number(_ value: Any?) -> CGFloat? {
        if let n = value as? NSNumber { return CGFloat(n.doubleValue) }
        if let d = value as? Double { return CGFloat(d) }
        if let f = value as? CGFloat { return f }
        return nil
    }

    private static func time(_ value: Any?) -> TimeInterval? {
        if let n = value as? NSNumber { return n.doubleValue }
        if let d = value as? Double { return d }
        return nil
    }
}
