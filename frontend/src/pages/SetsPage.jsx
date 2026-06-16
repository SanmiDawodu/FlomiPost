import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { api, connectionsApi, sitesApi } from '../utils/api'
import toast from 'react-hot-toast'
import { Plus, Trash2, Layers, Info } from 'lucide-react'

export default function SetsPage() {
  const [siteId, setSiteId] = useState('1')
  const [showAdd, setShowAdd] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [form, setForm] = useState({ name:'', connection_ids:[] })

  const { data: sitesRes } = useQuery({ queryKey:['sites'], queryFn: sitesApi.list })
  const { data: connsRes } = useQuery({ queryKey:['connections'], queryFn: ()=>connectionsApi.list() })
  const { data: setsRes, refetch } = useQuery({ queryKey:['sets',siteId], queryFn: ()=>api.get('/sets?site_id='+siteId) })

  const sites = sitesRes?.data ?? []
  const allConns = connsRes?.data ?? []
  const sets = setsRes?.data ?? []
  const siteConns = allConns.filter(c=>String(c.site_id)===String(siteId))

  const create = useMutation({ mutationFn: ()=>api.post('/sets',{...form,site_id:siteId}),
    onSuccess:()=>{ toast.success('Set created!'); refetch(); setShowAdd(false); setForm({name:'',connection_ids:[]}) },
    onError:e=>toast.error(e.message) })

  const del = useMutation({ mutationFn: id=>api.delete('/sets/'+id),
    onSuccess:()=>{ toast.success('Deleted'); refetch() } })

  const toggleConn = id => setForm(f=>({...f, connection_ids: f.connection_ids.includes(id) ? f.connection_ids.filter(x=>x!==id) : [...f.connection_ids,id]}))

  return (
    <div>
      <div className="fp-page-header" style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:24}}>
        <div><h1 className="fp-page-title">Sets</h1>
          <p className="fp-page-sub">Save groups of platforms to post to together in one click</p></div>
        <button className="fp-btn fp-btn-primary" onClick={()=>setShowAdd(v=>!v)}><Plus size={14}/> Create Set</button>
      </div>

      {/* Inline how-to */}
      <div style={{marginBottom:16}}>
        <button onClick={()=>setShowHelp(v=>!v)} style={{display:'flex',alignItems:'center',gap:6,background:'none',border:'none',cursor:'pointer',color:'var(--violet)',fontSize:13,fontWeight:600,padding:0}}>
          <Info size={14}/> How it works {showHelp?'▲':'▼'}
        </button>
        {showHelp && (
          <div className="fp-card" style={{marginTop:8,fontSize:13,color:'var(--text2)',lineHeight:1.8}}>
            <ol style={{margin:0,paddingLeft:18}}>
              <li>Pick the <strong>Site</strong> below, then click <strong>Create Set</strong>.</li>
              <li>Name it (e.g. "All Ministry Platforms") and tick the accounts to include.</li>
              <li>Click <strong>Save Set</strong>.</li>
              <li>In <strong>Compose</strong>, after picking the site, choose your Set from the <strong>"Use a Set…"</strong> dropdown — every account in it gets selected at once.</li>
            </ol>
          </div>
        )}
      </div>

      <div style={{marginBottom:16}}>
        <select className="fp-select" style={{width:200}} value={siteId} onChange={e=>setSiteId(e.target.value)}>
          {sites.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
      </div>

      {showAdd && (
        <div className="fp-card" style={{marginBottom:16}}>
          <div style={{fontWeight:700,marginBottom:12}}>New Set</div>
          <input className="fp-input" placeholder="Set name (e.g. All Ministry Platforms)" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} style={{marginBottom:10,width:'100%'}}/>
          <div style={{fontSize:12,fontWeight:600,marginBottom:8}}>Select platforms:</div>
          <div style={{display:'flex',flexWrap:'wrap',gap:8,marginBottom:12}}>
            {siteConns.map(c=>(
              <label key={c.id} style={{display:'flex',alignItems:'center',gap:6,fontSize:12,cursor:'pointer',
                padding:'6px 10px',borderRadius:8,border:'1px solid var(--border)',
                background:form.connection_ids.includes(String(c.id))?'var(--primary-10)':'var(--bg2)'}}>
                <input type="checkbox" checked={form.connection_ids.includes(String(c.id))} onChange={()=>toggleConn(String(c.id))}/>
                {c.account_name} <span style={{color:'var(--text3)',fontSize:10}}>({c.key_name})</span>
              </label>
            ))}
          </div>
          <div style={{display:'flex',gap:8}}>
            <button className="fp-btn fp-btn-primary fp-btn-sm" onClick={()=>create.mutate()}>Save Set</button>
            <button className="fp-btn fp-btn-ghost fp-btn-sm" onClick={()=>setShowAdd(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))',gap:12}}>
        {sets.length===0 && <div className="fp-card" style={{textAlign:'center',color:'var(--text3)',padding:40,gridColumn:'1/-1'}}><Layers size={32} style={{opacity:0.3,marginBottom:8}}/><br/>No sets yet. Create one to save platform groups.</div>}
        {sets.map(s=>{
          const ids = JSON.parse(s.connection_ids||'[]')
          const conns = allConns.filter(c=>ids.includes(String(c.id)))
          return (
            <div key={s.id} className="fp-card">
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:10}}>
                <div style={{fontWeight:700}}>{s.name}</div>
                <button className="fp-btn fp-btn-ghost fp-btn-sm" style={{color:'var(--red)'}} onClick={()=>del.mutate(s.id)}><Trash2 size={12}/></button>
              </div>
              <div style={{fontSize:12,color:'var(--text3)'}}>{conns.length} platforms</div>
              <div style={{display:'flex',flexWrap:'wrap',gap:4,marginTop:8}}>
                {conns.map(c=><span key={c.id} style={{fontSize:10,padding:'2px 6px',borderRadius:4,background:'var(--primary-10)',color:'var(--primary)'}}>{c.account_name}</span>)}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
