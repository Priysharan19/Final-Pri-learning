// swift-tools-version: 5.9

// Pri Learning — native iPad app.
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
            displayVersion: "4.0",
            bundleVersion: "2",
            appIcon: .asset("AppIcon"),
            accentColor: .presetColor(.orange),
            supportedDeviceFamilies: [
                .pad,
                .phone
            ],
            supportedInterfaceOrientations: [
                .portrait,
                .landscapeRight,
                .landscapeLeft,
                .portraitUpsideDown(.when(deviceFamilies: [.pad]))
            ],
            capabilities: [
                .camera(purposeString: "Photograph handwritten maths so Pri can read it on-device and attach it to your attempt.")
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
                // A validated PriInkFoundation.mlpackage is exported here. The
                // directory exists even in development builds where no learned
                // asset has been promoted yet, so handwriting can fall back to
                // the current local engine without changing the package graph.
                .copy("Resources/Models")
            ]
        )
    ]
)
