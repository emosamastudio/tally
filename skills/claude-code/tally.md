---
name: tally-use
description: Use when managing tasks in a Tally-enabled project — CLI-driven task ledger with round discipline, multi-agent safety, auto-retry, JSON error output, and visualization. Trigger on tally commands, task management, round operations, ledger validation, or .tally/tally.json.
---

# Tally Use

Use this skill as a Tally workflow adapter. Tally is an agent-native task management CLI with multi-agent scheduling safety. The skill file is the canonical usage reference — the CLI is the sole write gate to `.tally/tally.json`.

## Agent Loop (CRITICAL)

The standard agent workflow is fully autonomous:

```bash
# 1. Preview available work
tally round start --dry-run --auto-retry --json

# 2. Start round (claims tasks)
tally round start "scope" --auto-retry --json

# 3. Execute tasks, mark done with structured evidence
tally task done U-001 U-002 --evidence "completed" \
  --test "pnpm test" --commit "abc123" --review "approved" --no-forbidden

# 4. Close + auto-start next round (single command)
tally round close --auto-next --auto-retry --integrate --json
```

Step 4: close → integration check → start next → deconflict → claim. One command.

If tasks reference a Superpowers implementation plan, check plan health before execution:

```bash
tally plan check --json
tally export --format agent-brief --task U-001
```

## First Action

1. Detect project state:
   - Run `tally status` to see current done/open/hold/blocked counts
   - Read `.tally/tally.json` via Read tool to understand task details
2. Identify the task lane: round execution, task CRUD, ledger validation, or handoff
3. **Always use `--json` or `--json-output` for machine-parseable output**
4. Choose the minimal correct command path:
   - Preview: `tally round start --dry-run --auto-retry --json`
   - Start: `tally round start "scope" --auto-retry --json`
   - Done: `tally task done <ids> --evidence "..." --test "..." --commit "..." --no-forbidden`
   - Batch create: `tally task add --template plan.json`
   - Register plan: `tally plan register docs/superpowers/plans/<plan>.md --json-output`
   - Link plan: `tally task link-plan <id> --plan <plan-id> --task-ref "<ref>" --json-output`
   - Check plans: `tally plan check --json`
   - Close: `tally round close --auto-next --auto-retry --integrate --json`

## Write Discipline (CRITICAL)

**NEVER edit `.tally/tally.json` directly.** ALL writes go through CLI commands.

## JSON Error Output

All commands support `--json` / `--json-output` for machine-parseable errors:
```json
{"ok":false,"error":"WRITE_SCOPE_CONFLICT","message":"Task \"U-014\" write scope conflicts with \"U-016\""}
```

15 error codes: `WRITE_SCOPE_CONFLICT`, `RISK_GATE`, `APPROVAL_REQUIRED`, `FEATURE_FROZEN`, `DEP_UNSATISFIED`, `TASK_NOT_FOUND`, `TASK_ALREADY_DONE`, `INVALID_FIELD`, `FORBIDDEN_NOT_CHECKED`, `CLAIMED_BY_OTHER`, `ACTIVE_ROUND_EXISTS`, `NO_ELIGIBLE_TASKS`, `INVALID_JSON`, `EMPTY_INPUT`, `UNKNOWN`

## Round Safety (auto-enforced)

1. Write scope conflict detection — overlapping paths rejected or auto-excluded
2. Risk gating — rejects above `gates.maxRisk`
3. Feature freeze gating — only contract/test on frozen features
4. Approval gate — unapproved high/critical tasks rejected
5. Dependency satisfaction — all deps must be done

## Auto-Retry & Auto-Next

- `--auto-retry`: On conflict, auto-excludes failing tasks and retries (max 10 iterations)
- `--auto-next`: On close, auto-starts next round with same scope. If no eligible tasks remain, JSON output is still `ok: true` and includes `nextRoundSkipped.reason = "no_eligible_tasks"`.
- `--dry-run`: Preview task selection without claiming (bypasses active-round guard)
- `--integrate`: Cross-round, cross-agent integration check on close

## Round Strategies

| Strategy | Behavior |
|----------|----------|
| `parallel-max` (default) | Shallowest depth first, grouped by module → feature |
| `feature-focused` | Complete one feature before moving to the next |
| `risk-first` | Highest risk tasks first |

## Evidence Quality Scoring

Done tasks scored 0-100:
- `[test:]` +25 | `[commit:]` +25 | `[review:]` +25 | `[no-forbidden]` +25

Drift warnings (`tally check`):
`DRIFT_NO_COMMIT`, `DRIFT_NO_REVIEW`, `DRIFT_NO_EVIDENCE`, `DRIFT_NO_PROVIDER`, `DRIFT_LOW_QUALITY`

## Batch Template

```bash
tally task add --template feature-plan.json
```

Template:
```json
{
  "module": "work-planning",
  "feature": "workorder-plan-materialization",
  "tasks": [{
    "name": "Implement persistence",
    "priority": "P0",
    "writeScopes": ["src/persistence/**"],
    "executionLane": "writer",
    "depsRefs": ["$1"],
    "acceptanceCriteria": {
      "requiredTests": ["pnpm test"],
      "forbiddenSideEffects": ["must not create RuntimeTask"]
    }
  }],
  "depsRefMap": { "existing-dep": "U-005" }
}
```

`$N` = template-internal reference by position. `depsRefMap` = symbolic → ledger IDs.

## Reverse Acceptance

```bash
tally task done U-001 --evidence "done" --no-forbidden
```

When `acceptanceCriteria.forbiddenSideEffects` is set, `--no-forbidden` must confirm none triggered.

## Task Fields

**Core**: `id`, `status`, `priority`, `stage`, `module`, `name`, `acceptance`, `feature`, `deps`, `blocks`, `nextAction`, `evidence`, `rule`
**Traceability**: `aodsRefs`, `codeRefs`, `implementationTargets`
**Scheduling**: `writeScopes`, `riskLevel` (low|medium|high|critical), `executionLane` (contract|writer|runtime|ui|test|review), `requiresReview`, `rollbackPlan`, `assignedAgent`, `approvedBy`
**Planning**: `acceptanceCriteria` {requiredTests, passConditions, forbiddenSideEffects, negativeCases}, `executionPlan` {inputs, outputs, steps}, `planRef`, `planPath`, `planTaskRef`, `planContentHash`
**Tracking**: `resourceRequirements`, `repos`, `deliveryNode`

## Plan Registry

Tally does not replace a Superpowers plan. The plan explains how to implement; Tally tracks execution, claims, evidence, and handoff.

Commands:

```bash
tally plan register docs/superpowers/plans/2026-06-01-demo.md --json-output
tally task link-plan U-001 --plan plan:demo-implementation-plan --task-ref "Task 1" --json-output
tally plan check --json
tally export --format agent-brief --task U-001
```

Use `tally plan check --json` before starting linked work. It detects missing plan files, hash drift, unknown plan IDs, and task refs that no longer appear in the plan.

## Feature Registry

`_meta.features`: `id`, `module`, `name`, `status` (design|contract_frozen|implementing|stable), `specRefs`, `dependsOn`, `owner`

## Concurrency

- Agent ID: `export TALLY_AGENT_ID=<id>` (must be in `_meta.agents`)
- Before start: `git pull`
- Conflicts: use `--auto-retry` or preview with `--dry-run` first
- After close: `tally sync`

## Config

```yaml
agent: { id: main }
round: { maxTasks: 10, allowParallel: false }
gates:
  requireFeature: true
  requireReview: false
  featureFreeze: []
  maxRisk: high
  detectWriteConflicts: true
dashboard: { port: 5173 }
```

## Reference

- Status: `pending` | `in_progress` | `blocked` | `hold` | `deferred` | `done`
- Priority: `P0` | `P1` | `P2`
- Risk: `low` | `medium` | `high` | `critical`
- Lane: `contract` | `writer` | `runtime` | `ui` | `test` | `review`
- Feature status: `design` | `contract_frozen` | `implementing` | `stable`
- Task ID: `U-xxx` unfinished, `D-xxx` done, `B-xxx` block, `R-YYYY-MM-DD-NNN` round
