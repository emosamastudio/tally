// src/lib/loader.ts
import type {
  LedgerData,
  Task,
  TaskSource,
  TaskStatus,
  Round,
  RoundTask,
  BlockItem,
  ProgressPoint,
  StageStatus,
  ModuleMeta,
  ProjectInfo,
} from './types'

// ── Tally raw document shapes (subset of what we consume) ──

interface TallyTaskRaw {
  id: string
  status: string
  priority: string
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

interface TallyPlannedTaskRaw {
  taskId: string
  goal: string
  criteria: string
}

interface TallyRoundRaw {
  id: string
  start: string
  executor: string
  scope: string
  exclusions: string
  plannedTasks: TallyPlannedTaskRaw[]
  completedAt: string | null
  status: string
}

interface TallyBlockRaw {
  id: string
  affects: string[]
  content: string
  strategy: string
}

interface TallyProgressRaw {
  date: string
  totalDone: number
  totalOpen: number
  totalHold: number
  totalBlocked: number
  evidence: string
  notes: string
}

interface TallyModuleRaw {
  id: string
  name: string
}

interface TallyMetaRaw {
  project?: string
  modules?: TallyModuleRaw[]
  updated?: string
}

interface TallyDocumentRaw {
  _meta?: TallyMetaRaw
  tasks?: TallyTaskRaw[]
  rounds?: TallyRoundRaw[]
  blocks?: TallyBlockRaw[]
  progress?: TallyProgressRaw[]
}

// ── Helpers ──

function mapStatus(raw: string): TaskStatus {
  const map: Record<string, TaskStatus> = {
    done: 'completed',
    in_progress: 'in_progress',
    pending: 'pending',
    blocked: 'blocked',
    hold: 'hold',
    deferred: 'deferred',
  }
  return map[raw] ?? 'pending'
}

function mapPriority(raw: string): 'P0' | 'P1' | 'P2' {
  if (raw === 'P0' || raw === 'P1' || raw === 'P2') return raw
  return 'P2'
}

function mapRoundStatus(raw: string): 'active' | 'completed' {
  return raw === 'active' ? 'active' : 'completed'
}

function computeStages(tasks: Task[]): StageStatus[] {
  const map = new Map<string, { done: number; open: number; hold: number; blocked: number }>()

  for (const task of tasks) {
    const stage = task.stage
    if (!map.has(stage)) {
      map.set(stage, { done: 0, open: 0, hold: 0, blocked: 0 })
    }
    const s = map.get(stage)!
    if (task.status === 'completed') s.done++
    else if (task.status === 'hold') s.hold++
    else if (task.status === 'blocked') s.blocked++
    else s.open++
  }

  return Array.from(map.entries()).map(([stageId, counts]) => ({
    stageId,
    name: stageId,
    ...counts,
  }))
}

// ── Adapters ──

function adaptTask(raw: TallyTaskRaw, source: TaskSource, order: number): Task {
  return {
    id: raw.id,
    source,
    stage: raw.stage,
    module: raw.module,
    name: raw.name,
    priority: mapPriority(raw.priority),
    status: mapStatus(raw.status),
    acceptanceCriteria: raw.acceptance,
    dependencies: raw.deps ?? [],
    blocks: raw.blocks ?? undefined,
    nextAction: raw.nextAction ?? undefined,
    evidence: raw.evidence ?? undefined,
    followUpRule: raw.rule ?? undefined,
    feature: raw.feature ?? undefined,
    tags: raw.tags ?? [],
    claimedBy: raw.claimedBy,
    claimedAt: raw.claimedAt,
    createdAt: raw.createdAt,
    completedAt: raw.completedAt,
    completedOrder: raw.completedOrder ?? undefined,
    order: raw.order ?? order,
  }
}

function adaptRoundTask(raw: TallyPlannedTaskRaw, order: number): RoundTask {
  return {
    taskId: raw.taskId,
    goal: raw.goal,
    criteria: raw.criteria,
    order,
  }
}

function adaptRound(raw: TallyRoundRaw, source: TaskSource): Round {
  return {
    id: raw.id,
    source,
    startDate: raw.start,
    executor: raw.executor,
    tasks: (raw.plannedTasks ?? []).map((pt, i) => adaptRoundTask(pt, i)),
    scope: raw.scope,
    exclusions: raw.exclusions,
    status: mapRoundStatus(raw.status),
    completedAt: raw.completedAt,
  }
}

function adaptBlock(raw: TallyBlockRaw, source: TaskSource): BlockItem {
  return {
    id: raw.id,
    source,
    affects: raw.affects ?? [],
    content: raw.content,
    strategy: raw.strategy,
  }
}

function adaptProgress(raw: TallyProgressRaw): ProgressPoint {
  const total = raw.totalDone + raw.totalOpen + raw.totalHold + raw.totalBlocked
  const totalPct = total > 0 ? Math.round((raw.totalDone / total) * 100) : 0
  return {
    date: raw.date,
    totalPct,
    osPct: totalPct,
    appPct: 0,
    osDone: raw.totalDone,
    appDone: 0,
    evidence: raw.evidence,
    notes: raw.notes,
  }
}

function adaptModules(meta: TallyMetaRaw | undefined): ModuleMeta[] {
  if (!meta?.modules) return []
  return meta.modules.map((m) => ({ id: m.id, name: m.name }))
}

// ── Main adapter ──

export function adaptTallyDocument(raw: TallyDocumentRaw): LedgerData {
  const tasks: Task[] = (raw.tasks ?? []).map((t, i) => adaptTask(t, 'os', i))
  const rounds: Round[] = (raw.rounds ?? []).map((r) => adaptRound(r, 'os'))
  const blocks: BlockItem[] = (raw.blocks ?? []).map((b) => adaptBlock(b, 'os'))
  const progressHistory: ProgressPoint[] = (raw.progress ?? []).map(adaptProgress)
  const stages: StageStatus[] = computeStages(tasks)
  const modules: ModuleMeta[] = adaptModules(raw._meta)

  const activeRound = rounds.find((r) => r.status === 'active') ?? null
  const activeBlocks = blocks

  const merged = {
    totalDone: tasks.filter((t) => t.status === 'completed').length,
    totalOpen: tasks.filter((t) => t.status !== 'completed' && t.status !== 'hold').length,
    activeRound,
    activeBlocks,
    allStages: stages,
  }

  const emptySource = {
    tasks: [] as Task[],
    rounds: [] as Round[],
    blocks: [] as BlockItem[],
    progressHistory: [] as ProgressPoint[],
    stages: [] as StageStatus[],
  }

  return {
    os: {
      tasks,
      rounds,
      blocks,
      progressHistory,
      stages,
    },
    app: emptySource,
    merged,
    rounds,
    modules,
    projectName: raw._meta?.project ?? 'Tally',
    updated: raw._meta?.updated ?? null,
  }
}

// ── Loader ──

export async function loadLedgerData(projectName?: string): Promise<LedgerData> {
  const url = projectName
    ? `/api/tally.json?project=${encodeURIComponent(projectName)}`
    : '/api/tally.json'
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to load tally.json: ${res.status}`)
  const raw = await res.json()
  return adaptTallyDocument(raw)
}

export async function loadProjects(): Promise<ProjectInfo[]> {
  const res = await fetch('/api/projects')
  if (!res.ok) return []
  return res.json()
}
