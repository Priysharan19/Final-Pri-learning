# `server/` — what is alive in here, and what is not

Short version: **the Express app in this folder is unused legacy. The engine
re-exports and the self-check harness are not.** Do not delete the folder as a
unit.

## The Express app is dead code

`index.js`, `routes/api.js`, `auth.js`, `db.js`, `badges.js` and `seed.js` are
roughly 11,000 lines implementing an account-based, SQLite-backed API. Nothing in
the shipped product calls any of it: there is no `fetch()` anywhere in
`client/src/`. The one remaining trace is the dev-only `/api →
http://localhost:4000` proxy in `client/vite.config.js`, which is vestigial —
nothing ever requests `/api`.

The real backend is **`client/src/local/backend.js`** — 51 routes dispatched
in-process against IndexedDB, in the browser, on the device. That is what makes
Pri Learning work with no account, no network and no server. `client/src/local/`
also holds the schema (`idb.js`), the profile store (`store.js`), local password
hashing (`auth.js`), badge awarding (`badges.js`) and the on-device demo
(`demoSeed.js`) — each the live counterpart of a dead file listed above.

Two details worth stating plainly, because both have been described wrongly:

- `npm start` is **not** "a static host and nothing more". `index.js` mounts
  `authRouter` (4 routes) and `api` (18 routes) — **22 live Express routes** —
  *before* the `client/dist` static fallback. They answer if you call them. The
  client simply never does.
- These routes are not a mirror of the local backend. They are older and
  smaller: no match mode, classes, tasks, task packs, history detail, custom
  questions, backup/restore or ink storage. Treating them as a spec for the
  product would be a mistake.

Nothing here is installed by default either — `server/node_modules/` is absent
until you run `npm run setup`, so `npm start` does not even boot from a fresh
clone without an install step.

## What *is* alive under `server/`

| Path | Status | Used by |
|---|---|---|
| `server/engine/**` | **alive** — thin re-export shims | `server/test/selfcheck.mjs`, `tools/count-questions.mjs` |
| `server/engine/generators/extras.js` | **alive and unique** — 84 authored question forms that exist nowhere else | the shim in `generators/index.js` |
| `server/test/selfcheck.mjs` | **alive** — the 10,080-check gate | `npm test` (first command in the chain) |
| `server/index.js`, `routes/`, `auth.js`, `db.js`, `badges.js`, `seed.js` | dead | nothing |
| `server/package.json`, `package-lock.json` | needed only by the dead app | `npm run setup` |

### The engine is no longer duplicated

`server/engine/` used to be a hand-copied duplicate of `client/src/engine/` —
same files, byte for byte, drifting apart one edit at a time. Every one of those
files is now a one-line re-export:

```js
export * from '../../client/src/engine/adaptive.js';
```

So **`client/src/engine/` is the single source of truth**, and the dependency
arrow points from `server/` into `client/`, never the other way. Editing a
generator in the client changes what the self-check measures, immediately, with
no copy step.

Two files are deliberately not pure shims:

- **`generators/extras.js`** — 84 extra question forms (one per subtopic) that
  the client cannot generate. Original content, not a copy of anything.
- **`generators/index.js`** — re-exports `GENERATORS` from the client registry,
  then layers `extras.js` on top: a seeded picker chooses between a subtopic's
  base generator and its extras, and exposes `formCount()`. This is why the
  authored-form count is 420 (336 base cells + 84 extras) rather than 336.

## If you delete `server/`

The app itself is fine — `client/` builds and runs standalone, and the PWA needs
no server at all. These break:

1. **`npm test` stops working entirely.** Its first command is
   `node server/test/selfcheck.mjs`; the chain fails before any ink suite runs.
   The 10,080-check correctness gate on the question generators is gone with it.
2. **The 84 extra question forms are gone.** `extras.js` lives only here, so the
   authored-form count drops from 420 to 336. `tools/count-questions.mjs` keeps
   running — it censuses the client registry by default and only reaches into
   `server/engine/` in its optional `server` mode, where `formCount` is read as
   an optional export. That mode, and the 420 figure only it can report, go with
   the directory.
3. **`npm start` and `npm run seed` disappear** (both point at files in here).
4. **`npm run dev` breaks** — `scripts/dev.js` spawns `server/index.js` as one of
   its two processes.
5. **`npm run setup` breaks** — it runs `npm install --prefix server`.
6. **`npm run test:e2e` breaks** — `client/test/tour-v4.js` drives
   `http://localhost:4000`, which only `npm start` serves.

A safe removal is therefore not `rm -rf server/`. It is: move
`server/test/selfcheck.mjs` and `server/engine/generators/extras.js` into
`client/` (folding the extras layer into `client/src/engine/generators/index.js`
so the client can generate all 420 forms), retire the now-redundant `server`
mode in `tools/count-questions.mjs`, rewrite the root `scripts` block, and give
the built client a different static host. Only then does the Express app become
genuinely free to go.

Keeping it costs nothing at runtime — it is never imported by the app and never
bundled by Vite.
