import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Globe, Plus, Trash2, ExternalLink } from 'lucide-react';

const token = () => localStorage.getItem('fp_token');
const h = () => ({ Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' });

export default function SitesPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: '', url: '' });
  const [open, setOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['sites'],
    queryFn: async () => { const r = await fetch('/api/sites', { headers: h() }); const j = await r.json(); return j.data || j; },
  });

  const create = useMutation({
    mutationFn: async (p) => { const r = await fetch('/api/sites', { method: 'POST', headers: h(), body: JSON.stringify(p) }); if (!r.ok) throw new Error('Failed'); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sites'] }); setOpen(false); setForm({ name: '', url: '' }); },
  });

  const del = useMutation({
    mutationFn: async (id) => { await fetch(`/api/sites/${id}`, { method: 'DELETE', headers: h() }); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sites'] }),
  });

  const page = { padding: '2rem', maxWidth: '1000px' };
  const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1rem', marginTop: '1.5rem' };
  const card = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' };
  const input = { width: '100%', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text)', padding: '0.55rem 0.75rem', fontSize: '0.88rem', boxSizing: 'border-box', marginBottom: '0.75rem' };
  const btn = (v) => ({ padding: '0.4rem 0.9rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: v === 'accent' ? 'var(--accent)' : 'transparent', color: v === 'danger' ? 'var(--danger)' : 'var(--text)', cursor: 'pointer', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' });

  return (
    <div style={page}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ color: 'var(--text)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Globe size={22} /> Sites</h1>
        <button style={btn('accent')} onClick={() => setOpen(o => !o)}><Plus size={15} /> Add Site</button>
      </div>
      {open && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1.25rem', marginTop: '1.25rem' }}>
          <input style={input} placeholder="Site name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          <input style={input} type="url" placeholder="https://yoursite.com" value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} />
          <button style={btn('accent')} onClick={() => create.mutate(form)} disabled={create.isPending || !form.name}>{create.isPending ? 'Saving…' : 'Create'}</button>
        </div>
      )}
      {isLoading && <p style={{ color: 'var(--text2)', marginTop: '1rem' }}>Loading…</p>}
      <div style={grid}>
        {data?.map(s => (
          <div key={s.id} style={card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ fontWeight: 700, color: 'var(--text)', fontSize: '1rem' }}>{s.name}</div>
              <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: 0 }} onClick={() => del.mutate(s.id)}><Trash2 size={14} /></button>
            </div>
            {s.url && <a href={s.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.25rem', textDecoration: 'none' }}><ExternalLink size={12} />{s.url}</a>}
            <div style={{ fontSize: '0.8rem', color: 'var(--text2)' }}>{s.post_count ?? 0} posts</div>
          </div>
        ))}
      </div>
    </div>
  );
}
