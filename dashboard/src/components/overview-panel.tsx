// src/components/overview-panel.tsx
import HealthHeader from '@/components/health-header'
import AttentionPanel from '@/components/attention-panel'
import type { Task, Round, BlockItem, FeatureMeta } from '@/lib/types'

interface OverviewPanelProps {
  tasks: Task[]
  activeRound: Round | null
  blocks: BlockItem[]
  features: FeatureMeta[]
  sectionId?: string
}

export default function OverviewPanel({ tasks, activeRound, blocks, features, sectionId }: OverviewPanelProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, height: '100%', overflow: 'auto' }}>
      <HealthHeader tasks={tasks} activeRound={activeRound} blocks={blocks} features={features} />
      <AttentionPanel tasks={tasks} blocks={blocks} sectionId={sectionId} />
    </div>
  )
}
