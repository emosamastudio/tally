// src/lib/types.ts

export type TaskSource = 'os' | 'app'
export type Priority = 'P0' | 'P1' | 'P2'
export type TaskStatus =
  | 'pending'
  | 'in_progress'
  | 'blocked'
  | 'hold'
  | 'deferred'
  | 'completed'

export interface Task {
  id: string
  source: TaskSource
  stage: string
  module: string
  name: string
  priority: Priority
  status: TaskStatus
  acceptanceCriteria: string
  dependencies: string[]
  blocks?: string
  nextAction?: string
  evidence?: string
  followUpRule?: string
  tags: string[]
  claimedBy: string | null
  claimedAt: string | null
  createdAt: string
  completedAt: string | null
  completedOrder?: number
  /** Original row position in source ledger (for default sort) */
  order: number
}

export interface RoundTask {
  taskId: string
  goal: string
  criteria: string
  order: number
}

export interface Round {
  id: string
  source: TaskSource
  startDate: string
  executor: string
  tasks: RoundTask[]
  scope: string
  exclusions: string
  status: 'active' | 'completed'
  completedAt: string | null
}

export interface BlockItem {
  id: string
  source: TaskSource
  affects: string[]
  content: string
  strategy: string
}

export interface ProgressPoint {
  date: string
  totalPct: number
  osPct: number
  appPct: number
  osDone: number
  appDone: number
  evidence: string
  notes: string
}

export interface StageStatus {
  stageId: string
  name: string
  done: number
  open: number
  hold: number
  blocked: number
}

export interface ModuleMeta {
  id: string
  name: string
}

export interface LedgerData {
  os: {
    tasks: Task[]
    rounds: Round[]
    blocks: BlockItem[]
    progressHistory: ProgressPoint[]
    stages: StageStatus[]
  }
  app: {
    tasks: Task[]
    rounds: Round[]
    blocks: BlockItem[]
    progressHistory: ProgressPoint[]
    stages: StageStatus[]
  }
  merged: {
    totalDone: number
    totalOpen: number
    activeRound: Round | null
    activeBlocks: BlockItem[]
    allStages: StageStatus[]
  }
  rounds: Round[]
  modules: ModuleMeta[]
  updated: string | null
}

/** Loading state for the entire dashboard */
export type LoadState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: LedgerData }

export interface ProjectInfo {
  name: string
  path: string
  error?: string
  totalDone?: number
  totalOpen?: number
  activeRoundId?: string | null
}
