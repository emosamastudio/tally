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

export interface FeatureEntry {
  id: string
  module: string
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
  features: FeatureEntry[]
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
  feature: string | null
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

export interface ProjectEntry {
  name: string
  path: string
}

export interface TallyConfig {
  agent: { id: string }
  round: { maxTasks: number; allowParallel: boolean }
  lint: { strict: boolean }
  dashboard: { port: number }
  projects: ProjectEntry[]
}

// ── CLI results ──

export interface LintResult {
  valid: boolean
  errors: LintError[]
}

export interface LintError {
  path: string
  message: string
}

export interface CheckResult {
  valid: boolean
  errors: CheckError[]
  warnings: CheckError[]
}

export interface CheckError {
  code: string
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
  nodes: { id: string; name: string; status: string; depth: number; criticalPath: boolean; feature: string | null }[]
  edges: { from: string; to: string }[]
  criticalPathLength: number
  maxDepth: number
  parallelism: { min: number; max: number }
}
