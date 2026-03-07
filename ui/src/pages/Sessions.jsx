import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Search, Filter, List, FolderOpen, ChevronDown, ChevronRight, X } from 'lucide-react'
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler } from 'chart.js'
import { Line } from 'react-chartjs-2'
import { fetchChats } from '../lib/api'
import { editorColor, editorLabel, formatDate, dateRangeToApiParams } from '../lib/constants'
import { useTheme } from '../lib/theme'
import EditorDot from '../components/EditorDot'
import DateRangePicker from '../components/DateRangePicker'
import ChatSidebar from '../components/ChatSidebar'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend, Filler)

const MONO = 'JetBrains Mono, monospace'

// Custom Chart.js plugin: drag-to-select range on x-axis
const dragSelectPlugin = {
  id: 'dragSelect',
  beforeEvent(chart, args) {
    const evt = args.event
    const state = chart._dragSelect || (chart._dragSelect = { dragging: false, startX: 0, endX: 0 })
    const area = chart.chartArea
    if (!area) return

    if (evt.type === 'mousedown' && evt.x >= area.left && evt.x <= area.right && evt.y >= area.top && evt.y <= area.bottom) {
      state.dragging = true
      state.startX = evt.x
      state.endX = evt.x
    }
    if (evt.type === 'mousemove' && state.dragging) {
      state.endX = Math.max(area.left, Math.min(evt.x, area.right))
      args.changed = false
      chart.draw()
      return false
    }
    if (evt.type === 'mouseup' && state.dragging) {
      state.dragging = false
      state.endX = Math.max(area.left, Math.min(evt.x, area.right))
      const x1 = Math.min(state.startX, state.endX)
      const x2 = Math.max(state.startX, state.endX)
      if (x2 - x1 > 5) {
        const scale = chart.scales.x
        const startIdx = scale.getValueForPixel(x1)
        const endIdx = scale.getValueForPixel(x2)
        const labels = chart.data.labels
        const startLabel = labels[Math.max(0, Math.round(startIdx))]
        const endLabel = labels[Math.min(labels.length - 1, Math.round(endIdx))]
        if (chart.config.options._onRangeSelect) {
          chart.config.options._onRangeSelect(startLabel, endLabel)
        }
      }
      chart.draw()
    }
  },
  afterDraw(chart) {
    const state = chart._dragSelect
    if (!state) return
    const area = chart.chartArea
    const ctx = chart.ctx
    // Draw persisted selection highlight
    const opts = chart.config.options
    if (opts._selectionRange && chart.data.labels) {
      const scale = chart.scales.x
      const labels = chart.data.labels
      const si = labels.indexOf(opts._selectionRange[0])
      const ei = labels.indexOf(opts._selectionRange[1])
      if (si >= 0 && ei >= 0) {
        const px1 = scale.getPixelForValue(si)
        const px2 = scale.getPixelForValue(ei)
        ctx.save()
        ctx.fillStyle = 'rgba(99,102,241,0.10)'
        ctx.fillRect(Math.min(px1, px2), area.top, Math.abs(px2 - px1), area.bottom - area.top)
        ctx.strokeStyle = 'rgba(99,102,241,0.4)'
        ctx.lineWidth = 1
        ctx.setLineDash([3, 3])
        ctx.strokeRect(Math.min(px1, px2), area.top, Math.abs(px2 - px1), area.bottom - area.top)
        ctx.restore()
      }
    }
    // Draw active drag overlay
    if (state.dragging) {
      const x1 = Math.min(state.startX, state.endX)
      const x2 = Math.max(state.startX, state.endX)
      ctx.save()
      ctx.fillStyle = 'rgba(99,102,241,0.15)'
      ctx.fillRect(x1, area.top, x2 - x1, area.bottom - area.top)
      ctx.restore()
    }
  },
}
ChartJS.register(dragSelectPlugin)

// Custom tooltip positioner: below cursor
Tooltip.positioners.belowCursor = function(elements, eventPosition) {
  return { x: eventPosition.x, y: eventPosition.y + 20 }
}

export default function Sessions({ overview }) {
  const { dark } = useTheme()
  const txtDim = dark ? '#555' : '#999'
  const legendColor = dark ? '#777' : '#555'
  const gridColor = dark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.06)'
  const [chats, setChats] = useState([])
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [searchParams] = useSearchParams()
  const [editor, setEditor] = useState(searchParams.get('editor') || '')
  const [loading, setLoading] = useState(true)
  const [groupByProject, setGroupByProject] = useState(false)
  const [collapsedProjects, setCollapsedProjects] = useState(new Set())
  const [dateRange, setDateRange] = useState(null) // [startWeek, endWeek] — chart drag-select
  const [apiDateRange, setApiDateRange] = useState(null) // { from, to } — server-side date filter
  const [selectedChatId, setSelectedChatId] = useState(null)
  const chartRef = useRef(null)

  const onRangeSelect = useCallback((start, end) => {
    if (start && end) setDateRange([start, end].sort())
  }, [])

  useEffect(() => {
    setLoading(true)
    fetchChats({ editor, limit: 1000, ...dateRangeToApiParams(apiDateRange) }).then(data => {
      setChats(data.chats)
      setTotal(data.total)
      setLoading(false)
    })
  }, [editor, apiDateRange])

  const searchFiltered = search
    ? chats.filter(c =>
        (c.name || '').toLowerCase().includes(search.toLowerCase()) ||
        (c.folder || '').toLowerCase().includes(search.toLowerCase()) ||
        c.id.toLowerCase().includes(search.toLowerCase())
      )
    : chats

  // Apply date range filter
  const filtered = useMemo(() => {
    if (!dateRange) return searchFiltered
    const [start, end] = dateRange
    // Add 6 days to end week to cover full week
    const startMs = new Date(start).getTime()
    const endMs = new Date(end).getTime() + 6 * 86400000
    return searchFiltered.filter(c => {
      const ts = c.lastUpdatedAt || c.createdAt
      return ts && ts >= startMs && ts <= endMs
    })
  }, [searchFiltered, dateRange])

  const editors = overview?.editors || []

  // Timeline chart data: sessions per week by editor (always use full list, not date-filtered)
  const timelineChart = useMemo(() => {
    if (searchFiltered.length === 0) return null
    const weekMap = {}
    for (const c of searchFiltered) {
      const ts = c.lastUpdatedAt || c.createdAt
      if (!ts) continue
      const d = new Date(ts)
      const day = d.getDay()
      const diff = d.getDate() - day + (day === 0 ? -6 : 1)
      const monday = new Date(d)
      monday.setDate(diff)
      const wk = `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`
      if (!weekMap[wk]) weekMap[wk] = {}
      const src = c.source || 'unknown'
      weekMap[wk][src] = (weekMap[wk][src] || 0) + 1
    }
    const weeks = Object.keys(weekMap).sort()
    const editorIds = [...new Set(searchFiltered.map(c => c.source).filter(Boolean))]
    return {
      labels: weeks,
      datasets: editorIds.map(eid => ({
        label: editorLabel(eid),
        data: weeks.map(w => weekMap[w][eid] || 0),
        borderColor: editorColor(eid),
        backgroundColor: editorColor(eid) + '15',
        borderWidth: 1.5,
        tension: 0.3,
        pointRadius: 0,
        pointHoverRadius: 4,
        fill: true,
      })),
    }
  }, [searchFiltered])

  // Group by project
  const grouped = useMemo(() => {
    if (!groupByProject) return null
    const map = {}
    for (const c of filtered) {
      const key = c.folder || '(no project)'
      if (!map[key]) map[key] = []
      map[key].push(c)
    }
    return Object.entries(map)
      .map(([folder, items]) => ({ folder, name: folder === '(no project)' ? '(no project)' : folder.split('/').pop(), items }))
      .sort((a, b) => b.items.length - a.items.length)
  }, [filtered, groupByProject])

  function toggleProject(folder) {
    setCollapsedProjects(prev => {
      const next = new Set(prev)
      if (next.has(folder)) next.delete(folder)
      else next.add(folder)
      return next
    })
  }

  const SessionRow = ({ c }) => (
    <tr
      key={c.id}
      className="cursor-pointer transition"
      style={{ borderBottom: '1px solid var(--c-border)' }}
      onMouseEnter={e => e.currentTarget.style.background = 'var(--c-bg3)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
      onClick={() => setSelectedChatId(c.id)}
    >
      <td className="py-2.5 px-4">
        <EditorDot source={c.source} showLabel size={7} />
      </td>
      <td className="py-2.5 px-4 font-medium truncate max-w-[300px]" style={{ color: 'var(--c-white)' }}>
        {c.name || <span style={{ color: 'var(--c-text3)' }}>(untitled)</span>}
        {c.encrypted && <span className="ml-2 text-[10px] text-yellow-500/60">locked</span>}
      </td>
      {!groupByProject && (
        <td className="py-2.5 px-4 truncate max-w-[200px] text-xs" style={{ color: 'var(--c-text2)' }} title={c.folder}>
          {c.folder ? c.folder.split('/').pop() : ''}
        </td>
      )}
      <td className="py-2.5 px-4">
        <span className="text-xs" style={{ color: 'var(--c-text2)' }}>{c.mode}</span>
      </td>
      <td className="py-2.5 px-4 text-xs truncate max-w-[180px] font-mono" style={{ color: 'var(--c-text2)' }} title={c.topModel || ''}>
        {c.topModel || ''}
      </td>
      <td className="py-2.5 px-4 text-xs whitespace-nowrap" style={{ color: 'var(--c-text2)' }}>
        {formatDate(c.lastUpdatedAt || c.createdAt)}
      </td>
    </tr>
  )

  return (
    <div className="fade-in space-y-4">
      {/* Timeline chart */}
      {timelineChart && timelineChart.labels.length > 1 && (
        <div className="card p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--c-text2)' }}>
              session timeline
              <span className="ml-2 font-normal" style={{ color: 'var(--c-text3)' }}>(drag to select range)</span>
            </h3>
            {dateRange && (
              <button
                onClick={() => setDateRange(null)}
                className="flex items-center gap-1 text-[10px] px-2 py-0.5 transition"
                style={{ color: 'var(--c-accent)', border: '1px solid var(--c-border)' }}
              >
                <X size={10} />
                {dateRange[0]} — {dateRange[1]}
              </button>
            )}
          </div>
          <div style={{ height: 160 }}>
            <Line
              ref={chartRef}
              data={timelineChart}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                events: ['mousemove', 'mouseout', 'click', 'touchstart', 'touchmove', 'mousedown', 'mouseup'],
                _onRangeSelect: onRangeSelect,
                _selectionRange: dateRange,
                scales: {
                  x: { grid: { display: false }, ticks: { color: txtDim, font: { size: 9, family: MONO }, maxTicksLimit: 20, maxRotation: 0 } },
                  y: { beginAtZero: true, grid: { color: gridColor }, ticks: { color: txtDim, stepSize: 1, font: { size: 9, family: MONO } } },
                },
                plugins: {
                  legend: { position: 'top', labels: { color: legendColor, font: { size: 9, family: MONO }, usePointStyle: true, pointStyle: 'circle', padding: 10 } },
                  tooltip: { position: 'belowCursor', bodyFont: { family: MONO, size: 10 }, titleFont: { family: MONO, size: 10 } },
                },
              }}
            />
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3">
          <div className="relative">
            <Filter size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--c-text3)' }} />
            <select
              value={editor}
              onChange={e => setEditor(e.target.value)}
              className="pl-8 pr-3 py-1 text-[11px] outline-none appearance-none cursor-pointer"
              style={{ background: 'var(--c-bg3)', color: 'var(--c-text)', border: '1px solid var(--c-border)' }}
            >
              <option value="">all editors</option>
              {editors.map(e => (
                <option key={e.id} value={e.id}>{editorLabel(e.id)} ({e.count})</option>
              ))}
            </select>
          </div>
          <div className="relative flex-1 max-w-sm">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--c-text3)' }} />
            <input
              type="text"
              placeholder="search sessions..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-1 text-[11px] outline-none"
              style={{ background: 'var(--c-bg3)', color: 'var(--c-text)', border: '1px solid var(--c-border)' }}
            />
          </div>
          <button
            onClick={() => setGroupByProject(!groupByProject)}
            className="flex items-center gap-1.5 px-3 py-1 text-[11px] transition"
            style={{
              border: groupByProject ? '1px solid var(--c-accent)' : '1px solid var(--c-border)',
              color: groupByProject ? 'var(--c-accent)' : 'var(--c-text2)',
              background: groupByProject ? 'rgba(99,102,241,0.1)' : 'transparent',
            }}
          >
            {groupByProject ? <FolderOpen size={13} /> : <List size={13} />}
            {groupByProject ? 'grouped' : 'flat'}
          </button>
          <span className="text-[10px]" style={{ color: 'var(--c-text3)' }}>
            {loading ? 'loading...' : `${filtered.length} of ${total}`}
          </span>
        {/* Server-side date range filter */}
        <div className="ml-auto"><DateRangePicker value={apiDateRange} onChange={setApiDateRange} /></div>
      </div>

      {/* Session table */}
      {!groupByProject ? (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[10px] uppercase tracking-wider" style={{ borderBottom: '1px solid var(--c-border)', color: 'var(--c-text3)' }}>
                <th className="text-left py-2.5 px-4 font-medium">editor</th>
                <th className="text-left py-2.5 px-4 font-medium">name</th>
                <th className="text-left py-2.5 px-4 font-medium">project</th>
                <th className="text-left py-2.5 px-4 font-medium">mode</th>
                <th className="text-left py-2.5 px-4 font-medium">model</th>
                <th className="text-left py-2.5 px-4 font-medium">updated</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(c => <SessionRow key={c.id} c={c} />)}
            </tbody>
          </table>
          {filtered.length === 0 && !loading && (
            <div className="text-center py-12 text-sm" style={{ color: 'var(--c-text3)' }}>no sessions found</div>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {grouped.map(g => {
            const isCollapsed = collapsedProjects.has(g.folder)
            const editorSet = [...new Set(g.items.map(c => c.source).filter(Boolean))]
            return (
              <div key={g.folder} className="card overflow-hidden">
                <div
                  className="flex items-center gap-2 px-4 py-2.5 cursor-pointer transition"
                  onClick={() => toggleProject(g.folder)}
                >
                  {isCollapsed ? <ChevronRight size={13} style={{ color: 'var(--c-text3)' }} /> : <ChevronDown size={13} style={{ color: 'var(--c-text3)' }} />}
                  <FolderOpen size={13} style={{ color: 'var(--c-text3)' }} />
                  <span className="text-xs font-medium" style={{ color: 'var(--c-white)' }}>{g.name}</span>
                  <span className="text-[10px] truncate max-w-[300px]" style={{ color: 'var(--c-text3)' }}>{g.folder !== g.name && g.folder !== '(no project)' ? g.folder : ''}</span>
                  <span className="ml-auto flex items-center gap-2">
                    {editorSet.slice(0, 5).map(e => (
                      <span key={e} className="w-2 h-2 rounded-full" style={{ background: editorColor(e) }} title={editorLabel(e)} />
                    ))}
                    <span className="text-[10px]" style={{ color: 'var(--c-text3)' }}>{g.items.length}</span>
                  </span>
                </div>
                {!isCollapsed && (
                  <table className="w-full text-sm">
                    <tbody>
                      {g.items.map(c => <SessionRow key={c.id} c={c} />)}
                    </tbody>
                  </table>
                )}
              </div>
            )
          })}
          {grouped.length === 0 && !loading && (
            <div className="text-center py-12 text-sm" style={{ color: 'var(--c-text3)' }}>no sessions found</div>
          )}
        </div>
      )}

      {/* Chat sidebar */}
      <ChatSidebar chatId={selectedChatId} onClose={() => setSelectedChatId(null)} />
    </div>
  )
}
