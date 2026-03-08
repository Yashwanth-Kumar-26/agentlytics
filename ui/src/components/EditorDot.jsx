import { editorLabel } from '../lib/constants'
import EditorIcon from './EditorIcon'

export default function EditorDot({ source, showLabel = false, size = 8 }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <EditorIcon source={source} size={size} />
      {showLabel && <span className="text-[11px]" style={{ color: 'var(--c-text)' }}>{editorLabel(source)}</span>}
    </span>
  )
}
