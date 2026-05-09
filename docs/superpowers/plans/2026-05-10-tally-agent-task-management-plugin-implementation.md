# Tally Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Tally agent-native task management plugin — CLI, dashboard, and agent skills — as a reusable npm package.

**Architecture:** Three subsystems sharing a common JSON schema: (1) Node.js/TS CLI that reads/writes `tally.json` as the sole write gate, (2) React/Vite dashboard SPA that visualizes `tally.json` via a built-in HTTP server, (3) Agent skill files that tell Claude Code/Copilot CLI how to invoke Tally commands.

**Tech Stack:** Node.js 18+, TypeScript 5.x, ajv (JSON Schema validation), Commander.js (CLI framework), Vitest, React 19, Vite 6, Tailwind CSS 4, Recharts 2, dagre

**Repo:** `tally` (new, independent). Create at `~/workspace/tally`.

---

## File Structure

```
tally/
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── .tallyrc.yaml                    # Default config template
├── README.md
│
├── cli/
│   ├── package.json                 # "tally" binary entry
│   ├── tsconfig.json
│   ├── src/
│   │   ├── index.ts                 # CLI entry, Commander.js wiring
│   │   ├── types.ts                 # All TypeScript types
│   │   ├── schema.ts                # JSON Schema v2020-12 + ajv validator
│   │   ├── config.ts                # .tallyrc.yaml reader (env → local → global)
│   │   ├── ledger-reader.ts         # Read + parse + validate tally.json
│   │   ├── ledger-writer.ts         # Atomic write tally.json with backup
│   │   └── commands/
│   │       ├── init.ts
│   │       ├── lint.ts
│   │       ├── check.ts
│   │       ├── status.ts
│   │       ├── round.ts             # start / report / close
│   │       ├── task.ts              # add / show / edit / done / block / unblock / list
│   │       ├── dashboard.ts         # Start HTTP server + open browser
│   │       ├── graph.ts             # Dependency graph analysis
│   │       ├── export.ts            # Export to various formats
│   │       ├── migrate.ts           # Markdown → tally.json
│   │       ├── sync.ts              # Git add + commit + push
│   │       └── upgrade.ts           # Schema version migration
│   └── tests/
│       ├── fixtures/
│       │   ├── valid-tally.json
│       │   ├── missing-evidence.json
│       │   ├── dependency-cycle.json
│       │   ├── stale-claim.json
│       │   └── legacy-os-ledger.md
│       ├── schema.test.ts
│       ├── ledger-reader.test.ts
│       ├── ledger-writer.test.ts
│       ├── lint.test.ts
│       ├── check.test.ts
│       ├── round.test.ts
│       ├── task.test.ts
│       └── migrate.test.ts
│
├── dashboard/
│   ├── package.json
│   ├── vite.config.ts
│   ├── tsconfig.json
│   ├── index.html
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── index.css               # Sketch theme (ported from inori-dashboard)
│   │   ├── lib/
│   │   │   ├── types.ts             # Mirrors cli/src/types.ts Task/Round/etc
│   │   │   └── loader.ts            # fetch('/api/tally.json') → LedgerData
│   │   ├── hooks/
│   │   │   └── useLedgerData.ts
│   │   └── components/
│   │       ├── ui/                  # card, badge, progress, table (ported)
│   │       ├── overview-bar.tsx
│   │       ├── progress-trend.tsx
│   │       ├── current-round.tsx
│   │       ├── stage-matrix.tsx
│   │       ├── block-list.tsx
│   │       ├── task-table.tsx
│   │       ├── dependency-graph.tsx
│   │       ├── round-timeline.tsx   # NEW: chronological round view
│   │       └── dashboard-layout.tsx
│   └── dist/                        # Vite build output
│
├── skills/
│   ├── claude-code/
│   │   └── tally.md
│   └── copilot-cli/
│       └── tally.yaml
│
└── standard/
    ├── manifest.yaml
    └── templates/
        ├── tally-schema.md
        ├── round-log.md
        └── report.md
```

---

### Task 1: Repository Scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `vitest.config.ts`, `cli/package.json`, `cli/tsconfig.json`, `dashboard/package.json`

- [ ] **Step 1: Create root package.json (monorepo workspace)**

```bash
mkdir -p ~/workspace/tally && cd ~/workspace/tally && git init
```

```json
// package.json
{
  "name": "tally",
  "private": true,
  "workspaces": ["cli", "dashboard"],
  "scripts": {
    "test": "npm run test -w cli",
    "build": "npm run build -w cli && npm run build -w dashboard",
    "lint": "npm run lint -w cli"
  }
}
```

- [ ] **Step 2: Create root tsconfig.json**

```json
// tsconfig.json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "declaration": true
  }
}
```

- [ ] **Step 3: Create CLI package**

```json
// cli/package.json
{
  "name": "tally",
  "version": "0.1.0",
  "type": "module",
  "bin": {
    "tally": "./dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "dev": "tsc --watch",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "ajv": "^8.17.0",
    "commander": "^13.0.0",
    "yaml": "^2.7.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "typescript": "~5.7.0",
    "vitest": "^3.0.0"
  }
}
```

- [ ] **Step 4: Create CLI tsconfig**

```json
// cli/tsconfig.json
{
  "extends": "../tsconfig.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src"]
}
```

- [ ] **Step 5: Create vitest config**

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true,
  },
})
```

- [ ] **Step 6: Create .gitignore + .tallyrc.yaml template**

```
// .gitignore
node_modules/
dist/
*.tsbuildinfo
```

```yaml
# .tallyrc.yaml — Tally project config
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

- [ ] **Step 7: Install and verify**

```bash
cd ~/workspace/tally && npm install
```

- [ ] **Step 8: Commit**

```bash
git add -A && git commit -m "feat: scaffold tally monorepo"
```

---

### Task 2: Core Types

**Files:**
- Create: `cli/src/types.ts`

- [ ] **Step 1: Write types.ts**

```typescript
// cli/src/types.ts

// ── Enum types ──

export type TaskStatus = 'pending' | 'in_progress' | 'blocked' | 'hold' | 'deferred' | 'done'
export type Priority = 'P0' | 'P1' | 'P2'
export type RoundStatus = 'active' | 'completed'

// ── Meta ──

export interface AgentEntry {
  id: string
  name: string
}

export interface StageEntry {
  id: string
  name: string
  modules: string[]
}

export interface ModuleEntry {
  id: string
  name: string
}

export interface TallyMeta {
  project: string
  tally_version: string
  created: string
  updated: string
  agents: AgentEntry[]
  stages: StageEntry[]
  modules: ModuleEntry[]
}

// ── Task ──

export interface Task {
  id: string
  status: TaskStatus
  priority: Priority
  stage: string
  module: string
  name: string
  acceptance: string
  deps: string[]
  blocks: string | null
  nextAction: string | null
  evidence: string | null
  rule: string | null
  tags: string[]
  order: number | null
  completedOrder: number | null
  claimedBy: string | null
  claimedAt: string | null
  createdAt: string
  completedAt: string | null
}

// ── Round ──

export interface PlannedTask {
  taskId: string
  goal: string
  criteria: string
}

export interface Round {
  id: string
  start: string
  executor: string
  scope: string
  exclusions: string
  plannedTasks: PlannedTask[]
  completedAt: string | null
  status: RoundStatus
}

// ── Block ──

export interface BlockItem {
  id: string
  affects: string[]
  content: string
  strategy: string
  createdAt: string
  resolvedAt: string | null
}

// ── Progress ──

export interface ProgressPoint {
  date: string
  totalDone: number
  totalOpen: number
  totalHold: number
  totalBlocked: number
  evidence: string
  notes: string
}

// ── Top-level document ──

export interface TallyDocument {
  _meta: TallyMeta
  tasks: Task[]
  rounds: Round[]
  blocks: BlockItem[]
  progress: ProgressPoint[]
}

// ── Config ──

export interface TallyConfig {
  agent: { id: string }
  round: { maxTasks: number; allowParallel: boolean }
  lint: { strict: boolean }
  dashboard: { port: number }
}

// ── CLI results ──

export interface LintResult {
  valid: boolean
  errors: LintError[]
}

export interface LintError {
  path: string       // JSON path to the error
  message: string
}

export interface CheckResult {
  valid: boolean
  errors: CheckError[]
  warnings: CheckError[]
}

export interface CheckError {
  code: string       // e.g. "REFERENCE_INTEGRITY", "CYCLE_DETECTED", "STALE_CLAIM"
  message: string
  path?: string
}

export interface StatusResult {
  totalDone: number
  totalOpen: number
  totalHold: number
  totalBlocked: number
  activeRoundId: string | null
  activeBlocks: number
}

export interface GraphResult {
  nodes: { id: string; name: string; status: string; depth: number; criticalPath: boolean }[]
  edges: { from: string; to: string }[]
  criticalPathLength: number
  maxDepth: number
  parallelism: { min: number; max: number }
}
```

- [ ] **Step 2: Verify compilation**

```bash
cd ~/workspace/tally/cli && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add cli/src/types.ts && git commit -m "feat: add core TypeScript types"
```

---

### Task 3: JSON Schema + ajv Validator

**Files:**
- Create: `cli/src/schema.ts`
- Test: `cli/tests/schema.test.ts`

- [ ] **Step 1: Write JSON Schema**

```typescript
// cli/src/schema.ts
import type { JSONSchemaType } from 'ajv'
import type { TallyDocument } from './types'

export const TALLY_JSON_SCHEMA: JSONSchemaType<TallyDocument> = {
  type: 'object',
  properties: {
    _meta: {
      type: 'object',
      properties: {
        project: { type: 'string' },
        tally_version: { type: 'string', const: '1.0' },
        created: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
        updated: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
        agents: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
            },
            required: ['id', 'name'],
          },
        },
        stages: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
              modules: { type: 'array', items: { type: 'string' } },
            },
            required: ['id', 'name', 'modules'],
          },
        },
        modules: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              name: { type: 'string' },
            },
            required: ['id', 'name'],
          },
        },
      },
      required: ['project', 'tally_version', 'created', 'updated', 'agents', 'stages', 'modules'],
    },
    tasks: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', pattern: '^[UDB]-\\d+$' },
          status: { type: 'string', enum: ['pending', 'in_progress', 'blocked', 'hold', 'deferred', 'done'] },
          priority: { type: 'string', enum: ['P0', 'P1', 'P2'] },
          stage: { type: 'string' },
          module: { type: 'string' },
          name: { type: 'string' },
          acceptance: { type: 'string' },
          deps: { type: 'array', items: { type: 'string' } },
          blocks: { type: 'string', nullable: true },
          nextAction: { type: 'string', nullable: true },
          evidence: { type: 'string', nullable: true },
          rule: { type: 'string', nullable: true },
          tags: { type: 'array', items: { type: 'string' } },
          order: { type: 'number', nullable: true },
          completedOrder: { type: 'number', nullable: true },
          claimedBy: { type: 'string', nullable: true },
          claimedAt: { type: 'string', nullable: true },
          createdAt: { type: 'string', pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
          completedAt: { type: 'string', nullable: true },
        },
        required: ['id', 'status', 'priority', 'stage', 'module', 'name', 'acceptance', 'deps', 'tags', 'createdAt'],
      },
    },
    rounds: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string', pattern: '^R-\\d{4}-\\d{2}-\\d{2}-\\d{3}$' },
          start: { type: 'string' },
          executor: { type: 'string' },
          scope: { type: 'string' },
          exclusions: { type: 'string' },
          plannedTasks: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                taskId: { type: 'string' },
                goal: { type: 'string' },
                criteria: { type: 'string' },
              },
              required: ['taskId', 'goal', 'criteria'],
            },
          },
          completedAt: { type: 'string', nullable: true },
          status: { type: 'string', enum: ['active', 'completed'] },
        },
        required: ['id', 'start', 'executor', 'scope', 'exclusions', 'plannedTasks', 'status'],
      },
    },
    blocks: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          affects: { type: 'array', items: { type: 'string' } },
          content: { type: 'string' },
          strategy: { type: 'string' },
          createdAt: { type: 'string' },
          resolvedAt: { type: 'string', nullable: true },
        },
        required: ['id', 'affects', 'content', 'strategy', 'createdAt'],
      },
    },
    progress: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          date: { type: 'string' },
          totalDone: { type: 'number' },
          totalOpen: { type: 'number' },
          totalHold: { type: 'number' },
          totalBlocked: { type: 'number' },
          evidence: { type: 'string' },
          notes: { type: 'string' },
        },
        required: ['date', 'totalDone', 'totalOpen', 'totalHold', 'totalBlocked', 'evidence', 'notes'],
      },
    },
  },
  required: ['_meta', 'tasks', 'rounds', 'blocks', 'progress'],
  additionalProperties: false,
}
```

Similarly import ajv and export validate/lint functions. The full schema is too large to inline — implementer writes from the types definition using ajv's JSONSchemaType.

Key lint checks beyond ajv:
- Task with `status: 'done'` MUST have non-null `evidence`
- Task with `status != 'done'` MUST have null `evidence` and non-null `nextAction`
- `order` unique among non-done tasks; no collisions
- `completedOrder` unique among done tasks
- `claimedBy` must reference a valid round ID or be null
- `claimedAt` non-null iff `claimedBy` non-null

- [ ] **Step 2: Write failing test**

```typescript
// cli/tests/schema.test.ts
import { describe, it, expect } from 'vitest'
import { validateDocument, lintDocument } from '../src/schema'
import { readFileSync } from 'fs'
import { join } from 'path'

const FIXTURES = join(__dirname, 'fixtures')

function loadFixture(name: string): unknown {
  return JSON.parse(readFileSync(join(FIXTURES, name), 'utf-8'))
}

describe('validateDocument', () => {
  it('passes a valid tally.json', () => {
    const doc = loadFixture('valid-tally.json')
    const result = validateDocument(doc)
    expect(result.valid).toBe(true)
  })

  it('rejects missing evidence on done task', () => {
    const doc = loadFixture('missing-evidence.json')
    const result = validateDocument(doc)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.path.includes('evidence'))).toBe(true)
  })

  it('rejects dependency cycle', () => {
    const doc = loadFixture('dependency-cycle.json')
    const result = validateDocument(doc)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.code === 'CYCLE_DETECTED')).toBe(true)
  })

  it('rejects stale claim (claimedBy references non-existent round)', () => {
    const doc = loadFixture('stale-claim.json')
    const result = validateDocument(doc)
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.code === 'STALE_CLAIM')).toBe(true)
  })
})
```

- [ ] **Step 3: Implement schema.ts**

Implement `validateDocument()` using ajv + custom keyword validators for field constraints, cycle detection (DFS), and reference integrity checks.

- [ ] **Step 4: Create test fixtures**

`valid-tally.json` — a complete minimal tally.json with 2 tasks, 1 round, 0 blocks.
`missing-evidence.json` — same but one done task has null evidence.
`dependency-cycle.json` — two tasks with mutual deps.
`stale-claim.json` — task claimedBy a non-existent round ID.

- [ ] **Step 5: Run tests → pass**

```bash
cd ~/workspace/tally/cli && npx vitest run tests/schema.test.ts
```

- [ ] **Step 6: Commit**

```bash
git add cli/src/schema.ts cli/tests/schema.test.ts cli/tests/fixtures/
git commit -m "feat: add JSON Schema + ajv validator with lint checks"
```

---

### Task 4: Config Reader + Ledger I/O

**Files:**
- Create: `cli/src/config.ts`, `cli/src/ledger-reader.ts`, `cli/src/ledger-writer.ts`
- Test: `cli/tests/ledger-reader.test.ts`, `cli/tests/ledger-writer.test.ts`

- [ ] **Step 1: Write config.ts**

```typescript
// cli/src/config.ts
import { readFileSync } from 'fs'
import { join } from 'path'
import { parse as parseYaml } from 'yaml'
import { homedir } from 'os'
import type { TallyConfig } from './types'

const DEFAULTS: TallyConfig = {
  agent: { id: 'main' },
  round: { maxTasks: 10, allowParallel: false },
  lint: { strict: false },
  dashboard: { port: 5173 },
}

function loadYaml(path: string): Partial<TallyConfig> | null {
  try {
    const raw = readFileSync(path, 'utf-8')
    return parseYaml(raw) as Partial<TallyConfig>
  } catch {
    return null
  }
}

export function loadConfig(cwd: string = process.cwd()): TallyConfig {
  const global = loadYaml(join(homedir(), '.tallyrc.yaml')) ?? {}
  const local = loadYaml(join(cwd, '.tallyrc.yaml')) ?? {}
  const envId = process.env['TALLY_AGENT_ID']

  const merged: TallyConfig = {
    agent: { id: envId ?? local.agent?.id ?? global.agent?.id ?? DEFAULTS.agent.id },
    round: { ...DEFAULTS.round, ...global.round, ...local.round },
    lint: { ...DEFAULTS.lint, ...global.lint, ...local.lint },
    dashboard: { ...DEFAULTS.dashboard, ...global.dashboard, ...local.dashboard },
  }
  return merged
}
```

- [ ] **Step 2: Write ledger-reader.ts**

```typescript
// cli/src/ledger-reader.ts
import { readFileSync } from 'fs'
import { join } from 'path'
import type { TallyDocument } from './types'

const DEFAULT_PATH = 'tally.json'

export function readLedger(cwd: string = process.cwd(), filename: string = DEFAULT_PATH): TallyDocument {
  const fullPath = join(cwd, filename)
  let raw: string
  try {
    raw = readFileSync(fullPath, 'utf-8')
  } catch {
    throw new Error(`tally.json not found at ${fullPath}. Run 'tally init' first.`)
  }
  try {
    return JSON.parse(raw) as TallyDocument
  } catch (e) {
    throw new Error(`tally.json at ${fullPath} is not valid JSON: ${(e as Error).message}`)
  }
}

export function ledgerPath(cwd: string = process.cwd(), filename: string = DEFAULT_PATH): string {
  return join(cwd, filename)
}
```

- [ ] **Step 3: Write ledger-writer.ts**

Atomic write: write to `.tally.json.tmp`, fsync, rename to `tally.json`.

```typescript
// cli/src/ledger-writer.ts
import { writeFileSync, renameSync } from 'fs'
import { join, dirname } from 'path'
import type { TallyDocument } from './types'

export function writeLedger(
  doc: TallyDocument,
  cwd: string = process.cwd(),
  filename: string = 'tally.json',
): void {
  const fullPath = join(cwd, filename)
  const tmpPath = join(cwd, `.${filename}.tmp`)
  const json = JSON.stringify(doc, null, 2) + '\n'

  writeFileSync(tmpPath, json, 'utf-8')
  renameSync(tmpPath, fullPath)
}
```

- [ ] **Step 4: Write tests, verify, commit**

Test fixtures in `cli/tests/fixtures/valid-tally.json`. Test that readLedger parses correctly and writeLedger produces valid JSON round-trippable with readLedger.

```bash
cd ~/workspace/tally/cli && npx vitest run tests/ledger-reader.test.ts tests/ledger-writer.test.ts
git add cli/src/config.ts cli/src/ledger-reader.ts cli/src/ledger-writer.ts cli/tests/
git commit -m "feat: add config reader and ledger I/O"
```

---

### Task 5: CLI Entry Point + init/lint/check/status

**Files:**
- Create: `cli/src/index.ts`, `cli/src/commands/init.ts`, `cli/src/commands/lint.ts`, `cli/src/commands/check.ts`, `cli/src/commands/status.ts`

- [ ] **Step 1: Write CLI entry with Commander.js**

```typescript
// cli/src/index.ts
#!/usr/bin/env node
import { Command } from 'commander'
import { initCommand } from './commands/init'
import { lintCommand } from './commands/lint'
import { checkCommand } from './commands/check'
import { statusCommand } from './commands/status'
import { roundCommand } from './commands/round'
import { taskCommand } from './commands/task'

const program = new Command()
program.name('tally').description('Agent-native task management').version('0.1.0')

program.addCommand(initCommand())
program.addCommand(lintCommand())
program.addCommand(checkCommand())
program.addCommand(statusCommand())
program.addCommand(roundCommand())
program.addCommand(taskCommand())
// dashboard, graph, export, migrate, sync, upgrade added in later tasks

program.parse()
```

- [ ] **Step 2: Implement init.ts**

Creates `tally.json` from a template with empty arrays, prompting for project name and stages.

- [ ] **Step 3: Implement lint.ts**

Reads `tally.json`, runs `validateDocument()`, outputs errors to stderr, exits 0/1.

- [ ] **Step 4: Implement check.ts**

Reads `tally.json`, runs semantic checks (reference integrity, cycle detection, stale claims), outputs results.

- [ ] **Step 5: Implement status.ts**

Reads `tally.json`, computes counts, outputs one-line summary or `--json` machine output.

- [ ] **Step 6: Verify end-to-end**

```bash
cd /tmp && mkdir tally-test && cd tally-test
node ~/workspace/tally/cli/dist/index.js init test-project
node ~/workspace/tally/cli/dist/index.js lint
node ~/workspace/tally/cli/dist/index.js check
node ~/workspace/tally/cli/dist/index.js status
```

- [ ] **Step 7: Commit**

```bash
git add cli/src/index.ts cli/src/commands/init.ts cli/src/commands/lint.ts cli/src/commands/check.ts cli/src/commands/status.ts
git commit -m "feat: add CLI entry + init/lint/check/status commands"
```

---

### Task 6: Task CRUD Commands

**Files:**
- Create: `cli/src/commands/task.ts`
- Test: `cli/tests/task.test.ts`

- [ ] **Step 1: Implement task commands**

`tally task add --json '[...]'` — batch create tasks. Auto-generates U-xxx IDs.
`tally task show <id>` — prints full task detail + dependency tree.
`tally task edit <id> --field value` — modify a single field.
`tally task done <id...> --evidence "..." --rule "..."` — batch mark done.
`tally task block <id...> --reason "..."` — batch block.
`tally task unblock <id...>` — batch unblock.
`tally task list --status --module --stage --priority --tag --search --json`

Each command:
1. Reads `tally.json` via `readLedger()`
2. Validates input (task ID exists, field value legal)
3. Mutates the document
4. Updates `_meta.updated`
5. Writes via `writeLedger()`

- [ ] **Step 2: Key logic — task done**

```typescript
// Inside task done handler
for (const id of ids) {
  const task = doc.tasks.find((t) => t.id === id)
  if (!task) throw new Error(`Task ${id} not found`)
  if (task.status === 'done') throw new Error(`Task ${id} is already done`)

  task.status = 'done'
  task.evidence = evidence
  if (rule) task.rule = rule
  task.nextAction = null
  task.completedAt = today()
  task.completedOrder = nextCompletedOrder(doc)
  task.order = null
  // Rewrite U-xxx → D-xxx
  task.id = 'D-' + task.id.slice(2)
}
```

- [ ] **Step 3: Key logic — task add**

```typescript
// Inside task add handler
const entries = JSON.parse(jsonArg) as Partial<Task>[]
for (const entry of entries) {
  const id = nextTaskId(doc) // auto-generate U-xxx
  const task: Task = {
    id,
    status: 'pending',
    priority: entry.priority ?? 'P1',
    stage: entry.stage ?? '',
    module: entry.module ?? '',
    name: entry.name ?? '',
    acceptance: entry.acceptance ?? '',
    deps: entry.deps ?? [],
    blocks: null,
    nextAction: entry.nextAction ?? null,
    evidence: null,
    rule: null,
    tags: entry.tags ?? [],
    order: nextOrder(doc),
    completedOrder: null,
    claimedBy: null,
    claimedAt: null,
    createdAt: today(),
    completedAt: null,
  }
  doc.tasks.push(task)
}
```

- [ ] **Step 4: Write tests**

Test each command with a temporary `tally.json`:
- add creates tasks with sequential U-xxx IDs
- done rewrites U→D, sets evidence, sets completedAt
- block sets blocks field and status
- unblock clears blocks
- list filters correctly by status/module/stage
- edit modifies the specified field only

- [ ] **Step 5: Verify and commit**

```bash
cd ~/workspace/tally/cli && npx vitest run tests/task.test.ts
git add cli/src/commands/task.ts cli/tests/task.test.ts
git commit -m "feat: add task CRUD commands (add/show/edit/done/block/unblock/list)"
```

---

### Task 7: Round Management Commands

**Files:**
- Create: `cli/src/commands/round.ts`
- Test: `cli/tests/round.test.ts`

- [ ] **Step 1: Implement round start**

```
tally round start "scope" [--tasks id1 id2 ...] [--agent id]
```

Logic:
1. Check if this agent already has an active round (unless `allowParallel`)
2. If `--tasks` specified: validate each task exists, deps satisfied, not blocked, not claimed
3. If no `--tasks`: auto-select top N pending tasks by order, skipping those with unmet deps/blocks/claims
4. Atomic: if any task in selection is claimed by another active round, reject all
5. Set `task.claimedBy = roundId`, `task.claimedAt = today()` for each selected task
6. Create round entry, write ledger

- [ ] **Step 2: Implement round report**

Reads `tally.json`. For the latest active round (or `--round <id>`), prints:
- Planned vs actual: which tasks are done / still pending
- Scope, exclusions, duration
- Mid-round: shows progress. Post-close: shows final summary.

- [ ] **Step 3: Implement round close**

```
tally round close [--round <id>]
```

Logic:
1. Find the active round (defaults to latest active for this agent)
2. For each task in `plannedTasks`:
   - If `status === 'done'`: rewrite U→D, keep claimedBy (round completed)
   - If `status !== 'done'`: set `claimedBy = null`, `claimedAt = null`, revert to `pending`
3. Mark `round.status = 'completed'`, `round.completedAt = today()`
4. Append a `ProgressPoint` with current counts
5. Write ledger

- [ ] **Step 4: Write tests**

- round start selects correct tasks, rejects claimed ones
- round start rejects if active round exists (allowParallel=false)
- round close rewrites done tasks U→D, releases unfinished ones
- round close appends correct progress record
- round report shows planned vs actual

- [ ] **Step 5: Verify and commit**

```bash
cd ~/workspace/tally/cli && npx vitest run tests/round.test.ts
git add cli/src/commands/round.ts cli/tests/round.test.ts
git commit -m "feat: add round management commands (start/report/close)"
```

---

### Task 8: Export, Sync, Graph, Upgrade, Migrate

**Files:**
- Create: `cli/src/commands/export.ts`, `sync.ts`, `graph.ts`, `upgrade.ts`, `migrate.ts`

- [ ] **Step 1: export.ts** — `--format json|csv|markdown`. JSON is raw dump. CSV flattens tasks. Markdown generates legacy-compatible ledger format.

- [ ] **Step 2: sync.ts** — `git add tally.json && git commit -m "tally: sync" && git push`. On push failure: pull --rebase, check, retry push. Exit 4 on merge conflict.

- [ ] **Step 3: graph.ts** — `--format json|text|dot --critical-path`. Build adjacency list from task deps, topo sort, compute critical path, output in requested format.

- [ ] **Step 4: upgrade.ts** — Check `_meta.tally_version`. If < current, apply migration functions to transform schema. Each version bump has a documented transform.

- [ ] **Step 5: migrate.ts** — `--source <path> --source <path>`. Uses the unified/remark pipeline (copied from inori-dashboard) to parse Markdown ledgers into `TallyDocument`. Maps Chinese status labels to English enums. Merges multiple sources.

- [ ] **Step 6: Commit**

```bash
git add cli/src/commands/export.ts cli/src/commands/sync.ts cli/src/commands/graph.ts cli/src/commands/upgrade.ts cli/src/commands/migrate.ts
git commit -m "feat: add export/sync/graph/upgrade/migrate commands"
```

---

### Task 9: Dashboard Command (HTTP Server)

**Files:**
- Create: `cli/src/commands/dashboard.ts`

- [ ] **Step 1: Implement dashboard.ts**

`tally dashboard` starts a minimal Node HTTP server:

```typescript
// cli/src/commands/dashboard.ts
import { createServer } from 'http'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { ledgerPath } from '../ledger-reader'
import { loadConfig } from '../config'

export function dashboardCommand(): Command {
  const cmd = new Command('dashboard')
  cmd.description('Start visualization dashboard')
    .option('-p, --port <number>', 'Port', String)
    .action(async (opts) => {
      const config = loadConfig()
      const port = Number(opts.port) || config.dashboard.port
      const tallyJsonPath = ledgerPath()

      const server = createServer((req, res) => {
        // API: serve tally.json
        if (req.url === '/api/tally.json') {
          try {
            const data = readFileSync(tallyJsonPath, 'utf-8')
            res.setHeader('Content-Type', 'application/json')
            res.setHeader('Access-Control-Allow-Origin', '*')
            res.end(data)
          } catch {
            res.statusCode = 404
            res.end(JSON.stringify({ error: 'tally.json not found' }))
          }
          return
        }

        // Static: serve dashboard SPA
        // ... serve files from dashboard/dist/
      })

      server.listen(port, () => {
        console.log(`Tally dashboard: http://localhost:${port}`)
        // Open browser
        const { exec } = await import('child_process')
        exec(`open http://localhost:${port}`)
      })
    })
  return cmd
}
```

- [ ] **Step 2: Verify, commit**

```bash
git add cli/src/commands/dashboard.ts
git commit -m "feat: add dashboard command with HTTP server"
```

---

### Task 10: Dashboard SPA — Scaffold + Data Pipeline

**Files:**
- Create: `dashboard/` — port from `~/workspace/inori-dashboard`, adapted for `tally.json` data source
- Key changes from inori-dashboard:
  - Remove unified/remark, remove Markdown parser
  - `loader.ts`: `fetch('/api/tally.json')` → `LedgerData`
  - `types.ts`: mirror `cli/src/types.ts` for the frontend
  - All Chinese UI, sketch theme preserved
  - NEW: `round-timeline.tsx` — chronological view of all rounds

- [ ] **Step 1: Create dashboard package.json with deps**

```json
{
  "name": "tally-dashboard",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "recharts": "^2.15.0",
    "dagre": "^0.8.5",
    "lucide-react": "^0.460.0",
    "clsx": "^2.1.1",
    "tailwind-merge": "^2.6.0"
  },
  "devDependencies": {
    "@types/react": "^19.0.0",
    "@types/react-dom": "^19.0.0",
    "@types/dagre": "^0.7.52",
    "@tailwindcss/vite": "^4.0.0",
    "@vitejs/plugin-react": "^4.3.4",
    "tailwindcss": "^4.0.0",
    "typescript": "~5.7.0",
    "vite": "^6.0.0"
  }
}
```

- [ ] **Step 2: Port src/lib/types.ts from cli/src/types.ts**

Remove CLI-specific types (LintResult, CheckResult, etc.), keep Task, Round, BlockItem, ProgressPoint, LedgerData.

- [ ] **Step 3: Port src/index.css, src/lib/loader.ts, src/hooks/useLedgerData.ts**

Loader simplified to `fetch('/api/tally.json')`.

- [ ] **Step 4: Port ALL components from inori-dashboard**

Copy all components, adapting imports and data shapes. The only new component is `round-timeline.tsx` showing rounds chronologically.

- [ ] **Step 5: Wire App.tsx, verify build**

```bash
cd ~/workspace/tally/dashboard && npm install && npm run build
```

- [ ] **Step 6: Commit**

```bash
git add dashboard/ && git commit -m "feat: port dashboard SPA for tally.json data source"
```

---

### Task 11: Agent Skill Files

**Files:**
- Create: `skills/claude-code/tally.md`, `skills/copilot-cli/tally.yaml`
- Create: `standard/manifest.yaml`, `standard/templates/tally-schema.md`, `round-log.md`, `report.md`

- [ ] **Step 1: Write Claude Code skill**

```markdown
---
name: tally
description: Agent-native task management — CLI-driven task ledger with round discipline, dependency tracking, and visualization
---

# Tally — Agent Task Management

## When to Use
Use Tally for ALL task management in this project. Never track tasks in chat memory alone.

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
- Set agent ID: `export TALLY_AGENT_ID=<id>` (must exist in _meta.agents)
- Before round start: `git pull`
- If round start fails with claim conflict: re-read tally.json, adjust selection, retry
- After round close: `tally sync`
- If sync fails: `git pull --rebase` → `tally check` → `git push`

### DATA MODEL
See tally.json schema. Status: pending | in_progress | blocked | hold | deferred | done.
```

- [ ] **Step 2: Write Copilot CLI skill (tally.yaml)** — equivalent structure

- [ ] **Step 3: Write standard/manifest.yaml (AODS pattern)**

```yaml
schema_version: 1
kind: agent_plugin_manifest
id: tally
status: active
purpose: Agent-native task management with CLI-driven ledger, round discipline, and visualization.
entrypoints:
  machine: manifest.yaml
  human: README.md
  cli: cli/dist/index.js
```

- [ ] **Step 4: Write template documents** — tally-schema.md, round-log.md, report.md

- [ ] **Step 5: Commit**

```bash
git add skills/ standard/
git commit -m "feat: add agent skill files and standard documentation"
```

---

### Task 12: End-to-End Integration Test

**Files:**
- Create: `cli/tests/e2e.test.ts`

- [ ] **Step 1: Write E2E test — full round lifecycle**

```typescript
// cli/tests/e2e.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'fs'
import { join } from 'path'
import { execSync } from 'child_process'

const CLI = join(__dirname, '..', 'dist', 'index.js')

describe('tally end-to-end', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync('/tmp/tally-e2e-')
    execSync(`node ${CLI} init e2e-test`, { cwd: dir })
  })

  afterEach(() => rmSync(dir, { recursive: true, force: true }))

  it('full round lifecycle: start → task done → close', () => {
    // Add tasks
    execSync(`node ${CLI} task add --json '[{"name":"Task 1","stage":"S1","module":"core","priority":"P0","acceptance":"test passes"}]'`, { cwd: dir })

    // Read back
    const doc = JSON.parse(readFileSync(join(dir, 'tally.json'), 'utf-8'))
    const taskId = doc.tasks[0].id
    expect(taskId).toMatch(/^U-\d+$/)

    // Start round
    execSync(`node ${CLI} round start "test round" --tasks ${taskId}`, { cwd: dir })

    // Mark done
    execSync(`node ${CLI} task done ${taskId} --evidence "all tests passed"`, { cwd: dir })

    // Close round
    execSync(`node ${CLI} round close`, { cwd: dir })

    // Verify
    const final = JSON.parse(readFileSync(join(dir, 'tally.json'), 'utf-8'))
    const doneTask = final.tasks.find((t: { id: string }) => t.id.startsWith('D-'))
    expect(doneTask).toBeTruthy()
    expect(doneTask.evidence).toBe('all tests passed')
    expect(final.rounds[0].status).toBe('completed')
    expect(final.progress.length).toBe(1)
  })

  it('round start rejects claimed tasks from another active round', () => {
    // Add 2 tasks, start round A claiming task 1, then start round B also claiming task 1
    // Should fail
  })

  it('tally lint rejects invalid tally.json', () => {
    // Corrupt tally.json, run lint, expect exit 1
  })
})
```

- [ ] **Step 2: Run E2E tests**

```bash
cd ~/workspace/tally/cli && npm run build && npx vitest run tests/e2e.test.ts
```

- [ ] **Step 3: Commit**

```bash
git add cli/tests/e2e.test.ts && git commit -m "test: add end-to-end round lifecycle tests"
```

---

### Task 13: Final Build, README, Package Validation

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Write README** — installation, quick start, command reference, config

- [ ] **Step 2: Full build**

```bash
cd ~/workspace/tally && npm run build
```

- [ ] **Step 3: Verify package**

```bash
cd ~/workspace/tally/cli && node dist/index.js --version
# Expected: 0.1.0

cd ~/workspace/tally/cli && node dist/index.js --help
# Expected: command list
```

- [ ] **Step 4: Run all tests**

```bash
cd ~/workspace/tally && npm test
```

- [ ] **Step 5: Commit**

```bash
git add README.md && git commit -m "docs: add README with install and usage guide"
```
