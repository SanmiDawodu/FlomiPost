import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { sitesApi } from '../utils/api'
import { useAuthStore } from '../store/authStore'
import toast from 'react-hot-toast'
import { Globe, Plus, X } from 'lucide-react'

const CATEGORIES = ['ministry','flomicso','business','other']

export default function SitesPage() {
  const qc = useQueryClient()
  const { isAdmin } = useAuthStore()
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ name:'', domain:'', category:'ministry', color:'#C9A84C', accent:'#0A1F44', ga_property_id:'', ga_measurement_id:'' })

  const { data, isLoading } = useQuery({ queryKey: ['sites'], queryFn: sitesApi.list })
  const sites = data?.data ?? []

  const addMutation = useMutation({
    mutationFn: sitesApi.create,
    onSuccess: () => {
      toast.success('Site added!')
      qc.invalidateQueries({ queryKey: ['sites'] })
      setShowAdd(false)
      setForm({ name:'', domain:'', category:'ministry', color:'#C9A84C', accent:'#0A1F44' })
    },
    onError: (e) => toast.error(e.message),
  })

  return (
    <div>
      <div className="fp-page-header">
        <div>
          <div className="fp-page-title">Sites</div>
          <div className="fp-page-sub">{sites.length} websites registered</div>
        </div>
        {isAdmin() && (
          <button className="fp-btn fp-btn-primary fp-btn-sm" onClick={() => setShowAdd(true)}>
            <Plus size={13}/> Add Site
          </button>
        )}
      </div>

      {showAdd && (
        <div className="fp-modal-bg" onClick={e => e.target === e.currentTarget && setShowAdd(false)}>
          <div className="fp-modal">
            <div className="fp-modal-header">
              <div className="fp-modal-title">Add Site</div>
              <button className="fp-modal-close" onClick={() => setShowAdd(false)}><X size={18}/></button>
            </div>
            <div className="fp-field">
              <label className="fp-label">Site Name</label>
              <input className="fp-input" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="Soul Salvation Intl. Ministries"/>
            </div>
            <div className="fp-field">
              <label className="fp-label">Domain</label>
              <input className="fp-input" value={form.domain} onChange={e=>setForm(f=>({...f,domain:e.target.value}))} placeholder="ssiministries.org"/>
            </div>
            <div className="fp-field">
              <label className="fp-label">Category</label>
              <select className="fp-select" value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))}>
                {CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8}} className="fp-field">
              <div>
                <label className="fp-label">Brand Color</label>
                <input type="color" className="fp-input" style={{height:42,padding:4}} value={form.color} onChange={e=>setForm(f=>({...f,color:e.target.value}))}/>
              </div>
              <div>
                <label className="fp-label">Accent Color</label>
                <input type="color" className="fp-input" style={{height:42,padding:4}} value={form.accent} onChange={e=>setForm(f=>({...f,accent:e.target.value}))}/>
              </div>
            </div>
            <div style={{display:'flex',gap:8,marginTop:8}}>
              <button className="fp-btn fp-btn-ghost" onClick={()=>setShowAdd(false)}>Cancel</button>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:12}}>
                <div>
                  <label className="fp-label">GA Property ID <span style={{color:'var(--text3)',fontWeight:400}}>(optional)</span></label>
                  <input className="fp-input" value={form.ga_property_id} onChange={e=>setForm(f=>({...f,ga_property_id:e.target.value}))} placeholder="UA-XXXXXXXXX or G-XXXXXXXX"/>
                </div>
                <div>
                  <label className="fp-label">GA Measurement ID <span style={{color:'var(--text3)',fontWeight:400}}>(optional)</span></label>
                  <input className="fp-input" value={form.ga_measurement_id} onChange={e=>setForm(f=>({...f,ga_measurement_id:e.target.value}))} placeholder="G-XXXXXXXXXX"/>
                </div>
              </div>
              <button className="fp-btn fp-btn-primary" onClick={()=>addMutation.mutate(form)} disabled={addMutation.isPending}>
                Add Site
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="fp-card">
        <div className="fp-card-title"><Globe size={15}/> All Sites</div>
        {isLoading ? <div className="fp-loader"><div className="fp-spinner"/></div> : (
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(260px,1fr))',gap:10}}>
            {sites.map(s => (
              <div key={s.id} style={{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:'var(--r)',padding:14,borderLeft:`3px solid ${s.color}`}}>
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                  <span style={{width:10,height:10,borderRadius:'50%',background:s.color,flexShrink:0}}/>
                  <span style={{fontFamily:'DM Mono,monospace',fontSize:12,color:'var(--text)'}}>{s.domain}</span>
                </div>
                <div style={{fontSize:11,color:'var(--text3)',marginBottom:6}}>{s.name}</div>
                <span style={{
                  fontSize:9,padding:'2px 7px',borderRadius:20,fontWeight:600,
                  background: s.category==='ministry'?'rgba(59,31,107,.4)':s.category==='flomicso'?'rgba(201,168,76,.12)':'rgba(29,158,117,.12)',
                  color: s.category==='ministry'?'#afa9ec':s.category==='flomicso'?'var(--gold)':'var(--green)'
                }}>{s.category}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
