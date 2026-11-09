# Privacy notice

**Last updated: 9 November 2026**

This notice explains what Pri Learning collects, why, and what you can ask us to
do about it. It is written for students and parents in India, and it is meant to
give you what India's Digital Personal Data Protection Act 2023 asks a notice
to give you. It has not yet been reviewed by a lawyer; the app says so above
this notice, and will stop saying so only when that review has happened.

The person responsible for your data (the "data fiduciary") is
Priysharan Tripathi, 5 Juniper Pl, Oakville NSW 2765, Australia.

## The short version

**You need a Pri Learning account, and a connection, to have answers checked.**
Marking is done online by our server: it issues each question, and its marking
engine — a fixed set of mathematical rules, not an AI model — decides the mark
for a signed-in account. A copy of that engine runs on your device only to show
your notation as you write and to display results recorded by earlier versions
of the app; it never sets the mark for a new answer. Signed out or offline,
nothing is checked or marked: the work you type or write is kept on your device
until it can be checked.

**Your handwriting and photos are read online.** When you write an answer by
hand or attach a photo, a picture of it is sent to our server, which passes it
to OpenAI to read. This is on for a signed-in account and can be turned off, in
which case you type your answers instead. The first time, the app asks your
permission, naming OpenAI, and nothing is sent until you agree. A second setting, off unless you turn
it on, sends your working to the same service to find where a mistake is. Both
are described below.

Without an account you can open the app and look around, but nothing about your
learning is sent anywhere — and nothing is marked.

## Where your data is stored

- **Our server** runs on Railway, a hosting provider. On 4 October 2026 the
  production service and its database volume were in Railway's `ams` region
  (Amsterdam, the Netherlands). Until the planned move described next, your
  account data is stored there, not in India.
- **Our database is planned to move** to Supabase in its Mumbai region
  (`ap-south-1`). This notice will be updated when that move has happened; until
  then, do not read it as saying your data is stored in India.
- **OpenAI** reads handwriting, photos and (if you turn it on) your working
  outside India.
- **Our email delivery provider and the app stores** process what they need in
  their own regions.

## What stays on your device

- Your profile: the name you typed, your class or track, and your settings.
- A copy of every question you have answered, your answers, your marks and your
  history. The marks themselves are decided by our server.
- Your handwriting strokes.
- Your streaks, badges and progress.

If you set a password on a profile, this data is encrypted at rest on the
device. A profile without a password is not encrypted. Whoever can unlock the
device can open a profile that has no password.

## What we receive if you create a cloud account

- **Your email address**, to sign you in and to send verification and password
  reset links and one-time sign-in codes. We do not offer sign-in by SMS; if we
  ever do, this notice will describe it first.
- **Your name**, as you typed it.
- **Your answers, for marking**: the question our server issued, the answer and
  working you submit, and the mark the server decided; your exam papers and
  results.
- **Learning events**: that you answered a question, which chapter it belonged
  to, whether you were right, and how long you took.
- **A picture of your handwriting, when you are signed in.** Your strokes stay
  on your device. Handwriting is read online: a picture of your writing is sent
  to our server and read there. This is on by default for a signed-in account
  and you can turn it off at any time in Settings → Handwriting, after which you
  type your answers; it stays off for an account under 18 until a parent or
  guardian has confirmed it, and it never runs without an account.

  **Nothing is sent until you agree.** The first time a picture would be sent —
  your handwriting, a photo of your working or a photo of a question — the app
  asks your permission once, naming OpenAI. If you say no, reading is turned
  off and you type your answers; if you turn it back on, you are asked again
  before the next picture. Your answer is kept on your device, for that
  profile, and the app asks again whenever what it tells you changes.

  When you write with a pencil or your finger, what is sent is an image drawn
  from your own stroke coordinates and nothing else: not the question, not the
  expected answer, not your name or profile.

  **The same setting also covers a photograph.** If you attach a photo of work
  done on paper, or a scanned PDF of it, that photograph is sent to be read by
  the same service. It is your camera's picture, resized and re-encoded but not
  otherwise altered — so whatever is in the frame is sent, which can include the
  printed question, a name written on the page, or anything else on the paper.
  Keep out of shot whatever you would not want sent, or type your working
  instead.

  Either way, our server passes it to an outside reading service — OpenAI, through
  its API — and keeps no copy of the picture: it is not written to our database,
  our storage or our logs. What we do keep is the text the reading service
  returned, and any correction you typed, for 90 days with the record of that
  answer. We ask the reading service not to store it. Under its own terms it
  does not use it to train its models, but it may hold a copy for a limited time
  to watch for abuse; we do not control that. Turning the setting off stops the
  next picture from being sent, and it stays off; a picture already sent cannot
  be recalled. What the reading service returns is a transcription of your
  writing, nothing more, and you can correct it before it counts: your mark is
  always decided by the marking engine on our server, never by the reading
  service.
- **Your working and the question, only if you switch that on.** There is a
  second setting, also off unless you turn it on, that sends the lines of
  working you wrote and the text of the question when an answer is wrong and
  the app cannot tell you which line went wrong. It is used to tell you where
  the mistake is. Our server keeps no copy; the checking service handles it as
  the reading service above does. The expected answer is never sent
  with it, and your name and profile are never sent with it. Your mark is
  decided by the marking engine on our server either way.
- **A parent or guardian's name and email address**, only for an account of
  someone under 18, so we can send them the confirmation link or code described
  under Children and show you, partly hidden, where it went.
- **Device information** needed to keep you signed in: a random device
  identifier this app generates (it is not your device's own id and not
  anything you typed), a one-way hash of your browser's user-agent string, and
  the times you signed in and were last seen.
- **Subscription status** from the App Store or Google Play, if you subscribe:
  whether a subscription is active, which plan, and when the paid period ends.
  Never your card details.
- **Crash reports**, while the Crash reports setting is on (it is on for a
  signed-in account and can be turned off for the device in Settings): the name
  of the screen that failed, a short error code, a fingerprint of the fault and
  the app's build number. Never the error message, the page address, the
  question, your writing or anything you typed.

## Children

Pri Learning is used by children. Under the DPDP Act, a child is anyone under
18, and a child's data may only be processed with verifiable consent from a
parent or guardian.

**What the app does today, plainly: it does not ask for your age or date of
birth.** It asks which class you are in, which tells it what maths to set you.
When you create a cloud account it asks whether you are 18 or older, and unless
you say you are, the account is treated as a child's. It then asks for a parent
or guardian's name and email address. We email them a link to confirm the
account, or a six-digit code, which they enter on their own page, on their own
device, after reading a short notice of what they are agreeing to. Until they
confirm, the account can sign in, show and export what it holds, and be
deleted, and nothing else: no answer is marked, no handwriting or photo is read,
and it does not sync, join a class, send a report, send a crash report,
subscribe, or use either server setting. The same email lets them withdraw at
any time, which stops all of that at once — marking, reading, exams and sync; a
withdrawn confirmation cannot be given again with the same link.

**If no parent or guardian has confirmed the account 30 days after it was
created**, or 30 days after a parent or guardian withdraws, the account is
closed: it stops working and every sign-in on it ends. Everything it holds is
erased 7 days later. A parent or guardian can also ask us to erase the account
without the child's login, from the link in our email or by writing to the
address under Your rights; it then stops working at once and is erased 7 days
later.

**What that confirmation proves, and what it does not.** It shows that someone
who can read that email inbox followed the link or entered the code. It does
not show that they are an adult, or that they are your parent or guardian, so
it is not the verifiable parental consent the DPDP Act will require. Our record
of it says which method was used, so nobody can mistake it for more than it is.

If you are under 18, please set this up with a parent or guardian and show them
this notice, particularly the section on what a cloud account sends. Answers
cannot be checked without an account; without one, nothing about your learning
leaves the device.

The DPDP Act's obligations on children's data, including verifiable parental
consent for anyone under 18, are expected to take effect in May 2027, eighteen
months after the DPDP Rules were notified in November 2025. Before then, and
before this app is offered to children at scale, the email confirmation has to
be replaced by a method that does verify the parent or guardian, and this
section rewritten to describe it.

We do not use children's data for advertising, we do not track children across
other services, and we do not build behavioural profiles for anything other than
choosing the next maths question.

## Who else sees your data

Only the services needed to run the parts you use:

- **Email delivery** (Resend) for verification links, password reset links,
  one-time codes and the confirmation sent to a parent or guardian. The delivery
  service sees the address and the message, as a postal service sees an
  envelope.
- **Apple and Google**, if you subscribe through the App Store or Google Play.
  We never see or store your card details; the store tells us only whether a
  subscription is active, which plan, and until when.
- **Our hosting and database providers** (Railway; Supabase after the planned
  move), which store and process it for us — see "Where your data is stored".
- **A handwriting reader** (OpenAI), while the handwriting-reading setting is
  on and you have agreed to send it, and only the image of your writing or the
  photo described above.
- **A step checker** (the same provider), only while the optional working-check
  setting is on, and only the working and question described above.

We do not sell your data. We do not share it for advertising.

## How long we keep it

- Data on your device stays until you delete the profile or the app.
- Learning events on our server are kept while your account is open.
- The record of each marked answer — the question, your answer and working,
  the transcription of your handwriting or photo with any correction you typed,
  and the mark — is kept for 90 days. After that your answer, your working and
  the transcription are gone; which question it was, whether it was right, the
  marks and the chapter stay in your learning history while your account is
  open.
- Exam papers, the answers you gave in them and their results are kept for up
  to five years, or until you delete your account, whichever comes first.
- Telemetry, including crash reports, is limited to an allow-list of fields and
  is deleted after 90 days.
- An account of someone under 18 that no parent or guardian has confirmed 30
  days after it was created, or 30 days after a parent or guardian withdrew, is
  closed then and erased 7 days later, as described under Children.
- When you delete your account it is deleted at once — there is no waiting
  period. That removes your profile, your sign-in details and every session,
  your synced work and answer records, your exam papers, your class memberships
  and submissions, your subscription link, your telemetry and any guardian's
  details. Your email address can then be used to create a new, empty account.
  Deleting the account does not cancel a subscription in the App Store or
  Google Play; cancel it there, or it will renew.
- Three things are kept after deletion, with nothing in them that identifies
  you: the record of any payment you made (amount, currency, date and the
  store's own reference), which tax and accounting law requires us to keep; any
  problem report you sent about a question, with everything you typed into it
  removed; and a log entry saying that an account was deleted, with no name or
  email.
- Backups of our database made before you deleted your account still contain
  it until they are replaced. Operational logs that contain no personal data
  may persist.

## Your rights

You can ask us to:

- **Show you** what we hold about you. The app exports it directly.
- **Correct** anything that is wrong.
- **Delete** your account and its data. You can do this inside the app, in
  Settings → Account, whichever way you sign in: with your password, with your
  Apple or Google sign-in, or with a code sent to your email address. If you no
  longer have the app, you can do it at
  [/account/delete-request](/account/delete-request) with a code sent to the
  account's email address. Either way the deletion is immediate, as described
  under "How long we keep it".
- **Withdraw consent**, after which we stop processing and delete.
- **Nominate** someone to exercise these rights if you cannot.

Write to impriysharan@icloud.com. See [Grievances](/grievance) for how
complaints are handled and how to escalate to the Data Protection Board of
India.

## Security

Passwords are stored only as bcrypt hashes. Sign-in tokens are stored as one-way
hashes. Verification and reset links are single-use, short-lived, and delivered
encrypted. One-time codes are never stored — only a keyed one-way hash of each
is — and they expire after ten minutes and five attempts. Connections use HTTPS.

No system is perfectly secure. If we discover a breach affecting your data, we
will tell you and the Data Protection Board as the DPDP Act requires.

## Changes

If we change this notice we will publish the new version here and, where the
change is significant, ask again for consent.

Questions: impriysharan@icloud.com.
