import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, sitesApi, connectionsApi, mediaApi } from '../utils/api'
import toast from 'react-hot-toast'
import { Plus, Trash2, Send, Upload, X, Phone, MessageSquare, Tag, Users, Search, FileText, CheckCircle } from 'lucide-react'

export default function WhatsAppContactsPage() {
  const qc = useQueryClient()

  // Site + segment filter
  const [siteId, setSiteId] = useState('')
  const [segmentId, setSegmentId] = useState('')
  const [search, setSearch] = useState('')

  // Modals
  const [showAdd, setShowAdd]         = useState(false)
  const [showImport, setShowImport]   = useState(false)
  const [showSegment, setShowSegment] = useState(false)
  const [showTest, setShowTest]       = useState(false)

  // Forms
  const [form, setForm]               = useState({ name:'', phone:'', segment_id:'' })
  const [importText, setImportText]   = useState('')
  const [importSeg, setImportSeg]     = useState('')
  const [importFile, setImportFile]   = useState(null)   // uploaded File object
  const [importMode, setImportMode]   = useState('file') // 'file' | 'paste'
  const [importPreview, setImportPreview] = useState([]) // parsed preview rows
  const fileInputRef                  = useRef(null)
  const [segForm, setSegForm]         = useState({ name:'', description:'' })
  const [testConn, setTestConn]       = useState('')
  const [testTo, setTestTo]           = useState('')
  const [testMsg, setTestMsg]         = useState('')
  const [testMedia, setTestMedia]     = useState(null)
  const [testUploading, setTestUploading] = useState(false)

  // Bulk selection
  const [selected, setSelected]       = useState([])
  const [bulkSeg, setBulkSeg]         = useState('')

  // ── Data fetching ──────────────────────────────────────────
  const { data: sitesRes } = useQuery({ queryKey:['sites'], queryFn: sitesApi.list })
  const sites = sitesRes?.data ?? []

  const { data: connsRes } = useQuery({ queryKey:['connections'], queryFn:()=>connectionsApi.list() })
  const allConns  = connsRes?.data ?? []
  const waConns   = allConns.filter(c => ['whatsapp_channel','whatsapp_broadcast'].includes(c.key_name) && (!siteId || String(c.site_id)===String(siteId)))

  const { data: segsRes, isLoading: segsLoading } = useQuery({
    queryKey: ['segments', siteId],
    queryFn:  () => siteId ? api.get(`/whatsapp/segments?site_id=${siteId}`) : Promise.resolve({ data:[] }),
    enabled: !!siteId,
  })
  const segments = segsRes?.data ?? []

  const { data: contactsRes, isLoading } = useQuery({
    queryKey: ['whatsapp-contacts', siteId, segmentId, search],
    queryFn: () => {
      if (!siteId) return Promise.resolve({ data:[] })
      let url = `/whatsapp/contacts?site_id=${siteId}`
      if (segmentId) url += `&segment_id=${segmentId}`
      if (search)    url += `&search=${encodeURIComponent(search)}`
      return api.get(url)
    },
    enabled: !!siteId,
  })
  const contacts = contactsRes?.data ?? []

  const siteName = id => sites.find(s=>String(s.id)===String(id))?.name || '—'

  // ── Mutations ──────────────────────────────────────────────
  const invalidate = () => {
    qc.invalidateQueries({ queryKey:['whatsapp-contacts'] })
    qc.invalidateQueries({ queryKey:['segments'] })
  }

  const addContact = useMutation({
    mutationFn: d => api.post('/whatsapp/contacts', { ...d, site_id: siteId }),
    onSuccess: () => { toast.success('Contact added'); invalidate(); setShowAdd(false); setForm({ name:'', phone:'', segment_id:'' }) },
    onError: e => toast.error(e.message || 'Failed'),
  })

  // Parse CSV/TXT lines into contacts array
  const parseLines = (text) => {
    return text.split('\n').map(l=>l.trim()).filter(Boolean).map(l => {
      // Support: "Name, Phone" or "Phone, Name" or just "Phone"
      const parts = l.split(',').map(p=>p.trim())
      if (parts.length === 1) return { phone: parts[0] }
      // Detect which part is phone (starts with + or is all digits)
      const isPhone = v => /^[+\d]/.test(v.replace(/[\s\-()]/g,''))
      if (isPhone(parts[0])) return { phone: parts[0], name: parts[1] || '' }
      return { name: parts[0], phone: parts[1] }
    }).filter(c => c.phone && c.phone.length >= 7)
  }

  // Handle file selection — read and preview
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setImportFile(file)
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target.result
      setImportText(text)
      const parsed = parseLines(text)
      setImportPreview(parsed.slice(0, 5)) // show first 5 as preview
    }
    reader.readAsText(file)
  }

  const resetImport = () => {
    setImportFile(null); setImportText(''); setImportPreview([])
    setImportSeg(''); setImportMode('file')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const importContacts = useMutation({
    mutationFn: () => {
      const contacts = parseLines(importText)
      if (!contacts.length) throw new Error('No valid contacts found in file')
      return api.post('/whatsapp/contacts/import', { site_id: siteId, segment_id: importSeg || null, contacts })
    },
    onSuccess: d => {
      toast.success(`${d.data?.added||0} imported, ${d.data?.duplicates||0} duplicates skipped`)
      invalidate(); setShowImport(false); resetImport()
    },
    onError: e => toast.error(e.message || 'Failed'),
  })

  const deleteContact = useMutation({
    mutationFn: id => api.delete(`/whatsapp/contacts/${id}`),
    onSuccess: () => { toast.success('Contact deleted'); invalidate() },
    onError: e => toast.error(e.message),
  })

  const bulkDelete = useMutation({
    mutationFn: () => api.post('/whatsapp/contacts/bulk-delete', { ids: selected }),
    onSuccess: () => { toast.success(`${selected.length} contacts deleted`); setSelected([]); invalidate() },
    onError: e => toast.error(e.message),
  })

  const bulkAssign = useMutation({
    mutationFn: () => api.post('/whatsapp/contacts/bulk-segment', { ids: selected, segment_id: bulkSeg }),
    onSuccess: () => { toast.success(`${selected.length} contacts updated`); setSelected([]); setBulkSeg(''); invalidate() },
    onError: e => toast.error(e.message),
  })

  const createSegment = useMutation({
    mutationFn: () => api.post('/whatsapp/segments', { ...segForm, site_id: siteId }),
    onSuccess: () => { toast.success('Segment created'); invalidate(); setShowSegment(false); setSegForm({ name:'', description:'' }) },
    onError: e => toast.error(e.message),
  })

  const deleteSegment = useMutation({
    mutationFn: id => api.delete(`/whatsapp/segments/${id}`),
    onSuccess: () => { toast.success('Segment deleted'); setSegmentId(''); invalidate() },
    onError: e => toast.error(e.message),
  })

  const testMutation = useMutation({
    mutationFn: () => {
      const isSegment = testTo.startsWith('seg:')
      const selectedSegment = isSegment ? testTo.replace('seg:','') : null
      const segId = selectedSegment === 'all' ? -1 : selectedSegment
      return api.post('/whatsapp/test', {
        connection_id: testConn,
        to:            isSegment ? null : testTo,
        segment_id:    segId || null,
        message:       testMsg,
        media_url:     testMedia?.url || null,
        media_type:    testMedia?.type || null
      })
    },
    onSuccess: d => {
      const sent = d.data?.sent_to
      toast.success(sent ? `Sent to ${sent} contacts!` : 'Message sent!')
      setShowTest(false); setTestMsg(''); setTestMedia(null)
    },
    onError: e => toast.error(e.message),
  })

  // ── Helpers ────────────────────────────────────────────────
  const toggleSelect  = id => setSelected(s => s.includes(id) ? s.filter(x=>x!==id) : [...s, id])
  const toggleAll     = () => setSelected(selected.length === contacts.length ? [] : contacts.map(c=>c.id))
  const fmtDate       = d => { try { return new Date(d).toLocaleDateString('en-US',{month:'short',day:'numeric',year:'numeric'}) } catch { return d?.slice(0,10)||'—' } }
  const segCount      = seg => contacts.filter(c=>String(c.segment_id)===String(seg.id)).length

  // ── Render ─────────────────────────────────────────────────
  return (
    <div>
      {/* Header */}
      <div className="fp-page-header">
        <div>
          <div className="fp-page-title">Contacts</div>
          <div className="fp-page-sub">Manage WhatsApp recipients shared across each site</div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="fp-btn fp-btn-ghost fp-btn-sm" onClick={()=>{ setTestConn(''); setTestTo(''); setTestMsg(''); setShowTest(true) }}>
            <Send size={13}/> Send Message
          </button>
          {siteId && <>
            <button className="fp-btn fp-btn-ghost fp-btn-sm" onClick={()=>setShowSegment(true)}><Tag size={13}/> New Segment</button>
            <button className="fp-btn fp-btn-ghost fp-btn-sm" onClick={()=>setShowImport(true)}><Upload size={13}/> Import</button>
            <button className="fp-btn fp-btn-primary fp-btn-sm" onClick={()=>setShowAdd(true)}><Plus size={13}/> Add Contact</button>
          </>}
        </div>
      </div>

      {/* Site selector */}
      <div className="fp-card" style={{ padding:'14px 18px', marginBottom:16 }}>
        <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
          <span style={{ fontSize:12, fontWeight:700, color:'var(--text3)', minWidth:36 }}>Site:</span>
          <button onClick={()=>{ setSiteId(''); setSegmentId('') }}
            style={{ padding:'5px 14px', borderRadius:8, cursor:'pointer', fontSize:13, fontWeight:700,
              border: !siteId ? 'none' : '1.5px solid var(--border)',
              background: !siteId ? 'var(--violet)' : 'var(--bg2)',
              color: !siteId ? '#fff' : 'var(--text2)' }}>All</button>
          {sites.map(s=>(
            <button key={s.id} onClick={()=>{ setSiteId(String(s.id)); setSegmentId('') }}
              style={{ padding:'5px 14px', borderRadius:8, cursor:'pointer', fontSize:13, fontWeight:600,
                border: siteId===String(s.id) ? 'none' : '1.5px solid var(--border)',
                background: siteId===String(s.id) ? 'var(--violet)' : 'var(--bg2)',
                color: siteId===String(s.id) ? '#fff' : 'var(--text2)' }}>{s.name}</button>
          ))}
          <a href="/sites" style={{ marginLeft:'auto', fontSize:12, color:'var(--violet)', textDecoration:'none', display:'flex', alignItems:'center', gap:4, padding:'5px 10px', borderRadius:8, border:'1.5px solid var(--border)', background:'var(--bg2)' }}>
            <Plus size={12}/> Manage Sites
          </a>
        </div>
      </div>

      <div style={{ display:'flex', gap:16 }}>
        {/* Segments sidebar */}
        {siteId && (
          <div style={{ width:200, flexShrink:0 }}>
            <div className="fp-card" style={{ padding:0, overflow:'hidden' }}>
              <div style={{ padding:'10px 14px', borderBottom:'1px solid var(--border)', fontSize:11, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.06em' }}>
                Segments
              </div>
              {/* All */}
              <div onClick={()=>setSegmentId('')}
                style={{ padding:'9px 14px', cursor:'pointer', borderBottom:'1px solid var(--bg3)',
                  background: !segmentId ? 'var(--violet-soft)' : 'transparent',
                  color: !segmentId ? 'var(--violet)' : 'var(--text2)',
                  fontWeight: !segmentId ? 700 : 400, fontSize:13, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <span><Users size={12} style={{ marginRight:5, verticalAlign:'middle' }}/>All Contacts</span>
                <span style={{ background:'var(--bg3)', borderRadius:10, padding:'1px 7px', fontSize:11, color:'var(--text3)' }}>{contacts.length}</span>
              </div>
              {/* Segments */}
              {segments.map(seg=>(
                <div key={seg.id}
                  style={{ padding:'9px 14px', cursor:'pointer', borderBottom:'1px solid var(--bg3)',
                    background: segmentId===String(seg.id) ? 'var(--violet-soft)' : 'transparent',
                    display:'flex', justifyContent:'space-between', alignItems:'center' }}
                  onClick={()=>setSegmentId(String(seg.id))}>
                  <span style={{ fontSize:13, color: segmentId===String(seg.id) ? 'var(--violet)' : 'var(--text2)', fontWeight: segmentId===String(seg.id) ? 700 : 400 }}>
                    <Tag size={11} style={{ marginRight:5, verticalAlign:'middle' }}/>{seg.name}
                  </span>
                  <div style={{ display:'flex', gap:4, alignItems:'center' }}>
                    <span style={{ background:'var(--bg3)', borderRadius:10, padding:'1px 6px', fontSize:11, color:'var(--text3)' }}>{seg.contact_count}</span>
                    <button onClick={e=>{ e.stopPropagation(); if(confirm(`Delete segment "${seg.name}"?`)) deleteSegment.mutate(seg.id) }}
                      style={{ background:'none', border:'none', cursor:'pointer', color:'var(--coral)', padding:'0 2px', lineHeight:1, fontSize:16 }}>×</button>
                  </div>
                </div>
              ))}
              {!segsLoading && segments.length===0 && (
                <div style={{ padding:'12px 14px', fontSize:12, color:'var(--text3)' }}>No segments yet</div>
              )}
            </div>
          </div>
        )}

        {/* Main content */}
        <div style={{ flex:1, minWidth:0 }}>
          {/* Stats */}
          {siteId && (
            <div className="fp-stats" style={{ marginBottom:16 }}>
              <div className="fp-stat fp-stat-violet">
                <div className="fp-stat-icon"><Phone size={16}/></div>
                <div className="fp-stat-val">{contacts.length}</div>
                <div className="fp-stat-lbl">{segmentId ? 'In Segment' : 'Total Contacts'}</div>
              </div>
              <div className="fp-stat fp-stat-green">
                <div className="fp-stat-icon"><Tag size={16}/></div>
                <div className="fp-stat-val">{segments.length}</div>
                <div className="fp-stat-lbl">Segments</div>
              </div>
              <div className="fp-stat fp-stat-blue">
                <div className="fp-stat-icon"><MessageSquare size={16}/></div>
                <div className="fp-stat-val">{waConns.length}</div>
                <div className="fp-stat-lbl">Active Channels</div>
              </div>
            </div>
          )}

          {/* Search + bulk actions */}
          {siteId && (
            <div style={{ display:'flex', gap:8, marginBottom:12, flexWrap:'wrap' }}>
              <div style={{ position:'relative', flex:1, minWidth:180 }}>
                <Search size={13} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'var(--text3)' }}/>
                <input className="fp-input" placeholder="Search name or phone…" value={search}
                  onChange={e=>setSearch(e.target.value)}
                  style={{ paddingLeft:30 }}/>
              </div>
              {selected.length > 0 && (
                <>
                  <select className="fp-select" value={bulkSeg} onChange={e=>setBulkSeg(e.target.value)} style={{ minWidth:140 }}>
                    <option value="">Assign segment…</option>
                    <option value="0">Remove segment</option>
                    {segments.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  <button className="fp-btn fp-btn-ghost fp-btn-sm" disabled={!bulkSeg||bulkAssign.isPending} onClick={()=>bulkAssign.mutate()}>
                    Assign ({selected.length})
                  </button>
                  <button className="fp-btn fp-btn-sm" style={{ background:'var(--coral)', color:'#fff', border:'none' }}
                    disabled={bulkDelete.isPending}
                    onClick={()=>{ if(confirm(`Delete ${selected.length} contacts?`)) bulkDelete.mutate() }}>
                    <Trash2 size={12}/> Delete ({selected.length})
                  </button>
                </>
              )}
            </div>
          )}

          {/* Contacts table */}
          <div className="fp-card">
            <div className="fp-card-title" style={{ marginBottom:16 }}>
              <Users size={14}/> Recipients
              {segmentId && segments.find(s=>String(s.id)===segmentId) && (
                <span style={{ marginLeft:8, fontSize:12, background:'var(--violet-soft)', color:'var(--violet)', padding:'2px 10px', borderRadius:10, fontWeight:600 }}>
                  {segments.find(s=>String(s.id)===segmentId)?.name}
                </span>
              )}
            </div>

            {!siteId ? (
              <div style={{ textAlign:'center', padding:'48px 0' }}>
                <div style={{ fontSize:36, marginBottom:12 }}>📋</div>
                <div style={{ fontSize:15, fontWeight:700, marginBottom:8 }}>Select a site to manage contacts</div>
                <div style={{ fontSize:13, color:'var(--text3)' }}>Contacts are shared across all WhatsApp connections per site</div>
              </div>
            ) : isLoading ? (
              <div className="fp-loader"><div className="fp-spinner"/></div>
            ) : contacts.length === 0 ? (
              <div style={{ textAlign:'center', padding:'40px 0' }}>
                <div style={{ fontSize:32, marginBottom:10 }}>📱</div>
                <div style={{ fontSize:15, fontWeight:700, marginBottom:8 }}>No contacts yet</div>
                <div style={{ fontSize:13, color:'var(--text3)', marginBottom:16 }}>Add contacts manually or import a CSV.</div>
                <div style={{ display:'flex', gap:8, justifyContent:'center' }}>
                  <button className="fp-btn fp-btn-ghost fp-btn-sm" onClick={()=>setShowImport(true)}><Upload size={13}/> Import CSV</button>
                  <button className="fp-btn fp-btn-primary fp-btn-sm" onClick={()=>setShowAdd(true)}><Plus size={13}/> Add Contact</button>
                </div>
              </div>
            ) : (
              <table className="fp-table">
                <thead>
                  <tr>
                    <th style={{ width:36 }}>
                      <input type="checkbox" checked={selected.length===contacts.length && contacts.length>0} onChange={toggleAll}/>
                    </th>
                    <th>Name</th>
                    <th>Phone Number</th>
                    <th>Segment</th>
                    <th>Date Added</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {contacts.map(c=>(
                    <tr key={c.id}>
                      <td><input type="checkbox" checked={selected.includes(c.id)} onChange={()=>toggleSelect(c.id)}/></td>
                      <td style={{ fontWeight:600 }}>{c.name || <span style={{ color:'var(--text3)' }}>—</span>}</td>
                      <td><code style={{ fontSize:13 }}>{c.phone}</code></td>
                      <td>
                        {c.segment_name
                          ? <span style={{ fontSize:11, background:'var(--violet-soft)', color:'var(--violet)', padding:'2px 9px', borderRadius:10, fontWeight:700 }}>{c.segment_name}</span>
                          : <span style={{ fontSize:12, color:'var(--text3)' }}>Unassigned</span>
                        }
                      </td>
                      <td style={{ fontSize:12, color:'var(--text3)', whiteSpace:'nowrap' }}>{fmtDate(c.created_at)}</td>
                      <td>
                        <button onClick={()=>{ if(confirm('Delete this contact?')) deleteContact.mutate(c.id) }}
                          style={{ background:'none', border:'none', cursor:'pointer', color:'var(--coral)' }}>
                          <Trash2 size={13}/>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {contacts.length > 0 && (
              <div style={{ padding:'10px 0 0', fontSize:12, color:'var(--text3)' }}>
                {contacts.length} contact{contacts.length!==1?'s':''} · {selected.length} selected
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── MODAL: Add Contact ── */}
      {showAdd && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:500, padding:20 }}
          onClick={e=>e.target===e.currentTarget&&setShowAdd(false)}>
          <div className="fp-modal">
            <div className="fp-modal-header">
              <div className="fp-modal-title">Add Contact</div>
              <button className="fp-modal-close" onClick={()=>setShowAdd(false)}><X size={18}/></button>
            </div>
            <div className="fp-field">
              <label className="fp-label">Name (optional)</label>
              <input className="fp-input" placeholder="John Smith" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))}/>
            </div>
            <div className="fp-field">
              <label className="fp-label">Phone Number *</label>
              <input className="fp-input" placeholder="+1234567890 (include country code)" value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))}/>
            </div>
            <div className="fp-field">
              <label className="fp-label">Segment (optional)</label>
              <select className="fp-select" value={form.segment_id} onChange={e=>setForm(f=>({...f,segment_id:e.target.value}))}>
                <option value="">No segment</option>
                {segments.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div style={{ display:'flex', gap:8, marginTop:16 }}>
              <button className="fp-btn fp-btn-ghost" onClick={()=>setShowAdd(false)}>Cancel</button>
              <button className="fp-btn fp-btn-primary" onClick={()=>addContact.mutate(form)} disabled={!form.phone.trim()||addContact.isPending}>
                {addContact.isPending ? 'Adding…' : 'Add Contact'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Import ── */}
      {showImport && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:500, padding:20 }}
          onClick={e=>e.target===e.currentTarget&&(setShowImport(false),resetImport())}>
          <div className="fp-modal" style={{ maxWidth:500 }}>
            <div className="fp-modal-header">
              <div className="fp-modal-title">Import Contacts</div>
              <button className="fp-modal-close" onClick={()=>{ setShowImport(false); resetImport() }}><X size={18}/></button>
            </div>

            {/* Mode toggle */}
            <div style={{ display:'flex', gap:0, marginBottom:16, borderRadius:8, overflow:'hidden', border:'1.5px solid var(--border)' }}>
              {[['file','📁 Upload File'],['paste','✏️ Paste Text']].map(([m,l])=>(
                <button key={m} onClick={()=>{ setImportMode(m); resetImport() }}
                  style={{ flex:1, padding:'8px', border:'none', cursor:'pointer', fontSize:13, fontWeight:600,
                    background: importMode===m ? 'var(--violet)' : 'var(--bg2)',
                    color: importMode===m ? '#fff' : 'var(--text2)' }}>{l}</button>
              ))}
            </div>

            {/* File upload mode */}
            {importMode === 'file' && (
              <>
                {/* File input — wrapped in label so clicking label opens picker reliably */}
                <input
                  id="fp-contact-file-input"
                  ref={fileInputRef}
                  type="file"
                  accept=".csv,.txt,.xls,.xlsx"
                  style={{ display:'none' }}
                  onChange={handleFileSelect}
                />

                {/* Drop zone */}
                {!importFile ? (
                  <label
                    htmlFor="fp-contact-file-input"
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => {
                      e.preventDefault()
                      const f = e.dataTransfer.files[0]
                      if (f) handleFileSelect({ target:{ files:[f] } })
                    }}
                    style={{ display:'block', border:'2px dashed var(--border)', borderRadius:12, padding:'36px 20px',
                      textAlign:'center', cursor:'pointer', background:'var(--bg2)', transition:'border-color .2s' }}
                    onMouseEnter={e=>e.currentTarget.style.borderColor='var(--violet)'}
                    onMouseLeave={e=>e.currentTarget.style.borderColor='var(--border)'}>
                    <div style={{ fontSize:36, marginBottom:8 }}>📂</div>
                    <div style={{ fontSize:15, fontWeight:700, marginBottom:4 }}>Click to browse or drag & drop</div>
                    <div style={{ fontSize:12, color:'var(--text3)' }}>Supports .csv, .txt files</div>
                    <div style={{ fontSize:11, color:'var(--text3)', marginTop:8, background:'var(--bg3)', display:'inline-block', padding:'4px 12px', borderRadius:6 }}>
                      Format: <code>Name, +Phone</code> or just <code>+Phone</code> — one per line
                    </div>
                  </label>
                ) : (
                  /* File selected — show preview */
                  <div style={{ border:'1.5px solid var(--violet)', borderRadius:12, padding:16, background:'var(--violet-soft)' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
                      <FileText size={20} color="var(--violet)"/>
                      <div style={{ flex:1 }}>
                        <div style={{ fontSize:14, fontWeight:700 }}>{importFile.name}</div>
                        <div style={{ fontSize:12, color:'var(--text3)' }}>
                          {(importFile.size/1024).toFixed(1)} KB · {parseLines(importText).length} contacts found
                        </div>
                      </div>
                      <button onClick={resetImport} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text3)' }}><X size={16}/></button>
                    </div>

                    {/* Preview table */}
                    {importPreview.length > 0 && (
                      <div style={{ background:'var(--bg)', borderRadius:8, overflow:'hidden', border:'1px solid var(--border)' }}>
                        <div style={{ padding:'6px 12px', fontSize:11, fontWeight:700, color:'var(--text3)', background:'var(--bg3)', textTransform:'uppercase' }}>
                          Preview (first {importPreview.length})
                        </div>
                        {importPreview.map((c,i)=>(
                          <div key={i} style={{ display:'flex', gap:12, padding:'6px 12px', borderTop:'1px solid var(--bg3)', fontSize:13 }}>
                            <CheckCircle size={13} color="#10b981" style={{ marginTop:2, flexShrink:0 }}/>
                            <span style={{ color:'var(--text3)', minWidth:100 }}>{c.name || <em>no name</em>}</span>
                            <code>{c.phone}</code>
                          </div>
                        ))}
                        {parseLines(importText).length > 5 && (
                          <div style={{ padding:'6px 12px', fontSize:12, color:'var(--text3)', borderTop:'1px solid var(--bg3)' }}>
                            …and {parseLines(importText).length - 5} more
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {/* Paste text mode */}
            {importMode === 'paste' && (
              <>
                <div style={{ fontSize:13, color:'var(--text3)', marginBottom:10, background:'var(--bg3)', padding:'10px 14px', borderRadius:8 }}>
                  One per line: <code>Name, +1234567890</code> or just <code>+1234567890</code>
                </div>
                <textarea className="fp-textarea"
                  placeholder={"+12025551234\nJohn Doe, +12025555678\nPastor Mike, +2348012345678"}
                  value={importText} onChange={e=>{ setImportText(e.target.value); setImportPreview(parseLines(e.target.value).slice(0,5)) }}
                  style={{ height:140, resize:'vertical' }}/>
                {importText.trim() && (
                  <div style={{ fontSize:12, color:'var(--text3)', marginTop:4 }}>
                    {parseLines(importText).length} valid contacts detected
                  </div>
                )}
              </>
            )}

            {/* Segment selector */}
            <div className="fp-field" style={{ marginTop:14 }}>
              <label className="fp-label">Assign to Segment (optional)</label>
              <select className="fp-select" value={importSeg} onChange={e=>setImportSeg(e.target.value)}>
                <option value="">No segment</option>
                {segments.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            <div style={{ display:'flex', gap:8, marginTop:16 }}>
              <button className="fp-btn fp-btn-ghost" onClick={()=>{ setShowImport(false); resetImport() }}>Cancel</button>
              <button className="fp-btn fp-btn-primary" style={{ flex:1 }}
                onClick={()=>importContacts.mutate()}
                disabled={!importText.trim()||importContacts.isPending||parseLines(importText).length===0}>
                <Upload size={13}/>
                {importContacts.isPending ? ' Importing…' : ` Import ${parseLines(importText).length || ''} Contacts`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: New Segment ── */}
      {showSegment && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:500, padding:20 }}
          onClick={e=>e.target===e.currentTarget&&setShowSegment(false)}>
          <div className="fp-modal">
            <div className="fp-modal-header">
              <div className="fp-modal-title">Create Segment</div>
              <button className="fp-modal-close" onClick={()=>setShowSegment(false)}><X size={18}/></button>
            </div>
            <div className="fp-field">
              <label className="fp-label">Segment Name *</label>
              <input className="fp-input" placeholder="e.g. Prayer Partners" value={segForm.name} onChange={e=>setSegForm(f=>({...f,name:e.target.value}))}/>
            </div>
            <div className="fp-field">
              <label className="fp-label">Description (optional)</label>
              <input className="fp-input" placeholder="Short description" value={segForm.description} onChange={e=>setSegForm(f=>({...f,description:e.target.value}))}/>
            </div>
            <div style={{ display:'flex', gap:8, marginTop:16 }}>
              <button className="fp-btn fp-btn-ghost" onClick={()=>setShowSegment(false)}>Cancel</button>
              <button className="fp-btn fp-btn-primary" onClick={()=>createSegment.mutate()} disabled={!segForm.name.trim()||createSegment.isPending}>
                {createSegment.isPending ? 'Creating…' : 'Create Segment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: Send Message ── */}
      {showTest && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:500, padding:20 }}
          onClick={e=>e.target===e.currentTarget&&setShowTest(false)}>
          <div className="fp-modal" style={{ maxWidth:480 }}>
            <div className="fp-modal-header">
              <div className="fp-modal-title">Send Message</div>
              <button className="fp-modal-close" onClick={()=>setShowTest(false)}><X size={18}/></button>
            </div>

            {/* Connection */}
            <div className="fp-field">
              <label className="fp-label">WhatsApp Connection</label>
              <select className="fp-select" value={testConn} onChange={e=>setTestConn(e.target.value)}>
                <option value="">Select connection…</option>
                {waConns.map(c=>(
                  <option key={c.id} value={c.id}>{siteName(c.site_id)} — {c.account_name}</option>
                ))}
              </select>
            </div>

            {/* Send to: Segment or Single number */}
            <div className="fp-field">
              <label className="fp-label">Send To</label>
              <div style={{ display:'flex', gap:0, borderRadius:8, overflow:'hidden', border:'1.5px solid var(--border)', marginBottom:10 }}>
                {[['number','Specific Number'],['segment','A Segment']].map(([m,l])=>(
                  <button key={m}
                    data-mode={m}
                    style={{ flex:1, padding:'8px', border:'none', cursor:'pointer', fontSize:13, fontWeight:600,
                      background: (m==='number'&&!testTo.startsWith('seg:')) || (m==='segment'&&testTo.startsWith('seg:')) ? 'var(--violet)' : 'var(--bg2)',
                      color: (m==='number'&&!testTo.startsWith('seg:')) || (m==='segment'&&testTo.startsWith('seg:')) ? '#fff' : 'var(--text2)' }}
                    onClick={()=>setTestTo(m==='segment'?'seg:':'')}>
                    {l}
                  </button>
                ))}
              </div>

              {testTo.startsWith('seg:') ? (
                /* Segment picker */
                <div>
                  <select className="fp-select" value={testTo}
                    onChange={e=>setTestTo(e.target.value)}>
                    <option value="seg:">Select segment…</option>
                    {segments.map(s=>(
                      <option key={s.id} value={`seg:${s.id}`}>
                        {s.name} ({s.contact_count} contacts)
                      </option>
                    ))}
                    <option value="seg:all">All Contacts (entire site)</option>
                  </select>
                  {testTo !== 'seg:' && testTo !== 'seg:all' && (
                    <div style={{ marginTop:6, fontSize:12, color:'#f59e0b', background:'#fef3c7', padding:'6px 10px', borderRadius:6 }}>
                      ⚠️ This will send to all contacts in the selected segment
                    </div>
                  )}
                  {testTo === 'seg:all' && (
                    <div style={{ marginTop:6, fontSize:12, color:'var(--coral)', background:'#fef2f2', padding:'6px 10px', borderRadius:6 }}>
                      ⛔ This sends to ALL contacts on the site — use with caution
                    </div>
                  )}
                </div>
              ) : (
                /* Single number */
                <input className="fp-input" placeholder="+1234567890 (with country code)"
                  value={testTo} onChange={e=>setTestTo(e.target.value)}/>
              )}
            </div>

            {/* Message */}
            <div className="fp-field">
              <label className="fp-label">Message</label>
              <textarea className="fp-textarea" placeholder="Type your message…"
                value={testMsg} onChange={e=>setTestMsg(e.target.value)} style={{ height:90 }}/>
              <div style={{ fontSize:11, color:'var(--text3)', marginTop:4, textAlign:'right' }}>{testMsg.length} chars</div>
            </div>

            <div className="fp-field">
              <label className="fp-label">Attachment (optional)</label>
              {testMedia ? (
                <div style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, padding:'6px 10px', background:'var(--bg3)', borderRadius:8 }}>
                  <span style={{ flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{testMedia.name} <span style={{ color:'var(--text3)' }}>({testMedia.type})</span></span>
                  <button type="button" onClick={()=>setTestMedia(null)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--coral)', fontSize:18, lineHeight:1 }}>x</button>
                </div>
              ) : (
                <label className="fp-btn fp-btn-ghost fp-btn-sm" style={{ cursor: testUploading?'wait':'pointer', display:'inline-flex', alignItems:'center', gap:6 }}>
                  {testUploading ? 'Uploading...' : 'Attach image / video / voice note'}
                  <input type="file" accept="image/*,video/*,audio/*" style={{ display:'none' }} disabled={testUploading}
                    onChange={async e=>{ const f=e.target.files?.[0]; if(!f) return; setTestUploading(true); try { const r=await mediaApi.upload(f, siteId||undefined); const m=r.data||{}; const mt=(m.mime_type||'').startsWith('image')?'image':(m.mime_type||'').startsWith('video')?'video':(m.mime_type||'').startsWith('audio')?'audio':'document'; setTestMedia({ url:m.url, type:mt, name:m.filename||f.name }); } catch(err){ toast.error(err.message||'Upload failed'); } finally { setTestUploading(false); e.target.value=''; } }}/>
                </label>
              )}
            </div>

            <div style={{ display:'flex', gap:8, marginTop:8 }}>
              <button className="fp-btn fp-btn-ghost" onClick={()=>setShowTest(false)}>Cancel</button>
              <button className="fp-btn fp-btn-primary"
                style={{ flex:1, background:'#25D366' }}
                onClick={()=>testMutation.mutate()}
                disabled={!testConn||(testTo.startsWith('seg:')?testTo==='seg:':!testTo.trim())||(!testMsg.trim()&&!testMedia)||testUploading||testMutation.isPending}>
                <Send size={13}/> {testMutation.isPending?'Sending…':'Send WhatsApp'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
