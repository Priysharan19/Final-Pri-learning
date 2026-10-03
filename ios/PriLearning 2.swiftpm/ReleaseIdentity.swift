import Foundation

/// Reads the exact build identity emitted by Vite into Resources/Web/release.json.
/// The native shell deliberately consumes the same artifact as the web runtime;
/// it does not maintain a second SHA/version constant that can drift.
enum NativeReleaseIdentity {
    /// The validated release.json object, or nil when absent/malformed.
    static var object: [String: Any]? {
        guard let data = releaseData(),
              let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              object["schemaVersion"] as? Int == 1,
              let sha = object["releaseSha"] as? String,
              sha.range(of: "^[0-9a-f]{40}$", options: .regularExpression) != nil else {
            return nil
        }
        return object
    }

    static var javaScriptLiteral: String {
        guard let object,
              let normalized = try? JSONSerialization.data(withJSONObject: object, options: [.sortedKeys]),
              let json = String(data: normalized, encoding: .utf8) else {
            return "null"
        }
        return json
    }

    private static func releaseData() -> Data? {
        var bundles: [Bundle] = [Bundle.main]
        if let nested = Bundle.main.urls(forResourcesWithExtension: "bundle", subdirectory: nil) {
            bundles.append(contentsOf: nested.compactMap { Bundle(url: $0) })
        }
        for bundle in bundles {
            for subdirectory in ["Web", "Resources/Web"] {
                if let url = bundle.url(forResource: "release", withExtension: "json", subdirectory: subdirectory),
                   let data = try? Data(contentsOf: url) {
                    return data
                }
            }
        }
        return nil
    }
}
