# Owner approvals: the GO, the production-data Yes and evidence waivers

The release tools accept the owner's decisions as **GitHub posts by the owner's admin account**,
checked against GitHub when the tools run, never as names typed into a file. This page gives each
post's exact line, the link that makes it one click, and the record fields that point at it.

**One click.** GitHub can prefill a *new issue* from a link, but it cannot prefill a comment. So
each approval below is an issue the owner opens from a prefilled link, and the only click is
*Submit new issue*. A comment holding the same line (on #686, say) is accepted as well. The
Director's Owner Console builds the links once the candidate SHA exists; this page creates none of
them.

## What every approval must be (`verifyApproval`, `scripts/release-nominate.mjs`)

- an **issue** of `Priysharan19/Final-Pri-learning`, linked as `https://github.com/Priysharan19/Final-Pri-learning/issues/<n>`,
  or a **comment** on any issue or pull request there, linked as `…/issues/<n>#issuecomment-<id>`.
  A pull request's own description is never accepted;
- written by the account the record names in `githubLogin`. That account is a **User**, not a bot
  or app, with **admin** permission on the repository;
- posted **after the candidate commit** and **never edited** (the tools read the issue's
  `lastEditedAt` and the comment's `updated_at`). If a word is wrong, close the issue and open a
  new one; never edit;
- for an issue: **open, and never closed**. Closing an approval issue withdraws the approval, and
  one that is closed and reopened is not taken back. Nobody but the owner closes an approval issue;
- whose **first line** is the approval's line exactly (blank lines before it are fine). Under other
  text, in an HTML comment or in a code block it is refused. A second line may say more, but **one
  post approves one thing**: a post that holds two approval lines approves nothing.

**Evidence class: GITHUB-ACCOUNT-AUTHENTICATED.** GitHub proves the account, not the person: an
agent holding the account's token could post as it. So the owner posts every approval personally,
in the GitHub web or mobile app. An agent may build the links, and may copy a posted approval's
link and the owner's name into the record. It never posts, edits or invents an approval.

An approval belongs to one SHA. A new candidate needs new posts.

## 1. The GO for exactly one SHA

| | |
|---|---|
| Where it counts | the dossier's step 28 (`scripts/release-dossier.mjs`); `docs/release/FREEZE-RUNBOOK.md` F15 |
| When | after the soak ended (`soak.endedAt`) **and** after the candidate was frozen (`candidate.frozenAt`). An earlier GO is refused as stale |
| The line | `Pri-Release-GO: <SHA> target=deploy/production` |
| Link template | `https://github.com/Priysharan19/Final-Pri-learning/issues/new?title=Release+GO%3A+<SHA>&body=Pri-Release-GO%3A+<SHA>+target%3Ddeploy%2Fproduction` |
| Record (`docs/release/evidence/go-no-go/<SHA>.json`) | `go` = `{ "decision": "GO", "by": "<the owner's full name>", "githubLogin": "<the owner's login>", "approval": "<the issue's URL>", "at": "<ISO time>", "sha": "<SHA>", "statement": "<one line>" }` |

## 2. The production-data Yes (D27, Step 24)

| | |
|---|---|
| Where it counts | the dossier's step 23 `data` gate. A typed PASS is not enough: the gate requires this authenticated Yes |
| When | after the candidate was frozen, before the first step of the cutover window (`docs/operations/postgres-cutover.md` §5.5 stage 1). The tools refuse a Yes posted after the data gate was signed (`gates.data.at`): the Yes comes before the data step, and the sign-off after it |
| The line | `Pri-Production-Data-YES: <SHA> target=production-postgres` |
| Link template | `https://github.com/Priysharan19/Final-Pri-learning/issues/new?title=Production+data+YES%3A+<SHA>&body=Pri-Production-Data-YES%3A+<SHA>+target%3Dproduction-postgres` |
| Record | `gates.data` = `{ "status": "PASS", "by": "<who checked the database>", "at": "<ISO time>", "evidence": "postgres-cutover.md §7a log", "githubLogin": "<the owner's login>", "approval": "<the issue's URL>" }` |

The owner's choice between "migrate" and "start empty" (ADR-0001) goes in the cutover log
(§7a). A second line in the issue may state it; the tools do not read that line.

## 3. An evidence waiver

| | |
|---|---|
| Where it counts | `scripts/release-nominate.mjs --override <file>` and the dossier's override rows |
| When | after the candidate commit |
| The line | `Pri-Evidence-Waiver: <SHA> scope=public-release target=deploy/production waives=<the waived requirements, sorted, comma-separated>`. Under D1 that is `waives=device-matrix:AND,device-matrix:ANT`; those two requirement names come with #760, which must be merged before this waiver can be used |
| Link template | `https://github.com/Priysharan19/Final-Pri-learning/issues/new?title=Evidence+waiver%3A+<SHA>&body=Pri-Evidence-Waiver%3A+<SHA>+scope%3Dpublic-release+target%3Ddeploy%2Fproduction+waives%3Ddevice-matrix%3AAND%2Cdevice-matrix%3AANT` |
| Record (`docs/release/evidence/go-no-go/<SHA>.override.json`) | `{ "sha", "scope": "public-release", "waives": [...], "by", "githubLogin", "approval": "<the issue's URL>", "at", "reason" }` (`docs/release/evidence/go-no-go/README.md`) |

## Building the links

GitHub's new-issue page reads the `title` and `body` query parameters. In JavaScript the safe
way to build one is
`` `https://github.com/Priysharan19/Final-Pri-learning/issues/new?${new URLSearchParams({ title, body })}` ``,
with `body` starting with exactly the line above. `URLSearchParams` writes spaces as `+`, which
GitHub reads as spaces. Nothing goes before the line, and no other approval line goes after it; a
second line of plain text is fine.
