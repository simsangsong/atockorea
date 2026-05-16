---
name: itinerary-builder
description: Drives all work on the custom itinerary builder feature (map + POI pins + AI-recommended day itinerary). Wires every task back to the master planner at docs/itinerary-builder-plan.md so phases advance in order, decisions are logged, and scope creep is parked instead of silently absorbed. Invoke any time the user mentions POI map, custom itinerary, private-tour builder, itinerary recommendation engine, or a tour-spot map UI.
---

# Itinerary Builder skill

You are working inside the atockorea project's "custom itinerary builder" feature. The master planner is `docs/itinerary-builder-plan.md`. **It is the single source of truth for status, decisions, scope, and phase order.**

## Step 0 — Always do this first

1. Read `docs/itinerary-builder-plan.md` end-to-end. Do not skim. Especially §A (status dashboard), §B (decision log), §E (scope creep registry), §F (the 6 phases).
2. From §A, identify the currently active phase (status 🔄). If none is active, the active state is "between phases — awaiting user direction." In that case, do NOT pick a phase yourself; ask the user which phase to begin.
3. From the active phase's §F sub-checklist, identify the next unchecked task. That's the next thing you do.

## Working rules (in priority order)

1. **Never deviate from the plan silently.** If the user asks for something not in the active phase's task list, you have three options:
   - (a) It belongs in a different phase already in the plan → tell the user "this is Phase N work; we're on Phase M" and ask whether to switch phases (which means logging the switch in §A + §B).
   - (b) It's genuinely new scope → add it to §E (parked ideas registry) and ask the user whether to pause current phase to plan it formally.
   - (c) It's a clarification/bug-fix to in-flight work → just do it and note it in §C change log.
2. **Update the planner after every commit.** Specifically: §A "Last commit", §A phase status, §C change log, and the relevant §F sub-checklist. This is non-negotiable — the planner stays in sync with git.
3. **Per-phase acceptance is mandatory** before marking a phase ✅. Run the acceptance checks listed in §F for that phase, paste evidence (SQL output / screenshot description / test result) into §C change log.
4. **One phase at a time.** Don't start Phase N+1 tasks while Phase N has unchecked boxes. Cut-lines are real — if Phase 4 ships and the user wants a break, do not start Phase 5 unprompted.
5. **Decisions in §B are binding.** If a §B row says "Google Maps", do not propose Mapbox without first asking the user to log a reversal in §B.
6. **Photo work follows `memory/feedback_photo_quality_policy.md`** (16:9 / OTA bright / no AI feel / sharp quality 95 / no watermarked sources). Cross-referenced from planner §G.5.
7. **Per-step deliverable format** (matches the home UX upgrade plan convention): after each step, write a one-line visual changelog the user can scan without opening files.

## Specific protocols

### When starting a phase
- Update §A: set phase status to 🔄, fill `Started` date.
- Write a one-line entry in §C change log: "Phase N started — <one-line summary of plan>".
- Commit the planner edit BEFORE writing any phase code.

### When advancing within a phase
- After each sub-task commit:
  - Check the box in §F.
  - Update §A "Last commit" with the new hash.
  - Add a one-line §C entry.

### When finishing a phase
- Run all acceptance checks from §F. Paste evidence into §C.
- Update §A: set phase status to ✅, fill `Done` date, append commit hashes.
- Ask the user whether to start the next phase or pause.

### When user pushes back / changes mind
- If a §B decision is being reversed, log the reversal: new row in §B with date + new decision + reason.
- If a phase order is changing, log it in §B + update §F ordering visibly (don't delete — strikethrough).
- If scope is being cut, move the cut work to §E with reason.

## Anti-patterns to refuse

- ❌ "Let's just skip Phase N and do Phase N+1 first" → respond with §B/§F update flow.
- ❌ "While you're in there, also do X" → §E parked idea, ask first.
- ❌ "Why don't we use Mapbox instead?" → §B reversal flow.
- ❌ Committing feature code without updating the planner in the same PR.
- ❌ Marking a phase ✅ without running acceptance checks.
- ❌ Reading just the headers of the planner doc — you MUST read the active phase's full task list and acceptance criteria every session.

## When you finish

Tell the user:
- Which task you just completed (referencing §F item)
- Updated §A / §C entries
- Next unchecked task in the phase
- Whether the phase is now ✅ (and if so, ask whether to proceed to the next)
