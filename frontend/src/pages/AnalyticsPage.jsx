import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { analyticsApi } from '../utils/api'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell
} from 'recharts'
import { BarChart3, CheckCircle2, XCircle, Clock, TrendingUp } from 'lucide-react'

const PERIODS = [
  { label: '1D',   days: 1   },
  { label: '7D',   days: 7   },
  { label: '30D',  days: 30  },
  { label: '90D',  days: 90  },
  { label: '6M',   days: 180 },
  { label: '1Y',   days: 365 },
]

const COLORS = ['#5b3cf5','#22c55e','#f59e0b','#ef4444','#3b82f6','#ec4899','#14b8a6','#f97316']

function fmt(dateStr, days) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (days <= 7)  return d.toLocaleDateString('en', { weekday:'short', month:'short', day:'numeric' })
  if (days <= 60) return d.toLocaleDateString('en', { month:'short', day:'numeric' })
  return d.toLocaleDateString('en', { month:'short', day:'numeric' })
}

const CustomTooltip = ({ active, payload, label, days }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background:'var(--surface)', border:'1.5px solid var(--border)', borderRadius:10, padding:'10px 14px', fontSize:12, boxShadow:'0 4px 16px rgba(0,0,0,.1)' }}>
      <div style={{ fontWeight:700, marginBottom:6, color:'var(--text)' }}>{label}</div>
      {payload.map(p => (
        <div key={p.name} style={{ color:p.color, marginBottom:2 }}>
          {p.name}: <strong>{p.value}</strong>
        </div>
      ))}
    </div>
  )
}

export default function AnalyticsPage() {
  const [days, setDays] = useState(30)
  const [chartType, setChartType] = useState('area')

  const { data, isLoading } = useQuery({
    queryKey: ['analytics', days],
    queryFn: () => analyticsApi.get(days),
    keepPreviousData: true,
  })

  const a   = data?.data ?? {}
  const t   = a.totals ?? {}
  const byp = a.by_platform ?? []
  const raw = a.series ?? []

  const series = useMemo(() =>
    raw.map(r => ({
      ...r,
      date: fmt(r.d, days),
      published: +r.published || 0,
      failed:    +r.failed    || 0,
      total:     +r.total     || 0,
    })), [raw, days])

  const successRate = a.period_published
    ? Math.round((a.period_published / (a.period_published + (a.period_failed || 0))) * 100)
    : 0

  return (
    <div style={{ padding:'0 0 40px' }}>
      <div className="fp-page-header">
        <div>
          <div className="fp-page-title">Analytics</div>
          <div className="fp-page-sub">Publishing performance across all platforms</div>
        </div>
      </div>

      {/* Period selector — standalone prominent row */}
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:24 }}>
        <span style={{ fontSize:13, fontWeight:600, color:'var(--text3)', marginRight:4 }}>Period:</span>
        {PERIODS.map(p => (
          <button key={p.days} onClick={() => setDays(p.days)}
            style={{
              padding:'7px 18px', borderRadius:8, cursor:'pointer',
              fontWeight:700, fontSize:13, transition:'all .15s',
              border: days===p.days ? 'none' : '1.5px solid var(--border)',
              background: days===p.days ? 'var(--violet)' : 'var(--bg2)',
              color: days===p.days ? '#fff' : 'var(--text2)',
              boxShadow: days===p.days ? '0 2px 8px rgba(91,60,245,.3)' : 'none',
            }}>
            {p.label}
          </button>
        ))}
      </div>

      {/* Stat cards */}
      <div className="fp-stats">
        <div className="fp-stat fp-stat-violet">
          <div className="fp-stat-icon"><TrendingUp size={18}/></div>
          <div className="fp-stat-val">{a.period_published ?? 0}</div>
          <div className="fp-stat-lbl">Published ({PERIODS.find(p=>p.days===days)?.label})</div>
        </div>
        <div className="fp-stat fp-stat-green">
          <div className="fp-stat-icon"><CheckCircle2 size={18}/></div>
          <div className="fp-stat-val">{a.all_time_published ?? t.published ?? 0}</div>
          <div className="fp-stat-lbl">All-time Published</div>
        </div>
        <div className="fp-stat fp-stat-coral">
          <div className="fp-stat-icon"><XCircle size={18}/></div>
          <div className="fp-stat-val">{a.period_failed ?? 0}</div>
          <div className="fp-stat-lbl">Failed ({PERIODS.find(p=>p.days===days)?.label})</div>
        </div>
        <div className="fp-stat fp-stat-amber">
          <div className="fp-stat-icon"><Clock size={18}/></div>
          <div className="fp-stat-val">{successRate}%</div>
          <div className="fp-stat-lbl">Success Rate</div>
        </div>
      </div>

      {isLoading && <div className="fp-loader"><div className="fp-spinner"/></div>}

      {!isLoading && (<>

        {/* Main chart */}
        <div className="fp-card" style={{ marginBottom:16 }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
            <div className="fp-card-title"><BarChart3 size={15}/> Posts Over Time</div>
            <div style={{ display:'flex', gap:4 }}>
              {[['area','Area'],['bar','Bar']].map(([v,l]) => (
                <button key={v} onClick={() => setChartType(v)}
                  style={{ padding:'4px 12px', borderRadius:6, border:'1.5px solid var(--border)', cursor:'pointer', fontSize:12, fontWeight:600,
                    background: chartType===v ? 'var(--violet)' : 'var(--bg3)',
                    color: chartType===v ? '#fff' : 'var(--text3)' }}>
                  {l}
                </button>
              ))}
            </div>
          </div>
          {series.length === 0 ? (
            <div style={{ height:220, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text3)', fontSize:13 }}>
              No data for this period
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              {chartType === 'area' ? (
                <AreaChart data={series} margin={{ top:5, right:10, left:-20, bottom:0 }}>
                  <defs>
                    <linearGradient id="pub" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#5b3cf5" stopOpacity={0.25}/>
                      <stop offset="95%" stopColor="#5b3cf5" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="fail" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%"  stopColor="#ef4444" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false}/>
                  <XAxis dataKey="date" tick={{ fontSize:11, fill:'var(--text3)' }} axisLine={false} tickLine={false}/>
                  <YAxis tick={{ fontSize:11, fill:'var(--text3)' }} axisLine={false} tickLine={false} allowDecimals={false}/>
                  <Tooltip content={<CustomTooltip days={days}/>}/>
                  <Legend wrapperStyle={{ fontSize:12, paddingTop:12 }}/>
                  <Area type="monotone" dataKey="published" name="Published" stroke="#5b3cf5" strokeWidth={2} fill="url(#pub)" dot={false} activeDot={{ r:4 }}/>
                  <Area type="monotone" dataKey="failed"    name="Failed"    stroke="#ef4444" strokeWidth={2} fill="url(#fail)" dot={false} activeDot={{ r:4 }}/>
                </AreaChart>
              ) : (
                <BarChart data={series} margin={{ top:5, right:10, left:-20, bottom:0 }} barSize={series.length > 20 ? 6 : 16}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false}/>
                  <XAxis dataKey="date" tick={{ fontSize:11, fill:'var(--text3)' }} axisLine={false} tickLine={false}/>
                  <YAxis tick={{ fontSize:11, fill:'var(--text3)' }} axisLine={false} tickLine={false} allowDecimals={false}/>
                  <Tooltip content={<CustomTooltip days={days}/>}/>
                  <Legend wrapperStyle={{ fontSize:12, paddingTop:12 }}/>
                  <Bar dataKey="published" name="Published" fill="#5b3cf5" radius={[4,4,0,0]}/>
                  <Bar dataKey="failed"    name="Failed"    fill="#ef4444" radius={[4,4,0,0]}/>
                </BarChart>
              )}
            </ResponsiveContainer>
          )}
        </div>

        {/* Bottom row: platform breakdown + pie */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 300px', gap:16 }}>

          {/* Platform table */}
          <div className="fp-card">
            <div className="fp-card-title" style={{ marginBottom:16 }}><BarChart3 size={15}/> By Platform</div>
            {byp.length === 0 ? (
              <div style={{ fontSize:13, color:'var(--text3)' }}>No data for this period</div>
            ) : (
              <table className="fp-table">
                <thead><tr><th>Platform</th><th>Published</th><th>Failed</th><th>Success%</th></tr></thead>
                <tbody>
                  {byp.map(p => {
                    const rate = p.total > 0 ? Math.round((p.published/p.total)*100) : 0
                    return (
                      <tr key={p.key_name}>
                        <td>
                          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                            <span style={{ width:10, height:10, borderRadius:'50%', background:p.color||'#888', flexShrink:0, display:'inline-block' }}/>
                            {p.platform}
                          </div>
                        </td>
                        <td style={{ color:'var(--green)', fontWeight:600 }}>{p.published||0}</td>
                        <td style={{ color: p.failed>0 ? 'var(--coral)':'var(--text3)' }}>{p.failed||0}</td>
                        <td>
                          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                            <div style={{ flex:1, height:5, background:'var(--bg3)', borderRadius:3, minWidth:40 }}>
                              <div style={{ width:rate+'%', height:'100%', background:rate>=80?'var(--green)':rate>=50?'var(--amber)':'var(--coral)', borderRadius:3, transition:'width .3s' }}/>
                            </div>
                            <span style={{ fontSize:11, fontWeight:700, color:'var(--text3)', minWidth:28 }}>{rate}%</span>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Pie chart */}
          <div className="fp-card" style={{ display:'flex', flexDirection:'column', alignItems:'center' }}>
            <div className="fp-card-title" style={{ marginBottom:16, width:'100%' }}>Platform Share</div>
            {byp.length === 0 ? (
              <div style={{ fontSize:13, color:'var(--text3)', marginTop:40 }}>No data</div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={byp} dataKey="published" nameKey="platform" cx="50%" cy="50%"
                      innerRadius={50} outerRadius={80} paddingAngle={2}>
                      {byp.map((p, i) => <Cell key={p.key_name} fill={p.color || COLORS[i % COLORS.length]}/>)}
                    </Pie>
                    <Tooltip formatter={(v) => [v, 'Published']}/>
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ width:'100%', display:'flex', flexDirection:'column', gap:5, marginTop:8 }}>
                  {byp.slice(0,6).map((p,i) => (
                    <div key={p.key_name} style={{ display:'flex', alignItems:'center', gap:6, fontSize:12 }}>
                      <span style={{ width:8, height:8, borderRadius:'50%', background:p.color||COLORS[i%COLORS.length], flexShrink:0 }}/>
                      <span style={{ flex:1, color:'var(--text2)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.platform}</span>
                      <span style={{ fontWeight:700, color:'var(--text)' }}>{p.published||0}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <BestTimesPanel/>

      </>)}
    </div>
  )
}

function BestTimesPanel() {
  const { data } = useQuery({ queryKey:['best-times'], queryFn:()=>fetch('/api/analytics/best-times',{credentials:'include'}).then(r=>r.json()) })
  const byHour = data?.data?.by_hour ?? []
  const byDay  = data?.data?.by_day  ?? []
  const mode   = data?.data?.mode ?? 'frequency'
  const engTotal = data?.data?.engagement_total ?? 0
  const isEngagement = mode === 'engagement'
  const topH = byHour.slice(0,3).map(r=>{ const h=parseInt(r.h),a=h>=12?'PM':'AM',h12=h===0?12:h>12?h-12:h; return `${h12}:00 ${a}` })
  const topD = byDay.slice(0,3).map(r=>r.day)

  if (!byHour.length) return (
    <div className="fp-card">
      <div className="fp-card-title" style={{marginBottom:12}}>⏰ Best Times to Post</div>
      <div style={{fontSize:13,color:'var(--text3)'}}>Publish more posts to see patterns</div>
    </div>
  )
  const maxH = byHour[0]?.n||1, maxD = byDay[0]?.n||1
  const metricLabel = isEngagement ? 'avg engagement' : 'posts'

  return (
    <div className="fp-card">
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:16}}>
        <div className="fp-card-title">⏰ Best Times to Post</div>
        <div style={{display:'flex',alignItems:'center',gap:6}}>
          {isEngagement
            ? <span style={{fontSize:11,fontWeight:700,padding:'3px 10px',borderRadius:20,background:'#dcfce7',color:'#16a34a'}}>📊 Real Engagement</span>
            : <span style={{fontSize:11,fontWeight:700,padding:'3px 10px',borderRadius:20,background:'#ede9fe',color:'#7c3aed'}}>📅 Posting Frequency</span>
          }
        </div>
      </div>
      {!isEngagement && (
        <div style={{fontSize:12,color:'var(--amber,#f59e0b)',background:'#fef3c7',padding:'8px 12px',borderRadius:8,marginBottom:16}}>
          ⚡ Currently showing when you post most. As your posts get likes & comments, this will automatically switch to real engagement data.
        </div>
      )}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:24}}>
        <div>
          <div style={{fontSize:11,fontWeight:700,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:10}}>
            Best Hours {isEngagement ? '(avg engagement)' : '(posts count)'}
          </div>
          {byHour.slice(0,6).map(r=>{const h=parseInt(r.h),a=h>=12?'PM':'AM',h12=h===0?12:h>12?h-12:h;return(
            <div key={r.h} style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
              <span style={{fontSize:12,fontWeight:600,width:60,color:'var(--text2)'}}>{h12}:00 {a}</span>
              <div style={{flex:1,height:7,background:'var(--bg3)',borderRadius:4}}><div style={{width:(r.n/maxH*100)+'%',height:'100%',background:'var(--violet)',borderRadius:4}}/></div>
              <span style={{fontSize:11,color:'var(--text3)'}}>{r.n}</span>
            </div>
          )})}
        </div>
        <div>
          <div style={{fontSize:11,fontWeight:700,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'.06em',marginBottom:10}}>
            Best Days {isEngagement ? '(avg engagement)' : '(posts count)'}
          </div>
          {byDay.map(r=>(
            <div key={r.day} style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
              <span style={{fontSize:12,fontWeight:600,width:36,color:'var(--text2)'}}>{r.day}</span>
              <div style={{flex:1,height:7,background:'var(--bg3)',borderRadius:4}}><div style={{width:(r.n/maxD*100)+'%',height:'100%',background:'var(--green)',borderRadius:4}}/></div>
              <span style={{fontSize:11,color:'var(--text3)'}}>{r.n}</span>
            </div>
          ))}
          {topH.length>0 && <div style={{marginTop:12,padding:'10px 14px',background:'var(--violet-lt)',borderRadius:8,fontSize:12,color:'var(--violet)',fontWeight:600}}>
            Try posting {topD.join(', ')} at {topH.join(', ')}
          </div>}
        </div>
      </div>
    </div>
  )
}
