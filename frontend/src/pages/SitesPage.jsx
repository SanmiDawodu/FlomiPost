import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Globe, Plus, Trash2 } from 'lucide-react'

const tok = () => localStorage.getItem('fp_token')
const api = (url, opts={}) => fetch(url, {headers:{'Authorization':`Bearer ${tok()}`,'Content-Type':'application/json'},...opts}).then(r=>r.json())
const s = { page:{padding:'24px'}, h1:{fontSize:'20px',fontWeight:700,marginBottom:'16px',color:'var(--text)'}, row:{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:'var(--radius)',padding:'14px 16px',marginBottom:'8px',display:'flex',alignItems:'center',gap:12}, inp:{background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:'var(--radius)',padding:'8px 12px',color:'var(--text)',fontSize:'13px',width:'100%'}, btn:{padding:'8px 14px',borderRadius:'var(--radius)',border:'none',cursor:'pointer',fontSize:'13px'} }

export default function SitesPage() {
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [domain, setDomain] = useState('')
  const { data, isLoading } = useQuery({ queryKey:['sites'], queryFn:()=>api('/api/sites') })
  const create = useMutation({ mutationFn:()=>api('/api/sites',{method:'POST',body:JSON.stringify({name,domain})}), onSuccess:()=>{qc.invalidateQueries(['sites']);setName('');setDomain('')} })
  const del = useMutation({ mutationFn:id=>api(`/api/sites/${id}`,{method:'DELETE'}), onSuccess:()=>qc.invalidateQueries(['sites']) })
  const sites = data?.data || []
  return (
    <div style={s.page}>
      <h1 style={s.h1}><Globe size={18} style={{marginRight:8,verticalAlign:'middle'}}/>Sites</h1>
      <div style={{display:'flex',gap:8,marginBottom:20}}>
        <input style={s.inp} placeholder="Site name" value={name} onChange={e=>setName(e.target.value)}/>
        <input style={s.inp} placeholder="Domain" value={domain} onChange={e=>setDomain(e.target.value)}/>
        <button style={{...s.btn,background:'var(--accent)',color:'#fff',whiteSpace:'nowrap'}} onClick={()=>create.mutate()}><Plus size={14}/> Add</button>
      </div>
      {isLoading ? <p style={{color:'var(--text2)'}}>Loading…</p> : sites.map(s2=>(
        <div key={s2.id} style={s.row}>
          <div style={{flex:1}}><div style={{fontWeight:600,color:'var(--text)'}}>{s2.name}</div><div style={{fontSize:'12px',color:'var(--text2)'}}>{s2.domain}</div></div>
          <button onClick={()=>del.mutate(s2.id)} style={{padding:'6px',background:'rgba(255,92,106,0.1)',border:'none',borderRadius:'6px',cursor:'pointer',color:'var(--danger)'}}><Trash2 size={14}/></button>
        </div>
      ))}
    </div>
  )
}
