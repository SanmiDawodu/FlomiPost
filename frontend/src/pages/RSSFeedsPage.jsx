import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Rss, Plus, Trash2, RefreshCw } from 'lucide-react';

const token = () => localStorage.getItem('fp_token');
const h = () => ({ Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' });

export default function RSSFeedsPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: '', url: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['rss-feeds'],
    queryFn: async () => { const r = await fetch('/api/rss-feeds', { headers: h() }); const j = await r.json(); return j.data || j; },
  });

  const create = useMutation({
    mutationFn: async (p) => { const r = await fetch('/api/rss-feeds', { method: 'POST', headers: h(), body: JSON.stringify(p) }); if (!r.ok) throw new Error('Failed'); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['rss-feeds'] }); setForm({ name: '', url: '' }); },
  });

  const del = useMutation({
    mutationFn: async (id) => { await fetch(`/api/rss-feeds/${id}`, { method: 'DELETE', headers: h() }); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rss-feeds'] }),
  });

  const refresh = useMutation({
    mutationFn: async (id) => { await fetch(`/api/rss-feeds/${id}/fetch`, { method: 'POST', headers: h() }); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rss-feeds'] }),
  });

  const page = { padding: '2rem', maxWidth: '800px' };
  const input = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text)', padding: '0.6rem 0.75rem', fontSize: '0.9rem' };
  const card = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1rem 1.25rem', marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
  const btn = (v) => ({ padding: '0.4rem 0.85rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: v === 'accent' ? 'var(--accent)' : 'transparent', color: v === 'danger' ? 'var(--danger)' : 'var(--text)', cursor: 'pointer', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' });

  return (
    <div style={page}>
      <h1 style={{ color: 'var(--text)', margin: '0 0 1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Rss size={22} /> RSS Feeds</h1>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <input style={{ ...input, minWidth: '140px' }} placeholder="Feed name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        <input style={{ ...input, flex: 1, minWidth: '200px' }} type="url" placeholder="https://example.com/feed.xml" value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} />
        <button style={btn('accent')} onClick={() => create.mutate(form)} disabled={create.isPending || !form.url}><Plus size={14} />{create.isPending ? 'Adding…' : 'Add Feed'}</button>
      </div>
      {create.isError && <p style={{ color: 'var(--danger)', marginBottom: '1rem' }}>{create.error.message}</p>}
      {isLoading && <p style={{ color: 'var(--text2)' }}>Loading…</p>}
      {data?.length === 0 && <p style={{ color: 'var(--text2)' }}>No RSS feeds yet.</p>}
      {data?.map(feed => (
        <div key={feed.id} style={card}>
          <div>
            <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: '0.2rem' }}>{feed.name}</div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text2)' }}>{feed.url}</div>
            {feed.last_fetched && <div style={{ fontSize: '0.75rem', color: 'var(--text2)', marginTop: '0.2rem' }}>Last fetched: {new Date(feed.last_fetched).toLocaleString()}</div>}
          </div>
          <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0, marginLeft: '1rem' }}>
            <button style={btn('default')} onClick={() => refresh.mutate(feed.id)} title="Refresh"><RefreshCw size={13} /></button>
            <button style={btn('danger')} onClick={() => del.mutate(feed.id)}><Trash2 size={13} /></button>
          </div>
        </div>
      ))}
    </div>
  );
}
