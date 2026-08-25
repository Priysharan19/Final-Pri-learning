export function decodePng(buf: Buffer): { w: number; h: number; rgb: Uint8Array };
export function encodePngRGB(w: number, h: number, rgb: Uint8Array): Buffer;
export function resizeRGB(w: number, h: number, rgb: Uint8Array, tw: number, th: number): Uint8Array;
