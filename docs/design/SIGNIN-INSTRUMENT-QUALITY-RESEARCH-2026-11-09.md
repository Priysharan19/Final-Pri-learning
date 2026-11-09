# Pri Learning — Sign-in instrument: design research and acceptance contract
*9 November 2026 · L3 review companion to draft PR #777*

## Intent

The founder explicitly requested a futuristic Pri Learning sign-in **without the familiar AI-generated visual clichés**, and rejected three earlier concepts. A premium outcome must feel like a real, precise mathematical instrument **and** an effortless student identity workflow. This research document is a design contract, not a claim of founder approval, academic grading verification, or production readiness.

## Benchmarks reviewed (principles, not assets to copy)

1. **Linear, March 2026 visual refresh** — lower the salience of supporting UI so primary work can dominate. Implication: email entry and recovery are louder than the hero; one primary CTA and predictable alignment. [Behind the latest design refresh](https://linear.app/now/behind-the-latest-design-refresh).
2. **Vercel Web Interface Guidelines** — animate only cause and effect; support interruptible, input-driven motion; use tabular numerals; design all states. Implication: the graph recomputes on a genuine pointer move, not an idle animation; verification states and input geometry stay steady. [Guidelines](https://vercel.com/design/guidelines).
3. **Teenage Engineering OP-1** — hardware-like displays feel modern because visual values correspond to real controls/measurements. Implication: one mathematically exact plot and measured position/tangent, not five unrelated drifting waves. [OP-1 overview](https://teenage.engineering/products/op-1/original/overview).
4. **Apple HIG, Layout (2026)** — spatial relationships, safe areas, adaptable hierarchy, Dynamic Type and progressive disclosure. Implication: separate iPad plot viewport and phone-sized instrument strip; auth control remains reachable after enlargement. [Layout](https://developer.apple.com/design/human-interface-guidelines/layout).
5. **Google web.dev sign-in form best practice** — semantic labels and forms, autofill, mobile keyboard, specific error messages, straightforward recovery and focus. Implication: keep existing real `SignUpFlow` state machine, no new fake sign-in shell. [Sign-in best practices](https://web.dev/articles/sign-in-form-best-practices).
6. **WCAG 2.2 AA** — focus cannot be obscured; pointer targets need 24px/spacing or an exception (the Pri product quality target remains **44px**, which is not itself WCAG 2.2 AA minimum). [WCAG](https://www.w3.org/TR/WCAG22/).
7. **Chrome 2026 OTP form guidance** — single input plus `autocomplete=one-time-code` is preferred for resilient autofill; however Pri's currently validated segmented `OtpInput` supports paste and OS autofill. **Do not rewrite OTP input without an authorized L2/L8 handoff and regression proof.** [OTP guide](https://developer.chrome.com/docs/modern-web-guidance/guides/forms/sms-otp-form).

## Visual and interaction decisions

- **One visual truth:** display `f(x)=x³−3x` with roots at `−√3`, `0`, `√3`, stationary points at `−1`, `1`, and a true tangent with slope `f′(x)=3x²−3`. Plot, tangent, point and readout are calculated from the same coordinates. It is explicitly labelled **illustration**, not grading, enrolled student data or provider inference.
- **No continuous animation:** canvas renders on mount, resize and pointer movement. No autonomous graphic movement, perpetual RAF, scroll capture or changes to maths/ink when signing in.
- **Material:** graphite black with restrained lilac for the primary action/focus. The interactive function is warm amber: a mathematical series rather than a random LED strip. No backdrop blur, particle effect, neon flare, pseudo-terminal metrics or fake progress.
- **Hierarchy:** brand → what Pri does → email → primary action → available identity alternatives → recovery/guardian → truthful privacy/legal text. The latter two are not removed or falsely minimized.
- **Cross-screen:** desktop gets a full graph; iPad portrait gets a bounded graph viewport instead of a vertically distorted plot; phones retain a compact curve but prioritize form entry and the keyboard. At 200%-equivalent viewport width, document overflow must remain zero.
- **Before CSS finishes:** critical entry material tokens paint in the already-loaded instrument stylesheet; the small sign-in stylesheet loads with initial CSS, while the computational plot itself remains lazy. This removes visual restyling shifts and prevents a flash of light theme.
- **Localisation:** retain actual EN/HI strings and brand layout. Do not replace Hindi with fallback English.
- **Authentication integrity:** visuals do not change OTP, password, Google/Apple, age, guardian, account restoration, activation, session or authority logic. Pri's real server remains the only verifier.

## Rejected directions

- A freestanding marketing website with arbitrary gradients, glass cards, scattered mathematical symbols, floating terminal labels, fake progress or a redundant seven-item sidebar.
- Eliminating all futuristic styling and reverting to plain editorial paper. The founder explicitly prefers the real Aurora instrument identity.
- Decorative animation when the app is waiting for real email delivery or a provider response.
- Using a green tick, fake mark or simulated outcome to imply the production assessor has verified the example.
- Shipping only a screenshot; a design is accepted only after real state and browser/device validation.

## Evidence and independent gates

The candidate is **draft #777**, targeted onto L3's Aurora branch rather than merged to protected main. Validation required on the **exact final source SHA**, not inferred from an older head:

- React production build, signing, install budget, Aurora-skin scope, design-system, sign-in/guardian i18n; full hosted CI and independent L2/L3/L8 approval.
- Chromium + WebKit: 360, 390, 430, 820, 1180 and 1440 widths; 188px simulation for 200% text, focus, Hindi and reduced motion; no page overflow, clipping, layout shift or lost ability to reach the primary action.
- Mocked-provider test for email entry → OTP and provider visibility; password/guardian/reset states; error/resend and OAuth cancel. The mock sends **zero live email or account mutations**.
- On physical devices verify actual iOS Safari/WKWebView safe areas and Android WebView input/keyboard behaviour.
- Use real staging at **https://app.prilearning.com** for authenticated release proofs only after normal cross-lane authorization. Preview screenshots must never be claimed as successful OTP delivery.
- The known **raw first-visit budget** was 3280–3282 KiB against the current 3271 KiB ceiling. Changes to its owner-approved threshold require **L8/Director coordination and explicit measured justification**; avoid weakening acceptance.

## Cross-lane integration

There are two overlapping draft PRs. **#777** presents the Aurora visual/plot system on L3's stacked branch, incorporating earlier #773 layout/error copy. **#778** separately repairs first-visit recovery and OAuth popup cancellation on current main and adds an illustrative worked method; it has its own exact-head browser evidence. Their `Login.jsx`, `SignInPlot.jsx`, `instrument.css`, and related strings overlap. **Do not blindly merge both**. L3 should select one coherent visual composition, while L2 reviews merging #778's recoverable identity improvements and QA retains all tests. The founder has not yet accepted any of these designs as final.

## Design sign-off rule

**Pass** requires founder inspection of the real dark/light, phone/tablet/desktop loaded candidate, no visual clutter, and QA proof. Test passing alone cannot make a subjective design "the best." Mark as **REVIEW REQUIRED**, not approved, until those conditions are met.
