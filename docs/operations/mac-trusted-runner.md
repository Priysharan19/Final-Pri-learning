# Pri Mac one-job runner (owner procedure)

Status: **code and static contract in place; the end-to-end dispatch on the owner's Mac (T2
evidence for issue #227) has not been run yet.** Nothing below has been exercised on the Pri Mac
since this procedure replaced the persistent `pri-learning-mac-trusted-manual` runner.

The workflow `.github/workflows/pri-mac-v1-acceptance.yml` builds the canonical iOS package and
runs the iPhone and iPad simulator journeys on the owner's Apple-silicon Mac. This repository is
public, and GitHub's secure-use guidance says a self-hosted runner on a public repository can be
compromised by untrusted workflow code. So the Mac lane is built on these rules:

| Rule | Where it is enforced |
| --- | --- |
| No runner is online except while the owner runs one job by hand | `scripts/pri-mac-runner-once.sh` registers one just-in-time (JIT) runner; GitHub removes it after one job |
| Each run gets a new label that nobody can guess, on top of `self-hosted, macOS, ARM64` | `pri-mac-runner-once.sh label` (`openssl rand -hex 8`) → `runs-on: [self-hosted, macOS, ARM64, '${{ inputs.runner_label }}']` |
| The label stays private until the Mac job starts | The `guard` job never receives `runner_label` and nothing in the workflow prints it. The Mac job's `if:` only checks its shape (`startsWith(inputs.runner_label, 'pri-mac-')`). The exact check is in the job: the `pri-mac-<16 hex>` regex and `RUNNER_NAME` equal to the label |
| A listening runner is exposed for a bounded time | `run` stops the runner and cleans up (exit 3) if no job is assigned within `PRI_RUNNER_JOB_WAIT_SECONDS` (default 900 = 15 minutes) |
| Started only by a manual dispatch from the owner, from `main`, on the canonical repository | `workflow_dispatch` is the only trigger. The GitHub-hosted `guard` job and the Mac job both check event, repository, actor and triggering actor against the owner, and the ref |
| An exact commit that is on `main` | Required `sha` input (40 lowercase hex). The guard checks `compare/<sha>...main` is `identical` or `ahead` with `behind_by` 0. The Mac job checks out that SHA and asserts `git rev-parse HEAD` before any repository code runs |
| Least privilege | Top-level `permissions: contents: read`, `persist-credentials: false`, no `secrets.` reads, no `${{ }}` inside `run:` scripts |
| Not an admin, not inside the launcher clone | The script refuses a macOS admin account and any runner root inside a git work tree (so never inside `PriLearningLauncher`), `$HOME` or a `$HOME` dot-directory. The work-tree check walks parent directories for `.git` itself, so it holds even when git is absent or refuses another user's repository ("dubious ownership"). The workflow fails again if the job's account is an admin or the workspace path contains `PriLearningLauncher` |
| A fresh work directory each run, destroyed afterwards | `mktemp -d` under `$PRI_RUNNER_ROOT/runs`. The exit trap (which also runs on Ctrl-C or failure, and ignores a second Ctrl-C) stops the runner, then deletes `.credentials`, `.credentials_rsaparams`, `.runner` and the whole run directory. The runner runs in its own process group. Cleanup sends TERM to the group, to the leader's descendants, and to any process that names the run directory in its command line or has its working directory in it. That catches double-forked processes. Paths are compared as fixed strings, and working directories come from `lsof`, or `/proc` on Linux. Whatever is still alive after 10 s gets KILL. Cleanup prints `no runner process is left running`, or lists the survivors and exits non-zero |
| Diagnostics are kept without credentials | `_diag/*.log` and the runner's console output are copied, redacted, to `$PRI_RUNNER_ROOT/diag/<label>-<UTC time>/` before deletion |
| The background runner never owns the terminal | The runner's stdin is `/dev/null`. Its stdout and stderr go to a private file under `runs/`, outside the work directory, which is kept redacted as `runner-console.log`. So a terminal write or `tcsetattr` cannot stop it with SIGTTOU. The script itself reports when the runner is listening and when a job is assigned |
| The credential is never printed and never on a command line | `mint` refuses to write to a terminal. `run` reads the JIT config from stdin and gives it to the runner as `ACTIONS_RUNNER_INPUT_JITCONFIG`, not as `--jitconfig` in argv (which `ps` shows to every local user). The workflow fails if that variable reaches the job environment |

`tools/ci-self-hosted-runner-check.mjs` (run in CI's "Suites policy and contracts" job and in
`npm run test:ci:policy`) enforces this contract. It first runs a fail-closed grammar lint on
**every** workflow file. Each line outside a block scalar must be a plain `key:` (nothing between
the key and the colon), a `- ` item, or block-scalar content. Quoted, escaped and `? ` complex
keys, and anything else the line parsers would skip, are rejected before any workflow is
classified. The only exception is a narrow single-line flow mapping of plain keys, which the
Android matrix and two `with:` lines use; it is still banned in the self-hosted workflow.
**The whole `guard` job, and the Mac job
from its key line through its third step (checkout, HEAD assertion, isolation), must match a
reviewed canonical text kept in the checker, exactly apart from trailing whitespace.** A
deny-list cannot list every way a script can exit 0 early (`exit`, `exec true`, `if false;`, a
heredoc, `shell: true {0}`). So any edit to those blocks needs a matching, reviewed edit to the
checker. The check also forbids `defaults:`, top-level keys other than
name/on/permissions/concurrency/jobs, extra Mac-job keys, duplicate mapping keys anywhere, flow
mappings, and a `shell:` other than `bash`. Both jobs' `if:` must equal the canonical
expression, which rejects `always()`, `!cancelled()`, `failure()`, `success() ||` and any added
`||`. As defence in depth it still checks the individual guard and isolation lines. It forbids `continue-on-error`, YAML merge keys, anchors and aliases,
`|| true`, `|| :`, `|| exit`, `|| return`, `exit 0`, `set +e`, `trap`, a second `fail()`
definition, and step-level `if:` on the guard, checkout, HEAD and isolation steps. It applies to **every** workflow whose
`runs-on` is not a GitHub-hosted image. It also exercises the script against a fake runner
tarball, and checks with negative fixtures that each rule really rejects what it should.

## One-time setup (owner, on the Mac)

1. **Create the non-admin `pri-ci` account.** In System Settings → Users & Groups, add a
   *Standard* user `pri-ci`, then confirm from your own account:

   ```bash
   id -Gn pri-ci            # must NOT list "admin"
   dseditgroup -o checkmember -m pri-ci admin   # must report that pri-ci is NOT a member of admin
   ```

   Do not sign `pri-ci` in to your Apple ID, browsers, SSH keys or any project secrets. Do not
   give it access to the `PriLearningLauncher` clone or your home folder.
2. **Toolchain for `pri-ci`.** The job needs Node 24 and npm, Xcode (accepted licence) and the
   iOS simulator runtimes. Xcode is system-wide. If Node is installed per user, install it for
   `pri-ci` as well. iOS simulators may need `pri-ci` to have a logged-in GUI session (fast user
   switching). Confirming this is part of the first T2 run.
3. **Install the script and a verified runner release where `pri-ci` can read them but not
   change them:**

   ```bash
   sudo mkdir -p /Users/Shared/pri-ci
   sudo cp scripts/pri-mac-runner-once.sh /Users/Shared/pri-ci/
   # download actions-runner-osx-arm64-<version>.tar.gz from github.com/actions/runner/releases
   sudo cp ~/Downloads/actions-runner-osx-arm64-<version>.tar.gz /Users/Shared/pri-ci/
   sudo chown -R root:wheel /Users/Shared/pri-ci && sudo chmod 755 /Users/Shared/pri-ci
   sudo chmod 755 /Users/Shared/pri-ci/pri-mac-runner-once.sh
   sudo chmod 644 /Users/Shared/pri-ci/actions-runner-osx-arm64-*.tar.gz
   ```

   Copy the tarball's SHA-256 from the release notes. The script refuses a tarball whose hash
   does not match. Re-copy the script whenever `main` changes it.
4. **Require approval for fork pull requests.** In Settings → Actions → General → "Approval for
   running fork pull request workflows from contributors", choose **Require approval for all
   external contributors**. While a one-job runner is listening, its private label is all that
   keeps another workflow off the Mac, so do not approve a fork PR run while one is up.
5. **Retire the old persistent runner.** If `pri-final-macbook-trusted` (label
   `pri-learning-mac-trusted-manual`) is still registered, stop its service, run
   `./config.sh remove` in its directory, and check that Settings → Actions → Runners no longer
   lists it. The new workflow does not route to that label.

## Each acceptance run

In **your own** account (where `gh` is signed in as the repository owner), from an up-to-date
clone of `main`. This is not the launcher clone, and the clone does not have to be on the Mac
that runs the job:

```bash
LABEL="$(scripts/pri-mac-runner-once.sh label)"   # private: share it with nothing but the dispatch below
SHA="$(git rev-parse origin/main)"                # or any commit already on main

# Terminal A — mint the one-job credential and pipe it to pri-ci; it stays in the foreground.
scripts/pri-mac-runner-once.sh mint "$LABEL" \
  | sudo -u pri-ci -H env \
      PRI_RUNNER_TARBALL=/Users/Shared/pri-ci/actions-runner-osx-arm64-<version>.tar.gz \
      PRI_RUNNER_TARBALL_SHA256=<64-hex from the release notes> \
      /Users/Shared/pri-ci/pri-mac-runner-once.sh run "$LABEL"

# Terminal B — once terminal A prints "runner is listening for jobs; dispatch the workflow now":
gh workflow run pri-mac-v1-acceptance.yml --ref main -f sha="$SHA" -f runner_label="$LABEL"
gh run watch "$(gh run list --workflow pri-mac-v1-acceptance.yml --limit 1 --json databaseId --jq '.[0].databaseId')"
```

The runner takes the one job and exits. The script then prints
`work directory, .credentials and .runner deleted`. Then confirm de-registration:

```bash
scripts/pri-mac-runner-once.sh cleanup "$LABEL"   # expect: DEREGISTERED: no runner named ... is registered
```

**Keep the label private until the Mac job has started.** Do not paste it into an issue, a PR,
chat or a shared terminal. Once the Mac job is queued, the label is visible in the public run,
but by then the runner has already taken that job, and a JIT runner accepts only one.

**If the `guard` job fails, or the Mac job does not start within a minute or two, press Ctrl-C
in terminal A at once and run `cleanup`.** The trap still deletes the run directory, and
`cleanup` removes the offline registration that is left behind. If you do nothing, the runner
stops by itself after `PRI_RUNNER_JOB_WAIT_SECONDS` (default 15 minutes) without a job, and
cleans up the same way. Use a new label next time and never reuse one.

The runner reads `ACTIONS_RUNNER_INPUT_JITCONFIG` as its `--jitconfig` argument, which is how
the credential stays out of argv. The workflow's isolation step fails if that variable shows up
in the job environment. The first T2 run is where this gets confirmed on the real runner
version.

## Evidence for issue #227 (T2, owner-only, still outstanding)

Record these in the issue. Never fabricate them:

- the run URL of a dispatch that completed on the fresh label, showing the `guard` job and the
  Mac job's "Assert HEAD" and "Verify one-job runner isolation" steps passing;
- `scripts/pri-mac-runner-once.sh cleanup <label>` printing `DEREGISTERED` after the job, and the
  runner list showing nothing for that label;
- `id -Gn` for the job account without `admin`, and the job workspace path (from the isolation
  step log), which is not inside `PriLearningLauncher`;
- a second dispatch with the same, now-dead label staying queued (no runner accepts it),
  cancelled by hand. This shows each label accepts exactly one job;
- negative proof: the contract test's fixtures show that `pull_request`, `pull_request_target`,
  `push`, `issue_comment`, `schedule`, `workflow_run` and `merge_group` triggers are rejected,
  and the workflow declares none of them.

## What persists between runs

Each run's work directory is destroyed, but the `pri-ci` account's home folder is not. A job
could leave files there, for example a `~/Library/LaunchAgents` item, shell start-up files,
npm or Xcode caches. That is acceptable only because every job runs a trusted commit that is
already on `main`, dispatched by the owner. It would not be acceptable for untrusted code. Check
`/Users/pri-ci/Library/LaunchAgents` (and `crontab -l` as `pri-ci`) from time to time, and
whenever a run looked unusual. Delete and recreate the `pri-ci` account if anything there is
unexpected.

The workflow produces simulator evidence only. That is not physical iPhone/iPad, Apple Pencil,
signing, TestFlight or store evidence.
