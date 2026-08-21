// ─────────────────────────────────────────────────────────────────────────────
// Pri Learning · Rasteriser
//
// Turns a line of ink into the picture Vision reads best, and keeps the map
// back so a recognised character can be traced to the pixels — and from there
// to the strokes — it came from.
//
// Three choices here do most of the work for accuracy:
//
//   · Scale. Vision's accurate path wants text tens of pixels tall. A student
//     writing small on an 11" iPad produces glyphs around 30pt; every line is
//     rescaled so its typical glyph lands at `targetGlyphHeight` regardless of
//     how large or small it was written.
//   · Uniform stroke weight. The canvas ink is pressure- and velocity-shaped,
//     which is what makes it look like handwriting and exactly what makes it
//     read badly — a light fast tail can thin to nothing. Recognition is fed a
//     constant-width redraw of the same centreline.
//   · Black on white. The app writes cream on near-black. Vision is trained on
//     documents, so the image is inverted before it ever sees it.
// ─────────────────────────────────────────────────────────────────────────────
import CoreGraphics
import Foundation
import UIKit

struct InkRaster {
    let image: CGImage
    /// Ink-space (canvas CSS px) → image-space mapping: (p - origin) * scale.
    let origin: CGPoint
    let scale: CGFloat
    let pixelWidth: Int
    let pixelHeight: Int

    /// Vision reports normalised rects with the origin at the bottom left.
    /// This lands them back on the canvas the student wrote on.
    func inkRect(fromNormalized rect: CGRect) -> CGRect {
        let w = CGFloat(pixelWidth), h = CGFloat(pixelHeight)
        let imageRect = CGRect(
            x: rect.minX * w,
            y: (1 - rect.maxY) * h,
            width: rect.width * w,
            height: rect.height * h
        )
        return CGRect(
            x: imageRect.minX / scale + origin.x,
            y: imageRect.minY / scale + origin.y,
            width: imageRect.width / scale,
            height: imageRect.height / scale
        )
    }
}

enum InkRasterizer {

    /// Height a typical glyph is scaled to before recognition.
    static let targetGlyphHeight: CGFloat = 76

    /// Ceiling on either dimension. A long line of working scales down rather
    /// than allocating an image that would cost more to make than to read.
    private static let maxPixels: CGFloat = 3600

    /// The canvas is never narrower than this, nor squarer than this ratio —
    /// see the note in `render`.
    private static let minimumWidth: CGFloat = 560
    private static let minimumAspect: CGFloat = 3.0

    static func render(strokes: [InkStroke], glyphHeight: CGFloat) -> InkRaster? {
        guard !strokes.isEmpty else { return nil }

        var inkBounds = strokes[0].bounds
        for stroke in strokes.dropFirst() { inkBounds = inkBounds.union(stroke.bounds) }
        guard inkBounds.width.isFinite, inkBounds.height.isFinite else { return nil }

        var scale = targetGlyphHeight / max(glyphHeight, 1)
        // Quiet margin. Vision treats ink that runs to the edge as clipped
        // text and drops confidence for it, so every line gets air around it.
        let padY = 0.55 * targetGlyphHeight

        // A LINE-SHAPED canvas, even for a two-mark line. Vision's detector is
        // looking for lines of text, and "= 0" alone in a near-square picture
        // was read as no text at all — three times over, at every size and
        // both models — while the same ink with white space either side reads
        // straight away. The padding is empty; the shape is the point.
        func measure(_ padX: CGFloat) -> (CGFloat, CGFloat) {
            (inkBounds.width * scale + padX * 2, inkBounds.height * scale + padY * 2)
        }
        var padX = padY
        var (width, height) = measure(padX)
        let wanted = max(minimumWidth, minimumAspect * height)
        if width < wanted {
            padX += (wanted - width) / 2
            (width, height) = measure(padX)
        }
        if max(width, height) > maxPixels {
            let shrink = maxPixels / max(width, height)
            scale *= shrink
            padX *= shrink
            (width, height) = measure(padX)
        }

        let pixelWidth = max(16, Int(width.rounded(.up)))
        let pixelHeight = max(16, Int(height.rounded(.up)))

        let colorSpace = CGColorSpaceCreateDeviceGray()
        guard let context = CGContext(
            data: nil,
            width: pixelWidth,
            height: pixelHeight,
            bitsPerComponent: 8,
            bytesPerRow: 0,
            space: colorSpace,
            bitmapInfo: CGImageAlphaInfo.none.rawValue
        ) else { return nil }

        context.setFillColor(gray: 1, alpha: 1)
        context.fill(CGRect(x: 0, y: 0, width: pixelWidth, height: pixelHeight))

        // Ink space is y-down (it came from the DOM); Core Graphics is y-up.
        context.translateBy(x: 0, y: CGFloat(pixelHeight))
        context.scaleBy(x: 1, y: -1)

        context.setStrokeColor(gray: 0, alpha: 1)
        context.setFillColor(gray: 0, alpha: 1)
        context.setLineCap(.round)
        context.setLineJoin(.round)
        context.setShouldAntialias(true)
        // Proportional to the glyph size, so a large hand and a small hand
        // arrive at Vision with the same stroke-weight-to-height ratio.
        context.setLineWidth(max(2.5, 0.085 * targetGlyphHeight))

        let origin = CGPoint(x: inkBounds.minX - padX / scale,
                             y: inkBounds.minY - padY / scale)
        let map = { (p: InkPoint) -> CGPoint in
            CGPoint(x: (p.x - origin.x) * scale, y: (p.y - origin.y) * scale)
        }

        for stroke in strokes {
            let points = stroke.points
            guard let first = points.first else { continue }
            if points.count == 1 {
                let c = map(first)
                let r = max(1.5, 0.045 * targetGlyphHeight)
                context.fillEllipse(in: CGRect(x: c.x - r, y: c.y - r, width: r * 2, height: r * 2))
                continue
            }
            // Midpoint quadratics: the same curve the canvas draws, so the
            // shape Vision reads is the shape the student watched appear.
            context.beginPath()
            context.move(to: map(first))
            for i in 1..<(points.count - 1) {
                let current = map(points[i])
                let next = map(points[i + 1])
                context.addQuadCurve(
                    to: CGPoint(x: (current.x + next.x) / 2, y: (current.y + next.y) / 2),
                    control: current
                )
            }
            context.addLine(to: map(points[points.count - 1]))
            context.strokePath()
        }

        guard let image = context.makeImage() else { return nil }
        return InkRaster(image: image, origin: origin, scale: scale,
                         pixelWidth: pixelWidth, pixelHeight: pixelHeight)
    }
}
