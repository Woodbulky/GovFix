# Problem statement and proof map

VORTEXA 3.0, Domain 7 (Government Systems & GovTech), **G-02 GovFix: Configurable Public-Institution Workflow Engine**.
Track chosen: **municipal grievance resolution** (one track, end to end; a generic dashboard across all five tracks does not qualify).

## G-02 requirements

| # | Requirement (paraphrased from the booklet) | Where we implement it | How judges see it live |
|---|---|---|---|
| R1 | Define the states a request can occupy and the allowed transitions. Refuse any skipped state or invalid move, with a clear reason | `config/workflow.yaml` → `workflow_transitions` table → `transition_request()` | Drag a card from Assigned to Closed on the Department Board: it snaps back with the reason, and an audit row appears |
| R2 | Restrict each status change to the roles permitted to make it. Enforce roles in the system itself, not only the UI. Record refused attempts | RLS, no write grants, role and guard checks inside `transition_request()`, refusals written to `audit_events` | API Console: act as the citizen and call `resolve` → `ROLE_NOT_PERMITTED`, logged |
| R3 | Give each request a deadline appropriate to the track. Identify overdue requests and escalate per workflow rules, visibly and on record | `sla_policies`, a 4h triage SLA, `run_escalation_sweep()` with pg_cron, an L1/L2 ladder | Time Machine: +25h → L1 to the Dept Head; +12h more → L2 to the Commissioner. Badges, notifications and audit rows appear |
| R4 | Audit history of accepted changes, refused attempts, assignments and escalations: who did what and when | Hash-chained `audit_events`, one row per attempt | Audit Log filtered to one ticket shows the full story. Verify chain ✓, tamper demo ✗ |
| R5 | AI may categorise, extract details or draft a response, shown alongside the request. It must not change status, assignment or deadline | `ai_suggestions` table; the `ai_writer` DB role has no write access to `requests`; human Accept/Edit/Dismiss | Triage drawer: AI chip with confidence and provider. Nothing changes until the Manager confirms |

## Common rules (all problem statements)

| Rule | How we satisfy it |
|---|---|
| Working MVP judges can test live | Full lifecycle in the browser with seeded demo users and a role switcher |
| Reproducible live testing | `npm run demo:reset` loads a fixed scenario; the sim clock makes SLA behaviour testable in seconds |
| Meaningful AI (classification, extraction, matching, adaptation; not just rewriting) | Multilingual categorisation (Marathi/Hindi/English, code-mixed), field extraction, multilingual-embedding duplicate detection, optional photo categorisation, voice intake through NIVA |
| Consequential decisions follow explicit, checkable rules; AI never silently overrides | The workflow table decides transitions and SQL decides deadlines. AI only suggests, and every acceptance is a logged human action |
| Fictional data only | Fictional city Navnagar, fictional people, `@navnagar.test` accounts, own or placeholder photos without faces or plates |
| No paid infra required; core demo must not depend on external AI; local fallback | Free tiers only (Vercel, Render, Supabase). Keyword classifier and on-server embeddings (onnxruntime + sentencepiece (int8)) need no external AI; typed flow if NIVA is down; 2D map if WebGL fails. An AI offline toggle proves it live |

## Phrases to use when pitching

- "The AI recommends; the workflow decides."
- "Even if our AI service were compromised, the database role it uses cannot change a request."
- "Refused attempts are evidence too, so we log them."
