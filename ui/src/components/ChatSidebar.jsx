import { useState, useEffect, useRef } from 'react'
import { X, User, Bot, Wrench, Settings, Play, CheckCircle, ChevronRight, ChevronDown, Download, Send, Search } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { fetchChat, BASE } from '../lib/api'
import { editorColor, editorLabel, formatDateTime, formatNumber } from '../lib/constants'

const ROLE_CONFIG = {
  user: { icon: User, label: 'User', borderColor: 'rgba(34,197,94,0.2)', bg: 'rgba(34,197,94,0.05)' },
  assistant: { icon: Bot, label: 'Assistant', borderColor: 'rgba(99,102,241,0.2)', bg: 'rgba(99,102,241,0.05)' },
  system: { icon: Settings, label: 'System', borderColor: 'rgba(107,114,128,0.2)', bg: 'rgba(107,114,128,0.05)' },
  tool: { icon: Wrench, label: 'Tool', borderColor: 'rgba(234,179,8,0.2)', bg: 'rgba(234,179,8,0.05)' },
}

function parseContent(content) {
  const segments = []
  const regex = /\[tool-call: ([^\]]+)\]|\[tool-result: ([^\]]+)\]\s*(.*?)(?=\n\[tool-|$)/gs
  let lastIdx = 0
  let match
  while ((match = regex.exec(content)) !== null) {
    if (match.index > lastIdx) {
      const text = content.slice(lastIdx, match.index).trim()
      if (text) segments.push({ type: 'text', value: text })
    }
    if (match[1]) {
      segments.push({ type: 'tool-call', name: match[1].replace(/\(.*\)$/, '').trim(), args: match[1] })
    } else if (match[2]) {
      segments.push({ type: 'tool-result', name: match[2].trim(), preview: (match[3] || '').trim() })
    }
    lastIdx = match.index + match[0].length
  }
  if (lastIdx < content.length) {
    const text = content.slice(lastIdx).trim()
    if (text) segments.push({ type: 'text', value: text })
  }
  return segments.length > 0 ? segments : [{ type: 'text', value: content }]
}

function summarizeToolArgs(name, args) {
  if (!args || typeof args !== 'object') return ''
  if (args.file_path || args.TargetFile) return args.file_path || args.TargetFile
  if (args.CommandLine || args.command) return args.CommandLine || args.command
  if (args.Query || args.query) return `${args.Query || args.query}${args.SearchPath ? ` in ${args.SearchPath}` : ''}`
  if (args.Url || args.url) return args.Url || args.url
  const vals = Object.values(args).filter(v => typeof v === 'string' && v.length > 0 && v.length < 120)
  return vals.length > 0 ? vals[0] : ''
}

function ToolArgsDiff({ args }) {
  const old = args.old_string || args.old_text || args.oldText || args.search || null
  const nw = args.new_string || args.new_text || args.newText || args.replace || null
  if (old == null && nw == null) return null
  const maxLines = 8
  const oldLines = (old || '').split('\n').slice(0, maxLines)
  const newLines = (nw || '').split('\n').slice(0, maxLines)
  return (
    <div className="mt-1 text-[9px] font-mono overflow-x-auto" style={{ border: '1px solid var(--c-border)' }}>
      {(args.file_path || args.TargetFile) && (
        <div className="px-2 py-0.5" style={{ background: 'var(--c-code-bg)', color: 'var(--c-text)' }}>{args.file_path || args.TargetFile}</div>
      )}
      {old && oldLines.map((line, i) => (
        <div key={'o' + i} className="px-2" style={{ background: 'rgba(248,113,113,0.1)', color: '#f87171' }}>
          <span style={{ color: 'var(--c-text3)', userSelect: 'none' }}>- </span>{line}
        </div>
      ))}
      {old && oldLines.length < (old || '').split('\n').length && (
        <div className="px-2" style={{ color: 'var(--c-text3)' }}>  ... {(old || '').split('\n').length - maxLines} more lines</div>
      )}
      {nw && newLines.map((line, i) => (
        <div key={'n' + i} className="px-2" style={{ background: 'rgba(52,211,153,0.1)', color: '#34d399' }}>
          <span style={{ color: 'var(--c-text3)', userSelect: 'none' }}>+ </span>{line}
        </div>
      ))}
      {nw && newLines.length < (nw || '').split('\n').length && (
        <div className="px-2" style={{ color: 'var(--c-text3)' }}>  ... {(nw || '').split('\n').length - maxLines} more lines</div>
      )}
    </div>
  )
}

function ToolArgsDetail({ args }) {
  if (!args || Object.keys(args).length === 0) return null
  const hasDiff = args.old_string || args.new_string || args.old_text || args.new_text || args.search || args.replace
  if (hasDiff) return <ToolArgsDiff args={args} />
  const file = args.file_path || args.TargetFile || args.filePath || args.path || null
  const cmd = args.CommandLine || args.command || null
  const query = args.Query || args.query || args.search_term || null
  const url = args.Url || args.url || null
  return (
    <div className="mt-1 text-[9px] font-mono overflow-x-auto" style={{ background: 'var(--c-code-bg)', border: '1px solid var(--c-border)' }}>
      {file && <div className="px-2 py-0.5" style={{ color: 'var(--c-text)' }}>file: {file}</div>}
      {cmd && <div className="px-2 py-0.5" style={{ color: 'var(--c-text)' }}>cmd: {cmd}</div>}
      {query && <div className="px-2 py-0.5" style={{ color: 'var(--c-text)' }}>query: {query}</div>}
      {url && <div className="px-2 py-0.5" style={{ color: 'var(--c-text)' }}>url: {url}</div>}
      {!file && !cmd && !query && !url && (
        <pre className="px-2 py-1 whitespace-pre-wrap break-all" style={{ color: 'var(--c-text2)' }}>{JSON.stringify(args, null, 2)}</pre>
      )}
    </div>
  )
}

function ToolCallBlock({ name, args, detail }) {
  const [open, setOpen] = useState(false)
  const hasDetail = detail && Object.keys(detail).length > 0
  return (
    <div className="my-1 px-2 py-1 text-[10px]" style={{ background: 'var(--c-code-bg)', border: '1px solid var(--c-border)' }}>
      <div className="flex items-center gap-1.5 cursor-pointer" onClick={() => hasDetail && setOpen(!open)}>
        {hasDetail
          ? (open ? <ChevronDown size={9} style={{ color: '#a78bfa' }} /> : <ChevronRight size={9} style={{ color: '#a78bfa' }} />)
          : <Play size={9} style={{ color: '#a78bfa' }} />
        }
        <span className="font-bold" style={{ color: 'var(--c-white)' }}>{name}</span>
        {args !== name && !hasDetail && <span className="truncate" style={{ color: 'var(--c-text2)' }}>{args}</span>}
        {hasDetail && <span className="truncate" style={{ color: 'var(--c-text2)' }}>{summarizeToolArgs(name, detail)}</span>}
      </div>
      {open && hasDetail && <ToolArgsDetail args={detail} />}
    </div>
  )
}

function ToolResultBlock({ name, preview }) {
  const [open, setOpen] = useState(false)
  const isNoisy = preview.length > 120 || preview.startsWith('{') || preview.includes('contentId')
  const short = isNoisy ? `${name} completed` : preview.substring(0, 120)
  return (
    <div className="my-1 px-2 py-1 text-[10px]" style={{ background: 'var(--c-code-bg)', border: '1px solid var(--c-border)' }}>
      <div className="flex items-center gap-1.5 cursor-pointer" onClick={() => preview && setOpen(!open)}>
        <CheckCircle size={9} style={{ color: '#34d399' }} />
        <span className="truncate" style={{ color: 'var(--c-text)' }}>{short}</span>
        {isNoisy && preview && <span style={{ color: 'var(--c-text3)' }}>{open ? '[-]' : '[+]'}</span>}
      </div>
      {open && <pre className="mt-1 text-[9px] overflow-x-auto whitespace-pre-wrap break-all" style={{ color: 'var(--c-text2)' }}>{preview}</pre>}
    </div>
  )
}

function MessageContent({ content, toolCallDetails }) {
  const segments = parseContent(content)
  let toolIdx = 0
  return segments.map((seg, i) => {
    if (seg.type === 'tool-call') {
      const detail = toolCallDetails ? toolCallDetails.find(tc => tc.name === seg.name && toolCallDetails.indexOf(tc) >= toolIdx) : null
      if (detail) toolIdx = toolCallDetails.indexOf(detail) + 1
      return <ToolCallBlock key={i} name={seg.name} args={seg.args} detail={detail?.args} />
    }
    if (seg.type === 'tool-result') return <ToolResultBlock key={i} name={seg.name} preview={seg.preview} />
    return <div key={i} className="md-body text-[12px] leading-relaxed"><ReactMarkdown remarkPlugins={[remarkGfm]}>{seg.value}</ReactMarkdown></div>
  })
}

export default function ChatSidebar({ chatId, onClose }) {
  const [chat, setChat] = useState(null)
  const [loading, setLoading] = useState(true)
  const [msgFilter, setMsgFilter] = useState('')
  const scrollRef = useRef(null)

  useEffect(() => {
    if (!chatId) return
    setLoading(true)
    setChat(null)
    fetchChat(chatId).then(data => {
      setChat(data)
      setLoading(false)
    })
  }, [chatId])

  // Scroll to bottom when chat loads
  useEffect(() => {
    if (!loading && chat && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [loading, chat])

  // Reset filter when chat changes
  useEffect(() => {
    setMsgFilter('')
  }, [chatId])

  if (!chatId) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 transition-opacity"
        style={{ background: 'rgba(0,0,0,0.3)' }}
        onClick={onClose}
      />

      {/* Sidebar */}
      <div
        className="fixed top-0 right-0 bottom-0 z-50 flex flex-col shadow-2xl sidebar-slide-in"
        style={{
          width: 'min(580px, 90vw)',
          background: 'var(--c-bg)',
          borderLeft: '1px solid var(--c-border)',
        }}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 shrink-0" style={{ borderBottom: '1px solid var(--c-border)' }}>
          <button onClick={onClose} className="p-1 rounded transition hover:bg-[var(--c-bg3)]" style={{ color: 'var(--c-text2)' }}>
            <X size={14} />
          </button>
          {chat && (
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate" style={{ color: 'var(--c-white)' }}>
                {chat.name || '(untitled)'}
              </div>
              <div className="flex items-center gap-2 text-[10px]" style={{ color: 'var(--c-text2)' }}>
                <span className="inline-flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: editorColor(chat.source) }} />
                  {editorLabel(chat.source)}
                </span>
                {chat.mode && <span>· {chat.mode}</span>}
                <span>{formatDateTime(chat.createdAt)}</span>
              </div>
            </div>
          )}
          {chat && (
            <a
              href={`${BASE}/api/chats/${chat.id}/markdown`}
              download
              className="flex items-center gap-1 px-2 py-1 text-[10px] transition shrink-0"
              style={{ background: 'var(--c-bg3)', color: 'var(--c-text)', border: '1px solid var(--c-border)' }}
            >
              <Download size={11} /> .md
            </a>
          )}
        </div>

        {/* Stats row */}
        {chat?.stats && (
          <div className="flex items-center gap-3 px-4 py-2 text-[10px] shrink-0" style={{ borderBottom: '1px solid var(--c-border)', color: 'var(--c-text2)' }}>
            <span>{chat.stats.totalMessages} msgs</span>
            <span>{chat.stats.toolCalls.length} tools</span>
            {chat.stats.totalInputTokens > 0 && <span>{formatNumber(chat.stats.totalInputTokens)} in</span>}
            {chat.stats.totalOutputTokens > 0 && <span>{formatNumber(chat.stats.totalOutputTokens)} out</span>}
            {chat.stats.models.length > 0 && (
              <span className="ml-auto font-mono truncate" style={{ color: 'var(--c-accent)', opacity: 0.7 }}>
                {[...new Set(chat.stats.models)].join(', ')}
              </span>
            )}
          </div>
        )}

        {/* Search bar */}
        {chat && chat.messages.length > 0 && (
          <div className="shrink-0 px-4 py-2" style={{ borderBottom: '1px solid var(--c-border)' }}>
            <div className="relative">
              <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2" style={{ color: 'var(--c-text3)' }} />
              <input
                type="text"
                placeholder="Filter messages..."
                value={msgFilter}
                onChange={e => setMsgFilter(e.target.value)}
                className="w-full pl-7 pr-3 py-1 text-[11px] outline-none"
                style={{ background: 'var(--c-bg3)', color: 'var(--c-text)', border: '1px solid var(--c-border)' }}
              />
            </div>
          </div>
        )}

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin px-4 py-3 space-y-2">
          {loading && (
            <div className="text-[11px] py-12 text-center" style={{ color: 'var(--c-text3)' }}>Loading conversation...</div>
          )}
          {!loading && chat && chat.messages.length === 0 && (
            <div className="text-[11px] py-12 text-center" style={{ color: 'var(--c-text3)' }}>
              {chat.encrypted ? '🔒 This conversation is encrypted.' : 'No messages found.'}
            </div>
          )}
          {!loading && chat && chat.messages
            .filter(msg => !msgFilter || msg.content.toLowerCase().includes(msgFilter.toLowerCase()))
            .map((msg, i) => {
              const cfg = ROLE_CONFIG[msg.role] || ROLE_CONFIG.system
              const Icon = cfg.icon
              return (
                <div key={i} className="rounded-r px-3 py-2" style={{ borderLeft: `2px solid ${cfg.borderColor}`, background: cfg.bg }}>
                  <div className="flex items-center gap-1.5 text-[10px] mb-1" style={{ color: 'var(--c-text2)' }}>
                    <Icon size={11} />
                    <span className="font-medium">{cfg.label}</span>
                    {msg.model && <span className="font-mono" style={{ color: 'var(--c-accent)', opacity: 0.6 }}>· {msg.model}</span>}
                  </div>
                  <div className="text-[12px]" style={{ color: 'var(--c-text)' }}>
                    <MessageContent content={msg.content} toolCallDetails={chat.toolCallDetails} />
                  </div>
                </div>
              )
            })}
        </div>

        {/* Fake disabled chat input */}
        <div className="shrink-0 px-4 py-3" style={{ borderTop: '1px solid var(--c-border)' }}>
          <div
            className="flex items-center gap-2 px-3 py-2.5 rounded-lg"
            style={{
              background: 'var(--c-bg3)',
              border: '1px solid var(--c-border)',
              opacity: 0.5,
              cursor: 'not-allowed',
            }}
          >
            <span className="flex-1 text-[12px]" style={{ color: 'var(--c-text3)' }}>
              Message is read-only...
            </span>
            <Send size={13} style={{ color: 'var(--c-text3)' }} />
          </div>
        </div>
      </div>
    </>
  )
}
