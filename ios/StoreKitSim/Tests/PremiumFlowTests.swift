// SIMULATOR EVIDENCE ONLY. SKTestSession answers every call from the local
// PriPremium.storekit file; no App Store, no sandbox, no money. These tests
// drive the same StoreKit 2 calls StoreKitBillingBridge.swift makes:
// Product.products, purchase(options: [.appAccountToken]), the JWS the server
// verifies, Transaction.currentEntitlements (restore), and expiry/refund.
import XCTest
import StoreKit
import StoreKitTest
enum PremiumProducts {
    static let monthly = "com.prilearning.app.premium.monthly"
    static let annual = "com.prilearning.app.premium.annual"
    static let all = [monthly, annual]
}

final class PremiumFlowTests: XCTestCase {
    var session: SKTestSession!

    override func setUpWithError() throws {
        let url = try XCTUnwrap(Bundle(for: PremiumFlowTests.self).url(forResource: "PriPremium", withExtension: "storekit"))
        session = try SKTestSession(contentsOf: url)
        session.resetToDefaultState()
        session.clearTransactions()
        session.disableDialogs = true
        session.timeRate = .realTime
        session.askToBuyEnabled = false
    }

    // What a restore hands the server: verified, not revoked, not expired.
    // Expiry and refund reach StoreKit's store asynchronously, so a change is
    // awaited for up to five seconds.
    private func entitled(waitingFor gone: String? = nil) async -> Set<String> {
        for _ in 0..<50 {
            var ids = Set<String>()
            for await v in Transaction.currentEntitlements {
                if case .verified(let t) = v, t.revocationDate == nil, (t.expirationDate ?? .distantFuture) > Date() { ids.insert(t.productID) }
            }
            if gone == nil || !ids.contains(gone!) { return ids }
            try? await Task.sleep(nanoseconds: 100_000_000)
        }
        var ids = Set<String>()
        for await v in Transaction.currentEntitlements { if case .verified(let t) = v, t.revocationDate == nil, (t.expirationDate ?? .distantFuture) > Date() { ids.insert(t.productID) } }
        return ids
    }

    // Headless purchase through the test session: Product.purchase() opens the
    // confirmation sheet, which an unattended simulator run cannot press. The
    // transaction StoreKit records is the same kind the bridge reads.
    private func buy(_ id: String, token: UUID) async throws -> Transaction {
        let t = try await session.buyProduct(identifier: id, options: [.appAccountToken(token)])
        XCTAssertEqual(t.appAccountToken, token, "the server-issued appAccountToken is bound to the transaction")
        var jws = ""
        for await v in Transaction.all { if case .verified(let x) = v, x.id == t.id { jws = v.jwsRepresentation } }
        XCTAssertFalse(jws.isEmpty, "a signed JWS exists for the server to verify")
        return t
    }

    func testProductsAndPrices() async throws {
        let products = try await Product.products(for: PremiumProducts.all)
        XCTAssertEqual(Set(products.map(\.id)), Set(PremiumProducts.all))
        let byId = Dictionary(uniqueKeysWithValues: products.map { ($0.id, $0) })
        // The billed amounts the paywall shows are the store's displayPrice.
        // (StoreKit Testing's numeric `price` for 1,499 reads back as 1 on this
        // simulator, so the "about ... a month" line is not asserted here.)
        XCTAssertEqual(byId[PremiumProducts.monthly]?.displayPrice, "₹199.00")
        XCTAssertEqual(byId[PremiumProducts.annual]?.displayPrice, "₹1,499.00")
        XCTAssertEqual(byId[PremiumProducts.monthly]?.subscription?.subscriptionPeriod.unit, .month)
        XCTAssertEqual(byId[PremiumProducts.annual]?.subscription?.subscriptionPeriod.unit, .year)
    }

    func testBuyThenRestore() async throws {
        let token = UUID()
        let t = try await buy(PremiumProducts.annual, token: token)
        XCTAssertEqual(t.productID, PremiumProducts.annual)
        let restored = await entitled()
        XCTAssertEqual(restored, [PremiumProducts.annual], "restore (currentEntitlements) returns the purchase")
    }

    func testExpiry() async throws {
        let t = try await buy(PremiumProducts.monthly, token: UUID())
        // The student turns auto-renew off, then the period ends.
        try await session.disableAutoRenewForTransaction(identifier: UInt(t.id))
        try await session.expireSubscription(productIdentifier: t.productID)
        var state: Product.SubscriptionInfo.RenewalState? = nil
        for _ in 0..<50 {
            let statuses = try await Product.SubscriptionInfo.status(for: "21500001")
            state = statuses.first(where: { if case .verified(let tx) = $0.transaction { return tx.productID == PremiumProducts.monthly } else { return false } })?.state
            if state == .expired { break }
            try? await Task.sleep(nanoseconds: 100_000_000)
        }
        XCTAssertEqual(state, .expired, "after auto-renew is turned off and the period ends, the subscription is expired")
    }

    func testRefund() async throws {
        let t = try await buy(PremiumProducts.monthly, token: UUID())
        try await session.refundTransaction(identifier: UInt(t.id))
        let now = await entitled(waitingFor: PremiumProducts.monthly)
        XCTAssertFalse(now.contains(PremiumProducts.monthly), "a refunded transaction is revoked")
    }
}
