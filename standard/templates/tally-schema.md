# Tally Data Model — tally.json

## Status Enum

| Status | Meaning |
|--------|---------|
| `pending` | Ready to work, not yet started |
| `in_progress` | Currently being worked on |
| `blocked` | Cannot proceed; a dependency or external condition is unmet |
| `hold` | Deliberately postponed; no current intent to act |
| `deferred` | Moved to a later stage or round |
| `done` | Completed with verifiable evidence |

## Priority Enum

| Priority | Meaning |
|----------|---------|
| `P0` | Critical — must complete in current stage |
| `P1` | Important — high value but not blocking |
| `P2` | Nice-to-have — when time permits |

## Key Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier (`U-xxx` / `D-xxx` / `B-xxx` / `R-xxx`) |
| `status` | string | One of the status enum values |
| `priority` | string | One of `P0` / `P1` / `P2` |
| `stage` | string | Stage this task belongs to |
| `module` | string | Module this task belongs to |
| `name` | string | Short human-readable title |
| `acceptance` | string | Acceptance criteria or definition of done |
| `deps` | string[] | Task IDs this task depends on |
| `blocks` | string \| null | Description of what this task blocks |
| `evidence` | string \| null | Verifiable evidence of completion |
| `claimedBy` | string \| null | Agent ID that claimed this task |
| `nextAction` | string \| null | Next action to take |
| `feature` | string \| null | Feature this task belongs to |

## ID Prefix Convention

| Prefix | Meaning |
|--------|---------|
| `U-` | Unfinished — task pending or in progress |
| `D-` | Done — task completed |
| `B-` | Block — a blocking issue or dependency |
| `R-` | Round — a work round record |

## Round Fields

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Round identifier (e.g., `R-001`) |
| `scope` | string | Scope description |
| `taskIds` | string[] | Task IDs included in this round |
| `startedAt` | string | ISO date the round started |
| `completedAt` | string \| null | ISO date the round completed |
| `evidence` | string \| null | Completion evidence |
