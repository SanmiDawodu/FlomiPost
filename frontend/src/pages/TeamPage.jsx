import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { UsersRound, Plus, Trash2 } from 'lucide-react';

const token = () => localStorage.getItem('fp_token');
const h = () => ({ Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' });
const ROLES = ['admin', 'manager', 'editor', 'viewer'];

export default function TeamPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ email: '', role: 'editor' });

  const { data, isLoading } = useQuery({
    queryKey: ['team'],
    queryFn: async () => { const r = await fetch('/api/team', { headers: h() }); const j = await r.json(); return j.data || j; },
  });

  const invite = useMutation({
    mutationFn: async (p) => { const r = await fetch('/api/team/invite', { method: 'POST', headers: h(), body: JSON.stringify(p) }); if (!r.ok) throw new Error('Failed'); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['team'] }); setForm({ email: '', role: 'editor' }); },
  });

  const remove = useMutation({
    mutationFn: async (id) => { await fetch(`/api/team/${id}`, { method: 'DELETE', headers: h() }); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['team'] }),
  });

  const page = { padding: '2rem', maxWidth: '800px' };
  const input = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text)', padding: '0.6rem 0.75rem', fontSize: '0.9rem' };
  const card = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1rem 1.25rem', marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
  const btn = (v) => ({ padding: '0.4rem 0.9rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: v === 'accent' ? 'var(--accent)' : 'transparent', color: v === 'danger' ? 'var(--danger)' : 'var(--text)', cursor: 'pointer', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' });
  const avatar = (name) => ({ width: '36px', height: '36px', borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text)', fontWeight: 700, fontSize: '0.9rem', flexShrink: 0 });

  return (
    <div style={page}>
      <h1 style={{ color: 'var(--text)', margin: '0 0 1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><UsersRound size={22} /> Team</h1>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1.25rem', marginBottom: '1.5rem' }}>
        <h3 style={{ color: 'var(--text)', margin: '0 0 1rem' }}>Invite Team Member</h3>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <input style={{ ...input, flex: 1, minWidth: '200px' }} type="email" placeholder="Email address" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
          <select style={input} value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <button style={btn('accent')} onClick={() => invite.mutate(form)} disabled={invite.isPending || !form.email}><Plus size={14} />{invite.isPending ? 'Inviting…' : 'Invite'}</button>
        </div>
        {invite.isError && <p style={{ color: 'var(--danger)', marginTop: '0.5rem', fontSize: '0.82rem' }}>{invite.error.message}</p>}
        {invite.isSuccess && <p style={{ color: 'var(--success)', marginTop: '0.5rem', fontSize: '0.82rem' }}>Invite sent!</p>}
      </div>
      {isLoading && <p style={{ color: 'var(--text2)' }}>Loading…</p>}
      {data?.map(m => (
        <div key={m.id} style={card}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={avatar(m.name || m.email)}>{(m.name || m.email || '?')[0].toUpperCase()}</div>
            <div>
              <div style={{ fontWeight: 600, color: 'var(--text)' }}>{m.name || m.email}</div>
              {m.name && <div style={{ fontSize: '0.8rem', color: 'var(--text2)' }}>{m.email}</div>}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text2)', background: 'var(--surface2)', padding: '0.18rem 0.55rem', borderRadius: '99px' }}>{m.role}</span>
            <button style={btn('danger')} onClick={() => remove.mutate(m.id)}><Trash2 size={13} /></button>
          </div>
        </div>
      ))}
    </div>
  );
}
