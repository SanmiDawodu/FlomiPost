import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, mediaApi } from '../utils/api'
import toast from 'react-hot-toast'
import { Mail, MailOpen, Send, RefreshCw, CornerUpLeft, Plus, Trash2, X, ChevronLeft, Paperclip } from 'lucide-react'

const PROVIDERS = [
  { v: 'gmail',   l: 'Gmail / Google Workspace' },
  { v: 'outlook', l: 'Outlook / Microsoft 365' },
  { v: 'yahoo',   l: 'Yahoo Mail' },
  { v: 'custom',  l: 'Other (custom IMAP)' },
]

export default function EmailInboxPage() {
  const qc = useQueryClient()
  const [selectedId, setSelectedId] = useState(null)
  const [reply, setReply] = useState('')
  const [replyFiles, setReplyFiles] = useState([])   // [{id, name}]
  const [replyUploading, setReplyUploading] = useState(false)
  const [onlyUnread, setOnlyUnread] = useState(false)
  const [acctFilter, setAcctFilter] = useState('')
  const [showAccts, setShowAccts] = useState(false)
  const [selected, setSelected] = useState([])
  const [limit, setLimit] = useState(100)
  const [selectAllMatching, setSelectAllMatching] = useState(false)
  const [form, setForm] = useState({ label:'', email:'', provider:'gmail', app_password:'', imap_host:'', imap_port:'993', smtp_host:'', smtp_port:'587' })
  const toggleSel = (id) => { setSelectAllMatching(false); setSelected(s => s.includes(id) ? s.filter(x=>x!==id) : [...s, id]) }
  useEffect(() => { setLimit(100); setSelected([]); setSelectAllMatching(false) }, [onlyUnread, acctFilter])

  // resizable split + responsive
  const [listW, setListW] = useState(() => Number(localStorage.getItem('emailListW')) || 380)
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768)
  useEffect(() => { localStorage.setItem('emailListW', String(listW)) }, [listW])
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  const startDrag = (e) => {
    e.preventDefault()
    const startX = e.clientX, startW = listW
    const onMove = (ev) => setListW(Math.min(640, Math.max(240, startW + (ev.clientX - startX))))
    const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
  }
  const startDragTouch = (e) => {
    const startX = e.touches[0].clientX, startW = listW
    const onMove = (ev) => setListW(Math.min(640, Math.max(240, startW + (ev.touches[0].clientX - startX))))
    const onUp = () => { document.removeEventListener('touchmove', onMove); document.removeEventListener('touchend', onUp) }
    document.addEventListener('touchmove', onMove, { passive: true })
    document.addEventListener('touchend', onUp)
  }

  const { data: acctRes } = useQuery({ queryKey:['email-accounts'], queryFn:()=>api.get('/email/accounts') })
  const accounts = acctRes?.data ?? []

  const listQS = [`per_page=${limit}`, onlyUnread ? 'unread=1' : '', acctFilter ? `account_id=${acctFilter}` : ''].filter(Boolean).join('&')
  const { data: listRes, isLoading } = useQuery({
    queryKey: ['email-inbox', onlyUnread, acctFilter, limit],
    queryFn: () => api.get(`/email/inbox?${listQS}`),
    refetchInterval: 60000,
  })
  const emails = listRes?.data ?? []
  const total = listRes?.meta?.total ?? emails.length

  const { data: openRes } = useQuery({
    queryKey: ['email-inbox', 'msg', selectedId],
    queryFn: () => api.get(`/email/inbox/${selectedId}`),
    enabled: !!selectedId,
  })
  const open = openRes?.data

  const replyMut = useMutation({
    mutationFn: () => api.post(`/email/inbox/${selectedId}/reply`, { reply, attachment_ids: replyFiles.map(f=>f.id) }),
    onSuccess: (d) => { toast.success(d.message || 'Reply sent'); setReply(''); setReplyFiles([]); qc.invalidateQueries({ queryKey:['email-inbox'] }) },
    onError: e => toast.error(e.message || 'Reply failed'),
  })
  const delMail = useMutation({
    mutationFn: (id) => api.delete(`/email/inbox/${id}`),
    onSuccess: (_d, id) => { if (id === selectedId) setSelectedId(null); qc.invalidateQueries({ queryKey:['email-inbox'] }) },
    onError: e => toast.error(e.message),
  })
  const allMatchBody = () => ({ all: true, account_id: acctFilter || null, unread: onlyUnread ? 1 : 0 })
  const bulkDel = useMutation({
    mutationFn: () => api.post('/email/inbox/bulk-delete', selectAllMatching ? allMatchBody() : { ids: selected }),
    onSuccess: (d) => { toast.success(`Deleted ${d.data?.deleted ?? selected.length}`); setSelectedId(null); setSelected([]); setSelectAllMatching(false); qc.invalidateQueries({ queryKey:['email-inbox'] }) },
    onError: e => toast.error(e.message),
  })
  const bulkRead = useMutation({
    mutationFn: (read) => api.post('/email/inbox/bulk-read', selectAllMatching ? { ...allMatchBody(), read } : { ids: selected, read }),
    onSuccess: (d) => { toast.success(d.message || 'Updated'); setSelected([]); setSelectAllMatching(false); qc.invalidateQueries({ queryKey:['email-inbox'] }) },
    onError: e => toast.error(e.message),
  })
  const addMut = useMutation({
    mutationFn: () => api.post('/email/accounts', form),
    onSuccess: (d) => { toast.success(d.message || 'Account added'); setForm({ label:'', email:'', provider:'gmail', app_password:'', imap_host:'', imap_port:'993', smtp_host:'', smtp_port:'587' }); qc.invalidateQueries({ queryKey:['email-accounts'] }) },
    onError: e => toast.error(e.message || 'Could not add account'),
  })
  const delAcct = useMutation({
    mutationFn: (id) => api.delete(`/email/accounts/${id}`),
    onSuccess: () => { toast.success('Account removed'); qc.invalidateQueries({ queryKey:['email-accounts'] }); qc.invalidateQueries({ queryKey:['email-inbox'] }) },
    onError: e => toast.error(e.message),
  })

  const uploadReplyFiles = async (fileList) => {
    setReplyUploading(true)
    try {
      for (const f of Array.from(fileList)) {
        const r = await mediaApi.upload(f)
        const m = r.data || {}
        setReplyFiles(prev => [...prev, { id: m.id, name: m.filename || f.name }])
      }
    } catch (e) { toast.error(e.message || 'Upload failed') }
    finally { setReplyUploading(false) }
  }

  const fmt = d => d ? new Date(d.replace(' ', 'T') + 'Z').toLocaleString('en', { month:'short', day:'numeric', hour:'numeric', minute:'2-digit' }) : ''

  const listPane = (
    <div className="fp-card" style={{ padding:0, height:'72vh', overflowY:'auto' }}>
      {emails.length>0 && (
        <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 14px', borderBottom:'1px solid var(--border)', position:'sticky', top:0, background:'var(--bg2)', zIndex:2 }}>
          <input type="checkbox" checked={selectAllMatching || (emails.length>0 && selected.length===emails.length)} ref={el=>{ if(el) el.indeterminate = !selectAllMatching && selected.length>0 && selected.length<emails.length }} onChange={()=>{ if(selectAllMatching || selected.length===emails.length){ setSelected([]); setSelectAllMatching(false) } else { setSelected(emails.map(e=>e.id)) } }} style={{ cursor:'pointer' }}/>
          <span style={{ fontSize:12, fontWeight:600, color:'var(--text2)' }}>{selectAllMatching ? `All ${total}` : (selected.length>0 ? `${selected.length} selected` : `Select all ${emails.length}`)}</span>
        </div>
      )}
      {isLoading ? <div style={{padding:24,color:'var(--text3)'}}>Loading…</div>
        : emails.length===0 ? <div style={{padding:24,color:'var(--text3)',textAlign:'center'}}>No emails{accounts.length===0?' — add an account to begin.':' here yet.'}</div>
        : (<>
          {emails.map(e => (
            <div key={e.id} onClick={()=>{setSelectedId(e.id); setReply(''); setReplyFiles([])}}
              style={{ position:'relative', padding:'12px 34px 12px 34px', borderBottom:'1px solid var(--border)', cursor:'pointer', background:selectedId===e.id?'var(--violet-lt)':(selected.includes(e.id)?'var(--violet-lt)':(e.is_read?'transparent':'var(--bg3)')) }}>
              <input type="checkbox" checked={selected.includes(e.id)} onClick={ev=>ev.stopPropagation()} onChange={()=>toggleSel(e.id)} style={{ position:'absolute', left:11, top:15, cursor:'pointer' }}/>
              <div style={{ display:'flex', justifyContent:'space-between', gap:8 }}>
                <span style={{ fontWeight:e.is_read?500:700, fontSize:13, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {!e.is_read && <span style={{display:'inline-block',width:7,height:7,borderRadius:'50%',background:'var(--violet)',marginRight:6}}/>}
                  {e.from_name || e.from_email}
                </span>
                <span style={{ fontSize:11, color:'var(--text3)', whiteSpace:'nowrap' }}>{fmt(e.received_at)}</span>
              </div>
              <div style={{ fontSize:13, fontWeight:e.is_read?400:600, marginTop:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{e.subject}</div>
              <div style={{ fontSize:12, color:'var(--text3)', marginTop:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {e.replied_at && <CornerUpLeft size={11} style={{verticalAlign:'middle',marginRight:4,color:'var(--green)'}}/>}
                {e.snippet}
              </div>
              {!acctFilter && accounts.length>1 && <div style={{ fontSize:10, color:'var(--violet)', marginTop:3 }}>→ {e.account_email}</div>}
              <button title="Delete" onClick={(ev)=>{ ev.stopPropagation(); delMail.mutate(e.id) }} style={{ position:'absolute', top:10, right:8, background:'none', border:'none', cursor:'pointer', color:'var(--text3)', opacity:.6 }}><Trash2 size={13}/></button>
            </div>
          ))}
          {emails.length>=limit && <div style={{ padding:14, textAlign:'center' }}><button className="fp-btn fp-btn-ghost fp-btn-sm" onClick={()=>setLimit(l=>Math.min(500,l+100))}>Load older emails ↓</button></div>}
        </>)}
    </div>
  )

  const readPane = (
    <div className="fp-card" style={{ height:'72vh', overflowY:'auto' }}>
      {!open ? (
        <div style={{ textAlign:'center', color:'var(--text3)', padding:60 }}>
          <Mail size={32} style={{opacity:.4}}/><div style={{marginTop:10}}>Select an email to read</div>
        </div>
      ) : (
        <div>
          <div style={{ display:'flex', alignItems:'flex-start', gap:8 }}>
            {isMobile && <button className="fp-btn fp-btn-ghost fp-btn-sm" onClick={()=>setSelectedId(null)}><ChevronLeft size={14}/> Back</button>}
            <div style={{ flex:1 }}>
              <div style={{ fontSize:17, fontWeight:700 }}>{open.subject}</div>
              <div style={{ fontSize:13, color:'var(--text2)' }}><strong>{open.from_name||''}</strong> &lt;{open.from_email}&gt;</div>
              <div style={{ fontSize:12, color:'var(--text3)' }}>{fmt(open.received_at)} · to {open.account_email}</div>
            </div>
            <button title="Delete" onClick={()=>delMail.mutate(open.id)} className="fp-btn fp-btn-ghost fp-btn-sm" style={{ color:'var(--coral)' }}><Trash2 size={14}/></button>
          </div>
          {open.body_html ? (
            <iframe title="email-body" sandbox="allow-popups allow-popups-to-escape-sandbox" srcDoc={'<base target="_blank" rel="noopener noreferrer">' + open.body_html} style={{ width:'100%', height:'40vh', border:'none', borderTop:'1px solid var(--border)', marginTop:14, background:'#fff' }} />
          ) : (
            <div style={{ whiteSpace:'pre-wrap', fontSize:14, lineHeight:1.6, borderTop:'1px solid var(--border)', paddingTop:14, marginTop:14 }}>{open.body || open.snippet}</div>
          )}
          <div style={{ marginTop:14, borderTop:'1px solid var(--border)', paddingTop:14 }}>
            <div className="fp-label" style={{marginBottom:6}}>Reply (sends from {open.account_email})</div>
            <textarea className="fp-textarea" value={reply} onChange={e=>setReply(e.target.value)} placeholder="Type your reply…" style={{height:100,width:'100%'}}/>
            {replyFiles.length>0 && (
              <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop:8 }}>
                {replyFiles.map((f,i)=>(
                  <span key={i} style={{ display:'inline-flex', alignItems:'center', gap:5, fontSize:12, padding:'3px 8px', background:'var(--bg3)', borderRadius:6 }}>
                    <Paperclip size={11}/>{f.name}
                    <button onClick={()=>setReplyFiles(prev=>prev.filter((_,j)=>j!==i))} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--coral)', lineHeight:1 }}>×</button>
                  </span>
                ))}
              </div>
            )}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:8 }}>
              <label className="fp-btn fp-btn-ghost fp-btn-sm" style={{ cursor: replyUploading?'wait':'pointer' }}>
                <Paperclip size={13}/> {replyUploading?'Uploading…':'Attach'}
                <input type="file" multiple style={{ display:'none' }} disabled={replyUploading} onChange={e=>{ if(e.target.files?.length) uploadReplyFiles(e.target.files); e.target.value='' }}/>
              </label>
              <button className="fp-btn fp-btn-primary" onClick={()=>replyMut.mutate()} disabled={(!reply.trim()&&replyFiles.length===0)||replyMut.isPending}><Send size={13}/> {replyMut.isPending?'Sending…':'Send Reply'}</button>
            </div>
            {open.replied_at && <div style={{ fontSize:12, color:'var(--green)', marginTop:6 }}>✓ Replied {fmt(open.replied_at)}</div>}
          </div>
        </div>
      )}
    </div>
  )

  return (
    <div>
      <div className="fp-page-header">
        <div>
          <div className="fp-page-title">Email Inbox</div>
          <div className="fp-page-sub">{accounts.length} account{accounts.length===1?'':'s'} connected — read &amp; reply in one place</div>
        </div>
        <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
          <button className="fp-btn fp-btn-primary fp-btn-sm" onClick={()=>setShowAccts(true)}><Plus size={13}/> Add Account</button>
          <button className="fp-btn fp-btn-ghost fp-btn-sm" onClick={()=>setOnlyUnread(v=>!v)}>{onlyUnread?'Unread':'All mail'}</button>
          <button className="fp-btn fp-btn-ghost fp-btn-sm" onClick={()=>qc.invalidateQueries({queryKey:['email-inbox']})}><RefreshCw size={13}/></button>
        </div>
      </div>

      {accounts.length > 0 && (
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:14 }}>
          <button onClick={()=>setAcctFilter('')} style={chip(acctFilter==='')}>All inboxes</button>
          {accounts.map(a => (
            <button key={a.id} onClick={()=>setAcctFilter(String(a.id))} style={chip(acctFilter===String(a.id))} title={a.last_error ? ('Error: '+a.last_error) : (a.last_fetch ? ('Synced '+fmt(a.last_fetch)) : 'Not synced yet')}>
              {a.last_error ? '⚠ ' : ''}{a.email} <span style={{opacity:.6}}>({a.email_count})</span>
            </button>
          ))}
        </div>
      )}

      {(selected.length > 0 || selectAllMatching) && (
        <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap', padding:'8px 12px', background:'var(--violet-lt)', borderRadius:8, marginBottom:10 }}>
          <span style={{ fontSize:13, fontWeight:600 }}>{selectAllMatching ? `All ${total} in this inbox selected` : `${selected.length} selected`}</span>
          {!selectAllMatching && selected.length===emails.length && total>emails.length && (
            <button className="fp-btn fp-btn-ghost fp-btn-sm" style={{ color:'var(--violet)', fontWeight:700 }} onClick={()=>setSelectAllMatching(true)}>Select all {total} in this inbox</button>
          )}
          <button className="fp-btn fp-btn-ghost fp-btn-sm" onClick={()=>bulkRead.mutate(1)} disabled={bulkRead.isPending}><MailOpen size={13}/> Mark read</button>
          <button className="fp-btn fp-btn-ghost fp-btn-sm" onClick={()=>bulkRead.mutate(0)} disabled={bulkRead.isPending}><Mail size={13}/> Mark unread</button>
          <button className="fp-btn fp-btn-sm" style={{ background:'var(--coral)', color:'#fff' }} onClick={()=>{ const n = selectAllMatching ? total : selected.length; if(window.confirm('Delete '+n+' emails?')) bulkDel.mutate() }} disabled={bulkDel.isPending}><Trash2 size={13}/> {bulkDel.isPending?'Deleting…':'Delete'}</button>
          <button className="fp-btn fp-btn-ghost fp-btn-sm" onClick={()=>{ setSelected([]); setSelectAllMatching(false) }}>Clear</button>
        </div>
      )}

      {isMobile ? (
        (selectedId && open) ? readPane : listPane
      ) : (
        <div style={{ display:'flex', alignItems:'stretch', gap:0 }}>
          <div style={{ width:listW, flexShrink:0 }}>{listPane}</div>
          <div onMouseDown={startDrag} onTouchStart={startDragTouch} title="Drag to resize"
            style={{ width:12, cursor:'col-resize', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', touchAction:'none' }}>
            <div style={{ width:4, height:48, borderRadius:3, background:'var(--violet-md)' }}/>
          </div>
          <div style={{ flex:1, minWidth:0 }}>{readPane}</div>
        </div>
      )}

      {showAccts && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:500, padding:20 }} onClick={e=>e.target===e.currentTarget&&setShowAccts(false)}>
          <div className="fp-modal" style={{ maxWidth:560, width:'100%' }}>
            <div className="fp-modal-header">
              <div className="fp-modal-title">Email Accounts</div>
              <button className="fp-modal-close" onClick={()=>setShowAccts(false)}><X size={18}/></button>
            </div>
            {accounts.length>0 && (
              <div style={{ marginBottom:16, maxHeight:'30vh', overflowY:'auto' }}>
                {accounts.map(a => (
                  <div key={a.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 10px', background:'var(--bg3)', borderRadius:8, marginBottom:6 }}>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:13, fontWeight:600 }}>{a.email}</div>
                      <div style={{ fontSize:11, color:a.last_error?'var(--coral)':'var(--text3)' }}>{a.last_error ? ('⚠ '+a.last_error.slice(0,60)) : (a.last_fetch?('Synced '+fmt(a.last_fetch)+' · '+a.email_count+' emails'):'Awaiting first sync…')}</div>
                    </div>
                    <button onClick={()=>{ if(window.confirm('Remove '+a.email+' and its emails?')) delAcct.mutate(a.id) }} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--coral)' }}><Trash2 size={15}/></button>
                  </div>
                ))}
              </div>
            )}
            <div style={{ borderTop:'1px solid var(--border)', paddingTop:14 }}>
              <div style={{ fontWeight:700, fontSize:13, marginBottom:10 }}>Connect a new account</div>
              <div className="fp-field"><label className="fp-label">Provider</label>
                <select className="fp-select" value={form.provider} onChange={e=>setForm(f=>({...f,provider:e.target.value}))}>
                  {PROVIDERS.map(p=><option key={p.v} value={p.v}>{p.l}</option>)}
                </select>
              </div>
              <div className="fp-field"><label className="fp-label">Email address</label>
                <input className="fp-input" placeholder="you@gmail.com" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))}/>
              </div>
              <div className="fp-field"><label className="fp-label">App password</label>
                <input className="fp-input" type="password" placeholder="16-char app password" value={form.app_password} onChange={e=>setForm(f=>({...f,app_password:e.target.value}))}/>
                <div style={{ fontSize:11, color:'var(--text3)', marginTop:4 }}>
                  {form.provider==='gmail' && 'Google → Security → App passwords (needs 2-Step Verification on).'}
                  {form.provider==='outlook' && 'Outlook.com → Security → App passwords. Work/365 accounts may have IMAP disabled.'}
                  {form.provider==='yahoo' && 'Yahoo → Account Security → Generate app password.'}
                  {form.provider==='custom' && 'Use your mailbox password or app-specific password.'}
                </div>
              </div>
              {form.provider==='custom' && (
                <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:8 }}>
                  <div className="fp-field"><label className="fp-label">IMAP host</label><input className="fp-input" placeholder="imap.example.com" value={form.imap_host} onChange={e=>setForm(f=>({...f,imap_host:e.target.value}))}/></div>
                  <div className="fp-field"><label className="fp-label">IMAP port</label><input className="fp-input" value={form.imap_port} onChange={e=>setForm(f=>({...f,imap_port:e.target.value}))}/></div>
                  <div className="fp-field"><label className="fp-label">SMTP host</label><input className="fp-input" placeholder="smtp.example.com" value={form.smtp_host} onChange={e=>setForm(f=>({...f,smtp_host:e.target.value}))}/></div>
                  <div className="fp-field"><label className="fp-label">SMTP port</label><input className="fp-input" value={form.smtp_port} onChange={e=>setForm(f=>({...f,smtp_port:e.target.value}))}/></div>
                </div>
              )}
              <button className="fp-btn fp-btn-primary" style={{ width:'100%', marginTop:6 }} onClick={()=>addMut.mutate()} disabled={!form.email.trim()||!form.app_password.trim()||addMut.isPending}>
                {addMut.isPending?'Connecting…':'Connect Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function chip(active) {
  return { padding:'5px 12px', borderRadius:16, cursor:'pointer', fontSize:12, fontWeight:600,
    border: active?'none':'1.5px solid var(--border)', background: active?'var(--violet)':'var(--bg2)', color: active?'#fff':'var(--text2)' }
}
