// src/components/dependency-graph.tsx
import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import dagre from 'dagre'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Task, TaskStatus } from '@/lib/types'

interface DependencyGraphProps {
  tasks: Task[]
}

const STATUS_COLORS: Record<TaskStatus, { fill: string; stroke: string; text: string }> = {
  completed: { fill: 'rgba(107,200,177,0.18)', stroke: 'var(--accent-3)', text: 'var(--accent-3)' },
  in_progress: { fill: 'rgba(255,210,63,0.18)', stroke: 'var(--accent)', text: 'var(--ink-2)' },
  pending: { fill: 'rgba(255,255,255,0.7)', stroke: 'var(--ink-3)', text: 'var(--ink-2)' },
  blocked: { fill: 'rgba(232,90,79,0.12)', stroke: 'var(--danger)', text: 'var(--danger)' },
  hold: { fill: 'rgba(255,255,255,0.5)', stroke: 'var(--ink-4)', text: 'var(--ink-3)' },
  deferred: { fill: 'rgba(255,255,255,0.5)', stroke: 'var(--ink-4)', text: 'var(--ink-3)' },
}

const STATUS_LABEL: Record<TaskStatus, string> = {
  completed: '已完成',
  in_progress: '进行中',
  pending: '待处理',
  blocked: '阻塞',
  hold: 'Hold',
  deferred: '暂缓',
}

const NODE_WIDTH = 160
const NODE_HEIGHT = 40
const CRITICAL_COLOR = 'var(--accent)'
const MAX_NODES = 300

function truncateName(name: string, maxLen: number): string {
  if (name.length <= maxLen) return name
  return name.slice(0, maxLen - 1) + '…'
}

/** BFS over a directed adjacency map to collect reachable nodes. */
function reachable(startId: string, adj: Map<string, string[]>, available: Set<string>): Set<string> {
  const visited = new Set<string>()
  const queue = [startId]
  while (queue.length > 0) {
    const id = queue.shift()!
    if (visited.has(id)) continue
    visited.add(id)
    for (const next of adj.get(id) ?? []) {
      if (!visited.has(next) && available.has(next)) {
        queue.push(next)
      }
    }
  }
  return visited
}

function calculateCriticalPath(
  nodeIds: Set<string>,
  reverseAdj: Map<string, string[]>,
): { criticalPathIds: Set<string>; depthMap: Map<string, number> } {
  const empty = { criticalPathIds: new Set<string>(), depthMap: new Map<string, number>() }
  if (nodeIds.size === 0) return empty

  const forwardAdj = new Map<string, string[]>()
  for (const id of nodeIds) {
    forwardAdj.set(id, [])
  }
  for (const [id, deps] of reverseAdj) {
    if (!nodeIds.has(id)) continue
    for (const dep of deps) {
      if (!nodeIds.has(dep)) continue
      forwardAdj.get(dep)!.push(id)
    }
  }

  const startNodes: string[] = []
  for (const id of nodeIds) {
    const deps = (reverseAdj.get(id) ?? []).filter((d) => nodeIds.has(d))
    if (deps.length === 0) startNodes.push(id)
  }

  const inDegree = new Map<string, number>()
  for (const id of nodeIds) inDegree.set(id, 0)
  for (const id of nodeIds) {
    for (const next of forwardAdj.get(id) ?? []) {
      inDegree.set(next, (inDegree.get(next) ?? 0) + 1)
    }
  }

  const queue = [...startNodes]
  const topoOrder: string[] = []
  while (queue.length > 0) {
    const id = queue.shift()!
    topoOrder.push(id)
    for (const next of forwardAdj.get(id) ?? []) {
      const deg = inDegree.get(next)! - 1
      inDegree.set(next, deg)
      if (deg === 0) queue.push(next)
    }
  }

  for (const id of nodeIds) {
    if (!topoOrder.includes(id)) {
      topoOrder.push(id)
    }
  }

  const depthMap = new Map<string, number>()
  for (const id of topoOrder) {
    const deps = (reverseAdj.get(id) ?? []).filter((d) => nodeIds.has(d))
    if (deps.length === 0) {
      depthMap.set(id, 1)
    } else {
      let maxPred = 0
      for (const dep of deps) {
        maxPred = Math.max(maxPred, depthMap.get(dep) ?? 0)
      }
      depthMap.set(id, 1 + maxPred)
    }
  }

  let maxDepth = 0
  for (const [, d] of depthMap) {
    if (d > maxDepth) maxDepth = d
  }
  if (maxDepth === 0) return { criticalPathIds: new Set(), depthMap }

  const criticalPathIds = new Set<string>()
  const visited = new Set<string>()
  const stack = [...topoOrder.filter((id) => depthMap.get(id) === maxDepth)]

  while (stack.length > 0) {
    const id = stack.pop()!
    if (visited.has(id)) continue
    visited.add(id)
    criticalPathIds.add(id)

    const curDepth = depthMap.get(id) ?? 0
    const deps = (reverseAdj.get(id) ?? []).filter((d) => nodeIds.has(d))
    for (const dep of deps) {
      if ((depthMap.get(dep) ?? 0) === curDepth - 1) {
        if (!visited.has(dep)) stack.push(dep)
      }
    }
  }

  return { criticalPathIds, depthMap }
}

export default function DependencyGraph({ tasks }: DependencyGraphProps) {
  const [moduleFilter, setModuleFilter] = useState('')
  const [showIsolated, setShowIsolated] = useState(false)

  // Performance: limit graph nodes when task count exceeds threshold
  const isTruncated = tasks.length > MAX_NODES
  const displayTasks = useMemo(() => {
    if (!isTruncated) return tasks
    // Prefer tasks that have dependencies (connected nodes)
    const withDeps = tasks.filter((t) => t.dependencies.length > 0)
    const isolated = tasks.filter((t) => t.dependencies.length === 0)
    const selected = [...withDeps, ...isolated].slice(0, MAX_NODES)
    return selected
  }, [tasks, isTruncated])

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [tooltip, setTooltip] = useState<{ x: number; y: number; task: Task } | null>(null)
  const [isPanning, setIsPanning] = useState(false)
  const panRef = useRef({ startX: 0, startY: 0, startVBX: 0, startVBY: 0 })

  const svgRef = useRef<SVGSVGElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const [viewBox, setViewBox] = useState<{ x: number; y: number; w: number; h: number }>({
    x: 0, y: 0, w: 800, h: 600,
  })
  const [svgSize, setSvgSize] = useState({ w: 800, h: 600 })

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect
      if (rect) setSvgSize({ w: rect.width, h: rect.height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const moduleOptions = useMemo(() => {
    const seen = new Set<string>()
    return tasks
      .filter((t) => { if (seen.has(t.module)) return false; seen.add(t.module); return true })
      .map((t) => ({ id: t.module, name: t.module }))
      .sort((a, b) => a.id.localeCompare(b.id))
  }, [tasks])

  const { forwardAdj, reverseAdj } = useMemo(() => {
    const fwd = new Map<string, string[]>()
    const rev = new Map<string, string[]>()
    for (const t of displayTasks) {
      if (!fwd.has(t.id)) fwd.set(t.id, [])
      rev.set(t.id, t.dependencies.slice())
    }
    for (const t of displayTasks) {
      for (const depId of t.dependencies) {
        const list = fwd.get(depId)
        if (list) list.push(t.id)
      }
    }
    return { forwardAdj: fwd, reverseAdj: rev }
  }, [displayTasks])

  const visibleTaskIds = useMemo(() => {
    if (!moduleFilter) {
      return new Set(displayTasks.map((t) => t.id))
    }
    const ids = new Set<string>()
    for (const t of displayTasks) {
      if (t.module === moduleFilter) {
        ids.add(t.id)
        for (const depId of t.dependencies) {
          ids.add(depId)
        }
      }
    }
    return ids
  }, [displayTasks, moduleFilter])

  const visibleTasks = useMemo(
    () => displayTasks.filter((t) => visibleTaskIds.has(t.id)),
    [displayTasks, visibleTaskIds],
  )

  const layoutResult = useMemo(() => {
    const graph = new dagre.graphlib.Graph()
    graph.setGraph({
      rankdir: 'TB',
      nodesep: 80,
      ranksep: 60,
      edgesep: 20,
      marginx: 30,
      marginy: 30,
    })
    graph.setDefaultEdgeLabel(() => ({}))

    const tasksWithEdges = new Set<string>()
    if (!showIsolated && !moduleFilter) {
      for (const t of visibleTasks) {
        if (t.dependencies.length > 0) tasksWithEdges.add(t.id)
        for (const depId of t.dependencies) {
          if (visibleTaskIds.has(depId)) {
            tasksWithEdges.add(t.id)
            tasksWithEdges.add(depId)
          }
        }
      }
    } else {
      for (const t of visibleTasks) tasksWithEdges.add(t.id)
    }

    const layoutNodes = new Map<string, { id: string; width: number; height: number; task: Task }>()
    for (const t of visibleTasks) {
      if (!tasksWithEdges.has(t.id)) continue
      graph.setNode(t.id, { width: NODE_WIDTH, height: NODE_HEIGHT })
      layoutNodes.set(t.id, { id: t.id, width: NODE_WIDTH, height: NODE_HEIGHT, task: t })
    }

    const layoutEdges: { id: string; source: string; target: string }[] = []
    for (const t of visibleTasks) {
      if (!tasksWithEdges.has(t.id)) continue
      for (const depId of t.dependencies) {
        if (tasksWithEdges.has(depId)) {
          graph.setEdge(depId, t.id)
          layoutEdges.push({ id: `${depId}->${t.id}`, source: depId, target: t.id })
        }
      }
    }

    dagre.layout(graph)

    const positionedNodes = new Map<string, { id: string; x: number; y: number; width: number; height: number; task: Task }>()
    for (const [id, info] of layoutNodes) {
      const pos = graph.node(id)
      if (pos) {
        positionedNodes.set(id, {
          id: info.id,
          x: pos.x,
          y: pos.y,
          width: pos.width ?? NODE_WIDTH,
          height: pos.height ?? NODE_HEIGHT,
          task: info.task,
        })
      }
    }

    const positionedEdges: { id: string; source: string; target: string; points: { x: number; y: number }[] }[] = []
    for (const e of layoutEdges) {
      const edgeLabel = graph.edge(e.source, e.target)
      positionedEdges.push({
        id: e.id,
        source: e.source,
        target: e.target,
        points: (edgeLabel as { points?: { x: number; y: number }[] } | undefined)?.points ?? [],
      })
    }

    return { nodes: positionedNodes, edges: positionedEdges }
  }, [visibleTasks, visibleTaskIds, showIsolated, moduleFilter])

  const criticalPathResult = useMemo(() => {
    const nodeIds = new Set(layoutResult.nodes.keys())
    return calculateCriticalPath(nodeIds, reverseAdj)
  }, [layoutResult.nodes, reverseAdj])

  const { criticalPathIds, depthMap } = criticalPathResult

  const criticalStats = useMemo(() => {
    const cpLen = criticalPathIds.size
    let maxDepth = 0
    const depthCounts = new Map<number, number>()

    for (const [, d] of depthMap) {
      if (d > maxDepth) maxDepth = d
      depthCounts.set(d, (depthCounts.get(d) ?? 0) + 1)
    }

    let parallelMin = 0
    let parallelMax = 0
    if (depthCounts.size > 0) {
      const counts = [...depthCounts.values()]
      parallelMin = Math.min(...counts)
      parallelMax = Math.max(...counts)
    }

    return { criticalPathLen: cpLen, maxDepth, parallelMin, parallelMax }
  }, [criticalPathIds.size, depthMap])

  const depthRows = useMemo(() => {
    const nodesArr = [...layoutResult.nodes.values()]
    if (nodesArr.length === 0 || depthMap.size === 0) return []

    const byY = new Map<number, string[]>()
    for (const n of nodesArr) {
      const roundedY = Math.round(n.y)
      const existing = byY.get(roundedY)
      if (existing) existing.push(n.id)
      else byY.set(roundedY, [n.id])
    }

    const yValues = [...byY.keys()].sort((a, b) => a - b)

    return yValues.map((y) => {
      const idsAtY = byY.get(y)!
      let maxD = 0
      for (const id of idsAtY) {
        maxD = Math.max(maxD, depthMap.get(id) ?? 0)
      }
      return { y, maxDepth: maxD, count: idsAtY.length }
    })
  }, [layoutResult.nodes, depthMap])

  const highlightedIds = useMemo(() => {
    if (!selectedNodeId) return new Set<string>()
    const available = new Set(layoutResult.nodes.keys())
    const up = reachable(selectedNodeId, reverseAdj, available)
    const down = reachable(selectedNodeId, forwardAdj, available)
    return new Set([...up, ...down])
  }, [selectedNodeId, layoutResult.nodes, forwardAdj, reverseAdj])

  const graphBounds = useMemo(() => {
    const nodesArr = [...layoutResult.nodes.values()]
    if (nodesArr.length === 0) return null
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (const n of nodesArr) {
      minX = Math.min(minX, n.x - n.width / 2)
      minY = Math.min(minY, n.y - n.height / 2)
      maxX = Math.max(maxX, n.x + n.width / 2)
      maxY = Math.max(maxY, n.y + n.height / 2)
    }
    return { minX, minY, maxX, maxY }
  }, [layoutResult.nodes])

  useEffect(() => {
    if (!graphBounds || svgSize.w === 0) return
    const pad = 40
    const leftPad = pad + (depthRows.length > 0 ? 36 : 0)
    const vbW = graphBounds.maxX - graphBounds.minX + leftPad + pad
    const vbH = graphBounds.maxY - graphBounds.minY + pad * 2
    setViewBox({
      x: graphBounds.minX - leftPad,
      y: graphBounds.minY - pad,
      w: vbW,
      h: vbH,
    })
  }, [graphBounds, svgSize.w, svgSize.h, depthRows.length])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.target === svgRef.current || (e.target as SVGElement).tagName === 'svg') {
      setIsPanning(true)
      panRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        startVBX: viewBox.x,
        startVBY: viewBox.y,
      }
    }
  }, [viewBox.x, viewBox.y])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning) {
      const dx = (e.clientX - panRef.current.startX) / svgSize.w * viewBox.w
      const dy = (e.clientY - panRef.current.startY) / svgSize.h * viewBox.h
      setViewBox((vb) => ({
        ...vb,
        x: panRef.current.startVBX - dx,
        y: panRef.current.startVBY - dy,
      }))
    }
  }, [isPanning, svgSize, viewBox.w, viewBox.h])

  const handleMouseUp = useCallback(() => {
    setIsPanning(false)
  }, [])

  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (e.ctrlKey) {
      e.preventDefault()
      // Pinch-to-zoom (trackpad) or Ctrl+scroll (mouse)
      const svg = svgRef.current
      if (!svg) return
      const rect = svg.getBoundingClientRect()
      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top
      const vbMouseX = viewBox.x + (mouseX / svgSize.w) * viewBox.w
      const vbMouseY = viewBox.y + (mouseY / svgSize.h) * viewBox.h

      const zoomFactor = e.deltaY > 0 ? 1.15 : 0.87
      const newW = viewBox.w * zoomFactor
      const newH = viewBox.h * zoomFactor

      const clampedW = Math.max(50, Math.min(10000, newW))
      const clampedH = Math.max(50, Math.min(10000, newH))

      setViewBox({
        w: clampedW,
        h: clampedH,
        x: vbMouseX - (mouseX / svgSize.w) * clampedW,
        y: vbMouseY - (mouseY / svgSize.h) * clampedH,
      })
    }
    // Regular scroll (no ctrlKey) — let it pass through to browser for natural page scroll
  }, [viewBox, svgSize])

  useEffect(() => {
    const up = () => setIsPanning(false)
    window.addEventListener('mouseup', up)
    return () => window.removeEventListener('mouseup', up)
  }, [])

  const handleNodeClick = useCallback((nodeId: string) => {
    setSelectedNodeId((prev) => (prev === nodeId ? null : nodeId))
  }, [])

  const handleNodeMouseEnter = useCallback((e: React.MouseEvent, task: Task) => {
    setTooltip({ x: e.clientX, y: e.clientY, task })
  }, [])

  const handleNodeMouseLeave = useCallback(() => {
    setTooltip(null)
  }, [])

  if (displayTasks.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle>依赖关系图</CardTitle></CardHeader>
        <CardContent>
          <p className="sk-body" style={{ fontSize: 13, color: 'var(--ink-3)', textAlign: 'center', padding: '32px 0' }}>
            无依赖数据
          </p>
        </CardContent>
      </Card>
    )
  }

  const hasDependencies = displayTasks.some((t) => t.dependencies.length > 0)
  if (!hasDependencies) {
    return (
      <Card>
        <CardHeader><CardTitle>依赖关系图</CardTitle></CardHeader>
        <CardContent>
          <p className="sk-body" style={{ fontSize: 13, color: 'var(--ink-3)', textAlign: 'center', padding: '32px 0' }}>
            无依赖数据
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>依赖关系图</CardTitle>
          <span className="sk-mono" style={{ fontSize: 11, color: 'var(--ink-3)' }}>
            {layoutResult.nodes.size} 节点 / {layoutResult.edges.length} 边
          </span>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Truncation warning */}
        {isTruncated && (
          <div className="sk-box" style={{ padding: '8px 12px', borderColor: 'var(--accent)', borderStyle: 'dashed' }}>
            <span className="sk-body" style={{ fontSize: 12, color: 'var(--accent)' }}>
              任务过多（{tasks.length} 个），依赖图已限制显示前 {MAX_NODES} 个
            </span>
          </div>
        )}

        {/* Stats bar */}
        {layoutResult.nodes.size > 0 && (
          <div className="sk-box fill" style={{ padding: '8px 12px', display: 'flex', flexWrap: 'wrap', gap: '12px 24px' }}>
            <span className="sk-body" style={{ fontSize: 12 }}>
              关键路径长度:{' '}
              <span style={{ color: 'var(--accent)', fontWeight: 700 }} className="sk-num-sm" >
                {criticalStats.criticalPathLen} 个任务
              </span>
            </span>
            <span className="sk-body" style={{ fontSize: 12 }}>
              总层级:{' '}
              <span style={{ fontWeight: 700 }}>{criticalStats.maxDepth} 层</span>
            </span>
            <span className="sk-body" style={{ fontSize: 12 }}>
              并行度:{' '}
              <span style={{ fontWeight: 700 }}>{criticalStats.parallelMin}-{criticalStats.parallelMax}</span>
            </span>
          </div>
        )}

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={moduleFilter}
            onChange={(e) => { setModuleFilter(e.target.value); setSelectedNodeId(null) }}
            className="sk-select"
          >
            <option value="">全部模块</option>
            {moduleOptions.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
          <label className="flex items-center gap-1.5 sk-body" style={{ fontSize: 12, cursor: 'pointer', userSelect: 'none' }}>
            <input
              type="checkbox"
              checked={showIsolated}
              onChange={(e) => setShowIsolated(e.target.checked)}
              className="rounded"
              style={{ accentColor: 'var(--ink)' }}
            />
            显示孤立节点
          </label>
          {selectedNodeId && (
            <button
              onClick={() => setSelectedNodeId(null)}
              className="sk-chip"
              style={{ fontSize: 11 }}
            >
              清除选择
            </button>
          )}
        </div>

        {/* Graph container */}
        <div
          ref={containerRef}
          className="sk-box fill"
          style={{
            padding: 0,
            height: Math.min(700, Math.max(300, layoutResult.nodes.size * 1.8)),
            overflow: 'hidden',
            position: 'relative',
          }}
        >
          <svg
            ref={svgRef}
            viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
            className={`w-full h-full ${isPanning ? 'cursor-grabbing' : 'cursor-grab'}`}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onWheel={handleWheel}
            preserveAspectRatio="xMidYMid meet"
          >
            <defs>
              <marker
                id="arrowhead"
                markerWidth="8"
                markerHeight="6"
                refX="8"
                refY="3"
                orient="auto"
                markerUnits="userSpaceOnUse"
              >
                <polygon points="0 0, 8 3, 0 6" fill="var(--ink-3)" />
              </marker>

              <filter id="critical-glow" x="-30%" y="-30%" width="160%" height="160%">
                <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
                <feColorMatrix
                  in="blur"
                  type="matrix"
                  values="1 0 0 0 0.82  0.82 0 0 0 0.25  0 0 0 0 0  0 0 0 0.35 0"
                  result="colored"
                />
                <feMerge>
                  <feMergeNode in="colored" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Depth background bands */}
            {graphBounds && depthRows.length > 1 && (() => {
              const bands: { y: number; height: number; alternate: boolean }[] = []
              for (let i = 0; i < depthRows.length; i += 2) {
                const topY = depthRows[i].y - NODE_HEIGHT / 2 - 8
                const botRow = depthRows[i + 1] ?? depthRows[i]
                const botY = botRow.y + NODE_HEIGHT / 2 + 8
                bands.push({
                  y: topY,
                  height: botY - topY,
                  alternate: (i / 2) % 2 === 1,
                })
              }
              const bandLeft = graphBounds.minX - 10
              const bandWidth = graphBounds.maxX - graphBounds.minX + 20
              return bands.map((band, idx) =>
                band.alternate ? (
                  <rect
                    key={`band-${idx}`}
                    x={bandLeft}
                    y={band.y}
                    width={bandWidth}
                    height={band.height}
                    fill="rgba(0,0,0,0.03)"
                    rx={6}
                    ry={6}
                  />
                ) : null,
              )
            })()}

            {/* Depth labels */}
            {graphBounds && depthRows.map((row) => (
              <text
                key={`depth-${row.y}`}
                x={graphBounds.minX - 14}
                y={row.y}
                fill="var(--ink-4)"
                fontSize={9}
                fontFamily="Kalam, cursive"
                textAnchor="end"
                dominantBaseline="central"
              >
                第{row.maxDepth}层
              </text>
            ))}

            {/* Edges */}
            {layoutResult.edges.map((edge) => {
              const isHighlighted = selectedNodeId
                ? highlightedIds.has(edge.source) && highlightedIds.has(edge.target)
                : true
              const isCritical = criticalPathIds.has(edge.source) && criticalPathIds.has(edge.target)
                && (depthMap.get(edge.target) ?? 0) === (depthMap.get(edge.source) ?? 0) + 1
              const pointsStr = edge.points.map((p) => `${p.x},${p.y}`).join(' ')
              return (
                <polyline
                  key={edge.id}
                  points={pointsStr}
                  fill="none"
                  stroke={isCritical ? CRITICAL_COLOR : 'var(--ink-3)'}
                  strokeWidth={isCritical ? 2.2 : 1.5}
                  markerEnd="url(#arrowhead)"
                  opacity={isHighlighted ? 1 : 0.18}
                  style={{ transition: 'opacity 0.15s' }}
                />
              )
            })}

            {/* Nodes */}
            {[...layoutResult.nodes.values()].map((node) => {
              const colors = STATUS_COLORS[node.task.status]
              const isHighlighted = selectedNodeId ? highlightedIds.has(node.id) : true
              const isCritical = criticalPathIds.has(node.id)
              const isSelected = selectedNodeId === node.id
              const left = node.x - node.width / 2
              const top = node.y - node.height / 2

              return (
                <g
                  key={node.id}
                  onClick={() => handleNodeClick(node.id)}
                  onMouseEnter={(e) => handleNodeMouseEnter(e, node.task)}
                  onMouseLeave={handleNodeMouseLeave}
                  style={{ cursor: 'pointer', transition: 'opacity 0.15s' }}
                  opacity={isHighlighted ? 1 : 0.12}
                >
                  {/* Status-colored node body */}
                  <rect
                    x={left}
                    y={top}
                    width={node.width}
                    height={node.height}
                    rx={6}
                    ry={6}
                    fill={colors.fill}
                    stroke={isCritical ? CRITICAL_COLOR : colors.stroke}
                    strokeWidth={isCritical ? 2.2 : 1.6}
                    strokeDasharray={isCritical ? 'none' : 'none'}
                  />
                  {/* Critical path double-border indicator */}
                  {isCritical && (
                    <rect
                      x={left - 2}
                      y={top - 2}
                      width={node.width + 4}
                      height={node.height + 4}
                      rx={8}
                      ry={8}
                      fill="none"
                      stroke={CRITICAL_COLOR}
                      strokeWidth={1.4}
                      opacity={0.5}
                    />
                  )}
                  <text
                    x={left + 8}
                    y={top + 17}
                    fill={colors.text}
                    fontSize={9}
                    fontFamily="JetBrains Mono, ui-monospace, monospace"
                    fontWeight={isCritical ? 700 : 400}
                  >
                    {node.task.id}
                  </text>
                  <text
                    x={left + 8}
                    y={top + 31}
                    fill={isCritical ? 'var(--ink)' : colors.text}
                    fontSize={11}
                    fontFamily="Kalam, cursive"
                  >
                    {truncateName(node.task.name, 16)}
                  </text>
                </g>
              )
            })}
          </svg>
        </div>

        {/* Tooltip */}
        {tooltip && (
          <div
            className="fixed z-50 pointer-events-none"
            style={{
              left: tooltip.x + 12,
              top: tooltip.y - 8,
              background: 'rgba(255,255,255,0.97)',
              border: '2px solid var(--ink)',
              borderRadius: 'var(--sk-radius)',
              padding: '8px 12px',
              maxWidth: '280px',
              boxShadow: '2px 2px 0 rgba(0,0,0,0.08)',
            }}
          >
            <p className="sk-mono" style={{ fontSize: 10, color: 'var(--ink-3)' }}>{tooltip.task.id}</p>
            <p className="sk-body" style={{ fontSize: 13, marginTop: 2 }}>{tooltip.task.name}</p>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="sk-mono" style={{ fontSize: 10, color: 'var(--ink-3)' }}>{tooltip.task.stage}</span>
              <span className={`sk-chip ${tooltip.task.status === 'completed' ? 'ok' : tooltip.task.status === 'in_progress' ? 'accent' : tooltip.task.status === 'blocked' ? 'danger' : ''}`} style={{ fontSize: 10 }}>
                {STATUS_LABEL[tooltip.task.status]}
              </span>
              {tooltip.task.dependencies.length > 0 && (
                <span className="sk-body" style={{ fontSize: 10, color: 'var(--ink-3)' }}>
                  依赖: {tooltip.task.dependencies.length}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-3 pt-2" style={{ borderTop: '1.6px dashed rgba(0,0,0,0.25)' }}>
          <span className="sk-label" style={{ fontSize: 10 }}>状态图例:</span>
          {(Object.entries(STATUS_COLORS) as [TaskStatus, typeof STATUS_COLORS['completed']][]).map(([status, colors]) => (
            <span key={status} className="flex items-center gap-1">
              <span
                className="w-3 h-3 rounded-sm"
                style={{
                  backgroundColor: typeof colors.fill === 'string' ? colors.fill : 'transparent',
                  border: `1.6px solid ${colors.stroke}`,
                  display: 'inline-block',
                }}
              />
              <span className="sk-body" style={{ fontSize: 11 }}>{STATUS_LABEL[status]}</span>
            </span>
          ))}
          <span style={{ color: 'var(--ink-4)', margin: '0 2px' }}>|</span>
          <span className="flex items-center gap-1">
            <span
              className="w-3 h-3 rounded-sm inline-block relative"
              style={{ border: `1.6px solid ${STATUS_COLORS.completed.stroke}`, backgroundColor: STATUS_COLORS.completed.fill }}
            >
              <span
                className="absolute inset-0 rounded-sm"
                style={{ border: `1.4px solid ${CRITICAL_COLOR}`, margin: -3, opacity: 0.7 }}
              />
            </span>
            <span className="sk-body" style={{ fontSize: 11 }}>关键路径</span>
          </span>
          {selectedNodeId && (
            <span className="sk-body" style={{ fontSize: 11, color: 'var(--ink-3)', marginLeft: 'auto' }}>
              已选择: {selectedNodeId}（{highlightedIds.size} 个关联节点）
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export function DependencyGraphSkeleton() {
  return (
    <Card>
      <CardHeader><CardTitle>依赖关系图</CardTitle></CardHeader>
      <CardContent>
        <div className="flex gap-2 mb-3">
          <span className="sk-chip">
            <span className="sk-bar dark" style={{ width: 50, height: 5 }} />
          </span>
        </div>
        <div
          className="sk-box fill"
          style={{ padding: 0, height: 400, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <span className="sk-body" style={{ color: 'var(--ink-4)' }}>加载中...</span>
        </div>
      </CardContent>
    </Card>
  )
}
