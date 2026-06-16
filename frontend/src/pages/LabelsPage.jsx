import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Tag, Plus, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { api } from '../utils/api'

const labelsApi = {
  list: () => api.get('/labels'),
  create: (data) => api.post('/labels', data),
  delete: (id) => api.delete('/labels/'+id),
}

const COLORS = ['#5b3cf5','#00c2cb','#10b981','#ff5c6a','#f59e0b','#ec4899','#0a66c2','#ff4500']

export default function LabelsPage() {
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [color, setColor] = useState('#5b3cf5')
  const { data } = useQuery({ queryKey:['labels'], queryFn: labelsApi.list })
  const labels = data?.data ?? []

  const createMut = useMutation({
    mutationFn: () => labelsApi.create({ name, color }),
    onSuccess: () => { qc.invalidateQueries(['labels']); setName(''); toast.success('Label created') },
    onError: e => toast.error(e.message)
  })
  const deleteMut = useMutation({
    mutationFn: (id) => labelsApi.delete(id),
    onSuccess: () => qc.invalidateQueries(['labels'])
  })

  return (
    <div>
      <div className="fp-page-header">
        <div>
          <div className="fp-page-title">Labels</div>
          <div className="fp-page-sub">Organise posts with colour labels</div>
        </div>
      </div>
      <div className="fp-card" style={{marginBottom:16}}>
        <div className="fp-card-title" style={{marginBottom:14}}><Plus size={14}/> New Label</div>
        <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
          <input className="fp-input" placeholder="Label name" value={name} onChange={e=>setName(e.target.value)} style={{maxWidth:200}}/>
          <div style={{display:'flex',gap:6}}>
            {COLORS.map(c=>(
              <div key={c} onClick={()=>setColor(c)} style={{width:24,height:24,borderRadius:'50%',background:c,cursor:'pointer',border:color===c?'3px solid var(--text1)':'3px solid transparent'}}/>
            ))}
          </div>
          <button className="fp-btn fp-btn-primary fp-btn-sm" onClick={()=>createMut.mutate()} disabled={!name.trim()}><Plus size={13}/> Create</button>
        </div>
      </div>
      <div className="fp-card">
        <div className="fp-card-title" style={{marginBottom:14}}><Tag size={14}/> All Labels ({labels.length})</div>
        <div style={{display:'flex',flexWrap:'wrap',gap:10}}>
          {labels.length===0
            ? <div style={{fontSize:13,color:'var(--text3)'}}>No labels yet.</div>
            : labels.map(l=>(
              <div key={l.id} style={{display:'flex',alignItems:'center',gap:8,padding:'7px 14px',borderRadius:20,background:l.color+'22',border:'1.5px solid '+l.color+'44'}}>
                <div style={{width:10,height:10,borderRadius:'50%',background:l.color}}/>
                <span style={{fontSize:13,fontWeight:600,color:l.color}}>{l.name}</span>
                <button onClick={()=>deleteMut.mutate(l.id)} style={{background:'none',border:'none',cursor:'pointer',color:l.color,opacity:.6,padding:0,display:'flex'}}><Trash2 size={12}/></button>
              </div>
            ))
          }
        </div>
      </div>
    </div>
  )
}
