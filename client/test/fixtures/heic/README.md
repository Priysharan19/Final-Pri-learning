# HEIC fixtures

Tiny synthetic images, generated on macOS with ImageIO (`CGImageDestination`, `public.heic`) from a
white rectangle with a coloured left quarter. They contain no photograph and no person's data; they
are original to this repository and carry no third-party licence.

- `landscape-160x80.heic` — one image, 160×80, orientation normal.
- `rotated-orient6-160x80.heic` — the same 160×80 raster stored with a 90° rotation: a decoder that
  applies the file's own rotation yields 80×160 (an iPhone held upright).
- `burst-two-images.heic` — two images in one file (160×80 then 64×64): the first is taken.
