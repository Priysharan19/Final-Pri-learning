// Pri Learning · native cloud handwriting transport
//
// The native iPad app already owns the authoritative PencilKit drawing. Sending
// cloud OCR through WKWebView added an unnecessary failure surface (CORS,
// WebKit TLS state, canvas rasterisation and browser scheduling). This client
// keeps the Apple Pencil path native end-to-end until the already-server-side
// Pri gateway receives a tightly-cropped PNG.
//
// The OpenAI API key NEVER enters this app. The endpoint is Pri's gateway URL.

import Foundation
import PencilKit
import UIKit

final class NativeCloudInkClient: NSObject, URLSessionDelegate {

    enum ClientError: LocalizedError {
        case invalidEndpoint
        case noInk
        case rasterFailed
        case invalidResponse
        case http(Int, String)

        var errorDescription: String? {
            switch self {
            case .invalidEndpoint: return "Invalid cloud handwriting endpoint"
            case .noInk: return "No handwriting to recognise"
            case .rasterFailed: return "Could not rasterise PencilKit handwriting"
            case .invalidResponse: return "Cloud handwriting returned an invalid response"
            case let .http(code, message): return "Cloud handwriting HTTP \(code): \(message)"
            }
        }
    }

    private lazy var session: URLSession = {
        let config = URLSessionConfiguration.ephemeral
        config.timeoutIntervalForRequest = 45
        config.timeoutIntervalForResource = 50
        config.requestCachePolicy = .reloadIgnoringLocalCacheData
        config.urlCache = nil
        config.httpShouldSetCookies = false
        config.httpCookieAcceptPolicy = .never
        return URLSession(configuration: config, delegate: self, delegateQueue: nil)
    }()

    private let workQueue = DispatchQueue(label: "com.prilearning.ink.cloud", qos: .userInitiated)

    func recognise(strokes: [InkStroke], endpoint: String,
                   completion: @escaping (Result<[String: Any], Error>) -> Void) {
        guard !strokes.isEmpty else {
            completion(.failure(ClientError.noInk))
            return
        }
        guard let url = URL(string: endpoint),
              let scheme = url.scheme?.lowercased(),
              scheme == "https" || scheme == "http" else {
            completion(.failure(ClientError.invalidEndpoint))
            return
        }

        // Copy the value-type stroke snapshot and do all raster/JSON work away
        // from the main thread. PencilKit remains completely uninvolved while
        // the network request runs.
        let snapshot = strokes
        workQueue.async { [weak self] in
            guard let self else { return }
            do {
                let imageDataURL = try Self.imageDataURL(strokes: snapshot)
                let body = try JSONSerialization.data(withJSONObject: ["image": imageDataURL])

                var request = URLRequest(url: url)
                request.httpMethod = "POST"
                request.httpBody = body
                request.setValue("application/json", forHTTPHeaderField: "Content-Type")
                request.setValue("no-store", forHTTPHeaderField: "Cache-Control")

                self.session.dataTask(with: request) { data, response, error in
                    if let error {
                        completion(.failure(error))
                        return
                    }
                    guard let http = response as? HTTPURLResponse,
                          let data else {
                        completion(.failure(ClientError.invalidResponse))
                        return
                    }

                    let parsed = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any]
                    guard (200..<300).contains(http.statusCode) else {
                        let message = (parsed?["error"] as? String)
                            ?? HTTPURLResponse.localizedString(forStatusCode: http.statusCode)
                        completion(.failure(ClientError.http(http.statusCode, message)))
                        return
                    }
                    guard let parsed else {
                        completion(.failure(ClientError.invalidResponse))
                        return
                    }
                    completion(.success(parsed))
                }.resume()
            } catch {
                completion(.failure(error))
            }
        }
    }

    // MARK: - PencilKit raster

    private static func imageDataURL(strokes: [InkStroke]) throws -> String {
        guard !strokes.isEmpty else { throw ClientError.noInk }

        // IMPORTANT: do not use PKDrawing.image(from:scale:) here. PencilKit
        // adapts PKInk colours for the current appearance. Pri Learning runs in
        // dark mode, so a nominal .black PKInk can be appearance-adapted when
        // rendered off-screen; flattening that onto white can produce a nearly
        // blank OCR image. Draw the captured centrelines ourselves instead so
        // OpenAI always receives literal black ink on literal white paper.
        var bounds = strokes[0].bounds
        for stroke in strokes.dropFirst() { bounds = bounds.union(stroke.bounds) }
        guard bounds.width.isFinite, bounds.height.isFinite,
              bounds.width > 0, bounds.height > 0 else {
            throw ClientError.rasterFailed
        }

        let pad: CGFloat = 28
        let paddedWidth = max(1, bounds.width + pad * 2)
        let paddedHeight = max(1, bounds.height + pad * 2)

        let maxSide: CGFloat = 2048
        let maxPixels: CGFloat = 3_200_000
        var scale: CGFloat = 2
        scale = min(scale, maxSide / max(paddedWidth, paddedHeight))
        scale = min(scale, sqrt(maxPixels / max(1, paddedWidth * paddedHeight)))
        scale = max(0.5, scale)

        let pixelWidth = max(64, Int(ceil(paddedWidth * scale)))
        let pixelHeight = max(64, Int(ceil(paddedHeight * scale)))

        let format = UIGraphicsImageRendererFormat()
        format.opaque = true
        format.scale = 1
        let renderer = UIGraphicsImageRenderer(
            size: CGSize(width: pixelWidth, height: pixelHeight),
            format: format
        )

        let image = renderer.image { rendererContext in
            let cg = rendererContext.cgContext
            cg.setFillColor(UIColor.white.cgColor)
            cg.fill(CGRect(x: 0, y: 0, width: pixelWidth, height: pixelHeight))
            cg.setStrokeColor(UIColor.black.cgColor)
            cg.setFillColor(UIColor.black.cgColor)
            cg.setLineCap(.round)
            cg.setLineJoin(.round)
            cg.setShouldAntialias(true)

            func map(_ p: InkPoint) -> CGPoint {
                CGPoint(
                    x: (p.x - bounds.minX + pad) * scale,
                    y: (p.y - bounds.minY + pad) * scale
                )
            }

            for stroke in strokes {
                let points = stroke.points
                guard let first = points.first else { continue }

                if points.count == 1 {
                    let centre = map(first)
                    let diameter = max(4, min(14, first.w * scale))
                    cg.fillEllipse(in: CGRect(
                        x: centre.x - diameter / 2,
                        y: centre.y - diameter / 2,
                        width: diameter,
                        height: diameter
                    ))
                    continue
                }

                for i in 1..<points.count {
                    let a = points[i - 1]
                    let b = points[i]
                    let wa = a.w.isFinite ? a.w : 3
                    let wb = b.w.isFinite ? b.w : wa
                    let nativeWidth = max(2.2, min(7.0, (wa + wb) * 0.5))
                    cg.setLineWidth(nativeWidth * scale)
                    cg.beginPath()
                    cg.move(to: map(a))
                    cg.addLine(to: map(b))
                    cg.strokePath()
                }
            }
        }

        guard let png = image.pngData(), !png.isEmpty else {
            throw ClientError.rasterFailed
        }
        return "data:image/png;base64,\(png.base64EncodedString())"
    }

    // MARK: - Development TLS

    func urlSession(_ session: URLSession,
                    didReceive challenge: URLAuthenticationChallenge,
                    completionHandler: @escaping (URLSession.AuthChallengeDisposition, URLCredential?) -> Void) {
#if DEBUG
        // Physical-iPad development uses Pri's self-signed LAN certificate.
        // Accept it ONLY for private/LAN hosts in DEBUG builds. Release builds
        // always use normal platform trust evaluation.
        if challenge.protectionSpace.authenticationMethod == NSURLAuthenticationMethodServerTrust,
           let trust = challenge.protectionSpace.serverTrust,
           Self.isPrivateLANHost(challenge.protectionSpace.host) {
            completionHandler(.useCredential, URLCredential(trust: trust))
            return
        }
#endif
        completionHandler(.performDefaultHandling, nil)
    }

    private static func isPrivateLANHost(_ host: String) -> Bool {
        if host == "localhost" || host == "127.0.0.1" || host.hasSuffix(".local") { return true }
        if host.hasPrefix("10.") || host.hasPrefix("192.168.") { return true }
        let parts = host.split(separator: ".").compactMap { Int($0) }
        if parts.count == 4, parts[0] == 172, (16...31).contains(parts[1]) { return true }
        return false
    }
}
