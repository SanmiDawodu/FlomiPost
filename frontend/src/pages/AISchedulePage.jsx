import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Sparkles, Plus, Play } from 'lucide-react'

const tok = () => localStorage.getItem('fp_token')
const api = (url, opts={}) => fetch(url, {headers:{'Authorization':`Bearer ${tok()}`,'Content-Type':'application/json'},...opts}).then(r=>r.json())

export default function AISchedulePage() {
  const qc = useQueryClient()
  const [form, setForm] = useState({name:'',topic:'',tone:'engaging',days:30,post_times:['09:00'],connection_ids:[]})
  const { data: connsData } = useQuery({ queryKey:['connections'], queryFn:()=>api('/api/connections') })
  const { data, isLoading } = useQuery({ queryKey:['ai-calendars'], queryFn:()=>api('/api/ai-calendars') })
  const create = useMutation({ mutationFn:()=>api('/api/ai-calendars',{method:'POST',body:JSON.stringify(form)}), onSuccess:()=>qc.invalidateQueries(['ai-calendars']) })
  const generate = useMutation({ mutationFn:id=>api(`/api/ai-calendars/${id}/generate`,{method:'POST'}), onSuccess:()=>qc.invalidateQueries(['ai-calendars']) })
  const cals = data?.data || []
  const conns = connsData?.data || []
  const inp = {background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:'var(--radius)',padding:'8px 12px',color:'var(--text)',fontSize:'13px',width:'100%'}
  const statusColor = {pending:'var(--text2)',generating:'var(--warning)',done:'var(--success)',error:'var(--danger)'}
  return (
    <div style={{padding:'24px'}}>
      <h1 style={{fontSize:'20px',fontWeight:700,marginBottom:'16px',color:'var(--text)',display:'flex',alignItems:'center',gap:8}}><Sparkles size={18}/>AI Content Calendar</h1>
      <div style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:'var(--radius)',padding:'16px',marginBottom:20}}>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
          <input style={inp} placeholder="Calendar name" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}/>
          <input style={inp} placeholder="Topic (e.g. SaaS marketing tips)" value={form.topic} onChange={e=>setForm(f=>({...f,topic:e.target.value}))}/>
          <select style={inp} value={form.tone} onChange={e=>setForm(f=>({...f,tone:e.target.value}))}>
            {['professional','casual','humorous','engaging','educational','inspirational'].map(t=><option key={t}>{t}</option>)}
          </select>
          <input style={inp} type="number" placeholder="Days (e.g. 30)" value={form.days} onChange={e=>setForm(f=>({...f,days:+e.target.value}))}/>
        </div>
        <div style={{marginBottom:10}}>
          <div style={{fontSize:'12px',color:'var(--text2)',marginBottom:6}}>Target connections:</div>
          <div style={{display:'flex',flexWrap:'wrap',gap:8}}>
            {conns.map(c=>(
              <label key={c.id} style={{display:'flex',alignItems:'center',gap:6,cursor:'pointer',color:'var(--text)',fontSize:'13px'}}>
                <input type="checkbox" checked={form.connection_ids.includes(c.id)} onChange={e=>{const ids=e.target.checked?[...form.connection_ids,c.id]:form.connection_ids.filter(x=>x!==c.id);setForm(f=>({...f,connection_ids:ids}))}}/>
                {c.name||c.account_id}
              </label>
            ))}
          </div>
        </div>
        <button onClick={()=>create.mutate()} disabled={!form.topic||create.isPending} style={{padding:'8px 14px',background:'var(--accent)',color:'#fff',border:'none',borderRadius:'var(--radius)',cursor:'pointer',fontSize:'13px',display:'flex',alignItems:'center',gap:6}}><Plus size={14}/>Create Calendar</button>
      </div>
      {isLoading ? <p style={{color:'var(--text2)'}}>Loading…</p> : cals.map(c=>(
        <div key={c.id} style={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:'var(--radius)',padding:'14px 16px',marginBottom:'8px',display:'flex',alignItems:'center',gap:12}}>
          <div style={{flex:1}}>
            <div style={{fontWeight:600,color:'var(--text)'}}>{c.name}</div>
            <div style={{fontSize:'12px',color:'var(--text2)'}}>{c.topic} · {c.tone} · {c.days} days</div>
          </div>
          <span style={{fontSize:'12px',fontWeight:600,color:statusColor[c.status]||'var(--text2)'}}>{c.status}</span>
          {c.status==='pending' && <button onClick={()=>generate.mutate(c.id)} disabled={generate.isPending} style={{padding:'6px 10px',background:'var(--accent)',color:'#fff',border:'none',borderRadius:'var(--radius)',cursor:'pointer',fontSize:'12px',display:'flex',alignItems:'center',gap:4}}><Play size={12}/>Generate</button>}
        </div>
      ))}
    </div>
  )
}
