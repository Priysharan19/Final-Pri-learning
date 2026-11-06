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
    private static let sampleStep: CGFloat = 1.5

    /// Convert one PencilKit stroke. Keeping this operation separate lets the
    /// live bridge encode only the newly completed mark on a normal pen-up.
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

    /// The largest gap left between two control points handed to PencilKit.
    ///
    /// `PKStrokePath(controlPoints:)` is a uniform cubic B-spline: the curve it
    /// draws does not pass through its control points, it cuts every corner
    /// by an amount that grows with the spacing between them. A stroke the
    /// bridge receives from the page (a restored draft, ink written on the web
    /// canvas) can have points several pixels apart, and the corners of a 2,
    /// an 8 or an n then moved by up to 4 px on the way into the surface — the
    /// Gate A self-check measured 4.11 px against its 2.0 px floor. Filling the
    /// polygon in to this spacing first keeps the spline within a fraction of
    /// a pixel of every point the student wrote. Strokes that came from
    /// PencilKit are already `sampleStep` apart and are left as they are.
    static let maxControlSpacing: CGFloat = 1.0

    /// Linear fill between consecutive points; every field (time, width,
    /// force, azimuth, altitude) is interpolated with the position, so the
    /// stroke's duration and the range of its Pencil signal are unchanged.
    static func densified(_ points: [InkPoint]) -> [InkPoint] {
        guard points.count > 1 else { return points }
        var out: [InkPoint] = [points[0]]
        out.reserveCapacity(points.count)
        for i in 1..<points.count {
            let a = points[i - 1], b = points[i]
            let gap = hypot(b.x - a.x, b.y - a.y)
            let pieces = Int((gap / maxControlSpacing).rounded(.up))
            if pieces > 1 {
                for k in 1..<pieces {
                    let u = CGFloat(k) / CGFloat(pieces)
                    func mix(_ p: CGFloat, _ q: CGFloat) -> CGFloat { p + (q - p) * u }
                    out.append(InkPoint(
                        x: mix(a.x, b.x), y: mix(a.y, b.y), w: mix(a.w, b.w),
                        t: a.t + (b.t - a.t) * Double(u),
                        force: mix(a.force, b.force),
                        azimuth: mix(a.azimuth, b.azimuth),
                        altitude: mix(a.altitude, b.altitude)
                    ))
                }
            }
            out.append(b)
        }
        return out
    }

    static func strokes(from drawing: PKDrawing) -> [InkStroke] {
        drawing.strokes.map { StrokeCodec.stroke(from: $0) }
    }

    static func drawing(from strokes: [InkStroke], color: UIColor) -> PKDrawing {
        restore(strokes, color: color).drawing
    }

    // MARK: Restore identity
    //
    // A restored draft is written into PencilKit (above) and, until the
    // student touches it, is the same ink they wrote. Reading it back through
    // the spline would hand the page a slightly smoothed copy, and the page
    // saves that copy as the draft: every relaunch or remount then restored the
    // copy of a copy, and a "6" or an "8" crept by more each time (measured
    // 4.1 px after one cycle and 5.7 px after five before the densified
    // polygon; still 2.2 px after five with it). So a restore remembers what it
    // wrote, keyed by a creation date no live stroke can have, and reading the
    // canvas returns the student's own points for every restored stroke that
    // is still exactly as it was written. Anything else — a new stroke, a
    // stroke cut by the pixel eraser, a moved stroke — is read from PencilKit.

    struct Restored {
        fileprivate struct Entry { let stroke: InkStroke; let count: Int; let first: CGPoint; let last: CGPoint }
        fileprivate var entries: [Date: Entry] = [:]
        var count: Int { entries.count }
    }

    /// Dates far before any real stroke (2001 minus ~31 years), one per
    /// restored stroke, so a restored path is recognisable when read back.
    private static func restoreDate(_ index: Int) -> Date {
        Date(timeIntervalSinceReferenceDate: -1_000_000_000 + Double(index))
    }

    static func restore(_ strokes: [InkStroke], color: UIColor) -> (drawing: PKDrawing, restored: Restored) {
        let ink = PKInk(.pen, color: color)
        var restored = Restored()
        var built: [PKStroke] = []
        for stroke in strokes where !stroke.points.isEmpty {
            let controlPoints: [PKStrokePoint] = densified(stroke.points).enumerated().map { index, p in
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
            let safePoints = controlPoints.count >= 2 ? controlPoints : controlPoints + controlPoints
            let date = restoreDate(built.count)
            let path = PKStrokePath(controlPoints: safePoints, creationDate: date)
            built.append(PKStroke(ink: ink, path: path))
            restored.entries[date] = .init(stroke: stroke, count: path.count,
                                           first: safePoints.first!.location, last: safePoints.last!.location)
        }
        return (PKDrawing(strokes: built), restored)
    }

    /// Read the canvas as the bridge does, returning the original points for
    /// every restored stroke that has not been changed since it was restored.
    static func strokes(from drawing: PKDrawing, restored: Restored) -> [InkStroke] {
        drawing.strokes.map { pk in
            if let entry = restored.entries[pk.path.creationDate],
               pk.transform == .identity,
               pk.mask == nil,                      // the pixel eraser masks a path without changing it
               pk.maskedPathRanges.count == 1,
               pk.path.count == entry.count,
               let first = pk.path.first?.location, let last = pk.path.last?.location,
               first == entry.first, last == entry.last {
                return entry.stroke
            }
            return StrokeCodec.stroke(from: pk)
        }
    }
}

// MARK: - JSON

extension InkStroke {
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