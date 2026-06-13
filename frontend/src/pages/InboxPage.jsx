import { useQuery } from '@tanstack/react-query';
import { Inbox, MessageSquare } from 'lucide-react';

const token = () => localStorage.getItem('fp_token');
const fetchInbox = async () => {
  const res = await fetch('/api/inbox', { headers: { Authorization: `Bearer ${token()}` } });
  if (!res.ok) throw new Error('Failed');
  const json = await res.json();
  return json.data || json;
};

function timeAgo(d) {
  if (!d) return '—';
  const diff = Date.now() - new Date(d).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

const platformColors = { twitter: '#1da1f2', instagram: '#e1306c', facebook: '#1877f2', linkedin: '#0a66c2' };

export default function InboxPage() {
  const { data = [], isLoading, error } = useQuery({ queryKey: ['inbox'], queryFn: fetchInbox });

  return (
    <div style={{ padding: '1.5rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '1.5rem' }}>
        <Inbox size={20} color="var(--accent)" />
        <h1 style={{ margin: 0, color: 'var(--text)', fontWeight: 700, fontSize: '1.4rem' }}>Social Inbox</h1>
        {data.length > 0 && <span style={{ background: 'var(--accent)', color: '#fff', borderRadius: 999, padding: '0.1rem 0.5rem', fontSize: '0.75rem', fontWeight: 700 }}>{data.length}</span>}
      </div>

      {isLoading && <div style={{ color: 'var(--text2)' }}>Loading…</div>}
      {error && <div style={{ color: 'var(--danger)' }}>{error.message}</div>}

      {!isLoading && !error && data.length === 0 && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '3rem', textAlign: 'center', color: 'var(--text2)' }}>
          <Inbox size={40} style={{ marginBottom: '0.75rem', opacity: 0.4 }} />
          <div>Your inbox is empty.</div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {data.map((item, i) => {
          const color = platformColors[item.platform?.toLowerCase()] || 'var(--accent)';
          return (
            <div key={item.id ?? i} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1rem', display: 'flex', gap: '1rem', alignItems: 'flex-start' }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: color + '22', border: `1px solid ${color}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <MessageSquare size={16} color={color} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                  <span style={{ fontWeight: 600, color: 'var(--text)', fontSize: '0.875rem' }}>{item.author || item.username || 'Unknown'}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text2)' }}>{timeAgo(item.createdAt)}</span>
                </div>
                <div style={{ color: 'var(--text2)', fontSize: '0.85rem', marginBottom: '0.25rem' }}>{item.text || item.content || item.message || '—'}</div>
                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.72rem', background: color + '22', color, borderRadius: 999, padding: '0.1rem 0.5rem', textTransform: 'capitalize' }}>{item.platform || 'social'}</span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text2)', textTransform: 'capitalize' }}>{item.type || 'mention'}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
