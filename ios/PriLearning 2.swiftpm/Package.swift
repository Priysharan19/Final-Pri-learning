// swift-tools-version: 5.9

// Pri Learning — native iPhone and iPad app.
// Open this package in Swift Playgrounds 4+ on an iPad (no Mac needed) or in
// Xcode 15+ on a Mac, press Run, and it installs as a full native app.
import PackageDescription
import AppleProductTypes

let package = Package(
    name: "PriLearning",
    platforms: [
        .iOS("16.0")
    ],
    products: [
        .iOSApplication(
            name: "Pri Learning",
            targets: ["AppModule"],
            bundleIdentifier: "com.prilearning.app",
            displayVersion: "1.0",
            bundleVersion: "2",
            appIcon: .asset("AppIcon"),
            accentColor: .presetColor(.orange),
            // V1 ships on iPhone and iPad from this one package (owner scope
            // change #504, docs/release/PRI_V1_RELEASE_SCOPE.md §22). Same
            // bundle id, same prilearning://app origin, same on-device data.
            // Guarded by node scripts/apple-shipping-target.mjs --check-v1.
            supportedDeviceFamilies: [
                .pad,
                .phone
            ],
            supportedInterfaceOrientations: [
                // iPhone is portrait-only (CP-01/CP-04 decision); iPad keeps all four.
                .portrait,
                .landscapeRight(.when(deviceFamilies: [.pad])),
                .landscapeLeft(.when(deviceFamilies: [.pad])),
                .portraitUpsideDown(.when(deviceFamilies: [.pad]))
            ],
            capabilities: [
                .camera(purposeString: "Photograph handwritten maths so Pri can read it and attach it to your attempt. The photo is sent to the Pri server to be read.")
            ],
            appCategory: .education,
            // Xcode/App Store builds supply PRI_CLOUD_ORIGIN as a user-defined
            // build setting. The signed Info.plist is the native transport's
            // only production origin source; an absent/invalid value fails closed.
            additionalInfoPlistContentFilePath: "Info.plist"
        )
    ],
    targets: [
        .executableTarget(
            name: "AppModule",
            path: ".",
            exclude: [
                "README.md"
            ],
            resources: [
                .process("Assets.xcassets"),
                .copy("Resources/Web"),
                // Apple privacy manifest; .copy places it at the app bundle root.
                // No model asset ships: handwriting and photos are read on the
                // server (owner decision 2026-10-02, default D16), and the
                // Core ML foundation model left the target with the Vision reader.
                .copy("Resources/PrivacyInfo.xcprivacy")
            ]
        )
    ]
)
