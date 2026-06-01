// cli/src/commands/dashboard.ts
import { Command } from 'commander'
import { createServer } from 'http'
import { readFileSync, existsSync } from 'fs'
import { join, extname } from 'path'
import { homedir } from 'os'
import { ledgerPath, readLedger } from '../ledger-reader.js'
import { loadConfig } from '../config.js'
import type { TallyDocument } from '../types.js'
import { findLedgerPathUp } from '../paths.js'

const MIME: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
}

function serveStatic(res: any, filePath: string): void {
  if (!existsSync(filePath)) {
    res.statusCode = 404
    res.end('Not found')
    return
  }
  const ext = extname(filePath)
  res.setHeader('Content-Type', MIME[ext] ?? 'application/octet-stream')
  res.end(readFileSync(filePath))
}

function computeStatus(doc: TallyDocument) {
  const tasks = doc.tasks
  const done = tasks.filter((t) => t.status === 'done').length
  const hold = tasks.filter((t) => t.status === 'hold').length
  const blocked = tasks.filter((t) => t.status === 'blocked').length
  const open = tasks.filter((t) => !['done', 'hold'].includes(t.status)).length
  const activeRound = doc.rounds.find((r) => r.status === 'active')
  return {
    totalDone: done,
    totalOpen: open,
    totalHold: hold,
    totalBlocked: blocked,
    activeRoundId: activeRound?.id ?? null,
    activeBlocks: doc.blocks.filter((b) => b.resolvedAt === null).length,
  }
}

function resolvePath(path: string): string {
  return path.replace(/^~/, homedir())
}

export function dashboardCommand(): Command {
  const cmd = new Command('dashboard')
  cmd.description('Start visualization dashboard')
    .option('-p, --port <number>', 'Port')
    .option('--no-open', 'Do not open browser')
    .action(async (opts: { port?: string; open: boolean }) => {
      const config = loadConfig()
      const port = Number(opts.port) || config.dashboard.port
      const jsonPath = findLedgerPathUp(process.cwd()) ?? ledgerPath()

      // Look for dashboard dist relative to CLI package
      const distDir = join(import.meta.dirname, '..', '..', '..', 'dashboard', 'dist')

      const server = createServer((req, res) => {
        const url = req.url ?? '/'
        const parsedUrl = new URL(url, 'http://localhost')
        const pathname = parsedUrl.pathname

        // API: list projects
        if (pathname === '/api/projects') {
          // If no projects configured, return the current single project
          if (config.projects.length === 0) {
            try {
              const raw = readFileSync(jsonPath, 'utf-8')
              const doc = JSON.parse(raw) as TallyDocument
              const status = computeStatus(doc)
              res.setHeader('Content-Type', 'application/json')
              res.setHeader('Access-Control-Allow-Origin', '*')
              res.end(JSON.stringify([{ name: doc._meta.project, path: process.cwd(), ...status }]))
            } catch {
              res.setHeader('Content-Type', 'application/json')
              res.setHeader('Access-Control-Allow-Origin', '*')
              res.end(JSON.stringify([]))
            }
            return
          }

          const results: Array<{
            name: string
            path: string
            error?: string
            totalDone?: number
            totalOpen?: number
            totalHold?: number
            totalBlocked?: number
            activeRoundId?: string | null
            activeBlocks?: number
          }> = []
          for (const p of config.projects) {
            const resolvedPath = resolvePath(p.path)
            try {
              const doc = readLedger(resolvedPath)
              const status = computeStatus(doc)
              results.push({ name: p.name, path: resolvedPath, ...status })
            } catch {
              results.push({ name: p.name, path: resolvedPath, error: 'Tally ledger not found' })
            }
          }
          res.setHeader('Content-Type', 'application/json')
          res.setHeader('Access-Control-Allow-Origin', '*')
          res.end(JSON.stringify(results))
          return
        }

        // API: serve the Tally ledger (with optional project query param)
        if (pathname === '/api/ledger') {
          const projectName = parsedUrl.searchParams.get('project')
          if (projectName) {
            const project = config.projects.find((p) => p.name === projectName)
            if (project) {
              const resolvedPath = resolvePath(project.path)
              try {
                const data = readFileSync(ledgerPath(resolvedPath), 'utf-8')
                res.setHeader('Content-Type', 'application/json')
                res.setHeader('Access-Control-Allow-Origin', '*')
                res.end(data)
              } catch {
                res.statusCode = 404
                res.setHeader('Content-Type', 'application/json')
                res.end(JSON.stringify({ error: 'Tally ledger not found' }))
              }
              return
            }
            // Project not in config — fall through to serve current project
          }

          // Serve the current project ledger
          try {
            const raw = readFileSync(jsonPath, 'utf-8')
            const doc = JSON.parse(raw) as TallyDocument
            // If nearly empty, serve demo for richer visualization
            if (doc.tasks.length < 5 && doc.rounds.length === 0) {
              const demoPath = join(import.meta.dirname, '..', '..', '..', 'demo-tally.json')
              if (existsSync(demoPath)) {
                const demoData = readFileSync(demoPath, 'utf-8')
                res.setHeader('Content-Type', 'application/json')
                res.setHeader('Access-Control-Allow-Origin', '*')
                res.end(demoData)
                return
              }
            }
            res.setHeader('Content-Type', 'application/json')
            res.setHeader('Access-Control-Allow-Origin', '*')
            res.end(raw)
          } catch {
            // Fallback: try bundled demo-tally.json
            const demoPath = join(import.meta.dirname, '..', '..', '..', 'demo-tally.json')
            try {
              const data = readFileSync(demoPath, 'utf-8')
              res.setHeader('Content-Type', 'application/json')
              res.setHeader('Access-Control-Allow-Origin', '*')
              res.end(data)
            } catch {
              res.statusCode = 404
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: 'Tally ledger not found' }))
            }
          }
          return
        }

        // Static: serve dashboard SPA
        const filePath = pathname === '/' ? join(distDir, 'index.html') : join(distDir, pathname)
        serveStatic(res, filePath)
      })

      server.on('error', (error: NodeJS.ErrnoException) => {
        if (error.code === 'EADDRINUSE') {
          console.error(`Dashboard port ${port} is already in use.`)
          console.error(`Use "tally dashboard --port <number>" or set dashboard.port in .tally/config.yaml.`)
          process.exit(1)
        }
        throw error
      })

      server.listen(port, () => {
        console.log(`Tally dashboard: http://localhost:${port}`)
        if (opts.open) {
          import('child_process').then(({ exec }) => {
            exec(`open http://localhost:${port}`)
          })
        }
      })
    })
  return cmd
}
