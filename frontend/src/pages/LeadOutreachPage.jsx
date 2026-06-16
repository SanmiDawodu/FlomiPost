import { useState, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, sitesApi } from '../utils/api'
import toast from 'react-hot-toast'
import { Upload, Sparkles, Linkedin, Calendar, Trash2, User, Building, ExternalLink, CheckCircle, Clock, FileText, Send } from 'lucide-react'

const STATUS_COLOR = { new:'var(--text3)', draft:'#7c3aed', scheduled:'#059669', sent:'#0066FF' }
const STATUS_LABEL = { new:'New', draft:'Draft', scheduled:'Scheduled', sent:'Sent' }

const SAMPLE_CSV = `First Name,Last Name,Company,Title,LinkedIn URL,Email,Industry,Location
John,Smith,Acme Corp,CEO,https://linkedin.com/in/johnsmith,john@acme.com,Technology,New York
Sarah,Johnson,TechStart,VP Marketing,https://linkedin.com/in/sarahjohnson,,SaaS,London
Mike,Brown,RetailCo,Head of Sales,https://linkedin.com/in/mikebrown,mike@retail.com,Retail,Chicago`

export default function LeadOutreachPage() {
  const qc = useQueryClient()
  const fileRef = useRef()
  const [siteId, setSiteId] = useState('')
  const [csvText, setCsvText] = useState('')
  const [importing, setImporting] = useState(false)
  const [generating, setGenerating] = useState(null)
  const [scheduling, setScheduling] = useState(null)
  const [msgType, setMsgType] = useState('linkedin_post')
  const [product, setProduct] = useState('')
  const [tone, setTone] = useState('professional')
  const [schedDate, setSchedDate] = useState('')
  const [activeMsg, setActiveMsg] = useState({})
  const [filter, setFilter] = useState('all')

  const { data: sitesRes } = useQuery({ queryKey:['sites'], queryFn:sitesApi.list })
  const sites = sitesRes?.data ?? []

  const { data, refetch } = useQuery({
    queryKey:['leads', filter, siteId],
    queryFn:()=>api.get('/lead-outreach'+(filter!=='all'?'?status='+filter:''))
  })
  const leads = data?.data ?? []

  const parseCSV = (text) => {
    const lines = text.trim().split('\n')
    if (lines.length < 2) return []
    const headers = lines[0].split(',').map(h=>h.trim().toLowerCase().replace(/ /g,'_'))
    return lines.slice(1).map(line=>{
      const vals = line.split(',').map(v=>v.trim().replace(/^"|"$/g,''))
      const obj = {}
      headers.forEach((h,i)=>{ obj[h]=vals[i]||'' })
      return obj
    }).filter(r=>r.first_name||r.last_name)
  }

  const handleFile = (e) => {
    const f = e.target.files[0]
    if (!f) return
    const reader = new FileReader()
    reader.onload = ev => setCsvText(ev.target.result)
    reader.readAsText(f)
  }

  const importLeads = async () => {
    if (!siteId) return toast.error('Select a site first')
    const leads = parseCSV(csvText)
    if (!leads.length) return toast.error('No valid leads found in CSV')
    setImporting(true)
    try {
      const r = await api.post('/lead-outreach/import', { leads, site_id: parseInt(siteId) })
      toast.success(r.message || `${leads.length} leads imported!`)
      setCsvText('')
      refetch()
    } catch(e) { toast.error(e.message) }
    finally { setImporting(false) }
  }

  const generate = async (lead) => {
    setGenerating(lead.id)
    try {
      const r = await api.post('/lead-outreach/generate', {
        lead_id: lead.id, type: msgType, tone, product
      })
      setActiveMsg(m=>({...m, [lead.id]: r.data.message}))
      refetch()
      toast.success('Message generated!')
    } catch(e) { toast.error(e.message) }
    finally { setGenerating(null) }
  }

  const schedule = async (lead) => {
    if (!schedDate) return toast.error('Pick a date/time to schedule')
    setScheduling(lead.id)
    try {
      await api.post('/lead-outreach/schedule', { lead_id: lead.id, scheduled_at: schedDate })
      toast.success('Scheduled to LinkedIn!')
      refetch()
    } catch(e) { toast.error(e.message) }
    finally { setScheduling(null) }
  }

  const del = useMutation({
    mutationFn: id=>api.delete('/lead-outreach/'+id),
    onSuccess:()=>{ refetch(); toast.success('Deleted') }
  })

  const stats = {
    total: leads.length,
    new: leads.filter(l=>l.status==='new').length,
    draft: leads.filter(l=>l.status==='draft').length,
    scheduled: leads.filter(l=>l.status==='scheduled').length,
  }

  return (
    <div>
      <div className="fp-page-header" style={{marginBottom:24}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <div style={{width:40,height:40,borderRadius:8,background:'#0066FF',display:'flex',alignItems:'center',justifyContent:'center'}}>
            <Linkedin size={22} color="#fff"/>
          </div>
          <div>
            <h1 className="fp-page-title" style={{margin:0}}>LinkedIn Sales Navigator</h1>
            <p className="fp-page-sub" style={{margin:0}}>Import leads, generate personalised posts, schedule to LinkedIn</p>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:24}}>
        {[
          {label:'Total Leads', value:stats.total, color:'var(--text)'},
          {label:'New', value:stats.new, color:'var(--text3)'},
          {label:'Draft', value:stats.draft, color:'#7c3aed'},
          {label:'Scheduled', value:stats.scheduled, color:'#059669'},
        ].map(s=>(
          <div key={s.label} className="fp-card" style={{textAlign:'center',padding:'14px 10px'}}>
            <div style={{fontWeight:700,fontSize:24,color:s.color}}>{s.value}</div>
            <div style={{fontSize:11,color:'var(--text3)'}}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20,marginBottom:24}}>
        {/* Import Panel */}
        <div className="fp-card">
          <div style={{fontWeight:700,fontSize:14,marginBottom:4,display:'flex',alignItems:'center',gap:6}}>
            <Upload size={14}/> Import from Sales Navigator
          </div>
          <div style={{fontSize:12,color:'var(--text3)',marginBottom:12}}>
            Export leads from Sales Navigator as CSV and paste/upload below
          </div>

          <div style={{marginBottom:10}}>
            <label className="fp-label">Site</label>
            <select className="fp-select" value={siteId} onChange={e=>setSiteId(e.target.value)}>
              <option value="">Select site...</option>
              {sites.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          <div style={{marginBottom:10}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:4}}>
              <label className="fp-label" style={{margin:0}}>CSV Data</label>
              <button onClick={()=>fileRef.current?.click()} className="fp-btn fp-btn-ghost fp-btn-sm" style={{fontSize:11}}>
                <Upload size={11}/> Upload file
              </button>
            </div>
            <input ref={fileRef} type="file" accept=".csv" style={{display:'none'}} onChange={handleFile}/>
            <textarea className="fp-input" rows={6} value={csvText} onChange={e=>setCsvText(e.target.value)}
              placeholder={SAMPLE_CSV} style={{width:'100%',resize:'vertical',fontFamily:'monospace',fontSize:11}}/>
          </div>

          <div style={{fontSize:11,color:'var(--text3)',marginBottom:10}}>
            Required columns: <strong>First Name, Last Name, Company, Title</strong> — optional: LinkedIn URL, Email, Industry, Location
          </div>

          <button className="fp-btn fp-btn-primary" onClick={importLeads} disabled={importing||!csvText}>
            {importing ? 'Importing...' : `Import ${parseCSV(csvText).length || ''} Leads`}
          </button>
        </div>

        {/* AI Settings */}
        <div className="fp-card">
          <div style={{fontWeight:700,fontSize:14,marginBottom:4,display:'flex',alignItems:'center',gap:6}}>
            <Sparkles size={14}/> AI Generation Settings
          </div>
          <div style={{fontSize:12,color:'var(--text3)',marginBottom:12}}>Configure how AI writes your LinkedIn content</div>

          <div style={{marginBottom:10}}>
            <label className="fp-label">Content Type</label>
            <select className="fp-select" value={msgType} onChange={e=>setMsgType(e.target.value)}>
              <option value="linkedin_post">LinkedIn Post (general — targets lead's interests)</option>
              <option value="connection_request">Connection Request Message (under 300 chars)</option>
              <option value="follow_up">Follow-up DM (after connecting)</option>
            </select>
          </div>

          <div style={{marginBottom:10}}>
            <label className="fp-label">Your Product / Service (optional)</label>
            <input className="fp-input" value={product} onChange={e=>setProduct(e.target.value)}
              placeholder="Social media scheduling tool for agencies..."/>
          </div>

          <div style={{marginBottom:10}}>
            <label className="fp-label">Tone</label>
            <select className="fp-select" value={tone} onChange={e=>setTone(e.target.value)}>
              {['professional','conversational','authoritative','warm','direct','storytelling'].map(t=>(
                <option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="fp-label">Schedule Date & Time</label>
            <input type="datetime-local" className="fp-input" value={schedDate} onChange={e=>setSchedDate(e.target.value)}/>
            <div style={{fontSize:11,color:'var(--text3)',marginTop:4}}>Used when you click "Schedule" on any lead</div>
          </div>
        </div>
      </div>

      {/* Lead List */}
      <div className="fp-card">
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:14}}>
          <div style={{fontWeight:700,fontSize:14}}>Lead List ({leads.length})</div>
          <div style={{display:'flex',gap:6}}>
            {['all','new','draft','scheduled'].map(s=>(
              <button key={s} onClick={()=>setFilter(s)}
                style={{padding:'4px 12px',borderRadius:12,border:'1px solid var(--border)',cursor:'pointer',fontSize:12,
                  background:filter===s?'#e11d48':'#1a1a2e',
                  color:'#fff',fontWeight:filter===s?700:500}}>
                {s.charAt(0).toUpperCase()+s.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {leads.length === 0 && (
          <div style={{textAlign:'center',padding:'40px 20px',color:'var(--text3)'}}>
            <User size={32} style={{opacity:.2,marginBottom:8}}/>
            <div>No leads yet. Import from Sales Navigator above.</div>
          </div>
        )}

        {leads.map(lead=>{
          const msg = activeMsg[lead.id] || lead.ai_message || ''
          const fullName = [lead.first_name, lead.last_name].filter(Boolean).join(' ')
          return (
            <div key={lead.id} style={{borderBottom:'1px solid var(--border)',padding:'16px 0'}}>
              <div style={{display:'flex',gap:12,alignItems:'flex-start'}}>
                {/* Avatar */}
                <div style={{width:40,height:40,borderRadius:20,background:'#0066FF22',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontWeight:700,color:'#0066FF',fontSize:14}}>
                  {(lead.first_name||'?')[0]}{(lead.last_name||'')[0]}
                </div>

                <div style={{flex:1}}>
                  <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap',marginBottom:4}}>
                    <span style={{fontWeight:700,fontSize:14}}>{fullName||'Unknown'}</span>
                    {lead.title && <span style={{fontSize:12,color:'var(--text2)'}}>· {lead.title}</span>}
                    {lead.company && <span style={{fontSize:12,color:'var(--text3)',display:'flex',alignItems:'center',gap:3}}><Building size={11}/>{lead.company}</span>}
                    {lead.linkedin_url && <a href={lead.linkedin_url} target="_blank" rel="noopener" style={{color:'#0066FF'}}><ExternalLink size={12}/></a>}
                    <span style={{fontSize:11,padding:'2px 8px',borderRadius:10,background:STATUS_COLOR[lead.status]+'22',color:STATUS_COLOR[lead.status],fontWeight:600}}>
                      {STATUS_LABEL[lead.status]}
                    </span>
                  </div>

                  <div style={{fontSize:12,color:'var(--text3)',marginBottom:8}}>
                    {[lead.industry,lead.location,lead.email].filter(Boolean).join(' · ')}
                  </div>

                  {msg && (
                    <div style={{background:'var(--bg2)',borderRadius:8,padding:'10px 12px',fontSize:13,lineHeight:1.65,marginBottom:10,whiteSpace:'pre-wrap',borderLeft:'3px solid #0066FF'}}>
                      {msg}
                    </div>
                  )}

                  <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                    <button className="fp-btn fp-btn-primary fp-btn-sm"
                      onClick={()=>generate(lead)} disabled={generating===lead.id}
                      style={{display:'flex',alignItems:'center',gap:5}}>
                      <Sparkles size={12}/>
                      {generating===lead.id ? 'Generating...' : msg ? 'Regenerate' : 'Generate Message'}
                    </button>

                    {msg && (
                      <>
                        <button onClick={()=>{navigator.clipboard.writeText(msg);toast.success('Copied!')}}
                          className="fp-btn fp-btn-ghost fp-btn-sm">Copy</button>
                        <button className="fp-btn fp-btn-ghost fp-btn-sm"
                          onClick={()=>schedule(lead)} disabled={scheduling===lead.id}
                          style={{display:'flex',alignItems:'center',gap:5,color:'#059669',borderColor:'#059669'}}>
                          <Calendar size={12}/>
                          {scheduling===lead.id ? 'Scheduling...' : 'Schedule to LinkedIn'}
                        </button>
                      </>
                    )}

                    <button onClick={()=>del.mutate(lead.id)}
                      style={{background:'none',border:'none',cursor:'pointer',color:'var(--text3)',padding:'6px'}}>
                      <Trash2 size={13}/>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
