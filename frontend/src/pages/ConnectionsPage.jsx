import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link2, RefreshCw, Trash2, Plus } from 'lucide-react';

const token = () => localStorage.getItem('fp_token');
const headers = () => ({ Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' });

const PLATFORMS = ['Twitter','Instagram','Facebook','LinkedIn','Pinterest','TikTok','YouTube','WhatsApp'];

export default function ConnectionsPage() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ['connections'],
    queryFn: async () => {
      const r = await fetch('/api/connections', { headers: headers() });
      if (!r.ok) throw new Error('Failed to fetch connections');
      const j = await r.json(); return j.data || j;
    },
  });

  const disconnect = useMutation({
    mutationFn: async (id) => {
      const r = await fetch(`/api/connections/${id}`, { method: 'DELETE', headers: headers() });
      if (!r.ok) throw new Error('Failed to disconnect');
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['connections'] }),
  });

  // Surface the result of an OAuth round-trip (e.g. Google Business) and refresh.
  useEffect(() => {
    const p = new URLSearchParams(window.location.search);
    const ok = p.get('oauth_success'), err = p.get('oauth_error');
    if (!ok && !err) return;
    if (ok) { alert(`Connected ${ok}${p.get('connected') ? ` (${p.get('connected')} account(s))` : ''}.`); qc.invalidateQueries({ queryKey: ['connections'] }); }
    else { alert(`Connection failed: ${err}`); }
    window.history.replaceState({}, '', window.location.pathname);
  }, [qc]);

  const page = { padding: '2rem', maxWidth: '960px' };
  const card = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' };
  const btn = (variant) => ({ padding: '0.4rem 0.9rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: variant === 'danger' ? 'var(--danger)' : variant === 'accent' ? 'var(--accent)' : 'var(--surface2)', color: 'var(--text)', cursor: 'pointer', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.35rem' });
  const badge = (ok) => ({ padding: '0.2rem 0.6rem', borderRadius: '99px', fontSize: '0.75rem', background: ok ? 'rgba(34,197,94,0.15)' : 'var(--surface2)', color: ok ? 'var(--success)' : 'var(--text2)' });

  return (
    <div style={page}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <h1 style={{ color: 'var(--text)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Link2 size={22} /> Connections</h1>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <a href="/api/oauth/google_business/start" style={{ ...btn('default'), textDecoration: 'none' }}><Plus size={15} /> Connect Google Business</a>
          <a href="/api/auth/connect" style={{ ...btn('accent'), textDecoration: 'none' }}><Plus size={15} /> Add Connection</a>
        </div>
      </div>
      {isLoading && <p style={{ color: 'var(--text2)' }}>Loading…</p>}
      {error && <p style={{ color: 'var(--danger)' }}>{error.message}</p>}
      {data?.length === 0 && <p style={{ color: 'var(--text2)' }}>No connections yet.</p>}
      {data?.map(c => (
        <div key={c.id} style={card}>
          <div>
            <div style={{ fontWeight: 600, color: 'var(--text)' }}>{c.account_name || c.username}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text2)', marginTop: '0.2rem' }}>{c.platform}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={badge(c.status === 'active')}>{c.status || 'active'}</span>
            <button style={btn('danger')} onClick={() => disconnect.mutate(c.id)}><Trash2 size={13} /> Disconnect</button>
          </div>
        </div>
      ))}
      <div style={{ marginTop: '2rem' }}>
        <h2 style={{ color: 'var(--text)', fontSize: '1rem', marginBottom: '1rem' }}>Available Platforms</h2>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
          {PLATFORMS.map(p => (
            <button key={p} style={btn('default')} onClick={() => alert(`Connect ${p} — OAuth flow`)}>
              <Plus size={13} /> {p}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
