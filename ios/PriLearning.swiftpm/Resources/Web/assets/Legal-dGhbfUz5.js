import{n as e}from"./rolldown-runtime-CbXtAM7H.js";import{c as t,m as n,t as r}from"./vendor-react-Dtm3F6TO.js";import{t as i}from"./preload-helper-BZ1Pz5am.js";import{t as a}from"./PageLink-DeEZeobu.js";import{n as o}from"./strings.en-DdHXwWL-.js";import{l as s,s as c}from"./i18n-BWo6NxCI.js";var l=e(n(),1),u=`# Privacy notice

**Last updated: 19 October 2026**

This notice explains what Pri Learning collects, why, and what you can ask us to
do about it. It is written for students, parents and teachers in India, and
follows the Digital Personal Data Protection Act 2023.

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
which case you type your answers instead. A second setting, off unless you turn
it on, sends your working to the same service to find where a mistake is. Both
are described below.

Without an account you can open the app and look around, but nothing about your
learning is sent anywhere — and nothing is marked.

## Where your data is stored

- **Our server** runs on Railway, a hosting provider. On 4 October 2026 the
  production service and its database volume were in Railway's \`ams\` region
  (Amsterdam, the Netherlands). Until the planned move described next, your
  account data is stored there, not in India.
- **Our database is planned to move** to Supabase in its Mumbai region
  (\`ap-south-1\`). This notice will be updated when that move has happened; until
  then, do not read it as saying your data is stored in India.
- **OpenAI** reads handwriting, photos and (if you turn it on) your working
  outside India.
- **Email and SMS delivery and payment providers** process what they need in
  their own regions.

COUNSEL REVIEW: the cross-border transfer position under the DPDP Act, the
contracting entities and the regions confirmed by each provider.

## What stays on your device

- Your profile: the name you typed, your class or track, and your settings.
- A copy of every question you have answered, your answers, your marks and your
  history. The marks themselves are decided by our server.
- Your handwriting strokes, and the model that adapts to your hand.
- Your streaks, badges and progress.

If you set a password on a profile, this data is encrypted at rest on the
device. A profile without a password is not encrypted. Whoever can unlock the
device can open a profile that has no password.

## What we receive if you create a cloud account

- **Your email address**, to sign you in and to send verification and password
  reset links and one-time sign-in codes — or **your mobile number**, if you
  sign in with a code sent by SMS instead; such an account has no email address
  on record.
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
  its API — and keeps no copy: it is not written to our database, our storage or
  our logs. What we do keep is the text the reading service returned, for 90
  days. We ask the reading service not to store it. Under its own terms it
  does not use it to train its models, but it may hold a copy for a limited time
  to watch for abuse; we do not control that. Turning the setting off stops it at
  once, and it stays off. What the reading service returns is a transcription of
  your writing, nothing more, and you can correct it before it counts: your mark
  is always decided by the marking engine on our server, never by the reading
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
  someone under 18 — or their mobile number in place of the email address — so
  we can send them the confirmation link or code described under Children and
  show you, partly hidden, where it went.
- **Device information** needed to keep you signed in: a random device
  identifier this app generates (it is not your device's own id and not
  anything you typed), a one-way hash of your browser's user-agent string, and
  the times you signed in and were last seen.
- **Subscription status** from your payment provider, if you subscribe.

## Children

Pri Learning is used by children. Under the DPDP Act, a child is anyone under
18, and a child's data may only be processed with verifiable consent from a
parent or guardian.

**What the app does today, plainly: it does not ask for your age or date of
birth.** It asks which class you are in, which tells it what maths to set you.
When you create a cloud account it asks whether you are 18 or older, and unless
you say you are, the account is treated as a child's. It then asks for a parent
or guardian's name and email address or mobile number. One of two things
happens next: we email them a link to confirm the account, or we send them a
six-digit code, which they enter on their own page, on their own device, after
reading a short notice of what they are agreeing to. Until they confirm, the
account can sign in, show and export what it holds, and be deleted, and nothing
else: it does not sync, join a class, send a report, send telemetry, subscribe,
or use either server setting. The same email, or a code sent to the same
mobile number, lets them withdraw at any time, which stops all of that at once;
a withdrawn confirmation cannot be given again with the same link.

**What that confirmation proves, and what it does not.** It shows that someone
who can read that email inbox, or who holds that mobile number, followed the
link or entered the code. It does not show that they are an adult, or that
they are your parent or guardian, so it is not the verifiable parental consent
the DPDP Act will require. Our record of it says which method was used, so
nobody can mistake it for more than it is.

If you are under 18, please set this up with a parent or guardian and show them
this notice, particularly the section on what a cloud account sends. Answers
cannot be checked without an account; without one, nothing about your learning
leaves the device.

The DPDP Act's substantive obligations — including verifiable parental consent
for anyone under 18 — commence on 14 May 2027. Before then, and before this app
is offered to children at scale, the email confirmation has to be replaced by a
method that does verify the parent or guardian, and this section rewritten to
describe it.

We do not use children's data for advertising, we do not track children across
other services, and we do not build behavioural profiles for anything other than
choosing the next maths question.

## Who else sees your data

Only the services needed to run the parts you use:

- **Email delivery** for verification links, password reset links and one-time
  codes, and **SMS delivery** for one-time codes sent to a mobile number. The
  delivery service sees the address or number and the message, as a postal
  service sees an envelope.
- **Payment providers** if you subscribe. We never see or store your card
  details; the provider tells us only whether a subscription is active.
- **Our hosting and database providers** (Railway; Supabase after the planned
  move), which store and process it for us — see "Where your data is stored".
- **A handwriting reader** (OpenAI), while the handwriting-reading setting is
  on, and only the image of your writing or the photo described above.
- **A step checker** (the same provider), only while the optional working-check
  setting is on, and only the working and question described above.

We do not sell your data. We do not share it for advertising.

## How long we keep it

- Data on your device stays until you delete the profile or the app.
- Learning events on our server are kept while your account is open.
- When you delete your account it is deleted at once — there is no waiting
  period. That removes your profile, your sign-in details and every session,
  your synced work, your class memberships and submissions, your subscription
  link, your telemetry and any guardian's details. Your email address can then
  be used to create a new, empty account.
- Three things are kept after deletion, with nothing in them that identifies
  you: the record of any payment you made (amount, currency, date and the
  payment provider's own reference), which tax and accounting law requires us
  to keep; any problem report you sent about a question, with everything you
  typed into it removed; and a log entry saying that an account was deleted,
  with no name or email.
- Backups of our database made before you deleted your account still contain
  it until they are replaced. Operational logs that contain no personal data
  may persist.
- Telemetry is limited to an allow-list of fields and is deleted after 90 days.

## Your rights

You can ask us to:

- **Show you** what we hold about you. The app exports it directly.
- **Correct** anything that is wrong.
- **Delete** your account and its data. You can do this inside the app, in
  Settings → Account, whichever way you sign in: with your password, with your
  Apple or Google sign-in, or with a code sent to your email address or mobile
  number. If you no longer have the app, you can do it at
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
`,d=`# Terms of use

**Last updated: 19 October 2026**

These terms are an agreement between you and Priysharan Tripathi,
5 Juniper Pl, Oakville NSW 2765, Australia, about your use of Pri Learning.

## Using Pri Learning

You may use Pri Learning to learn mathematics. You may not resell it, copy its
question bank for another product, or use it to build a competing service.

If you are under 18, a parent or guardian must agree to these terms for you.

## Your account

You are responsible for keeping your password. Tell us at impriysharan@icloud.com if
you think someone else has used your account. We may suspend an account that is
being used to attack the service or to harm other users.

## What the app is, and is not

Pri Learning generates practice questions, reads handwriting, marks working and
estimates progress. It is a practice tool.

**It does not predict a percentile, a rank or an admission**, and it never
converts practice into a CBSE percentage. What it does show, on the progress
screen, is an estimate of the marks you would score on the parts of a paper you
have actually practised — stated as a range, with how much of the paper it
covers, and never scaled up to the parts you have not touched. Where any figure
is shown, the app states what produced it. Nothing here is a guarantee of any
mark, rank or admission.

Marking is automatic and can be wrong. If you believe a question was marked
incorrectly, tell us — it helps us fix it — but a mark inside Pri Learning has
no standing outside it.

## Subscriptions

The free plan includes a daily allowance of practice questions and a periodic
exam simulation; the app tells you what it is and when it resets. A paid
subscription removes those limits and unlocks the features listed at the point
of purchase.

Subscriptions renew automatically until cancelled. Prices are shown before you
pay. Cancel any time; see the [refund policy](/refund-policy).

If you subscribe through Apple, Apple handles billing, renewals and refunds
under its own terms, and you manage the subscription in your Apple account.

## Content

Questions, solutions and explanations are ours. Your work is yours: what you
write and answer belongs to you, and we claim no ownership of it.

Pri Learning follows the NCERT syllabus and public examination patterns. It is
not endorsed by, affiliated with or approved by NCERT, CBSE, the NTA or any
examination authority.

## Availability

We try to keep the service running, but we do not promise it will always be
available. Answers are checked online by our server, so checking needs an
account and a network, and may be interrupted for maintenance. Work you do while
offline is kept on your device until it can be checked.

## Liability

To the extent the law allows, we are not liable for indirect or consequential
loss. Nothing here limits liability that cannot be limited by law, including for
death, personal injury or fraud.

## Ending it

You may stop using Pri Learning and delete your account at any time. We may end
your access if you break these terms.

## Law

These terms are governed by the laws of India, and the courts of
New Delhi have exclusive jurisdiction.

Questions: impriysharan@icloud.com.
`,f=`# Cancellation and refund policy

**Last updated: 19 October 2026**

This policy covers subscriptions bought from Priysharan Tripathi through the
website. Subscriptions bought inside the iPad app are handled by Apple under its
own refund policy, and are cancelled and refunded through your Apple account.

## Cancelling

You can cancel a website subscription at any time from **Settings → Account**.

Cancelling stops the next renewal. Your subscription stays active until the end
of the period you have already paid for, and then returns to the free plan. Your
work, history and progress are not deleted when a subscription ends.

## Refunds

- **Within 7 days of a first purchase**, if you have not used more than a
  nominal amount of the paid features, we refund in full on request.
- **A renewal you did not intend**: tell us within 7 days of the charge and we
  refund it, provided the new period has been largely unused.
- **A service fault** that made the paid features unusable for a significant
  part of a period: we refund that part.

We do not refund a period you have used, or a subscription cancelled part-way
through a period, except in the cases above.

## How to ask

Write to impriysharan@icloud.com from the email address on the account, with the date
of the charge. We reply within 3 working days and, where a refund is due, issue
it to the original payment method within 5 to 7 working days. Your bank may take
longer to show it.

## Disputes

If you are not satisfied with our answer, see [Grievances](/grievance).
`,p=`# Grievances

**Last updated: 19 October 2026**

If something about your data or your subscription is wrong, tell us. This page
says who reads it and what happens next.

## Grievance officer

- Priysharan Tripathi
- Priysharan Tripathi
- 5 Juniper Pl, Oakville NSW 2765, Australia
- impriysharan@icloud.com

Publishing this contact is required of us by India's Digital Personal Data
Protection Act 2023.

## What to include

- The email address on your account, if you have one.
- What happened, and when.
- What you would like us to do.

You do not need to quote the law or use any particular form.

## What we do

1. We acknowledge your message within **3 working days**.
2. We investigate and reply with an answer or a plan within **30 days**, which
   is the period the DPDP Act allows.
3. If we need longer, we say why and when we will answer.

For a request to see, correct or delete your data, we act within the same
period. Deletion is permanent.

## If we do not resolve it

You may complain to the **Data Protection Board of India**. You are expected to
have raised it with us first, which is what this page is for.

## Subscriptions

For billing questions write to impriysharan@icloud.com; see the
[refund policy](/refund-policy). If a payment provider handled the charge, you
may also raise it with them.
`,m=r(),h=Object.freeze({privacy:{source:u},terms:{source:d},"refund-policy":{source:f},grievance:{source:p}});function g(e){return[...new Set(String(e||``).match(/\{\{[A-Z_]+\}\}/g)||[])]}function _(e){return String(e||``).match(/^#[ \t]+(.+)$/m)?.[1].trim()||``}var v=null,y=null;function b(){return v?Promise.resolve(v):(y||=i(()=>import(`./legalHindi-CC1D42-C.js`).then(e=>(v=e.default,v)),[]).catch(()=>(y=null,null)),y)}function x(e,t){let n=[],r=String(e),i=0,o=/\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)]+)\)|`([^`]+)`/;for(;;){let e=r.match(o);if(!e){r&&n.push(r);break}if(e.index>0&&n.push(r.slice(0,e.index)),e[1])n.push((0,m.jsx)(`b`,{children:e[1]},`${t}-b${i}`));else if(e[2]){let r=e[3];n.push(r.startsWith(`/`)&&!r.startsWith(`/account/`)?(0,m.jsx)(a,{to:r,children:e[2]},`${t}-l${i}`):(0,m.jsx)(`a`,{href:r,rel:`noreferrer noopener`,target:`_blank`,children:e[2]},`${t}-a${i}`))}else e[4]&&n.push((0,m.jsx)(`code`,{children:e[4]},`${t}-c${i}`));r=r.slice(e.index+e[0].length),i+=1}return n}function S(e){let t=[],n=null,r=!1,i=null,a=()=>{n&&=(t.push({kind:r?`ol`:`ul`,items:n}),null)},o=()=>{i&&=(t.push({kind:`p`,text:i}),null)},s=()=>{a(),o()};for(let c of String(e).split(`
`)){let e=c.replace(/\s+$/,``);if(!e.trim()){s();continue}let l=e.match(/^\s*[-*]\s+(.*)$/),u=e.match(/^\s*\d+[.)]\s+(.*)$/);if(l||u){o(),n&&r!==!!u&&a(),r=!!u,(n||=[]).push((l||u)[1]);continue}let d=e.match(/^(#{1,4})\s+(.*)$/);if(d){s(),t.push({kind:`h${d[1].length}`,text:d[2]});continue}if(/^\|/.test(e)){s(),t.push({kind:`p`,text:e.replace(/\|/g,` `).trim()});continue}let f=e.trim();n?n[n.length-1]+=` ${f}`:i=i?`${i} ${f}`:f}return s(),t}function C({source:e}){let t=(0,l.useMemo)(()=>S(e),[e]);return(0,m.jsx)(m.Fragment,{children:t.map((e,t)=>{if(e.kind===`ul`||e.kind===`ol`){let n=e.items.map((e,n)=>(0,m.jsx)(`li`,{children:x(e,`${t}-${n}`)},n));return e.kind===`ol`?(0,m.jsx)(`ol`,{children:n},t):(0,m.jsx)(`ul`,{children:n},t)}return e.kind===`h1`?null:e.kind===`h2`?(0,m.jsx)(`h2`,{style:{marginTop:26},children:x(e.text,t)},t):e.kind===`h3`?(0,m.jsx)(`h3`,{style:{marginTop:20},children:x(e.text,t)},t):e.kind===`h4`?(0,m.jsx)(`h4`,{children:x(e.text,t)},t):(0,m.jsx)(`p`,{children:x(e.text,t)},t)})})}function w(){let e=t().pathname.replace(/^\/+|\/+$/g,``),n=h[e],{language:r,t:i}=c(),u=s(),[d,f]=(0,l.useState)(null),p=d??r,[y,x]=(0,l.useState)(v),[S,w]=(0,l.useState)(!1);(0,l.useEffect)(()=>{if(p!==`hi`||y||S)return;let e=!0;return b().then(t=>{e&&(t?x(t):w(!0))}),()=>{e=!1}},[p,y,S]);let T=e=>_(p===`hi`&&y?.[e]||h[e].source);if(!n){let e=Object.keys(h).map((e,t,n)=>(0,m.jsxs)(l.Fragment,{children:[(0,m.jsx)(a,{to:`/${e}`,children:T(e)}),t<n.length-1?` · `:``]},e));return(0,m.jsxs)(`div`,{className:`qpage`,children:[(0,m.jsx)(`h1`,{children:i(`legal.notFoundTitle`)}),(0,m.jsx)(`p`,{className:`muted`,children:u(`legal.notFoundBody`,{pages:e})})]})}let E=p===`hi`?y?.[e]:null,D=E||n.source,O=g(D);return(0,m.jsxs)(`div`,{className:`qpage`,style:{maxWidth:720},children:[(0,m.jsx)(`h1`,{children:_(D)}),(0,m.jsx)(`div`,{className:`seg-tabs`,role:`group`,"aria-label":i(`legal.languageLabel`),style:{marginTop:0,marginBottom:18},children:o.map(({id:e,label:t})=>(0,m.jsx)(`button`,{type:`button`,className:`seg-tab${p===e?` on`:``}`,"aria-pressed":p===e,onClick:()=>{f(e),w(!1)},children:t},e))}),p===`hi`&&!E&&S&&(0,m.jsx)(`div`,{className:`notice`,role:`status`,style:{marginBottom:18},"data-legal-fallback":`true`,children:i(`legal.translationUnavailable`)}),O.length>0&&(0,m.jsxs)(`div`,{className:`notice error`,role:`alert`,style:{marginBottom:18},"data-legal-draft":`true`,children:[(0,m.jsx)(`b`,{children:i(`legal.draftTitle`)}),` `,i(`legal.draftBody`,{count:O.length,n:O.length})]}),(0,m.jsx)(`article`,{className:`legal-body`,lang:E?`hi`:`en`,children:(0,m.jsx)(C,{source:D})}),(0,m.jsx)(`p`,{className:`muted`,style:{marginTop:28},children:Object.keys(h).filter(t=>t!==e).map((e,t,n)=>(0,m.jsxs)(l.Fragment,{children:[(0,m.jsx)(a,{to:`/${e}`,children:T(e)}),t<n.length-1?` · `:``]},e))})]})}export{h as LEGAL_PAGES,S as blocksOf,w as default,g as placeholdersIn,_ as titleOf};