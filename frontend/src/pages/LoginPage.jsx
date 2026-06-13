import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap, LogIn } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

const pageStyle = {
  minHeight: '100vh',
  background: 'var(--bg)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '1rem',
};

const cardStyle = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  padding: '2rem',
  width: '100%',
  maxWidth: '400px',
};

const logoStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '0.5rem',
  fontWeight: 700,
  fontSize: '1.4rem',
  color: 'var(--text)',
  marginBottom: '1.75rem',
  letterSpacing: '-0.01em',
};

const labelStyle = {
  display: 'block',
  fontSize: '0.83rem',
  fontWeight: 500,
  color: 'var(--text2)',
  marginBottom: '0.35rem',
};

const inputStyle = {
  width: '100%',
  padding: '0.55rem 0.75rem',
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  color: 'var(--text)',
  fontSize: '0.9rem',
  outline: 'none',
  boxSizing: 'border-box',
};

const fieldStyle = {
  marginBottom: '1rem',
};

const submitBtnStyle = (loading) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '0.5rem',
  width: '100%',
  padding: '0.65rem',
  background: 'var(--accent)',
  color: '#fff',
  border: 'none',
  borderRadius: 'var(--radius)',
  fontSize: '0.92rem',
  fontWeight: 600,
  cursor: loading ? 'not-allowed' : 'pointer',
  opacity: loading ? 0.7 : 1,
  marginTop: '0.5rem',
  transition: 'opacity 0.15s',
});

const errorStyle = {
  marginTop: '1rem',
  padding: '0.6rem 0.75rem',
  background: 'color-mix(in srgb, var(--danger) 12%, transparent)',
  border: '1px solid var(--danger)',
  borderRadius: 'var(--radius)',
  color: 'var(--danger)',
  fontSize: '0.85rem',
};

export default function LoginPage() {
  const navigate = useNavigate();
  const login = useAuthStore((s) => s.login);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/');
    } catch (err) {
      setError(err?.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={pageStyle}>
      <div style={cardStyle}>
        <div style={logoStyle}>
          <Zap size={24} color="var(--accent)" fill="var(--accent)" />
          FlomiPost
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <div style={fieldStyle}>
            <label htmlFor="email" style={labelStyle}>Email</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              style={inputStyle}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
            />
          </div>

          <div style={fieldStyle}>
            <label htmlFor="password" style={labelStyle}>Password</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              style={inputStyle}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          <button type="submit" style={submitBtnStyle(loading)} disabled={loading}>
            <LogIn size={16} />
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        {error && <div style={errorStyle}>{error}</div>}
      </div>
    </div>
  );
}
