import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Download } from 'lucide-react'
import { fetchChat, BASE } from '../lib/api'
import { editorColor, editorLabel, formatDateTime, formatNumber } from '../lib/constants'
import KpiCard from '../components/KpiCard'
import { MessageBubble } from '../components/MessageRenderer'

export default function ChatDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [chat, setChat] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetchChat(id).then(data => {
      setChat(data)
      setLoading(false)
    })
  }, [id])

  if (loading) return <div className="text-sm py-12 text-center" style={{ color: 'var(--c-text2)' }}>Loading conversation...</div>
  if (!chat) return <div className="text-sm py-12 text-center" style={{ color: 'var(--c-text2)' }}>Chat not found.</div>

  const s = chat.stats

  return (
    <div className="fade-in max-w-4xl mx-auto">
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-sm mb-4 transition"
        style={{ color: 'var(--c-text2)' }}
      >
        <ArrowLeft size={16} /> Back
      </button>

      {/* Header */}
      <div className="card p-5 mb-4">
        <div className="flex items-start justify-between">
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-semibold mb-1" style={{ color: 'var(--c-white)' }}>{chat.name || '(untitled)'}</h2>
            <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--c-text2)' }}>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ background: editorColor(chat.source) }} />
                {editorLabel(chat.source)}
              </span>
              {chat.mode && <span>· {chat.mode}</span>}
              {chat.folder && <span className="font-mono">· {chat.folder}</span>}
            </div>
            <div className="text-xs mt-1" style={{ color: 'var(--c-text3)' }}>
              {formatDateTime(chat.createdAt)}
              {chat.lastUpdatedAt && chat.lastUpdatedAt !== chat.createdAt && ` — ${formatDateTime(chat.lastUpdatedAt)}`}
              <span className="ml-3 font-mono" style={{ color: 'var(--c-text3)' }}>{chat.id}</span>
            </div>
          </div>
          <a
            href={`${BASE}/api/chats/${chat.id}/markdown`}
            download
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition shrink-0"
            style={{ background: 'var(--c-bg3)', color: 'var(--c-text)', border: '1px solid var(--c-border)' }}
            onMouseEnter={e => e.currentTarget.style.background = 'var(--c-bg2)'}
            onMouseLeave={e => e.currentTarget.style.background = 'var(--c-bg3)'}
          >
            <Download size={13} /> Export .md
          </a>
        </div>
      </div>

      {/* Stats */}
      {s && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 mb-4">
          <KpiCard label="Messages" value={s.totalMessages} />
          <KpiCard label="User" value={s.userMessages} />
          <KpiCard label="Assistant" value={s.assistantMessages} />
          <KpiCard label="Tool Calls" value={s.toolCalls.length} />
          {s.totalInputTokens > 0 && <KpiCard label="Input Tokens" value={formatNumber(s.totalInputTokens)} />}
          {s.totalOutputTokens > 0 && <KpiCard label="Output Tokens" value={formatNumber(s.totalOutputTokens)} />}
        </div>
      )}

      {/* Model badges */}
      {s && s.models.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {[...new Set(s.models)].map(m => (
            <span key={m} className="text-xs bg-accent/10 text-accent-light px-2.5 py-1 rounded-full font-mono">{m}</span>
          ))}
        </div>
      )}

      {/* Messages */}
      <div className="space-y-3">
        {chat.messages.length === 0 && (
          <div className="text-center py-12 text-sm" style={{ color: 'var(--c-text2)' }}>
            {chat.encrypted ? '🔒 This conversation is encrypted.' : 'No messages found.'}
          </div>
        )}
        {chat.messages.map((msg, i) => (
          <MessageBubble key={i} msg={msg} toolCallDetails={chat.toolCallDetails} />
        ))}
      </div>
    </div>
  )
}
