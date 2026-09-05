# Pri Learning Autonomous Engineering Fleet

Pri Learning now has one canonical engineering fleet definition in `.pri-os/fleet.json`.

The design deliberately avoids an uncontrolled swarm. Multiple agents may analyse independently, but **one specialist is the code-changing owner of each mission**. This prevents shared-file collisions and contradictory fixes across handwriting, maths intelligence, platform, iOS and curriculum.

## Control loop

Each autonomous cycle is:

**SCAN → PRIORITISE → ASSIGN → IMPLEMENT → TEST → REVIEW → INTEGRATE → REPEAT**

### 1. Director
The Director inspects current `main`, open PRs/issues and available CI/product evidence. It selects the highest-leverage software-only mission and assigns exactly one specialist.

### 2. Specialist
The selected specialist owns the implementation. Its canonical mission, repository paths and minimum gates come from `.pri-os/fleet.json`.

### 3. QA / Release Governor
The governor is adversarial. A change is not complete because code exists. It must have deterministic evidence, relevant gates, no test weakening, no fabricated evidence and an explicit residual-risk boundary.

## Fleet

The fleet currently defines 17 roles:

- Director / CTO
- Handwriting Intelligence
- Mathematical Reasoning & Marking
- Adaptive Learning & Pri Explain
- India Curriculum / NCERT / CBSE / JEE
- NSW / HSC Curriculum & Exam Intelligence
- Student Product / UX / Accessibility
- iOS / iPad / Pencil Platform
- Backend / Auth / Sync / Data
- Billing / Entitlements / Commercial Platform
- Teacher / Classroom Platform
- Security / Privacy
- Performance / Reliability / Offline / SRE
- QA / Integration / Release Governor
- Benchmark Science / ML Evidence
- Android / Cross-platform Future
- Growth / Marketing Product

## Commands

```bash
node scripts/pri-fleet.mjs validate
node scripts/pri-fleet.mjs list
node scripts/pri-fleet.mjs route client/src/ink/native.js
node scripts/pri-fleet.mjs prompt handwriting
node scripts/pri-fleet.mjs status
```

For branches whose specialist is known, the ownership guard can reject accidental cross-domain edits:

```bash
node scripts/pri-fleet.mjs guard handwriting origin/main
```

Shared governance files are allowed by the guard. Domain files outside the selected specialist's ownership are not.

## Autonomy boundaries

The fleet should continue without waiting for the founder for normal software decisions. It must **not** pretend software can manufacture evidence that only exists in the real world.

When work is blocked only by a human/physical dependency such as App Store credentials, a real Apple Pencil study, real students, teacher validation, payment-provider approval or legal/commercial sign-off, the agent should:
1. complete all code, test harnesses and evidence tooling possible;
2. record the exact remaining external dependency;
3. move to the next software-only production mission.

This keeps the engineering system autonomous without turning unknowns into fake “done” states.

## Relationship to existing Pri Learning automation

The existing `Pri App Health Agent` remains the deterministic health/evidence layer. Person 1 / Person 2 and the specialist CI workflows remain release contracts. The fleet sits above them as the ownership and decision layer rather than replacing them.

The governance workflow `.github/workflows/pri-agent-governance.yml` prevents silent drift in the fleet definition itself.
