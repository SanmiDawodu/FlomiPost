import { useQuery } from '@tanstack/react-query';
import { TrendingUp } from 'lucide-react';

const token = () => localStorage.getItem('fp_token');
const h = () => ({ Authorization: `Bearer ${token()}` });

const StatCard = ({ label, value, sub }) => (
  <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1.25rem 1.5rem' }}>
    <div style={{ fontSize: '0.8rem', color: 'var(--text2)', marginBottom: '0.5rem' }}>{label}</div>
    <div style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text)' }}>{value ?? '—'}</div>
    {sub && <div style={{ fontSize: '0.78rem', color: 'var(--text2)', marginTop: '0.25rem' }}>{sub}</div>}
  </div>
);

export default function GAAnalyticsPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['ga-analytics'],
    queryFn: async () => { const r = await fetch('/api/ga-analytics', { headers: h() }); if (!r.ok) throw new Error('Failed'); const j = await r.json(); return j.data || j; },
  });

  const page = { padding: '2rem', maxWidth: '1000px' };
  const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem', marginBottom: '2rem' };
  const table = { width: '100%', borderCollapse: 'collapse' };
  const th = { textAlign: 'left', padding: '0.75rem 1rem', background: 'var(--surface)', color: 'var(--text2)', fontSize: '0.8rem', fontWeight: 600, borderBottom: '1px solid var(--border)' };
  const td = { padding: '0.7rem 1rem', borderBottom: '1px solid var(--border)', color: 'var(--text)', fontSize: '0.85rem' };

  return (
    <div style={page}>
      <h1 style={{ color: 'var(--text)', margin: '0 0 1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><TrendingUp size={22} /> Google Analytics</h1>
      {isLoading && <p style={{ color: 'var(--text2)' }}>Loading…</p>}
      {error && <p style={{ color: 'var(--danger)' }}>{error.message}</p>}
      {data && (
        <>
          <div style={grid}>
            <StatCard label="Pageviews" value={data.pageviews?.toLocaleString()} sub="last 30 days" />
            <StatCard label="Sessions" value={data.sessions?.toLocaleString()} sub="last 30 days" />
            <StatCard label="Bounce Rate" value={data.bounce_rate ? `${data.bounce_rate}%` : undefined} sub="avg" />
            <StatCard label="Avg. Duration" value={data.avg_duration} sub="per session" />
            <StatCard label="New Users" value={data.new_users?.toLocaleString()} sub="last 30 days" />
          </div>
          {data.pages && (
            <>
              <h2 style={{ color: 'var(--text)', fontSize: '1rem', marginBottom: '0.75rem' }}>Top Pages</h2>
              <table style={table}>
                <thead><tr><th style={th}>Page</th><th style={th}>Views</th><th style={th}>Avg Time</th></tr></thead>
                <tbody>
                  {data.pages.map((p, i) => (
                    <tr key={i}><td style={td}>{p.path}</td><td style={td}>{p.views?.toLocaleString()}</td><td style={td}>{p.avg_time || '—'}</td></tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </>
      )}
    </div>
  );
}
