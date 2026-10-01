# Cross-Platform (iPad · iPhone · Android phone · Android tablet)

CP-01 audit and architecture.

- Initial audit baseline: `main` @ `421f1ff1`.
- Revalidated against `main` @ `7f4a0559`.
- Final CP-01 candidate: the head of PR #250 at merge.

Read in this order:

1. [CROSS_PLATFORM_ARCHITECTURE.md](CROSS_PLATFORM_ARCHITECTURE.md): the decision (one shared product + thin shells), the verified current architecture, and the platform-neutral `priNative` contract.
2. [CAPABILITY_MATRIX.md](CAPABILITY_MATRIX.md): every capability across shared core, Apple, Android and browser, with status, risk and owner.
3. [FORM_FACTOR_SPEC.md](FORM_FACTOR_SPEC.md): COMPACT/MEDIUM/EXPANDED form factors and how each surface adapts.
4. [IPHONE_GAP_REPORT.md](IPHONE_GAP_REPORT.md): what exists for iPhone and exactly what remains.
5. [ANDROID_ARCHITECTURE.md](ANDROID_ARCHITECTURE.md): the Kotlin + WebView shell design.
6. [CROSS_PLATFORM_TEST_MATRIX.md](CROSS_PLATFORM_TEST_MATRIX.md): device/viewport matrix and gates, with physical evidence kept separate.
7. [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md): CP-02 → CP-12.

**Status:** Nothing here claims any platform is production-ready.
- iPad remains the only native target with existing release evidence.
- iPhone compiles and launches on a simulator, but is not certified.
- Android does not exist yet.

The machine check `client/test/cross-platform-architecture-check.mjs` keeps these documents honest. It verifies that every cited path exists. It also ratchets the iPad data origin, direct WebKit bridge access, device sniffing and native-shell secrets.

**Completion vocabulary:** physical-device validation is deferred by owner decision. A future task can be `SOFTWARE IMPLEMENTATION COMPLETE` while also `PHYSICAL DEVICE VALIDATION DEFERRED`. Deferred gates stay open and are never waived; see [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md).
