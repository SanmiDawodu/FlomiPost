import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Zap, Plus, Trash2, ToggleLeft, ToggleRight } from 'lucide-react'

const tok = () => localStorage.getItem('fp_token')
const api = (url, opts={}) => fetch(url, {headers:{'Authorization':`Bearer ${tok()}`,'Content-Type':'application/json'},...opts}).then(r=>r.json())

export default function AutoPostPage() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', rss_url: '', target_connections: '', schedule: 'hourly' })

  const { data, isLoading } = useQuery({ queryKey: ['auto-post'], queryFn: () => api('/api/auto-post') })
  const { data: connData } = useQuery({ queryKey: ['connections'], queryFn: () => api('/api/connections') })

  const createMut = useMutation({
    mutationFn: (body) => api('/api/auto-post', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['auto-post'] }); setForm({ name: '', rss_url: '', target_connections: '', schedule: 'hourly' }); setShowForm(false) }
  })

  const toggleMut = useMutation({
    mutationFn: ({ id, active }) => api(`/api/auto-post/${id}`, { method: 'PUT', body: JSON.stringify({ active }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['auto-post'] })
  })

  const deleteMut = useMutation({
    mutationFn: (id) => api(`/api/auto-post/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['auto-post'] })
  })

  const rules = data?.rules || data || []
  const connections = connData?.connections || connData || []

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text)' }}>Auto-Post Rules</h1>
        <button onClick={() => setShowForm(!showForm)} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius)', cursor: 'pointer' }}>
          <Plus size={16} /> New Rule
        </button>
      </div>

      {showForm && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '20px', marginBottom: '24px' }}>
          <h3 style={{ color: 'var(--text)', marginBottom: '16px' }}>Create Auto-Post Rule</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <input value={form.name} onChange={e => setForm(f=>({...f,name:e.target.value}))} placeholder="Rule name" style={{ padding: '8px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text)' }} />
            <input value={form.rss_url} onChange={e => setForm(f=>({...f,rss_url:e.target.value}))} placeholder="RSS Feed URL" style={{ padding: '8px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text)' }} />
            <select value={form.schedule} onChange={e => setForm(f=>({...f,schedule:e.target.value}))} style={{ padding: '8px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text)' }}>
              <option value="hourly">Every Hour</option>
              <option value="6h">Every 6 Hours</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
            </select>
            <select value={form.target_connections} onChange={e => setForm(f=>({...f,target_connections:e.target.value}))} style={{ padding: '8px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text)' }}>
              <option value="">Select connection</option>
              {connections.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
            <button onClick={() => createMut.mutate(form)} disabled={!form.name || createMut.isPending} style={{ padding: '8px 16px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius)', cursor: 'pointer' }}>
              {createMut.isPending ? 'Creating...' : 'Create Rule'}
            </button>
            <button onClick={() => setShowForm(false)} style={{ padding: '8px 16px', background: 'var(--bg2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', cursor: 'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      {isLoading ? <p style={{ color: 'var(--text2)' }}>Loading...</p> : rules.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text2)' }}>
          <Zap size={48} style={{ margin: '0 auto 16px' }} />
          <p>No auto-post rules yet.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {rules.map(rule => (
            <div key={rule.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <h3 style={{ color: 'var(--text)', fontWeight: 600 }}>{rule.name}</h3>
                <p style={{ color: 'var(--text2)', fontSize: '13px' }}>{rule.rss_url} · {rule.schedule}</p>
              </div>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <button onClick={() => toggleMut.mutate({ id: rule.id, active: !rule.active })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: rule.active ? 'var(--success)' : 'var(--text2)' }}>
                  {rule.active ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                </button>
                <button onClick={() => deleteMut.mutate(rule.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)' }}><Trash2 size={16} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
