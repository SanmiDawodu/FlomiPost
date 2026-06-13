import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Tag, Plus, Trash2 } from 'lucide-react';

const token = () => localStorage.getItem('fp_token');
const h = () => ({ Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' });
const PRESET_COLORS = ['#8b5cf6','#3b82f6','#10b981','#f59e0b','#ef4444','#ec4899','#06b6d4','#84cc16'];

export default function LabelsPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: '', color: '#8b5cf6' });

  const { data, isLoading } = useQuery({
    queryKey: ['labels'],
    queryFn: async () => { const r = await fetch('/api/labels', { headers: h() }); const j = await r.json(); return j.data || j; },
  });

  const create = useMutation({
    mutationFn: async (p) => { const r = await fetch('/api/labels', { method: 'POST', headers: h(), body: JSON.stringify(p) }); if (!r.ok) throw new Error('Failed'); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['labels'] }); setForm({ name: '', color: '#8b5cf6' }); },
  });

  const del = useMutation({
    mutationFn: async (id) => { await fetch(`/api/labels/${id}`, { method: 'DELETE', headers: h() }); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['labels'] }),
  });

  const page = { padding: '2rem', maxWidth: '700px' };
  const input = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text)', padding: '0.6rem 0.75rem', fontSize: '0.9rem' };
  const btn = (v) => ({ padding: '0.4rem 0.9rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: v === 'accent' ? 'var(--accent)' : 'transparent', color: v === 'danger' ? 'var(--danger)' : 'var(--text)', cursor: 'pointer', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' });

  return (
    <div style={page}>
      <h1 style={{ color: 'var(--text)', margin: '0 0 1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Tag size={22} /> Labels</h1>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1.25rem', marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <input style={{ ...input, flex: 1, minWidth: '150px' }} placeholder="Label name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          <div style={{ display: 'flex', gap: '0.3rem', flexWrap: 'wrap' }}>
            {PRESET_COLORS.map(c => (
              <button key={c} onClick={() => setForm(f => ({ ...f, color: c }))} style={{ width: '24px', height: '24px', borderRadius: '50%', background: c, border: form.color === c ? '3px solid white' : '2px solid transparent', cursor: 'pointer', padding: 0 }} />
            ))}
          </div>
          <button style={btn('accent')} onClick={() => create.mutate(form)} disabled={create.isPending || !form.name}><Plus size={14} /> Add</button>
        </div>
      </div>
      {isLoading && <p style={{ color: 'var(--text2)' }}>Loading…</p>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
        {data?.map(l => (
          <div key={l.id} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', padding: '0.3rem 0.75rem 0.3rem 0.5rem', borderRadius: '99px', background: `${l.color}22`, border: `1px solid ${l.color}44` }}>
            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: l.color, flexShrink: 0 }} />
            <span style={{ color: l.color, fontSize: '0.85rem', fontWeight: 600 }}>{l.name}</span>
            <button onClick={() => del.mutate(l.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: l.color, padding: 0, display: 'flex', alignItems: 'center', opacity: 0.7 }}><Trash2 size={12} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}
