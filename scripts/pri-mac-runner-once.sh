#!/usr/bin/env bash
# Pri Mac one-job runner (GitHub issue #227).
#
# Registers ONE just-in-time (JIT) ephemeral GitHub Actions runner on the Pri
# Mac, lets it accept exactly one job from
# .github/workflows/pri-mac-v1-acceptance.yml, then destroys every trace of it.
# There is no persistent runner: nothing listens for jobs except while the owner
# is running this script (at most PRI_RUNNER_JOB_WAIT_SECONDS before a job must
# arrive), and every run gets a fresh, unpredictable label so a public static
# label can never route work to this machine.
#
# KEEP THE LABEL PRIVATE until the Mac job has started. While the runner is
# listening, the label is the only thing that keeps any other workflow (a fork
# PR approved to run, a collaborator's branch workflow) off this machine. Pass
# it only to the dispatch below; never paste it into an issue, PR or chat.
#
# Owner procedure (full text: docs/operations/mac-trusted-runner.md):
#
#   # 1. In the OWNER's macOS account (gh logged in as the repository owner):
#   LABEL="$(scripts/pri-mac-runner-once.sh label)"   # private until the job starts
#
#   # 2. Mint the one-job credential in the owner account and hand it, over a
#   #    pipe only, to the non-admin pri-ci account that runs the job:
#   scripts/pri-mac-runner-once.sh mint "$LABEL" \
#     | sudo -u pri-ci -H /Users/Shared/pri-ci/pri-mac-runner-once.sh run "$LABEL"
#
#   # 3. Dispatch the workflow with that label and the exact main SHA:
#   gh workflow run pri-mac-v1-acceptance.yml --ref main \
#     -f sha="$(git rev-parse origin/main)" -f runner_label="$LABEL"
#
#   # 4. After the job, confirm GitHub de-registered the runner:
#   scripts/pri-mac-runner-once.sh cleanup "$LABEL"
#
#   If the guard job fails or the Mac job does not start, Ctrl-C the runner at
#   once and run `cleanup` (the runner also gives up on its own after
#   PRI_RUNNER_JOB_WAIT_SECONDS without a job).
#
# Subcommands:
#   label            print a fresh label: pri-mac-<16 lowercase hex>
#   mint LABEL       (owner account, needs gh) write the encoded JIT runner
#                    config for LABEL to stdout. Refuses to write it to a
#                    terminal: pipe it straight into `run`.
#   run LABEL        (pri-ci account) read the JIT config from stdin, unpack a
#                    verified actions/runner release into a fresh mktemp work
#                    directory, run exactly one job, preserve redacted _diag
#                    logs outside the work directory, then delete .credentials,
#                    .credentials_rsaparams, .runner and the whole work directory.
#                    Exits 3 (after the same cleanup) if no job is assigned within
#                    PRI_RUNNER_JOB_WAIT_SECONDS.
#   cleanup LABEL    (owner account, needs gh) confirm the runner named LABEL
#                    is no longer registered; if a run was aborted before a job
#                    arrived and it is still listed (offline), remove it.
#
# Environment for `run`:
#   PRI_RUNNER_TARBALL         required: path to actions-runner-osx-arm64-<v>.tar.gz
#   PRI_RUNNER_TARBALL_SHA256  required: its SHA-256 from the actions/runner release notes
#   PRI_RUNNER_ROOT            default "$HOME/pri-runner"; runs/ and diag/ live here.
#                              Must not be inside any git work tree (so never inside the
#                              PriLearningLauncher clone), a dot-directory of $HOME, or
#                              $HOME itself.
#   PRI_RUNNER_JOB_WAIT_SECONDS default 900 (15 minutes): how long the runner may listen
#                              without being assigned a job before it is stopped and
#                              cleaned up.
#   PRI_RUNNER_ALLOW_ADMIN     set to exactly "I-ACCEPT-ADMIN-RUNNER-RISK" to let the
#                              script itself run under a macOS admin account (local
#                              debugging of this script only). The workflow independently
#                              refuses to execute acceptance on an admin account, so a job
#                              routed to such a runner fails closed regardless.
# Environment for `mint` / `cleanup`:
#   PRI_RUNNER_REPO            default "Priysharan19/Final-Pri-learning"
#   PRI_RUNNER_GROUP_ID        default 1 (the repository's Default runner group)
#
# Credentials are never echoed, logged, passed in argv (visible to every local
# user via ps) or written anywhere except the disposable runner directory that
# the exit trap deletes.

set -euo pipefail
umask 077

readonly LABEL_RE='^pri-mac-[0-9a-f]{16}$'
readonly ADMIN_OVERRIDE='I-ACCEPT-ADMIN-RUNNER-RISK'
readonly REPO="${PRI_RUNNER_REPO:-Priysharan19/Final-Pri-learning}"

die() {
  printf 'pri-mac-runner-once: %s\n' "$*" >&2
  exit 2
}

note() {
  printf 'pri-mac-runner-once: %s\n' "$*" >&2
}

require_label() {
  local label="${1:-}"
  [[ "$label" =~ $LABEL_RE ]] || die "label must match ${LABEL_RE} (got '${label}'); create one with: $0 label"
}

new_label() {
  local hex
  hex="$(openssl rand -hex 8)"
  [[ "$hex" =~ ^[0-9a-f]{16}$ ]] || die "openssl rand did not return 16 hex characters"
  printf 'pri-mac-%s\n' "$hex"
}

# Absolute, symlink-resolved path of an existing directory.
physical_dir() {
  (cd "$1" && pwd -P)
}

# True if DIR or any parent contains .git (a directory, or a file for worktrees
# and submodules). Independent of git itself, which may be absent or refuse a
# repository owned by another user ("dubious ownership").
inside_git_tree() {
  local dir="$1"
  while :; do
    [[ -e "$dir/.git" ]] && return 0
    [[ "$dir" == "/" || -z "$dir" ]] && return 1
    dir="$(dirname "$dir")"
  done
}

# Send TERM to a process and all its descendants (children first). Used from
# the EXIT trap.
# shellcheck disable=SC2317
kill_tree() {
  local pid="$1" child
  for child in $(pgrep -P "$pid" 2>/dev/null || true); do
    kill_tree "$child"
  done
  kill -TERM "$pid" 2>/dev/null || true
}

refuse_admin_account() {
  [[ "$(id -u)" -ne 0 ]] || die "refusing to run a runner as root"
  if id -Gn | tr ' ' '\n' | grep -qx 'admin'; then
    if [[ "${PRI_RUNNER_ALLOW_ADMIN:-}" == "$ADMIN_OVERRIDE" ]]; then
      note "WARNING: $(id -un) is a macOS admin; continuing only because PRI_RUNNER_ALLOW_ADMIN is set. The workflow will still refuse to run acceptance here."
    else
      die "refusing to run as macOS admin user '$(id -un)'; use the non-admin pri-ci account (see docs/operations/mac-trusted-runner.md)"
    fi
  fi
}

# The runner root must be a dedicated, private location: never inside a git
# work tree (this rules out the protected PriLearningLauncher clone and every
# other checkout), never $HOME itself and never a dot-directory of $HOME
# (.ssh, .config, .gnupg, ...).
refuse_unsafe_root() {
  local root="$1" home
  case "$root" in
    *PriLearningLauncher*) die "refusing runner root inside the PriLearningLauncher clone: $root" ;;
  esac
  home="$(physical_dir "$HOME")"
  [[ "$root" != "$home" ]] || die "refusing to use \$HOME itself as the runner root"
  case "$root/" in
    "$home"/.*) die "refusing runner root inside a dot-directory of \$HOME: $root" ;;
  esac
  if inside_git_tree "$root" || git -C "$root" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    die "refusing runner root inside a git work tree: $root"
  fi
  [[ -O "$root" ]] || die "runner root is not owned by $(id -un): $root"
}

cmd_label() {
  [[ $# -eq 0 ]] || die "usage: $0 label"
  new_label
}

cmd_mint() {
  [[ $# -eq 1 ]] || die "usage: $0 mint LABEL | sudo -u pri-ci -H <path>/pri-mac-runner-once.sh run LABEL"
  require_label "$1"
  [[ ! -t 1 ]] || die "refusing to write a runner credential to a terminal; pipe it into: $0 run $1"
  command -v gh >/dev/null 2>&1 || die "gh CLI is required to mint a JIT runner config"
  # gh writes the encoded config straight to the pipe; this script never holds it.
  gh api -X POST "repos/${REPO}/actions/runners/generate-jitconfig" \
    -f "name=$1" \
    -F "runner_group_id=${PRI_RUNNER_GROUP_ID:-1}" \
    -f 'labels[]=self-hosted' \
    -f 'labels[]=macOS' \
    -f 'labels[]=ARM64' \
    -f "labels[]=$1" \
    -f 'work_folder=_work' \
    --jq '.encoded_jit_config'
  note "minted one-job runner $1; dispatch: gh workflow run pri-mac-v1-acceptance.yml --ref main -f sha=<main SHA> -f runner_label=$1"
}

cmd_cleanup() {
  [[ $# -eq 1 ]] || die "usage: $0 cleanup LABEL"
  require_label "$1"
  command -v gh >/dev/null 2>&1 || die "gh CLI is required to inspect runner registrations"
  local found id status
  found="$(gh api --paginate "repos/${REPO}/actions/runners" \
    --jq ".runners[] | select(.name == \"$1\") | \"\\(.id) \\(.status)\"")"
  if [[ -z "$found" ]]; then
    printf 'DEREGISTERED: no runner named %s is registered on %s\n' "$1" "$REPO"
    return 0
  fi
  id="${found%% *}"
  status="${found#* }"
  [[ "$id" =~ ^[0-9]+$ ]] || die "unexpected runner listing for $1"
  [[ "$status" == "offline" ]] || die "runner $1 (id $id) is still $status; wait for its job to finish, then re-run cleanup"
  gh api -X DELETE "repos/${REPO}/actions/runners/${id}" >/dev/null
  printf 'REMOVED: offline runner %s (id %s) was still registered and has been deleted\n' "$1" "$id"
}

# State for the exit trap of `run`.
RUN_DIR=''
RUNS_ROOT=''
DIAG_DEST=''
RUNNER_DIR=''
RUNNER_PID=''

# Called only from the EXIT trap of `run`.
# shellcheck disable=SC2317
preserve_diag() {
  [[ -n "$RUNNER_DIR" && -d "$RUNNER_DIR/_diag" && -n "$DIAG_DEST" ]] || return 0
  mkdir -p -m 700 "$DIAG_DEST"
  local log
  for log in "$RUNNER_DIR"/_diag/*.log; do
    [[ -f "$log" ]] || continue
    # Redact the JIT config itself plus anything shaped like a credential.
    # The perl program is deliberately single-quoted (perl, not bash, expands it).
    # shellcheck disable=SC2016
    PRI_REDACT="${jit_config:-}" perl -pe '
      BEGIN { $s = $ENV{PRI_REDACT} // ""; }
      s/\Q$s\E/[REDACTED-JITCONFIG]/g if length $s;
      s/\b(gh[pousr]_|github_pat_)[A-Za-z0-9_]{16,}/[REDACTED-GITHUB-TOKEN]/g;
      s/(bearer|token|basic)\s+[A-Za-z0-9._~+\/=-]{16,}/$1 [REDACTED]/gi;
      s/("?(?:access_?token|accessToken|token|password|secret|privateKey|jitconfig|encoded_jit_config)"?\s*[:=]\s*)"[^"]*"/$1"[REDACTED]"/gi;
      s/\b((?:access_?token|accessToken|token|password|secret|privateKey|jitconfig|encoded_jit_config)\s*[:=]\s*)(?!["\[])[^\s,;"\x27}\]]+/${1}[REDACTED]/gi;
      s/[A-Za-z0-9+\/]{80,}={0,2}/[REDACTED-BLOB]/g;
    ' "$log" > "$DIAG_DEST/$(basename "$log")"
  done
  note "diagnostic logs (redacted) preserved in $DIAG_DEST"
}

# shellcheck disable=SC2317
cleanup_run() {
  local rc=$?
  set +e
  if [[ -n "$RUNNER_PID" ]] && kill -0 "$RUNNER_PID" 2>/dev/null; then
    kill_tree "$RUNNER_PID"
    wait "$RUNNER_PID" 2>/dev/null
  fi
  preserve_diag
  if [[ -n "$RUNNER_DIR" ]]; then
    rm -f "$RUNNER_DIR/.credentials" "$RUNNER_DIR/.credentials_rsaparams" "$RUNNER_DIR/.runner"
  fi
  if [[ -n "$RUN_DIR" && -n "$RUNS_ROOT" && "$RUN_DIR" == "$RUNS_ROOT"/run.* && -d "$RUN_DIR" ]]; then
    rm -rf "$RUN_DIR"
  fi
  jit_config=''
  unset jit_config
  if [[ -n "$RUN_DIR" && -e "$RUN_DIR" ]]; then
    note "ERROR: work directory survived cleanup: $RUN_DIR"
    rc=1
  else
    note "work directory, .credentials and .runner deleted"
  fi
  exit "$rc"
}

cmd_run() {
  [[ $# -eq 1 ]] || die "usage: <owner> $0 mint LABEL | $0 run LABEL"
  local label="$1"
  require_label "$label"
  refuse_admin_account

  local root
  root="${PRI_RUNNER_ROOT:-$HOME/pri-runner}"
  case "$root" in
    *PriLearningLauncher*) die "refusing runner root inside the PriLearningLauncher clone: $root" ;;
  esac
  mkdir -p -m 700 "$root"
  root="$(physical_dir "$root")"
  refuse_unsafe_root "$root"

  local wait_seconds="${PRI_RUNNER_JOB_WAIT_SECONDS:-900}"
  [[ "$wait_seconds" =~ ^[1-9][0-9]*$ ]] || die "PRI_RUNNER_JOB_WAIT_SECONDS must be a positive whole number of seconds"

  local tarball="${PRI_RUNNER_TARBALL:-}" expected="${PRI_RUNNER_TARBALL_SHA256:-}" actual
  [[ -n "$tarball" && -f "$tarball" ]] || die "PRI_RUNNER_TARBALL must name the downloaded actions-runner-osx-arm64-*.tar.gz"
  [[ "$expected" =~ ^[0-9a-f]{64}$ ]] || die "PRI_RUNNER_TARBALL_SHA256 must be the 64-hex SHA-256 from the actions/runner release notes"
  actual="$(shasum -a 256 "$tarball" | cut -d' ' -f1)"
  [[ "$actual" == "$expected" ]] || die "runner tarball SHA-256 mismatch (expected $expected, got $actual)"

  [[ ! -t 0 ]] || die "the JIT runner config must arrive on stdin from: $0 mint $label"
  jit_config=''
  IFS= read -r jit_config || true
  if [[ ! "$jit_config" =~ ^[A-Za-z0-9+/=]{64,}$ ]]; then
    die "stdin did not contain an encoded JIT runner config"
  fi

  RUNS_ROOT="$root/runs"
  mkdir -p -m 700 "$RUNS_ROOT" "$root/diag"
  DIAG_DEST="$root/diag/$label-$(date -u +%Y%m%dT%H%M%SZ)"
  trap cleanup_run EXIT
  trap 'exit 130' INT TERM HUP
  RUN_DIR="$(mktemp -d "$RUNS_ROOT/run.XXXXXXXXXX")"
  RUNNER_DIR="$RUN_DIR/runner"
  mkdir -m 700 "$RUNNER_DIR"
  tar -xzf "$tarball" -C "$RUNNER_DIR"
  [[ -x "$RUNNER_DIR/run.sh" ]] || die "runner tarball did not contain run.sh"

  note "one-job runner $label listening from $RUN_DIR for up to ${wait_seconds}s (Ctrl-C aborts; cleanup still runs)"
  note "keep the label private; if the guard job fails or the Mac job does not start, Ctrl-C now and run: $0 cleanup $label"
  printf 'PRI_RUNNER_LABEL=%s\n' "$label"
  # The runner reads ACTIONS_RUNNER_INPUT_<ARG> as --<arg>; passing it through
  # the environment keeps the credential out of argv. A JIT runner is ephemeral:
  # it accepts exactly one job and GitHub de-registers it afterwards.
  (cd "$RUNNER_DIR" && ACTIONS_RUNNER_INPUT_JITCONFIG="$jit_config" ./run.sh) &
  RUNNER_PID=$!

  # The runner starts a Worker (and its _diag/Worker_*.log) only when a job is
  # assigned. Bound how long an idle, listening runner may stay exposed.
  local waited=0
  while kill -0 "$RUNNER_PID" 2>/dev/null; do
    if compgen -G "$RUNNER_DIR/_diag/Worker_*.log" >/dev/null; then
      note "job assigned to $label; waiting for it to finish"
      break
    fi
    if [[ "$waited" -ge "$wait_seconds" ]]; then
      note "no job was assigned within ${wait_seconds}s; stopping the runner. Then run: $0 cleanup $label"
      exit 3
    fi
    sleep 1
    waited=$((waited + 1))
  done
  local rc=0
  wait "$RUNNER_PID" || rc=$?
  RUNNER_PID=''
  return "$rc"
}

main() {
  local sub="${1:-}"
  [[ $# -gt 0 ]] && shift
  case "$sub" in
    label) cmd_label "$@" ;;
    mint) cmd_mint "$@" ;;
    run) cmd_run "$@" ;;
    cleanup) cmd_cleanup "$@" ;;
    *) die "usage: $0 label | mint LABEL | run LABEL | cleanup LABEL" ;;
  esac
}

main "$@"
