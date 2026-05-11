// src/components/block-list.tsx
import { Card, CardContent } from '@/components/ui/card'
import { AlertTriangle } from 'lucide-react'
import type { BlockItem } from '@/lib/types'

interface BlockListProps {
  blocks: BlockItem[]
}

export default function BlockList({ blocks }: BlockListProps) {
  return (
    <Card dashed style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="flex items-center justify-between" style={{ padding: '10px 16px' }}>
        <div className="flex items-center gap-2">
          <AlertTriangle size={16} style={{ color: 'var(--danger)' }} />
          <h3 className="sk-h3">阻塞 & 风险</h3>
        </div>
        {blocks.length > 0 && (
          <span className="sk-chip danger">{blocks.length} 项活跃</span>
        )}
      </div>

      <CardContent className="p-0">
        {blocks.length === 0 ? (
          <p className="sk-body" style={{ fontSize: 13, color: 'var(--accent-3)', padding: '12px 16px' }}>
            无活跃阻塞项
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3" style={{ padding: '0 16px 14px' }}>
            {blocks.map((b) => (
              <div
                key={b.id}
                style={{
                  borderLeft: '3px solid var(--danger)',
                  padding: '10px 12px',
                  background: 'rgba(232,90,79,0.06)',
                  borderRadius: '0 var(--sk-radius) var(--sk-radius) 0',
                }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="sk-chip danger" style={{ fontSize: 10 }}>{b.id}</span>
                  {b.affects.length > 0 && (
                    <span className="sk-mono" style={{ fontSize: 10, color: 'var(--ink-3)' }}>
                      → {b.affects.join(', ')}
                    </span>
                  )}
                </div>
                <div className="sk-body" style={{ fontSize: 13, lineHeight: 1.4, marginBottom: 4 }}>
                  {b.content}
                </div>
                <div className="sk-body" style={{ fontSize: 11, color: 'var(--ink-3)' }}>
                  {b.strategy}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

export function BlockListSkeleton() {
  return (
    <Card dashed>
      <div className="flex items-center gap-2" style={{ padding: '10px 16px' }}>
        <AlertTriangle size={16} style={{ color: 'var(--danger)' }} />
        <h3 className="sk-h3">阻塞 & 风险</h3>
      </div>
      <div style={{ padding: '0 16px 14px' }}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div style={{ borderLeft: '3px solid var(--danger)', padding: '10px 12px', background: 'rgba(232,90,79,0.06)', borderRadius: '0 var(--sk-radius) var(--sk-radius) 0' }}>
            <span className="sk-bar med dark" style={{ height: 6 }} />
            <div style={{ marginTop: 8 }}>
              <span className="sk-bar long" style={{ height: 7 }} />
            </div>
            <div style={{ marginTop: 4 }}>
              <span className="sk-bar" style={{ width: 120, height: 6 }} />
            </div>
          </div>
        </div>
      </div>
    </Card>
  )
}
