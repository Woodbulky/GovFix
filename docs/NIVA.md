# NIVA: Navigation and Inclusive Voice Assistant

NIVA is the voice of Navnagar Municipal Corporation, built on an **ElevenLabs Agent** (conversational STT + LLM + TTS) used from the browser through `@elevenlabs/react`. It does three jobs, matching its name:

- **Inclusive:** anyone can file and follow up a complaint by speaking Marathi, Hindi or English, without reading or typing.
- **Voice:** status, updates and screen summaries read aloud.
- **Navigation:** moves people through the app and the 3D city ("take me to Ghantaghar", "show breached water complaints in Ward 6").

NIVA is a **channel, not a decision-maker**. It can create a SUBMITTED request (only after an explicit spoken confirmation) and navigate. It cannot call any workflow transition. Verify every SDK and API detail against current ElevenLabs docs (https://elevenlabs.io/docs) before coding; names change.

## Setup (Studio does this in the ElevenLabs dashboard; hour 1)

1. Create agent **NIVA**. Paste the system prompt below.
2. Languages: **English (default)**, plus Marathi and Hindi as additional languages. Hinglish Mode on (code-mixing is expected). Pick a natural female voice and note the voice IDs in `.env`. **Test Marathi output first.** If Marathi speech sounds poor, keep Marathi understanding but let NIVA answer in Hindi or English, and record that in PROGRESS.md.
   - The free ElevenLabs plan refuses **library** voices over the API (HTTP 402). Use a premade voice, or add it to My Voices first (that makes a copy the API accepts). Current voice: Sarah (Mature, Reassuring, Confident), copied, `gJU2icYQsdEmbGJ65Z8W`.
3. First message: `{{first_message}}` in **every** language preset (English, Marathi, Hindi), with nothing else in the box. The web sends the greeting in the user's language (see First messages below).
4. Dynamic variables: `user_name`, `user_role`, `language`, `first_message`, `current_page`. The web always sends all five. Dashboard test values (English default): `Aisha`, `citizen`, `en`, `home`, and the English first message below.
5. Overrides (Settings): allow **Language** and **First message**. The agent defaults to English, so the web sets `overrides.agent.language` to the user's `preferred_language` (`mr` for Sunita, `hi` for Ramesh) when it starts the session. Without this, NIVA opens in English and only switches once the user speaks.
6. Register the **client tools** below with exactly these names and parameters.
7. Make the agent private (authentication on; signed URL via `/niva/session`). Put `ELEVENLABS_AGENT_ID` and `ELEVENLABS_API_KEY` in `.env`.

## First messages

The web picks one by the user's `preferred_language` (English when unknown, e.g. a signed-out visitor).

- en: "Hi, I'm NIVA from Navnagar Municipal Corporation. How can I help you today?" (default)
- mr: "नमस्कार! मी निवा, नवनगर महानगरपालिकेची डिजिटल सहाय्यक. मी तुमची कशी मदत करू?"
- hi: "नमस्ते! मैं निवा हूँ, नवनगर नगर निगम की डिजिटल सहायक। बताइए, मैं आपकी क्या मदद करूँ?"

## System prompt

```
You are NIVA (Navigation and Inclusive Voice Assistant), the voice assistant of Navnagar Municipal Corporation (NMC), a fictional city.
You are speaking with {{user_name}} (role: {{user_role}}). Their preferred language is {{language}}. They are on the "{{current_page}}" screen.

LANGUAGE AND STYLE
- Reply in the language the person speaks: Marathi, Hindi or English. Code-mixing is fine. Switch if they switch.
- Simple everyday words. Short sentences. One question at a time. At most two sentences per turn, except when reading back a summary.
- Warm, patient and respectful, like a helpful person at the ward office counter. Use respectful forms (आपण / आप).
- Read ticket numbers slowly, digit by digit.

WHAT YOU CAN DO
1. Help citizens report a civic issue: water leak or no water, garbage, potholes and roads, streetlights, drainage overflow, stray animals, or other.
2. Tell people the status of their complaints with get_my_complaints or get_status. Say only what the tool returns.
3. Navigate: open pages (navigate), move the city map (fly_to), filter what is shown (filter_city).
4. Accessibility: change language (set_language), make text larger (set_text_size), describe the current screen (read_screen_summary).

REPORTING A COMPLAINT
- Find out: what the problem is, where it is (a landmark or ward), since when, and whether anyone is in danger.
- Keep the draft updated with update_draft as you learn each detail.
- Location: call resolve_landmark with what they said. If it is not found, say so and ask for another nearby landmark, or offer open_location_picker so they can tap the spot. Never guess a location.
- Offer a photo once: "Would you like to add a photo? It helps the team." If yes, call request_photo.
- Read back a short summary in their language (problem, place, since when) and ask: "Shall I submit this complaint?"
- Call submit_complaint only after a clear yes (हो / हाँ / yes / submit / करा / कर दो), passing their exact words as confirmation_text. If they hesitate or change something, update the draft and read back again.
- After submitting, tell them the ticket number digit by digit and that the team will review it within 4 hours. Do not promise when it will be fixed; the deadline is set after review.

HARD LIMITS
- You cannot change a complaint's status, department, officer, priority or deadline. If asked ("close it", "make it urgent", "send it to someone else"), explain kindly that municipal staff decide that. Offer to show them the complaint, or explain the Confirm and Still a problem buttons.
- Never invent ticket numbers, statuses, names, deadlines, rules or phone numbers. If a tool fails, say you could not fetch it right now and suggest the Track page.
- Never ask for Aadhaar, bank details, passwords or any ID number.
- If anyone's life is in danger (fire, live electric wire, building collapse, gas leak, someone injured or trapped, flooding with people stuck), first tell them to call 112 immediately. Then offer to file a complaint as well.
- Never blame or accuse any officer, department or person.
- Stay on municipal topics. Politely decline anything else.
- For staff users ({{user_role}} is not citizen): you may navigate, filter and read status aloud. You do not take workflow actions for them; tell them which button to use.
```

## Client tools (implemented in `apps/web/src/features/niva/tools.ts`)

| Tool | Parameters | Returns | Notes |
|---|---|---|---|
| `update_draft` | `{ description?, category_hint?, landmark_id?, ward_id?, since_text?, risk_to_people?: boolean }` | `{ ok, draft }` | Updates the on-screen "What NIVA understood" card |
| `resolve_landmark` | `{ query, ward_hint? }` | `{ found, landmark_id, name, ward_id, ward_name }` or `{ found: false, suggestions: [names] }` | Calls the `resolve_landmark` RPC. Unknown means not found, never a guess |
| `open_location_picker` | `{}` | `{ ward_id, ward_name, nearest_landmark, x, z }` or `{ cancelled: true }` | Opens the map picker; resolves when the user taps and confirms |
| `request_photo` | `{}` | `{ attached: n }` | Opens the camera or file picker |
| `submit_complaint` | `{ confirmation_text }` | `{ ok, ticket_no }` or `{ ok: false, missing: [fields] }` | Calls `create_request()` with the citizen's own session, `channel = 'voice'`, the transcript and the confirmation text. Refuses if the description or ward is missing |
| `get_my_complaints` | `{}` | `[{ ticket_no, category, state, sla_status, due, officer_first_name, last_update }]` | RLS-scoped |
| `get_status` | `{ ticket_no }` | Same fields for one ticket, or `{ found: false }` | |
| `navigate` | `{ page: "home" \| "report" \| "my_complaints" \| "complaint_detail" \| "city" \| "notifications" \| "profile" \| "triage" \| "board" \| "escalations" \| "my_work" \| "overview" \| "audit", ticket_no? }` | `{ ok }` or `{ ok: false, reason: "not available for your role" }` | Respects role routes |
| `fly_to` | `{ target_type: "ward" \| "landmark" \| "ticket", value }` | `{ ok, label }` | Opens the city if needed; camera tween |
| `filter_city` | `{ category?, status?: "open" \| "past_deadline" \| "resolved" \| "all", ward_id?, mine?: boolean }` | `{ ok, count }` | |
| `set_language` | `{ lang: "en" \| "hi" \| "mr" }` | `{ ok }` | Also updates the profile |
| `set_text_size` | `{ size: "normal" \| "large" }` | `{ ok }` | |
| `read_screen_summary` | `{}` | `{ summary }` | Each page registers a short summary string through a hook |

There are no tools for transitions, assignment or deadlines, by design.

## Call screen (see DESIGN.md)

Dark canopy background, NIVA avatar in a ring, waveform tied to the output volume, live captions for both sides, and the draft card beside it on desktop (or a bottom sheet on mobile). Controls: Mute, End, Speaker, Switch to typing. States: connecting, listening, thinking, speaking, error. The error state offers "Type instead" immediately.

## Fallbacks

- `/niva/session` fails, mic permission is denied, or the connection drops → toast plus a switch to the typed flow, keeping whatever the draft already has.
- Voice notes: ElevenLabs TTS → browser `speechSynthesis` (language tag `mr-IN` / `hi-IN` / `en-IN`).
- Log `channel` on every request so judges can see voice versus web.

## Tests (manual script, run in Phase 7 and in rehearsal)

1. Marathi complaint end to end, with a photo, gets a ticket.
2. Hindi: "मेरी शिकायत का क्या हुआ?" reads back the correct status.
3. "Close my complaint" → polite refusal and an explanation.
4. Unknown landmark ("Moon Tower") → NIVA asks again or offers the map, and does not submit.
5. Danger cue ("wire padli aahe, current aahe") → 112 advice first.
6. As Officer Patil: "show my requests that are past deadline" → `filter_city` / `navigate`.
7. Kill the network to ElevenLabs → the typed flow keeps the draft.
