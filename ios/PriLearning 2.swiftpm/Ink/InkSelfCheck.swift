// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Native ink self-check
//
// Scores the NATIVE reading pipeline end to end — segmentation, rasterising,
// Vision, the maths decode, powers, fractions, assembly — against expressions
// whose answer is known.
//
// A word on what this number is and is not. The ink is written from the same
// glyph shapes the web engine kept as templates, so it is synthetic, and a
// synthetic score is worth much less than a real one. It is worth something
// here for a reason it was NOT worth anything for the old engine: Vision has
// never seen these shapes. The web engine was scored against jittered copies
// of the very templates it matched against, which measures the generator; this
// measures a reader that has no relationship to the generator at all.
//
// It still does not tell you how the app reads YOUR handwriting. Only writing
// on the thing does that. What it does tell you is whether the pipeline holds
// together: whether powers land as powers, whether a times sign is told from
// an x, whether a stacked fraction comes back as one, whether a line survives.
//
// Run:  xcrun simctl launch <device> com.prilearning.app --ink-selfcheck
// Read: xcrun simctl spawn <device> log show --last 2m \
//         --predicate 'eventMessage CONTAINS "PRIINK"' --style compact
// ─────────────────────────────────────────────────────────────────────────────
import CoreGraphics
import Foundation

enum InkSelfCheck {

    /// One variant per symbol, lifted from client/src/ink/templates.js — the
    /// shapes this project already decided were representative handwriting.
    /// Each stroke is a polyline in a 0–100 box.
    private static let font: [String: [[Double]]] = [
        "0": [[50.0,6.0, 63.0,9.8, 73.8,20.6, 80.4,36.4, 81.8,54.6, 77.7,72.0, 68.8,85.6, 56.7,93.0, 43.3,93.0, 31.2,85.6, 22.3,72.0, 18.2,54.6, 19.6,36.4, 26.2,20.6, 37.0,9.8, 50.0,6.0]],
        "1": [[52.0,8.0, 51.6,15.6, 51.3,23.3, 50.9,30.9, 50.5,38.5, 50.2,46.2, 49.8,53.8, 49.5,61.5, 49.1,69.1, 48.7,76.7, 48.4,84.4, 48.0,92.0]],
        "2": [[23.6,19.2, 32.9,9.7, 47.5,6.0, 62.3,9.3, 72.1,18.4, 66.0,38.0, 56.7,49.1, 47.3,60.2, 38.0,71.3, 28.7,82.4, 24.0,88.0, 38.9,88.0, 53.7,88.0, 68.6,88.0, 76.0,88.0]],
        "3": [[26.9,18.0, 35.3,10.5, 46.7,8.0, 57.9,11.2, 65.7,19.1, 67.9,29.6, 52.5,48.3, 63.9,52.6, 71.6,60.8, 74.0,71.2, 70.3,81.3, 61.6,88.8, 49.7,92.0, 43.5,91.7]],
        "4": [[58.0,8.0, 54.9,13.8, 51.8,19.6, 48.7,25.3, 45.6,31.1, 42.4,36.9, 39.3,42.7, 36.2,48.4, 33.1,54.2, 30.0,60.0], [30.0,60.0, 36.9,60.0, 43.7,60.0, 50.6,60.0, 57.4,60.0, 64.3,60.0, 71.1,60.0, 78.0,60.0], [64.0,30.0, 63.8,35.8, 63.6,41.6, 63.5,47.5, 63.3,53.3, 63.1,59.1, 62.9,64.9, 62.7,70.7, 62.5,76.5, 62.4,82.4, 62.2,88.2, 62.0,94.0]],
        "5": [[68.0,12.0, 55.2,12.0, 42.4,12.0, 36.0,12.0, 35.1,21.1, 34.3,30.3, 33.4,39.4, 34.6,45.6, 46.8,40.2, 60.0,42.2, 70.1,50.9, 74.0,63.7, 70.5,76.6, 60.6,85.5, 54.2,87.6]],
        "6": [[62.0,10.0, 57.3,16.9, 52.5,23.8, 47.8,30.7, 43.1,37.6, 38.4,44.5, 30.7,79.0, 28.8,61.7, 39.0,48.3, 54.8,47.3, 66.4,59.3, 66.4,76.7, 54.8,88.7, 39.0,87.7, 32.7,82.1]],
        "7": [[24.0,14.0, 31.1,13.7, 38.3,13.4, 45.4,13.1, 52.6,12.9, 59.7,12.6, 66.9,12.3, 74.0,12.0, 74.0,12.0, 71.1,19.3, 68.2,26.5, 65.3,33.8, 62.4,41.1, 59.5,48.4, 56.5,55.6, 53.6,62.9, 50.7,70.2, 47.8,77.5, 44.9,84.7, 42.0,92.0]],
        "8": [[50.0,10.0, 32.7,20.0, 32.7,40.0, 50.0,50.0, 67.3,40.0, 67.3,20.0, 41.8,51.3, 63.9,54.1, 74.0,72.3, 63.4,90.3, 41.2,92.5, 26.6,77.0, 32.3,57.2, 43.2,11.2, 47.7,10.1, 50.0,10.0]],
        "9": [[70.0,32.0, 67.5,42.2, 60.5,50.1, 50.7,53.8, 40.2,52.6, 31.5,46.6, 26.6,37.3, 26.6,26.7, 31.5,17.4, 40.2,11.4, 50.7,10.2, 60.5,13.9, 67.5,21.8, 70.0,32.0, 70.0,32.0, 69.1,38.7, 68.2,45.3, 67.3,52.0, 66.4,58.7, 65.6,65.3, 64.7,72.0, 63.8,78.7, 62.9,85.3, 62.0,92.0]],
        "+": [[50.0,22.0, 50.0,28.4, 50.0,34.9, 50.0,41.3, 50.0,47.8, 50.0,54.2, 50.0,60.7, 50.0,67.1, 50.0,73.6, 50.0,80.0], [22.0,50.0, 28.4,50.0, 34.9,50.0, 41.3,50.0, 47.8,50.0, 54.2,50.0, 60.7,50.0, 67.1,50.0, 73.6,50.0, 80.0,50.0]],
        "-": [[20.0,50.0, 26.9,50.0, 33.8,50.0, 40.7,50.0, 47.6,50.0, 54.4,50.0, 61.3,50.0, 68.2,50.0, 75.1,50.0, 82.0,50.0]],
        "=": [[22.0,38.0, 28.4,37.8, 34.9,37.6, 41.3,37.3, 47.8,37.1, 54.2,36.9, 60.7,36.7, 67.1,36.4, 73.6,36.2, 80.0,36.0], [22.0,62.0, 28.4,61.8, 34.9,61.6, 41.3,61.3, 47.8,61.1, 54.2,60.9, 60.7,60.7, 67.1,60.4, 73.6,60.2, 80.0,60.0]],
        "(": [[42.8,79.6, 39.8,75.6, 37.3,71.4, 35.2,66.9, 33.6,62.2, 32.6,57.4, 32.1,52.5, 32.1,47.5, 32.6,42.6, 33.6,37.8, 35.2,33.1, 37.3,28.6, 39.8,24.4, 42.8,20.4]],
        ")": [[57.2,79.6, 60.2,75.6, 62.7,71.4, 64.8,66.9, 66.4,62.2, 67.4,57.4, 67.9,52.5, 67.9,47.5, 67.4,42.6, 66.4,37.8, 64.8,33.1, 62.7,28.6, 60.2,24.4, 57.2,20.4]],
        ".": [[54.0,84.0, 52.5,87.1, 49.1,87.9, 46.4,85.7, 46.4,82.3, 49.1,80.1, 52.5,80.9, 54.0,84.0]],
        "/": [[74.0,10.0, 69.6,17.3, 65.3,24.5, 60.9,31.8, 56.5,39.1, 52.2,46.4, 47.8,53.6, 43.5,60.9, 39.1,68.2, 34.7,75.5, 30.4,82.7, 26.0,90.0]],
        "a": [[64.8,66.2, 60.2,74.9, 53.1,80.4, 44.7,81.9, 36.5,79.1, 30.0,72.4, 26.5,63.1, 26.5,52.9, 30.0,43.6, 36.5,36.9, 44.7,34.1, 53.1,35.6, 60.2,41.1, 64.8,49.8, 66.0,40.0, 66.3,46.9, 66.6,53.7, 66.9,60.6, 67.1,67.4, 67.4,74.3, 67.7,81.1, 68.0,88.0]],
        "b": [[32.0,8.0, 32.0,15.3, 32.0,22.5, 32.0,29.8, 32.0,37.1, 32.0,44.4, 32.0,51.6, 32.0,58.9, 32.0,66.2, 32.0,73.5, 32.0,80.7, 32.0,88.0, 31.1,72.8, 30.0,66.0, 31.1,59.2, 34.2,53.1, 39.0,48.7, 44.9,46.3, 51.1,46.3, 57.0,48.7, 61.8,53.1, 64.9,59.2, 66.0,66.0, 64.9,72.8]],
        "c": [[75.2,81.1, 66.2,86.6, 56.2,87.9, 46.4,85.1, 38.0,78.3, 31.7,68.3, 28.4,56.3, 28.4,43.7, 31.7,31.7, 38.0,21.7, 46.4,14.9, 56.2,12.1, 66.2,13.4, 75.2,18.9]],
        "d": [[60.9,69.5, 55.8,78.6, 47.7,83.5, 38.7,83.0, 31.0,77.2, 26.6,67.5, 26.6,56.5, 31.0,46.8, 38.7,41.0, 47.7,40.5, 55.8,45.4, 60.9,54.5, 60.0,8.0, 60.1,15.3, 60.2,22.5, 60.3,29.8, 60.4,37.1, 60.5,44.4, 60.5,51.6, 60.6,58.9, 60.7,66.2, 60.8,73.5, 60.9,80.7, 61.0,88.0]],
        "e": [[32.0,56.0, 37.7,55.3, 43.3,54.7, 49.0,54.0, 54.7,53.3, 60.3,52.7, 66.0,52.0, 66.0,56.0, 65.1,49.0, 62.4,42.8, 58.2,37.9, 53.0,34.9, 47.3,34.0, 41.6,35.4, 36.6,39.0, 32.8,44.2, 30.5,50.7, 30.1,57.8, 31.4,64.6, 34.5,70.6, 39.0,75.1]],
        "f": [[68.0,9.0, 64.3,7.6, 60.3,7.0, 56.4,7.4, 52.6,8.7, 49.3,10.8, 46.7,13.7, 44.9,17.0, 44.1,20.7, 44.0,26.0, 44.0,32.9, 44.0,39.8, 44.0,46.7, 44.0,53.6, 44.0,60.4, 44.0,67.3, 44.0,74.2, 44.0,81.1, 44.0,88.0], [28.0,44.0, 34.8,44.0, 41.6,44.0, 48.4,44.0, 55.2,44.0, 62.0,44.0]],
        "g": [[61.3,39.1, 65.7,55.2, 56.5,69.0, 39.9,71.1, 27.6,59.8, 28.0,43.2, 41.0,32.6, 66.0,36.0, 66.0,52.0, 66.0,68.0, 66.0,84.0, 66.0,92.0, 62.9,99.9, 54.6,105.0, 44.0,105.6, 39.0,104.1]],
        "h": [[32.0,10.0, 32.0,25.6, 32.0,41.2, 32.0,56.8, 32.0,72.4, 32.0,88.0, 32.7,56.7, 38.0,47.9, 46.8,44.1, 56.0,46.4, 64.0,61.3, 64.0,72.0, 64.0,82.7, 64.0,88.0]],
        "i": [[50.0,38.0, 50.0,44.3, 50.0,50.5, 50.0,56.8, 50.0,63.0, 50.0,69.3, 50.0,75.5, 50.0,81.8, 50.0,88.0], [53.5,22.0, 51.8,25.0, 48.3,25.0, 46.5,22.0, 48.3,19.0, 51.8,19.0, 53.5,22.0]],
        "k": [[30.0,8.0, 30.0,15.5, 30.0,22.9, 30.0,30.4, 30.0,37.8, 30.0,45.3, 30.0,52.7, 30.0,60.2, 30.0,67.6, 30.0,75.1, 30.0,82.5, 30.0,90.0], [68.0,30.0, 62.4,34.0, 56.9,38.0, 51.3,42.0, 45.7,46.0, 40.1,50.0, 34.6,54.0, 29.0,58.0, 38.0,52.0, 42.9,57.4, 47.7,62.9, 52.6,68.3, 57.4,73.7, 62.3,79.1, 67.1,84.6, 72.0,90.0]],
        "l": [[48.0,12.0, 48.0,19.2, 48.0,26.4, 48.0,33.6, 48.0,40.8, 48.0,48.0, 48.0,55.2, 48.0,62.4, 48.0,69.6, 48.0,76.8, 48.0,84.0, 48.0,84.0, 48.6,87.1, 50.3,89.7, 52.9,91.4, 56.0,92.0]],
        "m": [[24.0,88.0, 24.0,74.3, 24.0,60.6, 24.0,46.9, 24.0,52.0, 27.3,42.0, 35.3,38.0, 43.1,42.5, 46.0,52.0, 46.0,66.4, 46.0,80.8, 46.0,52.0, 49.3,42.0, 57.3,38.0, 65.1,42.5, 68.0,56.0, 68.0,68.8, 68.0,81.6, 68.0,88.0]],
        "n": [[30.0,30.0, 30.0,42.9, 30.0,55.8, 30.0,68.7, 30.0,81.6, 30.0,50.0, 30.0,40.0, 30.9,45.9, 37.3,36.0, 47.7,32.0, 58.2,35.5, 64.9,45.2, 66.0,62.3, 66.0,70.9, 66.0,79.4, 66.0,88.0]],
        "o": [[50.0,36.0, 58.7,37.8, 66.2,42.8, 71.5,50.4, 73.9,59.6, 73.1,69.1, 69.2,77.7, 62.6,84.1, 54.4,87.6, 45.6,87.6, 37.4,84.1, 30.8,77.7, 26.9,69.1, 26.1,59.6, 28.5,50.4, 33.8,42.8, 41.3,37.8, 50.0,36.0]],
        "p": [[34.0,36.0, 34.0,42.7, 34.0,49.3, 34.0,56.0, 34.0,62.7, 34.0,69.3, 34.0,76.0, 34.0,82.7, 34.0,89.3, 34.0,96.0], [34.0,57.8, 33.1,50.5, 35.3,43.5, 40.2,38.1, 47.0,35.3, 54.4,35.6, 60.9,39.0, 65.4,44.8, 67.0,52.0, 65.4,59.2, 60.9,65.0, 54.4,68.4, 47.0,68.7]],
        "q": [[60.6,41.1, 64.8,57.2, 55.9,71.0, 40.2,73.1, 28.5,61.8, 28.9,45.2, 41.2,34.6, 65.0,36.0, 65.0,52.6, 65.0,69.1, 65.0,85.7, 65.0,94.0, 72.3,86.0, 76.0,82.0]],
        "r": [[34.0,88.0, 34.0,81.5, 34.0,75.0, 34.0,68.5, 34.0,62.0, 34.0,55.5, 34.0,49.0, 34.0,42.5, 34.0,36.0, 33.0,50.0, 33.8,45.5, 36.1,41.4, 39.7,38.1, 44.2,35.9, 49.3,35.0, 54.4,35.5, 59.1,37.3, 63.0,40.4]],
        "s": [[66.0,20.0, 56.0,12.0, 42.0,12.0, 32.0,20.0, 32.0,32.0, 42.0,42.0, 56.0,48.0, 66.0,56.0, 68.0,70.0, 60.0,84.0, 44.0,90.0, 30.0,84.0, 26.0,74.0]],
        "t": [[50.0,8.0, 50.0,15.3, 50.0,22.5, 50.0,29.8, 50.0,37.1, 50.0,44.4, 50.0,51.6, 50.0,58.9, 50.0,66.2, 50.0,73.5, 50.0,80.7, 50.0,88.0], [28.0,34.0, 34.6,33.7, 41.1,33.4, 47.7,33.1, 54.3,32.9, 60.9,32.6, 67.4,32.3, 74.0,32.0]],
        "u": [[30.0,32.0, 30.0,37.0, 30.0,42.0, 30.0,47.0, 30.0,52.0, 30.0,57.0, 30.0,62.0, 30.0,62.0, 31.0,54.5, 33.7,47.9, 38.0,42.9, 43.2,40.3, 48.8,40.3, 54.0,42.9, 58.3,47.9, 61.0,54.5, 62.0,62.0, 62.0,62.0, 62.5,68.5, 63.0,75.0, 63.5,81.5, 64.0,88.0]],
        "v": [[28.0,30.0, 30.8,37.3, 33.5,44.5, 36.3,51.8, 39.0,59.0, 41.8,66.3, 44.5,73.5, 47.3,80.8, 50.0,88.0, 50.0,88.0, 53.0,80.8, 56.0,73.5, 59.0,66.3, 62.0,59.0, 65.0,51.8, 68.0,44.5, 71.0,37.3, 74.0,30.0]],
        "w": [[24.0,32.0, 28.0,50.0, 32.0,68.0, 36.0,86.0, 38.3,79.0, 43.0,65.0, 47.7,51.0, 50.0,44.0, 54.7,58.0, 59.3,72.0, 64.0,86.0, 66.3,77.0, 71.0,59.0, 75.7,41.0, 78.0,32.0]],
        "x": [[28.0,20.0, 33.1,27.6, 38.2,35.1, 43.3,42.7, 48.4,50.2, 53.6,57.8, 58.7,65.3, 63.8,72.9, 68.9,80.4, 74.0,88.0], [74.0,22.0, 68.7,29.1, 63.3,36.2, 58.0,43.3, 52.7,50.4, 47.3,57.6, 42.0,64.7, 36.7,71.8, 31.3,78.9, 26.0,86.0]],
        "y": [[28.0,14.0, 31.1,19.9, 34.3,25.7, 37.4,31.6, 40.6,37.4, 43.7,43.3, 46.9,49.1, 50.0,55.0], [74.0,14.0, 70.9,21.5, 67.8,28.9, 64.7,36.4, 61.6,43.8, 58.5,51.3, 55.5,58.7, 52.4,66.2, 49.3,73.6, 46.2,81.1, 43.1,88.5, 40.0,96.0]],
        "z": [[26.0,32.0, 39.7,31.4, 53.4,30.9, 67.1,30.3, 74.0,30.0, 62.0,44.5, 50.0,59.0, 38.0,73.5, 26.0,88.0, 33.1,87.7, 47.4,87.1, 61.7,86.6, 76.0,86.0]],
        "pi": [[20.0,32.0, 27.1,31.8, 34.2,31.6, 41.3,31.3, 48.4,31.1, 55.6,30.9, 62.7,30.7, 69.8,30.4, 76.9,30.2, 84.0,30.0], [36.0,32.0, 35.6,38.2, 35.1,44.4, 34.7,50.7, 34.2,56.9, 33.8,63.1, 33.3,69.3, 32.9,75.6, 32.4,81.8, 32.0,88.0], [64.0,32.0, 63.8,38.0, 63.5,44.0, 63.3,50.0, 63.0,56.0, 62.8,62.0, 62.5,68.0, 62.3,74.0, 62.0,80.0, 62.0,80.0, 63.1,84.0, 66.0,86.9, 70.0,88.0]],
        "theta": [[50.0,8.0, 59.4,10.8, 67.5,19.0, 73.3,31.3, 75.9,46.1, 75.0,61.5, 70.7,75.3, 63.7,85.7, 54.8,91.3, 45.2,91.3, 36.3,85.7, 29.3,75.3, 25.0,61.5, 24.1,46.1, 26.7,31.3, 32.5,19.0, 40.6,10.8, 50.0,8.0], [28.0,50.0, 34.6,50.0, 41.1,50.0, 47.7,50.0, 54.3,50.0, 60.9,50.0, 67.4,50.0, 74.0,50.0]],
        "sqrt": [[16.0,58.0, 20.0,67.1, 24.0,76.3, 28.0,85.4, 30.0,90.0, 33.1,73.6, 36.2,57.1, 39.3,40.7, 42.4,24.2, 44.0,16.0, 54.7,15.6, 65.3,15.1, 76.0,14.7, 86.7,14.2, 92.0,14.0]]
    ]

    // MARK: - Writing

    struct Pen {
        var x: CGFloat = 40
        var baseline: CGFloat = 90
        var emHeight: CGFloat = 46
        var slant: CGFloat = 0.10          // a consistent hand leans
        var jitter: CGFloat = 0.9          // nobody draws a clean polyline
        var seed: UInt64 = 0x5EED

        mutating func noise() -> CGFloat {
            seed = seed &* 6364136223846793005 &+ 1442695040888963407
            return (CGFloat((seed >> 33) % 2000) / 1000 - 1) * jitter
        }
    }

    /// Lay a glyph down at the pen's position and advance it.
    private static func write(_ symbol: String, pen: inout Pen, scale: CGFloat, rise: CGFloat) -> [InkStroke] {
        guard let outline = font[symbol] else { return [] }
        let height = pen.emHeight * scale
        let width = height * 0.62
        let top = pen.baseline - rise - height
        var strokes: [InkStroke] = []
        for polyline in outline {
            var points: [InkPoint] = []
            var i = 0
            while i + 1 < polyline.count {
                let ux = CGFloat(polyline[i]) / 100
                let uy = CGFloat(polyline[i + 1]) / 100
                let y = top + uy * height
                // Slant is applied about the baseline, the way a hand leans.
                let x = pen.x + ux * width + pen.slant * (pen.baseline - y)
                points.append(InkPoint(x: x + pen.noise(), y: y + pen.noise(), w: 3))
                i += 2
            }
            if points.count >= 2 { strokes.append(InkStroke(points: points)) }
        }
        pen.x += width + height * 0.16
        return strokes
    }

    /// Write a source expression as ink. `^` raises what follows (one glyph,
    /// or a bracketed run), and a space widens the gap the way working does
    /// around an equals sign.
    static func ink(for source: String, pen: inout Pen) -> [InkStroke] {
        var strokes: [InkStroke] = []
        let characters = Array(source)
        var index = 0
        while index < characters.count {
            let ch = characters[index]
            if ch == " " { pen.x += pen.emHeight * 0.30; index += 1; continue }
            if ch == "^" {
                index += 1
                var run: [Character] = []
                if index < characters.count, characters[index] == "{" {
                    index += 1
                    while index < characters.count, characters[index] != "}" { run.append(characters[index]); index += 1 }
                    index += 1
                } else if index < characters.count {
                    run.append(characters[index]); index += 1
                }
                for raised in run {
                    strokes += write(String(raised), pen: &pen, scale: 0.55, rise: pen.emHeight * 0.42)
                }
                continue
            }
            // Multi-letter names are written letter by letter, as they are.
            strokes += write(String(ch), pen: &pen, scale: 1, rise: 0)
            index += 1
        }
        return strokes
    }

    /// Numerator over a bar over denominator — the shape a line reader cannot
    /// handle and the fraction pass exists for.
    private static func stackedFraction(numerator: String, denominator: String, pen: inout Pen) -> [InkStroke] {
        let barY = pen.baseline - pen.emHeight * 0.35
        let startX = pen.x

        var top = pen
        top.baseline = barY - pen.emHeight * 0.22
        top.emHeight = pen.emHeight * 0.78
        var strokes = ink(for: numerator, pen: &top)

        var bottom = pen
        bottom.baseline = barY + pen.emHeight * 0.95
        bottom.emHeight = pen.emHeight * 0.78
        strokes += ink(for: denominator, pen: &bottom)

        let endX = max(top.x, bottom.x)
        let bar = (0...14).map { i -> InkPoint in
            let t = CGFloat(i) / 14
            return InkPoint(x: startX - 4 + t * (endX - startX + 8), y: barY, w: 3)
        }
        strokes.append(InkStroke(points: bar))
        pen.x = endX + pen.emHeight * 0.18
        return strokes
    }

    // MARK: - Cases

    private struct Case {
        let name: String
        let expected: String
        let build: (inout Pen) -> [InkStroke]
    }

    private static var cases: [Case] {
        func plain(_ name: String, _ source: String, _ expected: String) -> Case {
            Case(name: name, expected: expected) { pen in ink(for: source, pen: &pen) }
        }
        return [
            plain("cubic",        "y = 2x^3 + 9x^2 - 108x", "y=2x^(3)+9x^(2)-108x"),
            plain("simple",       "x = 3",                  "x=3"),
            plain("quadratic",    "2x^2 - 5x + 3 = 0",      "2x^(2)-5x+3=0"),
            plain("negative",     "x = -4",                 "x=-4"),
            plain("brackets",     "(x + 3)(x - 2) = 0",     "(x+3)(x-2)=0"),
            plain("derivative",   "6x^2 + 18x - 108",       "6x^(2)+18x-108"),
            plain("function",     "sin(x) = 1",             "sin(x)=1"),
            plain("decimal",      "x = 2.5",                "x=2.5"),
            Case(name: "twoLines", expected: "x^(2)+2x\n=0") { pen in
                var strokes = ink(for: "x^2 + 2x", pen: &pen)
                var second = pen
                second.x = 40
                second.baseline = pen.baseline + pen.emHeight * 1.9
                strokes += ink(for: "= 0", pen: &second)
                return strokes
            },
            Case(name: "fraction", expected: "(1)/(2)") { pen in
                stackedFraction(numerator: "1", denominator: "2", pen: &pen)
            }
        ]
    }

    /// The screenshot expression: what the app was reading wrongly before any
    /// of this, laid out to fit the question page's writing area.
    static func demoStrokes() -> [InkStroke] {
        var pen = Pen()
        pen.x = 44
        pen.baseline = 104
        pen.emHeight = 48
        return ink(for: "y = 2x^3 + 9x^2 - 108x", pen: &pen)
    }

    // MARK: - Run

    static func run() {
        let recognizer = MathInkRecognizer()
        var exact = 0
        var totalDistance = 0
        var totalLength = 0

        MathInkRecognizer.trace = ProcessInfo.processInfo.arguments.contains("--ink-trace")
        NSLog("PRIINK ── native ink self-check ─────────────────────────────")
        for testCase in cases {
            var pen = Pen()
            let strokes = testCase.build(&pen)
            MathInkRecognizer.traceLabel = testCase.name
            if MathInkRecognizer.trace { NSLog("PRIINK case %@", testCase.name as NSString) }
            let reading = recognizer.read(strokes: strokes, overrides: [:])
            let got = reading.text
            let distance = editDistance(got, testCase.expected)
            totalDistance += distance
            totalLength += testCase.expected.count
            if got == testCase.expected { exact += 1 }
            NSLog("PRIINK %@ %-11@ strokes=%d  want=%@  got=%@",
                  got == testCase.expected ? "PASS" : "FAIL",
                  testCase.name as NSString, strokes.count,
                  testCase.expected as NSString, got as NSString)
        }
        let accuracy = totalLength == 0 ? 0 : 1 - Double(totalDistance) / Double(totalLength)
        NSLog("PRIINK ── %d/%d exact · character accuracy %.1f%% ──",
              exact, cases.count, accuracy * 100)
        DispatchQueue.main.async { checkBridge() }
    }

    private static func editDistance(_ a: String, _ b: String) -> Int {
        let a = Array(a), b = Array(b)
        if a.isEmpty { return b.count }
        if b.isEmpty { return a.count }
        var previous = Array(0...b.count)
        var current = [Int](repeating: 0, count: b.count + 1)
        for i in 1...a.count {
            current[0] = i
            for j in 1...b.count {
                current[j] = min(previous[j] + 1, current[j - 1] + 1,
                                 previous[j - 1] + (a[i - 1] == b[j - 1] ? 0 : 1))
            }
            swap(&previous, &current)
        }
        return previous[b.count]
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Bridge smoke test
//
// Drives InkBridge with the exact message sequence the page sends — mount,
// tool, strokes in, read — and checks what comes back out. It covers the half
// of the contract the recognition score does not: that the surface mounts and
// positions, that strokes survive the round trip through PencilKit, and that a
// reading is emitted in the shape the reading panel expects.
// ─────────────────────────────────────────────────────────────────────────────
import UIKit
import WebKit

extension InkSelfCheck {

    /// Kept alive for the length of the check — the reading arrives later, on
    /// the main queue, and a bridge that has been released cannot deliver it.
    private static var liveBridge: InkBridge?
    private static var liveContainer: UIView?

    @MainActor
    static func checkBridge() {
        let webView = WKWebView(frame: CGRect(x: 0, y: 0, width: 1024, height: 768))
        let container = UIView(frame: webView.frame)
        container.addSubview(webView)
        let bridge = InkBridge()
        bridge.attach(to: webView, in: container)
        liveBridge = bridge
        liveContainer = container

        var strokeReports = 0
        bridge.onEmit = { payload in
            if payload["type"] as? String == "strokes" {
                strokeReports = (payload["strokes"] as? [Any])?.count ?? 0
            }
            guard payload["type"] as? String == "reading" else { return }
            report(payload, container: container, strokeReports: strokeReports)
            liveBridge = nil
            liveContainer = nil
        }

        bridge.handle([
            "op": "mount",
            "frame": ["x": 60, "y": 220, "w": 880, "h": 380],
            "clip": ["x": 47, "y": 54, "w": 977, "h": 714],
            "scrollX": 0, "scrollY": 0,
            "ink": "#efece1"
        ])
        bridge.handle(["op": "tool", "tool": "pen", "finger": true])

        var pen = Pen()
        let strokes = ink(for: "x = 3", pen: &pen)
        NSLog("PRIINK bridge sending %d strokes, %d points",
              strokes.count, strokes.reduce(0) { $0 + $1.points.count })
        bridge.handle(["op": "setStrokes", "strokes": strokes.map(\.jsonObject)])
        bridge.handle(["op": "recognize", "reqId": 7, "overrides": [String: String]()])
    }

    private static func report(_ reading: [String: Any], container: UIView, strokeReports: Int) {
        let mounted = container.subviews.count == 2 && !container.subviews[1].isHidden
        // The frame is reported in viewport space and the surface sits inside
        // the clip view, so its origin is the difference between the two.
        let positioned = container.subviews[1].subviews.first.map {
            abs($0.frame.minX - (60 - 47)) < 1 && abs($0.frame.minY - (220 - 54)) < 1
                && abs($0.frame.width - 880) < 1 && abs($0.frame.height - 380) < 1
        } ?? false

        let lines = (reading["lines"] as? [[String: Any]]) ?? []
        let symbols = (lines.first?["symbols"] as? [[String: Any]]) ?? []
        let shapeOK = reading["reqId"] as? Int == 7
            && reading["minConf"] is Double
            && reading["margin"] is Double
            && lines.first?["box"] is [String: Any]
            && !symbols.isEmpty
            && symbols.allSatisfy {
                $0["id"] is String && $0["sym"] is String && $0["conf"] is Double
                    && $0["alts"] is [[String: Any]] && $0["box"] is [String: Any]
                    && $0["strokeIdxs"] is [Int]
            }

        NSLog("PRIINK bridge mounted=%@ positioned=%@ strokesBack=%d readShape=%@ read=%@",
              mounted ? "yes" : "NO", positioned ? "yes" : "NO", strokeReports,
              shapeOK ? "ok" : "BAD",
              (reading["text"] as? String ?? "<none>") as NSString)
    }

}
