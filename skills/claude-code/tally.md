---
name: tally-use
description: Use when managing tasks in a Tally-enabled project — CLI-driven task ledger with round discipline, dependency tracking, and visualization. Trigger on tally commands, task management, round operations, ledger validation, or tally.json.
---

# Tally Use

Use this skill as a Tally workflow adapter. Tally is an agent-native task management CLI.
The skill file is the canonical usage reference — the CLI is the sole write gate to tally.json.

## First Action

1. Detect project state:
   - Run `tally status` to see current done/open/hold/blocked counts
   - If `tally.json` exists, read it via Read tool to understand task details
2. Identify the task lane: round execution, task CRUD, ledger validation, or handoff
3. Choose the minimal correct command path before editing:
   - Starting work: `tally round start "scope"` — locks tasks, prevents conflicts
   - Task completion: `tally task done <id...> --evidence "..."` — batch form preferred
   - New task discovered: `tally task add --json '[...]'` — do NOT insert into current round
   - Validation: `tally lint` (fast, pre-commit) or `tally check` (deep, before round)
   - Handoff: `tally export --format markdown`

## Write Discipline (CRITICAL)

**NEVER edit `tally.json` directly.** ALL writes go through CLI commands.
The CLI owns validation, ID generation, and field constraints.
Agent reads `tally.json` via Read tool, writes via `tally <command>`.

## Use When

- Working in a Tally-enabled repository (tally.json exists)
- Starting a new execution round
- Marking tasks as done, blocked, or unblocked
- Adding newly discovered tasks
- Validating ledger health before commit
- Preparing a handoff or progress report
- Visualizing task data (tally dashboard)
- Analyzing dependency graph (tally graph)
- Exporting data (tally export)
- Migrating from legacy Markdown ledgers (tally migrate)

## BATCH (Always Prefer)

- Multiple tasks done: `tally task done U-001 U-002 U-003 --evidence "..."`
- Multiple tasks added: `tally task add --json '[...]'`
- Multiple blocked: `tally task block U-001 U-002 --reason "..."`

## Round Start Selection Logic

`tally round start` auto-selects tasks optimized for agent execution:
1. **Parallelism first** — tasks at the same topological depth have no mutual dependencies
2. **Module focus second** — within the same depth, prefer same-module tasks for shared context
3. **Order tiebreaker** — deterministic ordering

This ensures an agent executing 10 tasks works on parallelizable work in a focused area.

## Concurrency

- Set agent ID: `export TALLY_AGENT_ID=<id>` (must exist in `_meta.agents`)
- Before round start: `git pull`
- If round start fails with claim conflict: re-read tally.json, adjust selection, retry
- After round close: `tally sync`
- If sync fails: `git pull --rebase` → `tally check` → `git push`

## Data Model Reference

- Status: `pending` | `in_progress` | `blocked` | `hold` | `deferred` | `done`
- Priority: `P0` | `P1` | `P2`
- Task ID: `U-xxx` = unfinished, `D-xxx` = done, `B-xxx` = block, `R-YYYY-MM-DD-NNN` = round
