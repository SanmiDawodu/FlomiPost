import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Tag, Plus, Trash2 } from 'lucide-react'

const tok = () => localStorage.getItem('fp_token')
const api = (url, opts={}) => fetch(url, {headers:{'Authorization':`Bearer ${tok()}`,'Content-Type':'application/json'},...opts}).then(r=>r.json())

const COLORS = ['#5b3cf5','#10b981','#f59e0b','#ff5c6a','#3b82f6','#8b5cf6','#ec4899','#14b8a6']

export default function LabelsPage() {
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [color, setColor] = useState(COLORS[0])
  const { data, isLoading } = useQuery({ queryKey:['labels'], queryFn:()=>api('/api/labels') })
  const create = useMutation({ mutationFn:()=>api('/api/labels',{method:'POST',body:JSON.stringify({name,color})}), onSuccess:()=>{qc.invalidateQueries(['labels']);setName('')} })
  const del = useMutation({ mutationFn:id=>api(`/api/labels/${id}`,{method:'DELETE'}), onSuccess:()=>qc.invalidateQueries(['labels']) })
  const labels = data?.data || []
  return (
    <div style={{padding:'24px'}}>
      <h1 style={{fontSize:'20px',fontWeight:700,marginBottom:'16px',color:'var(--text)',display:'flex',alignItems:'center',gap:8}}><Tag size={18}/>Labels</h1>
      <div style={{display:'flex',gap:8,marginBottom:20,alignItems:'center'}}>
        <input style={{flex:1,background:'var(--bg2)',border:'1px solid var(--border)',borderRadius:'var(--radius)',padding:'8px 12px',color:'var(--text)',fontSize:'13px'}} placeholder="Label name" value={name} onChange={e=>setName(e.target.value)}/>
        <div style={{display:'flex',gap:4}}>
          {COLORS.map(c=><button key={c} onClick={()=>setColor(c)} style={{width:22,height:22,borderRadius:'50%',background:c,border:c===color?'2px solid white':'2px solid transparent',cursor:'pointer'}}/>)}
        </div>
        <button onClick={()=>create.mutate()} style={{padding:'8px 14px',background:'var(--accent)',color:'#fff',border:'none',borderRadius:'var(--radius)',cursor:'pointer',fontSize:'13px',display:'flex',alignItems:'center',gap:6}}><Plus size={14}/>Add</button>
      </div>
      <div style={{display:'flex',flexWrap:'wrap',gap:10}}>
        {isLoading ? <p style={{color:'var(--text2)'}}>Loading…</p> : labels.map(l=>(
          <div key={l.id} style={{display:'flex',alignItems:'center',gap:8,padding:'6px 12px',borderRadius:'99px',background:`${l.color}22`,border:`1px solid ${l.color}55`}}>
            <span style={{width:8,height:8,borderRadius:'50%',background:l.color,display:'inline-block'}}/>
            <span style={{color:'var(--text)',fontSize:'13px',fontWeight:500}}>{l.name}</span>
            {l.post_count != null && <span style={{fontSize:'11px',color:'var(--text2)'}}>({l.post_count})</span>}
            <button onClick={()=>del.mutate(l.id)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text3)',padding:0,display:'flex'}}><Trash2 size={12}/></button>
          </div>
        ))}
      </div>
    </div>
  )
}
