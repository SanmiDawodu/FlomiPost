import { useQuery } from '@tanstack/react-query';
import { BarChart2, Link2, Clock, CheckCircle } from 'lucide-react';
import { api } from '../utils/api';

const cardStyle = {
  background: 'var(--surface)',
  border: '1px solid var(--border)',
  borderRadius: 'var(--radius)',
  padding: '1.25rem',
};

function StatCard({ icon: Icon, label, value, color }) {
  return (
    <div style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: '1rem' }}>
      <div style={{
        background: color + '22',
        borderRadius: 'var(--radius)',
        padding: '0.75rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <Icon size={22} color={color} />
      </div>
      <div>
        <div style={{ color: 'var(--text2)', fontSize: '0.8rem', marginBottom: '0.2rem' }}>{label}</div>
        <div style={{ color: 'var(--text)', fontSize: '1.6rem', fontWeight: 700 }}>{value ?? '—'}</div>
      </div>
    </div>
  );
}

function statusBadge(status) {
  const colors = {
    scheduled: 'var(--accent)',
    published: 'var(--success)',
    failed: 'var(--danger)',
    processing: '#f59e0b',
    draft: 'var(--text2)',
  };
  return {
    display: 'inline-block',
    background: (colors[status] || 'var(--text2)') + '22',
    color: colors[status] || 'var(--text2)',
    border: `1px solid ${colors[status] || 'var(--text2)'}44`,
    borderRadius: '999px',
    padding: '0.15rem 0.6rem',
    fontSize: '0.75rem',
    fontWeight: 600,
    textTransform: 'capitalize',
  };
}

function timeAgo(dateStr) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export default function DashboardPage() {
  const { data: posts = [], isLoading: postsLoading } = useQuery({
    queryKey: ['posts'],
    queryFn: () => api('/api/posts'),
  });

  const { data: connections = [], isLoading: connectionsLoading } = useQuery({
    queryKey: ['connections'],
    queryFn: () => api('/api/connections'),
  });

  const scheduled = posts.filter(p => p.status === 'scheduled');
  const published = posts.filter(p => p.status === 'published');
  const recentPosts = [...posts].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 5);

  const loading = postsLoading || connectionsLoading;

  return (
    <div style={{ padding: '1.5rem' }}>
      <h1 style={{ color: 'var(--text)', fontWeight: 700, fontSize: '1.4rem', marginBottom: '1.5rem' }}>
        Dashboard
      </h1>

      {loading ? (
        <div style={{ color: 'var(--text2)' }}>Loading…</div>
      ) : (
        <>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '1rem',
            marginBottom: '2rem',
          }}>
            <StatCard icon={BarChart2} label="Total Posts" value={posts.length} color="var(--accent)" />
            <StatCard icon={Link2} label="Connections" value={connections.length} color="#8b5cf6" />
            <StatCard icon={Clock} label="Scheduled" value={scheduled.length} color="#3b82f6" />
            <StatCard icon={CheckCircle} label="Published" value={published.length} color="var(--success)" />
          </div>

          <div style={{ ...cardStyle }}>
            <h2 style={{ color: 'var(--text)', fontWeight: 600, fontSize: '1rem', marginBottom: '1rem' }}>
              Recent Posts
            </h2>
            {recentPosts.length === 0 ? (
              <div style={{ color: 'var(--text2)', fontSize: '0.9rem' }}>No posts yet.</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['Caption', 'Platform', 'Status', 'Created'].map(h => (
                      <th key={h} style={{
                        textAlign: 'left',
                        padding: '0.5rem 0.75rem',
                        color: 'var(--text2)',
                        fontSize: '0.78rem',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentPosts.map((post, i) => (
                    <tr key={post.id ?? i} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '0.65rem 0.75rem', color: 'var(--text)', fontSize: '0.875rem' }}>
                        {post.caption ? post.caption.slice(0, 60) + (post.caption.length > 60 ? '…' : '') : '—'}
                      </td>
                      <td style={{ padding: '0.65rem 0.75rem', color: 'var(--text2)', fontSize: '0.875rem', textTransform: 'capitalize' }}>
                        {post.platform || '—'}
                      </td>
                      <td style={{ padding: '0.65rem 0.75rem' }}>
                        <span style={statusBadge(post.status)}>{post.status || '—'}</span>
                      </td>
                      <td style={{ padding: '0.65rem 0.75rem', color: 'var(--text2)', fontSize: '0.8rem' }}>
                        {post.createdAt ? timeAgo(post.createdAt) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}
