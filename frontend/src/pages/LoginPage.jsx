import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { Zap } from 'lucide-react'
import toast from 'react-hot-toast'

export default function LoginPage() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const { login }               = useAuthStore()
  const navigate                = useNavigate()

  const submit = async (e) => {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      await login(email, password)
      toast.success('Welcome back!')
      navigate('/')
    } catch (err) {
      setError(err.message || 'Invalid credentials')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fp-login-bg">
      <div className="fp-login-card">
        <div className="fp-login-logo">
          <div className="fp-login-logo-mark" style={{borderRadius:16,width:56,height:56,overflow:"hidden",boxShadow:"0 8px 24px rgba(91,60,245,.4)"}}><img src="https://scheduler.flomicso.dev/storage/media/fp_6a1f5d3184c104.04916493.png" style={{width:56,height:56,objectFit:"cover"}}/></div>
          <div>
            <div className="fp-login-title">FlomiPost</div>
            <div className="fp-login-sub">Social Media Scheduler</div>
          </div>
        </div>

        {error && <div className="fp-login-error">{error}</div>}

        <form onSubmit={submit}>
          <div className="fp-field">
            <label className="fp-label">Email</label>
            <input
              className="fp-input"
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div className="fp-field">
            <label className="fp-label">Password</label>
            <input
              className="fp-input"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>
          <div style={{ textAlign: 'right', marginTop: -4, marginBottom: 12 }}>
            <Link to="/forgot-password" style={{ fontSize: 13, color: 'var(--gold)', textDecoration: 'none', opacity: 0.85 }}>
              Forgot password?
            </Link>
          </div>
          <button
            type="submit"
            className="fp-btn fp-btn-primary"
            style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}
            disabled={loading}
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <p style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'center', marginTop: 20 }}>
          FlomiPost · scheduler.flomicso.dev
        </p>
      </div>
    </div>
  )
}
