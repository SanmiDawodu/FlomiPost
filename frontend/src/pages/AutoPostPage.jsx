import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Repeat, Plus, Trash2, Edit2 } from 'lucide-react';

const token = () => localStorage.getItem('fp_token');
const h = () => ({ Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' });

export default function AutoPostPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: '', platform: '', schedule: 'daily' });
  const [editing, setEditing] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['auto-post'],
    queryFn: async () => { const r = await fetch('/api/auto-post', { headers: h() }); const j = await r.json(); return j.data || j; },
  });

  const save = useMutation({
    mutationFn: async (p) => {
      const url = editing ? `/api/auto-post/${editing}` : '/api/auto-post';
      const r = await fetch(url, { method: editing ? 'PUT' : 'POST', headers: h(), body: JSON.stringify(p) });
      if (!r.ok) throw new Error('Save failed');
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['auto-post'] }); setForm({ name: '', platform: '', schedule: 'daily' }); setEditing(null); },
  });

  const del = useMutation({
    mutationFn: async (id) => { await fetch(`/api/auto-post/${id}`, { method: 'DELETE', headers: h() }); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['auto-post'] }),
  });

  const page = { padding: '2rem', maxWidth: '800px' };
  const input = { width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text)', padding: '0.6rem 0.75rem', fontSize: '0.9rem', boxSizing: 'border-box', marginBottom: '0.75rem' };
  const card = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1rem 1.25rem', marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
  const btn = (v) => ({ padding: '0.4rem 0.85rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: v === 'accent' ? 'var(--accent)' : 'transparent', color: v === 'danger' ? 'var(--danger)' : 'var(--text)', cursor: 'pointer', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' });

  return (
    <div style={page}>
      <h1 style={{ color: 'var(--text)', margin: '0 0 1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Repeat size={22} /> Auto-Post Rules</h1>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1.25rem', marginBottom: '1.5rem' }}>
        <h3 style={{ color: 'var(--text)', margin: '0 0 1rem' }}>{editing ? 'Edit Rule' : 'New Rule'}</h3>
        <input style={input} placeholder="Rule name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        <input style={input} placeholder="Platform (Twitter, Instagram…)" value={form.platform} onChange={e => setForm(f => ({ ...f, platform: e.target.value }))} />
        <select style={input} value={form.schedule} onChange={e => setForm(f => ({ ...f, schedule: e.target.value }))}>
          <option value="hourly">Hourly</option>
          <option value="daily">Daily</option>
          <option value="weekly">Weekly</option>
          <option value="monthly">Monthly</option>
        </select>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button style={btn('accent')} onClick={() => save.mutate(form)} disabled={save.isPending || !form.name}><Plus size={14} />{editing ? 'Update' : 'Create Rule'}</button>
          {editing && <button style={btn('default')} onClick={() => { setEditing(null); setForm({ name: '', platform: '', schedule: 'daily' }); }}>Cancel</button>}
        </div>
      </div>
      {isLoading && <p style={{ color: 'var(--text2)' }}>Loading…</p>}
      {data?.map(r => (
        <div key={r.id} style={card}>
          <div>
            <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: '0.2rem' }}>{r.name}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text2)' }}>{r.platform} · {r.schedule}</div>
          </div>
          <div style={{ display: 'flex', gap: '0.4rem' }}>
            <button style={btn('default')} onClick={() => { setEditing(r.id); setForm({ name: r.name, platform: r.platform, schedule: r.schedule }); }}><Edit2 size={13} /></button>
            <button style={btn('danger')} onClick={() => del.mutate(r.id)}><Trash2 size={13} /></button>
          </div>
        </div>
      ))}
    </div>
  );
}
