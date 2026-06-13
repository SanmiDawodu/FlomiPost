import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Users, UserPlus, Trash2 } from 'lucide-react'

const tok = () => localStorage.getItem('fp_token')
const api = (url, opts={}) => fetch(url, {headers:{'Authorization':`Bearer ${tok()}`,'Content-Type':'application/json'},...opts}).then(r=>r.json())

export default function TeamPage() {
  const qc = useQueryClient()
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('editor')

  const { data, isLoading } = useQuery({ queryKey: ['team'], queryFn: () => api('/api/team') })

  const inviteMut = useMutation({
    mutationFn: (body) => api('/api/team/invite', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['team'] }); setInviteEmail('') }
  })

  const removeMut = useMutation({
    mutationFn: (id) => api(`/api/team/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['team'] })
  })

  const members = data?.members || data || []

  const roleColors = { admin: 'var(--accent)', editor: 'var(--success)', viewer: 'var(--text2)' }

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text)' }}>Team</h1>
      </div>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '20px', marginBottom: '24px' }}>
        <h3 style={{ color: 'var(--text)', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}><UserPlus size={18} /> Invite Team Member</h3>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="Email address" type="email" style={{ flex: 1, minWidth: '200px', padding: '8px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text)' }} />
          <select value={inviteRole} onChange={e => setInviteRole(e.target.value)} style={{ padding: '8px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text)' }}>
            <option value="admin">Admin</option>
            <option value="editor">Editor</option>
            <option value="viewer">Viewer</option>
          </select>
          <button onClick={() => inviteMut.mutate({ email: inviteEmail, role: inviteRole })} disabled={!inviteEmail || inviteMut.isPending} style={{ padding: '8px 16px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius)', cursor: 'pointer' }}>
            {inviteMut.isPending ? 'Sending...' : 'Send Invite'}
          </button>
        </div>
        {inviteMut.isSuccess && <p style={{ color: 'var(--success)', fontSize: '13px', marginTop: '8px' }}>Invite sent!</p>}
      </div>

      {isLoading ? <p style={{ color: 'var(--text2)' }}>Loading...</p> : (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
          {members.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text2)' }}>
              <Users size={36} style={{ margin: '0 auto 12px' }} />
              <p>No team members yet.</p>
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Name','Email','Role','Joined'].map(h => <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: '13px', color: 'var(--text2)', fontWeight: 600 }}>{h}</th>)}
                  <th style={{ padding: '12px 16px' }}></th>
                </tr>
              </thead>
              <tbody>
                {members.map(m => (
                  <tr key={m.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 16px', color: 'var(--text)' }}>{m.name || '—'}</td>
                    <td style={{ padding: '12px 16px', color: 'var(--text2)' }}>{m.email}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ padding: '2px 8px', borderRadius: '99px', fontSize: '12px', background: 'var(--bg2)', color: roleColors[m.role] || 'var(--text2)' }}>{m.role}</span>
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--text2)', fontSize: '13px' }}>{m.joined_at ? new Date(m.joined_at).toLocaleDateString() : '—'}</td>
                    <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                      <button onClick={() => removeMut.mutate(m.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)' }}><Trash2 size={15} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
