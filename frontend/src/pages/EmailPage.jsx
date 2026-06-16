import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../utils/api'
import { sitesApi } from '../utils/api'
import toast from 'react-hot-toast'
import { Mail, Plus, Send, Users, Trash2, X, Upload, Settings, Eye, BarChart3, Edit3 } from 'lucide-react'

const STARTER_TEMPLATES = [
  { name:'Ministry Update', category:'ministry', html:'<div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:20px"><h1 style="color:#5b3cf5">Ministry Update</h1><p style="color:#555;line-height:1.7">Dear {name},</p><p style="color:#555;line-height:1.7">We have an exciting update to share with you...</p><p style="color:#555;line-height:1.7">[Write your message here]</p><div style="margin-top:24px;padding-top:16px;border-top:1px solid #eee;font-size:12px;color:#999;text-align:center">God bless you | <a href="{unsubscribe}">Unsubscribe</a></div></div>' },
  { name:'Newsletter', category:'general', html:'<div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto"><div style="background:#5b3cf5;padding:24px;text-align:center"><h1 style="color:#fff;margin:0">Newsletter</h1></div><div style="padding:24px"><p style="color:#333;line-height:1.8">Hello {name},</p><p style="color:#333;line-height:1.8">This month\'s highlights...</p><p style="color:#333;line-height:1.8">[Your content here]</p></div><div style="background:#f8f8f8;padding:16px;text-align:center;font-size:12px;color:#999">Unsubscribe: <a href="{unsubscribe}">click here</a></div></div>' },
  { name:'Event Invite', category:'event', html:'<div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:20px"><h1 style="color:#5b3cf5;text-align:center">You\'re Invited!</h1><div style="background:#f0edff;border-radius:12px;padding:24px;margin:16px 0;text-align:center"><h2 style="color:#1a1a2e;margin:0">[Event Name]</h2><p style="color:#555;margin:8px 0">[Date] at [Time]</p><p style="color:#555">[Location]</p></div><p style="color:#555;line-height:1.7">Dear {name}, we would love to have you join us...</p><div style="text-align:center;margin:24px 0"><a href="#" style="background:#5b3cf5;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:700">RSVP Now</a></div><div style="font-size:12px;color:#999;text-align:center"><a href="{unsubscribe}">Unsubscribe</a></div></div>' },
]


  const buildHtmlFromSimple = (s) => {
    return `<div style="font-family:Inter,Georgia,sans-serif;max-width:600px;margin:0 auto;padding:0;background:#fff">
      ${s.header_bg ? `<div style="background:${s.header_bg};padding:32px 24px;text-align:center">
        <h1 style="color:${s.header_color||'#fff'};margin:0;font-size:24px">${s.header_title||''}</h1>
        ${s.header_sub ? `<p style="color:${s.header_color||'#fff'};opacity:0.85;margin:8px 0 0">${s.header_sub}</p>` : ''}
      </div>` : ''}
      <div style="padding:32px 24px">
        ${s.greeting ? `<p style="font-size:16px;color:#333;margin:0 0 16px">Dear {name},</p>` : ''}
        <div style="font-size:15px;color:#444;line-height:1.8;white-space:pre-wrap">${s.body||''}</div>
        ${s.cta_text && s.cta_url ? `<div style="text-align:center;margin:32px 0">
          <a href="${s.cta_url}" style="background:${s.cta_color||'#5b3cf5'};color:#fff;padding:14px 36px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px">${s.cta_text}</a>
        </div>` : ''}
      </div>
      <div style="background:#f8f8f8;padding:16px 24px;text-align:center;font-size:12px;color:#999">
        ${s.footer||'God bless you'} | <a href="{unsubscribe}" style="color:#999">Unsubscribe</a>
      </div>
    </div>`
  }

export default function EmailPage() {
  const qc = useQueryClient()
  const [tab, setTab] = useState('campaigns') // campaigns | subscribers | settings
  const [showCampaignForm, setShowCampaignForm] = useState(false)
  const [showSubscriberForm, setShowSubscriberForm] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [editCampaign, setEditCampaign] = useState(null)
  const [importText, setImportText] = useState('')
  const [siteId, setSiteId] = useState('')
  const [testEmail, setTestEmail] = useState('')

  const [campaignForm, setCampaignForm] = useState({ name:'', subject:'', from_name:'FlomiPost', from_email:'', reply_to:'', html_body:STARTER_TEMPLATES[0].html })
  const [editorMode, setEditorMode] = useState('simple') // 'simple' | 'html'
  const [subForm, setSubForm] = useState({ email:'', name:'', tags:'' })
  const [emailSettings, setEmailSettings] = useState({ smtp_host:'mail.ssiministries.org', smtp_port:'587', smtp_user:'', smtp_pass:'', email_from:'', email_from_name:'FlomiPost' })

  const { data: sitesRes } = useQuery({ queryKey:['sites'], queryFn:sitesApi.list })
  const sites = sitesRes?.data ?? []

  const { data: campaignsRes, isLoading: campLoading } = useQuery({ queryKey:['email-campaigns'], queryFn:()=>api.get('/email/campaigns') })
  const campaigns = campaignsRes?.data ?? []

  const { data: subsRes, isLoading: subsLoading } = useQuery({
    queryKey:['email-subs', siteId],
    queryFn:()=>api.get('/email/subscribers' + (siteId?`?site_id=${siteId}`:'')),
  })
  const subscribers = subsRes?.data ?? []
  const subsMeta = subsRes?.meta ?? {}

  const { data: countRes } = useQuery({ queryKey:['email-count'], queryFn:()=>api.get('/email/subscribers/count') })
  const counts = countRes?.data ?? {}

  const saveCampaignMutation = useMutation({
    mutationFn: d => editCampaign ? api.put(`/email/campaigns/${editCampaign.id}`,d) : api.post('/email/campaigns',d),
    onSuccess: () => { toast.success(editCampaign?'Updated!':'Campaign created!'); qc.invalidateQueries({queryKey:['email-campaigns']}); setShowCampaignForm(false); setEditCampaign(null) },
    onError: e => toast.error(e.message),
  })
  const sendMutation = useMutation({
    mutationFn: id => api.post(`/email/campaigns/${id}/send`),
    onSuccess: d => { toast.success(`Sent to ${d.data?.sent||0} subscribers!`); qc.invalidateQueries({queryKey:['email-campaigns']}) },
    onError: e => toast.error(e.message),
  })
  const testMutation = useMutation({
    mutationFn: ({id,to}) => api.post(`/email/campaigns/${id}/test`,{to}),
    onSuccess: () => toast.success('Test email sent!'),
    onError: e => toast.error(e.message),
  })
  const deleteCampaignMutation = useMutation({
    mutationFn: id => api.delete(`/email/campaigns/${id}`),
    onSuccess: () => { toast.success('Deleted'); qc.invalidateQueries({queryKey:['email-campaigns']}) },
  })
  const addSubMutation = useMutation({
    mutationFn: d => api.post('/email/subscribers',{...d,site_id:siteId||null}),
    onSuccess: () => { toast.success('Added!'); qc.invalidateQueries({queryKey:['email-subs']}); qc.invalidateQueries({queryKey:['email-count']}); setShowSubscriberForm(false); setSubForm({email:'',name:'',tags:''}) },
    onError: e => toast.error(e.message),
  })
  const importMutation = useMutation({
    mutationFn: () => {
      const lines = importText.split('\n').map(l=>l.trim()).filter(Boolean)
      const subs = lines.map(l => { const [name,email] = l.includes(',') ? l.split(',').map(s=>s.trim()) : [null,l.trim()]; return email ? {name,email} : {email:name} })
      return api.post('/email/subscribers/import',{subscribers:subs,site_id:siteId||null})
    },
    onSuccess: d => { toast.success(`${d.data?.added||0} imported!`); qc.invalidateQueries({queryKey:['email-subs']}); qc.invalidateQueries({queryKey:['email-count']}); setShowImport(false); setImportText('') },
    onError: e => toast.error(e.message),
  })
  const unsubMutation = useMutation({
    mutationFn: id => api.delete(`/email/subscribers/${id}`),
    onSuccess: () => { toast.success('Removed'); qc.invalidateQueries({queryKey:['email-subs']}); qc.invalidateQueries({queryKey:['email-count']}) },
  })
  const saveSettingsMutation = useMutation({
    mutationFn: () => api.post('/email/settings', emailSettings),
    onSuccess: () => { toast.success('Settings saved!'); setShowSettings(false) },
    onError: e => toast.error(e.message),
  })

  function openEdit(c) {
    setEditCampaign(c)
    setCampaignForm({ name:c.name, subject:c.subject, from_name:c.from_name, from_email:c.from_email||'', reply_to:c.reply_to||'', html_body:c.html_body||'' })
    setShowCampaignForm(true)
  }

  const statusColor = { draft:'var(--text3)', scheduled:'var(--amber)', sending:'var(--violet)', sent:'var(--green)', failed:'var(--coral)' }

  return (
    <div>
      <div className="fp-page-header">
        <div>
          <div className="fp-page-title">Email Marketing</div>
          <div className="fp-page-sub">{counts.subscribed||0} active subscribers · Replace MailerLite with your own</div>
        </div>
        <div style={{display:'flex',gap:8}}>
          <button className="fp-btn fp-btn-ghost fp-btn-sm" onClick={()=>setShowSettings(true)}><Settings size={13}/> SMTP Settings</button>
          {tab==='campaigns' && <button className="fp-btn fp-btn-primary fp-btn-sm" onClick={()=>{setEditCampaign(null);setCampaignForm({name:'',subject:'',from_name:'FlomiPost',from_email:'',reply_to:'',html_body:STARTER_TEMPLATES[0].html});setShowCampaignForm(true)}}><Plus size={13}/> New Campaign</button>}
          {tab==='subscribers' && <>
            <button className="fp-btn fp-btn-ghost fp-btn-sm" onClick={()=>setShowImport(true)}><Upload size={13}/> Import CSV</button>
            <button className="fp-btn fp-btn-primary fp-btn-sm" onClick={()=>setShowSubscriberForm(true)}><Plus size={13}/> Add Subscriber</button>
          </>}
        </div>
      </div>

      {/* Stat cards */}
      <div className="fp-stats" style={{marginBottom:20}}>
        <div className="fp-stat fp-stat-violet"><div className="fp-stat-icon"><Users size={18}/></div><div className="fp-stat-val">{counts.subscribed||0}</div><div className="fp-stat-lbl">Subscribers</div></div>
        <div className="fp-stat fp-stat-green"><div className="fp-stat-icon"><Send size={18}/></div><div className="fp-stat-val">{campaigns.filter(c=>c.status==='sent').length}</div><div className="fp-stat-lbl">Sent Campaigns</div></div>
        <div className="fp-stat fp-stat-amber"><div className="fp-stat-icon"><Eye size={18}/></div><div className="fp-stat-val">{campaigns.reduce((a,c)=>a+(c.total_opens||0),0)}</div><div className="fp-stat-lbl">Total Opens</div></div>
        <div className="fp-stat fp-stat-coral"><div className="fp-stat-icon"><Mail size={18}/></div><div className="fp-stat-val">{campaigns.length}</div><div className="fp-stat-lbl">Campaigns</div></div>
      </div>

      {/* Tabs */}
      <div style={{display:'flex',gap:4,marginBottom:20,background:'var(--bg3)',borderRadius:10,padding:4,width:'fit-content'}}>
        {[['campaigns','📧 Campaigns'],['subscribers','👥 Subscribers']].map(([v,l])=>(
          <button key={v} onClick={()=>setTab(v)}
            style={{padding:'6px 20px',borderRadius:8,border:'none',cursor:'pointer',fontWeight:700,fontSize:13,
              background:tab===v?'var(--violet)':'transparent',color:tab===v?'#fff':'var(--text3)'}}>
            {l}
          </button>
        ))}
      </div>

      {/* CAMPAIGNS TAB */}
      {tab==='campaigns' && (
        campLoading ? <div className="fp-loader"><div className="fp-spinner"/></div> :
        campaigns.length===0 ? (
          <div className="fp-card" style={{textAlign:'center',padding:'56px 24px'}}>
            <div style={{fontSize:40,marginBottom:12}}>📧</div>
            <div style={{fontSize:17,fontWeight:700,marginBottom:8}}>No campaigns yet</div>
            <div style={{fontSize:14,color:'var(--text3)',marginBottom:20}}>Create your first email campaign and send it to your subscribers.</div>
            <button className="fp-btn fp-btn-primary" onClick={()=>setShowCampaignForm(true)}><Plus size={14}/> Create Campaign</button>
          </div>
        ) : (
          <div style={{display:'flex',flexDirection:'column',gap:12}}>
            {campaigns.map(c=>(
              <div key={c.id} className="fp-card" style={{padding:'16px 20px'}}>
                <div style={{display:'flex',alignItems:'flex-start',gap:12}}>
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                      <span style={{fontWeight:700,fontSize:15,color:'var(--text)'}}>{c.name}</span>
                      <span style={{fontSize:11,fontWeight:700,padding:'2px 8px',borderRadius:20,background:statusColor[c.status]+'20',color:statusColor[c.status],textTransform:'capitalize'}}>{c.status}</span>
                    </div>
                    <div style={{fontSize:13,color:'var(--text3)',marginBottom:6}}>Subject: {c.subject}</div>
                    {c.status==='sent' && (
                      <div style={{display:'flex',gap:16,fontSize:12,color:'var(--text3)'}}>
                        <span>📤 {c.total_sent} sent</span>
                        <span>👁 {c.total_opens} opens ({c.total_sent>0?Math.round(c.total_opens/c.total_sent*100):0}%)</span>
                        <span>📅 {c.sent_at?.slice(0,10)}</span>
                      </div>
                    )}
                  </div>
                  <div style={{display:'flex',gap:6,flexShrink:0}}>
                    {c.status==='draft' && (
                      <>
                        <button className="fp-btn fp-btn-ghost fp-btn-sm" onClick={()=>openEdit(c)}><Edit3 size={13}/> Edit</button>
                        <div style={{display:'flex',gap:4,alignItems:'center'}}>
                          <input className="fp-input" placeholder="test@email.com" value={testEmail} onChange={e=>setTestEmail(e.target.value)} style={{width:160,fontSize:11,padding:'4px 8px'}}/>
                          <button className="fp-btn fp-btn-ghost fp-btn-sm" onClick={()=>testMutation.mutate({id:c.id,to:testEmail})} disabled={!testEmail||testMutation.isPending}><Eye size={13}/> Test</button>
                        </div>
                        <button className="fp-btn fp-btn-primary fp-btn-sm" onClick={()=>{ if(window.confirm(`Send to ${counts.subscribed||0} subscribers?`)) sendMutation.mutate(c.id) }} disabled={sendMutation.isPending}>
                          <Send size={13}/> {sendMutation.isPending?'Sending…':'Send Now'}
                        </button>
                      </>
                    )}
                    <button onClick={()=>{ if(window.confirm('Delete?')) deleteCampaignMutation.mutate(c.id) }} style={{background:'none',border:'none',cursor:'pointer',color:'var(--coral)'}}>
                      <Trash2 size={14}/>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* SUBSCRIBERS TAB */}
      {tab==='subscribers' && (
        <>
          {/* Site filter */}
          <div className="fp-card" style={{padding:'12px 16px',marginBottom:16}}>
            <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
              <span style={{fontSize:13,fontWeight:700,color:'var(--text3)'}}>Site:</span>
              <button onClick={()=>setSiteId('')} style={{padding:'4px 12px',borderRadius:20,cursor:'pointer',fontSize:12,fontWeight:700,border:!siteId?'none':'1.5px solid var(--border)',background:!siteId?'var(--violet)':'var(--bg2)',color:!siteId?'#fff':'var(--text2)'}}>All</button>
              {sites.map(s=>(
                <button key={s.id} onClick={()=>setSiteId(String(s.id))} style={{padding:'4px 12px',borderRadius:20,cursor:'pointer',fontSize:12,fontWeight:700,border:siteId===String(s.id)?'none':'1.5px solid var(--border)',background:siteId===String(s.id)?'var(--violet)':'var(--bg2)',color:siteId===String(s.id)?'#fff':'var(--text2)'}}>{s.name}</button>
              ))}
            </div>
          </div>

          {subsLoading ? <div className="fp-loader"><div className="fp-spinner"/></div> :
            subscribers.length===0 ? (
              <div className="fp-card" style={{textAlign:'center',padding:'40px 24px'}}>
                <div style={{fontSize:36,marginBottom:10}}>👥</div>
                <div style={{fontSize:15,fontWeight:700,marginBottom:8}}>No subscribers yet</div>
                <div style={{display:'flex',gap:8,justifyContent:'center',marginTop:16}}>
                  <button className="fp-btn fp-btn-ghost" onClick={()=>setShowImport(true)}><Upload size={13}/> Import CSV</button>
                  <button className="fp-btn fp-btn-primary" onClick={()=>setShowSubscriberForm(true)}><Plus size={13}/> Add manually</button>
                </div>
              </div>
            ) : (
              <div className="fp-card">
                <div className="fp-card-title" style={{marginBottom:16}}><Users size={15}/> {subsMeta.total||subscribers.length} subscribers</div>
                <table className="fp-table">
                  <thead><tr><th>Email</th><th>Name</th><th>Tags</th><th>Status</th><th>Added</th><th></th></tr></thead>
                  <tbody>
                    {subscribers.map(s=>(
                      <tr key={s.id}>
                        <td style={{fontWeight:500}}>{s.email}</td>
                        <td style={{color:'var(--text3)'}}>{s.name||'—'}</td>
                        <td style={{fontSize:11,color:'var(--text3)'}}>{s.tags||'—'}</td>
                        <td><span style={{fontSize:11,fontWeight:700,padding:'2px 8px',borderRadius:20,background:s.status==='subscribed'?'#dcfce7':'#fee2e2',color:s.status==='subscribed'?'#16a34a':'#dc2626'}}>{s.status}</span></td>
                        <td style={{fontSize:11,color:'var(--text3)'}}>{s.subscribed_at?.slice(0,10)}</td>
                        <td><button onClick={()=>{ if(window.confirm('Unsubscribe?')) unsubMutation.mutate(s.id) }} style={{background:'none',border:'none',cursor:'pointer',color:'var(--coral)'}}><Trash2 size={12}/></button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )
          }
        </>
      )}

      {/* CAMPAIGN FORM MODAL */}
      {showCampaignForm && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.5)',display:'flex',alignItems:'flex-start',justifyContent:'center',zIndex:500,padding:20,overflowY:'auto'}}>
          <div className="fp-modal" style={{maxWidth:760,width:'100%',marginTop:20}}>
            <div className="fp-modal-header">
              <div className="fp-modal-title">{editCampaign?'Edit Campaign':'New Email Campaign'}</div>
              <button className="fp-modal-close" onClick={()=>{setShowCampaignForm(false);setEditCampaign(null)}}><X size={18}/></button>
            </div>

            {/* Templates */}
            {!editCampaign && (
              <div style={{marginBottom:16}}>
                <label className="fp-label">Start with a template</label>
                <div style={{display:'flex',gap:8}}>
                  {STARTER_TEMPLATES.map(t=>(
                    <button key={t.name} onClick={()=>setCampaignForm(f=>({...f,html_body:t.html}))}
                      style={{padding:'6px 14px',borderRadius:8,cursor:'pointer',fontSize:12,fontWeight:600,border:'1.5px solid var(--border)',background:'var(--bg3)',color:'var(--text2)'}}>
                      {t.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
              <div className="fp-field">
                <label className="fp-label">Campaign Name *</label>
                <input className="fp-input" value={campaignForm.name} onChange={e=>setCampaignForm(f=>({...f,name:e.target.value}))} placeholder="May Newsletter"/>
              </div>
              <div className="fp-field">
                <label className="fp-label">Subject Line *</label>
                <input className="fp-input" value={campaignForm.subject} onChange={e=>setCampaignForm(f=>({...f,subject:e.target.value}))} placeholder="This month's update from us"/>
              </div>
              <div className="fp-field">
                <label className="fp-label">From Name</label>
                <input className="fp-input" value={campaignForm.from_name} onChange={e=>setCampaignForm(f=>({...f,from_name:e.target.value}))} placeholder="Sanmi Dawodu"/>
              </div>
              <div className="fp-field">
                <label className="fp-label">From Email</label>
                <input className="fp-input" value={campaignForm.from_email} onChange={e=>setCampaignForm(f=>({...f,from_email:e.target.value}))} placeholder="noreply@ssiministries.org"/>
              </div>
            </div>

            <div className="fp-field">
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                <label className="fp-label" style={{margin:0}}>Email Body</label>
                <div style={{display:'flex',gap:0,background:'var(--bg3)',borderRadius:8,padding:3}}>
                  {[['simple','Simple'],['html','HTML Code']].map(([m,l])=>(
                    <button key={m} onClick={()=>setEditorMode(m)}
                      style={{padding:'4px 14px',borderRadius:6,border:'none',cursor:'pointer',fontSize:12,fontWeight:700,
                        background:editorMode===m?'var(--primary)':'transparent',color:editorMode===m?'#fff':'var(--text2)'}}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>

              {editorMode==='simple' ? (
                <div style={{display:'flex',flexDirection:'column',gap:10,padding:'12px',background:'var(--bg2)',borderRadius:10,border:'1px solid var(--border)'}}>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8}}>
                    <div><label className="fp-label" style={{fontSize:11}}>Header background color</label><input type="color" value={campaignForm.simple?.header_bg||'#5b3cf5'} onChange={e=>setCampaignForm(f=>({...f,simple:{...f.simple,header_bg:e.target.value}}))} style={{width:'100%',height:36,border:'1px solid var(--border)',borderRadius:6,padding:2}}/></div>
                    <div><label className="fp-label" style={{fontSize:11}}>Header title</label><input className="fp-input" style={{fontSize:12}} value={campaignForm.simple?.header_title||''} onChange={e=>setCampaignForm(f=>({...f,simple:{...f.simple,header_title:e.target.value}}))} placeholder="Ministry Update"/></div>
                    <div><label className="fp-label" style={{fontSize:11}}>Header subtitle</label><input className="fp-input" style={{fontSize:12}} value={campaignForm.simple?.header_sub||''} onChange={e=>setCampaignForm(f=>({...f,simple:{...f.simple,header_sub:e.target.value}}))} placeholder="May 2026"/></div>
                  </div>
                  <div>
                    <label className="fp-label" style={{fontSize:11}}>Message body <span style={{color:'var(--text3)'}}>— use {'{name}'} for subscriber name</span></label>
                    <textarea className="fp-input" rows={6} style={{width:'100%',resize:'vertical',fontSize:13,lineHeight:1.7}} value={campaignForm.simple?.body||''} onChange={e=>setCampaignForm(f=>({...f,simple:{...f.simple,body:e.target.value}}))} placeholder="Dear {name},&#10;&#10;We have something special for you today..."/>
                  </div>
                  <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8}}>
                    <div><label className="fp-label" style={{fontSize:11}}>Button text</label><input className="fp-input" style={{fontSize:12}} value={campaignForm.simple?.cta_text||''} onChange={e=>setCampaignForm(f=>({...f,simple:{...f.simple,cta_text:e.target.value}}))} placeholder="Read More"/></div>
                    <div><label className="fp-label" style={{fontSize:11}}>Button URL</label><input className="fp-input" style={{fontSize:12}} value={campaignForm.simple?.cta_url||''} onChange={e=>setCampaignForm(f=>({...f,simple:{...f.simple,cta_url:e.target.value}}))} placeholder="https://..."/></div>
                    <div><label className="fp-label" style={{fontSize:11}}>Button color</label><input type="color" value={campaignForm.simple?.cta_color||'#5b3cf5'} onChange={e=>setCampaignForm(f=>({...f,simple:{...f.simple,cta_color:e.target.value}}))} style={{width:'100%',height:36,border:'1px solid var(--border)',borderRadius:6,padding:2}}/></div>
                  </div>
                  <div><label className="fp-label" style={{fontSize:11}}>Footer text</label><input className="fp-input" style={{fontSize:12}} value={campaignForm.simple?.footer||''} onChange={e=>setCampaignForm(f=>({...f,simple:{...f.simple,footer:e.target.value}}))} placeholder="God bless you — Sanmi Dawodu Ministries"/></div>
                  <button className="fp-btn fp-btn-ghost fp-btn-sm" style={{alignSelf:'flex-start'}} onClick={()=>{const html=buildHtmlFromSimple(campaignForm.simple||{});setCampaignForm(f=>({...f,html_body:html}));setEditorMode('html');toast.success('Converted to HTML — you can now fine-tune the code')}}>Convert to HTML for fine-tuning →</button>
                </div>
              ) : (
                <>
                  <div style={{fontSize:11,color:'var(--text3)',marginBottom:4}}>Use {'{name}'} for subscriber name. Paste or write HTML directly.</div>
                  <textarea className="fp-textarea" value={campaignForm.html_body} onChange={e=>setCampaignForm(f=>({...f,html_body:e.target.value}))} style={{height:240,fontFamily:'monospace',fontSize:12,resize:'vertical'}}/>
                </>
              )}
            </div>

            {/* Preview — works for both modes */}
            {(editorMode==='html' ? campaignForm.html_body : campaignForm.simple?.body) && (
              <div style={{marginBottom:12}}>
                <label className="fp-label">Preview</label>
                <div style={{border:'1.5px solid var(--border)',borderRadius:8,overflow:'hidden'}}>
                  <iframe srcDoc={editorMode==='html' ? campaignForm.html_body : buildHtmlFromSimple(campaignForm.simple||{})} style={{width:'100%',height:250,border:'none'}} title="preview"/>
                </div>
              </div>
            )}

            <div style={{display:'flex',gap:8,marginTop:16}}>
              <button className="fp-btn fp-btn-ghost" onClick={()=>{setShowCampaignForm(false);setEditCampaign(null)}}>Cancel</button>
              <button className="fp-btn fp-btn-primary" onClick={()=>{ const body = editorMode==='simple' ? buildHtmlFromSimple(campaignForm.simple||{}) : campaignForm.html_body; saveCampaignMutation.mutate({...campaignForm, html_body: body}) }} disabled={!campaignForm.name||!campaignForm.subject||saveCampaignMutation.isPending}>
                {saveCampaignMutation.isPending?'Saving…':editCampaign?'Save Changes':'Create Campaign'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD SUBSCRIBER MODAL */}
      {showSubscriberForm && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:500,padding:20}} onClick={e=>e.target===e.currentTarget&&setShowSubscriberForm(false)}>
          <div className="fp-modal" style={{maxWidth:440}}>
            <div className="fp-modal-header"><div className="fp-modal-title">Add Subscriber</div><button className="fp-modal-close" onClick={()=>setShowSubscriberForm(false)}><X size={18}/></button></div>
            <div className="fp-field"><label className="fp-label">Email *</label><input className="fp-input" placeholder="email@example.com" value={subForm.email} onChange={e=>setSubForm(f=>({...f,email:e.target.value}))}/></div>
            <div className="fp-field"><label className="fp-label">Name</label><input className="fp-input" placeholder="John Smith" value={subForm.name} onChange={e=>setSubForm(f=>({...f,name:e.target.value}))}/></div>
            <div className="fp-field"><label className="fp-label">Tags <span style={{color:'var(--text3)',fontWeight:400}}>(comma separated)</span></label><input className="fp-input" placeholder="ministry, newsletter" value={subForm.tags} onChange={e=>setSubForm(f=>({...f,tags:e.target.value}))}/></div>
            <div style={{display:'flex',gap:8,marginTop:16}}>
              <button className="fp-btn fp-btn-ghost" onClick={()=>setShowSubscriberForm(false)}>Cancel</button>
              <button className="fp-btn fp-btn-primary" onClick={()=>addSubMutation.mutate(subForm)} disabled={!subForm.email||addSubMutation.isPending}>Add Subscriber</button>
            </div>
          </div>
        </div>
      )}

      {/* IMPORT MODAL */}
      {showImport && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:500,padding:20}} onClick={e=>e.target===e.currentTarget&&setShowImport(false)}>
          <div className="fp-modal">
            <div className="fp-modal-header"><div className="fp-modal-title">Import Subscribers</div><button className="fp-modal-close" onClick={()=>setShowImport(false)}><X size={18}/></button></div>
            <div style={{background:'var(--bg3)',borderRadius:8,padding:'10px 14px',fontSize:12,color:'var(--text3)',marginBottom:12}}>One per line: <code>email</code> or <code>Name, email@example.com</code></div>
            <textarea className="fp-textarea" placeholder={"john@example.com\nJane Smith, jane@church.org\npastor@ministry.org"} value={importText} onChange={e=>setImportText(e.target.value)} style={{height:160,resize:'vertical'}}/>
            <div style={{display:'flex',gap:8,marginTop:16}}>
              <button className="fp-btn fp-btn-ghost" onClick={()=>setShowImport(false)}>Cancel</button>
              <button className="fp-btn fp-btn-primary" onClick={()=>importMutation.mutate()} disabled={!importText||importMutation.isPending}>{importMutation.isPending?'Importing…':'Import'}</button>
            </div>
          </div>
        </div>
      )}

      {/* SMTP SETTINGS MODAL */}
      {showSettings && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:500,padding:20}} onClick={e=>e.target===e.currentTarget&&setShowSettings(false)}>
          <div className="fp-modal" style={{maxWidth:500}}>
            <div className="fp-modal-header"><div className="fp-modal-title">Email / SMTP Settings</div><button className="fp-modal-close" onClick={()=>setShowSettings(false)}><X size={18}/></button></div>
            <div style={{background:'var(--violet-lt)',borderRadius:8,padding:'10px 14px',fontSize:12,color:'var(--violet)',marginBottom:12}}>Using your Mailcow server at mail.ssiministries.org — no monthly fees!</div>
            {[
              {label:'SMTP Host', key:'smtp_host', ph:'mail.ssiministries.org'},
              {label:'SMTP Port', key:'smtp_port', ph:'587'},
              {label:'SMTP Username', key:'smtp_user', ph:'noreply@ssiministries.org'},
              {label:'SMTP Password', key:'smtp_pass', ph:'••••••••', type:'password'},
              {label:'From Email', key:'email_from', ph:'noreply@ssiministries.org'},
              {label:'From Name', key:'email_from_name', ph:'FlomiPost'},
            ].map(f=>(
              <div key={f.key} className="fp-field">
                <label className="fp-label">{f.label}</label>
                <input type={f.type||'text'} className="fp-input" placeholder={f.ph} value={emailSettings[f.key]||''} onChange={e=>setEmailSettings(s=>({...s,[f.key]:e.target.value}))}/>
              </div>
            ))}
            <div style={{display:'flex',gap:8,marginTop:16}}>
              <button className="fp-btn fp-btn-ghost" onClick={()=>setShowSettings(false)}>Cancel</button>
              <button className="fp-btn fp-btn-primary" onClick={()=>saveSettingsMutation.mutate()}>Save Settings</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
