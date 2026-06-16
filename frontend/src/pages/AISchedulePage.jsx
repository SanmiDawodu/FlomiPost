import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Sparkles, Plus, Trash2, Play, Pause, Clock, Image, Zap, Info, Pencil } from 'lucide-react'
import toast from 'react-hot-toast'
import { api, sitesApi, connectionsApi } from '../utils/api'
import { format, parseISO } from 'date-fns'

const schedApi = {
  list:    ()     => api.get('/ai-schedules'),
  create:  (d)    => api.post('/ai-schedules', d),
  update:  (id,d) => api.put('/ai-schedules/'+id, d),
  delete:  (id)   => api.delete('/ai-schedules/'+id),
  runNow:  (id)   => api.post('/ai-schedules/'+id+'/run-now'),
}

const TONES = ['inspirational','professional','casual','urgent','educational','promotional','faith-based','motivational']
const FREQUENCIES = [
  { value:'hourly',     label:'Every Hour' },
  { value:'twice_daily',label:'Twice Daily' },
  { value:'daily',      label:'Daily' },
  { value:'weekly',     label:'Weekly' },
]

export default function AISchedulePage() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState({
    site_id:'', name:'', topic:'', tone:'inspirational',
    frequency:'daily', connection_ids:[], include_image:true, image_prompt:''
  })

  const { data: schedsRes, isLoading } = useQuery({ queryKey:['ai-schedules'], queryFn: schedApi.list })
  const { data: sitesRes }  = useQuery({ queryKey:['sites'],       queryFn: sitesApi.list })
  const { data: connsRes }  = useQuery({ queryKey:['connections'], queryFn: () => api.get('/connections') })
  const { data: setsRes }   = useQuery({ queryKey:['sets', form.site_id], queryFn: () => api.get('/sets?site_id='+form.site_id), enabled: !!form.site_id })

  const scheds  = schedsRes?.data ?? []
  const sites   = sitesRes?.data  ?? []
  const allConns = connsRes?.data ?? []
  const siteConns = form.site_id ? allConns.filter(c => String(c.site_id) === String(form.site_id)) : []
  const sets = setsRes?.data ?? []

  const set = (k,v) => setForm(f => ({...f, [k]:v}))
  const toggleConn = (id) => setForm(f => ({...f, connection_ids: f.connection_ids.includes(id) ? f.connection_ids.filter(x=>x!==id) : [...f.connection_ids, id]}))
  const applySet = (setId) => {
    const st = sets.find(x => String(x.id) === String(setId))
    if (!st) return
    let ids = []
    try { ids = (JSON.parse(st.connection_ids||'[]')||[]).map(Number) } catch {}
    const valid = ids.filter(id => siteConns.some(c => Number(c.id) === id))
    set('connection_ids', valid)
    if (!valid.length) toast.error(`"${st.name}" has no accounts on this site`)
    else toast.success(`Selected ${valid.length} account(s) from "${st.name}"`)
  }

  const blankForm = { site_id:'', name:'', topic:'', tone:'inspirational', frequency:'daily', connection_ids:[], include_image:true, image_prompt:'' }
  const openNew = () => { setEditId(null); setForm(blankForm); setShowForm(v=>!v) }
  const openEdit = (s) => {
    let conns = []
    try { conns = (JSON.parse(s.connection_ids||'[]')||[]).map(Number) } catch {}
    setForm({ site_id:String(s.site_id), name:s.name||'', topic:s.topic||'', tone:s.tone||'inspirational', frequency:s.frequency||'daily', connection_ids:conns, include_image:!!Number(s.include_image), image_prompt:s.image_prompt||'' })
    setEditId(s.id); setShowForm(true)
    if (typeof window!=='undefined') window.scrollTo({top:0,behavior:'smooth'})
  }
  const saveMut = useMutation({
    mutationFn: () => editId
      ? schedApi.update(editId, {...form, site_id: parseInt(form.site_id)})
      : schedApi.create({...form, site_id: parseInt(form.site_id)}),
    onSuccess: () => { qc.invalidateQueries(['ai-schedules']); setShowForm(false); setEditId(null); toast.success(editId ? 'Schedule updated!' : 'AI Schedule created!') },
    onError: e => toast.error(e.message)
  })
  const deleteMut = useMutation({
    mutationFn: (id) => schedApi.delete(id),
    onSuccess: () => qc.invalidateQueries(['ai-schedules'])
  })
  const toggleMut = useMutation({
    mutationFn: ({id,active}) => schedApi.update(id, {active: active ? 0 : 1}),
    onSuccess: () => qc.invalidateQueries(['ai-schedules'])
  })
  const runNowMut = useMutation({
    mutationFn: (id) => schedApi.runNow(id),
    onSuccess: () => { qc.invalidateQueries(['ai-schedules']); toast.success('Running now! Post will appear within 1 minute.') },
    onError: e => toast.error(e.message)
  })

  return (
    <div>
      <div className="fp-page-header">
        <div>
          <div className="fp-page-title">AI Auto-Schedule</div>
          <div className="fp-page-sub">Set topics and let AI write and post for you automatically</div>
        </div>
        <button className="fp-btn fp-btn-primary" onClick={openNew}>
          <Plus size={14}/> New AI Schedule
        </button>
      </div>

      {/* Inline how-to */}
      <div style={{marginBottom:16}}>
        <button onClick={()=>setShowHelp(v=>!v)} style={{display:'flex',alignItems:'center',gap:6,background:'none',border:'none',cursor:'pointer',color:'var(--primary)',fontSize:13,fontWeight:600,padding:0}}>
          <Info size={14}/> How it works {showHelp?'▲':'▼'}
        </button>
        {showHelp && (
          <div className="fp-card" style={{marginTop:8,fontSize:13,color:'var(--text2)',lineHeight:1.8}}>
            <ol style={{margin:0,paddingLeft:18}}>
              <li>Click <strong>New AI Schedule</strong>.</li>
              <li>Name it, pick the <strong>Site</strong>, and write the <strong>Topic</strong> — the more specific, the more on-brand (e.g. "daily homecare wellness tips for families and caregivers").</li>
              <li>Choose a <strong>Tone</strong> and <strong>Frequency</strong> (e.g. Twice Daily).</li>
              <li>Tick the accounts to post to. Toggle <strong>Generate AI image</strong> if you want an image on every post.</li>
              <li>Click <strong>Create</strong>. Use <strong>Run Now</strong> to test it, and the ▶ / ⏸ buttons to activate or pause.</li>
            </ol>
            <div style={{marginTop:8,fontSize:12,color:'var(--text3)'}}>💡 Every post is different — the AI is told to avoid repeating recent posts. YouTube/TikTok need a video; Instagram needs an image (turn on "Generate AI image").</div>
          </div>
        )}
      </div>

      {/* Create form */}
      {showForm && (
        <div className="fp-card" style={{marginBottom:20, border:'2px solid var(--primary)'}}>
          <div className="fp-card-title" style={{marginBottom:16}}><Sparkles size={14}/> {editId ? 'Edit AI Auto-Schedule' : 'New AI Auto-Schedule'}</div>
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:12}}>
            <div className="fp-field" style={{marginBottom:0}}>
              <label className="fp-label">Schedule Name</label>
              <input className="fp-input" placeholder="e.g. Daily Faith Posts" value={form.name} onChange={e=>set('name',e.target.value)}/>
            </div>
            <div className="fp-field" style={{marginBottom:0}}>
              <label className="fp-label">Site</label>
              <select className="fp-select" value={form.site_id} onChange={e=>{ set('site_id',e.target.value); set('connection_ids',[]) }}>
                <option value="">Select site…</option>
                {sites.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div className="fp-field" style={{marginBottom:0, gridColumn:'1/-1'}}>
              <label className="fp-label">Topic / Theme</label>
              <textarea className="fp-textarea" rows={2} placeholder="e.g. Daily morning prayer and faith encouragement for Soul Salvation Ministries" value={form.topic} onChange={e=>set('topic',e.target.value)} style={{minHeight:60}}/>
            </div>
            <div className="fp-field" style={{marginBottom:0}}>
              <label className="fp-label">Tone</label>
              <select className="fp-select" value={form.tone} onChange={e=>set('tone',e.target.value)}>
                {TONES.map(t=><option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
              </select>
            </div>
            <div className="fp-field" style={{marginBottom:0}}>
              <label className="fp-label">Frequency</label>
              <select className="fp-select" value={form.frequency} onChange={e=>set('frequency',e.target.value)}>
                {FREQUENCIES.map(f=><option key={f.value} value={f.value}>{f.label}</option>)}
              </select>
            </div>
          </div>

          {/* Include image */}
          <div style={{display:'flex', alignItems:'center', gap:10, marginBottom:12, padding:'10px 12px', background:'var(--surface)', borderRadius:10}}>
            <input type="checkbox" checked={form.include_image} onChange={e=>set('include_image',e.target.checked)} id="inc_img" style={{accentColor:'var(--primary)'}}/>
            <label htmlFor="inc_img" style={{fontSize:13, fontWeight:600, cursor:'pointer'}}><Image size={13} style={{display:'inline',marginRight:4}}/> Generate AI image for each post</label>
            {form.include_image && (
              <input className="fp-input" placeholder="Image style (optional): e.g. sunrise church spiritual" value={form.image_prompt} onChange={e=>set('image_prompt',e.target.value)} style={{flex:1, fontSize:12}}/>
            )}
          </div>

          {/* Account selector */}
          {siteConns.length > 0 && (
            <div style={{marginBottom:12}}>
              <label className="fp-label">Post to these accounts</label>
              {sets.length > 0 && (
                <select className="fp-select" value="" title="Quick-select a saved group of accounts"
                  onChange={e=>{ if(e.target.value){ applySet(e.target.value); e.target.value='' } }}
                  style={{marginTop:6, marginBottom:2, fontSize:12, maxWidth:280}}>
                  <option value="">Use a Set… (only these accounts)</option>
                  {sets.map(st=><option key={st.id} value={st.id}>{st.name}</option>)}
                </select>
              )}
              <div style={{display:'flex', flexWrap:'wrap', gap:8, marginTop:6}}>
                {siteConns.map(c=>(
                  <label key={c.id} style={{display:'flex',alignItems:'center',gap:6,padding:'6px 12px',borderRadius:20,cursor:'pointer',background:form.connection_ids.includes(c.id)?'var(--primary)':'var(--surface)',color:form.connection_ids.includes(c.id)?'#fff':'var(--text2)',border:'1px solid var(--border)',fontSize:12,fontWeight:500}}>
                    <input type="checkbox" checked={form.connection_ids.includes(c.id)} onChange={()=>toggleConn(c.id)} style={{display:'none'}}/>
                    {c.platform_name} · {c.account_name}
                  </label>
                ))}
              </div>
            </div>
          )}

          <div style={{display:'flex', gap:8}}>
            <button className="fp-btn fp-btn-primary" onClick={()=>saveMut.mutate()} disabled={!form.name||!form.topic||!form.site_id||form.connection_ids.length===0||saveMut.isPending}>
              <Sparkles size={13}/> {saveMut.isPending?(editId?'Saving…':'Creating…'):(editId?'Save Changes':'Create Schedule')}
            </button>
            <button className="fp-btn fp-btn-ghost" onClick={()=>{setShowForm(false);setEditId(null)}}>Cancel</button>
          </div>
        </div>
      )}

      {/* Schedule list */}
      {isLoading
        ? <div style={{textAlign:'center',padding:40,color:'var(--text3)'}}>Loading...</div>
        : scheds.length === 0
          ? <div className="fp-card" style={{textAlign:'center',padding:50}}>
              <Sparkles size={40} style={{margin:'0 auto 16px',opacity:.2,display:'block'}}/>
              <div style={{fontSize:15,fontWeight:600,marginBottom:8}}>No AI Schedules yet</div>
              <div style={{fontSize:13,color:'var(--text3)',marginBottom:20}}>Create a schedule and AI will write and post for you automatically</div>
              <button className="fp-btn fp-btn-primary" onClick={()=>setShowForm(true)}><Plus size={14}/> Create First Schedule</button>
            </div>
          : scheds.map(s => (
            <div key={s.id} className="fp-card" style={{marginBottom:12,opacity:s.active?1:0.6}}>
              <div style={{display:'flex',alignItems:'flex-start',gap:12}}>
                <div style={{width:44,height:44,borderRadius:12,background:s.active?'linear-gradient(135deg,var(--primary),#7c5ef7)':'var(--surface)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                  <Sparkles size={20} color={s.active?'#fff':'var(--text3)'}/>
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                    <div style={{fontSize:15,fontWeight:700}}>{s.name}</div>
                    <span style={{fontSize:10,padding:'2px 8px',borderRadius:20,background:s.active?'#d1fae5':'var(--surface)',color:s.active?'#10b981':'var(--text3)',fontWeight:700}}>{s.active?'● Active':'○ Paused'}</span>
                    {s.include_image && <span style={{fontSize:10,padding:'2px 8px',borderRadius:20,background:'#ede9ff',color:'var(--primary)',fontWeight:600}}><Image size={9}/> +Image</span>}
                  </div>
                  <div style={{fontSize:13,color:'var(--text2)',marginBottom:6,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{s.topic}</div>
                  <div style={{fontSize:11,color:'var(--text3)',display:'flex',gap:12,flexWrap:'wrap'}}>
                    <span><Clock size={10}/> {FREQUENCIES.find(f=>f.value===s.frequency)?.label||s.frequency}</span>
                    <span>Site: {s.site_name}</span>
                    <span>{s.posts_created} posts created</span>
                    {s.last_run && <span>Last: {format(parseISO(s.last_run),'MMM d HH:mm')}</span>}
                    {s.next_run && s.active && <span style={{color:'var(--primary)'}}>Next: {format(parseISO(s.next_run),'MMM d HH:mm')}</span>}
                  </div>
                </div>
                <div style={{display:'flex',gap:6,flexShrink:0}}>
                  <button className="fp-btn fp-btn-primary fp-btn-sm" onClick={()=>runNowMut.mutate(s.id)} disabled={runNowMut.isPending} title="Run now">
                    <Zap size={12}/> Run Now
                  </button>
                  <button className="fp-btn fp-btn-ghost fp-btn-sm" onClick={()=>toggleMut.mutate({id:s.id,active:s.active})} title={s.active?'Pause':'Resume'}>
                    {s.active ? <Pause size={12}/> : <Play size={12}/>}
                  </button>
                  <button className="fp-btn fp-btn-ghost fp-btn-sm" onClick={()=>openEdit(s)} title="Edit">
                    <Pencil size={12}/>
                  </button>
                  <button className="fp-btn fp-btn-ghost fp-btn-sm" style={{color:'var(--coral)'}} title="Delete" onClick={()=>{ if(window.confirm(`Delete "${s.name}"? This removes the schedule for good.`)) deleteMut.mutate(s.id) }}>
                    <Trash2 size={12}/>
                  </button>
                </div>
              </div>
            </div>
          ))
      }

      {scheds.length > 0 && (
        <div style={{fontSize:12,color:'var(--text3)',padding:'12px 0',textAlign:'center'}}>
          AI schedules run automatically via cron. Each run generates a caption with Claude + an image with DALL-E, then publishes to your selected accounts.
        </div>
      )}
    </div>
  )
}
