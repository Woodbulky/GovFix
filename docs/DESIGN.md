# Design system

## About the mockup

`docs/mockups/v0-first-draft.png` is Studio's **first attempt, not the final design**. Treat it as a mood board and a layout sketch. Keep what works, fix what's listed below, and improve freely where this doc is silent.

**Keep:**
- The deep civic green identity and the NMC leaf mark.
- A landing page with two clear actions: talk or type.
- Category tiles with distinct icons.
- The NIVA call screen: avatar, waveform, Mute / End / Speaker.
- Complaint lists with photo thumbnails, status, officer and last update.
- The dark green staff sidebar.
- The 3-step report form.
- Triage cards with clear actions.
- The admin overview with SLA compliance and escalation counts.

**Change:**
- Rename Seva → **NIVA** everywhere. The call button says "Talk to NIVA".
- Status chips: sentence case with an icon ("In progress"), never ALL CAPS, never colour alone.
- Categories must match `config/workflow.yaml`: add Drainage and Stray animals; "Other" is routed by the Manager.
- Remove real Pune names (FC Road, Kothrud, Karve Nagar, Senapati Bapat Road). Use Navnagar wards and landmarks.
- Ticket format: `NMC-2026-000142`.
- Hero: replace the stock landscape photo with the **live 3D city of Navnagar** (poster image while it loads). This is the one bold element.
- Every place a request appears also shows its SlaBadge and, if escalated, its EscalationBadge.
- A triage card's main button opens the triage drawer (AI suggestion, duplicates, deadline preview). It doesn't triage instantly.
- Dashboard numbers and "+12% this week" deltas must be real queries or removed.
- Background moves from warm cream to a cool, faintly green paper tone.
- The language switch and large-text toggle are prominent on citizen screens.
- In the mockup the triage queue sits with the Dept Head. In the build it belongs to the Grievance Cell **Manager**; the Dept Head gets the board, assignment and escalations.

## Tokens

```css
:root {
  --nmc-green: #0F4C3A;   /* primary buttons, links, active nav */
  --nmc-green-600: #146B51;
  --canopy: #0A2E24;      /* staff sidebar, NIVA call screen */
  --paper: #F4F7F4;       /* app background */
  --surface: #FFFFFF;
  --ink: #15201B;         /* body text */
  --ink-muted: #56645D;
  --line: #D9E2DC;
  --marigold: #E8A317;    /* NIVA accent, highlights, focus ring on dark */
  --river: #2F6F8F;       /* map water, informational */

  /* status: [text, background] */
  --st-submitted: #475569; --st-submitted-bg: #EEF2F5;
  --st-triaged:   #8A5A00; --st-triaged-bg:   #FFF4D6;
  --st-assigned:  #9A3D0B; --st-assigned-bg:  #FFE9DC;
  --st-progress:  #1D4ED8; --st-progress-bg:  #E5EDFF;
  --st-info:      #6D28D9; --st-info-bg:      #F0E8FF;
  --st-resolved:  #166534; --st-resolved-bg:  #E3F5E9;
  --st-closed:    #4B5563; --st-closed-bg:    #F1F2F4;
  --st-rejected:  #991B1B; --st-rejected-bg:  #FDE8E8;
  --st-reopened:  #9D174D; --st-reopened-bg:  #FCE7F1;

  /* SLA */
  --sla-ok: #166534; --sla-risk: #B45309; --sla-breach: #B91C1C; --sla-paused: #6D28D9;

  --radius-sm: 6px; --radius-md: 10px; --radius-lg: 16px;   /* chips / inputs / cards; panels and the call screen use lg */
}
```

Every text/background pair must pass 4.5:1. Verify with a contrast checker in Phase 10.

## Typography

- **Headings: Anek Latin + Anek Devanagari** (Ek Type). A matched Latin/Devanagari family with a slightly condensed, signage-like voice that suits a municipal brand, and Marathi and English headlines look like one family. Weights 600–700.
- **Body and UI: Mukta** (Latin + Devanagari). Very readable at small sizes in both scripts. Weights 400, 500, 600.
- Self-host via `@fontsource`. No runtime Google Fonts.
- Scale (1.25): 14 / 16 / 20 / 25 / 31 / 39 / 49 px. Body 16 px.
- Line-height: 1.55 for English body, 1.7 for Devanagari body (set via `:lang(hi), :lang(mr)`). Headings 1.15 / 1.3.
- Timers and counts use `font-variant-numeric: tabular-nums`.
- Large-text mode scales the root to 118% and bumps touch targets to 52 px.

## Layout

- **Public and citizen:** top bar, single column. Forms max 640 px wide, lists max 880 px. Big touch targets (min 48 px). Left-aligned text.
- **Staff:** 240 px canopy sidebar, content max 1440 px. Dense tables (40 px rows), sticky headers, filter chips above tables.
- **Request detail:** 3 panels at ≥1280 px (left 32%, centre 36%, right 32%); stacked below.
- **City explorer:** full bleed, overlays at the corners, never covering the centre.

```
Citizen home                         Staff request detail (≥1280px)
┌──────────────────────────────┐     ┌──────┬────────────┬───────────┬───────────┐
│ NMC     EN हिं मरा  Aa  NIVA │     │ side │ Complaint  │ Stepper   │ AI panel  │
├──────────────────────────────┤     │ bar  │ photos     │ SLA clock │ Timeline  │
│ [   live 3D Navnagar hero   ]│     │      │ transcript │ Actions   │           │
│  Report a problem in your    │     │      │ mini-map   │           │           │
│  ward. [Talk to NIVA][Type]  │     └──────┴────────────┴───────────┴───────────┘
├──────────────────────────────┤
│ Your complaints (2)          │
│ ▢ Water leak · Due Thu 4 PM  │
└──────────────────────────────┘
```

## Components

- **StatusChip:** icon + sentence-case label + tinted background from the status tokens.
- **SlaBadge:** "Under review" (clock icon), "Due Thu 4:00 PM" (on track), "Due in 3h 10m" (at risk, amber), "Past deadline by 2h" (red), "Paused, waiting for you" (violet), "Done".
- **EscalationBadge:** "Escalated to Dept Head" (L1, amber ring) and "Escalated to Commissioner" (L2, red ring).
- **ProviderBadge:** small outline badge: AI (cloud), AI (local), Keywords, Photo AI, Human.
- **Stepper:** the 6 main states; branches (Needs info, Reopened, Rejected) shown inline where they happened.
- **Timeline:** actor avatar initials, role, action in plain words, time (sim time when shifted). Refused attempts appear for staff with a ⛔ and the reason.
- **Toasts for refusals:** state what was refused and why, and link to the audit row. Example: "Couldn't close NMC-2026-000142. A request is closed only after the citizen confirms the fix."

## NIVA call screen

Canopy background. The avatar (illustrated, friendly, not photorealistic) sits in a marigold ring that breathes while listening. A waveform under it follows the output volume. Captions appear in two styles: NIVA's words in white, the user's in a soft green. Desktop shows the draft card on the right, filling field by field with a subtle highlight on each change. Controls are 64 px circles: Mute, End (red), Speaker. "Switch to typing" is a text button under them. State text: Connecting… / Listening / Thinking / Speaking.

## Copy

- Plain verbs, sentence case, citizen's point of view. "Report a problem", "Track your complaint", "Yes, it's fixed", "Still a problem".
- An action keeps its name through the flow: the "Mark resolved" button produces a toast that says "Marked resolved".
- Errors say what happened and what to do. No apologies, no vagueness.
- Never accusatory. "Past deadline", not "delayed by officer".
- Marathi and Hindi strings are written natively, not machine-literal. Studio reviews them in Phase 10.

## Motion

One orchestrated moment: on home load, the camera eases into the city as pins drop in. Otherwise motion only answers actions: card snap-back on a refused drop, a draft field highlight, a stepper advance. Everything is off under `prefers-reduced-motion`.

## Avoid

All-caps labels, an eyebrow label above every heading, fake stats, gradient washes, identical cards for everything, stock photos of real places or people.
