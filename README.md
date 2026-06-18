# Tally

Agent-native task management — a CLI-driven task ledger with round discipline, multi-agent safety, auto-retry, and visualization. Tally is designed for AI agents to autonomously manage work through a structured round-based workflow. The dashboard is the sole human interface.

New projects store Tally state under `.tally/`:

```text
.tally/
  tally.json
  config.yaml
```

Only `.tally/tally.json` and `.tally/config.yaml` are part of the current Tally
standard.

## Installation

```bash
npm install -g tally
```

Or use directly with npx:

```bash
npx tally <command>
```

## Quick Start

Initialize a new Tally ledger in your project:

```bash
tally init
```

Add your first task with feature and scheduling fields:

```bash
tally task add --json '[{"name":"Setup project","stage":"S1","module":"core","feature":"scaffold","priority":"P0","acceptance":"Repo created"}]'
```

Start a work round (auto-selects tasks, checks for conflicts):

```bash
tally round start "Initial setup"
```

Mark a task done with structured evidence:

```bash
tally task done U-001 --evidence "Project scaffold created" --test "npm test" --commit "abc1234"
```

Close the round:

```bash
tally round close
```

## Superpowers Plan Integration

Tally does not replace a Superpowers implementation plan.

Use them together like this:

- Superpowers plan: the detailed recipe. It explains what to change, which files to touch, which commands to run, and how to verify.
- Tally: the execution ledger. It records which task is being worked on, who claimed it, which round it belongs to, and what evidence proves it was done.

Typical flow:

```bash
tally plan register docs/superpowers/plans/2026-06-01-demo.md

tally task link-plan U-001 \
  --plan plan:demo-implementation-plan \
  --task-ref "Task 1"

tally plan check

tally export --format agent-brief --task U-001
```

What gets stored:

- `_meta.plans[]` stores the registered plan path, title, type, required skill, status, and content hash.
- `task.planRef` points to a registered plan.
- `task.planTaskRef` points to the relevant task/heading inside that plan.
- `task.planContentHash` keeps a snapshot so `tally plan check` can warn when the plan changed after the task was linked.

The rule of thumb: if an agent needs to know exactly how to implement something, read the plan. If an agent needs to know what to do next, what is claimed, and what is already proven, use Tally.

## Command Reference

| Command | Description |
|---------|-------------|
| `tally init` | Initialize a new `.tally/tally.json` ledger in the current directory |
| `tally status` | Show current task state summary |
| `tally check` | Deep validation with semantic checks and warnings |
| `tally lint` | Fast structural validation (pre-commit) |
| `tally task add` | Add one or more new tasks (JSON) |
| `tally task edit <id>` | Modify task fields (14+ fields supported) |
| `tally task done <ids...>` | Mark tasks as done with structured evidence (--test, --commit, --review, --no-forbidden) |
| `tally task evidence <ids...>` | Backfill or intentionally append/replace evidence on done tasks only |
| `tally task block <ids...>` | Block tasks with a reason |
| `tally task unblock <ids...>` | Unblock tasks |
| `tally task show <id>` | Show full task detail with quality score |
| `tally task list` | Filterable (--status open, --module, --feature, --priority, --open) |
| `tally task next` | Recommend the single best next task (--strategy, --lane) |
| `tally task annotate <id>` | Metadata-only edit, safe for done tasks |
| `tally task approve <id>` | Human approval for high-risk tasks |
| `tally task link-plan <id>` | Link a task to a registered implementation plan |
| `tally plan register <path>` | Register a Superpowers-style plan and store its hash |
| `tally plan list` | List registered plans |
| `tally plan check` | Check plan files, hash drift, and task plan references |
| `tally round start <scope>` | Start round (--auto-retry, --dry-run, --strategy, --json) |
| `tally round report` | Mid-round progress report |
| `tally round close` | Close round (--auto-next, --integrate, --json) |
| `tally round context` | Agent state for session restoration |
| `tally audit backlog` | Find tasks missing specified fields |
| `tally audit evidence` | Count done tasks missing evidence or review evidence |
| `tally repair missing-evidence` | Backfill null evidence on historical done tasks |
| `tally export` | Export (json, csv, markdown, agent-brief) |
| `tally graph` | Dependency graph (--level task\|feature) |
| `tally dashboard` | Start the dashboard HTTP server |
| `tally sync` / `tally upgrade` / `tally migrate` | Sync, schema upgrade, Markdown import |

## Config (.tally/config.yaml)

Tally reads `.tally/config.yaml` from the project root. Example:

```yaml
agent:
  id: main

round:
  maxTasks: 10
  allowParallel: false

lint:
  strict: false

dashboard:
  port: 5173

gates:
  requireFeature: true
  requireReview: false
  featureFreeze: []
  maxRisk: high
  detectWriteConflicts: true
```

| Key | Default | Description |
|-----|---------|-------------|
| `agent.id` | `main` | Default agent identifier |
| `round.maxTasks` | `10` | Maximum tasks per round |
| `round.allowParallel` | `false` | Allow parallel task execution |
| `lint.strict` | `false` | Enable strict lint mode |
| `dashboard.port` | `5173` | Dashboard HTTP server port |
| `gates.requireFeature` | `true` | Open tasks must have a feature |
| `gates.requireReview` | `false` | Require review for all tasks |
| `gates.featureFreeze` | `[]` | Frozen feature IDs (only contract/test allowed) |
| `gates.maxRisk` | `high` | Maximum risk level allowed in rounds |
| `gates.detectWriteConflicts` | `true` | Detect overlapping write scopes |

Dashboard port behavior:

- `tally dashboard` uses `dashboard.port`, default `5173`.
- Dashboard Vite dev/preview also uses fixed port `5173` with strict port mode.
- If the port is occupied, startup fails with a clear error instead of silently switching to a random port.
- For dashboard frontend development, run the API server separately with `tally dashboard --port 5199 --no-open`; the Vite dev server proxies `/api` to `http://localhost:5199`.

## Round Safety Checks

When starting a round, Tally enforces multi-agent safety:

1. **Write scope conflict detection** — overlapping `writeScopes` rejected
2. **Risk gating** — tasks above `gates.maxRisk` rejected
3. **Feature freeze gating** — only contract/test tasks on frozen features
4. **Approval gate** — unapproved high/critical risk tasks rejected
5. **Dependency satisfaction** — all `deps` must be `done`

Round strategies:
- `parallel-max` (default): maximize parallelism, group by module → feature
- `feature-focused`: complete one feature before moving to the next
- `risk-first`: highest risk tasks first

## Structured Evidence

```bash
tally task done U-001 \
  --evidence "Implemented feature" \
  --test "pnpm test --filter=auth" \
  --commit "abc1234" \
  --review "PR #42 approved" \
  --provider "openai/gpt-4o for code generation" \
  --notes "Edge case handled in U-005"
```

## Historical Evidence Repair

Use `task evidence` or `repair missing-evidence` only for preserving historical ledger state when old/imported done tasks are missing evidence. Phrase evidence honestly: record what is being backfilled, and do not imply fresh tests, commits, or review approvals happened during repair unless they actually did.

Backfill selected completed tasks:

```bash
tally task evidence D-006 D-007 \
  --evidence "Backfilled missing historical completion evidence" \
  --test "not rerun during repair" \
  --commit "abc1234" \
  --review "missing prior review evidence recorded" \
  --no-forbidden \
  --json-output
```

Repair every done task with `evidence: null`:

```bash
tally repair missing-evidence --dry-run --json

tally repair missing-evidence \
  --evidence "Historical completion imported before evidence enforcement" \
  --test "not rerun during repair" \
  --commit "abc1234" \
  --review "missing prior review evidence recorded" \
  --no-forbidden
```

Safety rules:

- Only `status: done` tasks can receive evidence through these repair paths.
- Existing evidence is preserved unless `--append` or `--replace` is explicit.
- Completion facts such as status, order, dependencies, and completion timestamps are not changed.
- Done tasks with `requiresReview: true` require `--review` unless `--allow-missing-review` is explicit.
- `tally lint --json`, `tally check --json`, `tally audit evidence --json`, and `tally upgrade` report repair guidance for missing done evidence.

## Multi-Agent Setup

Tally supports multiple agents working on the same ledger. Each agent sets its identity via environment variable:

```bash
export TALLY_AGENT_ID=agent-alpha
```

Agents must be registered in `.tally/tally.json` under `_meta.agents`. Before starting a round, pull the latest ledger:

```bash
git pull
tally round start "Feature work" --tasks U-002 U-003
```

After closing a round, sync changes:

```bash
tally round close
tally sync
```

If a round start fails due to a claim conflict, re-read `.tally/tally.json`, adjust task selection, and retry.

## Data Model

See `standard/templates/tally-schema.md` for the full data model reference.

Key task fields (v0.6.0):

| Category | Fields |
|----------|--------|
| Core | `id`, `status`, `priority`, `stage`, `module`, `name`, `acceptance`, `feature` |
| Scheduling | `writeScopes`, `riskLevel`, `executionLane`, `requiresReview`, `rollbackPlan`, `assignedAgent`, `approvedBy` |
| Planning | `aodsRefs`, `codeRefs`, `implementationTargets`, `acceptanceCriteria`, `executionPlan`, `planRef`, `planPath`, `planTaskRef`, `planContentHash` |
| Tracking | `resourceRequirements`, `repos`, `deliveryNode` |

## Development

```bash
# Install dependencies
npm install

# Build both CLI and dashboard
npm run build

# Run tests (346 tests)
npm test

# Coverage report
npx vitest run --coverage
```

## Release Discipline

Every Tally release must update the agent skill files when CLI behavior, ledger schema, config shape, dashboard behavior, or recommended agent workflow changes.

Required release checks:

- Update `skills/codex/tally-use/SKILL.md`, which is the canonical Codex `tally-use` skill.
- Update `skills/claude-code/skill.json` so `skill_version` and `aligned_release` match the release.
- Update `skills/claude-code/tally.md` for Claude Code compatibility.
- Update `skills/copilot-cli/tally.yaml` with the same command and workflow changes.
- Mention skill-facing changes in `CHANGELOG.md`.
- If using the skill locally with Codex, sync `skills/codex/tally-use/SKILL.md` to `~/.codex/skills/tally-use/SKILL.md`.

## Project Structure

```
tally/
├── cli/                    # CLI application (TypeScript + Commander)
│   ├── src/
│   │   ├── commands/       # Command implementations
│   │   ├── index.ts        # Entry point
│   │   ├── schema.ts       # JSON Schema + validators
│   │   ├── config.ts       # Config reader
│   │   ├── ledger-reader.ts
│   │   ├── ledger-writer.ts
│   │   └── types.ts
│   └── tests/
├── dashboard/              # Web dashboard (React + Vite + Recharts)
│   └── src/
├── skills/                 # Agent integration files
│   ├── codex/              # Codex skill
│   ├── claude-code/        # Claude Code skill
│   └── copilot-cli/        # Copilot CLI skill
├── standard/               # Standard documents
│   ├── manifest.yaml       # Agent plugin manifest
│   └── templates/          # Copyable templates
└── .tally/
    ├── tally.json          # Task ledger (never edit directly)
    └── config.yaml         # Project config
```
