import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Mic, Plus, Trash2 } from 'lucide-react';

const token = () => localStorage.getItem('fp_token');
const h = () => ({ Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' });

export default function VoiceLearningPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ name: '', sample_text: '' });

  const { data, isLoading } = useQuery({
    queryKey: ['voice-profiles'],
    queryFn: async () => { const r = await fetch('/api/voice-profiles', { headers: h() }); const j = await r.json(); return j.data || j; },
  });

  const create = useMutation({
    mutationFn: async (p) => { const r = await fetch('/api/voice-profiles', { method: 'POST', headers: h(), body: JSON.stringify(p) }); if (!r.ok) throw new Error('Failed'); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['voice-profiles'] }); setForm({ name: '', sample_text: '' }); },
  });

  const del = useMutation({
    mutationFn: async (id) => { await fetch(`/api/voice-profiles/${id}`, { method: 'DELETE', headers: h() }); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['voice-profiles'] }),
  });

  const page = { padding: '2rem', maxWidth: '760px' };
  const input = { width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text)', padding: '0.6rem 0.75rem', fontSize: '0.9rem', boxSizing: 'border-box', marginBottom: '0.75rem' };
  const card = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1rem 1.25rem', marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' };
  const btn = (v) => ({ padding: '0.4rem 0.9rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: v === 'accent' ? 'var(--accent)' : 'transparent', color: v === 'danger' ? 'var(--danger)' : 'var(--text)', cursor: 'pointer', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' });

  return (
    <div style={page}>
      <h1 style={{ color: 'var(--text)', margin: '0 0 1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Mic size={22} /> Brand Voice Learning</h1>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1.25rem', marginBottom: '1.5rem' }}>
        <h3 style={{ color: 'var(--text)', margin: '0 0 1rem' }}>Add Brand Voice Profile</h3>
        <input style={input} placeholder="Voice profile name (e.g. Friendly, Professional)" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        <textarea style={{ ...input, minHeight: '130px', resize: 'vertical' }} placeholder="Paste sample text that represents this brand voice…" value={form.sample_text} onChange={e => setForm(f => ({ ...f, sample_text: e.target.value }))} />
        <button style={btn('accent')} onClick={() => create.mutate(form)} disabled={create.isPending || !form.name}><Plus size={14} />{create.isPending ? 'Saving…' : 'Add Profile'}</button>
        {create.isError && <span style={{ color: 'var(--danger)', marginLeft: '0.75rem', fontSize: '0.82rem' }}>{create.error.message}</span>}
      </div>
      <h2 style={{ color: 'var(--text)', fontSize: '1rem', marginBottom: '1rem' }}>Saved Profiles</h2>
      {isLoading && <p style={{ color: 'var(--text2)' }}>Loading…</p>}
      {data?.length === 0 && <p style={{ color: 'var(--text2)' }}>No profiles yet.</p>}
      {data?.map(v => (
        <div key={v.id} style={card}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: '0.3rem' }}>{v.name}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text2)', maxHeight: '60px', overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.sample_text}</div>
          </div>
          <button style={{ ...btn('danger'), marginLeft: '1rem', flexShrink: 0 }} onClick={() => del.mutate(v.id)}><Trash2 size={13} /></button>
        </div>
      ))}
    </div>
  );
}
