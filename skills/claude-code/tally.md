---
name: tally-use
description: Use when managing tasks in a Tally-enabled project — CLI-driven task ledger with round discipline, dependency tracking, safety checks, and visualization. Trigger on tally commands, task management, round operations, ledger validation, or tally.json.
---

# Tally Use

Use this skill as a Tally workflow adapter. Tally is an agent-native task management CLI with multi-agent scheduling safety. The skill file is the canonical usage reference — the CLI is the sole write gate to tally.json.

## First Action

1. Detect project state:
   - Run `tally status` to see current done/open/hold/blocked counts
   - If `tally.json` exists, read it via Read tool to understand task details
2. Identify the task lane: round execution, task CRUD, ledger validation, or handoff
3. Choose the minimal correct command path before editing:
   - Starting work: `tally round start "scope" [--strategy feature-focused|risk-first|parallel-max]` — locks tasks, prevents conflicts
   - Task completion: `tally task done <id...> --evidence "..." [--test "..."] [--commit "..."] [--review "..."]` — batch form preferred
   - New task discovered: `tally task add --json '[...]'` — do NOT insert into current round
   - Validation: `tally lint` (fast, pre-commit) or `tally check` (deep, before round)
   - Handoff: `tally export --format agent-brief [--task U-xxx]`

## Write Discipline (CRITICAL)

**NEVER edit `tally.json` directly.** ALL writes go through CLI commands.
The CLI owns validation, ID generation, and field constraints.
Agent reads `tally.json` via Read tool, writes via `tally <command>`.

## Use When

- Working in a Tally-enabled repository (tally.json exists)
- Starting a new execution round
- Marking tasks as done, blocked, or unblocked
- Adding newly discovered tasks to the ledger
- Validating ledger health before commit (`tally lint` / `tally check`)
- Preparing a handoff or progress report
- Visualizing task data (`tally dashboard`)
- Analyzing dependency graph (`tally graph --level task|feature`)
- Exporting data (`tally export --format json|csv|markdown|agent-brief`)
- Migrating from legacy Markdown ledgers (`tally migrate`)
- Approving high-risk tasks (`tally task approve <id> --by <name>`)

## BATCH (Always Prefer)

- Multiple tasks done: `tally task done U-001 U-002 U-003 --evidence "..."`
- Multiple tasks added: `tally task add --json '[...]'`
- Multiple blocked: `tally task block U-001 U-002 --reason "..."`

## Round Start Safety Checks

`tally round start` enforces multi-agent safety before claiming tasks:

1. **Write scope conflict detection** — two tasks touching the same paths cannot enter the same round
2. **Risk gating** — tasks above configured `gates.maxRisk` are rejected
3. **Feature freeze gating** — on frozen features, only contract/test tasks are allowed
4. **Approval gate** — unapproved high/critical risk tasks are rejected
5. **Dependency satisfaction** — all deps must be `done`

## Round Strategies

`tally round start --strategy <name>`:

| Strategy | Behavior |
|----------|----------|
| `parallel-max` (default) | Shallowest depth first, grouped by module → feature |
| `feature-focused` | Complete one feature's eligible tasks before moving to the next |
| `risk-first` | Highest risk tasks first (critical → high → medium → low) |

## Task Data Model (Key Fields)

### Core
- `id`, `status`, `priority`, `stage`, `module`, `name`, `acceptance`
- `feature` — references `_meta.features[].id` (required for open tasks)
- `deps`, `blocks`, `nextAction`, `evidence`, `rule`

### Scheduling & Safety (v0.2.0)
- `writeScopes: string[]` — paths this task is allowed to modify
- `riskLevel: low|medium|high|critical` — risk classification
- `executionLane: contract|writer|runtime|ui|test|review` — execution role
- `requiresReview: boolean` — code review required before done
- `rollbackPlan: string` — how to undo if needed
- `assignedAgent: string` — agent assigned to this task
- `approvedBy: string` — human approval for high-risk tasks
- `resourceRequirements: string[]` — providers/models/ports needed
- `repos: string[]` — repositories involved
- `deliveryNode: string` — milestone label
- `acceptanceCriteria: { requiredTests, passConditions, forbiddenSideEffects, negativeCases }`
- `executionPlan: { inputs, outputs, steps }`

### Feature Registry (`_meta.features`)
- `id`, `module`, `name`
- `status: design|contract_frozen|implementing|stable`
- `specRefs: string[]` — design document references
- `dependsOn: string[]` — feature-level dependencies
- `owner: string` — feature owner

## Structured Evidence

`tally task done` supports structured completion evidence:
```
tally task done U-001 --evidence "Implemented" \
  --test "pnpm test -- --filter=auth" \
  --commit "abc1234" \
  --review "PR #42 approved by @reviewer" \
  --provider "openai/gpt-4o for code generation" \
  --notes "Edge case X handled separately in U-005"
```

## Concurrency

- Set agent ID: `export TALLY_AGENT_ID=<id>` (must exist in `_meta.agents`)
- Before round start: `git pull`
- If round start fails with claim conflict: re-read tally.json, adjust selection, retry
- After round close: `tally sync`
- If sync fails: `git pull --rebase` → `tally check` → `git push`

## Config Reference (.tallyrc.yaml)

```yaml
agent:
  id: main
round:
  maxTasks: 10
  allowParallel: false
gates:
  requireFeature: true
  requireReview: false
  featureFreeze: []
  maxRisk: high
  detectWriteConflicts: true
dashboard:
  port: 5173
```

## Data Model Reference

- Status: `pending` | `in_progress` | `blocked` | `hold` | `deferred` | `done`
- Priority: `P0` | `P1` | `P2`
- Risk: `low` | `medium` | `high` | `critical`
- Lane: `contract` | `writer` | `runtime` | `ui` | `test` | `review`
- Task ID: `U-xxx` = unfinished, `D-xxx` = done, `B-xxx` = block, `R-YYYY-MM-DD-NNN` = round
