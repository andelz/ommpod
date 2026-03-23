# Persistent Brain — pod

## Problem
Claude Code sessions start from scratch every time. Context about ongoing work, architectural decisions, and session state is lost between conversations.

## Solution
A `.brain/` directory at the project root with four markdown files that persist knowledge across sessions, managed by two slash commands.

## Brain file structure

```
.brain/
  architecture.md      — module structure, public API, key patterns, gotchas
  decisions.md         — ADRs: why things are the way they are
  handoff.md           — last session state (overwritten each /wrap-up)
  execution-plan.md    — in-progress work and dependency graph
```

### What each file contains

- **architecture.md**: Overview of the app, key exports (components, services, models), patterns (zoneless, signals, standalone components, lazy routes), and asset locations.
- **decisions.md**: Architectural Decision Records (ADRs) with date, decision, rationale, and consequences.
- **handoff.md**: Session-specific state — what was done, current branch, open questions, next steps. Overwritten each `/wrap-up`.
- **execution-plan.md**: Task tracking with status markers (`[ ]`, `[~]`, `[x]`, `[!]`), organized by epics with dependency info.

## Workflow

1. **Start of session**: Run `/resume` — reads all brain files and outputs a structured briefing
2. **During session**: Work normally
3. **End of session**: Run `/wrap-up` — updates handoff, execution plan, and optionally architecture/decisions

## Seeded modules

- `pod` (the whole app) → `.brain/`

## Rolling out to additional modules

If the project grows into a monorepo, create a `.brain/` directory in each new module and update the module map in both `/resume` and `/wrap-up` command files. Run `/wrap-up <module-name>` after the first session to populate.
