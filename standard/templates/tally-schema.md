# Tally Data Model

Tally projects use `.tally/tally.json` and `.tally/config.yaml`.

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
| `aodsRefs` | string[] | AODS module/rule/acceptance refs that authorize the task |
| `codeRefs` | string[] | GitNexus symbols, files, or execution flows grounding the task in code |
| `implementationTargets` | string[] | Packages, symbols, contracts, or surfaces the task intends to change |
| `deps` | string[] | Task IDs this task depends on |
| `blocks` | string \| null | Description of what this task blocks |
| `evidence` | string \| null | Verifiable evidence of completion |
| `claimedBy` | string \| null | Agent ID that claimed this task |
| `nextAction` | string \| null | Next action to take |
| `feature` | string \| null | Feature this task belongs to |
| `planRef` | string \| null | Registered implementation plan ID from `_meta.plans[]` |
| `planPath` | string \| null | Snapshot of the registered plan path |
| `planTaskRef` | string \| null | Heading or task reference inside the plan |
| `planContentHash` | string \| null | Snapshot of the plan content hash at link time |

## Plan Registry

Tally can reference external implementation plans, such as Superpowers Markdown plans.

Plan registry entries live under `_meta.plans[]`.

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Stable plan ID, usually `plan:<slug>` |
| `path` | string | Plan file path, stored relative to the project when possible |
| `title` | string | Plan title, usually derived from the first Markdown H1 |
| `kind` | string | Plan kind, usually `superpowers` |
| `requiredSkill` | string \| null | Skill expected to execute the plan |
| `contentHash` | string | SHA-256 hash of the plan content |
| `status` | string | `active`, `archived`, or `superseded` |
| `registeredAt` | string | ISO timestamp when the plan was first registered |
| `updatedAt` | string | ISO timestamp when the plan registry entry was last updated |

Use `tally plan check` to detect missing plan files, hash drift, unknown task plan refs, and task refs that no longer exist inside the plan.

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
