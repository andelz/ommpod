# pod — Angular Podcast Player

## Persistent brain (session memory)

Each major module has a `.brain/` directory with four markdown files that persist knowledge across Claude Code sessions:

```
.brain/
  architecture.md      — module structure, public API, key patterns, gotchas
  decisions.md         — ADRs: why things are the way they are
  handoff.md           — last session state (overwritten each /wrap-up)
  execution-plan.md    — in-progress work and dependency graph
```

**Two slash commands manage the lifecycle:**
- `/resume` — start of session: reads the brain and gives a structured briefing
- `/wrap-up` — end of session: updates all four brain files

Default module: `pod`

**Seeded modules:** pod (root)
