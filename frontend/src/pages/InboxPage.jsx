import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, sitesApi, connectionsApi } from '../utils/api'
import toast from 'react-hot-toast'
import { MessageSquare, Send, RefreshCw, CheckCheck, Mail, MailOpen, Phone, Filter, ChevronDown, ChevronUp } from 'lucide-react'

const PLAT_COLORS = {
  facebook:'#1877f2', instagram:'#e1306c', youtube:'#ff0000',
  twitter:'#000', x:'#000', tiktok:'#010101',
  whatsapp:'#25D366',
  linkedin:'#0a66c2', pinterest:'#e60023', reddit:'#ff4500',
  telegram:'#229ed9',
}

const PLAT_ICONS = {
  whatsapp: '💬', facebook: '👍', instagram: '📸',
  youtube: '▶️', twitter: '🐦', tiktok: '🎵', telegram: '✈️',
  linkedin: '💼', pinterest: '📌', reddit: '🤖',
}

function timeAgo(dt) {
  const s = Math.floor((Date.now() - new Date(dt)) / 1000)
  if (s < 60)    return 'just now'
  if (s < 3600)  return Math.floor(s/60) + 'm ago'
  if (s < 86400) return Math.floor(s/3600) + 'h ago'
  return Math.floor(s/86400) + 'd ago'
}

function fmtDate(dt) {
  const d = new Date(dt)
  const today = new Date()
  const yesterday = new Date(today); yesterday.setDate(yesterday.getDate()-1)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString('en-US', { weekday:'long', month:'short', day:'numeric' })
}

function groupByDate(items) {
  const groups = {}
  items.forEach(item => {
    const key = fmtDate(item.created_at)
    if (!groups[key]) groups[key] = []
    groups[key].push(item)
  })
  return groups
}

export default function InboxPage() {
  const qc = useQueryClient()
  const [platform, setPlatform]     = useState('')
  const [siteFilter, setSiteFilter] = useState('')
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [page, setPage]             = useState(1)
  const [replyingTo, setReplyingTo] = useState(null)
  const [replyText, setReplyText]   = useState('')
  const [expanded, setExpanded]     = useState({})
  const [showFilters, setShowFilters] = useState(false)

  const { data: sitesRes } = useQuery({ queryKey:['sites'], queryFn: sitesApi.list })
  const { data: connsRes } = useQuery({ queryKey:['connections'], queryFn:()=>connectionsApi.list() })
  const sites   = sitesRes?.data ?? []
  const allConns = connsRes?.data ?? []

  const params = new URLSearchParams({ page })
  if (platform)   params.set('platform', platform)
  if (unreadOnly) params.set('unread', '1')

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['inbox', platform, unreadOnly, page],
    queryFn:  () => api.get('/inbox?' + params.toString()),
    refetchInterval: 30000,
  })

  const items = data?.data ?? []
  const meta  = data?.meta ?? {}

  // Filter by site (via connection_id → site_id)
  const filteredItems = useMemo(() => {
    if (!siteFilter) return items
    const connIds = allConns.filter(c=>String(c.site_id)===siteFilter).map(c=>c.id)
    return items.filter(i => connIds.includes(i.connection_id))
  }, [items, siteFilter, allConns])

  const unreadCount = filteredItems.filter(i => !i.is_read).length
  const grouped     = groupByDate(filteredItems)

  // Site name helper
  const siteName = id => sites.find(s=>String(s.id)===String(id))?.name || ''
  const connSite = connId => {
    const conn = allConns.find(c=>c.id===connId)
    return conn ? siteName(conn.site_id) : ''
  }

  const readMutation = useMutation({
    mutationFn: id => api.post(`/inbox/${id}/read`),
    onSuccess: () => qc.invalidateQueries({ queryKey:['inbox'] }),
  })

  const readAllMutation = useMutation({
    mutationFn: () => api.post('/inbox/read-all'),
    onSuccess: () => { toast.success('All marked read'); qc.invalidateQueries({ queryKey:['inbox'] }) },
  })

  const replyMutation = useMutation({
    mutationFn: ({ id, reply }) => api.post(`/inbox/${id}/reply`, { reply }),
    onSuccess: () => {
      toast.success('Reply sent!')
      setReplyingTo(null); setReplyText('')
      qc.invalidateQueries({ queryKey:['inbox'] })
    },
    onError: e => toast.error(e.message),
  })

  const syncMutation = useMutation({
    mutationFn: () => api.get('/inbox/sync'),
    onSuccess: d => {
      const s = d.data ?? {}
      const msg = `Synced — ${s.new ?? 0} new from ${s.checked ?? 0} accounts` + (s.errors ? ` (${s.errors} failed)` : '')
      s.errors ? toast(msg, { icon: '⚠️' }) : toast.success(msg)
      qc.invalidateQueries({ queryKey:['inbox'] })
    },
    onError: e => toast.error(e.message),
  })

  const toggleExpand = id => setExpanded(e => ({ ...e, [id]: !e[id] }))

  const CHANNEL_FILTERS = [
    { key:'', label:'All' },
    { key:'whatsapp', label:'💬 WhatsApp' },
    { key:'facebook', label:'Facebook' },
    { key:'instagram', label:'Instagram' },
    { key:'youtube', label:'YouTube' },
    { key:'twitter', label:'Twitter/X' },
    { key:'telegram', label:'Telegram' },
    { key:'linkedin', label:'💼 LinkedIn' },
    { key:'pinterest', label:'📌 Pinterest' },
    { key:'reddit', label:'🤖 Reddit' },
  ]

  return (
    <div>
      {/* Header */}
      <div className="fp-page-header">
        <div>
          <div className="fp-page-title">
            Inbox
            {unreadCount > 0 && (
              <span style={{ marginLeft:10, background:'var(--coral)', color:'#fff', fontSize:12, fontWeight:700,
                padding:'2px 8px', borderRadius:12, verticalAlign:'middle' }}>
                {unreadCount} unread
              </span>
            )}
          </div>
          <div className="fp-page-sub">Messages & replies from all channels</div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="fp-btn fp-btn-ghost fp-btn-sm" onClick={()=>setShowFilters(f=>!f)}>
            <Filter size={13}/> Filters {showFilters ? <ChevronUp size={12}/> : <ChevronDown size={12}/>}
          </button>
          <button className="fp-btn fp-btn-ghost fp-btn-sm" onClick={()=>syncMutation.mutate()} disabled={syncMutation.isPending}>
            <RefreshCw size={13} style={{ animation:syncMutation.isPending?'spin 1s linear infinite':undefined }}/> Sync
          </button>
          {unreadCount > 0 && (
            <button className="fp-btn fp-btn-ghost fp-btn-sm" onClick={()=>readAllMutation.mutate()}>
              <CheckCheck size={13}/> Mark all read
            </button>
          )}
        </div>
      </div>

      {/* Filters Panel */}
      {showFilters && (
        <div className="fp-card" style={{ padding:'16px 18px', marginBottom:16 }}>
          {/* Channel filter */}
          <div style={{ marginBottom:12 }}>
            <div style={{ fontSize:11, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:8 }}>Channel</div>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {CHANNEL_FILTERS.map(f => (
                <button key={f.key} onClick={()=>{ setPlatform(f.key); setPage(1) }}
                  style={{ padding:'5px 12px', borderRadius:20, border:'1.5px solid var(--border)', cursor:'pointer', fontSize:12, fontWeight:600,
                    background: platform===f.key ? (PLAT_COLORS[f.key]||'var(--violet)') : 'var(--bg2)',
                    color: platform===f.key ? '#fff' : 'var(--text2)' }}>
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {/* Site filter */}
          <div style={{ marginBottom:12 }}>
            <div style={{ fontSize:11, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:8 }}>Site / Ministry</div>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              <button onClick={()=>setSiteFilter('')}
                style={{ padding:'5px 12px', borderRadius:20, border:'1.5px solid var(--border)', cursor:'pointer', fontSize:12, fontWeight:600,
                  background: !siteFilter ? 'var(--violet)' : 'var(--bg2)', color: !siteFilter ? '#fff' : 'var(--text2)' }}>
                All Sites
              </button>
              {sites.map(s => (
                <button key={s.id} onClick={()=>setSiteFilter(String(s.id))}
                  style={{ padding:'5px 12px', borderRadius:20, border:'1.5px solid var(--border)', cursor:'pointer', fontSize:12, fontWeight:600,
                    background: siteFilter===String(s.id) ? 'var(--violet)' : 'var(--bg2)',
                    color: siteFilter===String(s.id) ? '#fff' : 'var(--text2)' }}>
                  {s.name}
                </button>
              ))}
            </div>
          </div>

          {/* Unread toggle */}
          <label style={{ display:'flex', alignItems:'center', gap:8, fontSize:13, fontWeight:600, color:'var(--text2)', cursor:'pointer' }}>
            <input type="checkbox" checked={unreadOnly} onChange={e=>{ setUnreadOnly(e.target.checked); setPage(1) }}
              style={{ accentColor:'var(--violet)', width:15, height:15 }}/>
            Show unread only
          </label>
        </div>
      )}

      {/* Active filter pills */}
      {(platform || siteFilter || unreadOnly) && (
        <div style={{ display:'flex', gap:6, marginBottom:12, flexWrap:'wrap', alignItems:'center' }}>
          <span style={{ fontSize:12, color:'var(--text3)' }}>Filtering by:</span>
          {platform && (
            <span style={{ padding:'3px 10px', borderRadius:12, background: PLAT_COLORS[platform]+'20', color: PLAT_COLORS[platform], fontSize:12, fontWeight:600 }}>
              {PLAT_ICONS[platform]} {platform} ×
            </span>
          )}
          {siteFilter && (
            <span style={{ padding:'3px 10px', borderRadius:12, background:'var(--violet-soft)', color:'var(--violet)', fontSize:12, fontWeight:600 }}>
              {siteName(siteFilter)} ×
            </span>
          )}
          {unreadOnly && (
            <span style={{ padding:'3px 10px', borderRadius:12, background:'#fef3c7', color:'#d97706', fontSize:12, fontWeight:600 }}>
              Unread only ×
            </span>
          )}
          <button onClick={()=>{ setPlatform(''); setSiteFilter(''); setUnreadOnly(false) }}
            style={{ background:'none', border:'none', cursor:'pointer', color:'var(--coral)', fontSize:12, fontWeight:600 }}>
            Clear all
          </button>
        </div>
      )}

      {/* Messages grouped by date */}
      {isLoading ? (
        <div className="fp-loader"><div className="fp-spinner"/></div>
      ) : filteredItems.length === 0 ? (
        <div className="fp-card" style={{ textAlign:'center', padding:'48px 24px' }}>
          <div style={{ fontSize:36, marginBottom:12 }}>📭</div>
          <div style={{ fontSize:16, fontWeight:700, marginBottom:6 }}>No messages</div>
          <div style={{ fontSize:13, color:'var(--text3)', marginBottom:16 }}>
            {platform || siteFilter || unreadOnly ? 'Try adjusting your filters' : 'Click Sync to fetch latest messages'}
          </div>
          <button className="fp-btn fp-btn-ghost fp-btn-sm" onClick={()=>syncMutation.mutate()}>
            <RefreshCw size={13}/> Sync now
          </button>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
          {Object.entries(grouped).map(([dateLabel, msgs]) => (
            <div key={dateLabel}>
              {/* Date divider */}
              <div style={{ display:'flex', alignItems:'center', gap:12, margin:'16px 0 10px' }}>
                <div style={{ flex:1, height:1, background:'var(--border)' }}/>
                <span style={{ fontSize:11, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.08em', whiteSpace:'nowrap' }}>
                  {dateLabel}
                </span>
                <div style={{ flex:1, height:1, background:'var(--border)' }}/>
              </div>

              {/* Messages for this date */}
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {msgs.map(msg => {
                  const color      = PLAT_COLORS[msg.platform] || '#888'
                  const icon       = PLAT_ICONS[msg.platform] || '💬'
                  const isReplying = replyingTo === msg.id
                  const site       = connSite(msg.connection_id)
                  const rawContent = msg.content || ''
                  const displayContent = msg.media_url
                    ? rawContent.replace(/^\[(?:Image|Video|Voice message|Document:[^\]]*)\]\s*/, '')
                    : rawContent
                  const isLong     = displayContent.length > 200
                  const isExpanded = expanded[msg.id]

                  return (
                    <div key={msg.id}
                      onClick={() => { if (!msg.is_read) readMutation.mutate(msg.id); toggleExpand(msg.id) }}
                      style={{
                        background:'var(--bg2)',
                        border: msg.is_read ? '1.5px solid var(--border)' : `1.5px solid ${color}40`,
                        borderLeft: `4px solid ${msg.is_read ? 'var(--border)' : color}`,
                        borderRadius:10, padding:'12px 16px',
                        cursor: 'pointer',
                        transition:'all .15s',
                      }}>
                      <div style={{ display:'flex', alignItems:'flex-start', gap:12 }}>

                        {/* Avatar */}
                        <div style={{ width:36, height:36, borderRadius:'50%', background:color+'18', flexShrink:0,
                          display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>
                          {msg.author_pic
                            ? <img src={msg.author_pic} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', borderRadius:'50%' }}/>
                            : <span style={{ fontWeight:700, color, fontSize:14 }}>{(msg.author_name||'?')[0].toUpperCase()}</span>
                          }
                        </div>

                        {/* Content */}
                        <div style={{ flex:1, minWidth:0 }}>
                          {/* Top row */}
                          <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4, flexWrap:'wrap' }}>
                            <span style={{ fontWeight:700, fontSize:14 }}>{msg.author_name || msg.author_id || 'Unknown'}</span>

                            {/* Platform badge */}
                            <span style={{ fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:20,
                              background:color+'15', color, display:'flex', alignItems:'center', gap:3 }}>
                              {icon} {msg.platform}
                            </span>

                            {/* Direction badge (sent vs received) */}
                            {msg.direction === 'out' && (
                              <span style={{ fontSize:11, fontWeight:700, padding:'2px 8px', borderRadius:20,
                                background:'#25D36618', color:'#1ea952', display:'flex', alignItems:'center', gap:3 }}>
                                ↗ Sent
                              </span>
                            )}

                            {/* Site badge */}
                            {site && (
                              <span style={{ fontSize:11, padding:'2px 8px', borderRadius:20,
                                background:'var(--bg3)', color:'var(--text3)', fontWeight:600 }}>
                                {site}
                              </span>
                            )}

                            {/* Message type */}
                            <span style={{ fontSize:11, padding:'2px 8px', borderRadius:20,
                              background:'var(--bg3)', color:'var(--text3)' }}>
                              {msg.message_type}
                            </span>

                            {/* Unread dot */}
                            {!msg.is_read && (
                              <span style={{ width:7, height:7, borderRadius:'50%', background:color, display:'inline-block' }}/>
                            )}

                            {/* Time */}
                            <span style={{ fontSize:11, color:'var(--text3)', marginLeft:'auto', whiteSpace:'nowrap' }}>
                              {new Date(msg.created_at).toLocaleTimeString('en-US', { hour:'2-digit', minute:'2-digit' })}
                              {' · '}
                              {timeAgo(msg.created_at)}
                            </span>
                          </div>

                          {/* Message content */}
                          {displayContent && (
                          <div style={{ fontSize:14, color:'var(--text2)', lineHeight:1.6 }}>
                            {isLong && !isExpanded
                              ? displayContent.slice(0, 200) + '…'
                              : displayContent
                            }
                            {isLong && (
                              <button onClick={e=>{e.stopPropagation();toggleExpand(msg.id)}}
                                style={{ background:'none', border:'none', cursor:'pointer', color:'var(--violet)', fontSize:12, fontWeight:600, marginLeft:4 }}>
                                {isExpanded ? 'Show less' : 'Read more'}
                              </button>
                            )}
                          </div>
                          )}

                          {/* Media (WhatsApp & DM attachments — in and out) */}
                          {msg.media_url && (
                            <div style={{ marginTop:8 }} onClick={e=>e.stopPropagation()}>
                              {msg.media_type === 'image' && (
                                <img src={msg.media_url} alt="attachment" loading="lazy"
                                  onClick={()=>window.open(msg.media_url,'_blank')}
                                  style={{ maxWidth:260, maxHeight:260, borderRadius:10, cursor:'zoom-in', display:'block', border:'1px solid var(--border)' }}/>
                              )}
                              {msg.media_type === 'video' && (
                                <video src={msg.media_url} controls preload="metadata"
                                  style={{ maxWidth:300, maxHeight:300, borderRadius:10, display:'block', border:'1px solid var(--border)' }}/>
                              )}
                              {msg.media_type === 'audio' && (
                                <audio src={msg.media_url} controls style={{ maxWidth:300, display:'block' }}/>
                              )}
                              {!['image','video','audio'].includes(msg.media_type) && (
                                <a href={msg.media_url} target="_blank" rel="noreferrer"
                                  style={{ fontSize:13, color:'var(--violet)', textDecoration:'none', fontWeight:600 }}>
                                  📎 Open attachment ↗
                                </a>
                              )}
                            </div>
                          )}

                          {/* Post link */}
                          {msg.post_url && (
                            <a href={msg.post_url} target="_blank" rel="noreferrer"
                              style={{ fontSize:11, color:'var(--violet)', textDecoration:'none', display:'inline-block', marginTop:4 }}
                              onClick={e=>e.stopPropagation()}>
                              View post ↗
                            </a>
                          )}

                          {/* Previous reply */}
                          {msg.replied_at && (
                            <div style={{ marginTop:8, padding:'8px 12px', background:'var(--bg3)', borderRadius:8,
                              fontSize:12, color:'var(--text3)', borderLeft:'3px solid var(--violet)' }}>
                              <span style={{ fontWeight:600, color:'var(--violet)' }}>You replied</span>
                              {' · '}
                              {timeAgo(msg.replied_at)}
                              <br/>{msg.reply_text}
                            </div>
                          )}

                          {/* Reply box */}
                          {isReplying ? (
                            <div style={{ marginTop:10, display:'flex', gap:8 }} onClick={e=>e.stopPropagation()}>
                              <input className="fp-input" placeholder="Write a reply…" value={replyText}
                                onChange={e=>setReplyText(e.target.value)} autoFocus
                                style={{ flex:1, fontSize:13 }}
                                onKeyDown={e=>{ if(e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); replyMutation.mutate({id:msg.id,reply:replyText}) }}}
                              />
                              <button className="fp-btn fp-btn-primary fp-btn-sm"
                                onClick={()=>replyMutation.mutate({id:msg.id,reply:replyText})}
                                disabled={!replyText.trim()||replyMutation.isPending}>
                                <Send size={12}/> Send
                              </button>
                              <button className="fp-btn fp-btn-ghost fp-btn-sm" onClick={()=>setReplyingTo(null)}>Cancel</button>
                            </div>
                          ) : (
                            msg.direction !== 'out' && !msg.replied_at && ['facebook','instagram','instagram_business','youtube','whatsapp','whatsapp_channel','whatsapp_broadcast','telegram'].includes(msg.platform) && (
                              <button onClick={e=>{e.stopPropagation();setReplyingTo(msg.id);setReplyText('')}}
                                style={{ marginTop:8, background:'none', border:'1px solid var(--border)', borderRadius:6,
                                  padding:'4px 12px', fontSize:12, fontWeight:600, color:'var(--text2)', cursor:'pointer' }}>
                                <Send size={11}/> Reply
                              </button>
                            )
                          )}
                        </div>

                        {/* Read indicator */}
                        <div style={{ flexShrink:0, paddingTop:2 }}>
                          {msg.is_read
                            ? <MailOpen size={15} color="var(--text3)"/>
                            : <Mail size={15} color={color}/>
                          }
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {meta.pages > 1 && (
        <div style={{ display:'flex', justifyContent:'center', gap:8, marginTop:24 }}>
          <button className="fp-btn fp-btn-ghost fp-btn-sm" disabled={page<=1} onClick={()=>setPage(p=>p-1)}>← Prev</button>
          <span style={{ fontSize:13, color:'var(--text3)', alignSelf:'center' }}>Page {page} of {meta.pages}</span>
          <button className="fp-btn fp-btn-ghost fp-btn-sm" disabled={page>=meta.pages} onClick={()=>setPage(p=>p+1)}>Next →</button>
        </div>
      )}
    </div>
  )
}
