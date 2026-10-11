# PRD: GovFix for Navnagar Municipal Corporation

## Problem

Navnagar's complaints arrive by phone, WhatsApp and walk-ins. They stall between departments, deadlines pass unnoticed, nobody can say who changed what, and citizens hear nothing for weeks. GovFix gives every complaint a defined path, an owner at every stage, a deadline, automatic escalation and a verifiable history. NIVA lets anyone file and follow up by voice in their own language.

## Users and hierarchy

```
                       Commissioner (admin)
                      /                    \
   Grievance Cell Manager            Department Heads (WTR, SWM, RDS, ELE, SAN, HLT)
   (central intake, all depts)                 |
                                         Field Officers (per department, per ward coverage)

   Citizens file requests. SYSTEM (the escalation sweeper) acts on timers.
```

| Role | Does | Cannot |
|---|---|---|
| Citizen | File (voice or typed), add photos, reply to info requests, confirm a fix or reopen, track | See other citizens' requests or any staff action |
| Field Officer | Start work, ask the citizen for info, resolve with a proof photo, all only on requests assigned to them | Triage, assign, close, or touch other officers' requests |
| Department Head | Assign and reassign within their department, reroute misrouted requests back to the Grievance Cell, handle L1 escalations, watch officer workload | Triage, close, or act outside their department |
| Grievance Cell Manager | Triage every new request (confirm category, which sets department and deadline), reject with a reason code, merge duplicates | Assign officers, resolve, close |
| Commissioner | See everything, handle L2 escalations, assign or reassign in any department, edit SLA policy, view and verify the audit log, run the Time Machine and API Console (demo mode) | Resolve or close on a citizen's behalf |
| SYSTEM | Escalate on SLA breach, auto-close after 72h of citizen silence | Anything else |

### Why both a Manager and a Department Head

Triage and assignment need different knowledge. Triage ("what is this and which department owns it?") needs a cross-department view, so one central Grievance Cell does it for the whole city. Assignment ("which officer, given ward coverage and workload?") needs department knowledge. Splitting them gives every stage exactly one accountable person, makes misrouting fixable (the Dept Head reroutes with a reason), and gives escalation a natural ladder.

### Who is accountable at each stage

| Stage | Accountable | Clock | On breach |
|---|---|---|---|
| SUBMITTED | Grievance Cell Manager | Triage SLA, 4h from submission | L1 → Commissioner |
| TRIAGED, REOPENED | Department Head | Resolution SLA | L1 → Dept Head, L2 → Commissioner |
| ASSIGNED, IN_PROGRESS | Field Officer | Resolution SLA | L1 at 100% → Dept Head, L2 at 150% → Commissioner |
| NEEDS_INFO | Citizen | Paused | None |
| RESOLVED | Citizen | Auto-close after 72h | SYSTEM closes |

## Demo users (password from `DEMO_PASSWORD`)

| Email | Role | Name | Scope |
|---|---|---|---|
| sunita@navnagar.test | citizen | Sunita Jadhav | Prefers Marathi, lives in Ward 7 |
| ramesh@navnagar.test | citizen | Ramesh Shinde | Prefers Hindi, Ward 3 |
| aisha@navnagar.test | citizen | Aisha Khan | Prefers English, Ward 5 |
| patil@navnagar.test | officer | Ganesh Patil | WTR, wards 5–8 |
| kale@navnagar.test | officer | Priya Kale | WTR, wards 1–4, 9, 10 |
| more@navnagar.test | officer | Sachin More | ELE, all wards |
| shaikh@navnagar.test | officer | Imran Shaikh | RDS, all wards |
| gaikwad@navnagar.test | officer | Rohit Gaikwad | SWM, all wards |
| pawar@navnagar.test | officer | Neha Pawar | SAN, all wards |
| joshi@navnagar.test | officer | Anil Joshi | HLT, all wards |
| deshmukh@navnagar.test | dept_head | Vikram Deshmukh | WTR |
| bhosale@navnagar.test | dept_head | Swati Bhosale | SWM |
| wagh@navnagar.test | dept_head | Sameer Wagh | RDS |
| rao@navnagar.test | dept_head | Kavita Rao | ELE |
| sawant@navnagar.test | dept_head | Prakash Sawant | SAN |
| sayyed@navnagar.test | dept_head | Dr. Farida Sayyed | HLT |
| meera@navnagar.test | manager | Meera Kulkarni | Grievance Cell |
| commissioner@navnagar.test | commissioner | Rajesh Naik | City |

## Screens and tabs

The header on every screen shows: NMC logo, language switch (EN / हिंदी / मराठी), large-text toggle, a NIVA button, a "Sim time" badge when the clock is shifted, and the user menu. In demo mode the user menu has the role switcher. Staff screens use a left sidebar; citizen and public screens use a top bar.

### Public (no login)

1. **Home.** The hero is the live 3D city of Navnagar, slowly orbiting, with open complaints as anonymised pins. Headline and two actions: **Talk to NIVA** and **Report by typing**. Below: category tiles (from DB), "How it works" (Report → Reviewed in 4 hours → Fixed by the department → You confirm), and departments with their SLA hours read from `sla_policies`.
2. **Explore Navnagar.** Full-screen city explorer (docs/CITY.md). Pins show category, status, ward and age only. No descriptions, no photos.
3. **Track a complaint.** Ticket number + last 4 digits of phone → status stepper, public timeline, deadline, department.
4. **Departments.** One card per department: what it handles, categories, SLA hours.

### Citizen

1. **Home.** Greeting, open complaints at a glance (each with StatusChip and SlaBadge), a big "Talk to NIVA" button, "Report by typing".
2. **Report an issue.**
   - **Talk mode:** the NIVA call screen. Avatar, waveform, live captions, and a "What NIVA understood" draft card filling in beside it (issue, place, since when, photos). Mute / End / Speaker, plus "Switch to typing" always visible. Submission only after NIVA reads back and the citizen says yes.
   - **Type mode:** 4 steps. (1) Issue: category tiles (with a "Not sure" option), description, optional voice note. (2) Location: tap the spot on the city (3D, or 2D fallback), or choose ward + landmark; shows "Near Ghantaghar, Ward 7". (3) Photos: up to 3, compressed, EXIF stripped. (4) Review → **Submit complaint**.
   - **Success:** large ticket number, "We'll review it within 4 hours", a 🔊 Listen button, links to track it.
3. **My complaints.** Tabs: All, Needs your reply, Open, Resolved, Closed. Card: photo thumbnail, ticket, title, place, StatusChip, SlaBadge ("Under review" before triage, then "Due Thu 4:00 PM"), officer name, last update, 🔊.
4. **Complaint detail.** Status stepper; public timeline (state changes and messages; never internal notes or staff refusals); your photos and the officer's proof photos; actions only when valid: **Send reply** (NEEDS_INFO), **Yes, it's fixed** or **Still a problem** with a reason (RESOLVED, within 7 days).
5. **Explore Navnagar.** Same explorer; your own complaints highlighted and opening with photos.
6. **Notifications.** Each update with a voice note in your language (ElevenLabs; browser voice fallback).
7. **Profile & accessibility.** Language, text size, phone (fictional).

### Field Officer

1. **My work.** Tabs: Assigned, In progress, Needs info, Awaiting citizen. Sorted by time left. Row: photo, ticket, category, ward and landmark, SlaBadge countdown, EscalationBadge.
2. **Request detail.** Actions: **Start work**; **Ask citizen for info** (question box, sent as text plus a voice note); **Mark resolved** (resolution note + proof photo, both required). The AI draft reply is available to edit and send.
3. **Explore Navnagar.** My requests only, a "Next by deadline" button that flies to the most urgent one, walk mode for the street view of the location.
4. **Notifications.**

### Department Head

1. **Department board.** Kanban columns: Triaged, Assigned, In progress, Needs info, Resolved, Reopened. Cards are draggable. Dropping on Assigned opens the officer picker. An invalid drop snaps back with a toast ("Assigned → Closed isn't allowed. The citizen confirms a fix.") and the refusal is logged.
2. **To assign.** Triaged and reopened requests. The officer picker shows open workload and ward coverage. Ineligible officers are greyed out with the reason ("Doesn't cover Ward 7").
3. **Escalations.** L1 requests in my department: how far past the deadline, current officer, actions **Reassign** and **Add note**.
4. **Officers.** Workload table: open, past deadline, average resolution hours.
5. **Request detail.** Also **Send back to Grievance Cell** (reroute, with reason).
6. **Explore Navnagar.** Filtered to my department, with the per-ward breach tint.

### Grievance Cell Manager

1. **Triage queue.** SUBMITTED requests, oldest first, each with its 4h triage countdown. Card: photo, description, transcript excerpt, language, ward and landmark, AI chips.
   - **Triage drawer:** AI category suggestion (confidence, ProviderBadge, one-line rationale); extracted fields highlighted in the original text; possible duplicates with side-by-side compare; a preview line "Will go to Water Supply · due Fri 10:40 AM". Actions: **Confirm and send to department**, **Merge as duplicate**, **Reject** (reason code + text).
2. **Duplicates.** AI-flagged pairs awaiting a decision.
3. **All requests.** Searchable, filterable table.
4. **Explore Navnagar.** Whole city.

### Commissioner

1. **Overview.** Live tiles: open by state, SLA compliance (on time / past deadline), past deadline now, L1 and L2 counts. Charts: requests by department, average resolution hours by category. City mini-map with per-ward breach tint. Everything computed from the DB.
2. **All requests.**
3. **Escalations.** L1 and L2 across the city.
4. **Audit log.** Filterable table (time, actor, role, channel, ticket, action, from → to, outcome, reason, hash prefix). **Verify chain** → "Chain intact · 412 entries" or "Chain broken at entry #187". **Tamper demo** (demo mode only).
5. **Workflow & SLA.** State diagram rendered from `workflow_transitions`, a transition table (action, from, to, roles, guards), and an SLA editor. Edits are versioned and logged, and only affect new triages.
6. **Time Machine** (demo mode). +1h / +4h / +12h / +1 day / custom, "Run escalation check now", **AI offline** toggle, **Reset demo scenario**.
7. **API Console** (demo mode). Pick an acting user, a ticket and an action with payload, then send. Shows the raw JSON response and links to the audit row it created.
8. **Users.** Demo users and their roles (read-only).

## Shared building blocks

- **Request detail layout.** At ≥1280px, three panels: left = complaint (text, transcript, audio, photos, location mini-map); centre = stepper, SLA clock with paused periods shaded, role-valid action buttons; right = AI Suggestions card and this request's audit timeline. Below 1280px the panels stack.
- **SlaBadge.** States: Under review (untriaged), On track, At risk (≥75%), Past deadline, Paused (NEEDS_INFO), Done. Each has text plus an icon, never colour alone. Countdowns use tabular numbers.
- **EscalationBadge.** L1 / L2 with who it's escalated to.
- **ProviderBadge.** llm / local / keyword / vision / human.

## Notifications

| Event | Notified |
|---|---|
| Submitted | Citizen |
| Triaged | Citizen, Dept Head |
| Assigned / reassigned | Officer, citizen |
| Needs info | Citizen (text + voice note) |
| Resolved | Citizen (text + voice note) |
| Reopened | Dept Head, previous officer |
| Rerouted | Manager |
| Triage L1 | Commissioner |
| Resolution L1 | Dept Head, officer |
| Resolution L2 | Commissioner, Dept Head |
| Auto-closed | Citizen |

## Demo script (5 minutes)

1. **Voice intake.** As Sunita, tap Talk to NIVA. In Marathi: "आमच्या गल्लीत दोन दिवसांपासून पाणी गळतंय, घंटाघर चौकाजवळ." NIVA asks one follow-up, offers a photo, reads back, she says "हो". Ticket NMC-2026-000142 appears, channel voice.
2. **City.** The new pin drops near Ghantaghar in Ward 7. Fly in, walk the street, see the leak prop and her photo.
3. **Triage.** As Meera: AI chip "Water leak · 0.94 · llm" and "Possible duplicate NMC-2026-000131 · 0.81". She opens the compare, decides it's a different lane, confirms the category. The deadline is computed by SQL.
4. **Assign.** As Deshmukh: drag to Assigned, pick Officer Patil (Ward 7 covered; Kale greyed out with a reason). Drag the card to Closed: refused, toast, logged.
5. **API Console.** Act as Sunita, call `resolve` → `ROLE_NOT_PERMITTED`. Act as Officer More, call `start` → `GUARD_FAILED:is_assigned_officer`. Both logged.
6. **Time Machine.** +20h → amber. +5h → L1 to Deshmukh, red badge, Sunita gets a Marathi voice update.
7. **Resolve and reopen.** As Patil: start, resolve with a proof photo. As Sunita: "Still a problem" → REOPENED with a fresh deadline.
8. **Audit.** As Commissioner, filter on 000142 to see every step, including the refusals. Verify ✓, tamper demo, verify ✗ at the exact row.
9. **AI offline.** Flip the toggle and file a typed complaint. The chip says `keyword`, and the workflow is unaffected.

## Out of scope

Real phone numbers and SMS, payments, real maps or GIS, a native mobile app, role administration UI, multiple cities.
