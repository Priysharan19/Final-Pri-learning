// A question stem is authored with real line breaks ("Line 1: …\n\nLine 2: …").
// HTML collapses a newline to a space, so the lines ran together into one paragraph.
// This turns the breaks into markup on the already-escaped text segments of MathText.
export function breaksToHtml(escaped) {
  return String(escaped)
    .replace(/[ \t]*\n[ \t]*(?:\n[ \t]*)+/g, '<span class="mt-par"></span>')
    .replace(/[ \t]*\n[ \t]*/g, '<br>');
}
