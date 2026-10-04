// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · NotificationBridge (priNative `notifications` v1)
//
// Local reminders for the iPad shell: the page computes when a nudge is due
// (client/src/reminders/schedule.js) and hands the shell a short list of
// generic items — a title, a body, an instant and an in-app route. The shell
// schedules them with UNUserNotificationCenter and nothing else: no server, no
// push token, no learning data. Titles and bodies arrive generic by
// construction (counts and catalogue copy, never a question or a mark) and are
// truncated again here so a malformed page cannot put a paragraph on the lock
// screen.
//
// Ops, each answered through the envelope the host bridge owns:
//   notifications.requestPermission  → { granted: Bool }
//   notifications.schedule           → { scheduled: Int }   (replaces the set)
//   notifications.cancelAll          → {}
//
// Permission is requested only when the page asks, and the page asks only from
// the Settings toggle. Every request is identified by the `pri.reminder.`
// prefix so clearing ours never touches a notification another part of the
// app may one day own. The horizon is seven days and the cap 64 items, the
// same bounds the envelope schema in client/src/platform/native/envelope.js
// enforces on the reply.
//
// Wiring (NativeHostBridge.swift, kept out of this file on purpose):
//   descriptor  "notifications": ["versions": [1], "transport": "bridge"]
//   handle()    case "notifications.requestPermission", "notifications.schedule",
//               "notifications.cancelAll":
//                   NotificationBridge.shared.handle(op: op, payload: payload,
//                       reply: { [weak self] in self?.reply(id, $0) },
//                       fail: { [weak self] in self?.fail(id, $0, $1) })
// ─────────────────────────────────────────────────────────────────────────────
import Foundation
import UserNotifications

final class NotificationBridge {
    static let shared = NotificationBridge()

    static let identifierPrefix = "pri.reminder."
    static let maxItems = 64
    static let horizonSeconds: TimeInterval = 7 * 24 * 60 * 60
    static let maxTitleLength = 120
    static let maxBodyLength = 200

    private let center: UNUserNotificationCenter

    init(center: UNUserNotificationCenter = .current()) {
        self.center = center
    }

    // MARK: Dispatch

    func handle(op: String,
                payload: [String: Any],
                reply: @escaping ([String: Any]) -> Void,
                fail: @escaping (String, String) -> Void) {
        switch op {
        case "requestPermission":
            requestPermission(reply: reply, fail: fail)
        case "schedule":
            schedule(payload, reply: reply, fail: fail)
        case "cancelAll":
            cancelAll { reply([:]) }
        default:
            fail("UNSUPPORTED", "notifications.\(op) is not supported by this app version.")
        }
    }

    // MARK: Permission

    private func requestPermission(reply: @escaping ([String: Any]) -> Void,
                                   fail: @escaping (String, String) -> Void) {
        center.getNotificationSettings { [center] settings in
            switch settings.authorizationStatus {
            case .authorized, .provisional, .ephemeral:
                reply(["granted": true])
            case .denied:
                // The system will not ask again; the page tells the student where
                // to turn it on. Not an error: a refusal is an answer.
                reply(["granted": false])
            default:
                center.requestAuthorization(options: [.alert, .sound, .badge]) { granted, error in
                    if let error {
                        fail("PROVIDER_ERROR", error.localizedDescription)
                        return
                    }
                    reply(["granted": granted])
                }
            }
        }
    }

    // MARK: Schedule

    private struct Item {
        let id: String
        let fireAt: Date
        let title: String
        let body: String
        let url: String
    }

    private static func sanitise(_ raw: Any?, max: Int) -> String {
        guard let text = raw as? String else { return "" }
        let flat = text.replacingOccurrences(of: "\n", with: " ").trimmingCharacters(in: .whitespacesAndNewlines)
        return String(flat.prefix(max))
    }

    private static func parseItems(_ payload: [String: Any], now: Date) -> [Item] {
        guard let rows = payload["items"] as? [[String: Any]] else { return [] }
        let latest = now.addingTimeInterval(horizonSeconds)
        var seen = Set<String>()
        var out: [Item] = []
        for row in rows {
            guard out.count < maxItems else { break }
            guard let rawId = row["id"] as? String, !rawId.isEmpty, rawId.count <= 64,
                  rawId.unicodeScalars.allSatisfy({ CharacterSet.alphanumerics.union(CharacterSet(charactersIn: ":-_.")).contains($0) }),
                  !seen.contains(rawId) else { continue }
            let millis: Double
            if let n = row["at"] as? NSNumber { millis = n.doubleValue } else { continue }
            guard millis.isFinite, millis > 0 else { continue }
            let fireAt = Date(timeIntervalSince1970: millis / 1000)
            guard fireAt > now, fireAt <= latest else { continue }
            let title = sanitise(row["title"], max: maxTitleLength)
            guard !title.isEmpty else { continue }
            let body = sanitise(row["body"], max: maxBodyLength)
            let rawUrl = row["url"] as? String ?? "/"
            let url = rawUrl.range(of: "^/[a-z-]*$", options: .regularExpression) != nil ? rawUrl : "/"
            seen.insert(rawId)
            out.append(Item(id: rawId, fireAt: fireAt, title: title, body: body, url: url))
        }
        return out
    }

    private func schedule(_ payload: [String: Any],
                          reply: @escaping ([String: Any]) -> Void,
                          fail: @escaping (String, String) -> Void) {
        let items = Self.parseItems(payload, now: Date())
        center.getNotificationSettings { [center] settings in
            guard settings.authorizationStatus == .authorized
                    || settings.authorizationStatus == .provisional
                    || settings.authorizationStatus == .ephemeral else {
                return fail("UNAVAILABLE", "Notifications are not allowed for Pri Learning.")
            }
            // Replace, never append: the page recomputes the whole seven-day set
            // on every sync, so whatever was pending before is now stale.
            self.cancelAll {
                if items.isEmpty { return reply(["scheduled": 0]) }
                let group = DispatchGroup()
                var scheduled = 0
                let lock = NSLock()
                for item in items {
                    let content = UNMutableNotificationContent()
                    content.title = item.title
                    content.body = item.body
                    content.sound = .default
                    content.userInfo = ["url": item.url]
                    content.threadIdentifier = "pri.reminders"
                    let interval = max(1, item.fireAt.timeIntervalSinceNow)
                    let trigger = UNTimeIntervalNotificationTrigger(timeInterval: interval, repeats: false)
                    let request = UNNotificationRequest(identifier: Self.identifierPrefix + item.id, content: content, trigger: trigger)
                    group.enter()
                    center.add(request) { error in
                        if error == nil { lock.lock(); scheduled += 1; lock.unlock() }
                        group.leave()
                    }
                }
                group.notify(queue: .main) {
                    reply(["scheduled": min(scheduled, Self.maxItems)])
                }
            }
        }
    }

    // MARK: Cancel

    /// Removes every pending and delivered reminder this bridge scheduled.
    /// Sign-out and the Settings toggle both end here.
    func cancelAll(completion: @escaping () -> Void) {
        center.getPendingNotificationRequests { [center] pending in
            let ours = pending.map(\.identifier).filter { $0.hasPrefix(Self.identifierPrefix) }
            if !ours.isEmpty { center.removePendingNotificationRequests(withIdentifiers: ours) }
            center.getDeliveredNotifications { delivered in
                let shown = delivered.map(\.request.identifier).filter { $0.hasPrefix(Self.identifierPrefix) }
                if !shown.isEmpty { center.removeDeliveredNotifications(withIdentifiers: shown) }
                DispatchQueue.main.async(execute: completion)
            }
        }
    }
}
