import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, sitesApi, connectionsApi } from '../utils/api'
import toast from 'react-hot-toast'
import { Bot, RefreshCw, Repeat, Package, Trash2, Plus, Play, RotateCcw, BookOpen, Calendar, Youtube, Star, Gift, Timer, FlaskConical } from 'lucide-react'

const TONES   = ['engaging','inspirational','professional','casual','promotional','educational','witty','urgent','exciting','celebratory']
const FREQS   = ['daily','weekdays','weekly','monthly']
const DAYS    = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']
const QUOTE_TYPES = ['scripture','prayer','quote','custom']

const TABS = [
  {key:'calendar',    icon:Bot,          label:'AI Calendar'},
  {key:'recurring',   icon:Repeat,       label:'Recurring'},
  {key:'evergreen',   icon:RotateCcw,    label:'Evergreen'},
  {key:'products',    icon:Package,      label:'Products'},
  {key:'quotes',      icon:BookOpen,     label:'Scripture/Quotes'},
  {key:'holidays',    icon:Calendar,     label:'Holidays'},
  {key:'testimonials',icon:Star,         label:'Testimonials'},
  {key:'leadmagnets', icon:Gift,         label:'Lead Magnets'},
  {key:'countdowns',  icon:Timer,        label:'Countdown'},
  {key:'youtube',     icon:Youtube,      label:'YouTube'},
  {key:'abtests',     icon:FlaskConical, label:'A/B Test'},
]

const ENDPOINTS = {
  calendar:'/ai-calendars', recurring:'/recurring-posts', evergreen:'/evergreen',
  products:'/product-feeds', quotes:'/quote-schedules', holidays:'/calendar-posts',
  testimonials:'/testimonials', leadmagnets:'/lead-magnets',
  countdowns:'/event-countdowns', youtube:'/youtube-autoposts', abtests:'/ab-tests',
}
const RUN_ENDPOINTS = {
  calendar:   id=>`/ai-calendars/${id}/generate`,
  evergreen:  id=>`/evergreen/${id}/run`,
  products:   id=>`/product-feeds/${id}/run`,
  testimonials:id=>`/testimonials/${id}/run`,
  leadmagnets:id=>`/lead-magnets/${id}/run`,
  youtube:    id=>`/youtube-autoposts/${id}/check`,
  abtests:    id=>`/ab-tests/${id}/run`,
}
const RUN_LABELS = {
  calendar:'Generate Posts', evergreen:'Recycle Now', products:'Post Product',
  testimonials:'Post Testimonial', leadmagnets:'Post Lead Magnet',
  youtube:'Check New Video', abtests:'Launch A/B Test',
}

export default function AutoPostPage() {
  const qc = useQueryClient()
  const [tab, setTab]       = useState('calendar')
  const [siteId, setSiteId] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [form, setForm]     = useState({})
  const [running, setRunning] = useState(null)

  const { data: sitesRes } = useQuery({ queryKey:['sites'],       queryFn: sitesApi.list })
  const { data: connsRes } = useQuery({ queryKey:['connections'], queryFn: ()=>connectionsApi.list() })
  const { data: setsRes }  = useQuery({ queryKey:['sets', form.site_id], queryFn: ()=>api.get('/sets?site_id='+form.site_id), enabled: !!form.site_id })
  const sites    = sitesRes?.data ?? []
  const allConns = connsRes?.data ?? []
  const siteConns = allConns.filter(c => !form.site_id || String(c.site_id)===String(form.site_id))
  const sets = setsRes?.data ?? []

  const q_calendar    = useQuery({ queryKey:['calendar',siteId],    queryFn:()=>api.get('/ai-calendars'+(siteId?'?site_id='+siteId:'')) })
  const q_recurring   = useQuery({ queryKey:['recurring',siteId],   queryFn:()=>api.get('/recurring-posts'+(siteId?'?site_id='+siteId:'')) })
  const q_evergreen   = useQuery({ queryKey:['evergreen',siteId],   queryFn:()=>api.get('/evergreen') })
  const q_products    = useQuery({ queryKey:['products',siteId],    queryFn:()=>api.get('/product-feeds') })
  const q_quotes      = useQuery({ queryKey:['quotes',siteId],      queryFn:()=>api.get('/quote-schedules') })
  const q_holidays    = useQuery({ queryKey:['holidays',siteId],    queryFn:()=>api.get('/calendar-posts') })
  const q_testimonials= useQuery({ queryKey:['testimonials',siteId],queryFn:()=>api.get('/testimonials') })
  const q_leadmagnets = useQuery({ queryKey:['leadmagnets',siteId], queryFn:()=>api.get('/lead-magnets') })
  const q_countdowns  = useQuery({ queryKey:['countdowns',siteId],  queryFn:()=>api.get('/event-countdowns') })
  const q_youtube     = useQuery({ queryKey:['youtube',siteId],     queryFn:()=>api.get('/youtube-autoposts') })
  const q_abtests     = useQuery({ queryKey:['abtests',siteId],     queryFn:()=>api.get('/ab-tests') })
  const queries = { calendar:q_calendar, recurring:q_recurring, evergreen:q_evergreen, products:q_products, quotes:q_quotes, holidays:q_holidays, testimonials:q_testimonials, leadmagnets:q_leadmagnets, countdowns:q_countdowns, youtube:q_youtube, abtests:q_abtests }

  const s = (k,v) => setForm(f=>({...f,[k]:v}))
  const toggleConn = id => {
    const cur = form.connection_ids||[]
    s('connection_ids', cur.includes(id)?cur.filter(x=>x!==id):[...cur,id])
  }
  const applySet = (setId) => {
    const st = sets.find(x => String(x.id) === String(setId))
    if (!st) return
    let ids = []
    try { ids = (JSON.parse(st.connection_ids||'[]')||[]).map(String) } catch {}
    const valid = ids.filter(id => siteConns.some(c => String(c.id) === id))
    s('connection_ids', valid)
    if (!valid.length) toast.error(`"${st.name}" has no accounts on this site`)
    else toast.success(`Selected ${valid.length} from "${st.name}"`)
  }
  const toggleListItem = (field, item) => {
    const cur = form[field]||[]
    s(field, cur.some(x=>JSON.stringify(x)===JSON.stringify(item)) ? cur.filter(x=>JSON.stringify(x)!==JSON.stringify(item)) : [...cur,item])
  }

  const refetch = () => queries[tab]?.refetch()

  const createMut = useMutation({
    mutationFn: () => {
      const payload = {
        ...form,
        site_id: parseInt(form.site_id||siteId||1),
        connection_ids: (form.connection_ids||[]).map(Number),
      }
      return api.post(ENDPOINTS[tab], payload)
    },
    onSuccess:()=>{ refetch(); setShowForm(false); setForm({}); toast.success('Created!') },
    onError:e=>toast.error(e.message)
  })

  const runItem = async (id) => {
    const ep = RUN_ENDPOINTS[tab]?.(id)
    if (!ep) return
    setRunning(id)
    try {
      const r = await api.post(ep)
      toast.success(r.data?.message || r.message || 'Done!')
      refetch()
    } catch(e) { toast.error(e.message) }
    finally { setRunning(null) }
  }

  const deleteItem = async (id) => {
    if (!window.confirm('Delete this?')) return
    await api.delete(`${ENDPOINTS[tab]}/${id}`)
    refetch()
    toast.success('Deleted')
  }

  const items = queries[tab]?.data?.data ?? []
  const currentTab = TABS.find(t=>t.key===tab)
  const canRun = !!RUN_ENDPOINTS[tab]

  // Connection picker
  const ConnPicker = () => (
    <div style={{marginBottom:10}}>
      <label className="fp-label">Publish to platforms</label>
      {sets.length > 0 && (
        <select className="fp-select" value="" title="Quick-select a saved Set of accounts"
          onChange={e=>{ if(e.target.value){ applySet(e.target.value); e.target.value='' } }}
          style={{fontSize:12,maxWidth:240,marginBottom:6}}>
          <option value="">Use a Set…</option>
          {sets.map(st=><option key={st.id} value={st.id}>{st.name}</option>)}
        </select>
      )}
      <div style={{display:'flex',flexWrap:'wrap',gap:6,maxHeight:130,overflowY:'auto',padding:'2px 0'}}>
        {siteConns.length===0 && <span style={{fontSize:12,color:'var(--text3)'}}>Select a site first</span>}
        {siteConns.map(c=>{
          const sel=(form.connection_ids||[]).includes(String(c.id))
          return <label key={c.id} style={{display:'flex',alignItems:'center',gap:4,fontSize:11,cursor:'pointer',padding:'3px 7px',borderRadius:6,border:'1px solid var(--border)',background:sel?'var(--primary-10)':'var(--bg2)'}}>
            <input type="checkbox" checked={sel} onChange={()=>toggleConn(String(c.id))}/>
            {sites.find(s=>String(s.id)===String(c.site_id))?.name?.split(' ')[0]} · {c.account_name} <span style={{color:'var(--text3)'}}>({c.key_name})</span>
          </label>
        })}
      </div>
    </div>
  )

  // Common fields
  const CommonFields = () => (
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
      <div><label className="fp-label">Name *</label><input className="fp-input" value={form.name||''} onChange={e=>s('name',e.target.value)} placeholder="e.g. Daily Morning Scripture"/></div>
      <div><label className="fp-label">Site *</label>
        <select className="fp-select" value={form.site_id||siteId||''} onChange={e=>s('site_id',e.target.value)}>
          <option value="">Select site...</option>
          {sites.map(st=><option key={st.id} value={st.id}>{st.name}</option>)}
        </select>
      </div>
    </div>
  )

  const ToneFreqTime = ({showFreq=false}) => (
    <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:10}}>
      <div><label className="fp-label">Tone</label><select className="fp-select" value={form.tone||form.ai_tone||'engaging'} onChange={e=>s(tab==='products'||tab==='leadmagnets'?'ai_tone':'tone',e.target.value)}>{TONES.map(t=><option key={t} value={t}>{t}</option>)}</select></div>
      {showFreq && <div><label className="fp-label">Frequency</label><select className="fp-select" value={form.frequency||'weekly'} onChange={e=>s('frequency',e.target.value)}>{FREQS.map(f=><option key={f} value={f}>{f}</option>)}</select></div>}
      <div><label className="fp-label">Post time</label><input className="fp-input" type="time" value={form.post_time||'09:00'} onChange={e=>s('post_time',e.target.value)}/></div>
    </div>
  )

  const renderForm = () => {
    switch(tab) {
      case 'calendar': return <>
        <CommonFields/>
        <div style={{marginBottom:10}}><label className="fp-label">Topic / Niche *</label><input className="fp-input" value={form.topic||''} onChange={e=>s('topic',e.target.value)} placeholder="Prayer and Spiritual Warfare, Caregiver Tips, Business Growth..."/></div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:10}}>
          <div><label className="fp-label">Tone</label><select className="fp-select" value={form.tone||'engaging'} onChange={e=>s('tone',e.target.value)}>{TONES.map(t=><option key={t} value={t}>{t}</option>)}</select></div>
          <div><label className="fp-label">Days to generate</label><select className="fp-select" value={form.days||30} onChange={e=>s('days',e.target.value)}>{[7,14,30,60,90].map(d=><option key={d} value={d}>{d} days</option>)}</select></div>
          <div><label className="fp-label">Daily post time</label><input className="fp-input" type="time" value={form.post_time||'09:00'} onChange={e=>s('post_time',e.target.value)}/></div>
        </div>
        <div style={{marginBottom:10}}><label className="fp-label">AI Instructions (optional)</label><input className="fp-input" value={form.ai_instructions||''} onChange={e=>s('ai_instructions',e.target.value)} placeholder="Always mention SSIM, include a prayer point..."/></div>
        <ConnPicker/>
      </>
      case 'recurring': return <>
        <CommonFields/>
        <div style={{marginBottom:10}}><label className="fp-label">Caption *</label><textarea className="fp-input" rows={4} value={form.caption||''} onChange={e=>s('caption',e.target.value)} placeholder="Good morning! Today's prayer: Lord, guide my steps..." style={{width:'100%',resize:'vertical'}}/></div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:10,marginBottom:10}}>
          <div><label className="fp-label">Frequency</label><select className="fp-select" value={form.frequency||'daily'} onChange={e=>s('frequency',e.target.value)}>{FREQS.map(f=><option key={f} value={f}>{f}</option>)}</select></div>
          <div><label className="fp-label">Post time</label><input className="fp-input" type="time" value={form.post_time||'07:00'} onChange={e=>s('post_time',e.target.value)}/></div>
          {form.frequency==='weekly'&&<div><label className="fp-label">Day</label><select className="fp-select" value={form.day_of_week||1} onChange={e=>s('day_of_week',e.target.value)}>{DAYS.map((d,i)=><option key={i+1} value={i+1}>{d}</option>)}</select></div>}
        </div>
        <ConnPicker/>
      </>
      case 'evergreen': return <>
        <CommonFields/>
        <ToneFreqTime showFreq/>
        <div style={{marginBottom:10}}><label className="fp-label">Min post age (days)</label><input className="fp-input" type="number" value={form.min_age_days||30} onChange={e=>s('min_age_days',e.target.value)} min={7} style={{width:120}}/></div>
        <ConnPicker/>
      </>
      case 'products': return <>
        <CommonFields/>
        <div style={{marginBottom:10}}><label className="fp-label">Store URL *</label><input className="fp-input" value={form.store_url||''} onChange={e=>s('store_url',e.target.value)} placeholder="https://ssiministries.org"/></div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
          <div><label className="fp-label">WooCommerce Key (ck_...)</label><input className="fp-input" value={form.api_key||''} onChange={e=>s('api_key',e.target.value)}/></div>
          <div><label className="fp-label">WooCommerce Secret (cs_...)</label><input className="fp-input" type="password" value={form.api_secret||''} onChange={e=>s('api_secret',e.target.value)}/></div>
        </div>
        <ToneFreqTime showFreq/>
        <div style={{marginBottom:10}}><label className="fp-label">AI Instructions</label><input className="fp-input" value={form.ai_instructions||''} onChange={e=>s('ai_instructions',e.target.value)} placeholder="Emphasize faith transformation, target believers..."/></div>
        <ConnPicker/>
      </>
      case 'quotes': return <>
        <CommonFields/>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10,marginBottom:10}}>
          <div><label className="fp-label">Type</label><select className="fp-select" value={form.type||'scripture'} onChange={e=>s('type',e.target.value)}>{QUOTE_TYPES.map(t=><option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}</select></div>
          <div><label className="fp-label">Tone</label><select className="fp-select" value={form.tone||'inspirational'} onChange={e=>s('tone',e.target.value)}>{TONES.map(t=><option key={t} value={t}>{t}</option>)}</select></div>
          <div><label className="fp-label">Post time (daily)</label><input className="fp-input" type="time" value={form.post_time||'06:00'} onChange={e=>s('post_time',e.target.value)}/></div>
        </div>
        <div style={{marginBottom:10}}><label className="fp-label">AI Instructions (optional)</label><input className="fp-input" value={form.ai_instructions||''} onChange={e=>s('ai_instructions',e.target.value)} placeholder="Focus on prayer, healing, victory..."/></div>
        {form.type==='custom' && <div style={{marginBottom:10}}>
          <label className="fp-label">Add custom quotes/scriptures</label>
          <div style={{display:'flex',gap:8,marginBottom:6}}>
            <input className="fp-input" placeholder="Quote text" id="qt" style={{flex:2}}/>
            <input className="fp-input" placeholder="Author / Reference" id="qa" style={{flex:1}}/>
            <button className="fp-btn fp-btn-ghost fp-btn-sm" onClick={()=>{const t=document.getElementById('qt').value,a=document.getElementById('qa').value;if(t){toggleListItem('custom_quotes',{text:t,author:a});document.getElementById('qt').value='';document.getElementById('qa').value=''}}}>Add</button>
          </div>
          {(form.custom_quotes||[]).map((q,i)=><div key={i} style={{fontSize:12,padding:'4px 8px',background:'var(--bg2)',borderRadius:6,marginBottom:4,display:'flex',justifyContent:'space-between'}}>"{q.text}" — {q.author} <button onClick={()=>s('custom_quotes',(form.custom_quotes||[]).filter((_,j)=>j!==i))} style={{background:'none',border:'none',cursor:'pointer',color:'var(--red)',fontSize:12}}>×</button></div>)}
        </div>}
        <ConnPicker/>
      </>
      case 'holidays': return <>
        <CommonFields/>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10,marginBottom:10}}>
          <div><label className="fp-label">Calendar type</label><select className="fp-select" value={form.event_type||'christian'} onChange={e=>s('event_type',e.target.value)}><option value="christian">Christian/Church</option><option value="national">National/US</option></select></div>
          <div><label className="fp-label">Tone</label><select className="fp-select" value={form.tone||'inspirational'} onChange={e=>s('tone',e.target.value)}>{TONES.map(t=><option key={t} value={t}>{t}</option>)}</select></div>
          <div><label className="fp-label">Days before event</label><select className="fp-select" value={form.days_before??0} onChange={e=>s('days_before',e.target.value)}><option value={0}>On the day</option><option value={1}>1 day before</option><option value={3}>3 days before</option><option value={7}>1 week before</option></select></div>
        </div>
        <div style={{marginBottom:10}}><label className="fp-label">AI Instructions (optional)</label><input className="fp-input" value={form.ai_instructions||''} onChange={e=>s('ai_instructions',e.target.value)} placeholder="Always include a relevant scripture..."/></div>
        <ConnPicker/>
      </>
      case 'testimonials': return <>
        <CommonFields/>
        <ToneFreqTime showFreq/>
        <div style={{marginBottom:10}}>
          <label className="fp-label">Add testimonials</label>
          <div style={{display:'flex',gap:8,marginBottom:6,flexWrap:'wrap'}}>
            <input className="fp-input" placeholder="Testimonial text" id="tt" style={{flex:3,minWidth:200}}/>
            <input className="fp-input" placeholder="Name" id="tn" style={{flex:1,minWidth:100}}/>
            <input className="fp-input" placeholder="Location (optional)" id="tl" style={{flex:1,minWidth:100}}/>
            <button className="fp-btn fp-btn-ghost fp-btn-sm" onClick={()=>{const t=document.getElementById('tt').value,n=document.getElementById('tn').value,l=document.getElementById('tl').value;if(t&&n){toggleListItem('testimonials',{text:t,name:n,location:l});['tt','tn','tl'].forEach(id=>document.getElementById(id).value='')}}}>Add</button>
          </div>
          {(form.testimonials||[]).map((t,i)=><div key={i} style={{fontSize:12,padding:'4px 8px',background:'var(--bg2)',borderRadius:6,marginBottom:4,display:'flex',justifyContent:'space-between'}}>"{t.text.slice(0,60)}..." — {t.name} <button onClick={()=>s('testimonials',(form.testimonials||[]).filter((_,j)=>j!==i))} style={{background:'none',border:'none',cursor:'pointer',color:'var(--red)',fontSize:12}}>×</button></div>)}
        </div>
        <ConnPicker/>
      </>
      case 'leadmagnets': return <>
        <CommonFields/>
        <ToneFreqTime showFreq/>
        <div style={{marginBottom:10}}>
          <label className="fp-label">Add lead magnets / free resources</label>
          <div style={{display:'flex',gap:8,marginBottom:6,flexWrap:'wrap'}}>
            <input className="fp-input" placeholder="Title" id="lt" style={{flex:2,minWidth:150}}/>
            <input className="fp-input" placeholder="Description" id="ld" style={{flex:3,minWidth:200}}/>
            <input className="fp-input" placeholder="URL" id="lu" style={{flex:2,minWidth:150}}/>
            <button className="fp-btn fp-btn-ghost fp-btn-sm" onClick={()=>{const t=document.getElementById('lt').value,d=document.getElementById('ld').value,u=document.getElementById('lu').value;if(t&&u){toggleListItem('magnets',{title:t,description:d,url:u});['lt','ld','lu'].forEach(id=>document.getElementById(id).value='')}}}>Add</button>
          </div>
          {(form.magnets||[]).map((m,i)=><div key={i} style={{fontSize:12,padding:'4px 8px',background:'var(--bg2)',borderRadius:6,marginBottom:4,display:'flex',justifyContent:'space-between'}}>{m.title} → {m.url} <button onClick={()=>s('magnets',(form.magnets||[]).filter((_,j)=>j!==i))} style={{background:'none',border:'none',cursor:'pointer',color:'var(--red)',fontSize:12}}>×</button></div>)}
        </div>
        <ConnPicker/>
      </>
      case 'countdowns': return <>
        <CommonFields/>
        <div style={{display:'grid',gridTemplateColumns:'2fr 1fr 1fr',gap:10,marginBottom:10}}>
          <div><label className="fp-label">Event name *</label><input className="fp-input" value={form.event_name||''} onChange={e=>s('event_name',e.target.value)} placeholder="Annual Prayer Conference"/></div>
          <div><label className="fp-label">Event date *</label><input className="fp-input" type="date" value={form.event_date||''} onChange={e=>s('event_date',e.target.value)}/></div>
          <div><label className="fp-label">Post time</label><input className="fp-input" type="time" value={form.post_time||'09:00'} onChange={e=>s('post_time',e.target.value)}/></div>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
          <div><label className="fp-label">Event URL (optional)</label><input className="fp-input" value={form.event_url||''} onChange={e=>s('event_url',e.target.value)} placeholder="https://..."/></div>
          <div><label className="fp-label">Tone</label><select className="fp-select" value={form.tone||'exciting'} onChange={e=>s('tone',e.target.value)}>{TONES.map(t=><option key={t} value={t}>{t}</option>)}</select></div>
        </div>
        <div style={{marginBottom:10}}><label className="fp-label">Post on days before event (comma separated, e.g. 30,14,7,3,2,1)</label>
          <input className="fp-input" value={form.post_days_str||(form.post_days||[30,14,7,3,2,1]).join(',')} onChange={e=>{s('post_days_str',e.target.value);s('post_days',e.target.value.split(',').map(Number).filter(Boolean))}}/></div>
        <ConnPicker/>
      </>
      case 'youtube': return <>
        <CommonFields/>
        <div style={{marginBottom:10}}><label className="fp-label">YouTube Channel ID *</label><input className="fp-input" value={form.channel_id||''} onChange={e=>s('channel_id',e.target.value)} placeholder="UCxxxxxxxxxxxxxxxx (from youtube.com/channel/UC...)"/></div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
          <div><label className="fp-label">Tone</label><select className="fp-select" value={form.tone||'engaging'} onChange={e=>s('tone',e.target.value)}>{TONES.map(t=><option key={t} value={t}>{t}</option>)}</select></div>
        </div>
        <div style={{marginBottom:10}}><label className="fp-label">AI Instructions (optional)</label><input className="fp-input" value={form.ai_instructions||''} onChange={e=>s('ai_instructions',e.target.value)} placeholder="This is for SSIM YouTube channel, ministry focus..."/></div>
        <div style={{fontSize:12,color:'var(--text3)',marginBottom:10,padding:'8px 10px',background:'var(--bg2)',borderRadius:8}}>💡 Requires a YouTube Data API key in Settings. Checks for new videos every hour.</div>
        <ConnPicker/>
      </>
      case 'abtests': return <>
        <CommonFields/>
        <div style={{marginBottom:10}}><label className="fp-label">Caption A *</label><textarea className="fp-input" rows={3} value={form.caption_a||''} onChange={e=>s('caption_a',e.target.value)} placeholder="Version A — more direct, professional tone..." style={{width:'100%',resize:'vertical'}}/></div>
        <div style={{marginBottom:10}}><label className="fp-label">Caption B *</label><textarea className="fp-input" rows={3} value={form.caption_b||''} onChange={e=>s('caption_b',e.target.value)} placeholder="Version B — more emotional, story-driven tone..." style={{width:'100%',resize:'vertical'}}/></div>
        <div style={{fontSize:12,color:'var(--text3)',marginBottom:10,padding:'8px 10px',background:'var(--bg2)',borderRadius:8}}>💡 Version A posts today, Version B posts tomorrow. Compare engagement in Analytics to find the winner.</div>
        <ConnPicker/>
      </>
      default: return <CommonFields/>
    }
  }

  const getItemMeta = item => {
    const parts = []
    if(item.topic)           parts.push(`Topic: ${item.topic}`)
    if(item.frequency)       parts.push(item.frequency)
    if(item.tone||item.ai_tone) parts.push(`Tone: ${item.tone||item.ai_tone}`)
    if(item.event_name)      parts.push(`Event: ${item.event_name}`)
    if(item.channel_id)      parts.push(`Channel: ${item.channel_id}`)
    if(item.store_url)       parts.push(item.store_url)
    if(item.type)            parts.push(item.type)
    if(item.posts_generated) parts.push(`${item.posts_generated} posts generated`)
    if(item.last_posted_at)  parts.push(`Last: ${new Date(item.last_posted_at).toLocaleDateString()}`)
    if(item.status)          parts.push(item.status)
    return parts.join(' · ')
  }

  return (
    <div>
      <div className="fp-page-header" style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
        <div><h1 className="fp-page-title">AI Auto Post</h1><p className="fp-page-sub">All your automated posting tools in one place</p></div>
        <div style={{display:'flex',gap:8}}>
          <select className="fp-select" style={{width:160}} value={siteId} onChange={e=>setSiteId(e.target.value)}>
            <option value="">All Sites</option>
            {sites.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <button className="fp-btn fp-btn-primary" onClick={()=>{setShowForm(v=>!v);setForm({})}}><Plus size={14}/> Add New</button>
        </div>
      </div>

      {/* Scrollable tabs */}
      <div style={{display:'flex',gap:0,marginBottom:20,borderBottom:'2px solid var(--border)',overflowX:'auto',whiteSpace:'nowrap'}}>
        {TABS.map(({key,icon:Icon,label})=>(
          <button key={key} onClick={()=>{setTab(key);setShowForm(false);setForm({})}}
            style={{display:'inline-flex',alignItems:'center',gap:5,padding:'8px 14px',border:'none',
              borderBottom:tab===key?'2px solid var(--primary)':'2px solid transparent',
              marginBottom:'-2px',cursor:'pointer',fontSize:12,fontWeight:tab===key?700:500,
              background:'transparent',color:tab===key?'var(--primary)':'var(--text2)',flexShrink:0}}>
            <Icon size={13}/>{label}
          </button>
        ))}
      </div>

      {/* Form */}
      {showForm && (
        <div className="fp-card" style={{marginBottom:16}}>
          <div style={{fontWeight:700,marginBottom:12,fontSize:14,display:'flex',alignItems:'center',gap:6}}>
            {currentTab && <currentTab.icon size={15}/>} New {currentTab?.label}
          </div>
          {renderForm()}
          <div style={{display:'flex',gap:8,marginTop:4}}>
            <button className="fp-btn fp-btn-primary fp-btn-sm" onClick={()=>createMut.mutate()} disabled={createMut.isPending}>{createMut.isPending?'Saving...':'Save'}</button>
            <button className="fp-btn fp-btn-ghost fp-btn-sm" onClick={()=>{setShowForm(false);setForm({})}}>Cancel</button>
          </div>
        </div>
      )}

      {/* Items list */}
      <div style={{display:'flex',flexDirection:'column',gap:8}}>
        {items.length===0 ? (
          <div className="fp-card" style={{textAlign:'center',padding:40,color:'var(--text3)'}}>
            {currentTab && <currentTab.icon size={36} style={{opacity:.2,marginBottom:10}}/>}
            <p style={{margin:0}}>No {currentTab?.label} yet. Click "+ Add New" to create one.</p>
          </div>
        ) : items.map(item=>(
          <div key={item.id} className="fp-card" style={{display:'flex',alignItems:'center',gap:12}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontWeight:700,fontSize:14}}>{item.name}</div>
              <div style={{fontSize:11,color:'var(--text3)',marginTop:2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{getItemMeta(item)}</div>
            </div>
            <div style={{display:'flex',gap:6,flexShrink:0}}>
              {canRun && <button className="fp-btn fp-btn-primary fp-btn-sm" onClick={()=>runItem(item.id)} disabled={running===item.id}>
                {running===item.id?<><RefreshCw size={12} style={{animation:'spin 1s linear infinite'}}/> Working...</>:<><Play size={12}/> {RUN_LABELS[tab]||'Run'}</>}
              </button>}
              <button className="fp-btn fp-btn-ghost fp-btn-sm" style={{color:'var(--red)'}} onClick={()=>deleteItem(item.id)}><Trash2 size={12}/></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
