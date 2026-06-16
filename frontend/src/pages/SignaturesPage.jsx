import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { api } from '../utils/api'
import toast from 'react-hot-toast'
import { Plus, Trash2, Edit2, PenLine } from 'lucide-react'

export default function SignaturesPage() {
  const [showAdd, setShowAdd] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({ name:'', content:'' })

  const { data, refetch } = useQuery({ queryKey:['signatures'], queryFn: ()=>api.get('/signatures') })
  const sigs = data?.data ?? []

  const create = useMutation({ mutationFn: ()=>api.post('/signatures',form),
    onSuccess:()=>{ toast.success('Signature created!'); refetch(); setShowAdd(false); setForm({name:'',content:''}) }, onError:e=>toast.error(e.message) })
  const update = useMutation({ mutationFn: id=>api.put('/signatures/'+id,form),
    onSuccess:()=>{ toast.success('Updated!'); refetch(); setEditing(null) }, onError:e=>toast.error(e.message) })
  const del = useMutation({ mutationFn: id=>api.delete('/signatures/'+id),
    onSuccess:()=>{ toast.success('Deleted'); refetch() } })

  const FormPanel = ({onSave,onCancel}) => (
    <div className="fp-card" style={{marginBottom:16}}>
      <input className="fp-input" placeholder="Signature name" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} style={{marginBottom:8,width:'100%'}}/>
      <textarea className="fp-input" rows={4} placeholder="Signature content..." value={form.content} onChange={e=>setForm(f=>({...f,content:e.target.value}))} style={{width:'100%',resize:'vertical',marginBottom:8}}/>
      <div style={{display:'flex',gap:8}}>
        <button className="fp-btn fp-btn-primary fp-btn-sm" onClick={onSave}>Save</button>
        <button className="fp-btn fp-btn-ghost fp-btn-sm" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  )

  return (
    <div>
      <div className="fp-page-header" style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:24}}>
        <div><h1 className="fp-page-title">Signatures</h1>
          <p className="fp-page-sub">Create reusable signatures to append to your posts</p></div>
        <button className="fp-btn fp-btn-primary" onClick={()=>setShowAdd(v=>!v)}><Plus size={14}/> New Signature</button>
      </div>

      {showAdd && <FormPanel onSave={()=>create.mutate()} onCancel={()=>setShowAdd(false)}/>}

      <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))',gap:12}}>
        {sigs.length===0 && <div className="fp-card" style={{textAlign:'center',color:'var(--text3)',padding:40,gridColumn:'1/-1'}}><PenLine size={32} style={{opacity:0.3,marginBottom:8}}/><br/>No signatures yet.</div>}
        {sigs.map(s=>(
          <div key={s.id} className="fp-card">
            {editing===s.id
              ? <FormPanel onSave={()=>update.mutate(s.id)} onCancel={()=>setEditing(null)}/>
              : <>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                    <div style={{fontWeight:700}}>{s.name}</div>
                    <div style={{display:'flex',gap:4}}>
                      <button className="fp-btn fp-btn-ghost fp-btn-sm" onClick={()=>{setEditing(s.id);setForm({name:s.name,content:s.content})}}><Edit2 size={12}/></button>
                      <button className="fp-btn fp-btn-ghost fp-btn-sm" style={{color:'var(--red)'}} onClick={()=>del.mutate(s.id)}><Trash2 size={12}/></button>
                    </div>
                  </div>
                  <pre style={{fontSize:12,color:'var(--text2)',whiteSpace:'pre-wrap',fontFamily:'inherit',margin:0}}>{s.content}</pre>
                </>
            }
          </div>
        ))}
      </div>
    </div>
  )
}
