import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Rss, Plus, Trash2, ToggleLeft, ToggleRight } from 'lucide-react'

const tok = () => localStorage.getItem('fp_token')
const api = (url, opts={}) => fetch(url, {headers:{'Authorization':`Bearer ${tok()}`,'Content-Type':'application/json'},...opts}).then(r=>r.json())

export default function RSSFeedsPage() {
  const qc = useQueryClient()
  const [form, setForm] = useState({name:'',url:'',interval_hours:6,auto_publish:false})
  const { data, isLoading } = useQuery({ queryKey:['rss-feeds'], queryFn:()=>api('/api/rss-feeds') })
  const create = useMutation({ mutationFn:()=>api('/api/rss-feeds',{method:'POST',body:JSON.stringify(form)}), onSuccess:()=>{qc.invalidateQueries(['rss-feeds']);setForm({name:'',url:'',interval_hours:6,auto_publish:false})} })
  const del = useMutation({ mutationFn:id=>api(`/api/rss-feeds/${id}`,{method:'DELETE'}), onSuccess:()=>qc.invalidateQueries(['rss-feeds']) })
  const toggle = useMutation({ mutationFn:({id,auto_publish})=>api(`/api/rss-feeds/${id}`,{method:'PUT',body:JSON.stringify({auto_publish})}), onSuccess:()=>qc.invalidateQueries(['rss-feeds']) })
  const feeds = data?.data || []
  const inp = {background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:'var(--radius)',padding:'8px 12px',color:'var(--text)',fontSize:'13px'}
  return (
    <div style={{padding:'24px'}}>
      <h1 style={{fontSize:'20px',fontWeight:700,marginBottom:'16px',color:'var(--text)',display:'flex',alignItems:'center',gap:8}}><Rss size={18}/>RSS Feeds</h1>
      <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:'var(--radius)',padding:'16px',marginBottom:20}}>
        <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
          <input style={{...inp,flex:1}} placeholder="Feed name" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}/>
          <input style={{...inp,flex:2}} placeholder="RSS URL" value={form.url} onChange={e=>setForm(f=>({...f,url:e.target.value}))}/>
          <input style={{...inp,width:90}} type="number" placeholder="Hours" value={form.interval_hours} onChange={e=>setForm(f=>({...f,interval_hours:+e.target.value}))}/>
          <label style={{display:'flex',alignItems:'center',gap:6,color:'var(--text2)',fontSize:'13px',cursor:'pointer'}}><input type="checkbox" checked={form.auto_publish} onChange={e=>setForm(f=>({...f,auto_publish:e.target.checked}))}/>Auto-publish</label>
          <button onClick={()=>create.mutate()} style={{padding:'8px 14px',background:'var(--accent)',color:'#fff',border:'none',borderRadius:'var(--radius)',cursor:'pointer',fontSize:'13px',display:'flex',alignItems:'center',gap:6}}><Plus size={14}/>Add</button>
        </div>
      </div>
      {isLoading ? <p style={{color:'var(--text2)'}}>Loading…</p> : feeds.map(f=>(
        <div key={f.id} style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:'var(--radius)',padding:'14px 16px',marginBottom:'8px',display:'flex',alignItems:'center',gap:12}}>
          <div style={{flex:1}}><div style={{fontWeight:600,color:'var(--text)'}}>{f.name}</div><div style={{fontSize:'12px',color:'var(--text2)'}}>{f.url} · every {f.interval_hours}h · last fetched: {f.last_fetched ? new Date(f.last_fetched).toLocaleString() : 'never'}</div></div>
          <button onClick={()=>toggle.mutate({id:f.id,auto_publish:!f.auto_publish})} style={{background:'none',border:'none',cursor:'pointer',color:f.auto_publish?'var(--success)':'var(--text3)'}} title="Auto-publish">{f.auto_publish?<ToggleRight size={20}/>:<ToggleLeft size={20}/>}</button>
          <button onClick={()=>del.mutate(f.id)} style={{padding:'6px',background:'rgba(255,92,106,0.1)',border:'none',borderRadius:'6px',cursor:'pointer',color:'var(--danger)'}}><Trash2 size={14}/></button>
        </div>
      ))}
    </div>
  )
}
