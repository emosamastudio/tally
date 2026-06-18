import type { EvidenceRepairSummary, Task, TallyDocument } from './types.js'

export interface StructuredEvidenceInput {
  evidence: string
  test?: string
  commit?: string
  review?: string
  provider?: string
  notes?: string
  noForbidden?: boolean
}

export interface EvidenceBackfillOptions {
  append?: boolean
  replace?: boolean
  allowMissingReview?: boolean
}

export interface EvidenceBackfillResult {
  task: Task
  previousEvidence: string | null
  evidence: string
  action: 'filled' | 'appended' | 'replaced'
}

export function buildStructuredEvidence(input: StructuredEvidenceInput): string {
  const parts: string[] = [input.evidence]
  if (input.test) parts.push(`[test: ${input.test}]`)
  if (input.commit) parts.push(`[commit: ${input.commit}]`)
  if (input.review) parts.push(`[review: ${input.review}]`)
  if (input.provider) parts.push(`[provider: ${input.provider}]`)
  if (input.notes) parts.push(`[notes: ${input.notes}]`)
  if (input.noForbidden) parts.push('[no-forbidden: confirmed]')
  return parts.join(' ')
}

export function hasReviewEvidence(evidence: string | null | undefined): boolean {
  return typeof evidence === 'string' && evidence.includes('[review:')
}

export function isMissingEvidence(task: Task): boolean {
  return task.status === 'done' && (task.evidence === null || task.evidence === '')
}

export function summarizeEvidenceRepair(doc: TallyDocument): EvidenceRepairSummary {
  const tasks = Array.isArray(doc.tasks) ? doc.tasks : []
  const missing = tasks.filter(isMissingEvidence)
  const missingReview = tasks.filter((task) => (
    task.status === 'done' && task.requiresReview === true && !hasReviewEvidence(task.evidence)
  ))

  return {
    missingDoneEvidence: missing.length,
    missingReviewEvidence: missingReview.length,
    taskIds: missing.map((task) => task.id),
    reviewTaskIds: missingReview.map((task) => task.id),
    suggestedAction: missing.length > 0
      ? 'tally repair missing-evidence --evidence "Historical completion imported before evidence enforcement" --test "not rerun during repair" --commit <sha-or-ref> --review "missing prior review evidence recorded" --no-forbidden'
      : null,
  }
}

export function backfillTaskEvidence(
  doc: TallyDocument,
  ids: string[],
  evidence: string,
  options: EvidenceBackfillOptions = {},
): EvidenceBackfillResult[] {
  if (options.append && options.replace) {
    throw new Error('--append and --replace are mutually exclusive')
  }

  const results: EvidenceBackfillResult[] = []
  for (const id of ids) {
    const task = doc.tasks.find((t) => t.id === id)
    if (!task) {
      throw new Error(`Task "${id}" not found`)
    }
    if (task.status !== 'done') {
      throw new Error(`Task "${id}" is ${task.status}. Evidence backfill only supports done tasks.`)
    }

    const previousEvidence = task.evidence
    const hasEvidence = previousEvidence !== null && previousEvidence !== ''
    if (hasEvidence && !options.append && !options.replace) {
      throw new Error(`Task "${id}" already has evidence. Use --append or --replace to change it.`)
    }

    const nextEvidence = options.append && hasEvidence
      ? `${previousEvidence} ${evidence}`
      : evidence

    if (task.requiresReview && !hasReviewEvidence(nextEvidence) && !options.allowMissingReview) {
      throw new Error(`Task "${id}" requires review evidence. Pass --review or --allow-missing-review.`)
    }

    task.evidence = nextEvidence
    results.push({
      task,
      previousEvidence,
      evidence: nextEvidence,
      action: hasEvidence ? (options.append ? 'appended' : 'replaced') : 'filled',
    })
  }

  return results
}
