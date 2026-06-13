import { useQuery } from '@tanstack/react-query';
import { Clock, RefreshCw } from 'lucide-react';
import { api } from '../utils/api';

const cardStyle = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  padding: '1.25rem',
};

const statusColors = {
  scheduled: '#3b82f6',
  published: 'var(--success)',
  failed: 'var(--danger)',
  processing: '#f59e0b',
};

function StatusBadge({ status }) {
  const color = statusColors[status] || 'var(--text2)';
  return (
    <span style={{
      display: 'inline-block',
      background: color + '22',
      color,
      border: `1px solid ${color}44`,
      borderRadius: '999px',
      padding: '0.15rem 0.65rem',
      fontSize: '0.75rem',
      fontWeight: 600,
      textTransform: 'capitalize',
    }}>
      {status || '—'}
    </span>
  );
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export default function QueuePage() {
  const { data: queue = [], isLoading, isFetching, refetch } = useQuery({
    queryKey: ['queue'],
    queryFn: () => api('/api/queue'),
  });

  return (
    <div style={{ padding: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <Clock size={20} color="var(--accent)" />
          <h1 style={{ color: 'var(--text)', fontWeight: 700, fontSize: '1.4rem', margin: 0 }}>Publish Queue</h1>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            background: 'var(--accent)',
            color: '#fff',
            border: 'none',
            borderRadius: 'var(--radius)',
            padding: '0.5rem 1rem',
            fontWeight: 600,
            fontSize: '0.875rem',
            cursor: isFetching ? 'not-allowed' : 'pointer',
            opacity: isFetching ? 0.7 : 1,
          }}
        >
          <RefreshCw size={15} style={{ animation: isFetching ? 'spin 1s linear infinite' : 'none' }} />
          {isFetching ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      <div style={cardStyle}>
        {isLoading ? (
          <div style={{ color: 'var(--text2)', padding: '1rem 0' }}>Loading queue…</div>
        ) : queue.length === 0 ? (
          <div style={{ color: 'var(--text2)', padding: '2rem 0', textAlign: 'center' }}>
            No items in the queue.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Caption', 'Platform', 'Scheduled At', 'Status'].map(h => (
                    <th key={h} style={{
                      textAlign: 'left',
                      padding: '0.5rem 0.75rem',
                      color: 'var(--text2)',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em',
                      whiteSpace: 'nowrap',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {queue.map((item, i) => (
                  <tr key={item.id ?? i} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '0.7rem 0.75rem', color: 'var(--text)', fontSize: '0.875rem', maxWidth: 280 }}>
                      <span title={item.caption}>
                        {item.caption
                          ? item.caption.slice(0, 60) + (item.caption.length > 60 ? '…' : '')
                          : '—'}
                      </span>
                    </td>
                    <td style={{ padding: '0.7rem 0.75rem', color: 'var(--text2)', fontSize: '0.875rem', textTransform: 'capitalize', whiteSpace: 'nowrap' }}>
                      {item.platform || '—'}
                    </td>
                    <td style={{ padding: '0.7rem 0.75rem', color: 'var(--text2)', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                      {formatDate(item.scheduledAt)}
                    </td>
                    <td style={{ padding: '0.7rem 0.75rem' }}>
                      <StatusBadge status={item.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
