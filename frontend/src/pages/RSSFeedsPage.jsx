import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Rss, Plus, Trash2, RefreshCw, Settings, Bot, Zap } from 'lucide-react'
import toast from 'react-hot-toast'
import { api, sitesApi, connectionsApi } from '../utils/api'

const TONES = ['engaging','inspirational','professional','casual','urgent','educational','promotional','witty']

const rssApi = {
  list:   ()       => api.get('/rss-feeds'),
  create: (data)   => api.post('/rss-feeds', data),
  update: (id, d)  => api.put('/rss-feeds/'+id, d),
  delete: (id)     => api.delete('/rss-feeds/'+id),
  fetch:  (id)     => api.post('/rss-feeds/'+id+'/fetch'),
}

export default function RSSFeedsPage() {
  const qc = useQueryClient()
  const [showAdd, setShowAdd]     = useState(false)
  const [editing, setEditing]     = useState(null)
  const [fetching, setFetching]   = useState(null)
  const [form, setForm] = useState({
    url:'', name:'', site_id:'', connection_ids:[],
    auto_post:false, use_ai:false, ai_tone:'engaging',
    ai_instructions:'', template:'{{title}}\n\n{{link}}'
  })

  const { data: feedsRes }  = useQuery({ queryKey:['rss-feeds'], queryFn: rssApi.list })
  const { data: sitesRes }  = useQuery({ queryKey:['sites'],     queryFn: sitesApi.list })
  const { data: connsRes }  = useQuery({ queryKey:['connections'],queryFn: ()=>connectionsApi.list() })
  const feeds   = feedsRes?.data ?? []
  const sites   = sitesRes?.data ?? []
  const allConns = connsRes?.data ?? []

  const s = (k,v) => setForm(f=>({...f,[k]:v}))
  const toggleConn = id => s('connection_ids', form.connection_ids.includes(id) ? form.connection_ids.filter(x=>x!==id) : [...form.connection_ids, id])

  const addMut = useMutation({
    mutationFn: () => rssApi.create({...form, connection_ids: form.connection_ids.map(Number), auto_post: form.auto_post?1:0, use_ai: form.use_ai?1:0}),
    onSuccess: () => { qc.invalidateQueries(['rss-feeds']); setShowAdd(false); setForm({url:'',name:'',site_id:'',connection_ids:[],auto_post:false,use_ai:false,ai_tone:'engaging',ai_instructions:'',template:'{{title}}\n\n{{link}}'}); toast.success('Feed added!') },
    onError: e => toast.error(e.message)
  })

  const updMut = useMutation({
    mutationFn: () => rssApi.update(editing.id, {...form, connection_ids: form.connection_ids.map(Number), auto_post: form.auto_post?1:0, use_ai: form.use_ai?1:0}),
    onSuccess: () => { qc.invalidateQueries(['rss-feeds']); setEditing(null); toast.success('Feed updated!') },
    onError: e => toast.error(e.message)
  })

  const delMut  = useMutation({ mutationFn: id => rssApi.delete(id), onSuccess: () => qc.invalidateQueries(['rss-feeds']) })

  const fetchFeed = async id => {
    setFetching(id)
    try {
      const r = await rssApi.fetch(id)
      toast.success(`${r.data?.posts_created ?? 0} new posts created`)
      qc.invalidateQueries(['rss-feeds'])
    } catch(e) { toast.error(e.message) }
    finally { setFetching(null) }
  }

  const openEdit = feed => {
    setForm({
      url: feed.url, name: feed.name, site_id: String(feed.site_id),
      connection_ids: JSON.parse(feed.connection_ids||'[]').map(String),
      auto_post: !!feed.auto_post, use_ai: !!feed.use_ai,
      ai_tone: feed.ai_tone||'engaging', ai_instructions: feed.ai_instructions||'',
      template: feed.template||'{{title}}\n\n{{link}}'
    })
    setEditing(feed)
    setShowAdd(false)
  }

  const FeedForm = ({onSave, onCancel, saving, form, s, toggleConn, sites, allConns, editing}) => {
    const siteConns = allConns.filter(c => String(c.site_id) === String(form.site_id))
    return (
      <div className="fp-card" style={{marginBottom:16}}>
        <div style={{fontWeight:700,fontSize:14,marginBottom:14,display:'flex',alignItems:'center',gap:6}}>
          <Rss size={15}/> {editing ? 'Edit Feed' : 'New RSS Feed'}
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
          <div>
            <label className="fp-label">Feed URL *</label>
            <input className="fp-input" placeholder="https://site.com/feed/" value={form.url} onChange={e=>s('url',e.target.value)}/>
          </div>
          <div>
            <label className="fp-label">Display Name</label>
            <input className="fp-input" placeholder="My Blog Feed" value={form.name} onChange={e=>s('name',e.target.value)}/>
          </div>
        </div>
        <div style={{marginBottom:10}}>
          <label className="fp-label">Site *</label>
          <select className="fp-select" value={form.site_id} onChange={e=>s('site_id',e.target.value)}>
            <option value="">Select site...</option>
            {sites.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        {form.site_id && (
          <div style={{marginBottom:10}}>
            <label className="fp-label">Publish to platforms</label>
            <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
              {siteConns.length === 0 && <span style={{fontSize:12,color:'var(--text3)'}}>No connections for this site</span>}
              {siteConns.map(c=>(
                <label key={c.id} style={{display:'flex',alignItems:'center',gap:4,fontSize:12,cursor:'pointer',padding:'4px 8px',borderRadius:6,border:'1px solid var(--border)',background:form.connection_ids.includes(String(c.id))?'var(--primary-10)':'var(--bg2)'}}>
                  <input type="checkbox" checked={form.connection_ids.includes(String(c.id))} onChange={()=>toggleConn(String(c.id))}/>
                  {c.account_name} <span style={{color:'var(--text3)',fontSize:10}}>({c.key_name})</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Publishing options */}
        <div style={{display:'flex',gap:16,marginBottom:10,padding:'10px 12px',background:'var(--bg2)',borderRadius:8}}>
          <label style={{display:'flex',alignItems:'center',gap:6,fontSize:13,cursor:'pointer'}}>
            <input type="checkbox" checked={form.auto_post} onChange={e=>s('auto_post',e.target.checked)}/>
            <Zap size={13} color="var(--orange)"/> <strong>Auto-publish</strong>
            <span style={{fontSize:11,color:'var(--text3)'}}>instantly post to platforms</span>
          </label>
          <label style={{display:'flex',alignItems:'center',gap:6,fontSize:13,cursor:'pointer'}}>
            <input type="checkbox" checked={form.use_ai} onChange={e=>s('use_ai',e.target.checked)}/>
            <Bot size={13} color="var(--primary)"/> <strong>AI captions</strong>
            <span style={{fontSize:11,color:'var(--text3)'}}>rewrite with AI</span>
          </label>
        </div>

        {/* AI settings */}
        {form.use_ai && (
          <div style={{border:'1px solid var(--border)',borderRadius:8,padding:12,marginBottom:10,background:'var(--surface)'}}>
            <div style={{fontWeight:600,fontSize:12,marginBottom:8,display:'flex',alignItems:'center',gap:4}}><Bot size={13}/> AI Caption Settings</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 2fr',gap:10}}>
              <div>
                <label className="fp-label">Tone</label>
                <select className="fp-select" value={form.ai_tone} onChange={e=>s('ai_tone',e.target.value)}>
                  {TONES.map(t=><option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label className="fp-label">Extra instructions (optional)</label>
                <input className="fp-input" placeholder="e.g. Always end with a call to action, use emojis..." value={form.ai_instructions} onChange={e=>s('ai_instructions',e.target.value)}/>
              </div>
            </div>
          </div>
        )}

        {/* Template (shown when AI off) */}
        {!form.use_ai && (
          <div style={{marginBottom:10}}>
            <label className="fp-label">Caption template <span style={{color:'var(--text3)',fontWeight:400}}>use {'{{title}}'}, {'{{link}}'}, {'{{description}}'}</span></label>
            <textarea className="fp-input" rows={3} value={form.template} onChange={e=>s('template',e.target.value)} style={{width:'100%',resize:'vertical',fontFamily:'monospace',fontSize:12}}/>
          </div>
        )}

        <div style={{display:'flex',gap:8}}>
          <button className="fp-btn fp-btn-primary fp-btn-sm" onClick={onSave} disabled={saving}>{saving?'Saving...':'Save Feed'}</button>
          <button className="fp-btn fp-btn-ghost fp-btn-sm" onClick={onCancel}>Cancel</button>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="fp-page-header" style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:24}}>
        <div>
          <h1 className="fp-page-title">RSS / Auto Post</h1>
          <p className="fp-page-sub">Automatically publish content from RSS feeds with optional AI rewriting</p>
        </div>
        <button className="fp-btn fp-btn-primary" onClick={()=>{setShowAdd(v=>!v);setEditing(null)}}><Plus size={14}/> Add Feed</button>
      </div>

      {showAdd && <FeedForm onSave={()=>addMut.mutate()} onCancel={()=>setShowAdd(false)} saving={addMut.isPending} form={form} s={s} toggleConn={toggleConn} sites={sites} allConns={allConns} editing={null}/>}
      {editing && <FeedForm onSave={()=>updMut.mutate()} onCancel={()=>setEditing(null)} saving={updMut.isPending} form={form} s={s} toggleConn={toggleConn} sites={sites} allConns={allConns} editing={editing}/>}

      <div style={{display:'flex',flexDirection:'column',gap:10}}>
        {feeds.length === 0 && (
          <div className="fp-card" style={{textAlign:'center',padding:40,color:'var(--text3)'}}>
            <Rss size={40} style={{opacity:.2,marginBottom:10}}/>
            <p>No RSS feeds yet. Add one to start auto-posting.</p>
          </div>
        )}
        {feeds.map(feed=>{
          const conns = JSON.parse(feed.connection_ids||'[]')
          return (
            <div key={feed.id} className="fp-card" style={{display:'flex',alignItems:'center',gap:12}}>
              <Rss size={22} color="var(--orange)" style={{flexShrink:0}}/>
              <div style={{flex:1}}>
                <div style={{fontWeight:700,fontSize:14}}>{feed.name}</div>
                <div style={{fontSize:12,color:'var(--text3)',marginBottom:4}}>{feed.url}</div>
                <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                  <button onClick={async()=>{ await rssApi.update(feed.id,{...feed,connection_ids:JSON.parse(feed.connection_ids||'[]'),auto_post:feed.auto_post?0:1,use_ai:feed.use_ai}); qc.invalidateQueries(['rss-feeds']); toast.success(feed.auto_post?'Switched to Draft mode':'Auto-publish ON') }}
                    style={{fontSize:11,padding:'2px 8px',borderRadius:4,border:'none',cursor:'pointer',background:feed.auto_post?'#f97316':'var(--bg2)',color:feed.auto_post?'#fff':'var(--text3)',fontWeight:600}}>
                    {feed.auto_post?'⚡ Auto-publish':'📋 Draft mode'}
                  </button>
                  <button onClick={async()=>{ await rssApi.update(feed.id,{...feed,connection_ids:JSON.parse(feed.connection_ids||'[]'),auto_post:feed.auto_post,use_ai:feed.use_ai?0:1}); qc.invalidateQueries(['rss-feeds']); toast.success(feed.use_ai?'AI captions OFF':'AI captions ON') }}
                    style={{fontSize:11,padding:'2px 8px',borderRadius:4,border:'none',cursor:'pointer',background:feed.use_ai?'var(--primary)':'var(--bg2)',color:feed.use_ai?'#fff':'var(--text3)',fontWeight:600}}>
                    {feed.use_ai?`🤖 AI (${feed.ai_tone})`:'✏️ Manual caption'}
                  </button>
                  <span style={{fontSize:11,color:'var(--text3)'}}>{conns.length} platform{conns.length!==1?'s':''} · {feed.posts_created||0} posts created</span>
                  {feed.last_fetched && <span style={{fontSize:11,color:'var(--text3)'}}>Last: {new Date(feed.last_fetched).toLocaleString()}</span>}
                </div>
              </div>
              <div style={{display:'flex',gap:6}}>
                <button className="fp-btn fp-btn-ghost fp-btn-sm" onClick={()=>fetchFeed(feed.id)} disabled={fetching===feed.id} title="Fetch now">
                  <RefreshCw size={13} style={{animation:fetching===feed.id?'spin 1s linear infinite':undefined}}/> {fetching===feed.id?'Fetching...':'Fetch'}
                </button>
                <button className="fp-btn fp-btn-ghost fp-btn-sm" onClick={()=>openEdit(feed)} title="Edit"><Settings size={13}/></button>
                <button className="fp-btn fp-btn-ghost fp-btn-sm" style={{color:'var(--red)'}} onClick={()=>delMut.mutate(feed.id)} title="Remove"><Trash2 size={13}/></button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
