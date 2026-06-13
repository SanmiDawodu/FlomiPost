import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Send, Plus, Trash2 } from 'lucide-react';

const token = () => localStorage.getItem('fp_token');
const h = () => ({ Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' });

export default function LeadOutreachPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: '', platform: '', steps: 3 });
  const [open, setOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['lead-outreach'],
    queryFn: async () => { const r = await fetch('/api/lead-outreach', { headers: h() }); const j = await r.json(); return j.data || j; },
  });

  const create = useMutation({
    mutationFn: async (p) => { const r = await fetch('/api/lead-outreach', { method: 'POST', headers: h(), body: JSON.stringify(p) }); if (!r.ok) throw new Error('Failed'); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['lead-outreach'] }); setOpen(false); setForm({ name: '', platform: '', steps: 3 }); },
  });

  const del = useMutation({
    mutationFn: async (id) => { await fetch(`/api/lead-outreach/${id}`, { method: 'DELETE', headers: h() }); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lead-outreach'] }),
  });

  const page = { padding: '2rem', maxWidth: '900px' };
  const card = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1rem 1.25rem', marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
  const input = { width: '100%', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text)', padding: '0.55rem 0.75rem', fontSize: '0.88rem', boxSizing: 'border-box', marginBottom: '0.75rem' };
  const btn = (v) => ({ padding: '0.4rem 0.9rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: v === 'accent' ? 'var(--accent)' : 'transparent', color: v === 'danger' ? 'var(--danger)' : 'var(--text)', cursor: 'pointer', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' });
  const badge = (s) => ({ padding: '0.18rem 0.55rem', borderRadius: '99px', fontSize: '0.72rem', background: s === 'active' ? 'rgba(34,197,94,0.15)' : 'var(--surface2)', color: s === 'active' ? 'var(--success)' : 'var(--text2)' });

  return (
    <div style={page}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ color: 'var(--text)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Send size={22} /> Lead Outreach</h1>
        <button style={btn('accent')} onClick={() => setOpen(o => !o)}><Plus size={15} /> New Sequence</button>
      </div>
      {open && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1.25rem', marginBottom: '1.5rem' }}>
          <input style={input} placeholder="Sequence name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          <input style={input} placeholder="Platform (LinkedIn, Email…)" value={form.platform} onChange={e => setForm(f => ({ ...f, platform: e.target.value }))} />
          <input style={input} type="number" min={1} placeholder="Number of steps" value={form.steps} onChange={e => setForm(f => ({ ...f, steps: Number(e.target.value) }))} />
          <button style={btn('accent')} onClick={() => create.mutate(form)} disabled={create.isPending || !form.name}>{create.isPending ? 'Saving…' : 'Create Sequence'}</button>
        </div>
      )}
      {isLoading && <p style={{ color: 'var(--text2)' }}>Loading…</p>}
      {data?.map(s => (
        <div key={s.id} style={card}>
          <div>
            <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: '0.2rem' }}>{s.name}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text2)' }}>{s.platform} · {s.steps_count ?? s.steps ?? 0} steps</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={badge(s.status)}>{s.status || 'draft'}</span>
            <button style={btn('danger')} onClick={() => del.mutate(s.id)}><Trash2 size={13} /></button>
          </div>
        </div>
      ))}
    </div>
  );
}
