# Tally

Agent-native task management — a CLI-driven task ledger with round discipline, multi-agent safety, auto-retry, and visualization. Tally is designed for AI agents to autonomously manage work through a structured round-based workflow. The dashboard is the sole human interface.

## Installation

```bash
npm install -g tally
```

Or use directly with npx:

```bash
npx tally <command>
```

## Quick Start

Initialize a new tally ledger in your project:

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

## Command Reference

| Command | Description |
|---------|-------------|
| `tally init` | Initialize a new tally.json in the current directory |
| `tally status` | Show current task state summary |
| `tally check` | Deep validation with semantic checks and warnings |
| `tally lint` | Fast structural validation (pre-commit) |
| `tally task add` | Add one or more new tasks (JSON) |
| `tally task edit <id>` | Modify task fields (14+ fields supported) |
| `tally task done <ids...>` | Mark tasks as done with structured evidence (--test, --commit, --review, --no-forbidden) |
| `tally task block <ids...>` | Block tasks with a reason |
| `tally task unblock <ids...>` | Unblock tasks |
| `tally task show <id>` | Show full task detail with quality score |
| `tally task list` | Filterable (--status open, --module, --feature, --priority, --open) |
| `tally task next` | Recommend the single best next task (--strategy, --lane) |
| `tally task annotate <id>` | Metadata-only edit, safe for done tasks |
| `tally task approve <id>` | Human approval for high-risk tasks |
| `tally round start <scope>` | Start round (--auto-retry, --dry-run, --strategy, --json) |
| `tally round report` | Mid-round progress report |
| `tally round close` | Close round (--auto-next, --integrate, --json) |
| `tally round context` | Agent state for session restoration |
| `tally audit backlog` | Find tasks missing specified fields |
| `tally export` | Export (json, csv, markdown, agent-brief) |
| `tally graph` | Dependency graph (--level task\|feature) |
| `tally dashboard` | Start the dashboard HTTP server |
| `tally sync` / `tally upgrade` / `tally migrate` | Sync, schema upgrade, legacy import |

## Config (.tallyrc.yaml)

Tally reads `.tallyrc.yaml` from the project root. Example:

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

## Multi-Agent Setup

Tally supports multiple agents working on the same ledger. Each agent sets its identity via environment variable:

```bash
export TALLY_AGENT_ID=agent-alpha
```

Agents must be registered in `tally.json` under `_meta.agents`. Before starting a round, pull the latest ledger:

```bash
git pull
tally round start "Feature work" --tasks U-002 U-003
```

After closing a round, sync changes:

```bash
tally round close
tally sync
```

If a round start fails due to a claim conflict, re-read `tally.json`, adjust task selection, and retry.

## Data Model

See `standard/templates/tally-schema.md` for the full data model reference.

Key task fields (v0.2.0):

| Category | Fields |
|----------|--------|
| Core | `id`, `status`, `priority`, `stage`, `module`, `name`, `acceptance`, `feature` |
| Scheduling | `writeScopes`, `riskLevel`, `executionLane`, `requiresReview`, `rollbackPlan`, `assignedAgent`, `approvedBy` |
| Planning | `acceptanceCriteria`, `executionPlan` |
| Tracking | `resourceRequirements`, `repos`, `deliveryNode` |

## Development

```bash
# Install dependencies
npm install

# Build both CLI and dashboard
npm run build

# Run tests (329 tests)
npm test

# Coverage report
npx vitest run --coverage
```

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
│   ├── claude-code/        # Claude Code skill
│   └── copilot-cli/        # Copilot CLI skill
├── standard/               # Standard documents
│   ├── manifest.yaml       # Agent plugin manifest
│   └── templates/          # Copyable templates
├── tally.json              # Task ledger (never edit directly)
└── .tallyrc.yaml           # Project config
```
