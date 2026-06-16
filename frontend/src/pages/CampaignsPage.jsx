import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../utils/api'
import { Link } from 'react-router-dom'
import toast from 'react-hot-toast'
import { Plus, X, Trash2, BarChart3, Calendar, Edit2 } from 'lucide-react'

const STATUS_COLORS = { '#6366f1':'Violet','#22c55e':'Green','#f59e0b':'Amber','#ef4444':'Red','#3b82f6':'Blue','#ec4899':'Pink','#14b8a6':'Teal','#f97316':'Orange' }

export default function CampaignsPage() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing]   = useState(null)
  const [form, setForm] = useState({ name:'', description:'', color:'#6366f1', start_date:'', end_date:'' })

  const { data, isLoading } = useQuery({ queryKey:['campaigns'], queryFn:()=>api.get('/campaigns') })
  const campaigns = data?.data ?? []

  const saveMutation = useMutation({
    mutationFn: d => editing ? api.put(`/campaigns/${editing.id}`, d) : api.post('/campaigns', d),
    onSuccess: () => { toast.success(editing?'Updated!':'Campaign created!'); qc.invalidateQueries({queryKey:['campaigns']}); closeForm() },
    onError: e => toast.error(e.message),
  })
  const deleteMutation = useMutation({
    mutationFn: id => api.delete(`/campaigns/${id}`),
    onSuccess: () => { toast.success('Deleted'); qc.invalidateQueries({queryKey:['campaigns']}) },
    onError: e => toast.error(e.message),
  })

  function openNew() { setForm({name:'',description:'',color:'#6366f1',start_date:'',end_date:''}); setEditing(null); setShowForm(true) }
  function openEdit(c) { setForm({name:c.name,description:c.description||'',color:c.color||'#6366f1',start_date:c.start_date||'',end_date:c.end_date||''}); setEditing(c); setShowForm(true) }
  function closeForm() { setShowForm(false); setEditing(null) }

  return (
    <div>
      <div className="fp-page-header">
        <div>
          <div className="fp-page-title">Campaigns</div>
          <div className="fp-page-sub">Group posts into campaigns to track performance by initiative</div>
        </div>
        <button className="fp-btn fp-btn-primary fp-btn-sm" onClick={openNew}><Plus size={13}/> New Campaign</button>
      </div>

      {isLoading ? <div className="fp-loader"><div className="fp-spinner"/></div> : (
        campaigns.length === 0 ? (
          <div className="fp-card" style={{ textAlign:'center', padding:'56px 24px' }}>
            <div style={{ fontSize:40, marginBottom:12 }}>📣</div>
            <div style={{ fontSize:17, fontWeight:700, marginBottom:8 }}>No campaigns yet</div>
            <div style={{ fontSize:14, color:'var(--text3)', marginBottom:20 }}>Group your posts by campaign to track reach, engagement, and performance together.</div>
            <button className="fp-btn fp-btn-primary" onClick={openNew}><Plus size={14}/> Create your first campaign</button>
          </div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:16 }}>
            {campaigns.map(c => {
              const start = c.start_date ? new Date(c.start_date).toLocaleDateString('en',{month:'short',day:'numeric'}) : null
              const end   = c.end_date   ? new Date(c.end_date).toLocaleDateString('en',{month:'short',day:'numeric',year:'numeric'}) : null
              const now   = new Date()
              const isActive = (!c.start_date || new Date(c.start_date)<=now) && (!c.end_date || new Date(c.end_date)>=now)
              const isEnded  = c.end_date && new Date(c.end_date)<now
              return (
                <div key={c.id} style={{ background:'var(--bg2)', border:'1.5px solid var(--border)', borderRadius:14, overflow:'hidden', transition:'box-shadow .15s' }}>
                  {/* Colour bar */}
                  <div style={{ height:5, background:c.color||'#6366f1' }}/>
                  <div style={{ padding:20 }}>
                    <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:8 }}>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontWeight:800, fontSize:16, color:'var(--text)', marginBottom:4 }}>{c.name}</div>
                        {c.description && <div style={{ fontSize:13, color:'var(--text3)', lineHeight:1.5 }}>{c.description}</div>}
                      </div>
                      <div style={{ display:'flex', gap:4, flexShrink:0, marginLeft:8 }}>
                        <button onClick={()=>openEdit(c)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text3)', padding:4 }}><Edit2 size={14}/></button>
                        <button onClick={()=>{ if(confirm('Delete campaign?')) deleteMutation.mutate(c.id) }} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--coral)', padding:4 }}><Trash2 size={14}/></button>
                      </div>
                    </div>

                    {/* Stats */}
                    <div style={{ display:'flex', gap:16, marginTop:12, paddingTop:12, borderTop:'1px solid var(--border)' }}>
                      <div style={{ textAlign:'center' }}>
                        <div style={{ fontSize:22, fontWeight:800, color:c.color||'#6366f1' }}>{c.post_count||0}</div>
                        <div style={{ fontSize:10, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.05em' }}>Posts</div>
                      </div>
                      <div style={{ flex:1 }}/>
                      <div style={{ textAlign:'right' }}>
                        {(start||end) && (
                          <div style={{ fontSize:12, color:'var(--text3)', display:'flex', alignItems:'center', gap:5 }}>
                            <Calendar size={12}/>
                            {start && end ? `${start} – ${end}` : start ? `From ${start}` : `Until ${end}`}
                          </div>
                        )}
                        <div style={{ marginTop:4 }}>
                          <span style={{ fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:20,
                            background: isEnded ? 'var(--bg3)' : isActive ? '#dcfce7' : '#fef3c7',
                            color: isEnded ? 'var(--text3)' : isActive ? '#16a34a' : '#b45309' }}>
                            {isEnded ? 'Ended' : isActive ? 'Active' : 'Upcoming'}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* View posts link */}
                    <Link to={`/posts?campaign_id=${c.id}`}
                      style={{ marginTop:12, display:'flex', alignItems:'center', gap:5, fontSize:12, fontWeight:600, color:'var(--violet)', textDecoration:'none' }}>
                      <BarChart3 size={12}/> View posts in this campaign
                    </Link>
                  </div>
                </div>
              )
            })}
          </div>
        )
      )}

      {/* Form modal */}
      {showForm && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:500, padding:20 }}
          onClick={e=>e.target===e.currentTarget&&closeForm()}>
          <div className="fp-modal" style={{ maxWidth:480 }}>
            <div className="fp-modal-header">
              <div className="fp-modal-title">{editing?'Edit Campaign':'New Campaign'}</div>
              <button className="fp-modal-close" onClick={closeForm}><X size={18}/></button>
            </div>
            <div className="fp-field">
              <label className="fp-label">Campaign Name *</label>
              <input className="fp-input" placeholder="e.g. Summer Launch, Ramadan Series, Q3 Outreach" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}/>
            </div>
            <div className="fp-field">
              <label className="fp-label">Description</label>
              <textarea className="fp-textarea" placeholder="What's this campaign about?" value={form.description} onChange={e=>setForm(f=>({...f,description:e.target.value}))} style={{ height:80, resize:'vertical' }}/>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div className="fp-field">
                <label className="fp-label">Start Date</label>
                <input type="date" className="fp-input" value={form.start_date} onChange={e=>setForm(f=>({...f,start_date:e.target.value}))}/>
              </div>
              <div className="fp-field">
                <label className="fp-label">End Date</label>
                <input type="date" className="fp-input" value={form.end_date} onChange={e=>setForm(f=>({...f,end_date:e.target.value}))}/>
              </div>
            </div>
            <div className="fp-field">
              <label className="fp-label">Colour</label>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginTop:4 }}>
                {Object.keys(STATUS_COLORS).map(col=>(
                  <button key={col} onClick={()=>setForm(f=>({...f,color:col}))}
                    style={{ width:28, height:28, borderRadius:'50%', background:col, border: form.color===col?'3px solid var(--text)':'3px solid transparent', cursor:'pointer', transition:'border .15s' }}/>
                ))}
              </div>
            </div>
            <div style={{ display:'flex', gap:8, marginTop:16 }}>
              <button className="fp-btn fp-btn-ghost" onClick={closeForm}>Cancel</button>
              <button className="fp-btn fp-btn-primary" onClick={()=>saveMutation.mutate(form)} disabled={!form.name.trim()||saveMutation.isPending}>
                {saveMutation.isPending?'Saving…':editing?'Save Changes':'Create Campaign'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
