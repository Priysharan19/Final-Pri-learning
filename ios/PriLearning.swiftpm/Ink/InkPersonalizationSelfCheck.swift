// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Native personalization safety checks
//
// Proves the bounded learner can help a repeated ambiguous hand while refusing
// to overrule strong global recognition or leak influence across students or
// unrelated symbol families. Uses isolated UserDefaults so CI never contaminates
// a real student's personal prototypes.
// ─────────────────────────────────────────────────────────────────────────────
import CoreGraphics
import Foundation

enum InkPersonalizationSelfCheck {

    static func run() {
        let suite = "pri.ink.personalization.selfcheck.\(UUID().uuidString)"
        guard let defaults = UserDefaults(suiteName: suite) else {
            NSLog("PRIINK personalization FAIL 0/1: isolated defaults unavailable")
            return
        }
        defer { defaults.removePersistentDomain(forName: suite) }
        let store = InkPersonalizationStore(defaults: defaults)
        let studentA = "selfcheck-student-a"
        let studentB = "selfcheck-student-b"

        var failures: [String] = []
        var checks = 0
        func check(_ name: String, _ condition: @autoclosure () -> Bool) {
            checks += 1
            if !condition() { failures.append(name) }
        }

        let y1 = yVariant(dx: 0, tail: 0, speed: 1.0)
        let y2 = yVariant(dx: 1.4, tail: 2.0, speed: 0.92)
        let yQuery = yVariant(dx: 0.7, tail: 0.8, speed: 0.96)

        store.learn(profile: studentA, symbol: "y", strokes: y1)
        check("one correction cannot influence recognition",
              store.suggestion(profile: studentA, for: yQuery, current: "1", alternatives: ["y"],
                               globalConfidence: 0.61) == nil)

        store.learn(profile: studentA, symbol: "y", strokes: y2)
        let learned = store.suggestion(profile: studentA, for: yQuery, current: "1", alternatives: ["y"],
                                       globalConfidence: 0.61)
        check("repeated similar y corrections can resolve ambiguous 1", learned?.symbol == "y")
        check("personal suggestion remains below global high-confidence authority",
              (learned?.confidence ?? 1) <= 0.82)

        check("strong global reading is never overridden",
              store.suggestion(profile: studentA, for: yQuery, current: "1", alternatives: ["y"],
                               globalConfidence: 0.94) == nil)
        check("one student's hand never influences another profile",
              store.suggestion(profile: studentB, for: yQuery, current: "1", alternatives: ["y"],
                               globalConfidence: 0.61) == nil)

        let zero = ovalVariant(flatten: 0)
        store.learn(profile: studentA, symbol: "theta", strokes: thetaVariant(flatten: 0))
        store.learn(profile: studentA, symbol: "theta", strokes: thetaVariant(flatten: 1.2))
        let thetaSuggestion = store.suggestion(profile: studentA,
                                               for: thetaVariant(flatten: 0.5), current: "0",
                                               alternatives: ["theta"], globalConfidence: 0.58)
        check("theta habit can resolve an ambiguous zero family", thetaSuggestion?.symbol == "theta")
        check("theta history does not turn an ordinary zero into unrelated y",
              store.suggestion(profile: studentA, for: zero, current: "0", alternatives: ["y"],
                               globalConfidence: 0.58)?.symbol != "y")

        // Duplicate callbacks from the same correction are intentionally one
        // prototype, and profile reset removes only that student's hand.
        let beforeDuplicate = store.sampleCount(profile: studentA)
        store.learn(profile: studentA, symbol: "y", strokes: y2)
        check("duplicate correction does not inflate the store",
              store.sampleCount(profile: studentA) == beforeDuplicate)
        store.learn(profile: studentB, symbol: "theta", strokes: thetaVariant(flatten: 2.2))
        let bCount = store.sampleCount(profile: studentB)
        store.reset(profile: studentA)
        check("profile reset removes only that student's prototypes",
              store.sampleCount(profile: studentA) == 0 && store.sampleCount(profile: studentB) == bCount)
        store.reset()
        check("device-wide reset removes all personal handwriting", store.sampleCount() == 0)

        if failures.isEmpty {
            NSLog("PRIINK personalization PASS %d/%d", checks, checks)
        } else {
            NSLog("PRIINK personalization FAIL %d/%d: %@", checks - failures.count, checks,
                  failures.joined(separator: ", ") as NSString)
        }
    }

    private static func yVariant(dx: CGFloat, tail: CGFloat, speed: Double) -> [InkStroke] {
        [
            stroke([(7 + dx, 7), (15 + dx, 17), (22 + dx, 25)], speed: speed),
            stroke([(34 + dx, 7), (28 + dx, 19), (23 + dx, 31),
                    (18 + dx, 44), (14 + dx, 58 + tail)], speed: speed)
        ]
    }

    private static func thetaVariant(flatten: CGFloat) -> [InkStroke] {
        [
            stroke([(20, 5 + flatten), (30, 8), (36, 17), (36, 26),
                    (31, 35), (21, 39 - flatten), (11, 35), (5, 26),
                    (6, 16), (11, 8), (20, 5 + flatten)], speed: 1),
            stroke([(7, 22), (20, 21.5), (35, 21)], speed: 1)
        ]
    }

    private static func ovalVariant(flatten: CGFloat) -> [InkStroke] {
        [stroke([(20, 5 + flatten), (30, 8), (36, 17), (36, 26),
                 (31, 35), (21, 39 - flatten), (11, 35), (5, 26),
                 (6, 16), (11, 8), (20, 5 + flatten)], speed: 1)]
    }

    private static func stroke(_ tuples: [(CGFloat, CGFloat)], speed: Double) -> InkStroke {
        let step = 0.008 / max(speed, 0.2)
        return InkStroke(points: tuples.enumerated().map { index, p in
            InkPoint(x: p.0, y: p.1, w: 3,
                     t: Double(index) * step, force: 0.55)
        })
    }
}
