import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Magnet, Plus, Trash2 } from 'lucide-react';

const token = () => localStorage.getItem('fp_token');
const h = () => ({ Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' });

export default function LeadMagnetOptinPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: '', type: 'pdf', url: '' });
  const [open, setOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['lead-magnets'],
    queryFn: async () => { const r = await fetch('/api/lead-magnets', { headers: h() }); const j = await r.json(); return j.data || j; },
  });

  const create = useMutation({
    mutationFn: async (p) => { const r = await fetch('/api/lead-magnets', { method: 'POST', headers: h(), body: JSON.stringify(p) }); if (!r.ok) throw new Error('Failed'); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['lead-magnets'] }); setOpen(false); setForm({ name: '', type: 'pdf', url: '' }); },
  });

  const del = useMutation({
    mutationFn: async (id) => { await fetch(`/api/lead-magnets/${id}`, { method: 'DELETE', headers: h() }); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['lead-magnets'] }),
  });

  const page = { padding: '2rem', maxWidth: '900px' };
  const card = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1rem 1.25rem', marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
  const input = { width: '100%', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text)', padding: '0.55rem 0.75rem', fontSize: '0.88rem', boxSizing: 'border-box', marginBottom: '0.75rem' };
  const btn = (v) => ({ padding: '0.4rem 0.9rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: v === 'accent' ? 'var(--accent)' : 'transparent', color: v === 'danger' ? 'var(--danger)' : 'var(--text)', cursor: 'pointer', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' });
  const badge = { padding: '0.18rem 0.55rem', borderRadius: '99px', fontSize: '0.72rem', background: 'var(--surface2)', color: 'var(--text2)', marginLeft: '0.5rem' };

  return (
    <div style={page}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ color: 'var(--text)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Magnet size={22} /> Lead Magnets</h1>
        <button style={btn('accent')} onClick={() => setOpen(o => !o)}><Plus size={15} /> New Lead Magnet</button>
      </div>
      {open && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1.25rem', marginBottom: '1.5rem' }}>
          <input style={input} placeholder="Name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          <select style={input} value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
            <option value="pdf">PDF</option><option value="ebook">Ebook</option><option value="checklist">Checklist</option><option value="video">Video</option><option value="other">Other</option>
          </select>
          <input style={input} placeholder="URL (optional)" value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} />
          <button style={btn('accent')} onClick={() => create.mutate(form)} disabled={create.isPending}>{create.isPending ? 'Saving…' : 'Create'}</button>
        </div>
      )}
      {isLoading && <p style={{ color: 'var(--text2)' }}>Loading…</p>}
      {data?.map(m => (
        <div key={m.id} style={card}>
          <div>
            <span style={{ fontWeight: 600, color: 'var(--text)' }}>{m.name}</span>
            <span style={badge}>{m.type}</span>
            <div style={{ fontSize: '0.8rem', color: 'var(--text2)', marginTop: '0.25rem' }}>{m.conversions ?? 0} conversions</div>
          </div>
          <button style={btn('danger')} onClick={() => del.mutate(m.id)}><Trash2 size={13} /> Delete</button>
        </div>
      ))}
    </div>
  );
}
