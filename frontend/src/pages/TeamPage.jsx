import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { api } from '../utils/api'
import toast from 'react-hot-toast'
import { Plus, Trash2, Users, Copy } from 'lucide-react'

export default function TeamPage() {
  const [showInvite, setShowInvite] = useState(false)
  const [form, setForm] = useState({ email:'', role:'editor' })
  const [inviteUrl, setInviteUrl] = useState('')

  const { data, refetch } = useQuery({ queryKey:['team'], queryFn: ()=>api.get('/team') })
  const members = data?.data ?? []

  const invite = useMutation({ mutationFn: ()=>api.post('/team/invite',form),
    onSuccess: r=>{ toast.success('Invite sent!'); setInviteUrl(r.data?.invite_url||''); refetch() },
    onError: e=>toast.error(e.message) })

  const remove = useMutation({ mutationFn: id=>api.delete('/team/'+id),
    onSuccess:()=>{ toast.success('Removed'); refetch() } })

  return (
    <div>
      <div className="fp-page-header" style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:24}}>
        <div><h1 className="fp-page-title">Team</h1>
          <p className="fp-page-sub">Invite team members to collaborate on your FlomiPost account</p></div>
        <button className="fp-btn fp-btn-primary" onClick={()=>setShowInvite(v=>!v)}><Plus size={14}/> Invite Member</button>
      </div>

      {showInvite && (
        <div className="fp-card" style={{marginBottom:16}}>
          <div style={{fontWeight:700,marginBottom:12}}>Invite Team Member</div>
          <div style={{display:'flex',gap:10,marginBottom:10}}>
            <input className="fp-input" placeholder="Email address" type="email" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} style={{flex:1}}/>
            <select className="fp-select" style={{width:140}} value={form.role} onChange={e=>setForm(f=>({...f,role:e.target.value}))}>
              <option value="admin">Admin</option>
              <option value="editor">Editor</option>
              <option value="viewer">Viewer</option>
            </select>
            <button className="fp-btn fp-btn-primary" onClick={()=>invite.mutate()}>Send Invite</button>
          </div>
          {inviteUrl && (
            <div style={{display:'flex',gap:8,alignItems:'center',padding:'8px 12px',background:'var(--bg2)',borderRadius:8}}>
              <span style={{fontSize:12,flex:1,fontFamily:'monospace',overflow:'hidden',textOverflow:'ellipsis'}}>{inviteUrl}</span>
              <button className="fp-btn fp-btn-ghost fp-btn-sm" onClick={()=>{navigator.clipboard.writeText(inviteUrl);toast.success('Copied!')}}>
                <Copy size={12}/> Copy
              </button>
            </div>
          )}
        </div>
      )}

      <div className="fp-card">
        <div style={{fontWeight:700,marginBottom:16}}>Members ({members.length})</div>
        {members.length===0 && <div style={{textAlign:'center',color:'var(--text3)',padding:30}}><Users size={32} style={{opacity:0.3,marginBottom:8}}/><br/>No team members yet.</div>}
        {members.map(m=>(
          <div key={m.id} style={{display:'flex',alignItems:'center',gap:12,padding:'10px 0',borderBottom:'1px solid var(--border)'}}>
            <div style={{width:36,height:36,borderRadius:'50%',background:'var(--primary)',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontWeight:700,fontSize:13}}>
              {(m.member_name||m.email||'?')[0].toUpperCase()}
            </div>
            <div style={{flex:1}}>
              <div style={{fontWeight:600,fontSize:13}}>{m.member_name||m.email}</div>
              {m.member_name && <div style={{fontSize:12,color:'var(--text3)'}}>{m.email}</div>}
            </div>
            <span style={{fontSize:11,padding:'3px 8px',borderRadius:12,background:'var(--primary-10)',color:'var(--primary)',fontWeight:600}}>{m.role}</span>
            <span style={{fontSize:11,color:m.accepted?'var(--green)':'var(--orange)'}}>{m.accepted?'Active':'Pending'}</span>
            <button className="fp-btn fp-btn-ghost fp-btn-sm" style={{color:'var(--red)'}} onClick={()=>remove.mutate(m.id)}><Trash2 size={12}/></button>
          </div>
        ))}
      </div>
    </div>
  )
}
