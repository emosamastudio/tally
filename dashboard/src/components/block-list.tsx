// src/components/block-list.tsx
import { Card, CardContent } from '@/components/ui/card'
import type { BlockItem } from '@/lib/types'

interface BlockListProps {
  blocks: BlockItem[]
}

export default function BlockList({ blocks }: BlockListProps) {
  return (
    <Card dashed style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div className="flex justify-between items-baseline">
        <h3 className="sk-h3">阻塞 & 风险</h3>
        {blocks.length > 0 && (
          <span className="sk-chip danger">{blocks.length}</span>
        )}
      </div>

      <CardContent className="p-0">
        {blocks.length === 0 ? (
          <p className="sk-body" style={{ fontSize: 13, color: 'var(--accent-3)' }}>无活跃阻塞项</p>
        ) : (
          <ul className="space-y-3">
            {blocks.map((b) => (
              <li
                key={b.id}
                style={{
                  borderLeft: '3px solid var(--danger)',
                  padding: '4px 8px',
                  background: 'rgba(232,90,79,0.08)',
                }}
              >
                <div className="flex justify-between items-center">
                  <span className="sk-chip danger" style={{ fontSize: 10 }}>{b.id}</span>
                  {b.affects.length > 0 && (
                    <span className="sk-body" style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                      影响: {b.affects.join(', ')}
                    </span>
                  )}
                </div>
                <div className="sk-body" style={{ fontSize: 12, marginTop: 4 }}>{b.content}</div>
                <div className="sk-body" style={{ fontSize: 11, color: 'var(--ink-3)', marginTop: 2 }}>{b.strategy}</div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

export function BlockListSkeleton() {
  return (
    <Card dashed>
      <div className="flex justify-between">
        <h3 className="sk-h3">阻塞 & 风险</h3>
      </div>
      <div style={{ marginTop: 8 }}>
        <div style={{ borderLeft: '3px solid var(--danger)', padding: '4px 8px', background: 'rgba(232,90,79,0.08)' }}>
          <span className="sk-bar med dark" style={{ height: 6 }} />
          <div style={{ marginTop: 4 }}>
            <span className="sk-bar" style={{ width: 200, height: 7 }} />
          </div>
        </div>
      </div>
    </Card>
  )
}
