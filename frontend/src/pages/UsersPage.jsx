import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { UserCog, Plus, Trash2 } from 'lucide-react';

const token = () => localStorage.getItem('fp_token');
const h = () => ({ Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' });
const ROLES = ['admin', 'editor', 'viewer'];

export default function UsersPage() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ email: '', role: 'editor' });

  const { data, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: async () => { const r = await fetch('/api/users', { headers: h() }); const j = await r.json(); return j.data || j; },
  });

  const invite = useMutation({
    mutationFn: async (p) => { const r = await fetch('/api/users/invite', { method: 'POST', headers: h(), body: JSON.stringify(p) }); if (!r.ok) throw new Error('Invite failed'); },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['users'] }); setForm({ email: '', role: 'editor' }); },
  });

  const del = useMutation({
    mutationFn: async (id) => { await fetch(`/api/users/${id}`, { method: 'DELETE', headers: h() }); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['users'] }),
  });

  const page = { padding: '2rem', maxWidth: '900px' };
  const input = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text)', padding: '0.6rem 0.75rem', fontSize: '0.9rem' };
  const table = { width: '100%', borderCollapse: 'collapse', marginTop: '1.5rem' };
  const th = { textAlign: 'left', padding: '0.75rem 1rem', background: 'var(--surface)', color: 'var(--text2)', fontSize: '0.8rem', fontWeight: 600, borderBottom: '1px solid var(--border)' };
  const td = { padding: '0.75rem 1rem', borderBottom: '1px solid var(--border)', color: 'var(--text)', fontSize: '0.85rem' };
  const btn = (v) => ({ padding: '0.4rem 0.9rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: v === 'accent' ? 'var(--accent)' : 'transparent', color: v === 'danger' ? 'var(--danger)' : 'var(--text)', cursor: 'pointer', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' });
  const roleBadge = { padding: '0.18rem 0.55rem', borderRadius: '99px', fontSize: '0.72rem', background: 'var(--surface2)', color: 'var(--text2)' };

  return (
    <div style={page}>
      <h1 style={{ color: 'var(--text)', margin: '0 0 1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><UserCog size={22} /> Users</h1>
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <input style={{ ...input, flex: 1, minWidth: '200px' }} type="email" placeholder="Email address" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
        <select style={{ ...input }} value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
          {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        <button style={btn('accent')} onClick={() => invite.mutate(form)} disabled={invite.isPending || !form.email}><Plus size={14} />{invite.isPending ? 'Inviting…' : 'Invite User'}</button>
      </div>
      {invite.isError && <p style={{ color: 'var(--danger)', marginTop: '0.5rem' }}>{invite.error.message}</p>}
      {invite.isSuccess && <p style={{ color: 'var(--success)', marginTop: '0.5rem' }}>Invitation sent!</p>}
      {isLoading && <p style={{ color: 'var(--text2)', marginTop: '1rem' }}>Loading…</p>}
      <table style={table}>
        <thead><tr><th style={th}>Name</th><th style={th}>Email</th><th style={th}>Role</th><th style={th}>Joined</th><th style={th}></th></tr></thead>
        <tbody>
          {data?.map(u => (
            <tr key={u.id}>
              <td style={{ ...td, fontWeight: 600 }}>{u.name || '—'}</td>
              <td style={td}>{u.email}</td>
              <td style={td}><span style={roleBadge}>{u.role}</span></td>
              <td style={td}>{u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}</td>
              <td style={td}><button style={btn('danger')} onClick={() => del.mutate(u.id)}><Trash2 size={13} /></button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
