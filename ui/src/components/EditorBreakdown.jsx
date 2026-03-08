import EditorDot from './EditorDot'
import { editorColor, editorLabel } from '../lib/constants'

export default function EditorBreakdown({ editors, total }) {
  return (
    <div className="space-y-1.5">
      {editors.map(([src, count]) => {
        const pct = total > 0 ? (count / total * 100) : 0
        return (
          <div key={src} className="flex items-center gap-2">
            <EditorDot source={src} size={8} />
            <span className="text-[10px] w-24" style={{ color: 'var(--c-text)' }}>{editorLabel(src)}</span>
            <div className="flex-1 h-2 relative" style={{ background: 'var(--c-card)' }}>
              <div className="h-full" style={{ width: `${pct}%`, background: editorColor(src), opacity: 0.7 }} />
            </div>
            <span className="text-[10px] w-10 text-right" style={{ color: 'var(--c-text2)' }}>{count}</span>
          </div>
        )
      })}
    </div>
  )
}
