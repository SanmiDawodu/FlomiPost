import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, Plus, Trash2 } from 'lucide-react';

const token = () => localStorage.getItem('fp_token');
const h = () => ({ Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' });
const FREQUENCIES = ['daily', 'weekly', 'biweekly', 'monthly'];

export default function RecyclePage() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ title: '', content: '', frequency: 'weekly' });
  const [open, setOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['recycle'],
    queryFn: async () => { const r = await fetch('/api/recycle', { headers: h() }); const j = await r.json(); return j.data || j; },
  });

  const create = useMutation({
    mutationFn: async (p) => { const r = await fetch('/api/recycle', { method: 'POST', headers: h(), body: JSON.stringify(p) }); if (!r.ok) throw new Error('Failed'); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['recycle'] }); setOpen(false); setForm({ title: '', content: '', frequency: 'weekly' }); },
  });

  const del = useMutation({
    mutationFn: async (id) => { await fetch(`/api/recycle/${id}`, { method: 'DELETE', headers: h() }); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recycle'] }),
  });

  const page = { padding: '2rem', maxWidth: '800px' };
  const input = { width: '100%', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text)', padding: '0.6rem 0.75rem', fontSize: '0.9rem', boxSizing: 'border-box', marginBottom: '0.75rem' };
  const card = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1rem 1.25rem', marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' };
  const btn = (v) => ({ padding: '0.4rem 0.9rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: v === 'accent' ? 'var(--accent)' : 'transparent', color: v === 'danger' ? 'var(--danger)' : 'var(--text)', cursor: 'pointer', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' });
  const freqBadge = { padding: '0.18rem 0.55rem', borderRadius: '99px', fontSize: '0.72rem', background: 'rgba(139,92,246,0.15)', color: 'var(--accent)' };

  return (
    <div style={page}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ color: 'var(--text)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}><RefreshCw size={22} /> Evergreen Recycle</h1>
        <button style={btn('accent')} onClick={() => setOpen(o => !o)}><Plus size={15} /> Add Post</button>
      </div>
      {open && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1.25rem', marginBottom: '1.5rem' }}>
          <input style={input} placeholder="Post title" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
          <textarea style={{ ...input, minHeight: '90px', resize: 'vertical' }} placeholder="Post content…" value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} />
          <select style={input} value={form.frequency} onChange={e => setForm(f => ({ ...f, frequency: e.target.value }))}>
            {FREQUENCIES.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
          <button style={btn('accent')} onClick={() => create.mutate(form)} disabled={create.isPending || !form.title}>{create.isPending ? 'Saving…' : 'Save'}</button>
        </div>
      )}
      {isLoading && <p style={{ color: 'var(--text2)' }}>Loading…</p>}
      {data?.map(p => (
        <div key={p.id} style={card}>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
              <span style={{ fontWeight: 600, color: 'var(--text)' }}>{p.title}</span>
              <span style={freqBadge}>{p.frequency}</span>
            </div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.content}</div>
          </div>
          <button style={{ ...btn('danger'), marginLeft: '1rem', flexShrink: 0 }} onClick={() => del.mutate(p.id)}><Trash2 size={13} /></button>
        </div>
      ))}
    </div>
  );
}
