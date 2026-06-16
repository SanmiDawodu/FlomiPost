import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../utils/api'
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import toast from 'react-hot-toast'
import { TrendingUp, Users, Eye, Link, Clock, ExternalLink, RefreshCw } from 'lucide-react'

const PERIODS = [{l:'7D',d:7},{l:'14D',d:14},{l:'30D',d:30},{l:'90D',d:90}]

function extractRows(report) {
  if (!report?.rows) return []
  const headers = report.dimensionHeaders?.map(h=>h.name)||[]
  const mHeaders = report.metricHeaders?.map(h=>h.name)||[]
  return report.rows.map(r=>({
    ...Object.fromEntries(headers.map((h,i)=>[h, r.dimensionValues?.[i]?.value||''])),
    ...Object.fromEntries(mHeaders.map((h,i)=>[h, parseFloat(r.metricValues?.[i]?.value||0)])),
  }))
}

function extractTotals(report) {
  if (!report?.totals?.[0]) return {}
  const mHeaders = report.metricHeaders?.map(h=>h.name)||[]
  return Object.fromEntries(mHeaders.map((h,i)=>[h, parseFloat(report.totals[0].metricValues?.[i]?.value||0)]))
}

export default function GAAnalyticsPage() {
  const qc = useQueryClient()
  const [siteId, setSiteId] = useState('1')
  const [days, setDays] = useState(30)
  const [selProp, setSelProp] = useState('')

  const { data: sitesData } = useQuery({ queryKey:['sites'], queryFn:()=>api.get('/sites') })
  const sites = sitesData?.data ?? []

  const { data: statusData, refetch: refetchStatus } = useQuery({
    queryKey: ['ga-status', siteId],
    queryFn: () => api.get(`/analytics/ga/status?site_id=${siteId}`),
    enabled: !!siteId,
  })
  const connected = statusData?.data?.connected
  const propertyId = statusData?.data?.property_id

  const { data: propsData } = useQuery({
    queryKey: ['ga-props', siteId],
    queryFn: () => api.get(`/analytics/ga/properties?site_id=${siteId}`),
    enabled: !!siteId && connected,
  })
  const properties = propsData?.data ?? []

  const { data: reportData, isLoading: reportLoading, refetch: refetchReport } = useQuery({
    queryKey: ['ga-report', siteId, days],
    queryFn: () => api.get(`/analytics/ga/report?site_id=${siteId}&days=${days}`),
    enabled: !!siteId && connected && !!propertyId,
  })
  const report = reportData?.data

  const savePropMutation = useMutation({
    mutationFn: () => api.post('/analytics/ga/property', { site_id: siteId, property_id: selProp }),
    onSuccess: () => { toast.success('Property saved!'); qc.invalidateQueries({queryKey:['ga-status']}); qc.invalidateQueries({queryKey:['ga-report']}) },
  })

  // Parse data
  const totals = extractTotals(report?.overview)
  const dailyRows = extractRows(report?.daily).map(r=>({
    date: r.date?.replace(/(\d{4})(\d{2})(\d{2})/,'$2/$3'),
    sessions: r.sessions||0,
  }))
  const pageRows = extractRows(report?.by_page).sort((a,b)=>b.sessions-a.sessions).slice(0,10)
  const sourceRows = extractRows(report?.by_source).sort((a,b)=>b.sessions-a.sessions)

  function connectGA() {
    const url = `/api/oauth/ga/start?site_id=${siteId}`
    const w = window.open(url,'ga_oauth','width=600,height=700')
    const t = setInterval(()=>{ if(w?.closed){ clearInterval(t); refetchStatus(); setTimeout(()=>qc.invalidateQueries({queryKey:['ga-report']}),1000) }},600)
  }

  return (
    <div>
      <div className="fp-page-header">
        <div>
          <div className="fp-page-title">Google Analytics</div>
          <div className="fp-page-sub">Real-time website traffic connected to your posts</div>
        </div>
        <div style={{display:'flex',gap:8}}>
          <button onClick={()=>{refetchReport();refetchStatus()}} className="fp-btn fp-btn-ghost fp-btn-sm"><RefreshCw size={13}/> Refresh</button>
          {!connected && siteId && <button onClick={connectGA} className="fp-btn fp-btn-primary fp-btn-sm"><ExternalLink size={13}/> Connect Google Analytics</button>}
        </div>
      </div>

      {/* Site selector */}
      <div className="fp-card" style={{padding:'14px 18px',marginBottom:20}}>
        <div style={{display:'flex',alignItems:'center',gap:12,flexWrap:'wrap'}}>
          <span style={{fontSize:13,fontWeight:700,color:'var(--text3)'}}>Site:</span>
          {sites.map(s=>(
            <button key={s.id} onClick={()=>setSiteId(String(s.id))}
              style={{padding:'6px 16px',borderRadius:8,cursor:'pointer',fontSize:13,fontWeight:700,
                border:siteId===String(s.id)?'none':'1.5px solid var(--border)',
                background:siteId===String(s.id)?'var(--violet)':'var(--bg2)',
                color:siteId===String(s.id)?'#fff':'var(--text2)'}}>
              {s.name}
            </button>
          ))}
        </div>
      </div>

      {!connected ? (
        <div className="fp-card" style={{textAlign:'center',padding:'56px 24px'}}>
          <div style={{fontSize:40,marginBottom:12}}>📊</div>
          <div style={{fontSize:17,fontWeight:700,marginBottom:8}}>Connect Google Analytics</div>
          <div style={{fontSize:14,color:'var(--text3)',marginBottom:24,maxWidth:400,margin:'0 auto 24px'}}>
            See real-time sessions, page views, traffic sources and top pages for <strong>{sites.find(s=>String(s.id)===siteId)?.name}</strong> — right inside FlomiPost.
          </div>
          <button onClick={connectGA} className="fp-btn fp-btn-primary" style={{fontSize:14,padding:'10px 28px'}}>
            <ExternalLink size={14}/> Connect with Google
          </button>
          <div style={{fontSize:12,color:'var(--text3)',marginTop:12}}>Uses your existing YouTube/Google account</div>
        </div>
      ) : !propertyId && properties.length > 0 ? (
        <div className="fp-card" style={{textAlign:'center',padding:'40px 24px'}}>
          <div style={{fontSize:17,fontWeight:700,marginBottom:16}}>Select your GA4 Property</div>
          <select className="fp-select" style={{maxWidth:400,margin:'0 auto 16px',display:'block'}} value={selProp} onChange={e=>setSelProp(e.target.value)}>
            <option value="">Choose a property…</option>
            {properties.map(p=><option key={p.id} value={p.id}>{p.name} ({p.account})</option>)}
          </select>
          <button className="fp-btn fp-btn-primary" onClick={()=>savePropMutation.mutate()} disabled={!selProp}>Save Property</button>
        </div>
      ) : (
        <>
          {/* Period selector */}
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:20}}>
            <span style={{fontSize:13,fontWeight:700,color:'var(--text3)'}}>Period:</span>
            {PERIODS.map(p=>(
              <button key={p.d} onClick={()=>setDays(p.d)}
                style={{padding:'6px 16px',borderRadius:8,cursor:'pointer',fontSize:13,fontWeight:700,
                  border:days===p.d?'none':'1.5px solid var(--border)',
                  background:days===p.d?'var(--violet)':'var(--bg2)',
                  color:days===p.d?'#fff':'var(--text2)',
                  boxShadow:days===p.d?'0 2px 8px rgba(91,60,245,.3)':'none'}}>
                {p.l}
              </button>
            ))}
            <span style={{marginLeft:'auto',fontSize:12,color:'var(--text3)'}}>Property: {propertyId}</span>
          </div>

          {reportLoading ? <div className="fp-loader"><div className="fp-spinner"/></div> : (
            <>
              {/* Stat cards */}
              <div className="fp-stats" style={{marginBottom:20}}>
                {[
                  {icon:<TrendingUp size={18}/>, val:Math.round(totals.sessions||0).toLocaleString(), label:'Sessions', cls:'fp-stat-violet'},
                  {icon:<Users size={18}/>,     val:Math.round(totals.activeUsers||0).toLocaleString(), label:'Active Users', cls:'fp-stat-green'},
                  {icon:<Eye size={18}/>,       val:Math.round(totals.pageviews||0).toLocaleString(), label:'Page Views', cls:'fp-stat-amber'},
                  {icon:<Clock size={18}/>,     val:Math.round((totals.averageSessionDuration||0)/60)+'m', label:'Avg Session', cls:'fp-stat-coral'},
                ].map((s,i)=>(
                  <div key={i} className={`fp-stat ${s.cls}`}>
                    <div className="fp-stat-icon">{s.icon}</div>
                    <div className="fp-stat-val">{s.val}</div>
                    <div className="fp-stat-lbl">{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Sessions chart */}
              <div className="fp-card" style={{marginBottom:16}}>
                <div className="fp-card-title" style={{marginBottom:16}}><TrendingUp size={15}/> Sessions Over Time</div>
                {dailyRows.length===0 ? <div style={{fontSize:13,color:'var(--text3)',textAlign:'center',padding:'24px 0'}}>No data for this period</div> : (
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={dailyRows} margin={{top:5,right:10,left:-20,bottom:0}}>
                      <defs>
                        <linearGradient id="gaSessions" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#5b3cf5" stopOpacity={0.25}/>
                          <stop offset="95%" stopColor="#5b3cf5" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false}/>
                      <XAxis dataKey="date" tick={{fontSize:11,fill:'var(--text3)'}} axisLine={false} tickLine={false}/>
                      <YAxis tick={{fontSize:11,fill:'var(--text3)'}} axisLine={false} tickLine={false} allowDecimals={false}/>
                      <Tooltip contentStyle={{background:'var(--surface)',border:'1.5px solid var(--border)',borderRadius:8,fontSize:12}}/>
                      <Area type="monotone" dataKey="sessions" stroke="#5b3cf5" strokeWidth={2} fill="url(#gaSessions)" dot={false}/>
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>

              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
                {/* Top pages */}
                <div className="fp-card">
                  <div className="fp-card-title" style={{marginBottom:14}}><Link size={15}/> Top Pages</div>
                  {pageRows.length===0 ? <div style={{fontSize:13,color:'var(--text3)'}}>No data</div> : (
                    <table className="fp-table">
                      <thead><tr><th>Page</th><th>Sessions</th><th>Views</th></tr></thead>
                      <tbody>
                        {pageRows.map((r,i)=>(
                          <tr key={i}>
                            <td style={{fontSize:12,maxWidth:160,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}} title={r.pagePath}>{r.pagePath}</td>
                            <td style={{fontWeight:600}}>{Math.round(r.sessions).toLocaleString()}</td>
                            <td style={{color:'var(--text3)'}}>{Math.round(r.pageviews||0).toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>

                {/* Traffic sources */}
                <div className="fp-card">
                  <div className="fp-card-title" style={{marginBottom:14}}><Users size={15}/> Traffic Sources</div>
                  {sourceRows.length===0 ? <div style={{fontSize:13,color:'var(--text3)'}}>No data</div> : (
                    <>
                      <ResponsiveContainer width="100%" height={140}>
                        <BarChart data={sourceRows.slice(0,6)} layout="vertical" margin={{top:0,right:10,left:0,bottom:0}}>
                          <XAxis type="number" tick={{fontSize:10,fill:'var(--text3)'}} axisLine={false} tickLine={false}/>
                          <YAxis dataKey="sessionDefaultChannelGroup" type="category" tick={{fontSize:11,fill:'var(--text2)'}} axisLine={false} tickLine={false} width={80}/>
                          <Tooltip contentStyle={{background:'var(--surface)',border:'1px solid var(--border)',borderRadius:6,fontSize:12}}/>
                          <Bar dataKey="sessions" fill="#5b3cf5" radius={[0,4,4,0]}/>
                        </BarChart>
                      </ResponsiveContainer>
                    </>
                  )}
                </div>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}
