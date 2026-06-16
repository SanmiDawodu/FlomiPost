import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, mediaApi } from '../utils/api'
import toast from 'react-hot-toast'
import { Send, MessageCircle, Paperclip, X } from 'lucide-react'

const PLAT_COLORS = {
  whatsapp:'#25D366', whatsapp_channel:'#25D366', whatsapp_broadcast:'#128C7E',
  facebook:'#1877F2', instagram:'#E4405F', instagram_business:'#E4405F',
  telegram:'#2AABEE', youtube:'#FF0000',
}
const PLAT_ICON = {
  whatsapp:'💬', whatsapp_channel:'💬', whatsapp_broadcast:'📢',
  facebook:'👍', instagram:'📸', instagram_business:'📸', telegram:'✈️', youtube:'▶️',
}
const CHANNELS = [
  { k:'', l:'All' }, { k:'whatsapp', l:'💬 WhatsApp' }, { k:'instagram', l:'📸 Instagram' },
  { k:'facebook', l:'👍 Facebook' }, { k:'telegram', l:'✈️ Telegram' },
]
const PLACEHOLDER = /^\[(?:Image|Video|Voice message|Document:[^\]]*)\]\s*/

function timeAgo(d){
  if(!d) return ''
  const t = new Date(String(d).replace(' ','T'))
  const s = (Date.now() - t.getTime())/1000
  if(s<60) return 'now'
  if(s<3600) return Math.floor(s/60)+'m'
  if(s<86400) return Math.floor(s/3600)+'h'
  return Math.floor(s/86400)+'d'
}
function clockTime(d){
  if(!d) return ''
  return new Date(String(d).replace(' ','T')).toLocaleTimeString('en-US',{hour:'2-digit',minute:'2-digit'})
}

function Media({ url, type }){
  if(!url) return null
  const st = { maxWidth:240, maxHeight:240, borderRadius:10, display:'block', marginTop:4 }
  if(type==='image') return <img src={url} alt="" loading="lazy" style={{...st, cursor:'zoom-in'}} onClick={()=>window.open(url,'_blank')}/>
  if(type==='video') return <video src={url} controls preload="metadata" style={st}/>
  if(type==='audio') return <audio src={url} controls style={{ marginTop:4, maxWidth:240, display:'block' }}/>
  return <a href={url} target="_blank" rel="noreferrer" style={{ fontSize:13, color:'inherit', fontWeight:600, textDecoration:'underline' }}>📎 Open attachment ↗</a>
}

export default function ChatsPage(){
  const qc = useQueryClient()
  const [platform, setPlatform] = useState('')
  const [active, setActive]     = useState(null) // {platform, connection_id, author_id, author_name}
  const [reply, setReply]       = useState('')
  const [media, setMedia]       = useState(null)   // {url, type, name}
  const [uploading, setUploading] = useState(false)
  const endRef = useRef(null)

  const { data: threadsRes, isLoading: threadsLoading } = useQuery({
    queryKey:['chat-threads', platform],
    queryFn: () => api.get('/inbox/threads' + (platform?('?platform='+platform):'')),
    refetchInterval: 30000,
  })
  const threads = threadsRes?.data ?? []

  const { data: msgsRes, refetch: refetchMsgs } = useQuery({
    queryKey:['chat-thread', active?.platform, active?.connection_id, active?.key],
    queryFn: () => api.get(`/inbox/thread?platform=${encodeURIComponent(active.platform)}&connection_id=${active.connection_id}&key=${encodeURIComponent(active.key)}`),
    enabled: !!active,
    refetchInterval: active ? 7000 : false,
  })
  const msgs = msgsRes?.data ?? []

  useEffect(() => { endRef.current?.scrollIntoView({ behavior:'smooth' }) }, [msgs.length, active])
  useEffect(() => { setReply(''); setMedia(null) }, [active])

  const onPickFile = async e => {
    const f = e.target.files?.[0]; if(!f) return
    setUploading(true)
    try {
      const r = await mediaApi.upload(f)
      const m = r.data || {}
      const mt = (m.mime_type||'').startsWith('image') ? 'image'
               : (m.mime_type||'').startsWith('video') ? 'video'
               : (m.mime_type||'').startsWith('audio') ? 'audio' : 'document'
      setMedia({ url:m.url, type:mt, name:m.filename||f.name })
    } catch(err){ toast.error(err.message||'Upload failed') }
    finally { setUploading(false); e.target.value='' }
  }

  const canReply = active && ['facebook','instagram','instagram_business','youtube','whatsapp','whatsapp_channel','whatsapp_broadcast','telegram'].includes(active.platform)

  const replyMut = useMutation({
    mutationFn: () => {
      const lastIn = [...msgs].reverse().find(m => m.direction !== 'out') || msgs[msgs.length-1]
      if(!lastIn) throw new Error('No message to reply to')
      return api.post(`/inbox/${lastIn.id}/reply`, { reply, media_url: media?.url || null, media_type: media?.type || null })
    },
    onSuccess: () => { setReply(''); setMedia(null); refetchMsgs(); qc.invalidateQueries({queryKey:['chat-threads']}); toast.success('Sent') },
    onError: e => toast.error(e.message),
  })

  return (
    <div>
      <div className="fp-page-header" style={{ marginBottom:14 }}>
        <h1 className="fp-page-title" style={{ display:'flex', alignItems:'center', gap:8 }}><MessageCircle size={20}/> Inbox</h1>
        <p className="fp-page-sub">All your messages &amp; comments across channels — threaded like a chat, not a flat list.</p>
      </div>

      <div style={{ display:'flex', gap:8, marginBottom:12, flexWrap:'wrap' }}>
        {CHANNELS.map(c => (
          <button key={c.k} onClick={()=>{ setPlatform(c.k); setActive(null) }}
            style={{ padding:'5px 12px', borderRadius:20, fontSize:12, fontWeight:600, cursor:'pointer', border:'1px solid var(--border)',
              background: platform===c.k ? 'var(--violet)' : 'var(--bg2)', color: platform===c.k ? '#fff' : 'var(--text2)' }}>
            {c.l}
          </button>
        ))}
      </div>

      <div style={{ display:'flex', gap:0, border:'1px solid var(--border)', borderRadius:14, overflow:'hidden', height:'calc(100vh - 230px)', minHeight:420, background:'var(--bg2)' }}>

        {/* Left: conversation list */}
        <div style={{ width:320, borderRight:'1px solid var(--border)', overflowY:'auto', flexShrink:0, background:'var(--surface)' }}>
          {threadsLoading && <div style={{ padding:20, color:'var(--text3)', fontSize:13 }}>Loading…</div>}
          {!threadsLoading && threads.length===0 && (
            <div style={{ padding:24, color:'var(--text3)', fontSize:13, textAlign:'center', lineHeight:1.6 }}>
              Nothing here yet.<br/>Messages and comments appear as people reach your connected accounts. Hit Sync if you just connected one.
            </div>
          )}
          {threads.map(t => {
            const color = PLAT_COLORS[t.platform] || '#888'
            const sel = active && active.platform===t.platform && String(active.connection_id)===String(t.connection_id) && active.key===t.thread_key
            const isComment = t.message_type==='comment'
            const tname = isComment ? 'Comments' : (t.author_name || t.author_id)
            const last = (t.last_content||'').replace(PLACEHOLDER,'') || (t.last_content?'📎 media':'')
            return (
              <div key={t.platform+'_'+t.connection_id+'_'+t.thread_key}
                onClick={()=>setActive({ platform:t.platform, connection_id:t.connection_id, key:t.thread_key, name:tname, message_type:t.message_type, post_url:t.post_url })}
                style={{ display:'flex', gap:10, alignItems:'center', padding:'10px 12px', cursor:'pointer', borderBottom:'1px solid var(--border)',
                  background: sel ? `${color}14` : 'transparent' }}>
                <div style={{ width:40, height:40, borderRadius:'50%', background:color+'22', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, position:'relative' }}>
                  {t.author_pic ? <img src={t.author_pic} alt="" style={{ width:'100%',height:'100%',objectFit:'cover',borderRadius:'50%' }}/> : <span>{PLAT_ICON[t.platform]||'💬'}</span>}
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', gap:6 }}>
                    <span style={{ fontWeight:700, fontSize:13, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{isComment?'📝 ':''}{tname}</span>
                    <span style={{ fontSize:11, color:'var(--text3)', whiteSpace:'nowrap' }}>{timeAgo(t.last_at)}</span>
                  </div>
                  <div style={{ display:'flex', justifyContent:'space-between', gap:6, alignItems:'center' }}>
                    <span style={{ fontSize:12, color:'var(--text3)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      <span style={{ color }}>{PLAT_ICON[t.platform]} </span>{last}
                    </span>
                    {Number(t.unread)>0 && <span style={{ background:color, color:'#fff', borderRadius:10, fontSize:10, fontWeight:700, padding:'1px 6px', flexShrink:0 }}>{t.unread}</span>}
                  </div>
                  {t.connection_name && <div style={{ fontSize:10, color:'var(--text3)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', marginTop:1 }}>via {t.connection_name}</div>}
                </div>
              </div>
            )
          })}
        </div>

        {/* Right: conversation thread */}
        <div style={{ flex:1, display:'flex', flexDirection:'column', minWidth:0 }}>
          {!active ? (
            <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text3)', fontSize:14, flexDirection:'column', gap:8 }}>
              <MessageCircle size={40} style={{ opacity:.25 }}/>
              Select a conversation to view the chat
            </div>
          ) : (
            <>
              {/* Thread header */}
              <div style={{ padding:'10px 16px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:8, background:'var(--surface)', flexShrink:0 }}>
                <span style={{ fontSize:18 }}>{PLAT_ICON[active.platform]||'💬'}</span>
                <div style={{ fontWeight:700, fontSize:14 }}>{active.message_type==='comment'?'📝 Comments':active.name}</div>
                <span style={{ fontSize:11, color:'var(--text3)', textTransform:'capitalize' }}>· {active.platform.replace('_',' ')}</span>
                {msgs[0]?.connection_name && <span style={{ fontSize:11, color:'var(--text3)' }}>· via {msgs[0].connection_name}</span>}
                {active.message_type==='comment' && active.post_url && <a href={active.post_url} target="_blank" rel="noreferrer" style={{ fontSize:11, color:'var(--violet)', marginLeft:'auto', fontWeight:600 }}>View post ↗</a>}
              </div>

              {/* Messages */}
              <div style={{ flex:1, overflowY:'auto', padding:'14px 16px', display:'flex', flexDirection:'column', gap:8, background:'var(--bg3)' }}>
                {msgs.map(m => {
                  const out = m.direction === 'out'
                  const color = PLAT_COLORS[m.platform] || '#888'
                  const txt = (m.content||'').replace(m.media_url ? PLACEHOLDER : '', '')
                  return (
                    <div key={m.id} style={{ display:'flex', justifyContent: out?'flex-end':'flex-start' }}>
                      <div style={{ maxWidth:'72%', padding:'8px 12px', borderRadius:12,
                        background: out ? color : 'var(--surface)', color: out ? '#fff' : 'var(--text1)',
                        border: out ? 'none' : '1px solid var(--border)', borderBottomRightRadius: out?3:12, borderBottomLeftRadius: out?12:3 }}>
                        {!out && m.author_name && <div style={{ fontSize:11, fontWeight:700, color, marginBottom:2 }}>{m.author_name}</div>}
                        <Media url={m.media_url} type={m.media_type}/>
                        {txt && <div style={{ fontSize:14, lineHeight:1.5, whiteSpace:'pre-wrap', wordBreak:'break-word' }}>{txt}</div>}
                        <div style={{ fontSize:10, opacity:.7, textAlign:'right', marginTop:3 }}>{clockTime(m.created_at)}{out?' ✓':''}</div>
                      </div>
                    </div>
                  )
                })}
                <div ref={endRef}/>
              </div>

              {/* Reply box */}
              {canReply ? (
                <div style={{ borderTop:'1px solid var(--border)', background:'var(--surface)', flexShrink:0 }}>
                  {media && (
                    <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 14px 0', fontSize:12 }}>
                      <Paperclip size={13}/>
                      <span style={{ flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{media.name} <span style={{ color:'var(--text3)' }}>({media.type})</span></span>
                      <button type="button" onClick={()=>setMedia(null)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--coral)' }}><X size={14}/></button>
                    </div>
                  )}
                  <div style={{ padding:'10px 14px', display:'flex', gap:8, alignItems:'center' }}>
                    <label title="Attach image / video / document" style={{ cursor: uploading?'wait':'pointer', display:'flex', alignItems:'center', color:'var(--text3)', flexShrink:0 }}>
                      <Paperclip size={18}/>
                      <input type="file" accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx" style={{ display:'none' }} disabled={uploading} onChange={onPickFile}/>
                    </label>
                    <input className="fp-input" placeholder={uploading?'Uploading…':'Type a message…'} value={reply} onChange={e=>setReply(e.target.value)}
                      onKeyDown={e=>{ if(e.key==='Enter' && !e.shiftKey && (reply.trim()||media)){ e.preventDefault(); replyMut.mutate() } }}
                      style={{ flex:1 }}/>
                    <button className="fp-btn fp-btn-primary" onClick={()=>replyMut.mutate()} disabled={(!reply.trim() && !media) || uploading || replyMut.isPending}>
                      <Send size={14}/> {replyMut.isPending?'…':'Send'}
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ padding:'10px 14px', borderTop:'1px solid var(--border)', fontSize:12, color:'var(--text3)', background:'var(--surface)' }}>
                  Replies aren't supported for this channel here.
                </div>
              )}
            </>
          )}
        </div>
      </div>

      <div style={{ fontSize:11, color:'var(--text3)', marginTop:8 }}>
        💡 WhatsApp replies reach contacts inside the 24-hour window; outside it, use Broadcast → Template.
      </div>
    </div>
  )
}
