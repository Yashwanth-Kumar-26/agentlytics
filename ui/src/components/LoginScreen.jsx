import { useState } from 'react'
import { Lock } from 'lucide-react'
import { login } from '../lib/api'
import AnimatedLogo from './AnimatedLogo'

export default function LoginScreen({ onSuccess }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await login(password)
      onSuccess()
    } catch (err) {
      setError(err.message || 'Invalid password')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--c-bg)' }}>
      <div className="w-full max-w-xs">
        <div className="card p-6">
          <div className="flex flex-col items-center mb-5">
            <div
              className="w-10 h-10 flex items-center justify-center rounded-full mb-3"
              style={{ background: 'rgba(99,102,241,0.12)' }}
            >
              <Lock size={18} style={{ color: '#818cf8' }} />
            </div>
            <div className="flex items-center gap-1.5 text-sm font-bold" style={{ color: 'var(--c-white)' }}>
              <AnimatedLogo size={16} />
              Agentlytics
              <span className="text-[10px] font-medium px-1.5 py-0.5" style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8' }}>
                relay
              </span>
            </div>
            <div className="text-[11px] mt-1" style={{ color: 'var(--c-text3)' }}>
              This relay is password-protected
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Password"
              autoFocus
              className="w-full px-3 py-2 text-[12px] outline-none rounded"
              style={{
                background: 'var(--c-bg3)',
                color: 'var(--c-white)',
                border: error ? '1px solid #f87171' : '1px solid var(--c-border)',
              }}
            />
            {error && (
              <div className="text-[11px]" style={{ color: '#f87171' }}>{error}</div>
            )}
            <button
              type="submit"
              disabled={loading || !password}
              className="w-full py-2 text-[12px] font-medium rounded transition"
              style={{
                background: '#6366f1',
                color: '#fff',
                opacity: loading || !password ? 0.5 : 1,
              }}
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
