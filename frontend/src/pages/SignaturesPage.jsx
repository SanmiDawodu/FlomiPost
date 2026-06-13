import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { PenTool, Plus, Trash2, Edit2 } from 'lucide-react';

const token = () => localStorage.getItem('fp_token');
const h = () => ({ Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' });

export default function SignaturesPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: '', content: '' });
  const [editing, setEditing] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['signatures'],
    queryFn: async () => { const r = await fetch('/api/signatures', { headers: h() }); const j = await r.json(); return j.data || j; },
  });

  const save = useMutation({
    mutationFn: async (p) => {
      const url = editing ? `/api/signatures/${editing}` : '/api/signatures';
      const r = await fetch(url, { method: editing ? 'PUT' : 'POST', headers: h(), body: JSON.stringify(p) });
      if (!r.ok) throw new Error('Save failed');
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['signatures'] }); setForm({ name: '', content: '' }); setEditing(null); },
  });

  const del = useMutation({
    mutationFn: async (id) => { await fetch(`/api/signatures/${id}`, { method: 'DELETE', headers: h() }); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['signatures'] }),
  });

  const page = { padding: '2rem', maxWidth: '760px' };
  const input = { width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text)', padding: '0.6rem 0.75rem', fontSize: '0.9rem', boxSizing: 'border-box', marginBottom: '0.75rem' };
  const card = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1rem 1.25rem', marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' };
  const btn = (v) => ({ padding: '0.4rem 0.85rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: v === 'accent' ? 'var(--accent)' : 'transparent', color: v === 'danger' ? 'var(--danger)' : 'var(--text)', cursor: 'pointer', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: '0.3rem' });

  return (
    <div style={page}>
      <h1 style={{ color: 'var(--text)', margin: '0 0 1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><PenTool size={22} /> Signatures</h1>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1.25rem', marginBottom: '1.5rem' }}>
        <h3 style={{ color: 'var(--text)', margin: '0 0 1rem' }}>{editing ? 'Edit Signature' : 'New Signature'}</h3>
        <input style={input} placeholder="Signature name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        <textarea style={{ ...input, minHeight: '100px', resize: 'vertical' }} placeholder="Signature content…" value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} />
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button style={btn('accent')} onClick={() => save.mutate(form)} disabled={save.isPending || !form.name}><Plus size={14} />{editing ? 'Update' : 'Add'}</button>
          {editing && <button style={btn('default')} onClick={() => { setEditing(null); setForm({ name: '', content: '' }); }}>Cancel</button>}
        </div>
      </div>
      {isLoading && <p style={{ color: 'var(--text2)' }}>Loading…</p>}
      {data?.map(s => (
        <div key={s.id} style={card}>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: '0.3rem' }}>{s.name}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.content}</div>
          </div>
          <div style={{ display: 'flex', gap: '0.4rem', flexShrink: 0, marginLeft: '1rem' }}>
            <button style={btn('default')} onClick={() => { setEditing(s.id); setForm({ name: s.name, content: s.content }); }}><Edit2 size={13} /></button>
            <button style={btn('danger')} onClick={() => del.mutate(s.id)}><Trash2 size={13} /></button>
          </div>
        </div>
      ))}
    </div>
  );
}
