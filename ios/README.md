# iOS source of truth

`PriLearning.swiftpm/` is the **only authoritative native iPad package** in this repository.

The repository previously contained `PriLearning 2.swiftpm/` with the exact same Git tree as `PriLearning.swiftpm/`, plus a checked-in `PriLearning.swiftpm.zip`. Neither was referenced by the iOS bundle sync (`scripts/sync-ios.mjs`) or the native simulator runner (`scripts/ink-native-check.mjs`); both tools explicitly target `ios/PriLearning.swiftpm/`.

Those duplicate copies were removed during the Native Ink V9 sprint so Swift/PencilKit/Vision changes have one source of truth. If a distributable archive is needed, create it from the canonical package at release time rather than committing a second independently drifting implementation.
