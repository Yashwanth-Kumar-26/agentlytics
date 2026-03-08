import { useState, useEffect } from 'react'
import { Loader2, ArrowLeftRight } from 'lucide-react'
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Tooltip, Legend } from 'chart.js'
import { Bar } from 'react-chartjs-2'
import { fetchDeepAnalytics, fetchChats } from '../lib/api'
import { editorColor, editorLabel, formatNumber } from '../lib/constants'
import { useTheme } from '../lib/theme'

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend)

const MONO = 'JetBrains Mono, monospace'

function MetricRow({ label, a, b, colorA, colorB }) {
  const numA = parseFloat(a) || 0
  const numB = parseFloat(b) || 0
  const max = Math.max(numA, numB, 1)
  return (
    <div className="grid grid-cols-[1fr_100px_100px] gap-x-3 items-center py-0.5" style={{ borderBottom: '1px solid var(--c-border)' }}>
      <div className="text-[11px]" style={{ color: 'var(--c-text2)' }}>{label}</div>
      <div className="text-right">
        <span className="text-[12px] font-mono font-medium" style={{ color: 'var(--c-white)' }}>
          {typeof a === 'number' ? formatNumber(a) : a}
        </span>
        <div className="h-1 rounded-full mt-0.5 ml-auto" style={{ background: colorA, width: `${(numA / max * 100).toFixed(0)}%` }} />
      </div>
      <div className="text-right">
        <span className="text-[12px] font-mono font-medium" style={{ color: 'var(--c-white)' }}>
          {typeof b === 'number' ? formatNumber(b) : b}
        </span>
        <div className="h-1 rounded-full mt-0.5 ml-auto" style={{ background: colorB, width: `${(numB / max * 100).toFixed(0)}%` }} />
      </div>
    </div>
  )
}

function ListCompare({ titleA, titleB, colorA, colorB, itemsA, itemsB, limit = 8 }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      <div>
        <h4 className="text-[11px] font-medium uppercase tracking-wider mb-1" style={{ color: colorA }}>{titleA}</h4>
        <div className="space-y-0.5">
          {itemsA.slice(0, limit).map(t => (
            <div key={t.name} className="flex justify-between text-[11px] py-0.5">
              <span className="truncate" style={{ color: 'var(--c-text)' }}>{t.name}</span>
              <span className="font-mono ml-2" style={{ color: 'var(--c-text3)' }}>{t.count}</span>
            </div>
          ))}
          {itemsA.length === 0 && <div className="text-[11px]" style={{ color: 'var(--c-text3)' }}>none</div>}
        </div>
      </div>
      <div>
        <h4 className="text-[11px] font-medium uppercase tracking-wider mb-1" style={{ color: colorB }}>{titleB}</h4>
        <div className="space-y-0.5">
          {itemsB.slice(0, limit).map(t => (
            <div key={t.name} className="flex justify-between text-[11px] py-0.5">
              <span className="truncate" style={{ color: 'var(--c-text)' }}>{t.name}</span>
              <span className="font-mono ml-2" style={{ color: 'var(--c-text3)' }}>{t.count}</span>
            </div>
          ))}
          {itemsB.length === 0 && <div className="text-[11px]" style={{ color: 'var(--c-text3)' }}>none</div>}
        </div>
      </div>
    </div>
  )
}

export default function Compare({ overview }) {
  const editors = overview?.editors || []
  const [editorA, setEditorA] = useState(editors[0]?.id || '')
  const [editorB, setEditorB] = useState(editors[1]?.id || '')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const { dark } = useTheme()
  const legendColor = dark ? '#888' : '#555'

  async function run() {
    if (!editorA || !editorB) return
    setLoading(true)
    const [deepA, deepB, chatsA, chatsB] = await Promise.all([
      fetchDeepAnalytics({ editor: editorA, limit: 500 }),
      fetchDeepAnalytics({ editor: editorB, limit: 500 }),
      fetchChats({ editor: editorA, limit: 1000 }),
      fetchChats({ editor: editorB, limit: 1000 }),
    ])
    setResult({ deepA, deepB, chatsA, chatsB })
    setLoading(false)
  }

  useEffect(() => { if (editorA && editorB) run() }, [editorA, editorB])

  const colorA = editorColor(editorA)
  const colorB = editorColor(editorB)
  const nameA = editorLabel(editorA)
  const nameB = editorLabel(editorB)

  // Derived metrics
  const avg = (total, count) => count ? (total / count).toFixed(1) : '0'
  const pct = (part, whole) => whole ? ((part / whole) * 100).toFixed(0) + '%' : '0%'

  const metrics = result ? [
    { label: 'Sessions', a: result.chatsA.total, b: result.chatsB.total },
    { label: 'Messages', a: result.deepA.totalMessages, b: result.deepB.totalMessages },
    { label: 'Tool Calls', a: result.deepA.totalToolCalls, b: result.deepB.totalToolCalls },
    { label: 'Input Tokens', a: result.deepA.totalInputTokens, b: result.deepB.totalInputTokens },
    { label: 'Output Tokens', a: result.deepA.totalOutputTokens, b: result.deepB.totalOutputTokens },
    { label: 'Cache Read', a: result.deepA.totalCacheRead, b: result.deepB.totalCacheRead },
  ] : []

  const ratios = result ? [
    { label: 'Avg Msgs / Session', a: avg(result.deepA.totalMessages, result.deepA.analyzedChats), b: avg(result.deepB.totalMessages, result.deepB.analyzedChats) },
    { label: 'Avg Tools / Session', a: avg(result.deepA.totalToolCalls, result.deepA.analyzedChats), b: avg(result.deepB.totalToolCalls, result.deepB.analyzedChats) },
    { label: 'Avg Tokens / Session', a: avg(result.deepA.totalInputTokens + result.deepA.totalOutputTokens, result.deepA.analyzedChats), b: avg(result.deepB.totalInputTokens + result.deepB.totalOutputTokens, result.deepB.analyzedChats) },
    { label: 'Output / Input Ratio', a: avg(result.deepA.totalOutputTokens, result.deepA.totalInputTokens || 1), b: avg(result.deepB.totalOutputTokens, result.deepB.totalInputTokens || 1) },
    { label: 'Tools / Message', a: avg(result.deepA.totalToolCalls, result.deepA.totalMessages || 1), b: avg(result.deepB.totalToolCalls, result.deepB.totalMessages || 1) },
    { label: 'Cache Hit Rate', a: pct(result.deepA.totalCacheRead, result.deepA.totalInputTokens), b: pct(result.deepB.totalCacheRead, result.deepB.totalInputTokens) },
  ] : []

  // Bar chart: side-by-side comparison of key metrics
  const barLabels = ['Sessions', 'Messages', 'Tool Calls']
  const barDataA = result ? [result.chatsA.total, result.deepA.totalMessages, result.deepA.totalToolCalls] : []
  const barDataB = result ? [result.chatsB.total, result.deepB.totalMessages, result.deepB.totalToolCalls] : []

  const barChart = {
    labels: barLabels,
    datasets: [
      { label: nameA, data: barDataA, backgroundColor: colorA + '99', borderRadius: 2 },
      { label: nameB, data: barDataB, backgroundColor: colorB + '99', borderRadius: 2 },
    ],
  }

  // Token breakdown bar chart
  const tokenLabels = ['Input', 'Output', 'Cache Read']
  const tokenChart = result ? {
    labels: tokenLabels,
    datasets: [
      { label: nameA, data: [result.deepA.totalInputTokens, result.deepA.totalOutputTokens, result.deepA.totalCacheRead], backgroundColor: colorA + '99', borderRadius: 2 },
      { label: nameB, data: [result.deepB.totalInputTokens, result.deepB.totalOutputTokens, result.deepB.totalCacheRead], backgroundColor: colorB + '99', borderRadius: 2 },
    ],
  } : null

  const barOpts = {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { labels: { color: legendColor, font: { size: 9, family: MONO }, usePointStyle: true, pointStyle: 'circle', padding: 8 } },
      tooltip: { bodyFont: { family: MONO, size: 10 }, titleFont: { family: MONO, size: 10 } },
    },
    scales: {
      x: { grid: { display: false }, ticks: { color: legendColor, font: { size: 9, family: MONO } } },
      y: { grid: { color: dark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.06)' }, ticks: { color: legendColor, font: { size: 9, family: MONO } } },
    },
  }

  return (
    <div className="fade-in space-y-3">
      <div className="flex items-center gap-2">
        <select
          value={editorA}
          onChange={e => setEditorA(e.target.value)}
          className="px-2 py-1 text-[12px] outline-none"
          style={{ background: 'var(--c-bg3)', color: 'var(--c-text)', border: '1px solid var(--c-border)' }}
        >
          {editors.map(e => <option key={e.id} value={e.id}>{editorLabel(e.id)}</option>)}
        </select>
        <ArrowLeftRight size={12} style={{ color: 'var(--c-text3)' }} />
        <select
          value={editorB}
          onChange={e => setEditorB(e.target.value)}
          className="px-2 py-1 text-[12px] outline-none"
          style={{ background: 'var(--c-bg3)', color: 'var(--c-text)', border: '1px solid var(--c-border)' }}
        >
          {editors.map(e => <option key={e.id} value={e.id}>{editorLabel(e.id)}</option>)}
        </select>
        {loading && <Loader2 size={11} className="animate-spin" style={{ color: 'var(--c-text3)' }} />}
      </div>

      {result && (
        <div className="space-y-3">
          {/* Metrics + Ratios side by side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
            <div className="card p-3">
              <div className="flex items-center justify-between mb-1.5">
                <h3 className="text-[11px] font-medium uppercase tracking-wider" style={{ color: 'var(--c-text2)' }}>totals</h3>
                <div className="flex items-center gap-3 text-[10px]">
                  <span style={{ color: colorA }}>● {nameA}</span>
                  <span style={{ color: colorB }}>● {nameB}</span>
                </div>
              </div>
              {metrics.map(m => <MetricRow key={m.label} label={m.label} a={m.a} b={m.b} colorA={colorA} colorB={colorB} />)}
            </div>
            <div className="card p-3">
              <h3 className="text-[11px] font-medium uppercase tracking-wider mb-1.5" style={{ color: 'var(--c-text2)' }}>efficiency</h3>
              {ratios.map(m => <MetricRow key={m.label} label={m.label} a={m.a} b={m.b} colorA={colorA} colorB={colorB} />)}
            </div>
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
            <div className="card p-3">
              <h3 className="text-[11px] font-medium uppercase tracking-wider mb-2" style={{ color: 'var(--c-text2)' }}>usage</h3>
              <div style={{ height: 160 }}>
                <Bar data={barChart} options={barOpts} />
              </div>
            </div>
            {tokenChart && (
              <div className="card p-3">
                <h3 className="text-[11px] font-medium uppercase tracking-wider mb-2" style={{ color: 'var(--c-text2)' }}>tokens</h3>
                <div style={{ height: 160 }}>
                  <Bar data={tokenChart} options={barOpts} />
                </div>
              </div>
            )}
          </div>

          {/* Tools + Models side-by-side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
            <div className="card p-3">
              <h3 className="text-[11px] font-medium uppercase tracking-wider mb-2" style={{ color: 'var(--c-text2)' }}>top tools</h3>
              <ListCompare titleA={nameA} titleB={nameB} colorA={colorA} colorB={colorB}
                itemsA={result.deepA.topTools} itemsB={result.deepB.topTools} limit={10} />
            </div>
            <div className="card p-3">
              <h3 className="text-[11px] font-medium uppercase tracking-wider mb-2" style={{ color: 'var(--c-text2)' }}>models</h3>
              <ListCompare titleA={nameA} titleB={nameB} colorA={colorA} colorB={colorB}
                itemsA={result.deepA.topModels} itemsB={result.deepB.topModels} limit={8} />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
