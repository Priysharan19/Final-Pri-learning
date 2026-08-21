// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Online-ink tensor invariance checks
// ─────────────────────────────────────────────────────────────────────────────
import CoreGraphics
import Foundation

enum InkFeatureTensorSelfCheck {
    static func run() {
        var failures: [String] = []
        var checks = 0
        func check(_ name: String, _ condition: @autoclosure () -> Bool) {
            checks += 1
            if !condition() { failures.append(name) }
        }

        let rich = [
            InkStroke(points: [
                InkPoint(x: 10, y: 10, w: 3, t: 0, force: 0.3, azimuth: 0.2, altitude: 1.1),
                InkPoint(x: 20, y: 16, w: 3.2, t: 1.0 / 120.0, force: 0.5, azimuth: 0.25, altitude: 1.0),
                InkPoint(x: 30, y: 28, w: 3.4, t: 2.0 / 120.0, force: 0.7, azimuth: 0.3, altitude: 0.9)
            ]),
            InkStroke(points: [
                InkPoint(x: 36, y: 8, w: 2.8, t: 0, force: 0.4, azimuth: 0.4, altitude: 1.2),
                InkPoint(x: 42, y: 22, w: 3.0, t: 1.0 / 100.0, force: 0.6, azimuth: 0.45, altitude: 1.1)
            ])
        ]
        let tensor = InkFeatureTensor.build(strokes: rich)
        check("tensor has stable 20-channel contract", tensor.featureCount == 20 && tensor.rows.allSatisfy { $0.count == 20 })
        check("all tensor values are finite", tensor.rows.flatMap { $0 }.allSatisfy(\.isFinite))
        check("source stroke boundaries survive", tensor.strokeRanges.count == 2
              && tensor.strokeRanges[0].count == 3 && tensor.strokeRanges[1].count == 2)
        check("start/end flags preserve segmentation",
              tensor.rows[0][15] == 1 && tensor.rows[2][16] == 1
                && tensor.rows[3][15] == 1 && tensor.rows[4][16] == 1)
        check("real Pencil telemetry sets masks",
              tensor.rows[1][9] == 1 && tensor.rows[1][13] == 1 && tensor.rows[1][19] == 1)
        check("stroke order is represented independently of geometry",
              tensor.rows[0][17] == 0 && tensor.rows[3][17] == 1)

        let shifted = transform(rich, scale: 1, dx: 900, dy: -350)
        let shiftedTensor = InkFeatureTensor.build(strokes: shifted)
        check("geometry tensor is translation invariant", approximatelyEqual(tensor.rows, shiftedTensor.rows, ignoring: []))

        let scaled = transform(rich, scale: 2.7, dx: 0, dy: 0)
        let scaledTensor = InkFeatureTensor.build(strokes: scaled)
        check("geometry tensor is scale invariant", approximatelyEqual(tensor.rows, scaledTensor.rows, ignoring: []))

        let legacy = [InkStroke(points: [
            InkPoint(x: 2, y: 2, w: 3),
            InkPoint(x: 9, y: 12, w: 3)
        ])]
        let legacyTensor = InkFeatureTensor.build(strokes: legacy)
        check("legacy ink marks optional telemetry unknown rather than observed",
              legacyTensor.rows.allSatisfy { $0[9] == 0 && $0[13] == 0 && $0[19] == 0 })
        check("missing orientation contributes no fabricated angle",
              legacyTensor.rows.allSatisfy { $0[10] == 0 && $0[11] == 0 && $0[12] == 0 })

        let dot = InkFeatureTensor.build(strokes: [InkStroke(points: [InkPoint(x: 4, y: 4, w: 3)])])
        check("zero-span dot remains finite and model-readable",
              dot.rows.count == 1 && dot.rows[0].allSatisfy(\.isFinite))

        let empty = InkFeatureTensor.build(strokes: [])
        check("empty ink yields empty tensor", empty.rows.isEmpty && empty.strokeRanges.isEmpty)

        if failures.isEmpty {
            NSLog("PRIINK tensor PASS %d/%d", checks, checks)
        } else {
            NSLog("PRIINK tensor FAIL %d/%d: %@", checks - failures.count, checks,
                  failures.joined(separator: ", ") as NSString)
        }
    }

    private static func transform(
        _ strokes: [InkStroke], scale: CGFloat, dx: CGFloat, dy: CGFloat
    ) -> [InkStroke] {
        strokes.map { stroke in
            InkStroke(points: stroke.points.map { point in
                InkPoint(
                    x: point.x * scale + dx,
                    y: point.y * scale + dy,
                    w: point.w * scale,
                    t: point.t,
                    force: point.force,
                    azimuth: point.azimuth,
                    altitude: point.altitude
                )
            })
        }
    }

    private static func approximatelyEqual(
        _ lhs: [[Float]], _ rhs: [[Float]], ignoring: Set<Int>
    ) -> Bool {
        guard lhs.count == rhs.count else { return false }
        for (a, b) in zip(lhs, rhs) {
            guard a.count == b.count else { return false }
            for index in a.indices where !ignoring.contains(index) {
                if abs(a[index] - b[index]) > 0.0005 { return false }
            }
        }
        return true
    }
}
