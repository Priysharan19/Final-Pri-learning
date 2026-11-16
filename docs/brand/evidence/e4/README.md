# E4 visual evidence: edition brands

**What these are:** synthetic browser captures of real production builds. Each edition was built with `PRI_EDITION=priyabhata` or `PRI_EDITION=prithagoras` at the commit that added this folder. Playwright Chromium drove the builds, and `client/test/support/mock-account.mjs` stood in for the account server, so a student account could be signed in. Light and dark come from `prefers-color-scheme`. Each width was captured at device scale 2.

**What they are not:** evidence from a physical iPhone, iPad or Android device, or from the native shells. The native icons, display names and bundle IDs are not changed by E4.

**Regenerate:** `tools/brand/capture-evidence.mjs` (usage in its header).

| | Priyabhata | Prithagoras |
|---|---|---|
| Sign-in, light, phone (390) | `priyabhata-signin-light-phone.png` | `prithagoras-signin-light-phone.png` |
| Sign-in, dark, phone | `priyabhata-signin-dark-phone.png` | `prithagoras-signin-dark-phone.png` |
| Sign-in, light, iPad (1024) | `priyabhata-signin-light-ipad.png` | `prithagoras-signin-light-ipad.png` |
| Sign-in, dark, iPad | `priyabhata-signin-dark-ipad.png` | `prithagoras-signin-dark-ipad.png` |
| Header (Index), light, phone | `priyabhata-header-light-phone.png` | `prithagoras-header-light-phone.png` |
| Header, dark, phone | `priyabhata-header-dark-phone.png` | `prithagoras-header-dark-phone.png` |
| Header, light, iPad | `priyabhata-header-light-ipad.png` | `prithagoras-header-light-ipad.png` |
| Header, dark, iPad | `priyabhata-header-dark-ipad.png` | `prithagoras-header-dark-ipad.png` |
| App icons, light (PWA 512, maskable, favicon, iOS source) | `priyabhata-icon-light.png` | `prithagoras-icon-light.png` |
| App icons, dark (iOS dark and tinted sources, favicon in dark, PWA) | `priyabhata-icon-dark.png` | `prithagoras-icon-dark.png` |
| Settings → About, light / dark (iPad) | `priyabhata-about-{light,dark}.png` | `prithagoras-about-{light,dark}.png` |

The Prithagoras sign-in still shows the India kicker, the India description and "Pri account" in its copy. That is course content and wording, not brand. E2/E3 (sign-up course defaults) and an owner wording decision cover it.
