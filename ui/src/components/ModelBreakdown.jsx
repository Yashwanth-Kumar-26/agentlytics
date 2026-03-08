import { Cpu } from 'lucide-react'

export default function ModelBreakdown({ models }) {
  const max = models[0]?.[1] || 1
  return (
    <div className="space-y-1.5">
      {models.map(([name, count]) => {
        const pct = (count / max * 100)
        return (
          <div key={name} className="flex items-center gap-2">
            <Cpu size={10} style={{ color: '#818cf8' }} />
            <span className="text-[10px] truncate w-40" style={{ color: 'var(--c-text)' }}>{name}</span>
            <div className="flex-1 h-2 relative" style={{ background: 'var(--c-card)' }}>
              <div className="h-full" style={{ width: `${pct}%`, background: '#6366f1', opacity: 0.5 }} />
            </div>
            <span className="text-[10px] w-10 text-right" style={{ color: 'var(--c-text2)' }}>{count}</span>
          </div>
        )
      })}
      {models.length === 0 && <div className="text-[10px]" style={{ color: 'var(--c-text3)' }}>No model data</div>}
    </div>
  )
}
