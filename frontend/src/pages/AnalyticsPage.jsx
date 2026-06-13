import { useQuery } from '@tanstack/react-query';
import { BarChart2 } from 'lucide-react';

const token = () => localStorage.getItem('fp_token');
const fetchAnalytics = async () => {
  const res = await fetch('/api/analytics', { headers: { Authorization: `Bearer ${token()}` } });
  if (!res.ok) throw new Error('Failed to fetch analytics');
  const json = await res.json();
  return json.data || json;
};

const card = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1.25rem' };
const th = { textAlign: 'left', padding: '0.5rem 0.75rem', color: 'var(--text2)', fontSize: '0.78rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' };
const td = (extra = {}) => ({ padding: '0.65rem 0.75rem', color: 'var(--text)', fontSize: '0.875rem', ...extra });

export default function AnalyticsPage() {
  const { data = [], isLoading, error } = useQuery({ queryKey: ['analytics'], queryFn: fetchAnalytics });

  return (
    <div style={{ padding: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.5rem' }}>
        <BarChart2 size={20} color="var(--accent)" />
        <h1 style={{ color: 'var(--text)', fontWeight: 700, fontSize: '1.4rem', margin: 0 }}>Analytics</h1>
      </div>

      {isLoading && <div style={{ color: 'var(--text2)' }}>Loading…</div>}
      {error && <div style={{ color: 'var(--danger)' }}>{error.message}</div>}

      {!isLoading && !error && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            {[
              { label: 'Total Impressions', key: 'impressions' },
              { label: 'Total Reach', key: 'reach' },
              { label: 'Engagements', key: 'engagements' },
              { label: 'Avg Eng. Rate', key: 'engagementRate' },
            ].map(({ label, key }) => {
              const total = data.reduce((sum, row) => sum + (Number(row[key]) || 0), 0);
              return (
                <div key={key} style={card}>
                  <div style={{ color: 'var(--text2)', fontSize: '0.8rem', marginBottom: '0.3rem' }}>{label}</div>
                  <div style={{ color: 'var(--text)', fontSize: '1.5rem', fontWeight: 700 }}>
                    {key === 'engagementRate' ? (data.length ? (total / data.length).toFixed(2) + '%' : '—') : total.toLocaleString()}
                  </div>
                </div>
              );
            })}
          </div>

          <div style={card}>
            <h2 style={{ color: 'var(--text)', fontWeight: 600, fontSize: '1rem', marginBottom: '1rem' }}>Per Connection</h2>
            {data.length === 0 ? (
              <div style={{ color: 'var(--text2)' }}>No analytics data yet.</div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      {['Connection', 'Platform', 'Impressions', 'Reach', 'Engagements', 'Eng. Rate'].map(h => (
                        <th key={h} style={th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((row, i) => (
                      <tr key={row.id ?? i} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={td()}>{row.connectionName || row.name || '—'}</td>
                        <td style={td({ color: 'var(--text2)', textTransform: 'capitalize' })}>{row.platform || '—'}</td>
                        <td style={td({ color: 'var(--text2)' })}>{row.impressions?.toLocaleString() ?? '—'}</td>
                        <td style={td({ color: 'var(--text2)' })}>{row.reach?.toLocaleString() ?? '—'}</td>
                        <td style={td({ color: 'var(--text2)' })}>{row.engagements?.toLocaleString() ?? '—'}</td>
                        <td style={td({ color: 'var(--text2)' })}>{row.engagementRate != null ? row.engagementRate + '%' : '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
