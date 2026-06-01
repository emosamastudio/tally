// cli/src/ledger-writer.ts
import { writeFileSync, renameSync, existsSync, readFileSync, unlinkSync, openSync, fsyncSync, closeSync, copyFileSync } from 'fs'
import { basename, dirname, join } from 'path'
import type { TallyDocument } from './types.js'
import { ensureParentDir, resolveLedgerPath } from './paths.js'

const LOCK_TIMEOUT_MS = 30_000 // stale lock threshold
const LOCK_RETRY_MS = 100
const MAX_LOCK_WAIT_MS = 5_000

interface LockInfo {
  pid: number
  command: string
  startedAt: string
}

function lockPath(fullPath: string): string {
  return join(dirname(fullPath), `.${basename(fullPath)}.lock`)
}

function readLock(path: string): LockInfo | null {
  try {
    return JSON.parse(readFileSync(path, 'utf-8'))
  } catch {
    return null
  }
}

function writeLock(path: string, command: string): void {
  const info: LockInfo = {
    pid: process.pid,
    command,
    startedAt: new Date().toISOString(),
  }
  writeFileSync(path, JSON.stringify(info), 'utf-8')
}

function isStale(lock: LockInfo): boolean {
  const age = Date.now() - new Date(lock.startedAt).getTime()
  if (age > LOCK_TIMEOUT_MS) return true
  // Check if the owning process still exists
  try {
    process.kill(lock.pid, 0)
    return false
  } catch {
    return true
  }
}

/** Acquire a file lock, waiting up to MAX_LOCK_WAIT_MS. Throws on timeout. */
export function acquireLock(cwd: string, command: string = 'tally'): void {
  const fullPath = resolveLedgerPath(cwd)
  ensureParentDir(fullPath)
  const lockFile = lockPath(fullPath)
  const started = Date.now()

  while (Date.now() - started < MAX_LOCK_WAIT_MS) {
    if (!existsSync(lockFile)) {
      writeLock(lockFile, command)
      // Double-check we won the race
      const check = readLock(lockFile)
      if (check && check.pid === process.pid) return
    }

    const existing = readLock(lockFile)
    if (existing && isStale(existing)) {
      // Break stale lock
      unlinkSync(lockFile)
      continue
    }

    // Busy: wait and retry
    const busy = new Date()
    while (Date.now() - busy.getTime() < LOCK_RETRY_MS) {
      // spin-wait for LOCK_RETRY_MS
    }
  }

  const holder = readLock(lockFile)
  throw new Error(
    `Tally ledger is locked by another writer (pid ${holder?.pid}, command ${holder?.command}, since ${holder?.startedAt}). ` +
    `Retry after the lock is released or manually remove ${lockFile} if stale.`,
  )
}

/** Release a previously acquired lock. */
export function releaseLock(cwd: string): void {
  const fullPath = resolveLedgerPath(cwd)
  const lockFile = lockPath(fullPath)
  try {
    const existing = readLock(lockFile)
    if (existing && existing.pid === process.pid) {
      unlinkSync(lockFile)
    }
  } catch {
    // Best-effort cleanup
  }
}

export function writeLedger(
  doc: TallyDocument,
  cwd: string = process.cwd(),
): void {
  acquireLock(cwd, 'tally')
  try {
    doc._meta.updated = new Date().toISOString().slice(0, 10)
    const fullPath = resolveLedgerPath(cwd)
    ensureParentDir(fullPath)
    const tmpPath = join(dirname(fullPath), `.${basename(fullPath)}.tmp`)
    const json = JSON.stringify(doc, null, 2) + '\n'

    // Backup: save current ledger before overwriting
    const bakPath = join(dirname(fullPath), `.${basename(fullPath)}.bak`)
    if (existsSync(fullPath)) {
      try { copyFileSync(fullPath, bakPath) } catch { /* best-effort */ }
    }

    // Atomic write: temp file → fsync → rename
    writeFileSync(tmpPath, json, 'utf-8')
    const fd = openSync(tmpPath, 'r+')
    fsyncSync(fd)
    closeSync(fd)
    renameSync(tmpPath, fullPath)
  } finally {
    releaseLock(cwd)
  }
}
