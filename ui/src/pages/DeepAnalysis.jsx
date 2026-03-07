import { useState, useEffect, useRef } from 'react'
import { Chart as ChartJS, ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement } from 'chart.js'
import { Doughnut, Bar } from 'react-chartjs-2'
import { Loader2, X } from 'lucide-react'
import { fetchDeepAnalytics, fetchToolCalls } from '../lib/api'
import { editorLabel, editorColor, formatNumber, formatDateTime, dateRangeToApiParams } from '../lib/constants'
import { useTheme } from '../lib/theme'
import KpiCard from '../components/KpiCard'
import DateRangePicker from '../components/DateRangePicker'

ChartJS.register(ArcElement, Tooltip, Legend, CategoryScale, LinearScale, BarElement)

const MODEL_COLORS = ['#6366f1', '#a78bfa', '#818cf8', '#c084fc', '#e879f9', '#f472b6', '#fb7185', '#f87171', '#fbbf24', '#34d399']
const MONO = 'JetBrains Mono, monospace'

// Summarize args for display — pick the most useful field
function summarizeArgs(toolName, args) {
  if (!args || typeof args !== 'object') return null
  if (args.CommandLine || args.command) return args.CommandLine || args.command
  if (args.file_path) return args.file_path
  if (args.TargetFile) return args.TargetFile
  if (args.SearchPath || args.search_path) return `${args.Query || args.query || ''} in ${args.SearchPath || args.search_path || ''}`
  if (args.Pattern) return `${args.Pattern} in ${args.SearchDirectory || ''}`
  if (args.Url || args.url) return args.Url || args.url
  if (args.query) return args.query
  const vals = Object.values(args).filter(v => typeof v === 'string' && v.length > 0)
  return vals.length > 0 ? vals[0].substring(0, 120) : null
}

// Detect if args contain a diff (old_string/new_string or similar)
function getDiff(args) {
  if (!args || typeof args !== 'object') return null
  const old = args.old_string || args.old_text || args.oldText || args.search || null
  const nw = args.new_string || args.new_text || args.newText || args.replace || null
  const file = args.file_path || args.TargetFile || args.filePath || args.path || null
  if (old != null || nw != null) return { old, new: nw, file }
  return null
}

function DiffBlock({ diff }) {
  const maxLines = 8
  const oldLines = (diff.old || '').split('\n').slice(0, maxLines)
  const newLines = (diff.new || '').split('\n').slice(0, maxLines)
  return (
    <div className="mt-1 text-[9px] font-mono overflow-x-auto" style={{ border: '1px solid var(--c-border)' }}>
      {diff.file && (
        <div className="px-2 py-0.5" style={{ background: 'var(--c-code-bg)', color: 'var(--c-text2)' }}>{diff.file}</div>
      )}
      {diff.old && oldLines.map((line, i) => (
        <div key={'o' + i} className="px-2" style={{ background: 'rgba(248,113,113,0.07)', color: '#f87171' }}>
          <span style={{ color: 'var(--c-text3)', userSelect: 'none' }}>- </span>{line}
        </div>
      ))}
      {diff.old && oldLines.length < (diff.old || '').split('\n').length && (
        <div className="px-2" style={{ color: 'var(--c-text3)' }}>  ... {(diff.old || '').split('\n').length - maxLines} more lines</div>
      )}
      {diff.new && newLines.map((line, i) => (
        <div key={'n' + i} className="px-2" style={{ background: 'rgba(52,211,153,0.07)', color: '#34d399' }}>
          <span style={{ color: 'var(--c-text3)', userSelect: 'none' }}>+ </span>{line}
        </div>
      ))}
      {diff.new && newLines.length < (diff.new || '').split('\n').length && (
        <div className="px-2" style={{ color: 'var(--c-text3)' }}>  ... {(diff.new || '').split('\n').length - maxLines} more lines</div>
      )}
    </div>
  )
}

function ToolCallRow({ call, toolName, index }) {
  const [expanded, setExpanded] = useState(false)
  const summary = summarizeArgs(toolName, call.args)
  const diff = getDiff(call.args)
  const project = call.folder ? call.folder.split('/').pop() : null
  const hasDetail = diff || (call.args && Object.keys(call.args).length > 0)

  return (
    <div className="px-2 py-1 text-[10px]" style={{ background: index % 2 === 0 ? 'var(--c-code-bg)' : 'transparent' }}>
      <div className="flex items-start gap-2 cursor-pointer" onClick={() => hasDetail && setExpanded(!expanded)}>
        <span className="w-2 h-2 mt-0.5 flex-shrink-0" style={{ background: editorColor(call.source) }} />
        <div className="flex-1 min-w-0">
          {summary && (
            <div className="font-mono truncate" style={{ color: 'var(--c-white)' }} title={summary}>{summary}</div>
          )}
          <div className="flex items-center gap-2" style={{ color: 'var(--c-text3)' }}>
            <span>{editorLabel(call.source)}</span>
            {project && <span>· {project}</span>}
            {call.timestamp && <span>· {new Date(call.timestamp).toLocaleDateString()}</span>}
            {hasDetail && <span>{expanded ? '[-]' : '[+]'}</span>}
          </div>
        </div>
      </div>
      {expanded && diff && <DiffBlock diff={diff} />}
      {expanded && !diff && call.args && Object.keys(call.args).length > 0 && (
        <pre className="mt-1 px-2 py-1 text-[9px] overflow-x-auto whitespace-pre-wrap break-all" style={{ background: 'var(--c-code-bg)', color: 'var(--c-text2)' }}>
          {JSON.stringify(call.args, null, 2)}
        </pre>
      )}
    </div>
  )
}

function ToolDrillDown({ toolName, folder, onClose }) {
  const [calls, setCalls] = useState(null)
  const [loading, setLoading] = useState(true)
  const projectName = folder ? folder.split('/').pop() : null

  useEffect(() => {
    setLoading(true)
    fetchToolCalls(toolName, { folder: folder || undefined }).then(data => { setCalls(data); setLoading(false) })
  }, [toolName, folder])

  return (
    <div className="card p-3 fade-in" style={{ borderColor: 'rgba(99,102,241,0.3)' }}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold" style={{ color: 'var(--c-white)' }}>{toolName}</span>
          <span className="text-[10px]" style={{ color: 'var(--c-text2)' }}>
            {calls ? `${calls.length} calls` : '...'}
            {calls && projectName ? ` for ${projectName}` : ''}
          </span>
        </div>
        <button onClick={onClose} className="p-0.5" style={{ color: 'var(--c-text2)' }}><X size={12} /></button>
      </div>
      {loading ? (
        <div className="text-[10px] py-4 text-center" style={{ color: 'var(--c-text3)' }}>loading...</div>
      ) : calls && calls.length > 0 ? (
        <div className="max-h-[500px] overflow-y-auto scrollbar-thin space-y-0.5">
          {calls.map((c, i) => (
            <ToolCallRow key={i} call={c} toolName={toolName} index={i} />
          ))}
        </div>
      ) : (
        <div className="text-[10px] py-4 text-center" style={{ color: 'var(--c-text3)' }}>no calls found</div>
      )}
    </div>
  )
}

export default function DeepAnalysis({ overview }) {
  const [editor, setEditor] = useState('')
  const [folder, setFolder] = useState('')
  const [dateRange, setDateRange] = useState(null)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [selectedTool, setSelectedTool] = useState(null)
  const chartRef = useRef(null)
  const { dark } = useTheme()
  const txtColor = dark ? '#a0a0a0' : '#444'
  const txtDim = dark ? '#555' : '#999'
  const gridColor = dark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.06)'
  const legendColor = dark ? '#9ca3af' : '#555'

  const editors = overview?.editors || []
  const projects = overview?.topProjects || []

  async function analyze() {
    setLoading(true)
    const result = await fetchDeepAnalytics({ editor, folder: folder || undefined, limit: 500, ...dateRangeToApiParams(dateRange) })
    setData(result)
    setLoading(false)
  }

  useEffect(() => { analyze() }, [editor, folder, dateRange])

  const tools = data?.topTools?.slice(0, 15) || []
  const models = data?.topModels?.slice(0, 10) || []

  function handleToolClick(evt, elements) {
    if (elements.length > 0) {
      const idx = elements[0].index
      const toolName = tools[idx]?.name
      if (toolName) setSelectedTool(toolName)
    }
  }

  return (
    <div className="fade-in space-y-3">
      <div className="flex items-center gap-2">
        <select
          value={editor}
          onChange={e => setEditor(e.target.value)}
          className="px-2 py-1 text-[11px] outline-none"
          style={{ background: 'var(--c-bg3)', color: 'var(--c-text)', border: '1px solid var(--c-border)' }}
        >
          <option value="">All Editors</option>
          {editors.map(e => (
            <option key={e.id} value={e.id}>{editorLabel(e.id)}</option>
          ))}
        </select>
        <select
          value={folder}
          onChange={e => setFolder(e.target.value)}
          className="px-2 py-1 text-[11px] outline-none max-w-[200px] truncate"
          style={{ background: 'var(--c-bg3)', color: 'var(--c-text)', border: '1px solid var(--c-border)' }}
        >
          <option value="">All Projects</option>
          {projects.map(p => (
            <option key={p.fullPath || p.name} value={p.fullPath}>{p.name}</option>
          ))}
        </select>
        {loading && (
          <Loader2 size={11} className="animate-spin" style={{ color: 'var(--c-text3)' }} />
        )}
        {data && <span className="text-[10px]" style={{ color: 'var(--c-text2)' }}>{data.analyzedChats} sessions</span>}
        <div className="ml-auto"><DateRangePicker value={dateRange} onChange={setDateRange} /></div>
      </div>

      {data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2">
            <KpiCard label="sessions" value={data.analyzedChats} />
            <KpiCard label="messages" value={formatNumber(data.totalMessages)} />
            <KpiCard label="tool calls" value={formatNumber(data.totalToolCalls)} />
            <KpiCard label="input tokens" value={formatNumber(data.totalInputTokens)} sub={data.totalCacheRead > 0 ? `${formatNumber(data.totalCacheRead)} cached` : undefined} />
            <KpiCard label="output tokens" value={formatNumber(data.totalOutputTokens)} />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
            <div className="card p-3">
              <h3 className="text-[10px] font-medium uppercase tracking-wider mb-2" style={{ color: 'var(--c-text2)' }}>
                most used tools <span style={{ color: 'var(--c-text3)' }}>(click to drill down)</span>
              </h3>
              <div style={{ height: tools.length * 22 + 20, minHeight: 120 }}>
                {tools.length > 0 ? (
                  <Bar
                    ref={chartRef}
                    data={{
                      labels: tools.map(t => t.name),
                      datasets: [{ data: tools.map(t => t.count), backgroundColor: '#6366f1' }],
                    }}
                    options={{
                      indexAxis: 'y',
                      responsive: true,
                      maintainAspectRatio: false,
                      onClick: handleToolClick,
                      scales: {
                        x: { grid: { color: gridColor }, ticks: { color: txtDim, font: { size: 9, family: MONO } } },
                        y: { grid: { display: false }, ticks: { color: txtColor, font: { size: 9, family: MONO } } },
                      },
                      plugins: { legend: { display: false }, tooltip: { bodyFont: { family: MONO, size: 10 } } },
                    }}
                  />
                ) : (
                  <div className="text-[10px] text-center py-8" style={{ color: 'var(--c-text3)' }}>no tool calls found</div>
                )}
              </div>
            </div>
            <div className="card p-3">
              <h3 className="text-[10px] font-medium uppercase tracking-wider mb-2" style={{ color: 'var(--c-text2)' }}>models</h3>
              <div style={{ height: 240 }}>
                {models.length > 0 ? (
                  <Doughnut
                    data={{
                      labels: models.map(m => m.name),
                      datasets: [{ data: models.map(m => m.count), backgroundColor: MODEL_COLORS, borderWidth: 0 }],
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      cutout: '55%',
                      plugins: {
                        legend: {
                          position: 'right',
                          labels: { color: legendColor, font: { size: 9, family: MONO }, usePointStyle: true, pointStyle: 'circle', padding: 6 },
                        },
                      },
                    }}
                  />
                ) : (
                  <div className="text-[10px] text-center py-8" style={{ color: 'var(--c-text3)' }}>no model data</div>
                )}
              </div>
            </div>
          </div>

          {/* Tool drill-down */}
          {selectedTool && (
            <ToolDrillDown toolName={selectedTool} folder={folder} onClose={() => setSelectedTool(null)} />
          )}

          {/* Token breakdown */}
          {(data.totalInputTokens > 0 || data.totalOutputTokens > 0) && (
            <div className="card p-3">
              <h3 className="text-[10px] font-medium uppercase tracking-wider mb-2" style={{ color: 'var(--c-text2)' }}>tokens</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {[
                  ['Input', data.totalInputTokens],
                  ['Output', data.totalOutputTokens],
                  ['Cache Read', data.totalCacheRead],
                  ['Cache Write', data.totalCacheWrite],
                ].map(([label, val]) => (
                  <div key={label}>
                    <div className="text-[9px]" style={{ color: 'var(--c-text3)' }}>{label}</div>
                    <div className="text-sm font-bold" style={{ color: 'var(--c-white)' }}>{formatNumber(val)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
