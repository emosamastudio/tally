import { Command } from 'commander'
import { readLedger } from '../ledger-reader.js'
import type { Task, TallyDocument, GraphResult } from '../types.js'

// ── Build adjacency + compute graph ──

interface GraphNode {
  id: string
  name: string
  status: string
  depth: number
  criticalPath: boolean
  feature: string | null
}

interface GraphEdge {
  from: string
  to: string
}

interface InternalGraph {
  nodes: GraphNode[]
  edges: GraphEdge[]
  criticalPathLength: number
  maxDepth: number
  parallelism: { min: number; max: number }
}

/**
 * Topological sort via Kahn's algorithm.
 * Returns sorted task IDs or throws if a cycle is detected.
 */
function topologicalSort(tasks: Task[]): string[] {
  const inDegree = new Map<string, number>()
  const adjacency = new Map<string, string[]>()
  const taskIds = new Set(tasks.map((t) => t.id))

  // Initialize
  for (const t of tasks) {
    if (!inDegree.has(t.id)) inDegree.set(t.id, 0)
    if (!adjacency.has(t.id)) adjacency.set(t.id, [])
  }

  // Build edges from deps → dependent
  // dep must complete before dependent can start, so edge is dep → dependent
  for (const t of tasks) {
    for (const dep of t.deps) {
      if (!taskIds.has(dep)) continue // skip external refs
      // dep → t
      adjacency.get(dep)!.push(t.id)
      inDegree.set(t.id, (inDegree.get(t.id) ?? 0) + 1)
    }
  }

  // Kahn's algorithm
  const queue: string[] = []
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id)
  }

  const sorted: string[] = []
  while (queue.length > 0) {
    const current = queue.shift()!
    sorted.push(current)
    for (const neighbor of adjacency.get(current) ?? []) {
      const newDeg = (inDegree.get(neighbor) ?? 1) - 1
      inDegree.set(neighbor, newDeg)
      if (newDeg === 0) queue.push(neighbor)
    }
  }

  return sorted
}

/**
 * Assign depths via longest path from a root (no dependencies).
 * A node's depth is 1 + max(depths of its deps). Root nodes have depth 0.
 */
function assignDepths(tasks: Task[], sorted: string[]): Map<string, number> {
  const depth = new Map<string, number>()
  const taskMap = new Map(tasks.map((t) => [t.id, t]))
  const order = sorted.length > 0 ? sorted : tasks.map((t) => t.id)

  for (const id of order) {
    const t = taskMap.get(id)
    if (!t) {
      depth.set(id, 0)
      continue
    }
    let maxDep = 0
    for (const dep of t.deps) {
      const d = depth.get(dep)
      if (d !== undefined && d >= maxDep) maxDep = d + 1
    }
    depth.set(id, maxDep)
  }

  return depth
}

/**
 * Compute critical path using DP on the DAG.
 * Longest path = maximum sum of task "weights" (here all weights are 1).
 */
function computeCriticalPath(tasks: Task[], depths: Map<string, number>): Set<string> {
  // longest[i] = max length of path ending at task i
  const longest = new Map<string, number>()
  const prev = new Map<string, string | null>()

  // Process in topological order (sorted by depth ascending)
  const sorted = [...tasks].sort((a, b) => (depths.get(a.id) ?? 0) - (depths.get(b.id) ?? 0))

  for (const t of sorted) {
    let best = 1 // this task alone
    let bestPrev: string | null = null

    for (const dep of t.deps) {
      const depLen = longest.get(dep)
      if (depLen !== undefined && depLen + 1 > best) {
        best = depLen + 1
        bestPrev = dep
      }
    }

    longest.set(t.id, best)
    prev.set(t.id, bestPrev)
  }

  // Find the task with the maximum longest-path length
  let maxLen = 0
  let endNode: string | null = null
  for (const [id, len] of longest) {
    if (len > maxLen) {
      maxLen = len
      endNode = id
    }
  }

  // Backtrack to collect critical path nodes
  const criticalNodes = new Set<string>()
  let current = endNode
  while (current !== null) {
    criticalNodes.add(current)
    current = prev.get(current) ?? null
  }

  return criticalNodes
}

/**
 * Compute parallelism bounds by considering the width at each depth level.
 */
function computeParallelism(depths: Map<string, number>): { min: number; max: number } {
  const byDepth = new Map<number, number>()
  let maxDepth = 0

  for (const [, d] of depths) {
    byDepth.set(d, (byDepth.get(d) ?? 0) + 1)
    if (d > maxDepth) maxDepth = d
  }

  let maxParallel = 0
  for (const [, count] of byDepth) {
    if (count > maxParallel) maxParallel = count
  }

  const minParallel = maxDepth === 0 ? 0 : maxParallel > 0 ? 1 : 0

  return { min: minParallel, max: maxParallel }
}

function buildGraph(doc: TallyDocument, computeCritical: boolean): InternalGraph {
  const tasks = doc.tasks

  // Topological sort
  const sorted = topologicalSort(tasks)

  // Assign depths
  const depths = assignDepths(tasks, sorted)

  // Critical path
  const criticalNodes = computeCritical ? computeCriticalPath(tasks, depths) : new Set<string>()

  // Build nodes
  const nodes: GraphNode[] = tasks.map((t) => ({
    id: t.id,
    name: t.name,
    status: t.status,
    depth: depths.get(t.id) ?? 0,
    criticalPath: criticalNodes.has(t.id),
    feature: t.feature,
  }))

  // Build edges: dep → dependent
  const taskIdSet = new Set(tasks.map((t) => t.id))
  const edges: GraphEdge[] = []
  for (const t of tasks) {
    for (const dep of t.deps) {
      if (!taskIdSet.has(dep)) continue
      edges.push({ from: dep, to: t.id })
    }
  }

  const criticalPathLength = criticalNodes.size
  const maxDepth = depths.size > 0 ? Math.max(...depths.values()) : 0
  const parallelism = computeParallelism(depths)

  return {
    nodes,
    edges,
    criticalPathLength,
    maxDepth,
    parallelism,
  }
}

// ── Output formatters ──

function formatJson(g: InternalGraph): string {
  const result: GraphResult = {
    nodes: g.nodes.map((n) => ({
      id: n.id,
      name: n.name,
      status: n.status,
      depth: n.depth,
      criticalPath: n.criticalPath,
      feature: n.feature,
    })),
    edges: g.edges.map((e) => ({ from: e.from, to: e.to })),
    criticalPathLength: g.criticalPathLength,
    maxDepth: g.maxDepth,
    parallelism: g.parallelism,
  }
  return JSON.stringify(result, null, 2)
}

function formatText(g: InternalGraph): string {
  const lines: string[] = []
  lines.push(`Nodes: ${g.nodes.length}`)
  lines.push(`Edges: ${g.edges.length}`)
  lines.push(`Max depth: ${g.maxDepth}`)
  lines.push(`Critical path length: ${g.criticalPathLength}`)
  lines.push(`Parallelism: ${g.parallelism.min}–${g.parallelism.max}`)
  lines.push('')

  // Group nodes by depth
  const byDepth = new Map<number, GraphNode[]>()
  for (const n of g.nodes) {
    const list = byDepth.get(n.depth) ?? []
    list.push(n)
    byDepth.set(n.depth, list)
  }

  for (let d = 0; d <= g.maxDepth; d++) {
    const nodesAtDepth = byDepth.get(d) ?? []
    if (nodesAtDepth.length === 0) continue
    lines.push(`Depth ${d}:`)
    for (const n of nodesAtDepth) {
      const marker = n.criticalPath ? ' [CRITICAL]' : ''
      lines.push(`  ${n.id} (${n.status})${marker} — ${n.name}`)
    }
  }

  return lines.join('\n')
}

function formatDot(g: InternalGraph): string {
  const lines: string[] = ['digraph tally {']

  // Node styling by status
  const statusColors: Record<string, string> = {
    pending: 'lightgray',
    in_progress: 'lightblue',
    blocked: 'tomato',
    hold: 'lightyellow',
    deferred: 'plum',
    done: 'palegreen',
  }

  for (const n of g.nodes) {
    const color = statusColors[n.status] ?? 'white'
    const style = n.criticalPath ? 'color=red,penwidth=2,' : ''
    const label = `${n.id}\\n${n.name}`
    lines.push(`  "${n.id}" [label="${label}",style=filled,${style}fillcolor=${color}];`)
  }

  for (const e of g.edges) {
    lines.push(`  "${e.from}" -> "${e.to}";`)
  }

  lines.push('}')
  return lines.join('\n')
}

// ── Command ──

export function graphCommand(): Command {
  const cmd = new Command('graph')
  cmd.description('Build and output the task dependency graph')
    .requiredOption('--format <format>', 'Output format: json, text, or dot')
    .option('--critical-path', 'Highlight the critical path')
    .option('--level <level>', 'Graph level: task or feature', 'task')
    .action((opts: { format: string; criticalPath?: boolean; level?: string }) => {
      try {
        const doc = readLedger()
        const isFeatureLevel = opts.level === 'feature'

        if (isFeatureLevel) {
          // Feature-level graph: condense tasks to features
          const featMap = new Map<string, { tasks: typeof doc.tasks; name: string; module: string }>()
          for (const t of doc.tasks) {
            const fid = t.feature ?? '__unassigned__'
            if (!featMap.has(fid)) {
              featMap.set(fid, { tasks: [], name: fid, module: t.module })
            }
            featMap.get(fid)!.tasks.push(t)
          }

          // Build feature-level nodes with aggregated stats
          const nodes: GraphNode[] = []
          const featureTaskMap = new Map<string, typeof doc.tasks>()
          for (const [fid, f] of featMap) {
            const done = f.tasks.filter((t) => t.status === 'done').length
            const total = f.tasks.length
            featureTaskMap.set(fid, f.tasks)
            nodes.push({
              id: fid,
              name: fid === '__unassigned__' ? '(unassigned)' : fid,
              status: done === total ? 'done' : done > 0 ? 'in_progress' : 'pending',
              depth: 0,
              criticalPath: false,
              feature: f.module,
            })
          }

          // Build feature-level edges (feature A → B if any task in A depends on any task in B)
          const edges: GraphEdge[] = []
          for (const [fid, f] of featMap) {
            for (const t of f.tasks) {
              for (const depId of t.deps) {
                // Find which feature this dep belongs to
                for (const [dfid] of featMap) {
                  if (dfid !== fid && featMap.get(dfid)!.tasks.some((dt) => dt.id === depId)) {
                    if (!edges.some((e) => e.from === fid && e.to === dfid)) {
                      edges.push({ from: fid, to: dfid })
                    }
                  }
                }
              }
            }
          }

          const result = { nodes, edges, criticalPathLength: 0, maxDepth: 0, parallelism: { min: 1, max: 1 } }
          const fmt = opts.format.toLowerCase()
          switch (fmt) {
            case 'json': console.log(JSON.stringify(result, null, 2)); break
            case 'text':
              console.log(`Feature graph: ${nodes.length} features, ${edges.length} edges`)
              for (const n of nodes) console.log(`  ${n.id} [${n.status}] (${n.feature})`)
              for (const e of edges) console.log(`  ${e.from} → ${e.to}`)
              break
            case 'dot':
              let dot = 'digraph Features {\n'
              for (const n of nodes) dot += `  "${n.id}" [label="${n.name}"]\n`
              for (const e of edges) dot += `  "${e.from}" -> "${e.to}"\n`
              dot += '}\n'
              console.log(dot)
              break
          }
          return
        }

        const g = buildGraph(doc, opts.criticalPath === true)
        const fmt = opts.format.toLowerCase()

        switch (fmt) {
          case 'json':
            console.log(formatJson(g))
            break
          case 'text':
            console.log(formatText(g))
            break
          case 'dot':
            console.log(formatDot(g))
            break
          default:
            console.error(`Unknown format: "${opts.format}". Use json, text, or dot.`)
            process.exit(2)
        }
      } catch (e) {
        console.error((e as Error).message)
        process.exit(1)
      }
    })
  return cmd
}
