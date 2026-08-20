// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · LocalSchemeHandler
// Serves the bundled web build (Resources/Web) over prilearning://app/…
// A custom scheme (rather than file://) gives the page a stable origin, so
// IndexedDB and localStorage persist in the app's sandbox across launches.
// SPA routes without a file extension fall back to index.html.
// ─────────────────────────────────────────────────────────────────────────────
import WebKit

final class LocalSchemeHandler: NSObject, WKURLSchemeHandler {

    /// Root of the bundled web build inside the app bundle. Depending on how
    /// the package is built (Swift Playground on iPad, Xcode app playground),
    /// resources land either directly in the main bundle or inside a nested
    /// SwiftPM resource bundle — so search all of them at runtime instead of
    /// relying on the compile-time `Bundle.module` accessor, which Xcode does
    /// not synthesize for app playgrounds.
    private lazy var webRoot: URL? = {
        var bundles: [Bundle] = [Bundle.main]
        if let nested = Bundle.main.urls(forResourcesWithExtension: "bundle", subdirectory: nil) {
            bundles.append(contentsOf: nested.compactMap { Bundle(url: $0) })
        }
        for bundle in bundles {
            for subdirectory in ["Web", "Resources/Web"] {
                if let index = bundle.url(forResource: "index", withExtension: "html", subdirectory: subdirectory) {
                    return index.deletingLastPathComponent()
                }
            }
        }
        return nil
    }()

    func webView(_ webView: WKWebView, start urlSchemeTask: WKURLSchemeTask) {
        guard let url = urlSchemeTask.request.url else {
            urlSchemeTask.didFailWithError(URLError(.badURL))
            return
        }

        var path = url.path
        if path.isEmpty || path == "/" { path = "/index.html" }
        // React Router routes ("/practice", "/exams/abc") have no extension —
        // they are the app shell, not files.
        if (path as NSString).pathExtension.isEmpty { path = "/index.html" }

        guard let root = webRoot else {
            urlSchemeTask.didFailWithError(URLError(.fileDoesNotExist))
            return
        }

        let fileURL = root.appendingPathComponent(String(path.dropFirst()))
        guard let data = FileManager.default.contents(atPath: fileURL.path) else {
            urlSchemeTask.didFailWithError(URLError(.fileDoesNotExist))
            return
        }

        let ext = fileURL.pathExtension.lowercased()
        let mime = Self.mimeType(for: ext)
        let isText = mime.hasPrefix("text/") || mime.contains("javascript")
            || mime.contains("json") || mime.contains("svg")

        let response = URLResponse(
            url: url,
            mimeType: mime,
            expectedContentLength: data.count,
            textEncodingName: isText ? "utf-8" : nil
        )
        urlSchemeTask.didReceive(response)
        urlSchemeTask.didReceive(data)
        urlSchemeTask.didFinish()
    }

    func webView(_ webView: WKWebView, stop urlSchemeTask: WKURLSchemeTask) {
        // Responses are served synchronously from the bundle — nothing to cancel.
    }

    private static func mimeType(for ext: String) -> String {
        switch ext {
        case "html":               return "text/html"
        case "js", "mjs":          return "text/javascript"
        case "css":                return "text/css"
        case "svg":                return "image/svg+xml"
        case "png":                return "image/png"
        case "jpg", "jpeg":        return "image/jpeg"
        case "ico":                return "image/x-icon"
        case "json", "webmanifest", "map":
                                   return "application/json"
        case "woff2":              return "font/woff2"
        case "woff":               return "font/woff"
        case "ttf":                return "font/ttf"
        case "txt":                return "text/plain"
        default:                   return "application/octet-stream"
        }
    }
}
