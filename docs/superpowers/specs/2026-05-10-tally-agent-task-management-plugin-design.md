# Tally — Agent Task Management Plugin Design Specification

Date: 2026-05-10
Status: design-approved
Project: tally (independent, installable agent plugin)

## Purpose

Tally is a reusable agent-native task management plugin. It provides a CLI for task CRUD,
round management, ledger validation, and a browser-based dashboard for visualization.
It is designed to be installed as a skill into any agent (Claude Code, Codex, Copilot CLI)
and as an npm package for direct CLI use.

The name "Tally" refers to the ancient method of record-keeping by carving notches —
each task is a notch, the ledger is the tally stick.

## Architecture

```
tally/
├── cli/                          # Node.js/TypeScript CLI
│   ├── src/
│   │   ├── commands/
│   │   │   ├── init.ts           # tally init
│   │   │   ├── lint.ts           # tally lint
│   │   │   ├── check.ts          # tally check
│   │   │   ├── status.ts         # tally status
│   │   │   ├── round.ts          # tally round {start,report,close}
│   │   │   ├── task.ts           # tally task {add,show,edit,done,block,unblock,list}
│   │   │   ├── dashboard.ts      # tally dashboard
│   │   │   ├── graph.ts          # tally graph
│   │   │   ├── export.ts         # tally export
│   │   │   ├── migrate.ts        # tally migrate (Markdown → tally.json)
│   │   │   ├── sync.ts           # tally sync (git commit + push)
│   │   │   └── config.ts         # tally config read helpers
│   │   ├── lib/
│   │   │   ├── ledger-reader.ts  # Read + validate tally.json
│   │   │   ├── ledger-writer.ts  # Write tally.json (preserve formatting)
│   │   │   ├── validator.ts      # Lint + check logic
│   │   │   ├── types.ts          # TypeScript types for the schema
│   │   │   └── schema.json       # JSON Schema v2020-12
│   │   └── index.ts              # CLI entry point
│   ├── package.json
│   └── tsconfig.json
│
├── dashboard/                    # SPA visualization (React + Vite)
│   ├── src/                      # Reads tally.json directly
│   └── dist/                     # Vite build output
│
├── standard/                     # Human-readable task management standard
│   ├── manifest.yaml             # Machine-readable entry point (AODS pattern)
│   ├── templates/
│   │   ├── tally-schema.md       # Data model documentation
│   │   ├── round-log.md          # Round log template
│   │   └── report.md             # Progress report template
│   └── examples/
│       └── example-tally.json    # Complete example
│
├── skills/
│   ├── claude-code/
│   │   └── tally.md              # Claude Code skill definition
│   └── copilot-cli/
│       └── tally.yaml            # Copilot CLI skill definition
│
├── .tallyrc.yaml                 # Default config template
├── README.md
└── LICENSE
```

## Data Model — `tally.json` Schema

### Top-Level Structure

```jsonc
{
  "_meta": {
    "project": "string",          // Project name
    "tally_version": "1.0",       // Schema version
    "created": "YYYY-MM-DD",      // Creation date
    "updated": "YYYY-MM-DD",      // Last modification date
    "agents": [                   // Project agent registry
      { "id": "main", "name": "主会话" },
      { "id": "app-dev", "name": "App 专项开发" }
    ],
    "stages": [
      { "id": "S0", "name": "项目身份", "modules": ["identity"] }
    ],
    "modules": [
      { "id": "identity", "name": "项目身份" }
    ]
  },
  "tasks": [],                    // Task[]
  "rounds": [],                   // Round[]
  "blocks": [],                   // Block[]
  "progress": []                  // ProgressPoint[]
}
```

### Task Object

```jsonc
{
  "id": "U-001",                  // U-xxx = pending, D-xxx = done, unique, never reused
  "status": "pending"             // pending | in_progress | blocked | hold | deferred | done
          | "in_progress"
          | "blocked"
          | "hold"
          | "deferred"
          | "done",
  "priority": "P0",               // P0 | P1 | P2
  "stage": "S1",                  // References _meta.stages[].id
  "module": "contracts",          // References _meta.modules[].id
  "name": "建立项目契约",          // One-line actionable description
  "acceptance": "...",            // Verifiable acceptance criteria
  "deps": ["U-000"],              // Task IDs this task depends on; empty array = none
  "blocks": null,                 // Block reason string, null if not blocked
  "nextAction": "从 Swift reference 提取...", // Required when status != done
  "evidence": null,               // Required when status == done; must be null otherwise
  "rule": null,                   // Follow-up rule, only when status == done
  "tags": ["blocking-release"],   // Arbitrary string tags
  "order": 1,                     // Execution order for pending tasks
  "completedOrder": null,         // Completion sequence number, only when done
  "claimedBy": "R-2026-05-10-001", // Round ID that claimed this task; null = unclaimed
  "claimedAt": "2026-05-10",      // YYYY-MM-DD when claimed; null = unclaimed
  "createdAt": "2026-05-01",      // YYYY-MM-DD
  "completedAt": null             // YYYY-MM-DD when done; null otherwise
}
```

### Field Constraints

| Condition | Rule |
|---|---|
| `status == "done"` | `evidence` required (string, non-empty); `rule` optional |
| `status != "done"` | `evidence` must be null; `nextAction` required (string, non-empty) |
| `id` starts with `U-` | All non-done tasks |
| `id` starts with `D-` | All done tasks |
| `id` starts with `B-` | Block items (in blocks array, not tasks) |
| `deps` | Must reference valid task IDs; must not contain self; no cycles in global graph |
| `order` | Unique among pending/in_progress/blocked tasks; null for done |
| `completedOrder` | Unique among done tasks; null otherwise |
| `claimedBy` | Must reference a valid round ID; null if unclaimed |
| `claimedAt` | Must be set iff `claimedBy` is non-null; cleared when `claimedBy` is null |
| `createdAt` / `completedAt` | ISO date format YYYY-MM-DD |

### Round Object

```jsonc
{
  "id": "R-2026-05-10-001",
  "start": "2026-05-10",
  "executor": "main",             // References _meta.agents[].id
  "scope": "执行 U-001 到 U-005",
  "exclusions": "不涉及 provider 真实调用",
  "plannedTasks": [
    { "taskId": "U-001", "goal": "完成契约", "criteria": "validate 通过" }
  ],
  "completedAt": null,            // Set when round closes
  "status": "active"              // active | completed
}
```

### Block Object

```jsonc
{
  "id": "B-001",
  "affects": ["U-003"],           // Task IDs affected
  "content": "Leihuo gateway 不可达",
  "strategy": "走 Tencent Coding Plan",
  "createdAt": "2026-05-09",
  "resolvedAt": null              // YYYY-MM-DD when resolved; null = active
}
```

### ProgressPoint Object

```jsonc
{
  "date": "2026-05-02",
  "totalDone": 250,
  "totalOpen": 85,
  "totalHold": 15,
  "totalBlocked": 3,
  "evidence": "D-014 完成",
  "notes": ""
}
```

## State Enums

```
Status:   pending | in_progress | blocked | hold | deferred | done
Priority: P0 | P1 | P2
```

## CLI Command Reference

### Design Principle: CLI is the Sole Writer

Agents **read** `tally.json` directly via the Read tool to understand current state.
Agents **never** edit `tally.json` directly. All writes go through CLI commands.
CLI commands are the write gate — they own schema validation, ID generation,
field constraints, and cross-reference integrity. This eliminates format drift.

Agent workflow: `Read tally.json` → plan actions → `tally <command>` writes.

### Setup & Validation

| Command | Purpose | Key Flags |
|---|---|---|
| `tally init [name]` | Create `tally.json`, install pre-commit hook | `--no-hook` |
| `tally lint` | Format + surface validation. Detect external corruption (git conflict residue, manual edits). Exit 0/1. | `--strict` `--json` |
| `tally check` | Deep validation: reference integrity, state consistency, cycle detection, progress cross-check | `--json` |
| `tally status` | One-line summary: DONE N / OPEN N / HOLD N / BLOCKED N / ROUND id / BLOCKS N | `--json` |

### Round Management

| Command | Purpose | Batch? |
|---|---|---|
| `tally round start "scope"` | Lock new round. Select top-N pending by order (or `--tasks` for explicit). Check `claimedBy` to prevent double-claiming. Atomic all-or-nothing. If `round.allowParallel` is false (default), refuse if this agent already has an active round. | `--tasks` `--agent` | Yes |
| `tally round report` | Generate round completion report (Markdown or terminal table). Works at any time — mid-round shows planned vs actual, post-close shows final summary. | — |
| `tally round close` | Rewrite U→D for completed tasks, fail tasks → pending/blocked, append progress, close round. One command handles the entire round close batch. | Yes — rewrites all round tasks |

### Task CRUD

| Command | Purpose | Batch? |
|---|---|---|
| `tally task add --json '[...]'` | Create one or more tasks from a JSON array. CLI auto-generates U-xxx IDs, validates all fields, inserts at correct order positions. | Yes — accepts array |
| `tally task show <id>` | Full task detail + dependency tree (ancestors + descendants) | — |
| `tally task edit <id> --field value` | Modify a single field. `--name` `--priority` `--stage` `--module` `--acceptance` `--deps` `--next-action` `--tags` | — |
| `tally task done <id...> --evidence "..." --rule "..."` | Mark one or more tasks done. `status→done`, `U-→D-`, set `completedAt`. Evidence applies to all. | Yes — multiple IDs |
| `tally task block <id...> --reason "..."` | Mark one or more tasks blocked. Set `blocks` field. | Yes — multiple IDs |
| `tally task unblock <id...>` | Clear block on one or more tasks. Remove `blocks`, revert to `pending`. | Yes — multiple IDs |
| `tally task list` | Filterable list. `--status` `--module` `--stage` `--priority` `--tag` `--search` `--json` | — |

### Visualization & Export

| Command | Purpose |
|---|---|
| `tally dashboard` | Start local HTTP server (`/api/tally.json`), open browser. Server reads `tally.json` from project root. |
| `tally graph --format json\|text\|dot --critical-path` | Dependency graph analysis |
| `tally export --format json\|csv\|markdown` | Export data |
| `tally migrate --from tally-v0-markdown --source <path> ...` | Convert legacy Markdown ledgers. Multiple `--source` accepted. |
| `tally upgrade` | Migrate `tally.json` to latest schema version after CLI update. |
| `tally sync` | `git add tally.json && git commit -m "tally: sync" && git push`. Auto pull+rebase if behind. |
| `tally sync` | `git add tally.json && git commit -m "tally: sync" && git push` |

### Agent Workflow Example

```
# Agent identifies itself (once per session)
$ export TALLY_AGENT_ID=main

# 1. Read tally.json to plan (Read tool)
# → 15 pending tasks, picks 5 with satisfied deps

# 2. Start round — 1 CLI call
$ tally round start "执行 U-001 到 U-005" --tasks U-001 U-002 U-003 U-004 U-005
→ Round R-2026-05-10-002 created. 5 tasks claimed.

# 3. Work on tasks...

# 4. Mark completed — 1 CLI call
$ tally task done U-001 U-002 U-003 U-004 --evidence "smoke 5/5 通过"
→ 4 tasks done. U-005 still pending.

# 5. Close round — 1 CLI call, handles all U→D rewrites + progress
$ tally round close
→ Round closed. 4 done, 1 failed → reverted to pending.
→ Progress recorded: 250→254 done.

# 6. Push — 1 CLI call
$ tally sync
→ tally.json committed and pushed.
```

## Config — `.tallyrc.yaml`

```yaml
# Project-level: <repo>/.tallyrc.yaml (overrides global)
# Global: ~/.tallyrc.yaml (overrides defaults)

agent:
  id: main                       # Must match _meta.agents[].id
                                 # Can be overridden via TALLY_AGENT_ID env or --agent flag

round:
  maxTasks: 10                   # Tasks auto-selected per round
  allowParallel: false           # Allow one agent to hold multiple active rounds

lint:
  strict: false                  # Treat warnings as errors

dashboard:
  port: 5173
```

Config is read by the CLI at startup. No `tally config` command — users edit the YAML file directly.

## Lint vs Check

Since all writes go through CLI (which validates on write), `tally lint` detects
external corruption: git merge conflicts, manual edits, file encoding issues.
`tally check` validates semantic integrity before round operations.

| | `tally lint` | `tally check` |
|---|---|---|
| **Purpose** | External corruption detection | Semantic integrity |
| **Checks** | Valid JSON, types, ID uniqueness, required fields, field constraint rules | Reference integrity, state consistency, cycle detection, progress cross-check |
| **Speed** | < 10ms | < 50ms (for 500 tasks) |
| **Exit code** | 0/1 | 0/1 |
| **Use case** | Pre-commit hook, CI gate, after git operations | Before `round start`, after `round close`, before handoff |

## Pre-Commit Hook

`tally init` installs `.git/hooks/pre-commit`:

```sh
#!/bin/sh
# Tally lint gate — installed by 'tally init'
npx tally lint --strict
```

Errors block the commit. `tally init --no-hook` skips installation.

## Agent Skill Integration

### Write Discipline

Agent reads `tally.json` via Read tool to understand task state. All writes go through
CLI commands — the CLI owns validation, ID generation, and field constraints.
Agent NEVER edits `tally.json` directly.

This means:
- No risk of malformed JSON, wrong field types, or missing required fields
- No risk of duplicate IDs or order collisions
- `tally lint` is a safety net against external corruption (git conflicts, manual edits),
  not a guard against agent mistakes (the CLI prevents those)

### Skill File: `skills/claude-code/tally.md`

The skill is loaded at session start. It defines these invocation rules:

```
READ (via Read tool):
  - Open tally.json to understand current task state
  - Read .tallyrc.yaml for project config

WRITE (via CLI — NEVER via Edit tool on tally.json):
  - Session start:      tally status
  - Before new round:   tally check
  - Start work:         tally round start "scope"
  - Task done:          tally task done U-001 U-002 --evidence "..."
  - New task found:     tally task add --json '[...]'
  - Block/unblock:      tally task block U-001 --reason "..."
  - Task detail:        tally task show U-001
  - Round end:          tally round close
  - Handoff:            tally export --format markdown
  - Before git commit:  tally lint

BATCH (always prefer batch forms):
  - Multiple tasks done → one tally task done call with multiple IDs
  - Multiple tasks blocked → one tally task block call with multiple IDs
  - Multiple tasks added → one tally task add --json call with an array
```

## Dashboard Integration

The dashboard reads `tally.json` directly via HTTP (served by `tally dashboard`'s built-in server). Key differences from the inori-dashboard prototype:

- **Data source**: `tally.json` instead of Markdown
- **No unified/remark pipeline needed** — JSON is already structured
- **Loader simplification**: `fetch(tallyJsonPath)` → `LedgerData` type cast
- **All existing panels preserved**: OverviewBar, ProgressTrend, CurrentRound, StageMatrix, BlockList, TaskTable, DependencyGraph
- **New: round timeline view** — since rounds are now structured data, show a chronological view of all rounds

## Sync Strategy

`tally sync` pushes the local `tally.json` to the git remote:

```sh
git add tally.json && git commit -m "tally: sync" && git push
```

If the commit would be empty (no changes since last sync), exit 0 with "nothing to sync".
If push fails because remote is ahead:
1. `git pull --rebase`
2. `tally check` to verify the merged `tally.json` is structurally valid
3. `git push`
4. If `tally.json` has a git-level merge conflict → exit 4. Agent must resolve manually by re-applying changes via CLI commands, then re-sync.

## Migration

`tally migrate --from tally-v0-markdown --source <path> --source <path>` converts legacy Markdown ledgers:

1. Parse each source Markdown file using the existing unified/remark pipeline
2. Map Chinese status labels to English enums (`待处理` → `pending`, etc.)
3. Assign `module` based on stage → module mapping in `_meta`
4. Merge all sources into a single `tally.json`
5. Generate `_meta.stages` and `_meta.modules` from the union of all stages found
6. Preserve round history, blocks, and progress records
7. Write `tally.json` and report conversion statistics

## Exit Codes

| Code | Meaning |
|---|---|
| 0 | Success |
| 1 | Validation failure (lint/check found issues) |
| 2 | Usage error (missing required arg, invalid flag) |
| 3 | File not found (tally.json missing, migrate source missing) |
| 4 | Conflict (round already active, sync failed) |

## Dependencies

### CLI
- Node.js ≥ 18
- TypeScript 5.x
- No runtime dependencies beyond Node standard library (ajv for JSON Schema validation)

### Dashboard
- React 19, Vite 6, Tailwind CSS 4, Recharts 2
- No Markdown parser needed (reads JSON directly)
- dagre (for DAG layout in dependency graph)

## Multi-Agent Concurrency

### Model: Optimistic Locking + Git Arbitration

Tally supports multiple agents working on the same `tally.json` simultaneously.
Each agent has a stable ID registered in `_meta.agents`. Agents work on independent
task sets locked by round. Git resolves merge conflicts when sync order matters.

### Agent Registration

Agents identify themselves via `TALLY_AGENT_ID` env var or `--agent <id>` flag.
The ID must exist in `_meta.agents`. Example:

```yaml
# .tallyrc.yaml
agent:
  id: main                    # Must match _meta.agents[].id
```

### Task Claiming Protocol

`tally round start` atomically:
1. Scans requested tasks (top-N by order, or `--tasks` explicit list)
2. For each task, checks `claimedBy`:
   - `null` → claims it (set `claimedBy` = round ID, `claimedAt` = today)
   - Non-null + round is `completed` → claims it (previous round finished)
   - Non-null + round is `active` → rejects (another agent owns this task)
3. If ANY task is rejected, NO tasks are claimed (all-or-nothing)
4. Reports conflicts with owning round + agent info

```
$ tally round start "spec work" --tasks U-001..U-010
✗ Cannot start round:
  U-003 → claimed by R-2026-05-10-002 (agent: app-dev)
  U-007 → claimed by R-2026-05-10-002 (agent: app-dev)
```

Agent then reads updated `tally.json`, adjusts selection, retries.

### Sync Protocol

```
agent-A                     agent-B
  ├─ git pull latest          ├─ git pull latest
  ├─ tally round start        ├─ tally round start
  │  --tasks U-001..U-010     │  --tasks U-011..U-020
  ├─ ... work ...             ├─ ... work ...
  ├─ tally round close        ├─ tally round close
  ├─ tally sync               ├─ tally sync
  │  ✓ git push               │  ✗ git push (behind)
  │                           │  ├─ git pull --rebase
  │                           │  ├─ tally check (no conflicts)
  │                           │  └─ git push ✓
```

`tally sync` = `git add tally.json && git commit -m "tally: sync" && git push`.
If push fails:
1. `git pull --rebase`
2. `tally check` to verify merged `tally.json` is valid
3. `git push`
4. If JSON merge conflict → exit 4, agent manually resolves via `tally` commands

### Round Lifecycle Guarantees

| Guarantee | Enforcement |
|---|---|
| One agent per task | `claimedBy` check in `round start` |
| Tasks released on round close | `round close` sets `claimedBy = null` on failed/unfinished tasks |
| No stale claims | `tally check` flags tasks claimed by a non-existent round |
| Traceability | `task.claimedBy` → `round` → `round.executor` → `_meta.agents` |

### Agent Skill Rules (appended)

```
CONCURRENCY:
  - Agent ID:     export TALLY_AGENT_ID=<id> (must be in _meta.agents)
  - Before round:  git pull
  - round start:   if rejected, re-read tally.json, adjust selection, retry
  - After round:   tally sync
  - sync fail:     git pull --rebase → tally check → git push
  - merge conflict: exit 4, report to user which tasks conflict
```

---

## Out of Scope

- Real-time collaborative editing of `tally.json`
- Backend/cloud sync server
- Multi-user task assignment
- Integration with external project management tools (Jira, Linear, etc.)
- Notification/alert system
- Time tracking or estimation
