import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { MessageSquare, Plus, Trash2, Edit2 } from 'lucide-react';

const token = () => localStorage.getItem('fp_token');
const h = () => ({ Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' });

export default function CommentTemplatePage() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: '', content: '' });
  const [editing, setEditing] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['comment-templates'],
    queryFn: async () => { const r = await fetch('/api/comment-templates', { headers: h() }); const j = await r.json(); return j.data || j; },
  });

  const save = useMutation({
    mutationFn: async (payload) => {
      const url = editing ? `/api/comment-templates/${editing}` : '/api/comment-templates';
      const r = await fetch(url, { method: editing ? 'PUT' : 'POST', headers: h(), body: JSON.stringify(payload) });
      if (!r.ok) throw new Error('Save failed');
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['comment-templates'] }); setForm({ name: '', content: '' }); setEditing(null); },
  });

  const del = useMutation({
    mutationFn: async (id) => { await fetch(`/api/comment-templates/${id}`, { method: 'DELETE', headers: h() }); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['comment-templates'] }),
  });

  const startEdit = (t) => { setEditing(t.id); setForm({ name: t.name, content: t.content }); };

  const page = { padding: '2rem', maxWidth: '760px' };
  const input = { width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text)', padding: '0.6rem 0.75rem', fontSize: '0.9rem', boxSizing: 'border-box', marginBottom: '0.75rem' };
  const card = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1rem', marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' };
  const btn = (v) => ({ padding: '0.4rem 0.85rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: v === 'accent' ? 'var(--accent)' : v === 'danger' ? 'transparent' : 'var(--surface2)', color: v === 'danger' ? 'var(--danger)' : 'var(--text)', cursor: 'pointer', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' });

  return (
    <div style={page}>
      <h1 style={{ color: 'var(--text)', margin: '0 0 1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><MessageSquare size={22} /> Comment Templates</h1>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1.25rem', marginBottom: '1.5rem' }}>
        <h3 style={{ color: 'var(--text)', margin: '0 0 1rem' }}>{editing ? 'Edit Template' : 'New Template'}</h3>
        <input style={input} placeholder="Template name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        <textarea style={{ ...input, minHeight: '90px', resize: 'vertical' }} placeholder="Template content…" value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} />
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button style={btn('accent')} onClick={() => save.mutate(form)} disabled={save.isPending}><Plus size={14} />{editing ? 'Update' : 'Add'}</button>
          {editing && <button style={btn('default')} onClick={() => { setEditing(null); setForm({ name: '', content: '' }); }}>Cancel</button>}
        </div>
      </div>
      {isLoading && <p style={{ color: 'var(--text2)' }}>Loading…</p>}
      {data?.map(t => (
        <div key={t.id} style={card}>
          <div>
            <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: '0.3rem' }}>{t.name}</div>
            <div style={{ fontSize: '0.83rem', color: 'var(--text2)' }}>{t.content}</div>
          </div>
          <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0, marginLeft: '1rem' }}>
            <button style={btn('default')} onClick={() => startEdit(t)}><Edit2 size={13} /></button>
            <button style={btn('danger')} onClick={() => del.mutate(t.id)}><Trash2 size={13} /></button>
          </div>
        </div>
      ))}
    </div>
  );
}
