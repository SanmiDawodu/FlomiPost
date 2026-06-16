// UsersPage.jsx
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { usersApi } from '../utils/api'
import toast from 'react-hot-toast'
import { Users, Plus, X } from 'lucide-react'

export default function UsersPage() {
  const qc = useQueryClient()
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState({ name:'', email:'', password:'', role:'editor', timezone:'America/Chicago' })

  const { data, isLoading } = useQuery({ queryKey: ['users'], queryFn: usersApi.list })
  const users = data?.data ?? []

  const addMutation = useMutation({
    mutationFn: usersApi.create,
    onSuccess: () => {
      toast.success('User created!')
      qc.invalidateQueries({ queryKey: ['users'] })
      setShowAdd(false)
      setForm({ name:'', email:'', password:'', role:'editor', timezone:'America/Chicago' })
    },
    onError: (e) => toast.error(e.message),
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, active }) => usersApi.update(id, { active: active ? 0 : 1 }),
    onSuccess: () => { toast.success('Updated'); qc.invalidateQueries({ queryKey: ['users'] }) },
    onError: (e) => toast.error(e.message),
  })

  return (
    <div>
      <div className="fp-page-header">
        <div>
          <div className="fp-page-title">Team</div>
          <div className="fp-page-sub">{users.length} users</div>
        </div>
        <button className="fp-btn fp-btn-primary fp-btn-sm" onClick={() => setShowAdd(true)}>
          <Plus size={13}/> Add User
        </button>
      </div>

      {showAdd && (
        <div className="fp-modal-bg" onClick={e => e.target === e.currentTarget && setShowAdd(false)}>
          <div className="fp-modal">
            <div className="fp-modal-header">
              <div className="fp-modal-title">Add Team Member</div>
              <button className="fp-modal-close" onClick={() => setShowAdd(false)}><X size={18}/></button>
            </div>
            {[
              { label:'Name', key:'name', type:'text', placeholder:'Full name' },
              { label:'Email', key:'email', type:'email', placeholder:'email@domain.com' },
              { label:'Password', key:'password', type:'password', placeholder:'Temp password' },
            ].map(f => (
              <div className="fp-field" key={f.key}>
                <label className="fp-label">{f.label}</label>
                <input className="fp-input" type={f.type} placeholder={f.placeholder}
                  value={form[f.key]} onChange={e => setForm(p => ({...p,[f.key]:e.target.value}))}/>
              </div>
            ))}
            <div className="fp-field">
              <label className="fp-label">Role</label>
              <select className="fp-select" value={form.role} onChange={e => setForm(p=>({...p,role:e.target.value}))}>
                <option value="admin">Admin</option>
                <option value="editor">Editor</option>
                <option value="viewer">Viewer</option>
              </select>
            </div>
            <div style={{ display:'flex', gap:8, marginTop:8 }}>
              <button className="fp-btn fp-btn-ghost" onClick={() => setShowAdd(false)}>Cancel</button>
              <button className="fp-btn fp-btn-primary" onClick={() => addMutation.mutate(form)} disabled={addMutation.isPending}>
                Create User
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="fp-card">
        <div className="fp-card-title"><Users size={15}/> Team Members</div>
        {isLoading ? <div className="fp-loader"><div className="fp-spinner"/></div> : (
          <div className="fp-table-wrap">
            <table className="fp-table">
              <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td>
                      <div style={{display:'flex',alignItems:'center',gap:8}}>
                        <div style={{width:28,height:28,borderRadius:'50%',background:'var(--gold-dim)',border:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:11,fontWeight:700,color:'var(--gold)',fontFamily:'Syne,sans-serif'}}>
                          {u.name[0].toUpperCase()}
                        </div>
                        {u.name}
                      </div>
                    </td>
                    <td style={{fontSize:12,color:'var(--text3)'}}>{u.email}</td>
                    <td>
                      <span style={{
                        fontSize:10,padding:'2px 8px',borderRadius:20,fontWeight:600,
                        background: u.role==='admin'?'rgba(201,168,76,.12)':u.role==='editor'?'rgba(29,158,117,.12)':'rgba(255,255,255,.06)',
                        color: u.role==='admin'?'var(--gold)':u.role==='editor'?'var(--green)':'var(--text3)'
                      }}>{u.role}</span>
                    </td>
                    <td>
                      <span style={{fontSize:10,padding:'2px 8px',borderRadius:20,background:u.active?'rgba(29,158,117,.12)':'rgba(255,255,255,.05)',color:u.active?'var(--green)':'var(--text3)'}}>
                        {u.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <button className="fp-btn fp-btn-ghost fp-btn-sm" onClick={() => toggleMutation.mutate({ id: u.id, active: u.active })}>
                        {u.active ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
