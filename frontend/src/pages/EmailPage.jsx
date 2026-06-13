import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Mail, Plus, Send, FileText } from 'lucide-react'

const tok = () => localStorage.getItem('fp_token')
const api = (url, opts={}) => fetch(url, {headers:{'Authorization':`Bearer ${tok()}`,'Content-Type':'application/json'},...opts}).then(r=>r.json())

export default function EmailPage() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', subject: '', body: '' })

  const { data, isLoading } = useQuery({ queryKey: ['email-campaigns'], queryFn: () => api('/api/email-campaigns') })

  const create = useMutation({
    mutationFn: () => api('/api/email-campaigns', { method: 'POST', body: JSON.stringify(form) }),
    onSuccess: () => { qc.invalidateQueries(['email-campaigns']); setShowForm(false); setForm({ name: '', subject: '', body: '' }) }
  })

  const campaigns = data?.data || data || []
  const th = { textAlign: 'left', padding: '0.75rem 1rem', background: 'var(--surface)', color: 'var(--text2)', fontSize: '0.8rem', fontWeight: 600, borderBottom: '1px solid var(--border)' }
  const td = { padding: '0.7rem 1rem', borderBottom: '1px solid var(--border)', color: 'var(--text)', fontSize: '0.85rem' }
  const inp = { width: '100%', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text)', padding: '0.6rem 0.75rem', fontSize: '0.9rem', boxSizing: 'border-box', marginBottom: '0.75rem' }

  const statusColor = (s) => ({ draft: 'var(--text2)', scheduled: 'var(--accent)', sent: 'var(--success)', failed: 'var(--danger)' }[s] || 'var(--text2)')

  return (
    <div style={{ padding: '2rem', maxWidth: 1000 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h1 style={{ color: 'var(--text)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Mail size={22} /> Email Campaigns</h1>
        <button onClick={() => setShowForm(v => !v)} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius)', padding: '8px 16px', cursor: 'pointer', fontWeight: 600 }}>
          <Plus size={16} /> Create Campaign
        </button>
      </div>

      {showForm && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1.25rem', marginBottom: '1.5rem' }}>
          <h3 style={{ color: 'var(--text)', margin: '0 0 1rem' }}>New Campaign</h3>
          <input style={inp} placeholder="Campaign name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          <input style={inp} placeholder="Subject line" value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} />
          <textarea style={{ ...inp, minHeight: 100, resize: 'vertical' }} placeholder="Email body…" value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} />
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button onClick={() => create.mutate()} disabled={create.isPending} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius)', padding: '8px 16px', cursor: 'pointer', fontWeight: 600 }}>
              <Send size={14} /> {create.isPending ? 'Saving…' : 'Save Draft'}
            </button>
            <button onClick={() => setShowForm(false)} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text)', padding: '8px 16px', cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      {isLoading && <p style={{ color: 'var(--text2)' }}>Loading…</p>}
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th style={th}>Name</th>
            <th style={th}>Subject</th>
            <th style={th}>Status</th>
            <th style={th}>Sent</th>
            <th style={th}>Open Rate</th>
          </tr>
        </thead>
        <tbody>
          {campaigns.map(c => (
            <tr key={c.id}>
              <td style={td}>{c.name}</td>
              <td style={td}>{c.subject || '—'}</td>
              <td style={td}><span style={{ color: statusColor(c.status), fontWeight: 600, fontSize: '0.8rem' }}>{c.status || 'draft'}</span></td>
              <td style={td}>{c.sent_count ?? 0}</td>
              <td style={td}>{c.open_rate ? `${c.open_rate}%` : '—'}</td>
            </tr>
          ))}
          {!isLoading && campaigns.length === 0 && <tr><td colSpan={5} style={{ ...td, textAlign: 'center', color: 'var(--text2)' }}>No campaigns yet.</td></tr>}
        </tbody>
      </table>
    </div>
  )
}
