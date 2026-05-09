# Tally

Agent-native task management — a CLI-driven task ledger with round discipline, dependency tracking, and visualization. Tally is designed for AI agents and human developers to collaboratively manage work through a structured round-based workflow.

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

Add your first task:

```bash
tally task add --name "Setup project" --stage foundation --module core
```

Start a work round:

```bash
tally round start "Initial setup" --tasks U-001
```

Mark a task done with evidence:

```bash
tally task done U-001 --evidence "Project scaffold created and configured"
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
| `tally check` | Validate project readiness before starting a round |
| `tally lint` | Validate tally.json structural integrity |
| `tally task add` | Add one or more new tasks (JSON or interactive) |
| `tally task done <ids...>` | Mark tasks as done with evidence |
| `tally task block <ids...>` | Block tasks with a reason |
| `tally task unblock <ids...>` | Unblock tasks |
| `tally task show <id>` | Show task detail |
| `tally round start <scope>` | Start a new work round claiming tasks |
| `tally round report` | Show mid-round progress report |
| `tally round close` | Close the current round |
| `tally export` | Export ledger data (markdown, JSON) |
| `tally sync` | Sync tally.json via git pull/push |
| `tally graph` | Visualize task dependency graph |
| `tally upgrade` | Upgrade tally.json schema version |
| `tally migrate` | Migrate legacy task data into tally format |
| `tally dashboard` | Start the dashboard HTTP server |

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
```

| Key | Default | Description |
|-----|---------|-------------|
| `agent.id` | `main` | Default agent identifier |
| `round.maxTasks` | `10` | Maximum tasks per round |
| `round.allowParallel` | `false` | Allow parallel task execution |
| `lint.strict` | `false` | Enable strict lint mode |
| `dashboard.port` | `5173` | Dashboard HTTP server port |

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

## Development

```bash
# Install dependencies
npm install

# Build both CLI and dashboard
npm run build

# Run tests
npm test

# Lint
npm run lint
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
