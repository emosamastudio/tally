// cli/src/types.ts

// ── Enum types ──

export type TaskStatus = 'pending' | 'in_progress' | 'blocked' | 'hold' | 'deferred' | 'done'
export type Priority = 'P0' | 'P1' | 'P2'
export type RoundStatus = 'active' | 'completed'
export type RiskLevel = 'low' | 'medium' | 'high' | 'critical'
export type ExecutionLane = 'contract' | 'writer' | 'runtime' | 'ui' | 'test' | 'review'
export type FeatureStatus = 'design' | 'contract_frozen' | 'implementing' | 'stable'
export type PlanStatus = 'active' | 'archived' | 'superseded'

// ── Structured sub-types ──

export interface AcceptanceCriteria {
  requiredTests?: string[]
  passConditions?: string[]
  forbiddenSideEffects?: string[]
  negativeCases?: string[]
}

export interface ExecutionPlan {
  inputs?: string[]
  outputs?: string[]
  steps?: string[]
}

export interface StructuredEvidence {
  test?: string
  commit?: string
  review?: string
  artifact?: string
  provider?: string
  notes?: string
}

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
  status: FeatureStatus
  specRefs: string[]
  dependsOn: string[]
  owner: string | null
}

export interface PlanEntry {
  id: string
  path: string
  title: string
  kind: string
  requiredSkill: string | null
  contentHash: string
  status: PlanStatus
  registeredAt: string
  updatedAt: string
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
  plans?: PlanEntry[]
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
  aodsRefs: string[]
  codeRefs: string[]
  implementationTargets: string[]
  feature: string | null
  tags: string[]
  order: number | null
  completedOrder: number | null
  claimedBy: string | null
  claimedAt: string | null
  createdAt: string
  completedAt: string | null
  // ── External implementation plan reference ──
  planRef?: string | null
  planPath?: string | null
  planTaskRef?: string | null
  planContentHash?: string | null
  // ── Scheduling & safety fields ──
  writeScopes: string[]
  acceptanceCriteria: AcceptanceCriteria | null
  executionPlan: ExecutionPlan | null
  riskLevel: RiskLevel
  rollbackPlan: string | null
  executionLane: ExecutionLane | null
  assignedAgent: string | null
  requiresReview: boolean
  resourceRequirements: string[]
  repos: string[]
  deliveryNode: string | null
  approvedBy: string | null
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
  gates: {
    requireFeature: boolean
    requireReview: boolean
    featureFreeze: string[]
    maxRisk: RiskLevel
    detectWriteConflicts: boolean
  }
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

export interface FeatureBreakdown {
  feature: string
  module: string
  name: string
  total: number
  done: number
  blocked: number
  inProgress: number
}

export interface ActiveRoundInfo {
  roundId: string
  executor: string
  scope: string
  taskCount: number
  doneCount: number
}

export interface DeliveryNodeInfo {
  node: string
  total: number
  done: number
  blocked: number
}

export interface StatusResult {
  totalDone: number
  totalOpen: number
  totalHold: number
  totalBlocked: number
  activeRoundId: string | null
  activeBlocks: number
  features: FeatureBreakdown[]
  activeRounds: ActiveRoundInfo[]
  deliveryNodes: DeliveryNodeInfo[]
}

export interface GraphResult {
  nodes: { id: string; name: string; status: string; depth: number; criticalPath: boolean; feature: string | null }[]
  edges: { from: string; to: string }[]
  criticalPathLength: number
  maxDepth: number
  parallelism: { min: number; max: number }
}

// ── Template types ──

export interface TemplateTaskInput {
  name: string
  stage?: string
  module?: string
  feature?: string
  priority?: string
  acceptance?: string
  aodsRefs?: string[]
  codeRefs?: string[]
  implementationTargets?: string[]
  writeScopes?: string[]
  deps?: string[]
  depsRefs?: string[]
  acceptanceCriteria?: AcceptanceCriteria
  executionPlan?: ExecutionPlan
  riskLevel?: string
  executionLane?: string
  requiresReview?: boolean
  rollbackPlan?: string
  resourceRequirements?: string[]
  repos?: string[]
  deliveryNode?: string
}

export interface TemplateFile {
  module: string
  feature?: string
  tasks: TemplateTaskInput[]
  depsRefMap?: Record<string, string>
}
