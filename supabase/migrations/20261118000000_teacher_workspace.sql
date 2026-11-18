-- ─────────────────────────────────────────────────────────────────────────────
-- Pri Learning · platform schema — the teacher workspace (schema 18)
--
-- assignment_handins    a finished, server-marked paper a student HANDS IN for
--                       a paper assignment of a class they are in: the exam id,
--                       the engine's score and total as stored, and a per-
--                       question summary (marks, engine marks, first-break line
--                       and misconception id). The exam result itself is never
--                       copied or changed.
-- teacher_review_items  per handed-in question the engine could not finish
--                       marking under D12 (method marks off until examiner
--                       sign-off, #499): one row per criterion ('method',
--                       'follow-through') with the cap a teacher may award
--                       (engine_awarded + available < marks_possible: a wrong
--                       final answer never reaches full marks) and the
--                       evidence shown to the teacher — the prompt, the
--                       working as read, the engine's line verdicts, the first
--                       break. Feedback only: it carries no mark.
-- teacher_marks         the TEACHER's decisions, append-only: award or decline,
--                       marks, an optional comment, who (teacher_account_id),
--                       when (created_at), which criterion, the engine's mark
--                       at that moment, WHICH INK the teacher judged (the
--                       SHA-256 of the handwritten page the server froze with
--                       the paper; null for typed work), and the row it
--                       supersedes. pri_server
--                       may INSERT and SELECT only: no UPDATE, no DELETE (the
--                       account erasure cascade still removes them).
--
-- No engine mark lives in these tables and none is written by the code that
-- writes them (server/platform/classroom.js): engine marks stay in the exam
-- result and its graded-attempt events, untouched.
--
-- Account-owned: pri_scope_required (fail closed without a declared scope) and
-- a RESTRICTIVE pri_account_scope policy admitting system scope or, in account
-- scope, only rows whose student_account_id or teacher_account_id is the
-- account — a direct column comparison, never a sub-select (no recursion,
-- 42P17). Teacher reads run in system scope behind server authorization
-- (class owner + active membership + consent), exactly as the class tables do
-- (20261019000000_rls_account_coverage.sql).
--
-- schema_version moves to 18 so a server that expects these tables refuses to
-- boot without them (fail closed).
-- Rollback: docs/release/rollback/20261118000000_teacher_workspace.rollback.sql
-- (drops the three tables: deletes every hand-in and teacher mark).
-- ─────────────────────────────────────────────────────────────────────────────

begin;

create table pri.assignment_handins (
  assignment_id text not null references pri.assignments(id) on delete cascade,
  student_account_id text not null references pri.accounts(id) on delete cascade,
  class_id text not null references pri.classes(id) on delete cascade,
  teacher_account_id text not null references pri.accounts(id) on delete cascade,
  exam_id text not null,
  paper_kind text not null,
  score integer not null check (score >= 0),
  total integer not null check (total >= 0),
  questions_json text not null,
  handed_in_at bigint not null,
  primary key (assignment_id, student_account_id),
  unique (student_account_id, exam_id)
);
create index idx_assignment_handins_class on pri.assignment_handins (class_id, handed_in_at);

create table pri.teacher_review_items (
  id text primary key,
  assignment_id text not null,
  class_id text not null references pri.classes(id) on delete cascade,
  student_account_id text not null references pri.accounts(id) on delete cascade,
  teacher_account_id text not null references pri.accounts(id) on delete cascade,
  exam_id text not null,
  question_key text not null,
  question_order integer not null,
  outcome_code text,
  subtopic text,
  marks_possible integer not null check (marks_possible >= 2),
  engine_awarded integer not null check (engine_awarded >= 0),
  criterion text not null check (criterion in ('method','follow-through')),
  available integer not null check (available >= 1 and engine_awarded + available < marks_possible),
  evidence_json text not null,
  created_at bigint not null,
  unique (assignment_id, student_account_id, question_key, criterion),
  foreign key (assignment_id, student_account_id) references pri.assignment_handins (assignment_id, student_account_id) on delete cascade
);
create index idx_teacher_review_items_class on pri.teacher_review_items (class_id, teacher_account_id, created_at);

create table pri.teacher_marks (
  id text primary key,
  review_item_id text not null references pri.teacher_review_items(id) on delete cascade,
  class_id text not null references pri.classes(id) on delete cascade,
  assignment_id text not null references pri.assignments(id) on delete cascade,
  student_account_id text not null references pri.accounts(id) on delete cascade,
  teacher_account_id text not null references pri.accounts(id) on delete cascade,
  criterion text not null check (criterion in ('method','follow-through')),
  decision text not null check (decision in ('award','decline')),
  marks integer not null check ((decision = 'decline' and marks = 0) or (decision = 'award' and marks >= 1)),
  comment text check (comment is null or length(comment) <= 1000),
  engine_awarded integer not null check (engine_awarded >= 0),
  ink_digest text check (ink_digest is null or length(ink_digest) = 64),
  supersedes text unique references pri.teacher_marks(id) on delete cascade,
  created_at bigint not null
);
create index idx_teacher_marks_item on pri.teacher_marks (review_item_id, created_at);

grant select, insert, update, delete on pri.assignment_handins to pri_server;
grant select, insert, update, delete on pri.teacher_review_items to pri_server;
-- Append-only for the server: a teacher mark is never edited or removed in place.
grant select, insert on pri.teacher_marks to pri_server;
revoke update, delete on pri.teacher_marks from pri_server;

do $$
declare
  t text;
begin
  foreach t in array array['assignment_handins', 'teacher_review_items', 'teacher_marks'] loop
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on pri.%I from anon, authenticated', t);
    end if;
    execute format('alter table pri.%I enable row level security', t);
    execute format('create policy pri_server_all on pri.%I as permissive for all to pri_server using (true) with check (true)', t);
    execute format($p$create policy pri_scope_required on pri.%I as restrictive for all to pri_server
      using (current_setting('pri.scope', true) in ('system', 'account'))
      with check (current_setting('pri.scope', true) in ('system', 'account'))$p$, t);
    execute format($p$create policy pri_account_scope on pri.%I as restrictive for all to pri_server
      using (current_setting('pri.scope', true) = 'system' or (current_setting('pri.scope', true) = 'account' and coalesce(current_setting('pri.account_id', true), '') <> ''
        and (student_account_id = current_setting('pri.account_id', true) or teacher_account_id = current_setting('pri.account_id', true))))
      with check (current_setting('pri.scope', true) = 'system' or (current_setting('pri.scope', true) = 'account' and coalesce(current_setting('pri.account_id', true), '') <> ''
        and (student_account_id = current_setting('pri.account_id', true) or teacher_account_id = current_setting('pri.account_id', true))))$p$, t);
  end loop;
end $$;

update pri.platform_meta set value = '18' where key = 'schema_version';

commit;
