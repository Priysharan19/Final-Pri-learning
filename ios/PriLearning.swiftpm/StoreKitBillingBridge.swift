// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · StoreKitBillingBridge
//
// StoreKit owns purchase UX and locally verifies Apple-signed transactions, but
// it does NOT own Pri Learning Premium. A verified StoreKit transaction is sent
// to the cloud as its JWS representation; only after the server independently
// verifies Apple's signature, app identity, product and appAccountToken does the
// web app ask this bridge to finish the transaction.
//
// Leaving an accepted purchase unfinished while the network/server is down is
// deliberate. StoreKit will redeliver unfinished transactions through
// Transaction.updates, giving Pri Learning a durable recovery path instead of a
// paid customer losing access because one HTTP request failed.
// ─────────────────────────────────────────────────────────────────────────────
import Foundation
import StoreKit
import WebKit

@MainActor
final class StoreKitBillingBridge {
    private weak var webView: WKWebView?
    private var updatesTask: Task<Void, Never>?
    private var pendingTransactions: [UInt64: Transaction] = [:]

    func attach(to webView: WKWebView) {
        self.webView = webView
        startTransactionListener()
    }

    func detach() {
        updatesTask?.cancel()
        updatesTask = nil
        webView = nil
    }

    func handle(_ raw: Any) {
        guard let body = raw as? [String: Any],
              let requestId = body["id"] as? String,
              requestId.count <= 120,
              let action = body["action"] as? String else { return }

        Task { @MainActor [weak self] in
            guard let self else { return }
            do {
                switch action {
                case "products":
                    let ids = self.productIds(body["productIds"])
                    let products = try await Product.products(for: ids)
                    let rows: [[String: Any]] = products.map { product in
                        [
                            "id": product.id,
                            "displayName": product.displayName,
                            "description": product.description,
                            "displayPrice": product.displayPrice,
                            "subscription": product.subscription != nil
                        ]
                    }
                    self.respond(requestId, ok: true, result: ["products": rows])

                case "purchase":
                    guard let productId = body["productId"] as? String,
                          productId.count <= 200,
                          let tokenText = body["appAccountToken"] as? String,
                          let accountToken = UUID(uuidString: tokenText) else {
                        throw BillingBridgeError.invalidRequest
                    }
                    guard let product = try await Product.products(for: [productId]).first(where: { $0.id == productId }) else {
                        throw BillingBridgeError.productUnavailable
                    }

                    let purchase = try await product.purchase(options: [.appAccountToken(accountToken)])
                    switch purchase {
                    case .success(let verification):
                        switch verification {
                        case .verified(let transaction):
                            self.pendingTransactions[transaction.id] = transaction
                            self.respond(requestId, ok: true, result: [
                                "status": "verified",
                                "transactionId": String(transaction.id),
                                "originalTransactionId": String(transaction.originalID),
                                "productId": transaction.productID,
                                "signedTransaction": verification.jwsRepresentation
                            ])
                        case .unverified(_, let error):
                            throw BillingBridgeError.unverified(error.localizedDescription)
                        }
                    case .pending:
                        self.respond(requestId, ok: true, result: ["status": "pending"])
                    case .userCancelled:
                        self.respond(requestId, ok: true, result: ["status": "cancelled"])
                    @unknown default:
                        throw BillingBridgeError.unknownPurchaseResult
                    }

                case "restore":
                    let allowed = Set(self.productIds(body["productIds"]))
                    try await AppStore.sync()
                    var rows: [[String: Any]] = []
                    for await verification in Transaction.currentEntitlements {
                        guard case .verified(let transaction) = verification,
                              allowed.contains(transaction.productID),
                              transaction.revocationDate == nil else { continue }
                        self.pendingTransactions[transaction.id] = transaction
                        rows.append([
                            "transactionId": String(transaction.id),
                            "originalTransactionId": String(transaction.originalID),
                            "productId": transaction.productID,
                            "signedTransaction": verification.jwsRepresentation
                        ])
                    }
                    self.respond(requestId, ok: true, result: ["transactions": rows])

                case "finish":
                    guard let text = body["transactionId"] as? String,
                          let transactionId = UInt64(text),
                          let transaction = self.pendingTransactions[transactionId] else {
                        throw BillingBridgeError.transactionNotPending
                    }
                    await transaction.finish()
                    self.pendingTransactions.removeValue(forKey: transactionId)
                    self.respond(requestId, ok: true, result: ["finished": true, "transactionId": text])

                default:
                    throw BillingBridgeError.invalidRequest
                }
            } catch {
                self.respond(requestId, ok: false, error: error)
            }
        }
    }

    private func productIds(_ raw: Any?) -> [String] {
        guard let values = raw as? [Any] else { return [] }
        var seen = Set<String>()
        var out: [String] = []
        for value in values.prefix(12) {
            guard let id = value as? String,
                  !id.isEmpty,
                  id.count <= 200,
                  seen.insert(id).inserted else { continue }
            out.append(id)
        }
        return out
    }

    private func startTransactionListener() {
        updatesTask?.cancel()
        updatesTask = Task { @MainActor [weak self] in
            for await verification in Transaction.updates {
                guard !Task.isCancelled, let self else { return }
                guard case .verified(let transaction) = verification else { continue }
                self.pendingTransactions[transaction.id] = transaction
                self.emit("pri:native-billing-update", detail: [
                    "status": "verified",
                    "transactionId": String(transaction.id),
                    "originalTransactionId": String(transaction.originalID),
                    "productId": transaction.productID,
                    "signedTransaction": verification.jwsRepresentation
                ])
            }
        }
    }

    private func respond(_ requestId: String, ok: Bool, result: [String: Any]? = nil, error: Error? = nil) {
        var detail: [String: Any] = ["id": requestId, "ok": ok]
        if let result { detail["result"] = result }
        if let error {
            detail["error"] = [
                "code": errorCode(error),
                "message": error.localizedDescription
            ]
        }
        emit("pri:native-billing-response", detail: detail)
    }

    private func emit(_ event: String, detail: [String: Any]) {
        guard let webView,
              JSONSerialization.isValidJSONObject(detail),
              let data = try? JSONSerialization.data(withJSONObject: detail),
              var json = String(data: data, encoding: .utf8) else { return }
        // JavaScript treats U+2028/U+2029 as line separators in some runtimes.
        json = json.replacingOccurrences(of: "\u{2028}", with: "\\u2028")
                   .replacingOccurrences(of: "\u{2029}", with: "\\u2029")
        let script = "window.dispatchEvent(new CustomEvent('" + event + "',{detail:" + json + "}));"
        webView.evaluateJavaScript(script, completionHandler: nil)
    }

    private func errorCode(_ error: Error) -> String {
        if let bridge = error as? BillingBridgeError { return bridge.code }
        if error is StoreKitError { return "STOREKIT_ERROR" }
        return "NATIVE_BILLING_ERROR"
    }
}

private enum BillingBridgeError: LocalizedError {
    case invalidRequest
    case productUnavailable
    case transactionNotPending
    case unverified(String)
    case unknownPurchaseResult

    var code: String {
        switch self {
        case .invalidRequest: return "NATIVE_BILLING_BAD_REQUEST"
        case .productUnavailable: return "STOREKIT_PRODUCT_UNAVAILABLE"
        case .transactionNotPending: return "STOREKIT_TRANSACTION_NOT_PENDING"
        case .unverified: return "STOREKIT_TRANSACTION_UNVERIFIED"
        case .unknownPurchaseResult: return "STOREKIT_UNKNOWN_RESULT"
        }
    }

    var errorDescription: String? {
        switch self {
        case .invalidRequest: return "The native billing request is invalid."
        case .productUnavailable: return "This App Store subscription is not available in the current storefront."
        case .transactionNotPending: return "That StoreKit transaction is not waiting to be finished."
        case .unverified(let reason): return "StoreKit could not verify the transaction: \(reason)"
        case .unknownPurchaseResult: return "StoreKit returned an unknown purchase state."
        }
    }
}
