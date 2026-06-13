import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { PenLine, Plus, Trash2, Star } from 'lucide-react'

const tok = () => localStorage.getItem('fp_token')
const api = (url, opts={}) => fetch(url, {headers:{'Authorization':`Bearer ${tok()}`,'Content-Type':'application/json'},...opts}).then(r=>r.json())

const PLATFORMS = ['Twitter','Instagram','Facebook','LinkedIn','Threads','TikTok']

export default function SignaturesPage() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', content: '', platforms: [] })

  const { data, isLoading } = useQuery({ queryKey: ['signatures'], queryFn: () => api('/api/signatures') })

  const createMut = useMutation({
    mutationFn: (body) => api('/api/signatures', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['signatures'] }); setForm({ name: '', content: '', platforms: [] }); setShowForm(false) }
  })

  const deleteMut = useMutation({
    mutationFn: (id) => api(`/api/signatures/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['signatures'] })
  })

  const defaultMut = useMutation({
    mutationFn: (id) => api(`/api/signatures/${id}/default`, { method: 'PUT' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['signatures'] })
  })

  const togglePlatform = (p) => setForm(f => ({
    ...f,
    platforms: f.platforms.includes(p) ? f.platforms.filter(x=>x!==p) : [...f.platforms, p]
  }))

  const sigs = data?.signatures || data || []

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text)' }}>Post Signatures</h1>
        <button onClick={() => setShowForm(!showForm)} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius)', cursor: 'pointer' }}>
          <Plus size={16} /> New Signature
        </button>
      </div>

      {showForm && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '20px', marginBottom: '24px' }}>
          <h3 style={{ color: 'var(--text)', marginBottom: '16px' }}>Create Signature</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <input value={form.name} onChange={e => setForm(f=>({...f,name:e.target.value}))} placeholder="Signature name" style={{ padding: '8px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text)' }} />
            <textarea value={form.content} onChange={e => setForm(f=>({...f,content:e.target.value}))} placeholder="Signature text (appended to posts)" rows={4} style={{ padding: '8px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text)', resize: 'vertical' }} />
            <div>
              <p style={{ color: 'var(--text2)', fontSize: '13px', marginBottom: '8px' }}>Platforms:</p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {PLATFORMS.map(p => (
                  <label key={p} style={{ display: 'flex', alignItems: 'center', gap: '4px', cursor: 'pointer', color: 'var(--text)', fontSize: '13px' }}>
                    <input type="checkbox" checked={form.platforms.includes(p)} onChange={() => togglePlatform(p)} />
                    {p}
                  </label>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={() => createMut.mutate(form)} disabled={!form.name || !form.content || createMut.isPending} style={{ padding: '8px 16px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius)', cursor: 'pointer' }}>
                {createMut.isPending ? 'Saving...' : 'Save Signature'}
              </button>
              <button onClick={() => setShowForm(false)} style={{ padding: '8px 16px', background: 'var(--bg2)', color: 'var(--text)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {isLoading ? <p style={{ color: 'var(--text2)' }}>Loading...</p> : sigs.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text2)' }}><PenLine size={48} style={{ margin: '0 auto 16px' }} /><p>No signatures yet.</p></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {sigs.map(sig => (
            <div key={sig.id} style={{ background: 'var(--surface)', border: `1px solid ${sig.is_default ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 'var(--radius)', padding: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3 style={{ color: 'var(--text)', fontWeight: 600 }}>{sig.name}</h3>
                    {sig.is_default && <span style={{ fontSize: '11px', background: 'var(--accent)', color: '#fff', padding: '1px 6px', borderRadius: '99px' }}>Default</span>}
                  </div>
                  <p style={{ color: 'var(--text2)', fontSize: '13px', marginTop: '4px', whiteSpace: 'pre-wrap' }}>{sig.content}</p>
                  {sig.platforms?.length > 0 && <p style={{ color: 'var(--text2)', fontSize: '12px', marginTop: '6px' }}>{sig.platforms.join(', ')}</p>}
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => defaultMut.mutate(sig.id)} title="Set as default" style={{ background: 'none', border: 'none', cursor: 'pointer', color: sig.is_default ? 'var(--accent)' : 'var(--text2)' }}><Star size={16} /></button>
                  <button onClick={() => deleteMut.mutate(sig.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)' }}><Trash2 size={16} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
