import { useState } from 'react'
import { Link } from 'react-router-dom'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Something went wrong')
      setSent(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: '20px' }}>
      <div style={{ width: '100%', maxWidth: '400px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--rl)', padding: '40px 32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28 }}>
          <div style={{ width: 36, height: 36, background: 'var(--gold)', borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--navy)', fontSize: 18 }}>⚡</div>
          <div>
            <div style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, fontSize: 20, color: 'var(--gold)' }}>FlomiPost</div>
            <div style={{ fontSize: 11, color: 'var(--text3)' }}>Social Media Scheduler</div>
          </div>
        </div>

        {sent ? (
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 10 }}>Check your inbox</div>
            <p style={{ color: 'var(--text2)', marginBottom: 24, lineHeight: 1.6 }}>
              If <strong style={{ color: 'var(--text)' }}>{email}</strong> is registered, you'll receive a reset link shortly.
            </p>
            <Link to="/login" style={{ display: 'block', textAlign: 'center', padding: '12px', background: 'var(--gold)', color: 'var(--navy)', borderRadius: 'var(--r)', fontWeight: 700, textDecoration: 'none' }}>
              Back to Sign In
            </Link>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 6 }}>Forgot password?</div>
            <p style={{ color: 'var(--text2)', marginBottom: 24, fontSize: 14 }}>Enter your email and we'll send you a reset link.</p>

            {error && <div style={{ background: 'rgba(226,75,74,0.12)', border: '1px solid rgba(226,75,74,0.3)', color: '#E24B4A', borderRadius: 'var(--r)', padding: '10px 14px', marginBottom: 16, fontSize: 14 }}>{error}</div>}

            <form onSubmit={handleSubmit}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', color: 'var(--text3)', marginBottom: 6 }}>EMAIL</label>
              <input
                type="email" required value={email} onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                style={{ width: '100%', padding: '11px 14px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 'var(--r)', color: 'var(--text)', fontSize: 14, marginBottom: 20, boxSizing: 'border-box' }}
              />
              <button type="submit" disabled={loading}
                style={{ width: '100%', padding: '13px', background: loading ? 'var(--border2)' : 'var(--gold)', color: 'var(--navy)', border: 'none', borderRadius: 'var(--r)', fontWeight: 700, fontSize: 15, cursor: loading ? 'not-allowed' : 'pointer' }}>
                {loading ? 'Sending…' : 'Send Reset Link'}
              </button>
            </form>

            <div style={{ textAlign: 'center', marginTop: 20, fontSize: 13, color: 'var(--text3)' }}>
              <Link to="/login" style={{ color: 'var(--gold)', textDecoration: 'none' }}>← Back to Sign In</Link>
            </div>
          </>
        )}

        <div style={{ textAlign: 'center', marginTop: 28, fontSize: 11, color: 'var(--text3)' }}>
          FlomiPost · scheduler.flomicso.dev
        </div>
      </div>
    </div>
  )
}
