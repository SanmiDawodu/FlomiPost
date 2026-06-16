import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../utils/api'
import toast from 'react-hot-toast'
import { Plus, X, Calendar, Flag, User, RotateCcw, Edit2, Trash2 } from 'lucide-react'

const PRIORITY = {
  low:    { bg:'#f0fdf4', text:'#16a34a', border:'#bbf7d0', label:'Low' },
  medium: { bg:'#eff6ff', text:'#2563eb', border:'#bfdbfe', label:'Medium' },
  high:   { bg:'#fff7ed', text:'#ea580c', border:'#fed7aa', label:'High' },
  urgent: { bg:'#fef2f2', text:'#dc2626', border:'#fecaca', label:'Urgent' },
}

const COLUMNS = [
  { key:'todo',       label:'To Do',       emoji:'📋', color:'#6366f1' },
  { key:'inprogress', label:'In Progress', emoji:'⚡', color:'#f59e0b' },
  { key:'done',       label:'Done',        emoji:'✅', color:'#10b981' },
]

const CAT_ICONS = { church:'⛪', pen:'✍️', book:'📚', pray:'🙏', task:'📋' }
const RECURRING = { none:'No repeat', daily:'Daily', weekly:'Weekly', monthly:'Monthly' }

function dueBadge(d) {
  if (!d) return null
  const date = new Date(d + 'T00:00:00')
  const today = new Date(); today.setHours(0,0,0,0)
  const diff  = Math.ceil((date - today) / 86400000)
  if (diff < 0)  return { label:`${Math.abs(diff)}d overdue`, color:'#dc2626' }
  if (diff === 0) return { label:'Due today',    color:'#ea580c' }
  if (diff === 1) return { label:'Due tomorrow', color:'#d97706' }
  return { label: date.toLocaleDateString('en-US',{month:'short',day:'numeric'}), color:'var(--text3)' }
}

export default function TodoPage() {
  const qc = useQueryClient()
  const [showModal, setShowModal] = useState(false)
  const [editTask, setEditTask]   = useState(null)
  const [filterCat, setFilterCat] = useState('')
  const [filterPri, setFilterPri] = useState('')
  const [dragId, setDragId]       = useState(null)
  const [dragOver, setDragOver]   = useState(null)

  const { data: todosRes, isLoading } = useQuery({
    queryKey: ['todos', filterCat],
    queryFn: () => api.get('/todos' + (filterCat ? `?category_id=${filterCat}` : '')),
    refetchInterval: 60000,
  })
  const { data: catsRes  } = useQuery({ queryKey:['todo-cats'],  queryFn: () => api.get('/todo-categories') })
  const { data: usersRes } = useQuery({ queryKey:['users'],      queryFn: () => api.get('/users') })

  const todos = todosRes?.data ?? []
  const cats  = catsRes?.data  ?? []
  const users = usersRes?.data ?? []

  const filtered = useMemo(() =>
    filterPri ? todos.filter(t => t.priority === filterPri) : todos
  , [todos, filterPri])

  const columns = useMemo(() =>
    COLUMNS.reduce((acc, col) => ({ ...acc, [col.key]: filtered.filter(t => t.status === col.key) }), {})
  , [filtered])

  const updateMut = useMutation({
    mutationFn: ({id, ...data}) => api.put(`/todos/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey:['todos'] }),
    onError: e => toast.error(e.message),
  })

  const deleteMut = useMutation({
    mutationFn: id => api.delete(`/todos/${id}`),
    onSuccess: () => { toast.success('Task deleted'); qc.invalidateQueries({ queryKey:['todos'] }) },
  })

  const openAdd = (status) => { setEditTask(status ? {status} : null); setShowModal(true) }
  const openEdit = (task)  => { setEditTask(task); setShowModal(true) }
  const closeModal = ()    => { setShowModal(false); setEditTask(null) }

  const onDragStart = (e, id) => { setDragId(id); e.dataTransfer.effectAllowed='move' }
  const onDragOver  = (e, col) => { e.preventDefault(); setDragOver(col) }
  const onDrop      = (e, col) => {
    e.preventDefault()
    const task = todos.find(t=>t.id===dragId)
    if (dragId && task?.status !== col) {
      updateMut.mutate({ id:dragId, status:col })
      toast.success(`Moved to ${COLUMNS.find(c=>c.key===col)?.label}`)
    }
    setDragId(null); setDragOver(null)
  }

  const done  = todos.filter(t=>t.status==='done').length
  const total = todos.length
  const pct   = total ? Math.round((done/total)*100) : 0

  return (
    <div>
      {/* Header */}
      <div className="fp-page-header">
        <div>
          <div className="fp-page-title">Tasks</div>
          <div className="fp-page-sub">{total} tasks · {done} done · {pct}% complete</div>
        </div>
        <button className="fp-btn fp-btn-primary" onClick={()=>openAdd(null)}>
          <Plus size={14}/> New Task
        </button>
      </div>

      {/* Progress bar */}
      {total > 0 && (
        <div style={{ height:6, background:'var(--border)', borderRadius:3, overflow:'hidden', marginBottom:20 }}>
          <div style={{ height:'100%', width:`${pct}%`, background:'linear-gradient(90deg,#7c3aed,#10b981)', borderRadius:3, transition:'width .4s' }}/>
        </div>
      )}

      {/* Filters */}
      <div style={{ display:'flex', gap:8, marginBottom:20, flexWrap:'wrap' }}>
        <select className="fp-select" style={{ width:'auto', fontSize:13 }} value={filterCat} onChange={e=>setFilterCat(e.target.value)}>
          <option value="">All Categories</option>
          {cats.map(c=><option key={c.id} value={c.id}>{CAT_ICONS[c.icon]||'📋'} {c.name}</option>)}
        </select>
        <select className="fp-select" style={{ width:'auto', fontSize:13 }} value={filterPri} onChange={e=>setFilterPri(e.target.value)}>
          <option value="">All Priorities</option>
          {Object.entries(PRIORITY).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
        </select>
        {(filterCat||filterPri) && (
          <button className="fp-btn fp-btn-ghost fp-btn-sm" onClick={()=>{setFilterCat('');setFilterPri('')}}>
            <X size={12}/> Clear
          </button>
        )}
      </div>

      {/* Kanban Board */}
      {isLoading ? (
        <div className="fp-loader"><div className="fp-spinner"/></div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:16, alignItems:'start' }}>
          {COLUMNS.map(col => (
            <div key={col.key}
              onDragOver={e=>onDragOver(e,col.key)}
              onDrop={e=>onDrop(e,col.key)}
              onDragLeave={()=>setDragOver(null)}
              style={{
                background: dragOver===col.key ? col.color+'12' : 'var(--bg2)',
                border: dragOver===col.key ? `2px dashed ${col.color}` : '1.5px solid var(--border)',
                borderRadius:14, padding:14, minHeight:320, transition:'all .15s',
              }}>

              {/* Column header */}
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:14 }}>
                <span style={{ fontSize:18 }}>{col.emoji}</span>
                <span style={{ fontWeight:700, fontSize:14 }}>{col.label}</span>
                <span style={{ marginLeft:'auto', fontSize:11, fontWeight:700, padding:'2px 8px',
                  borderRadius:12, background:col.color+'18', color:col.color }}>
                  {columns[col.key]?.length ?? 0}
                </span>
              </div>

              {/* Task cards */}
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {(columns[col.key] ?? []).map(task => {
                  const pri = PRIORITY[task.priority] || PRIORITY.medium
                  const due = dueBadge(task.due_date)
                  const cat = cats.find(c=>c.id===task.category_id)

                  return (
                    <div key={task.id} draggable
                      onDragStart={e=>onDragStart(e,task.id)}
                      style={{
                        background:'var(--bg)', border:'1.5px solid var(--border)',
                        borderLeft:`3px solid ${cat?.color||col.color}`,
                        borderRadius:10, padding:'10px 12px',
                        cursor:'grab', opacity:dragId===task.id?0.5:1, transition:'all .15s',
                      }}>

                      {/* Title row */}
                      <div style={{ display:'flex', alignItems:'flex-start', gap:6, marginBottom:6 }}>
                        <div style={{ flex:1, fontSize:13, fontWeight:600, lineHeight:1.4,
                          textDecoration:task.status==='done'?'line-through':'none',
                          opacity:task.status==='done'?0.6:1 }}>
                          {task.title}
                        </div>
                        <div style={{ display:'flex', gap:3, flexShrink:0 }}>
                          <button onClick={()=>openEdit(task)}
                            style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text3)', padding:2 }}>
                            <Edit2 size={12}/>
                          </button>
                          <button onClick={()=>{ if(window.confirm('Delete this task?')) deleteMut.mutate(task.id) }}
                            style={{ background:'none', border:'none', cursor:'pointer', color:'var(--coral)', padding:2 }}>
                            <Trash2 size={12}/>
                          </button>
                        </div>
                      </div>

                      {/* Notes */}
                      {task.notes && (
                        <div style={{ fontSize:11, color:'var(--text3)', marginBottom:6, lineHeight:1.4 }}>
                          {task.notes.slice(0,80)}{task.notes.length>80?'…':''}
                        </div>
                      )}

                      {/* Badges */}
                      <div style={{ display:'flex', gap:4, flexWrap:'wrap', alignItems:'center' }}>
                        <span style={{ fontSize:10, fontWeight:700, padding:'2px 6px', borderRadius:6,
                          background:pri.bg, color:pri.text, border:`1px solid ${pri.border}` }}>
                          {pri.label}
                        </span>
                        {cat && (
                          <span style={{ fontSize:10, fontWeight:600, padding:'2px 6px', borderRadius:6,
                            background:cat.color+'15', color:cat.color }}>
                            {CAT_ICONS[cat.icon]||'📋'} {cat.name}
                          </span>
                        )}
                        {due && (
                          <span style={{ fontSize:10, fontWeight:600, color:due.color, marginLeft:'auto',
                            display:'flex', alignItems:'center', gap:3 }}>
                            <Calendar size={10}/> {due.label}
                          </span>
                        )}
                        {task.recurring !== 'none' && (
                          <span style={{ fontSize:10, color:'var(--text3)', display:'flex', alignItems:'center', gap:3 }}>
                            <RotateCcw size={10}/> {task.recurring}
                          </span>
                        )}
                      </div>

                      {/* Assigned */}
                      {task.assigned_name && (
                        <div style={{ marginTop:6, fontSize:11, color:'var(--text3)', display:'flex', alignItems:'center', gap:4 }}>
                          <User size={10}/> {task.assigned_name}
                        </div>
                      )}

                      {/* Move buttons */}
                      <div style={{ display:'flex', gap:4, marginTop:8 }}>
                        {COLUMNS.filter(c=>c.key!==col.key).map(c=>(
                          <button key={c.key}
                            onClick={()=>updateMut.mutate({id:task.id,status:c.key})}
                            style={{ flex:1, fontSize:10, fontWeight:600, padding:'4px', borderRadius:6,
                              border:`1px solid ${c.color}30`, background:c.color+'10', color:c.color, cursor:'pointer' }}>
                            → {c.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )
                })}

                {/* Add in column */}
                <button onClick={()=>openAdd(col.key)}
                  style={{ width:'100%', padding:'8px', borderRadius:8, border:'1.5px dashed var(--border)',
                    background:'none', cursor:'pointer', fontSize:12, color:'var(--text3)',
                    display:'flex', alignItems:'center', justifyContent:'center', gap:6 }}>
                  <Plus size={13}/> Add task
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <TaskModal task={editTask} cats={cats} users={users}
          onClose={closeModal}
          onSave={()=>{ closeModal(); qc.invalidateQueries({queryKey:['todos']}) }}/>
      )}
    </div>
  )
}

function TaskModal({ task, cats, users, onClose, onSave }) {
  const isEdit = !!(task?.id)
  const [form, setForm] = useState({
    title:       task?.title       ?? '',
    notes:       task?.notes       ?? '',
    status:      task?.status      ?? 'todo',
    priority:    task?.priority    ?? 'medium',
    category_id: task?.category_id ?? '',
    assigned_to: task?.assigned_to ?? '',
    due_date:    task?.due_date    ?? '',
    recurring:   task?.recurring   ?? 'none',
  })
  const set = (k,v) => setForm(f=>({...f,[k]:v}))

  const saveMut = useMutation({
    mutationFn: () => {
      const payload = { ...form, category_id:form.category_id||null, assigned_to:form.assigned_to||null, due_date:form.due_date||null }
      return isEdit ? api.put(`/todos/${task.id}`, payload) : api.post('/todos', payload)
    },
    onSuccess: () => { toast.success(isEdit?'Task updated!':'Task created!'); onSave() },
    onError: e => toast.error(e.message),
  })

  const CAT_ICONS = { church:'⛪', pen:'✍️', book:'📚', pray:'🙏', task:'📋' }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.6)', display:'flex',
      alignItems:'center', justifyContent:'center', zIndex:500, padding:20 }}
      onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="fp-modal" style={{ maxWidth:520, maxHeight:'90vh', overflowY:'auto' }}>
        <div className="fp-modal-header">
          <div className="fp-modal-title">{isEdit?'Edit Task':'New Task'}</div>
          <button className="fp-modal-close" onClick={onClose}><X size={18}/></button>
        </div>

        <div className="fp-field">
          <label className="fp-label">Title *</label>
          <input className="fp-input" placeholder="What needs to be done?" autoFocus
            value={form.title} onChange={e=>set('title',e.target.value)}/>
        </div>

        <div className="fp-field">
          <label className="fp-label">Notes</label>
          <textarea className="fp-textarea" placeholder="Additional details…" style={{ height:80 }}
            value={form.notes} onChange={e=>set('notes',e.target.value)}/>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <div className="fp-field">
            <label className="fp-label">Status</label>
            <select className="fp-select" value={form.status} onChange={e=>set('status',e.target.value)}>
              {COLUMNS.map(c=><option key={c.key} value={c.key}>{c.emoji} {c.label}</option>)}
            </select>
          </div>
          <div className="fp-field">
            <label className="fp-label">Priority</label>
            <select className="fp-select" value={form.priority} onChange={e=>set('priority',e.target.value)}>
              {Object.entries(PRIORITY).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <div className="fp-field">
            <label className="fp-label">Category</label>
            <select className="fp-select" value={form.category_id} onChange={e=>set('category_id',e.target.value)}>
              <option value="">No category</option>
              {cats.map(c=><option key={c.id} value={c.id}>{CAT_ICONS[c.icon]||'📋'} {c.name}</option>)}
            </select>
          </div>
          <div className="fp-field">
            <label className="fp-label">Assign To</label>
            <select className="fp-select" value={form.assigned_to} onChange={e=>set('assigned_to',e.target.value)}>
              <option value="">Unassigned</option>
              {users.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <div className="fp-field">
            <label className="fp-label">Due Date</label>
            <input className="fp-input" type="date" value={form.due_date} onChange={e=>set('due_date',e.target.value)}/>
          </div>
          <div className="fp-field">
            <label className="fp-label">Repeat</label>
            <select className="fp-select" value={form.recurring} onChange={e=>set('recurring',e.target.value)}>
              {Object.entries(RECURRING).map(([k,v])=><option key={k} value={k}>{v}</option>)}
            </select>
          </div>
        </div>

        <div style={{ display:'flex', gap:8, marginTop:8 }}>
          <button className="fp-btn fp-btn-ghost" onClick={onClose}>Cancel</button>
          <button className="fp-btn fp-btn-primary" style={{ flex:1 }}
            onClick={()=>saveMut.mutate()}
            disabled={!form.title.trim()||saveMut.isPending}>
            {saveMut.isPending ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Task'}
          </button>
        </div>
      </div>
    </div>
  )
}
