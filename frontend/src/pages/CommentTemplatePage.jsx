import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, sitesApi, connectionsApi } from '../utils/api'
import toast from 'react-hot-toast'
import { MessageSquare, Plus, Trash2, Copy, Zap, Edit2 } from 'lucide-react'

const CATEGORIES = ['general','greeting','appreciation','prayer','cta','question']
const CAT_COLORS = { general:'var(--text3)', greeting:'var(--blue)', appreciation:'var(--green)', prayer:'var(--violet)', cta:'var(--orange)', question:'var(--cyan)' }

export default function CommentTemplatePage() {
  const qc = useQueryClient()
  const [tab, setTab] = useState('templates')
  const [siteId, setSiteId] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name:'', category:'general', text:'', platforms:'all', site_id:'' })
  const [ruleForm, setRuleForm] = useState({ name:'', platform:'instagram', connection_id:'', trigger_keywords:'', reply_text:'', site_id:'' })
  const [showRuleForm, setShowRuleForm] = useState(false)
  const [copied, setCopied] = useState(null)

  const { data: sitesRes } = useQuery({ queryKey:['sites'], queryFn: sitesApi.list })
  const { data: connsRes } = useQuery({ queryKey:['connections'], queryFn: ()=>connectionsApi.list() })
  const { data: tmplRes, refetch: refTmpl } = useQuery({ queryKey:['comment-templates',siteId], queryFn:()=>api.get('/comment-templates'+(siteId?'?site_id='+siteId:'')) })
  const { data: ruleRes, refetch: refRule } = useQuery({ queryKey:['auto-reply-rules'], queryFn:()=>api.get('/auto-reply-rules') })

  const sites    = sitesRes?.data ?? []
  const allConns = connsRes?.data ?? []
  const templates = tmplRes?.data ?? []
  const rules     = ruleRes?.data ?? []

  const s = (k,v) => setForm(f=>({...f,[k]:v}))
  const rs = (k,v) => setRuleForm(f=>({...f,[k]:v}))

  const addTmpl = useMutation({
    mutationFn: ()=>api.post('/comment-templates',{...form,site_id:parseInt(form.site_id||siteId||1)}),
    onSuccess:()=>{ refTmpl(); setShowForm(false); setForm({name:'',category:'general',text:'',platforms:'all',site_id:''}); toast.success('Template saved!') },
    onError:e=>toast.error(e.message)
  })

  const delTmpl = useMutation({
    mutationFn: id=>api.delete('/comment-templates/'+id),
    onSuccess:()=>{ refTmpl(); toast.success('Deleted') }
  })

  const addRule = useMutation({
    mutationFn: ()=>api.post('/auto-reply-rules',{
      ...ruleForm,
      site_id:parseInt(ruleForm.site_id||siteId||1),
      connection_id:parseInt(ruleForm.connection_id),
      trigger_keywords: ruleForm.trigger_keywords.split(',').map(k=>k.trim().toLowerCase()).filter(Boolean)
    }),
    onSuccess:()=>{ refRule(); setShowRuleForm(false); setRuleForm({name:'',platform:'instagram',connection_id:'',trigger_keywords:'',reply_text:'',site_id:''}); toast.success('Auto-reply rule saved!') },
    onError:e=>toast.error(e.message)
  })

  const delRule = useMutation({
    mutationFn: id=>api.delete('/auto-reply-rules/'+id),
    onSuccess:()=>{ refRule(); toast.success('Deleted') }
  })

  const copyText = (text, id) => {
    navigator.clipboard.writeText(text)
    setCopied(id)
    toast.success('Copied to clipboard!')
    setTimeout(()=>setCopied(null), 2000)
  }

  const grouped = CATEGORIES.reduce((acc, cat) => {
    const items = templates.filter(t=>t.category===cat)
    if (items.length) acc[cat] = items
    return acc
  }, {})

  return (
    <div>
      <div className="fp-page-header" style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
        <div>
          <h1 className="fp-page-title">Comment Templates</h1>
          <p className="fp-page-sub">One-click replies and smart auto-reply rules for your platforms</p>
        </div>
        <div style={{display:'flex',gap:8}}>
          <select className="fp-select" style={{width:160}} value={siteId} onChange={e=>setSiteId(e.target.value)}>
            <option value="">All Sites</option>
            {sites.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div style={{display:'flex',gap:0,marginBottom:20,borderBottom:'2px solid var(--border)'}}>
        {[['templates','Comment Templates'],['autoreplies','Auto-Reply Rules']].map(([key,label])=>(
          <button key={key} onClick={()=>setTab(key)}
            style={{padding:'8px 20px',border:'none',borderBottom:tab===key?'2px solid var(--primary)':'2px solid transparent',
              marginBottom:'-2px',cursor:'pointer',fontSize:13,fontWeight:tab===key?700:500,
              background:'transparent',color:tab===key?'var(--primary)':'var(--text2)'}}>
            {label}
          </button>
        ))}
      </div>

      {/* COMMENT TEMPLATES TAB */}
      {tab==='templates' && (
        <>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:16}}>
            <div style={{fontSize:13,color:'var(--text3)'}}>Click <strong>Copy</strong> on any template, then paste it as your comment on any platform.</div>
            <button className="fp-btn fp-btn-primary fp-btn-sm" onClick={()=>setShowForm(v=>!v)}><Plus size={13}/> New Template</button>
          </div>

          {showForm && (
            <div className="fp-card" style={{marginBottom:16}}>
              <div style={{fontWeight:700,marginBottom:12}}>New Comment Template</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10,marginBottom:10}}>
                <div><label className="fp-label">Name</label><input className="fp-input" value={form.name} onChange={e=>s('name',e.target.value)} placeholder="Prayer response"/></div>
                <div><label className="fp-label">Category</label>
                  <select className="fp-select" value={form.category} onChange={e=>s('category',e.target.value)}>
                    {CATEGORIES.map(c=><option key={c} value={c}>{c.charAt(0).toUpperCase()+c.slice(1)}</option>)}
                  </select>
                </div>
                <div><label className="fp-label">Site</label>
                  <select className="fp-select" value={form.site_id||siteId} onChange={e=>s('site_id',e.target.value)}>
                    <option value="">Select...</option>
                    {sites.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </div>
              <div style={{marginBottom:10}}><label className="fp-label">Comment text</label>
                <textarea className="fp-input" rows={3} value={form.text} onChange={e=>s('text',e.target.value)} placeholder="Thank you for watching! God bless you..." style={{width:'100%',resize:'vertical'}}/></div>
              <div style={{marginBottom:10}}><label className="fp-label">Platforms (comma separated or "all")</label>
                <input className="fp-input" value={form.platforms} onChange={e=>s('platforms',e.target.value)} placeholder="all, youtube, facebook, instagram"/></div>
              <div style={{display:'flex',gap:8}}><button className="fp-btn fp-btn-primary fp-btn-sm" onClick={()=>addTmpl.mutate()} disabled={addTmpl.isPending}>Save</button><button className="fp-btn fp-btn-ghost fp-btn-sm" onClick={()=>setShowForm(false)}>Cancel</button></div>
            </div>
          )}

          {/* Templates grouped by category */}
          {Object.entries(grouped).map(([cat, items])=>(
            <div key={cat} style={{marginBottom:20}}>
              <div style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'.08em',color:CAT_COLORS[cat]||'var(--text3)',marginBottom:8}}>{cat}</div>
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(320px,1fr))',gap:10}}>
                {items.map(t=>(
                  <div key={t.id} className="fp-card" style={{padding:'12px 14px',display:'flex',flexDirection:'column',gap:8}}>
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
                      <div style={{fontWeight:700,fontSize:13}}>{t.name}</div>
                      <div style={{display:'flex',gap:4}}>
                        <button onClick={()=>copyText(t.text,t.id)} className="fp-btn fp-btn-primary fp-btn-sm" style={{fontSize:11,padding:'3px 10px'}}>
                          {copied===t.id?'Copied!':'Copy'}
                        </button>
                        <button onClick={()=>delTmpl.mutate(t.id)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text3)',padding:'3px'}}><Trash2 size={12}/></button>
                      </div>
                    </div>
                    <div style={{fontSize:13,color:'var(--text)',lineHeight:1.6}}>{t.text}</div>
                    <div style={{fontSize:10,color:'var(--text3)'}}>{t.platforms} · Used {t.used_count} times</div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {templates.length===0 && (
            <div className="fp-card" style={{textAlign:'center',padding:40,color:'var(--text3)'}}>
              <MessageSquare size={36} style={{opacity:.2,marginBottom:10}}/>
              <p>No templates yet. Add one above.</p>
            </div>
          )}
        </>
      )}

      {/* AUTO-REPLY RULES TAB */}
      {tab==='autoreplies' && (
        <>
          <div style={{display:'flex',justifyContent:'space-between',marginBottom:16}}>
            <div style={{fontSize:13,color:'var(--text3)'}}>When someone comments a trigger keyword on your posts, FlomiPost auto-replies with your message.</div>
            <button className="fp-btn fp-btn-primary fp-btn-sm" onClick={()=>setShowRuleForm(v=>!v)}><Plus size={13}/> New Rule</button>
          </div>

          {showRuleForm && (
            <div className="fp-card" style={{marginBottom:16}}>
              <div style={{fontWeight:700,marginBottom:12,display:'flex',alignItems:'center',gap:6}}><Zap size={14}/> New Auto-Reply Rule</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10,marginBottom:10}}>
                <div><label className="fp-label">Rule name</label><input className="fp-input" value={ruleForm.name} onChange={e=>rs('name',e.target.value)} placeholder="VOG keyword reply"/></div>
                <div><label className="fp-label">Platform</label>
                  <select className="fp-select" value={ruleForm.platform} onChange={e=>rs('platform',e.target.value)}>
                    {['facebook','instagram','youtube','twitter','telegram'].map(p=><option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div><label className="fp-label">Site</label>
                  <select className="fp-select" value={ruleForm.site_id} onChange={e=>rs('site_id',e.target.value)}>
                    <option value="">Select...</option>
                    {sites.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </div>
              <div style={{marginBottom:10}}><label className="fp-label">Trigger keywords (comma separated)</label>
                <input className="fp-input" value={ruleForm.trigger_keywords} onChange={e=>rs('trigger_keywords',e.target.value)} placeholder="buy, price, where, purchase, link"/></div>
              <div style={{marginBottom:10}}><label className="fp-label">Auto-reply message</label>
                <textarea className="fp-input" rows={3} value={ruleForm.reply_text} onChange={e=>rs('reply_text',e.target.value)} placeholder="Hi! You can get the book here: ..." style={{width:'100%',resize:'vertical'}}/></div>
              <div style={{fontSize:12,color:'var(--text3)',marginBottom:10,padding:'8px 10px',background:'var(--bg2)',borderRadius:8}}>
                Note: Auto-replies work via the Unified Inbox when comments are fetched. The reply is suggested — you approve before sending.
              </div>
              <div style={{display:'flex',gap:8}}><button className="fp-btn fp-btn-primary fp-btn-sm" onClick={()=>addRule.mutate()} disabled={addRule.isPending}>Save Rule</button><button className="fp-btn fp-btn-ghost fp-btn-sm" onClick={()=>setShowRuleForm(false)}>Cancel</button></div>
            </div>
          )}

          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            {rules.length===0 && <div className="fp-card" style={{textAlign:'center',padding:40,color:'var(--text3)'}}><Zap size={36} style={{opacity:.2,marginBottom:10}}/><p>No auto-reply rules yet.</p></div>}
            {rules.map(r=>(
              <div key={r.id} className="fp-card" style={{display:'flex',alignItems:'center',gap:12}}>
                <Zap size={18} color="var(--orange)" style={{flexShrink:0}}/>
                <div style={{flex:1}}>
                  <div style={{fontWeight:700,fontSize:14}}>{r.name}</div>
                  <div style={{fontSize:12,color:'var(--text3)',marginTop:2}}>
                    {r.platform} · Keywords: <strong>{JSON.parse(r.trigger_keywords||'[]').join(', ')}</strong>
                  </div>
                  <div style={{fontSize:12,color:'var(--text)',marginTop:4,fontStyle:'italic'}}>"{r.reply_text?.slice(0,80)}..."</div>
                  <div style={{fontSize:11,color:'var(--text3)',marginTop:2}}>Triggered {r.triggered_count} times</div>
                </div>
                <button onClick={()=>delRule.mutate(r.id)} className="fp-btn fp-btn-ghost fp-btn-sm" style={{color:'var(--red)'}}><Trash2 size={12}/></button>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
