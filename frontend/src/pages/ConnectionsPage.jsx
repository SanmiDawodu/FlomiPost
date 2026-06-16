import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { connectionsApi, sitesApi, platformsApi } from '../utils/api'
import toast from 'react-hot-toast'
import { Plus, Trash2, X, ExternalLink, Lock, CheckCircle2, RefreshCw } from 'lucide-react'

const OAUTH = {
  facebook:      '/api/oauth/meta/start?type=facebook',
  instagram:     '/api/oauth/meta/start?type=instagram',
  reddit:        '/api/oauth/reddit/start',
  pinterest:     '/api/oauth/pinterest/start',
  linkedin:      '/api/oauth/linkedin/start',
  linkedin_page: '/api/oauth/linkedin/start?type=page',
  tiktok:        '/api/oauth/tiktok/start',
  youtube:       '/api/oauth/youtube/start',
  twitter:       '/api/oauth/twitter/start',
  x:             '/api/oauth/twitter/start',
}

const PLAT_COLORS = {
  facebook:'#1877f2', instagram:'#e1306c', twitter:'#000', x:'#000',
  tiktok:'#010101', youtube:'#ff0000', telegram:'#0088cc', linkedin:'#0077b5',
  linkedin_page:'#0077b5', pinterest:'#e60023', reddit:'#ff4500', discord:'#5865f2',
  threads:'#000', whatsapp:'#25d366', whatsapp_channel:'#25d366',
}

function openPopup(url, onDone, onError) {
  const w=640, h=720
  const left = Math.round(window.screenX + (window.outerWidth - w)/2)
  const top  = Math.round(window.screenY + (window.outerHeight - h)/2)
  const popup = window.open(url, 'fp_oauth', `width=${w},height=${h},left=${left},top=${top},toolbar=no,menubar=no,scrollbars=yes`)
  if (!popup) { toast.error('Popup blocked — allow popups for this site and try again'); return }
  const handler = (e) => {
    if (e.data?.type === 'oauth_error') {
      window.removeEventListener('message', handler)
      toast.error('OAuth failed: ' + (e.data.error || 'unknown error'))
      if (onError) onError(e.data.error)
    } else if (e.data?.type && e.data.type.endsWith('_connected')) {
      window.removeEventListener('message', handler)
      onDone()
    }
  }
  window.addEventListener('message', handler)
  const t = setInterval(() => { if (popup.closed) { clearInterval(t); window.removeEventListener('message', handler); onDone() } }, 600)
}

export default function ConnectionsPage() {
  const qc = useQueryClient()
  const [siteId, setSiteId]     = useState('')
  const [showAdd, setShowAdd]   = useState(false)
  const [busy, setBusy]         = useState(null)
  const [form, setForm] = useState({ site_id:'', platform_id:'', account_name:'', account_id:'', access_token:'' })

  const { data: sitesRes }  = useQuery({ queryKey:['sites'],       queryFn: sitesApi.list })
  const { data: platsRes }  = useQuery({ queryKey:['platforms'],   queryFn: platformsApi.list })
  const { data: connsRes }  = useQuery({ queryKey:['connections'], queryFn: () => connectionsApi.list() })

  const sites = sitesRes?.data ?? []
  const plats = platsRes?.data ?? []
  const conns = connsRes?.data ?? []

  // Handle OAuth redirect result
  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    const ok  = p.get('oauth_success')
    const err = p.get('oauth_error')
    if (ok || err) {
      window.history.replaceState({}, '', window.location.pathname)
      if (window.opener) {
        window.opener.postMessage(ok ? 'oauth_success' : 'oauth_error', '*')
        window.close()
      } else {
        if (ok) toast.success('Connected ' + (p.get('connected')||'1') + ' account(s)!')
        else    toast.error('OAuth error: ' + err)
        qc.invalidateQueries({ queryKey:['connections'] })
      }
    }
  }, [])

  const addMutation = useMutation({
    mutationFn: connectionsApi.create,
    onSuccess: () => { toast.success('Connection added!'); qc.invalidateQueries({queryKey:['connections']}); setShowAdd(false) },
    onError: e => toast.error(e.message),
  })
  const deleteMutation = useMutation({
    mutationFn: id => connectionsApi.delete(id),
    onSuccess: () => { toast.success('Removed'); qc.invalidateQueries({queryKey:['connections']}) },
    onError: e => toast.error(e.message),
  })

  function connectOAuth(keyName) {
    if (!siteId) { toast.error('Select a site first'); return }
    const path = OAUTH[keyName]
    if (!path) return
    const url = path + (path.includes('?') ? '&' : '?') + 'site_id=' + siteId
    if (keyName === 'twitter' || keyName === 'x') { window.location.href = url; return }
    setBusy(keyName)
    openPopup(url, () => {
      setBusy(null)
      qc.invalidateQueries({ queryKey:['connections'] })
      toast.success('Done! Refreshing connections…')
    })
  }

  // Re-run OAuth for an existing account. The callback upserts on
  // site_id+platform+account_id, so approving the same account refreshes
  // tokens and permissions in place instead of adding a duplicate.
  function reconnect(keyName, connSiteId) {
    const path = OAUTH[keyName]
    if (!path) return
    const url = path + (path.includes('?') ? '&' : '?') + 'site_id=' + connSiteId
    if (keyName === 'twitter' || keyName === 'x') { window.location.href = url; return }
    setBusy(keyName)
    openPopup(url, () => {
      setBusy(null)
      qc.invalidateQueries({ queryKey:['connections'] })
      toast.success('Reconnected — tokens refreshed')
    })
  }

  // Filter connections for selected site
  const siteConns = conns.filter(c => !siteId || String(c.site_id) === siteId)
  const connMap   = siteConns.reduce((m,c) => { (m[c.key_name] = m[c.key_name]||[]).push(c); return m }, {})

  return (
    <div>
      {/* Header */}
      <div className="fp-page-header">
        <div>
          <div className="fp-page-title">Platform Connections</div>
          <div className="fp-page-sub">Link your social accounts to each site</div>
        </div>
        <button className="fp-btn fp-btn-primary fp-btn-sm" onClick={() => setShowAdd(true)}>
          <Plus size={13}/> Add Manually
        </button>
      </div>

      {/* Site picker */}
      <div className="fp-card" style={{ padding:'14px 18px', marginBottom:24 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
          <span style={{ fontSize:13, fontWeight:700, color:'var(--text3)', whiteSpace:'nowrap' }}>Site:</span>
          {sites.map(s => (
            <button key={s.id}
              onClick={() => setSiteId(String(s.id))}
              style={{
                padding:'6px 16px', borderRadius:8, cursor:'pointer', fontSize:13, fontWeight:700,
                border: siteId===String(s.id) ? 'none' : '1.5px solid var(--border)',
                background: siteId===String(s.id) ? 'var(--violet)' : 'var(--bg2)',
                color: siteId===String(s.id) ? '#fff' : 'var(--text2)',
              }}>
              {s.name}
            </button>
          ))}
          {!siteId && <span style={{ fontSize:12, color:'var(--amber)', fontWeight:600 }}>Select a site to connect accounts</span>}
        </div>
      </div>

      {/* Platform grid */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(200px,1fr))', gap:12 }}>
        {plats.map(plat => {
          const color    = PLAT_COLORS[plat.key_name] || plat.color || '#888'
          const hasOAuth = !!OAUTH[plat.key_name]
          const connected = connMap[plat.key_name] || []
          const isBusy   = busy === plat.key_name
          const slug     = plat.key_name === 'twitter' ? 'x' : plat.key_name

          return (
            <div key={plat.id} style={{
              background:'var(--bg2)', border:'1.5px solid var(--border)', borderRadius:12, padding:16,
              display:'flex', flexDirection:'column', gap:10,
              outline: connected.length ? `2px solid ${color}50` : 'none',
            }}>
              {/* Platform name + icon */}
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <div style={{ width:34, height:34, borderRadius:9, background:color+'18', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <img src={`https://cdn.simpleicons.org/${slug}`} alt={plat.name}
                    width={18} height={18} style={{ objectFit:'contain' }}
                    onError={e=>{e.target.style.display='none'}}/>
                </div>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:700, fontSize:13, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{plat.name}</div>
                  {connected.length > 0 && (
                    <div style={{ fontSize:11, color:'var(--green)', fontWeight:600, display:'flex', alignItems:'center', gap:3 }}>
                      <CheckCircle2 size={10}/> {connected.length} connected
                    </div>
                  )}
                </div>
              </div>

              {/* Connected accounts */}
              {connected.map(c => (
                <div key={c.id} style={{ display:'flex', alignItems:'center', gap:6, padding:'3px 8px', background:'var(--bg3)', borderRadius:6, fontSize:12 }}>
                  <span style={{ flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', color:'var(--text2)' }}>{c.account_name}</span>
                  {OAUTH[plat.key_name] && (
                    <button title='Reconnect — refresh tokens & permissions'
                      onClick={() => reconnect(plat.key_name, c.site_id)}
                      style={{ background:'none', border:'none', cursor:'pointer', color:'var(--violet)', lineHeight:1 }}>
                      <RefreshCw size={12}/>
                    </button>
                  )}
                  <button title='Remove' onClick={() => { if(window.confirm('Remove?')) deleteMutation.mutate(c.id) }}
                    style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text3)', lineHeight:1 }}>
                    <Trash2 size={12}/>
                  </button>
                </div>
              ))}

              {/* Connect button */}
              {hasOAuth ? (
                <button
                  onClick={() => connectOAuth(plat.key_name)}
                  disabled={isBusy}
                  style={{
                    padding:'7px', borderRadius:8, border:'none', cursor:'pointer',
                    background: color,
                    color: '#fff',
                    fontWeight:700, fontSize:12, display:'flex', alignItems:'center', justifyContent:'center', gap:5,
                    opacity: isBusy ? 0.65 : 1,
                  }}>
                  <ExternalLink size={12}/>
                  {isBusy ? 'Connecting…' : connected.length ? 'Add another' : 'Connect with OAuth'}
                </button>
              ) : (
                <button
                  onClick={() => { setForm(f=>({...f,site_id:siteId,platform_id:String(plat.id)})); setShowAdd(true) }}
                  style={{
                    padding:'7px', borderRadius:8, cursor:'pointer',
                    border:'1.5px solid var(--border)', background:'var(--bg3)',
                    color:'var(--text2)', fontWeight:700, fontSize:12,
                    display:'flex', alignItems:'center', justifyContent:'center', gap:5,
                  }}>
                  <Lock size={11}/> {connected.length ? 'Add another' : 'Connect manually'}
                </button>
              )}
            </div>
          )
        })}
      </div>

      {/* Manual add modal */}
      {showAdd && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:500, padding:20 }}
          onClick={e => e.target===e.currentTarget && setShowAdd(false)}>
          <div className="fp-modal">
            <div className="fp-modal-header">
              <div className="fp-modal-title">Add Connection Manually</div>
              <button className="fp-modal-close" onClick={()=>setShowAdd(false)}><X size={18}/></button>
            </div>
            <div style={{ background:'#fef3c750', border:'1px solid #f59e0b50', borderRadius:8, padding:'10px 14px', marginBottom:14, fontSize:13, color:'#b45309' }}>
              Use this for platforms without OAuth. Get your access token from the platform developer portal.
              For <strong>WhatsApp</strong>: Account ID = Meta Phone Number ID, Token = Meta System User Token.
            </div>
            {[
              { label:'Site', key:'site_id', type:'select', opts: sites.map(s=>({v:String(s.id),l:s.name})) },
              { label:'Platform', key:'platform_id', type:'select', opts: plats.map(p=>({v:String(p.id),l:p.name})) },
              { label:'Account Name / Handle', key:'account_name', placeholder:'@yourhandle' },
              { label:'Platform Account ID', key:'account_id', placeholder:'Optional — numeric ID' },
              { label:'Access Token', key:'access_token', type:'password', placeholder:'Paste token here…' },
            ].map(f => (
              <div className="fp-field" key={f.key}>
                <label className="fp-label">{f.label}</label>
                {f.opts ? (
                  <select className="fp-select" value={form[f.key]} onChange={e=>setForm(p=>({...p,[f.key]:e.target.value}))}>
                    <option value="">Select…</option>
                    {f.opts.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}
                  </select>
                ) : (
                  <input type={f.type||'text'} className="fp-input" placeholder={f.placeholder}
                    value={form[f.key]} onChange={e=>setForm(p=>({...p,[f.key]:e.target.value}))}/>
                )}
              </div>
            ))}
            <div style={{ display:'flex', gap:8, marginTop:16 }}>
              <button className="fp-btn fp-btn-ghost" onClick={()=>setShowAdd(false)}>Cancel</button>
              <button className="fp-btn fp-btn-primary" onClick={()=>addMutation.mutate(form)} disabled={addMutation.isPending}>Save Connection</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
