// Hardware stylus erasing (Android parity).
//
// Android styluses erase with hardware: the flipped eraser end of a USI / Wacom
// pen arrives in Chromium WebView as pointerType 'pen' with the eraser button
// bit (buttons & 32, button === 5), and a Samsung S Pen held with its side
// button down arrives as the barrel button (buttons & 2, button === 2). iPad's
// Apple Pencil reports neither, so this only adds behaviour, never changes it.
//
// A stroke decides once, on pointerdown, whether it erases: a button pressed
// halfway through a stroke does not split it into ink and erasing.
export const ERASER_BUTTON_BIT = 32;
export const BARREL_BUTTON_BIT = 2;

export function penWantsEraser(e) {
  if (!e || e.pointerType !== 'pen') return false;
  const buttons = Number(e.buttons) || 0;
  return (buttons & ERASER_BUTTON_BIT) !== 0 || (buttons & BARREL_BUTTON_BIT) !== 0 ||
    e.button === 5 || e.button === 2;
}
