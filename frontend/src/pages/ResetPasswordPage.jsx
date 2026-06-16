import { useState, useEffect } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token') || ''

  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [verifying, setVerifying] = useState(true)
  const [tokenEmail, setTokenEmail] = useState('')
  const [tokenError, setTokenError] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [showPw, setShowPw] = useState(false)

  useEffect(() => {
    if (!token) { setTokenError('No reset token found.'); setVerifying(false); return }
    fetch(`/api/verify-reset-token?token=${token}`)
      .then(r => r.json())
      .then(d => {
        if (d.success) setTokenEmail(d.data.email)
        else setTokenError(d.error || 'Invalid link')
      })
      .catch(() => setTokenError('Failed to verify link'))
      .finally(() => setVerifying(false))
  }, [token])

  async function handleSubmit(e) {
    e.preventDefault()
    if (password !== confirm) { setError('Passwords do not match'); return }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Something went wrong')
      setDone(true)
      setTimeout(() => navigate('/login'), 3000)
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

        {verifying && <p style={{ color: 'var(--text2)' }}>Verifying reset link…</p>}

        {!verifying && tokenError && (
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 10, color: '#E24B4A' }}>Link invalid</div>
            <p style={{ color: 'var(--text2)', marginBottom: 24 }}>{tokenError}</p>
            <Link to="/forgot-password" style={{ display: 'block', textAlign: 'center', padding: '12px', background: 'var(--gold)', color: 'var(--navy)', borderRadius: 'var(--r)', fontWeight: 700, textDecoration: 'none' }}>
              Request a new link
            </Link>
          </div>
        )}

        {!verifying && !tokenError && !done && (
          <>
            <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Set new password</div>
            <p style={{ color: 'var(--text2)', fontSize: 13, marginBottom: 24 }}>For <strong style={{ color: 'var(--text)' }}>{tokenEmail}</strong></p>

            {error && <div style={{ background: 'rgba(226,75,74,0.12)', border: '1px solid rgba(226,75,74,0.3)', color: '#E24B4A', borderRadius: 'var(--r)', padding: '10px 14px', marginBottom: 16, fontSize: 14 }}>{error}</div>}

            <form onSubmit={handleSubmit}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', color: 'var(--text3)', marginBottom: 6 }}>NEW PASSWORD</label>
              <div style={{ position: 'relative', marginBottom: 14 }}>
                <input
                  type={showPw ? 'text' : 'password'} required value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="Min. 8 characters"
                  style={{ width: '100%', padding: '11px 40px 11px 14px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 'var(--r)', color: 'var(--text)', fontSize: 14, boxSizing: 'border-box' }}
                />
                <button type="button" onClick={() => setShowPw(v => !v)}
                  style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 13 }}>
                  {showPw ? 'Hide' : 'Show'}
                </button>
              </div>

              <label style={{ display: 'block', fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', color: 'var(--text3)', marginBottom: 6 }}>CONFIRM PASSWORD</label>
              <input
                type={showPw ? 'text' : 'password'} required value={confirm} onChange={e => setConfirm(e.target.value)}
                placeholder="Repeat password"
                style={{ width: '100%', padding: '11px 14px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 'var(--r)', color: 'var(--text)', fontSize: 14, marginBottom: 20, boxSizing: 'border-box' }}
              />

              <button type="submit" disabled={loading}
                style={{ width: '100%', padding: '13px', background: loading ? 'var(--border2)' : 'var(--gold)', color: 'var(--navy)', border: 'none', borderRadius: 'var(--r)', fontWeight: 700, fontSize: 15, cursor: loading ? 'not-allowed' : 'pointer' }}>
                {loading ? 'Updating…' : 'Update Password'}
              </button>
            </form>
          </>
        )}

        {done && (
          <div>
            <div style={{ fontSize: 22, fontWeight: 700, marginBottom: 10, color: 'var(--green)' }}>✓ Password updated</div>
            <p style={{ color: 'var(--text2)', marginBottom: 24 }}>Redirecting you to sign in…</p>
            <Link to="/login" style={{ display: 'block', textAlign: 'center', padding: '12px', background: 'var(--gold)', color: 'var(--navy)', borderRadius: 'var(--r)', fontWeight: 700, textDecoration: 'none' }}>
              Sign In now
            </Link>
          </div>
        )}

        <div style={{ textAlign: 'center', marginTop: 28, fontSize: 11, color: 'var(--text3)' }}>
          FlomiPost · scheduler.flomicso.dev
        </div>
      </div>
    </div>
  )
}
