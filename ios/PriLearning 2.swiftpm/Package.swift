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
            appIcon: .placeholder(icon: .calculator),
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
                .camera(purposeString: "Attach a photo of your paper working to a saved attempt.")
            ],
            appCategory: .education
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
                .copy("Resources/Web")
            ]
        )
    ]
)
