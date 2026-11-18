# Attempt support: what help a server-graded attempt had

Standard #01 (independent mastery) needs "on your own" evidence. Until support version 2, every server-graded attempt was written `support: 'supported'`, because the server could not see tutor help. So the class board, the syllabus board and progress could never show independent work from the server.

Since support version 2, the server decides `support` from its **own** records of the question (`server/platform/attemptSupport.js`). It never takes the device's word: the submission body is closed, so a device cannot send a support value.

| Value | When | Server record that decides it |
| --- | --- | --- |
| `revealed` | The solution was shown: Show solution, or the ladder's last rung. | The reveal commit. |
| `supported` | Any help on this item. | One or more of: a charged hint rung; tutor help served on this issued question, a line check or a step-coach reading that ran (each written to a durable `practice-tutor-help` record that lives as long as the question, 90 days; the per-question rate-limit buckets are only a second witness, since housekeeping sweeps them after a day); help of any kind on **another copy of the same content** issued to this account (`help-on-copy`, via `practice-content-helped`); a tutor-policy request or a shown cause kind (`practice-help-plan`, PR #996, recorded as light assistance; nothing writes that scope until #996 merges, and this reads it generically); a repeat of content whose solution this account has already seen; or `deviceHelp: true` on the submission, help the device showed that the server never served (the tutor's offline fallback). That last is the only device statement taken. It can only lower the claim, and the body refuses `deviceHelp: false` or any `support` field, so nothing can claim independence. |
| `after-feedback` | No help, but resolved on a later try after seeing a verdict on an earlier one. | The question's try count (or a try spent on a copy of the same content). |
| `independent` | First try, no help of any kind. | Absence of all of the above. |

Precedence follows the table order: the first row that applies wins.

Each new event also carries:
- `supportVersion: 2`;
- `supportSources`, the records that decided it (for evidence audits; not shown to students);
- the true `hintsUsed`, which is 0 when no rung was opened. Before version 2 it was forced to at least 1.

## Exam papers

A paper offers no hint, no tutor (`TUTOR_EXAM_LOCKED`) and no second try. Its attempts are therefore `independent`, except a repeat of content already seen solved, which is `supported`.

## Old records are left as they are

Graded-attempt events are append-only learning evidence, and none is rewritten. An event without `supportVersion` was written under the old rule, where `supported` meant "help unknown", not "help seen". Every reader keeps such an event supported, so old evidence never becomes independent after the fact. Independent evidence accrues from new attempts.

## Readers

`progressTruth.isSupported` treats only `independent` as on your own; `after-feedback`, `supported` and `revealed` all count as help. Cloud restore credits `after-feedback` with one spent try, as it does `supported`. Local backups keep all four values.

## What `independent` does not mean

It means no help that this product gave on this item. Help the server cannot see (a calculator, another tab, a person) is outside every version of `support`.

Edge cases:
- A modified client that asks the tutor about a question without sending its server id gets stateless help that the server cannot tie to the attempt. It is the same class as help outside the product.
- An exam item whose content was tried in practice but not yet resolved, so the student saw a verdict but no solution, is still `independent`; only a seen solution makes it `supported`.
- Deploy order: a client that sends `deviceHelp` needs a server that accepts it. Promote the server before any native build carrying this client.
- A tutor stream is recorded as help when it is admitted. If the provider then fails mid-stream, the attempt still says `supported`. This errs towards supported, never towards independent.
- A line check or step-coach reading that the server refuses before it runs records nothing.
- A tutor-policy request is recorded whether or not a check ran: asking for help is itself part of the record (PR #996).
