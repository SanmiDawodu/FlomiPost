import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api, sitesApi, connectionsApi, mediaApi } from '../utils/api'
import toast from 'react-hot-toast'
import { MessageSquare, Send, Paperclip, X, FileText, Info } from 'lucide-react'

export default function BroadcastPage() {
  const [siteId, setSiteId]       = useState('')
  const [connId, setConnId]       = useState('')
  const [segId, setSegId]         = useState('')
  const [message, setMessage]     = useState('')
  const [media, setMedia]         = useState(null)   // {url, type, name}
  const [uploading, setUploading] = useState(false)
  const [sending, setSending]     = useState(false)

  const [mode, setMode]       = useState('regular') // 'regular' | 'template'
  const [tplName, setTplName] = useState('')
  const [tplVars, setTplVars] = useState([])
  const [showHelp, setShowHelp] = useState(false)

  const { data: sitesRes } = useQuery({ queryKey:['sites'], queryFn: sitesApi.list })
  const { data: connsRes } = useQuery({ queryKey:['connections'], queryFn: () => connectionsApi.list() })
  const { data: segsRes }  = useQuery({
    queryKey:['wa-segments', siteId],
    queryFn: () => api.get(`/whatsapp/segments?site_id=${siteId}`),
    enabled: !!siteId,
  })
  const { data: tplRes, isLoading: tplLoading } = useQuery({
    queryKey:['wa-templates'],
    queryFn: () => api.get('/whatsapp/templates'),
    enabled: mode === 'template',
  })

  const sites    = sitesRes?.data ?? []
  const allConns = connsRes?.data ?? []
  const segments = segsRes?.data ?? []
  const waConns  = allConns.filter(c => String(c.key_name||'').startsWith('whatsapp') && (!siteId || String(c.site_id)===siteId))
  const selectedSeg = segments.find(s => String(s.id) === segId)

  const templates   = tplRes?.data?.templates ?? []
  const wabaReady   = tplRes?.data?.waba
  const selectedTpl = templates.find(t => t.name === tplName)
  const approvedCount = templates.filter(t => t.status === 'APPROVED').length
  const tplPreview = selectedTpl
    ? selectedTpl.body.replace(/\{\{(\d+)\}\}/g, (_, n) => (tplVars[n-1] && String(tplVars[n-1]).trim()) ? tplVars[n-1] : `{{${n}}}`)
    : ''

  function pickTemplate(name) {
    setTplName(name)
    const t = templates.find(x => x.name === name)
    setTplVars(t ? Array(t.variables).fill('') : [])
  }
  function setVar(i, val) {
    setTplVars(prev => { const next = [...prev]; next[i] = val; return next })
  }

  async function postBroadcast(extra = {}) {
    const payload = {
      connection_id: parseInt(connId),
      segment_id: segId ? parseInt(segId) : null,
      message,
      media_url: media?.url || null,
      media_type: media?.type || null,
      ...extra,
    }
    const res = await fetch('/api/whatsapp/broadcast', {
      method:'POST', credentials:'include',
      headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload),
    })
    const json = await res.json().catch(()=>({}))
    return { res, json }
  }

  const sendBroadcast = async () => {
    if (!connId) return toast.error('Select a WhatsApp connection')
    if (!segId)  return toast.error('Select a segment to send to')
    if (!message.trim() && !media) return toast.error('Write a message or attach media')
    setSending(true)
    try {
      let { res, json } = await postBroadcast()
      if (res.status === 409 && json.needs_confirm) {
        const ok = window.confirm(`This will message ${json.recipient_count} contacts in "${selectedSeg?.name || 'this segment'}". Send now?`)
        if (!ok) { setSending(false); return }
        ;({ res, json } = await postBroadcast({ confirmed_recipient_count: json.recipient_count }))
      }
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`)
      toast.success(json.message || 'Broadcast sent!')
      setMessage(''); setMedia(null)
    } catch(e) {
      toast.error(e.message)
    } finally {
      setSending(false)
    }
  }

  const sendTemplate = async () => {
    if (!connId) return toast.error('Select a WhatsApp connection')
    if (!segId)  return toast.error('Select a segment to send to')
    if (!selectedTpl) return toast.error('Pick a template')
    if (selectedTpl.status !== 'APPROVED') return toast.error('That template is still pending Meta approval')
    if (selectedTpl.variables > 0 && tplVars.slice(0, selectedTpl.variables).some(v => !String(v||'').trim()))
      return toast.error('Fill in all template fields')
    setSending(true)
    try {
      const r = await fetch('/api/whatsapp/send-template', {
        method:'POST', credentials:'include',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({
          connection_id: parseInt(connId),
          template: selectedTpl.name,
          language: selectedTpl.language,
          params: tplVars.slice(0, selectedTpl.variables),
          segment_id: parseInt(segId),
        }),
      })
      const j = await r.json().catch(()=>({}))
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`)
      toast.success(j.message || 'Template sent!')
    } catch(e) {
      toast.error(e.message)
    } finally {
      setSending(false)
    }
  }

  const onPickFile = async e => {
    const f = e.target.files?.[0]; if (!f) return
    setUploading(true)
    try {
      const r = await mediaApi.upload(f, siteId || undefined)
      const m = r.data || {}
      const mt = (m.mime_type||'').startsWith('image') ? 'image'
               : (m.mime_type||'').startsWith('video') ? 'video'
               : (m.mime_type||'').startsWith('audio') ? 'audio' : 'document'
      setMedia({ url:m.url, type:mt, name:m.filename||f.name })
    } catch(err) { toast.error(err.message||'Upload failed') }
    finally { setUploading(false); e.target.value='' }
  }

  const selectedConn = allConns.find(c => String(c.id) === connId)
  const tabStyle = active => ({
    flex:1, padding:'8px 12px', fontSize:13, fontWeight:600, cursor:'pointer', textAlign:'center',
    borderRadius:8, border:'1px solid var(--border)',
    background: active ? 'var(--violet)' : 'var(--bg2)',
    color: active ? '#fff' : 'var(--text2)',
    display:'flex', alignItems:'center', justifyContent:'center', gap:6,
  })

  return (
    <div>
      <div className="fp-page-header" style={{ marginBottom:24 }}>
        <h1 className="fp-page-title">WhatsApp Broadcast</h1>
        <p className="fp-page-sub">Send a WhatsApp message to a segment of your contacts</p>
      </div>

      {/* Inline how-to */}
      <div style={{marginBottom:16}}>
        <button onClick={()=>setShowHelp(v=>!v)} style={{display:'flex',alignItems:'center',gap:6,background:'none',border:'none',cursor:'pointer',color:'var(--violet)',fontSize:13,fontWeight:600,padding:0}}>
          <Info size={14}/> How it works {showHelp?'▲':'▼'}
        </button>
        {showHelp && (
          <div className="fp-card" style={{marginTop:8,fontSize:13,color:'var(--text2)',lineHeight:1.8}}>
            <ol style={{margin:0,paddingLeft:18}}>
              <li>Pick the <strong>Site</strong>, the <strong>WhatsApp connection</strong>, and the <strong>Segment</strong> to send to.</li>
              <li><strong>Regular message:</strong> type your text (or attach media) and Send — this only reaches people who messaged you in the last 24 hours.</li>
              <li><strong>Template mode:</strong> switch the toggle to "Template", choose an approved template, fill in its fields, and Send — this reaches everyone, anytime.</li>
            </ol>
            <div style={{marginTop:8,fontSize:12,color:'var(--text3)'}}>💡 Only Meta-approved templates can be sent. A new template takes a little while to get approved.</div>
          </div>
        )}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 380px', gap:20, alignItems:'start' }}>
        <div>
          <div className="fp-card" style={{ marginBottom:16 }}>
            <div style={{ fontWeight:700, fontSize:13, marginBottom:12, display:'flex', alignItems:'center', gap:6 }}>
              <MessageSquare size={14}/> Compose WhatsApp Broadcast
            </div>

            {/* Mode toggle */}
            <div style={{ display:'flex', gap:8, marginBottom:14 }}>
              <div style={tabStyle(mode==='regular')} onClick={()=>setMode('regular')}>
                <MessageSquare size={13}/> Regular message
              </div>
              <div style={tabStyle(mode==='template')} onClick={()=>setMode('template')}>
                <FileText size={13}/> Template (outside 24h window)
              </div>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:12 }}>
              <div>
                <label className="fp-label">Site</label>
                <select className="fp-select" value={siteId} onChange={e => { setSiteId(e.target.value); setConnId(''); setSegId('') }}>
                  <option value="">Select site…</option>
                  {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="fp-label">WhatsApp connection *</label>
                <select className="fp-select" value={connId} onChange={e => setConnId(e.target.value)} disabled={!siteId}>
                  <option value="">Select…</option>
                  {waConns.map(c => <option key={c.id} value={c.id}>{c.account_name}</option>)}
                </select>
              </div>
            </div>

            <div style={{ marginBottom:12 }}>
              <label className="fp-label">Send to segment *</label>
              <select className="fp-select" value={segId} onChange={e => setSegId(e.target.value)} disabled={!siteId}>
                <option value="">{siteId ? 'Select a segment…' : 'Pick a site first'}</option>
                {segments.map(s => <option key={s.id} value={s.id}>{s.name}{s.contact_count!=null?` (${s.contact_count})`:''}</option>)}
              </select>
            </div>

            {mode === 'regular' ? (
              <>
                <div style={{ marginBottom:10 }}>
                  <label className="fp-label">Attachment (optional)</label>
                  {media ? (
                    <div style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, padding:'6px 10px', background:'var(--bg3)', borderRadius:8 }}>
                      <Paperclip size={13}/>
                      <span style={{ flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{media.name} <span style={{ color:'var(--text3)' }}>({media.type})</span></span>
                      <button type="button" onClick={()=>setMedia(null)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--coral)' }}><X size={15}/></button>
                    </div>
                  ) : (
                    <label className="fp-btn fp-btn-ghost fp-btn-sm" style={{ cursor: uploading?'wait':'pointer', display:'inline-flex', alignItems:'center', gap:6 }}>
                      <Paperclip size={13}/> {uploading ? 'Uploading…' : 'Attach image / video / voice note'}
                      <input type="file" accept="image/*,video/*,audio/*" style={{ display:'none' }} disabled={uploading} onChange={onPickFile}/>
                    </label>
                  )}
                </div>

                <div style={{ marginBottom:8 }}>
                  <label className="fp-label">Message {media?'(caption)':'*'}</label>
                  <textarea className="fp-input" rows={6} placeholder="Type your WhatsApp message…" value={message} onChange={e => setMessage(e.target.value)} style={{ width:'100%', resize:'vertical' }}/>
                </div>

                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div style={{ fontSize:11, color:'var(--text3)' }}>{message.length} chars</div>
                  <button className="fp-btn fp-btn-primary" onClick={sendBroadcast} disabled={sending || uploading || !connId || !segId || (!message.trim() && !media)}>
                    <Send size={14}/> {sending ? 'Sending…' : 'Send Broadcast'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={{ marginBottom:12 }}>
                  <label className="fp-label">Template *</label>
                  {tplLoading ? (
                    <div style={{ fontSize:12, color:'var(--text3)', padding:'8px 0' }}>Loading templates…</div>
                  ) : !wabaReady ? (
                    <div style={{ fontSize:12, color:'var(--coral)', padding:'8px 10px', background:'var(--bg3)', borderRadius:8 }}>
                      WhatsApp Business Account not linked yet — send one message to your business number first.
                    </div>
                  ) : templates.length === 0 ? (
                    <div style={{ fontSize:12, color:'var(--text3)', padding:'8px 0' }}>No templates yet.</div>
                  ) : (
                    <select className="fp-select" value={tplName} onChange={e => pickTemplate(e.target.value)}>
                      <option value="">Select a template…</option>
                      {templates.map(t => (
                        <option key={t.name} value={t.name} disabled={t.status !== 'APPROVED'}>
                          {t.name}{t.status !== 'APPROVED' ? ` — ${t.status.toLowerCase()}` : ''}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {selectedTpl && Array.from({ length: selectedTpl.variables }).map((_, i) => (
                  <div key={i} style={{ marginBottom:10 }}>
                    <label className="fp-label">Field {`{{${i+1}}}`}</label>
                    <input className="fp-input" style={{ width:'100%' }} value={tplVars[i] || ''}
                      placeholder={`Value for {{${i+1}}}`} onChange={e => setVar(i, e.target.value)} />
                  </div>
                ))}

                {selectedTpl && (
                  <div style={{ marginBottom:12 }}>
                    <label className="fp-label">Preview</label>
                    <div style={{ fontSize:13, lineHeight:1.6, whiteSpace:'pre-wrap', padding:'10px 12px', background:'#25D3660f', border:'1px solid #25D36633', borderRadius:10, color:'var(--text2)' }}>
                      {tplPreview}
                    </div>
                  </div>
                )}

                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <div style={{ fontSize:11, color:'var(--text3)' }}>
                    {selectedTpl ? (selectedTpl.status === 'APPROVED' ? '✓ Approved — ready to send' : `⏳ ${selectedTpl.status.toLowerCase()} — not sendable yet`) : ''}
                  </div>
                  <button className="fp-btn fp-btn-primary" onClick={sendTemplate} disabled={sending || !connId || !segId || !selectedTpl || selectedTpl.status !== 'APPROVED'}>
                    <Send size={14}/> {sending ? 'Sending…' : 'Send Template'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>

        <div>
          <div className="fp-card">
            <div style={{ fontWeight:700, fontSize:13, marginBottom:12 }}>
              <MessageSquare size={14} style={{ verticalAlign:'middle', marginRight:4 }}/> Broadcast Info
            </div>
            {!connId && <div style={{ fontSize:12, color:'var(--text3)', textAlign:'center', padding:20 }}>Pick a site, connection and segment</div>}
            {selectedConn && (
              <div>
                <div style={{ fontSize:13, fontWeight:600, marginBottom:6 }}>{selectedConn.account_name}</div>
                <div style={{ fontSize:12, color:'var(--text3)', marginBottom:4 }}>Site: {sites.find(s => String(s.id) === String(selectedConn.site_id))?.name}</div>
                {selectedSeg && <div style={{ fontSize:12, color:'var(--text2)', marginBottom:12 }}>Segment: <strong>{selectedSeg.name}</strong>{selectedSeg.contact_count!=null?` — ${selectedSeg.contact_count} contacts`:''}</div>}
                <div style={{ fontSize:12, padding:'8px 10px', background:'var(--bg2)', borderRadius:8, color:'var(--text3)' }}>
                  {mode === 'template'
                    ? 'Templates reach contacts even outside the 24-hour window. Only Meta-approved templates can be sent.'
                    : 'Regular messages only deliver to people who messaged you in the last 24 hours. To reach others, switch to Template mode.'}
                </div>
                {mode === 'template' && (
                  <div style={{ fontSize:11, color:'var(--text3)', marginTop:8 }}>
                    {approvedCount} approved · {templates.length - approvedCount} pending
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
