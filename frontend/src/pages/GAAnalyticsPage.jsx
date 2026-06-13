import { useQuery } from '@tanstack/react-query'
import { BarChart2, ExternalLink, RefreshCw } from 'lucide-react'

const tok = () => localStorage.getItem('fp_token')
const api = (url, opts={}) => fetch(url, {headers:{'Authorization':`Bearer ${tok()}`,'Content-Type':'application/json'},...opts}).then(r=>r.json())

const Stat = ({ label, value, sub }) => (
  <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1.25rem 1.5rem', flex: 1, minWidth: 160 }}>
    <div style={{ fontSize: '0.78rem', color: 'var(--text2)', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</div>
    <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text)', lineHeight: 1 }}>{value ?? '—'}</div>
    {sub && <div style={{ fontSize: '0.78rem', color: 'var(--text2)', marginTop: '0.4rem' }}>{sub}</div>}
  </div>
)

export default function GAAnalyticsPage() {
  const { data, isLoading, error } = useQuery({ queryKey: ['ga-reports'], queryFn: () => api('/api/ga/reports') })

  if (isLoading) return <div style={{ padding: '2rem', color: 'var(--text2)' }}>Loading analytics…</div>

  if (error || data?.error || !data?.connected) {
    return (
      <div style={{ padding: '2rem', maxWidth: 500 }}>
        <h1 style={{ color: 'var(--text)', margin: '0 0 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><BarChart2 size={22} /> Google Analytics</h1>
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '2rem', textAlign: 'center' }}>
          <BarChart2 size={40} style={{ color: 'var(--text2)', marginBottom: '1rem' }} />
          <p style={{ color: 'var(--text2)', marginBottom: '1.5rem' }}>Connect your Google Analytics account to see reports.</p>
          <a href="/api/oauth/google-analytics/connect" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--accent)', color: '#fff', textDecoration: 'none', borderRadius: 'var(--radius)', padding: '10px 20px', fontWeight: 600 }}>
            <ExternalLink size={15} /> Connect Google Analytics
          </a>
        </div>
      </div>
    )
  }

  const r = data?.report || data || {}

  return (
    <div style={{ padding: '2rem', maxWidth: 900 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ color: 'var(--text)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}><BarChart2 size={22} /> Google Analytics</h1>
        <span style={{ fontSize: '0.8rem', color: 'var(--text2)' }}>Last 30 days</span>
      </div>
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '2rem' }}>
        <Stat label="Sessions" value={r.sessions?.toLocaleString()} />
        <Stat label="Pageviews" value={r.pageviews?.toLocaleString()} />
        <Stat label="Bounce Rate" value={r.bounce_rate ? `${r.bounce_rate}%` : '—'} />
        <Stat label="Avg. Session" value={r.avg_session_duration} />
        <Stat label="New Users" value={r.new_users?.toLocaleString()} />
      </div>
      {r.top_pages?.length > 0 && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1.25rem' }}>
          <h3 style={{ color: 'var(--text)', margin: '0 0 1rem', fontSize: '0.95rem' }}>Top Pages</h3>
          {r.top_pages.map((p, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.5rem 0', borderBottom: i < r.top_pages.length - 1 ? '1px solid var(--border)' : 'none' }}>
              <span style={{ color: 'var(--text)', fontSize: '0.85rem' }}>{p.path}</span>
              <span style={{ color: 'var(--text2)', fontSize: '0.85rem' }}>{p.views?.toLocaleString()} views</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
