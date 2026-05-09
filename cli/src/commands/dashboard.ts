// cli/src/commands/dashboard.ts
import { Command } from 'commander'
import { createServer } from 'http'
import { readFileSync, existsSync } from 'fs'
import { join, extname } from 'path'
import { ledgerPath } from '../ledger-reader.js'
import { loadConfig } from '../config.js'

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

export function dashboardCommand(): Command {
  const cmd = new Command('dashboard')
  cmd.description('Start visualization dashboard')
    .option('-p, --port <number>', 'Port')
    .option('--no-open', 'Do not open browser')
    .action(async (opts: { port?: string; open: boolean }) => {
      const config = loadConfig()
      const port = Number(opts.port) || config.dashboard.port
      const jsonPath = ledgerPath()

      // Look for dashboard dist relative to CLI package
      const distDir = join(import.meta.dirname, '..', '..', 'dashboard', 'dist')

      const server = createServer((req, res) => {
        const url = req.url ?? '/'

        // API: serve tally.json
        if (url === '/api/tally.json') {
          try {
            const data = readFileSync(jsonPath, 'utf-8')
            res.setHeader('Content-Type', 'application/json')
            res.setHeader('Access-Control-Allow-Origin', '*')
            res.end(data)
          } catch {
            res.statusCode = 404
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'tally.json not found' }))
          }
          return
        }

        // Static: serve dashboard SPA
        const filePath = url === '/' ? join(distDir, 'index.html') : join(distDir, url)
        serveStatic(res, filePath)
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
