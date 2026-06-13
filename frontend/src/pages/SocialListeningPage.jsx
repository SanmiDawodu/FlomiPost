import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Radio, Plus, Trash2 } from 'lucide-react';

const token = () => localStorage.getItem('fp_token');
const h = () => ({ Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' });

export default function SocialListeningPage() {
  const qc = useQueryClient();
  const [keyword, setKeyword] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['listening'],
    queryFn: async () => { const r = await fetch('/api/listening', { headers: h() }); const j = await r.json(); return j.data || j; },
  });

  const add = useMutation({
    mutationFn: async (kw) => { const r = await fetch('/api/listening', { method: 'POST', headers: h(), body: JSON.stringify({ keyword: kw }) }); if (!r.ok) throw new Error('Failed'); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['listening'] }); setKeyword(''); },
  });

  const del = useMutation({
    mutationFn: async (id) => { await fetch(`/api/listening/${id}`, { method: 'DELETE', headers: h() }); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['listening'] }),
  });

  const page = { padding: '2rem', maxWidth: '800px' };
  const input = { flex: 1, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text)', padding: '0.6rem 0.75rem', fontSize: '0.9rem' };
  const card = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1rem 1.25rem', marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
  const btn = (v) => ({ padding: '0.4rem 0.9rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: v === 'accent' ? 'var(--accent)' : 'transparent', color: v === 'danger' ? 'var(--danger)' : 'var(--text)', cursor: 'pointer', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' });

  return (
    <div style={page}>
      <h1 style={{ color: 'var(--text)', margin: '0 0 1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Radio size={22} /> Social Listening</h1>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        <input style={input} placeholder="Add keyword to track…" value={keyword} onChange={e => setKeyword(e.target.value)} onKeyDown={e => e.key === 'Enter' && keyword && add.mutate(keyword)} />
        <button style={btn('accent')} onClick={() => keyword && add.mutate(keyword)} disabled={add.isPending || !keyword}><Plus size={14} /> Track</button>
      </div>
      {add.isError && <p style={{ color: 'var(--danger)', marginBottom: '1rem' }}>{add.error.message}</p>}
      {isLoading && <p style={{ color: 'var(--text2)' }}>Loading…</p>}
      {data?.length === 0 && <p style={{ color: 'var(--text2)' }}>No keywords tracked yet.</p>}
      {data?.map(k => (
        <div key={k.id} style={card}>
          <div>
            <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: '0.2rem' }}>#{k.keyword}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text2)' }}>{k.mentions_count ?? 0} mentions · last 30 days</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent)' }}>{k.mentions_count ?? 0}</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text2)' }}>mentions</div>
            </div>
            <button style={btn('danger')} onClick={() => del.mutate(k.id)}><Trash2 size={13} /></button>
          </div>
        </div>
      ))}
    </div>
  );
}
