import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Sparkles, Plus, Zap, Calendar } from 'lucide-react'

const tok = () => localStorage.getItem('fp_token')
const api = (url, opts={}) => fetch(url, {headers:{'Authorization':`Bearer ${tok()}`,'Content-Type':'application/json'},...opts}).then(r=>r.json())

export default function AISchedulePage() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ topic: '', tone: 'professional', days: 7, post_times: '09:00,12:00,18:00', connection_ids: '' })
  const [generating, setGenerating] = useState(null)

  const { data, isLoading } = useQuery({ queryKey: ['ai-calendars'], queryFn: () => api('/api/ai-calendars') })
  const { data: connData } = useQuery({ queryKey: ['connections'], queryFn: () => api('/api/connections') })

  const createMut = useMutation({
    mutationFn: async (body) => {
      const cal = await api('/api/ai-calendars', { method: 'POST', body: JSON.stringify(body) })
      return cal
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['ai-calendars'] }); setForm({ topic: '', tone: 'professional', days: 7, post_times: '09:00,12:00,18:00', connection_ids: '' }); setShowForm(false) }
  })

  const generateMut = useMutation({
    mutationFn: (id) => api(`/api/ai-calendars/${id}/generate`, { method: 'POST' }),
    onMutate: (id) => setGenerating(id),
    onSettled: () => { setGenerating(null); qc.invalidateQueries({ queryKey: ['ai-calendars'] }) }
  })

  const calendars = data?.calendars || data || []
  const connections = connData?.connections || connData || []

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text)', display: 'flex', alignItems: 'center', gap: '10px' }}><Sparkles size={24} color="var(--accent)" /> AI Content Calendar</h1>
          <p style={{ color: 'var(--text2)', fontSize: '14px' }}>Generate a full content calendar with AI.</p>
        </div>
        <button onClick={() => setShowForm(!showForm)} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius)', cursor: 'pointer' }}>
          <Plus size={16} /> New Calendar
        </button>
      </div>

      {showForm && (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '20px', marginBottom: '24px' }}>
          <h3 style={{ color: 'var(--text)', marginBottom: '16px' }}>Create AI Calendar</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <input value={form.topic} onChange={e=>setForm(f=>({...f,topic:e.target.value}))} placeholder="Topic / niche (e.g. SaaS marketing)" style={{ padding:'8px 12px', background:'var(--bg)', border:'1px solid var(--border)', borderRadius:'var(--radius)', color:'var(--text)', gridColumn:'1/-1' }} />
            <select value={form.tone} onChange={e=>setForm(f=>({...f,tone:e.target.value}))} style={{ padding:'8px 12px', background:'var(--bg)', border:'1px solid var(--border)', borderRadius:'var(--radius)', color:'var(--text)' }}>
              <option value="professional">Professional</option>
              <option value="casual">Casual</option>
              <option value="humorous">Humorous</option>
              <option value="educational">Educational</option>
              <option value="inspirational">Inspirational</option>
            </select>
            <input type="number" value={form.days} onChange={e=>setForm(f=>({...f,days:+e.target.value}))} placeholder="Days (e.g. 7)" min={1} max={30} style={{ padding:'8px 12px', background:'var(--bg)', border:'1px solid var(--border)', borderRadius:'var(--radius)', color:'var(--text)' }} />
            <input value={form.post_times} onChange={e=>setForm(f=>({...f,post_times:e.target.value}))} placeholder="Post times (comma-separated, e.g. 09:00,18:00)" style={{ padding:'8px 12px', background:'var(--bg)', border:'1px solid var(--border)', borderRadius:'var(--radius)', color:'var(--text)' }} />
            <select value={form.connection_ids} onChange={e=>setForm(f=>({...f,connection_ids:e.target.value}))} style={{ padding:'8px 12px', background:'var(--bg)', border:'1px solid var(--border)', borderRadius:'var(--radius)', color:'var(--text)' }}>
              <option value="">Select connection</option>
              {connections.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div style={{ display:'flex', gap:'8px', marginTop:'12px' }}>
            <button onClick={()=>createMut.mutate(form)} disabled={!form.topic||createMut.isPending} style={{ padding:'8px 16px', background:'var(--accent)', color:'#fff', border:'none', borderRadius:'var(--radius)', cursor:'pointer' }}>
              {createMut.isPending ? 'Creating...' : 'Create Calendar'}
            </button>
            <button onClick={()=>setShowForm(false)} style={{ padding:'8px 16px', background:'var(--bg2)', color:'var(--text)', border:'1px solid var(--border)', borderRadius:'var(--radius)', cursor:'pointer' }}>Cancel</button>
          </div>
        </div>
      )}

      {isLoading ? <p style={{ color:'var(--text2)' }}>Loading...</p> : calendars.length === 0 ? (
        <div style={{ textAlign:'center', padding:'60px', color:'var(--text2)' }}><Calendar size={48} style={{ margin:'0 auto 16px' }} /><p>No AI calendars yet.</p></div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
          {calendars.map(cal => (
            <div key={cal.id} style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'16px', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <div>
                <h3 style={{ color:'var(--text)', fontWeight:600 }}>{cal.topic}</h3>
                <p style={{ color:'var(--text2)', fontSize:'13px' }}>{cal.days} days · {cal.tone} · {cal.post_count ?? 0} posts generated</p>
                <p style={{ color:'var(--text2)', fontSize:'12px' }}>Created {new Date(cal.created_at).toLocaleDateString()}</p>
              </div>
              <button onClick={()=>generateMut.mutate(cal.id)} disabled={generating===cal.id} style={{ display:'flex', alignItems:'center', gap:'6px', padding:'8px 14px', background:'var(--bg2)', color:'var(--accent)', border:'1px solid var(--border)', borderRadius:'var(--radius)', cursor:'pointer' }}>
                <Zap size={14}/> {generating===cal.id ? 'Generating...' : 'Generate Posts'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
