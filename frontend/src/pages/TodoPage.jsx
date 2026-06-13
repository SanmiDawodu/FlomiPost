import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckSquare, Plus, Trash2 } from 'lucide-react';

const token = () => localStorage.getItem('fp_token');
const h = () => ({ Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' });
const PRIORITIES = ['high', 'medium', 'low'];
const priorityColor = { high: 'var(--danger)', medium: '#f59e0b', low: 'var(--text2)' };

export default function TodoPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ title: '', priority: 'medium' });

  const { data, isLoading } = useQuery({
    queryKey: ['todos'],
    queryFn: async () => { const r = await fetch('/api/todos', { headers: h() }); const j = await r.json(); return j.data || j; },
  });

  const create = useMutation({
    mutationFn: async (p) => { const r = await fetch('/api/todos', { method: 'POST', headers: h(), body: JSON.stringify(p) }); if (!r.ok) throw new Error('Failed'); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['todos'] }); setForm({ title: '', priority: 'medium' }); },
  });

  const toggle = useMutation({
    mutationFn: async ({ id, done }) => { await fetch(`/api/todos/${id}`, { method: 'PATCH', headers: h(), body: JSON.stringify({ completed: done }) }); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['todos'] }),
  });

  const del = useMutation({
    mutationFn: async (id) => { await fetch(`/api/todos/${id}`, { method: 'DELETE', headers: h() }); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['todos'] }),
  });

  const page = { padding: '2rem', maxWidth: '700px' };
  const input = { flex: 1, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text)', padding: '0.6rem 0.75rem', fontSize: '0.9rem' };
  const btn = (v) => ({ padding: '0.4rem 0.9rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: v === 'accent' ? 'var(--accent)' : 'transparent', color: v === 'danger' ? 'var(--danger)' : 'var(--text)', cursor: 'pointer', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' });
  const item = (done) => ({ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.75rem 1rem', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', marginBottom: '0.5rem', opacity: done ? 0.6 : 1 });

  return (
    <div style={page}>
      <h1 style={{ color: 'var(--text)', margin: '0 0 1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><CheckSquare size={22} /> Tasks</h1>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        <input style={input} placeholder="New task…" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} onKeyDown={e => e.key === 'Enter' && create.mutate(form)} />
        <select style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text)', padding: '0.6rem 0.5rem', fontSize: '0.85rem' }} value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}>
          {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <button style={btn('accent')} onClick={() => create.mutate(form)} disabled={!form.title}><Plus size={14} /> Add</button>
      </div>
      {isLoading && <p style={{ color: 'var(--text2)' }}>Loading…</p>}
      {data?.map(t => (
        <div key={t.id} style={item(t.completed)}>
          <input type="checkbox" checked={!!t.completed} onChange={e => toggle.mutate({ id: t.id, done: e.target.checked })} style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: 'var(--accent)' }} />
          <span style={{ flex: 1, color: 'var(--text)', textDecoration: t.completed ? 'line-through' : 'none', fontSize: '0.9rem' }}>{t.title}</span>
          <span style={{ fontSize: '0.72rem', fontWeight: 600, color: priorityColor[t.priority] || 'var(--text2)', textTransform: 'uppercase' }}>{t.priority}</span>
          <button style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)', padding: '0.2rem' }} onClick={() => del.mutate(t.id)}><Trash2 size={14} /></button>
        </div>
      ))}
    </div>
  );
}
