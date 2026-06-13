import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Users, Shield } from 'lucide-react'

const tok = () => localStorage.getItem('fp_token')
const api = (url, opts={}) => fetch(url, {headers:{'Authorization':`Bearer ${tok()}`,'Content-Type':'application/json'},...opts}).then(r=>r.json())

export default function UsersPage() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['users'], queryFn: () => api('/api/users') })

  const updateRole = useMutation({
    mutationFn: ({ id, role }) => api(`/api/users/${id}`, { method: 'PUT', body: JSON.stringify({ role }) }),
    onSuccess: () => qc.invalidateQueries(['users'])
  })

  const users = data?.data || data || []

  const th = { textAlign: 'left', padding: '0.75rem 1rem', background: 'var(--surface)', color: 'var(--text2)', fontSize: '0.8rem', fontWeight: 600, borderBottom: '1px solid var(--border)' }
  const td = { padding: '0.7rem 1rem', borderBottom: '1px solid var(--border)', color: 'var(--text)', fontSize: '0.85rem' }
  const badge = (status) => ({ display: 'inline-block', padding: '2px 8px', borderRadius: 999, fontSize: '0.75rem', fontWeight: 600, background: status === 'active' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)', color: status === 'active' ? 'var(--success)' : 'var(--danger)' })

  return (
    <div style={{ padding: '2rem', maxWidth: 1000 }}>
      <h1 style={{ color: 'var(--text)', margin: '0 0 1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Users size={22} /> User Management
      </h1>
      {isLoading && <p style={{ color: 'var(--text2)' }}>Loading…</p>}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={th}>Name</th>
            <th style={th}>Email</th>
            <th style={th}>Role</th>
            <th style={th}>Status</th>
          </tr>
        </thead>
        <tbody>
          {users.map(u => (
            <tr key={u.id}>
              <td style={td}>{u.name || u.full_name || '—'}</td>
              <td style={td}>{u.email}</td>
              <td style={td}>
                <select
                  value={u.role}
                  onChange={e => updateRole.mutate({ id: u.id, role: e.target.value })}
                  style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text)', padding: '4px 8px', fontSize: '0.82rem' }}
                >
                  {['owner','admin','editor','viewer'].map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </td>
              <td style={td}><span style={badge(u.status)}>{u.status || 'active'}</span></td>
            </tr>
          ))}
          {!isLoading && users.length === 0 && (
            <tr><td colSpan={4} style={{ ...td, textAlign: 'center', color: 'var(--text2)' }}>No users found.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  )
}
