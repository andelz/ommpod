---
description: End a session by updating the persistent brain files. Usage: /wrap-up
---

You are wrapping up a work session. Update the persistent brain files so the next session has full context.

## Step 1 — Determine the module

The argument is: $ARGUMENTS

If the argument is empty, use `pod` as the default.

Map the module name to its brain path:
- `pod` → `.brain/`

If `.brain/` does not exist for the module, say so and stop.

## Step 2 — Gather session context

Run `git diff HEAD` and `git status` to see what changed this session.
Read the current `handoff.md` and `execution-plan.md` to understand previous state.

## Step 3 — Overwrite handoff.md

Write a new handoff.md with this structure:

# Handoff — <module-name>

> Overwritten at session end by /wrap-up.

## Session date
<today>

## What was done this session
- <bullet list>

## Current state
- Branch: <branch>
- In-progress PR / ticket: <if known>
- Files actively being changed: <key files>

## Open questions / blockers
- <or "None">

## What to do next
1. <most important next step>
2. ...

## Step 4 — Update execution-plan.md

- Mark completed steps as `[x]`
- Mark started-but-unfinished steps as `[~]`
- Unblock steps whose dependencies are now met
- Add new steps or epics discovered this session

## Step 5 — Update architecture.md (only if structure changed)

Update only if: new exports added, API surface changed, new gotchas discovered.
Skip otherwise.

## Step 6 — Append to decisions.md (only if new decisions were made)

Append a new ADR entry if an architectural decision was made. Skip otherwise.

## Step 7 — Confirm

Print:

### Wrapped up: <module-name>

- handoff.md — <one-line summary>
- execution-plan.md — <X steps completed, Y unblocked>
- (skipped) architecture.md — no structural changes
- (skipped) decisions.md — no new decisions

Next session: /resume
