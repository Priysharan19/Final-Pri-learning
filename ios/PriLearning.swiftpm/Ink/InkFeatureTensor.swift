// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Online-ink feature tensor
//
// This is the stable input contract for a future stroke-native Core ML model.
// A bitmap erases the temporal signal; raw absolute coordinates overfit device
// size and writing position. The tensor therefore combines normalized geometry
// with the actual Pencil dynamics we preserve when available.
//
// Every optional sensor channel has a mask. Missing timing/pressure/orientation
// is represented as "unknown", never as a fabricated zero-valued observation.
// ─────────────────────────────────────────────────────────────────────────────
import CoreGraphics
import Foundation

struct InkFeatureTensor {
    static let featureNames = [
        "x", "y", "dx", "dy", "dt120", "speed",
        "turnSin", "turnCos",
        "force", "forceMask",
        "azimuthSin", "azimuthCos", "altitude", "orientationMask",
        "width", "strokeStart", "strokeEnd", "strokeIndex", "pointProgress", "timeMask"
    ]

    let rows: [[Float]]
    /// Row ranges belonging to each non-empty source stroke, in source order.
    let strokeRanges: [Range<Int>]

    var featureCount: Int { Self.featureNames.count }
    var pointCount: Int { rows.count }

    static func build(strokes: [InkStroke]) -> InkFeatureTensor {
        let live = strokes.enumerated().filter { !$0.element.isEmpty }
        guard !live.isEmpty else { return InkFeatureTensor(rows: [], strokeRanges: []) }

        let allPoints = live.flatMap { $0.element.points }
        guard let first = allPoints.first else { return InkFeatureTensor(rows: [], strokeRanges: []) }
        var minX = first.x, maxX = first.x, minY = first.y, maxY = first.y
        for point in allPoints.dropFirst() {
            minX = min(minX, point.x); maxX = max(maxX, point.x)
            minY = min(minY, point.y); maxY = max(maxY, point.y)
        }
        let width = max(maxX - minX, 0.5)
        let height = max(maxY - minY, 0.5)
        let diagonal = max(hypot(width, height), 1)
        let midX = (minX + maxX) / 2
        let midY = (minY + maxY) / 2
        let strokeDenominator = max(live.count - 1, 1)

        var rows: [[Float]] = []
        var ranges: [Range<Int>] = []
        rows.reserveCapacity(allPoints.count)

        for (livePosition, pair) in live.enumerated() {
            let stroke = pair.element
            let start = rows.count
            let pointDenominator = max(stroke.points.count - 1, 1)
            var previousVector: CGPoint?

            for (pointIndex, point) in stroke.points.enumerated() {
                let previous = pointIndex > 0 ? stroke.points[pointIndex - 1] : point
                let dx = (point.x - previous.x) / diagonal
                let dy = (point.y - previous.y) / diagonal
                let distance = hypot(dx, dy)

                let hasTime = point.t != nil && previous.t != nil && pointIndex > 0
                let rawDT = hasTime ? max(0, (point.t ?? 0) - (previous.t ?? 0)) : 0
                // A 120 Hz sample interval maps to ~0.25, leaving headroom for
                // slower movement/OS delivery without allowing pauses to dwarf
                // every other feature.
                let dt120 = hasTime ? clamp(CGFloat(rawDT * 30.0)) : 0
                let speed = hasTime && rawDT > 0.000_2
                    ? clamp((distance / CGFloat(rawDT)) / 8.0)
                    : 0

                let vector = CGPoint(x: dx, y: dy)
                var turnSin: CGFloat = 0
                var turnCos: CGFloat = 1
                if let prior = previousVector,
                   hypot(prior.x, prior.y) > 0.000_01,
                   hypot(vector.x, vector.y) > 0.000_01 {
                    let a = atan2(prior.y, prior.x)
                    let b = atan2(vector.y, vector.x)
                    let delta = b - a
                    turnSin = sin(delta)
                    turnCos = cos(delta)
                }
                if distance > 0.000_01 { previousVector = vector }

                let forceMask: CGFloat = point.force == nil ? 0 : 1
                let force = clamp(point.force ?? 0)
                let orientationMask: CGFloat = (point.azimuth != nil && point.altitude != nil) ? 1 : 0
                let azimuth = point.azimuth ?? 0
                let altitude = point.altitude.map { clamp($0 / (.pi / 2)) } ?? 0
                let widthNorm = clamp((point.w / diagonal) * 20)

                rows.append([
                    f((point.x - midX) / diagonal),
                    f((point.y - midY) / diagonal),
                    f(dx), f(dy), f(dt120), f(speed),
                    f(turnSin), f(turnCos),
                    f(force), f(forceMask),
                    f(sin(azimuth)), f(cos(azimuth)), f(altitude), f(orientationMask),
                    f(widthNorm),
                    pointIndex == 0 ? 1 : 0,
                    pointIndex == stroke.points.count - 1 ? 1 : 0,
                    f(CGFloat(livePosition) / CGFloat(strokeDenominator)),
                    f(CGFloat(pointIndex) / CGFloat(pointDenominator)),
                    hasTime ? 1 : 0
                ])
            }
            ranges.append(start..<rows.count)
        }
        return InkFeatureTensor(rows: rows, strokeRanges: ranges)
    }

    private static func clamp(_ value: CGFloat) -> CGFloat { min(1, max(0, value)) }
    private static func f(_ value: CGFloat) -> Float {
        let number = Float(value)
        return number.isFinite ? number : 0
    }
}
