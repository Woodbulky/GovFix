---
description: Verify, log, commit and push a finished phase
argument-hint: <phase-number> <short summary>
---

Phase work is finished: $ARGUMENTS

Do these steps in order. Stop and report if any step fails twice.

1. Re-read the phase's acceptance criteria in docs/PHASES.md and confirm each one is met. List any that are not, and fix them first.
2. Run the checks:
   - `npm run lint`
   - `npm run typecheck`
   - `npm test`
   - If anything under `supabase/` changed: `npm run db:push`, then `npm run seed:users`, then `npm run test:engine` (cloud project; the suite ends with `reset_demo()`).
   - If anything under `services/ai/` changed: `npm run test:ai`.
   Fix failures. Never commit a red build.
3. Update docs/PROGRESS.md: mark the phase done with the time, what was built, deviations from the docs (with reasons), known issues, and anything Studio must do by hand (keys, ElevenLabs dashboard, photos).
4. Safety check: run `git status` and `git diff --cached --name-only` after staging. Make sure no `.env` file, key, token, `supabase/.temp` or large binary (>5 MB) is staged.
5. Commit and push:
   ```bash
   git pull --rebase origin main
   git add -A
   git commit -m "feat(phase-<N>): <summary>"
   git push origin main
   ```
6. Reply to Studio with: phase done, commit hash, what's next, and any manual steps needed. Then continue with the next phase unless Studio said to pause.
