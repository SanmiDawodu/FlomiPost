import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api, analyticsApi } from '../utils/api'
import toast from 'react-hot-toast'
import { FileText, Download, BarChart3, TrendingUp, CheckCircle2, XCircle, Clock } from 'lucide-react'

export default function ReportsPage() {
  const [days, setDays] = useState(30)
  const [generating, setGenerating] = useState(false)

  const { data: analyticsData } = useQuery({ queryKey:['analytics',days], queryFn:()=>analyticsApi.get(days) })
  const { data: postsData }     = useQuery({ queryKey:['posts','report'], queryFn:()=>api.get('/posts?per_page=200&status=published') })
  const { data: linksData }     = useQuery({ queryKey:['links'], queryFn:()=>api.get('/links') })

  const a   = analyticsData?.data ?? {}
  const t   = a.totals ?? {}
  const byp = a.by_platform ?? []
  const posts = postsData?.data ?? []
  const links = linksData?.data ?? []

  async function generatePDF() {
    setGenerating(true)
    try {
      // Build HTML report content
      const reportHtml = buildReportHTML({ days, a, t, byp, posts, links })
      const blob = new Blob([reportHtml], { type:'text/html' })
      const url  = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `FlomiPost-Report-${new Date().toISOString().slice(0,10)}.html`
      link.click()
      URL.revokeObjectURL(url)
      toast.success('Report downloaded! Open in browser then Print → Save as PDF')
    } catch(e) {
      toast.error('Report generation failed')
    } finally {
      setGenerating(false)
    }
  }

  const successRate = a.period_published
    ? Math.round(a.period_published / (a.period_published + (a.period_failed||0)) * 100)
    : 0

  return (
    <div>
      <div className="fp-page-header">
        <div>
          <div className="fp-page-title">Reports</div>
          <div className="fp-page-sub">Export performance reports for your social media activity</div>
        </div>
        <button className="fp-btn fp-btn-primary" onClick={generatePDF} disabled={generating}>
          <Download size={14}/> {generating?'Generating…':'Download Report'}
        </button>
      </div>

      {/* Period selector */}
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:24 }}>
        <span style={{ fontSize:13, fontWeight:700, color:'var(--text3)' }}>Period:</span>
        {[{l:'7D',d:7},{l:'30D',d:30},{l:'90D',d:90},{l:'6M',d:180},{l:'1Y',d:365}].map(p=>(
          <button key={p.d} onClick={()=>setDays(p.d)}
            style={{ padding:'6px 16px', borderRadius:8, cursor:'pointer', fontSize:13, fontWeight:700,
              border: days===p.d?'none':'1.5px solid var(--border)',
              background: days===p.d?'var(--violet)':'var(--bg2)',
              color: days===p.d?'#fff':'var(--text2)',
              boxShadow: days===p.d?'0 2px 8px rgba(91,60,245,.3)':'none' }}>
            {p.l}
          </button>
        ))}
      </div>

      {/* Report preview */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12, marginBottom:24 }}>
        {[
          {icon:<TrendingUp size={18}/>, val:a.period_published??0, label:'Published', cls:'fp-stat-violet'},
          {icon:<CheckCircle2 size={18}/>, val:a.all_time_published??t.published??0, label:'All-time Published', cls:'fp-stat-green'},
          {icon:<XCircle size={18}/>, val:a.period_failed??0, label:'Failed', cls:'fp-stat-coral'},
          {icon:<Clock size={18}/>, val:successRate+'%', label:'Success Rate', cls:'fp-stat-amber'},
        ].map((s,i)=>(
          <div key={i} className={`fp-stat ${s.cls}`}>
            <div className="fp-stat-icon">{s.icon}</div>
            <div className="fp-stat-val">{s.val}</div>
            <div className="fp-stat-lbl">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Platform breakdown table */}
      <div className="fp-card" style={{ marginBottom:16 }}>
        <div className="fp-card-title" style={{ marginBottom:16 }}><BarChart3 size={15}/> Platform Breakdown</div>
        <table className="fp-table">
          <thead><tr><th>Platform</th><th>Published</th><th>Failed</th><th>Success Rate</th></tr></thead>
          <tbody>
            {byp.length===0 ? <tr><td colSpan={4} style={{color:'var(--text3)'}}>No data for this period</td></tr> : byp.map(p=>{
              const rate = p.total>0?Math.round(p.published/p.total*100):0
              return <tr key={p.key_name}>
                <td><span style={{display:'inline-block',width:9,height:9,borderRadius:'50%',background:p.color||'#888',marginRight:8}}/>{p.platform}</td>
                <td style={{color:'var(--green)',fontWeight:600}}>{p.published||0}</td>
                <td style={{color:p.failed>0?'var(--coral)':'var(--text3)'}}>{p.failed||0}</td>
                <td>
                  <div style={{display:'flex',alignItems:'center',gap:8}}>
                    <div style={{width:80,height:6,background:'var(--bg3)',borderRadius:3}}><div style={{width:rate+'%',height:'100%',background:rate>=80?'var(--green)':rate>=50?'var(--amber)':'var(--coral)',borderRadius:3}}/></div>
                    <span style={{fontSize:12,fontWeight:700}}>{rate}%</span>
                  </div>
                </td>
              </tr>
            })}
          </tbody>
        </table>
      </div>

      {/* Link performance */}
      {links.length>0 && (
        <div className="fp-card">
          <div className="fp-card-title" style={{ marginBottom:16 }}><FileText size={15}/> Link Performance</div>
          <table className="fp-table">
            <thead><tr><th>Short Link</th><th>Original URL</th><th>Campaign</th><th>Clicks</th></tr></thead>
            <tbody>
              {links.slice(0,20).map(l=>(
                <tr key={l.id}>
                  <td><code style={{fontSize:12}}>flomicso.dev/s/{l.code}</code></td>
                  <td style={{fontSize:12,color:'var(--text3)',maxWidth:200,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{l.original}</td>
                  <td style={{fontSize:12}}>{l.utm_campaign||'—'}</td>
                  <td style={{fontWeight:700,color:'var(--violet)'}}>{l.clicks||0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div style={{ marginTop:20, padding:'14px 18px', background:'var(--violet-lt)', borderRadius:10, fontSize:13, color:'var(--violet)', fontWeight:500 }}>
        💡 Click <strong>Download Report</strong> above to get a full HTML report. Open it in your browser and use <strong>Print → Save as PDF</strong> to create a branded PDF to share with clients or leadership.
      </div>
    </div>
  )
}

function buildReportHTML({ days, a, t, byp, posts, links }) {
  const date = new Date().toLocaleDateString('en',{year:'numeric',month:'long',day:'numeric'})
  const pub  = a.period_published??0
  const fail = a.period_failed??0
  const rate = pub>0?Math.round(pub/(pub+fail)*100):0
  const rows = byp.map(p=>`<tr><td>${p.platform}</td><td>${p.published||0}</td><td>${p.failed||0}</td><td>${p.total>0?Math.round(p.published/p.total*100):0}%</td></tr>`).join('')
  const linkRows = links.slice(0,20).map(l=>`<tr><td>${l.code}</td><td style="max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${l.original}</td><td>${l.utm_campaign||'—'}</td><td>${l.clicks||0}</td></tr>`).join('')
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>FlomiPost Report — ${date}</title>
<style>body{font-family:Inter,sans-serif;color:#1a1a2e;padding:40px;max-width:900px;margin:0 auto}
h1{font-size:28px;font-weight:800;margin-bottom:4px}
.sub{color:#9090b0;font-size:14px;margin-bottom:32px}
.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:32px}
.stat{background:#f8f8fc;border-radius:12px;padding:20px;text-align:center}
.stat-val{font-size:32px;font-weight:800;color:#5b3cf5}
.stat-lbl{font-size:11px;font-weight:700;color:#9090b0;text-transform:uppercase;letter-spacing:.06em;margin-top:4px}
table{width:100%;border-collapse:collapse;margin-bottom:32px}
th{background:#f8f8fc;padding:10px 14px;text-align:left;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#9090b0;border-bottom:2px solid #e8e8f0}
td{padding:10px 14px;border-bottom:1px solid #e8e8f0;font-size:14px}
.footer{text-align:center;color:#9090b0;font-size:12px;margin-top:40px;padding-top:20px;border-top:1px solid #e8e8f0}
@media print{body{padding:20px}.footer{margin-top:20px}}
</style></head><body>
<h1>⚡ FlomiPost Performance Report</h1>
<div class="sub">Generated ${date} &nbsp;·&nbsp; Last ${days} days</div>
<div class="stats">
  <div class="stat"><div class="stat-val">${pub}</div><div class="stat-lbl">Published</div></div>
  <div class="stat"><div class="stat-val">${a.all_time_published??t.published??0}</div><div class="stat-lbl">All-time</div></div>
  <div class="stat"><div class="stat-val">${fail}</div><div class="stat-lbl">Failed</div></div>
  <div class="stat"><div class="stat-val">${rate}%</div><div class="stat-lbl">Success Rate</div></div>
</div>
<h2 style="font-size:18px;margin-bottom:16px">Platform Breakdown</h2>
<table><thead><tr><th>Platform</th><th>Published</th><th>Failed</th><th>Success Rate</th></tr></thead><tbody>${rows}</tbody></table>
${links.length>0?`<h2 style="font-size:18px;margin-bottom:16px">Link Performance</h2><table><thead><tr><th>Code</th><th>URL</th><th>Campaign</th><th>Clicks</th></tr></thead><tbody>${linkRows}</tbody></table>`:''}
<div class="footer">FlomiPost · scheduler.flomicso.dev · Report generated ${date}</div>
</body></html>`
}
