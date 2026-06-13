import { useQuery } from '@tanstack/react-query';
import { Mail } from 'lucide-react';

const token = () => localStorage.getItem('fp_token');
const h = () => ({ Authorization: `Bearer ${token()}` });

const statusColor = { sent: 'var(--success)', draft: 'var(--text2)', scheduled: 'var(--accent)', failed: 'var(--danger)' };

export default function EmailPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['email-campaigns'],
    queryFn: async () => { const r = await fetch('/api/email-campaigns', { headers: h() }); if (!r.ok) throw new Error('Failed'); const j = await r.json(); return j.data || j; },
  });

  const page = { padding: '2rem', maxWidth: '1000px' };
  const table = { width: '100%', borderCollapse: 'collapse', marginTop: '1rem' };
  const th = { textAlign: 'left', padding: '0.75rem 1rem', background: 'var(--surface)', color: 'var(--text2)', fontSize: '0.8rem', fontWeight: 600, borderBottom: '1px solid var(--border)' };
  const td = { padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)', color: 'var(--text)', fontSize: '0.85rem' };
  const badge = (s) => ({ padding: '0.18rem 0.55rem', borderRadius: '99px', fontSize: '0.72rem', background: `${statusColor[s] || 'var(--text2)'}22`, color: statusColor[s] || 'var(--text2)' });

  return (
    <div style={page}>
      <h1 style={{ color: 'var(--text)', margin: '0 0 1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Mail size={22} /> Email Campaigns</h1>
      {isLoading && <p style={{ color: 'var(--text2)' }}>Loading…</p>}
      {error && <p style={{ color: 'var(--danger)' }}>{error.message}</p>}
      {data?.length === 0 && <p style={{ color: 'var(--text2)' }}>No email campaigns found.</p>}
      {data?.length > 0 && (
        <table style={table}>
          <thead>
            <tr>
              <th style={th}>Campaign Name</th>
              <th style={th}>Status</th>
              <th style={th}>Sent</th>
              <th style={th}>Open Rate</th>
              <th style={th}>Click Rate</th>
              <th style={th}>Date</th>
            </tr>
          </thead>
          <tbody>
            {data.map(c => (
              <tr key={c.id}>
                <td style={{ ...td, fontWeight: 600 }}>{c.name || c.subject}</td>
                <td style={td}><span style={badge(c.status)}>{c.status}</span></td>
                <td style={td}>{c.sent_count?.toLocaleString() ?? '—'}</td>
                <td style={td}>{c.open_rate != null ? `${c.open_rate}%` : '—'}</td>
                <td style={td}>{c.click_rate != null ? `${c.click_rate}%` : '—'}</td>
                <td style={td}>{c.sent_at ? new Date(c.sent_at).toLocaleDateString() : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
