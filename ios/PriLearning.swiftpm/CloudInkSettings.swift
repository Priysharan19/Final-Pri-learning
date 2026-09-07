import Foundation

// ─────────────────────────────────────────────────────────────────────────────
// Where the cloud gateway lives, as far as the native shell is concerned.
//
// This type exists because the web app cannot work it out for itself inside
// this shell. Its resolver accepts a runtime global, a Vite build variable, or
// an http(s) LAN origin — and the page here is served from `prilearning://`,
// which matches none of them. So the shell has to say it, and WebShell injects
// what this returns at document start.
//
// Resolution order, first non-empty wins:
//
//   1. UserDefaults `PriCloudInkEndpoint` — what Settings writes, and what a
//      TestFlight build can be pointed at without a rebuild.
//   2. `PriCloudInkEndpoint` in Info.plist — the shipped default for a release
//      build, set per configuration.
//
// There is deliberately no hardcoded fallback. A build that was never told
// where its gateway is must behave as if cloud is switched off — the app is
// fully usable that way, and inventing a default would point student work at
// whatever happens to answer on that address.
// ─────────────────────────────────────────────────────────────────────────────

enum CloudInkSettings {
    static let endpointKey = "PriCloudInkEndpoint"
    static let tokenKey = "PriCloudInkToken"

    /// The recognition endpoint. The marking route is a sibling of it, and the
    /// web client derives one from the other, so only this one is configured.
    static var endpoint: String? {
        guard let raw = value(for: endpointKey) else { return nil }

        // Only https and http are meaningful here, and a malformed string would
        // otherwise be injected into the page verbatim.
        guard let url = URL(string: raw),
              let scheme = url.scheme?.lowercased(),
              scheme == "https" || scheme == "http",
              url.host != nil
        else { return nil }

        // Cleartext to anywhere but the local network will be refused by ATS at
        // request time; catching it here makes it a visible configuration
        // mistake instead of a silent failure on the student's first submission.
        if scheme == "http" && !isLocalHost(url.host!) { return nil }

        return raw
    }

    /// The bearer token the gateway expects. Optional: a LAN development
    /// gateway usually runs without one. A production gateway refuses to boot
    /// without one, so in practice a release build sets both or neither.
    static var clientToken: String? {
        value(for: tokenKey)
    }

    private static func value(for key: String) -> String? {
        let defaults = UserDefaults.standard.string(forKey: key)?
            .trimmingCharacters(in: .whitespacesAndNewlines)
        if let defaults, !defaults.isEmpty { return defaults }

        let plist = (Bundle.main.object(forInfoDictionaryKey: key) as? String)?
            .trimmingCharacters(in: .whitespacesAndNewlines)
        if let plist, !plist.isEmpty { return plist }

        return nil
    }

    private static func isLocalHost(_ host: String) -> Bool {
        if host == "localhost" || host == "127.0.0.1" || host == "::1" { return true }
        if host.hasSuffix(".local") { return true }
        if host.hasPrefix("10.") || host.hasPrefix("192.168.") { return true }
        if let second = host.split(separator: ".").dropFirst().first,
           host.hasPrefix("172."), let n = Int(second), (16...31).contains(n) { return true }
        return false
    }
}

/// JSON-encode a string for safe interpolation into injected JavaScript.
/// Hand-rolled quoting would be one unescaped character away from breaking the
/// boot script, which fails as a blank app rather than as a visible error.
func jsString(_ value: String) -> String {
    guard let data = try? JSONEncoder().encode(value),
          let encoded = String(data: data, encoding: .utf8)
    else { return "\"\"" }
    return encoded
}
