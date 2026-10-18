// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Status-bar ink from the page's own paper
//
// On iPhone the page runs under the status bar (PriLearningApp.swift), so the
// clock and battery are drawn on Pri's paper, not on a native backdrop. Pri's
// theme is the profile's choice (paper, night or follow the device) and can
// differ from the device's appearance: dark ink must go on paper and light ink
// on night, whatever the device is set to. The page states its paper as the
// theme-color meta (client/src/lib/theme.js THEME_CHROME), which WebKit exposes
// as WKWebView.themeColor; this maps that colour to a tone. Foundation only, so
// client/test/ios-status-bar-check.mjs can compile and run it on its own.
// ─────────────────────────────────────────────────────────────────────────────
import Foundation

/// The page's paper as the status bar needs to know it.
enum PageTone: String, Equatable {
    /// Light paper: the status bar draws dark ink.
    case light
    /// Night: the status bar draws light ink.
    case dark
}

enum StatusBarAppearance {
    /// WCAG relative luminance of an sRGB colour with components in 0…1.
    static func luminance(red: Double, green: Double, blue: Double) -> Double {
        func linear(_ c: Double) -> Double {
            let v = min(max(c, 0), 1)
            return v <= 0.04045 ? v / 12.92 : pow((v + 0.055) / 1.055, 2.4)
        }
        return 0.2126 * linear(red) + 0.7152 * linear(green) + 0.0722 * linear(blue)
    }

    /// Black text and white text have equal contrast on a background of
    /// luminance ≈ 0.179; above it dark ink reads better, below it light ink.
    static let crossover = 0.179

    static func tone(red: Double, green: Double, blue: Double) -> PageTone {
        luminance(red: red, green: green, blue: blue) > crossover ? .light : .dark
    }
}
