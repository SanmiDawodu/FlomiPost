import { useQuery } from '@tanstack/react-query';
import { LineChart, Download } from 'lucide-react';

const token = () => localStorage.getItem('fp_token');
const fetchReports = async () => {
  const res = await fetch('/api/reports', { headers: { Authorization: `Bearer ${token()}` } });
  if (!res.ok) throw new Error('Failed');
  const json = await res.json();
  return json.data || json;
};

const card = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1.25rem' };
const th = { textAlign: 'left', padding: '0.5rem 0.75rem', color: 'var(--text2)', fontSize: '0.78rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' };
const td = { padding: '0.65rem 0.75rem', color: 'var(--text)', fontSize: '0.875rem' };

function exportCSV(data) {
  if (!data.length) return;
  const keys = Object.keys(data[0]);
  const csv = [keys.join(','), ...data.map(r => keys.map(k => JSON.stringify(r[k] ?? '')).join(','))].join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  a.download = 'reports.csv';
  a.click();
}

export default function ReportsPage() {
  const { data = [], isLoading, error } = useQuery({ queryKey: ['reports'], queryFn: fetchReports });

  const cols = data.length > 0 ? Object.keys(data[0]) : [];

  return (
    <div style={{ padding: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <LineChart size={20} color="var(--accent)" />
          <h1 style={{ margin: 0, color: 'var(--text)', fontWeight: 700, fontSize: '1.4rem' }}>Reports</h1>
        </div>
        <button
          onClick={() => exportCSV(data)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text)', padding: '0.45rem 0.9rem', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }}
        >
          <Download size={15} /> Export CSV
        </button>
      </div>

      {isLoading && <div style={{ color: 'var(--text2)' }}>Loading…</div>}
      {error && <div style={{ color: 'var(--danger)' }}>{error.message}</div>}

      <div style={card}>
        {!isLoading && data.length === 0 && <div style={{ color: 'var(--text2)' }}>No reports available.</div>}
        {data.length > 0 && (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {cols.map(c => <th key={c} style={th}>{c}</th>)}
                </tr>
              </thead>
              <tbody>
                {data.map((row, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                    {cols.map(c => <td key={c} style={{ ...td, color: c === cols[0] ? 'var(--text)' : 'var(--text2)' }}>{String(row[c] ?? '—')}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
