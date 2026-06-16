import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, sitesApi } from '../utils/api'
import toast from 'react-hot-toast'
import { Mic, Plus, Trash2, Sparkles, RefreshCw, BookOpen } from 'lucide-react'

export default function VoiceLearningPage() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name:'', site_id:'', platform:'general', sample_posts:'' })
  const [testing, setTesting] = useState({ profile_id:'', topic:'', platform:'instagram', result:'' })
  const [training, setTraining] = useState(false)
  const [testLoading, setTestLoading] = useState(false)

  const { data: sitesRes } = useQuery({ queryKey:['sites'], queryFn: sitesApi.list })
  const { data: profilesRes, refetch } = useQuery({ queryKey:['voice-profiles'], queryFn:()=>api.get('/voice-profiles') })
  const sites    = sitesRes?.data ?? []
  const profiles = profilesRes?.data ?? []

  const trainProfile = async () => {
    if (!form.site_id) return toast.error('Select a site')
    setTraining(true)
    try {
      const samples = form.sample_posts ? form.sample_posts.split('\n---\n').filter(Boolean) : []
      const r = await api.post('/voice-profiles/train', { ...form, site_id:parseInt(form.site_id), sample_posts:samples })
      toast.success('Voice profile trained!')
      refetch()
      setShowForm(false)
      setForm({ name:'', site_id:'', platform:'general', sample_posts:'' })
    } catch(e) { toast.error(e.message) }
    finally { setTraining(false) }
  }

  const testVoice = async () => {
    if (!testing.topic) return toast.error('Enter a topic')
    setTestLoading(true)
    try {
      const r = await api.post('/ai/voice-caption', { profile_id:parseInt(testing.profile_id)||0, topic:testing.topic, platform:testing.platform })
      setTesting(t=>({...t, result:r.data.caption}))
    } catch(e) { toast.error(e.message) }
    finally { setTestLoading(false) }
  }

  const delProfile = useMutation({
    mutationFn: id=>api.delete('/voice-profiles/'+id),
    onSuccess:()=>{ refetch(); toast.success('Deleted') }
  })

  return (
    <div>
      <div className="fp-page-header" style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:24}}>
        <div>
          <h1 className="fp-page-title">AI Voice Learning</h1>
          <p className="fp-page-sub">Train AI to write in your exact tone, style and personality</p>
        </div>
        <button className="fp-btn fp-btn-primary" onClick={()=>setShowForm(v=>!v)}><Plus size={14}/> Train New Voice</button>
      </div>

      {showForm && (
        <div className="fp-card" style={{marginBottom:20}}>
          <div style={{fontWeight:700,fontSize:14,marginBottom:14,display:'flex',alignItems:'center',gap:6}}><Mic size={14}/> Train AI Voice Profile</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10,marginBottom:10}}>
            <div><label className="fp-label">Profile name *</label><input className="fp-input" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="Sanmi's Ministry Voice"/></div>
            <div><label className="fp-label">Site *</label>
              <select className="fp-select" value={form.site_id} onChange={e=>setForm(f=>({...f,site_id:e.target.value}))}>
                <option value="">Select site...</option>
                {sites.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div><label className="fp-label">Platform</label>
              <select className="fp-select" value={form.platform} onChange={e=>setForm(f=>({...f,platform:e.target.value}))}>
                {['general','instagram','facebook','linkedin','twitter','youtube','telegram'].map(p=><option key={p} value={p}>{p}</option>)}
              </select>
            </div>
          </div>
          <div style={{marginBottom:10}}>
            <label className="fp-label">Sample posts (optional — separate each with a line containing just "---")</label>
            <div style={{fontSize:11,color:'var(--text3)',marginBottom:6}}>If left blank, AI will learn from your last 20 published posts automatically.</div>
            <textarea className="fp-input" rows={6} value={form.sample_posts} onChange={e=>setForm(f=>({...f,sample_posts:e.target.value}))} placeholder={"Your prayer life is your secret weapon...\n\n---\n\nGod is not done with you yet...\n\n---\n\nEvery declaration you speak in faith..."} style={{width:'100%',resize:'vertical',fontFamily:'inherit'}}/>
          </div>
          <div style={{display:'flex',gap:8}}>
            <button className="fp-btn fp-btn-primary" onClick={trainProfile} disabled={training}>
              {training?<><RefreshCw size={14} style={{animation:'spin 1s linear infinite'}}/> Training...</>:<><Sparkles size={14}/> Train Voice</>}
            </button>
            <button className="fp-btn fp-btn-ghost fp-btn-sm" onClick={()=>setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
        {/* Profiles list */}
        <div>
          <div style={{fontWeight:700,fontSize:13,marginBottom:10}}>Your Voice Profiles</div>
          {profiles.length===0 && <div className="fp-card" style={{textAlign:'center',padding:30,color:'var(--text3)'}}><Mic size={28} style={{opacity:.2,marginBottom:8}}/><p>No voice profiles yet. Train one above.</p></div>}
          {profiles.map(p=>(
            <div key={p.id} className="fp-card" style={{marginBottom:10}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,fontSize:14}}>{p.name}</div>
                  <div style={{fontSize:11,color:'var(--text3)',marginBottom:6}}>{p.platform} · {sites.find(s=>String(s.id)===String(p.site_id))?.name} · Trained: {p.trained_at?.slice(0,10)}</div>
                  {p.tone_summary && <div style={{fontSize:12,color:'var(--text)',lineHeight:1.6,fontStyle:'italic'}}>"{p.tone_summary}"</div>}
                </div>
                <div style={{display:'flex',gap:4,marginLeft:8}}>
                  <button className="fp-btn fp-btn-primary fp-btn-sm" onClick={()=>setTesting(t=>({...t,profile_id:String(p.id)}))}>Use</button>
                  <button onClick={()=>delProfile.mutate(p.id)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text3)'}}><Trash2 size={13}/></button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Test voice */}
        <div>
          <div style={{fontWeight:700,fontSize:13,marginBottom:10}}>Test Voice Profile</div>
          <div className="fp-card">
            <div style={{marginBottom:10}}>
              <label className="fp-label">Profile</label>
              <select className="fp-select" value={testing.profile_id} onChange={e=>setTesting(t=>({...t,profile_id:e.target.value}))}>
                <option value="">No profile (generic AI)</option>
                {profiles.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div style={{display:'grid',gridTemplateColumns:'2fr 1fr',gap:8,marginBottom:10}}>
              <div><label className="fp-label">Topic *</label><input className="fp-input" value={testing.topic} onChange={e=>setTesting(t=>({...t,topic:e.target.value}))} placeholder="Prayer changes everything"/></div>
              <div><label className="fp-label">Platform</label>
                <select className="fp-select" value={testing.platform} onChange={e=>setTesting(t=>({...t,platform:e.target.value}))}>
                  {['instagram','facebook','linkedin','twitter','telegram'].map(p=><option key={p} value={p}>{p}</option>)}
                </select>
              </div>
            </div>
            <button className="fp-btn fp-btn-primary fp-btn-sm" onClick={testVoice} disabled={testLoading} style={{marginBottom:10}}>
              {testLoading?'Generating...':'Generate with Voice'}
            </button>
            {testing.result && (
              <div style={{background:'var(--bg2)',borderRadius:8,padding:12,fontSize:13,lineHeight:1.7,whiteSpace:'pre-wrap'}}>
                {testing.result}
                <div style={{marginTop:8,display:'flex',gap:6}}>
                  <button onClick={()=>{navigator.clipboard.writeText(testing.result);toast.success('Copied!')}} className="fp-btn fp-btn-ghost fp-btn-sm">Copy</button>
                  <button onClick={()=>setTesting(t=>({...t,result:''}))} className="fp-btn fp-btn-ghost fp-btn-sm">Clear</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
