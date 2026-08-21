// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Online Pencil sequence encoder
//
// Converts PencilKit-derived InkStroke data into a stable, model-ready sequence
// without rasterising it. The feature contract is explicit so a future Core ML
// stroke Transformer can be trained against the same representation the app
// emits in production.
// ─────────────────────────────────────────────────────────────────────────────
import CoreGraphics
import Foundation

struct InkSequenceFrame {
    let x: Double
    let y: Double
    let dx: Double
    let dy: Double
    let dt: Double
    let speed: Double
    let directionCos: Double
    let directionSin: Double
    let curvature: Double
    let width: Double
    let force: Double
    let azimuthSin: Double
    let azimuthCos: Double
    let altitude: Double
    let strokeStart: Double
    let strokeEnd: Double

    var vector: [Double] {
        [x, y, dx, dy, dt, speed, directionCos, directionSin, curvature,
         width, force, azimuthSin, azimuthCos, altitude, strokeStart, strokeEnd]
    }
}

struct InkSequenceEncoding {
    let frames: [InkSequenceFrame]
    let originalPointCount: Int
    let truncated: Bool
    /// Fraction of sampled points carrying real timing + Pencil dynamics rather
    /// than compatibility defaults. This measures evidence quality, not accuracy.
    let dynamicsCoverage: Double
}

enum InkSequenceEncoder {
    static let featureCount = 16

    static func encode(strokes: [InkStroke], maxFrames: Int = 1024) -> InkSequenceEncoding {
        let live = strokes.filter { !$0.isEmpty }
        let totalPoints = live.reduce(0) { $0 + $1.points.count }
        guard !live.isEmpty, totalPoints > 0 else {
            return InkSequenceEncoding(frames: [], originalPointCount: 0,
                                       truncated: false, dynamicsCoverage: 0)
        }

        let page = live.dropFirst().reduce(live[0].bounds) { $0.union($1.bounds) }
        let scale = max(page.width, page.height, 1)
        var frames: [InkSequenceFrame] = []
        frames.reserveCapacity(totalPoints)
        var dynamics = 0

        for stroke in live {
            var previous: InkPoint?
            var previousDirection: Double?
            for (index, point) in stroke.points.enumerated() {
                let nx = Double((point.x - page.minX) / scale)
                let ny = Double((point.y - page.minY) / scale)
                let ddx = previous.map { Double((point.x - $0.x) / scale) } ?? 0
                let ddy = previous.map { Double((point.y - $0.y) / scale) } ?? 0
                let distance = hypot(ddx, ddy)

                var dt = 0.0
                if let t = point.t, let pt = previous?.t, t >= pt {
                    dt = min(0.25, max(0, t - pt))
                }
                let speed = dt > 0.000_001 ? min(8, distance / dt) : 0
                let direction = distance > 0.000_001 ? atan2(ddy, ddx) : (previousDirection ?? 0)
                let curvature: Double
                if let prior = previousDirection {
                    var delta = direction - prior
                    while delta > Double.pi { delta -= 2 * Double.pi }
                    while delta < -Double.pi { delta += 2 * Double.pi }
                    curvature = delta / Double.pi
                } else {
                    curvature = 0
                }

                let azimuth = Double(point.azimuth ?? 0)
                let altitude = Double(point.altitude ?? CGFloat.pi / 2) / (Double.pi / 2)
                if point.t != nil && point.force != nil && point.azimuth != nil && point.altitude != nil {
                    dynamics += 1
                }

                frames.append(InkSequenceFrame(
                    x: nx,
                    y: ny,
                    dx: ddx,
                    dy: ddy,
                    dt: dt,
                    speed: speed,
                    directionCos: cos(direction),
                    directionSin: sin(direction),
                    curvature: curvature,
                    width: Double(point.w / scale),
                    force: Double(point.force ?? 0),
                    azimuthSin: sin(azimuth),
                    azimuthCos: cos(azimuth),
                    altitude: altitude,
                    strokeStart: index == 0 ? 1 : 0,
                    strokeEnd: index == stroke.points.count - 1 ? 1 : 0
                ))
                previous = point
                previousDirection = direction
            }
        }

        let coverage = Double(dynamics) / Double(totalPoints)
        guard frames.count > maxFrames, maxFrames >= 2 else {
            return InkSequenceEncoding(frames: frames, originalPointCount: totalPoints,
                                       truncated: false, dynamicsCoverage: coverage)
        }

        // Endpoint-preserving deterministic reduction keeps tensor sizes bounded.
        // The training pipeline must apply this same policy. Stroke-start/end
        // features allow the model to observe whichever boundaries are retained.
        var reduced: [InkSequenceFrame] = []
        reduced.reserveCapacity(maxFrames)
        for i in 0..<maxFrames {
            let fraction = Double(i) / Double(maxFrames - 1)
            let source = Int((fraction * Double(frames.count - 1)).rounded())
            reduced.append(frames[source])
        }
        return InkSequenceEncoding(frames: reduced, originalPointCount: totalPoints,
                                   truncated: true, dynamicsCoverage: coverage)
    }
}
