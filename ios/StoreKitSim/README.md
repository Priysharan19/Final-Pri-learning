# Pri Premium: StoreKit Testing on the simulator (SIMULATOR EVIDENCE)

**SIMULATOR evidence only.** Nothing here reaches the App Store, the sandbox or any money. `SKTestSession` answers every StoreKit call from the local `Tests/PriPremium.storekit` file. These are not real purchases and not sandbox purchases.

- **`Tests/PriPremium.storekit`**: the subscription group "Pri Premium" with `com.prilearning.app.premium.monthly` (₹199, P1M) and `com.prilearning.app.premium.annual` (₹1,499, P1Y), storefront IND.
- **`PriStoreKitSim.xcodeproj`**: a minimal host app (StoreKit Testing needs one) and a hosted unit-test target. It is never shipped and is separate from the app packages in `ios/PriLearning*.swiftpm`.
- **`Tests/PremiumFlowTests.swift`** drives the StoreKit 2 calls `StoreKitBillingBridge.swift` makes. It does not load the bridge class itself, which lives inside the app package and needs a WKWebView.

| Test | Proves |
|---|---|
| `testProductsAndPrices` | both products load, with display prices ₹199.00 and ₹1,499.00 and month / year periods |
| `testBuyThenRestore` | a purchase carries the server-issued `appAccountToken` and a signed JWS; restore (`Transaction.currentEntitlements`) returns it |
| `testExpiry` | after auto-renew is turned off and the period ends, the subscription state is `.expired` |
| `testRefund` | a refunded transaction is revoked and drops out of restore |

**Run:**

```sh
xcodebuild test -project ios/StoreKitSim/PriStoreKitSim.xcodeproj -scheme PriStoreKitSimTests -destination 'platform=iOS Simulator,name=<an existing iPhone simulator>'
```

**Recorded run:** 2026-11-09, Xcode 27.2, an iPhone 16 simulator (iOS 17 deployment target): **4/4 tests passed, 0 failures.**

**Limits, stated:**
- Purchases go through `SKTestSession.buyProduct`. `Product.purchase()` opens a confirmation sheet that an unattended run cannot press, so the UI purchase path is not covered.
- StoreKit Testing returns the yearly product's numeric `price` as 1 while its `displayPrice` is right, so the paywall's "about … a month" line is not proven here.
- Server verification of these JWS is **not** covered: they are signed by Xcode's local certificate, which production rightly rejects.

Real sandbox purchases stay BLOCKED-EXTERNAL until Paid Apps is Active, the prices are set and staging billing is configured.
