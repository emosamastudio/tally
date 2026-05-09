---
name: tally
description: Agent-native task management — CLI-driven task ledger with round discipline, dependency tracking, and visualization
---

# Tally — Agent Task Management

## When to Use
Use Tally for ALL task management. Never track tasks in chat memory alone.

## Invocation Rules

### READ (via Read tool)
- Read `tally.json` to understand current task state
- Read `.tallyrc.yaml` for project config

### WRITE (via CLI — NEVER edit tally.json directly)
- Session start:     `tally status`
- Before new round:  `tally check`
- Start work:        `tally round start "scope" --tasks U-001 U-002 ...`
- Task done:         `tally task done U-001 U-002 --evidence "..."`
- New task found:    `tally task add --json '[...]'` (do NOT insert into current round)
- Block/unblock:     `tally task block U-001 --reason "..."` / `tally task unblock U-001`
- Task detail:       `tally task show U-001`
- Mid-round report:  `tally round report`
- Round end:         `tally round close`
- Handoff:           `tally export --format markdown`
- Before commit:     `tally lint`
- Push changes:      `tally sync`

### BATCH (always prefer batch forms)
- Multiple done:  `tally task done U-001 U-002 U-003 --evidence "..."`
- Multiple add:   `tally task add --json '[{"name":"...","stage":"S1"},...]'`
- Multiple block: `tally task block U-001 U-002 --reason "..."`

### CONCURRENCY
- Set agent ID: `export TALLY_AGENT_ID=<id>` (must exist in `_meta.agents`)
- Before round start: `git pull`
- If round start fails with claim conflict: re-read tally.json, adjust selection, retry
- After round close: `tally sync`
- If sync fails: `git pull --rebase` -> `tally check` -> `git push`

### DATA MODEL REFERENCE
Status: `pending` | `in_progress` | `blocked` | `hold` | `deferred` | `done`
Priority: `P0` | `P1` | `P2`
Task ID prefix: `U-xxx` = unfinished, `D-xxx` = done, `B-xxx` = block
