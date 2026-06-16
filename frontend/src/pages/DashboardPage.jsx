import { useQuery } from '@tanstack/react-query'
import { postsApi, queueApi, sitesApi, connectionsApi } from '../utils/api'
import { Link } from 'react-router-dom'
import { format, parseISO } from 'date-fns'
import { PenSquare, Calendar, BarChart2, Clock, Globe, Link2, CheckCircle, XCircle, FileText, Zap, List } from 'lucide-react'

const PLAT_COLORS = {
  facebook:'#1877f2', instagram:'#e4405f', twitter:'#000', x:'#000',
  tiktok:'#010101', youtube:'#ff0000', telegram:'#0088cc', linkedin:'#0a66c2',
  pinterest:'#e60023', reddit:'#ff4500', discord:'#5865f2',
}
const PLAT_LABELS = {
  facebook:'f', instagram:'📸', twitter:'𝕏', x:'𝕏',
  tiktok:'♪', youtube:'▶', telegram:'✈', linkedin:'in',
  pinterest:'P', reddit:'r/', discord:'💬',
}

function StatusBadge({ status }) {
  const map = {
    scheduled: { cls: 'ps-sched', label: '◌ Scheduled' },
    published:  { cls: 'ps-pub',   label: '● Published' },
    failed:     { cls: 'ps-fail',  label: '✕ Failed' },
    draft:      { cls: 'ps-draft', label: '○ Draft' },
    queued:     { cls: 'ps-queue', label: '⚡ Queued' },
  }
  const s = map[status] || map.draft
  return <span className={`post-status ${s.cls}`}>{s.label}</span>
}

export default function DashboardPage() {
  const { data: statsRes }  = useQuery({ queryKey: ['post-stats'],    queryFn: postsApi.stats })
  const { data: postsRes }  = useQuery({ queryKey: ['posts-recent'],  queryFn: () => postsApi.list({ order_by:'created',  per_page: 8 }) })
  const { data: queueRes }  = useQuery({ queryKey: ['queue'],         queryFn: queueApi.list })
  const { data: sitesRes }  = useQuery({ queryKey: ['sites'],         queryFn: sitesApi.list })
  const { data: connsRes }  = useQuery({ queryKey: ['connections'],   queryFn: () => connectionsApi.list() })
  const { data: weekRes }   = useQuery({ queryKey: ['week-stats'],    queryFn: () => import('../utils/api').then(m=>m.api.get('/posts/week-stats')) })

  const stats  = statsRes?.data ?? {}
  const posts  = postsRes?.data ?? []
  const queue  = (queueRes?.data ?? []).slice(0, 5)
  const sites  = sitesRes?.data ?? []
  const conns  = connsRes?.data ?? []

  // Group connections by platform
  const platCounts = conns.reduce((acc, c) => {
    const k = c.key_name || 'other'
    acc[k] = (acc[k] || 0) + 1
    return acc
  }, {})

  const topPlats = Object.entries(platCounts).sort((a,b) => b[1]-a[1]).slice(0, 6)

  const today = format(new Date(), 'EEEE, MMMM d')

  return (
    <div>
      <style>{`
        .db-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:14px;margin-bottom:24px;}
        .db-stat{background:var(--bg2);border:1px solid var(--border);border-radius:16px;padding:20px;transition:transform .18s,box-shadow .18s;}
        .db-stat:hover{transform:translateY(-2px);box-shadow:0 4px 20px rgba(91,60,245,.12);}
        .db-stat-icon{width:42px;height:42px;border-radius:11px;display:flex;align-items:center;justify-content:center;margin-bottom:12px;font-size:19px;}
        .db-stat-val{font-family:'Familjen Grotesk',sans-serif;font-size:32px;font-weight:700;line-height:1;margin-bottom:4px;}
        .db-stat-lbl{font-size:11px;color:var(--text3);font-weight:600;text-transform:uppercase;letter-spacing:.06em;}
        .db-stat-delta{font-size:11px;margin-top:6px;font-weight:600;color:var(--green);}
        .db-grid2{display:grid;grid-template-columns:1fr;gap:18px;margin-bottom:18px;}
        .db-card{background:var(--bg2);border:1px solid var(--border);border-radius:16px;padding:22px;box-shadow:0 1px 4px rgba(91,60,245,.08);}
        .db-card-hdr{display:flex;align-items:center;justify-content:space-between;margin-bottom:18px;}
        .db-card-title{font-family:'Familjen Grotesk',sans-serif;font-size:15px;font-weight:700;color:var(--text);display:flex;align-items:center;gap:8px;}
        .db-card-action{font-size:12px;font-weight:600;color:var(--primary);background:var(--violet-lt,#ede9ff);border:none;padding:5px 12px;border-radius:7px;cursor:pointer;}
        .db-post-item{display:flex;align-items:flex-start;gap:12px;padding:11px 0;border-bottom:1px solid var(--border);}
        .db-post-item:last-child{border-bottom:none;padding-bottom:0;}
        .db-post-plat{width:34px;height:34px;border-radius:9px;display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:14px;font-weight:700;}
        .db-post-body{flex:1;min-width:0;}
        .db-post-cap{font-size:14px;color:var(--text);font-weight:500;display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;overflow:hidden;word-break:break-word;margin-bottom:4px;line-height:1.5;}
        .db-post-meta{font-size:11px;color:var(--text3);display:flex;align-items:center;gap:8px;flex-wrap:wrap;}
        .post-status{font-size:10px;font-weight:700;padding:2px 9px;border-radius:20px;display:inline-flex;align-items:center;gap:3px;}
        .ps-sched{background:#ede9ff;color:#5b3cf5;}
        .ps-pub{background:#d1fae5;color:#10b981;}
        .ps-fail{background:#fff0f1;color:#ff5c6a;}
        .ps-draft{background:rgba(155,152,192,.12);color:var(--text3);}
        .ps-queue{background:#e0fafb;color:#00c2cb;}
        .db-chart{height:130px;display:flex;align-items:flex-end;gap:6px;padding:0 4px;}
        .db-bar-col{flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;}
        .db-bar{border-radius:6px 6px 0 0;width:100%;}
        .db-bar-lbl{font-size:9px;color:var(--text3);}
        .db-plat-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;}
        .db-plat-item{display:flex;flex-direction:column;align-items:center;gap:5px;padding:12px 8px;border-radius:12px;background:var(--surface,#f7f8ff);border:1px solid var(--border);}
        .db-plat-dot{width:36px;height:36px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:14px;font-weight:700;}
        .db-plat-name{font-size:10px;font-weight:600;color:var(--text2);}
        .db-plat-count{font-size:13px;font-weight:700;color:var(--text1);}
        .db-q-item{display:flex;gap:12px;padding:10px 0;border-bottom:1px solid var(--border);align-items:flex-start;}
        .db-q-item:last-child{border-bottom:none;}
        .db-q-time{font-size:11px;color:var(--primary);min-width:78px;margin-top:1px;font-weight:600;}
        .db-q-txt{font-size:12px;color:var(--text2);line-height:1.5;flex:1;}
        .db-q-plat{font-size:10px;padding:2px 8px;border-radius:20px;background:#ede9ff;color:#5b3cf5;font-weight:700;flex-shrink:0;}
        .db-site-tags{display:flex;flex-wrap:wrap;gap:7px;}
        .db-site-tag{display:flex;align-items:center;gap:6px;padding:6px 11px;border-radius:9px;font-size:12px;font-weight:600;background:var(--surface,#f7f8ff);border:1px solid var(--border);color:var(--text2);}
        .db-site-dot{width:9px;height:9px;border-radius:50%;flex-shrink:0;}
        @media(max-width:900px){.db-stats{grid-template-columns:repeat(2,1fr);}}
      `}</style>

      {/* Page header */}
      <div className="fp-page-header">
        <div>
          <div className="fp-page-title">Dashboard</div>
          <div className="fp-page-sub">{today} · {sites.length} sites · {Object.keys(platCounts).length} platforms</div>
        </div>
        <Link to="/compose" className="fp-btn fp-btn-primary"><PenSquare size={14}/> New Post</Link>
      </div>

      {/* Stats */}
      <div className="db-stats">
        <div className="db-stat">
          <div className="db-stat-icon" style={{background:'#ede9ff'}}>📅</div>
          <div className="db-stat-val" style={{color:'#5b3cf5'}}>{stats.scheduled ?? 0}</div>
          <div className="db-stat-lbl">Scheduled</div>
          <div className="db-stat-delta">upcoming posts</div>
        </div>
        <div className="db-stat">
          <div className="db-stat-icon" style={{background:'#e0fafb'}}>✅</div>
          <div className="db-stat-val" style={{color:'#00c2cb'}}>{stats.published ?? 0}</div>
          <div className="db-stat-lbl">Published</div>
          <div className="db-stat-delta">all time</div>
        </div>
        <div className="db-stat">
          <div className="db-stat-icon" style={{background:'#d1fae5'}}>🔗</div>
          <div className="db-stat-val" style={{color:'#10b981'}}>{conns.length}</div>
          <div className="db-stat-lbl">Connections</div>
          <div className="db-stat-delta">{sites.length} sites</div>
        </div>
        <div className="db-stat">
          <div className="db-stat-icon" style={{background:'#fff0f1'}}>❌</div>
          <div className="db-stat-val" style={{color:'#ff5c6a'}}>{stats.failed ?? 0}</div>
          <div className="db-stat-lbl">Failed</div>
          <div className="db-stat-delta" style={{color: (stats.failed??0)>0 ? '#ff5c6a':'#10b981'}}>{(stats.failed??0)>0?'needs attention':'all clear'}</div>
        </div>
      </div>

      {/* Row 1 */}
      <div className="db-grid2">
        {/* Recent posts */}
        <div className="db-card">
          <div className="db-card-hdr">
            <div className="db-card-title"><List size={16} color="#5b3cf5"/> Recent Posts</div>
            <Link to="/posts"><button className="db-card-action">View all</button></Link>
          </div>
          {posts.length === 0
            ? <div style={{fontSize:13,color:'var(--text3)',textAlign:'center',padding:'20px 0'}}>No posts yet. <Link to="/compose" style={{color:'var(--primary)'}}>Create one →</Link></div>
            : posts.map(p => (
              <div key={p.id} className="db-post-item">
                <div className="db-post-plat" style={{background: p.targets?.[0]?.platform_key ? (PLAT_COLORS[p.targets[0].platform_key]+'22') : '#ede9ff'}}>
                  {p.targets?.[0]?.platform_key ? (PLAT_LABELS[p.targets[0].platform_key] || '📱') : '📱'}
                </div>
                <div className="db-post-body">
                  <div className="db-post-cap">{p.caption}</div>
                  <div className="db-post-meta">
                    <span>{p.site_name}</span>
                    {p.scheduled_at && <span>· {format(parseISO(p.scheduled_at), 'MMM d HH:mm')}</span>}
                    <StatusBadge status={p.status}/>
                  </div>
                </div>
              </div>
            ))
          }
        </div>

        {/* Right column */}
        <div style={{display:'flex',flexDirection:'column',gap:18}}>
          {/* Chart */}
          <div className="db-card" style={{padding:20}}>
            <div className="db-card-hdr" style={{marginBottom:12}}>
              <div className="db-card-title" style={{fontSize:14}}><BarChart2 size={15} color="#5b3cf5"/> Posts This Week</div>
              <span style={{fontSize:11,color:'var(--text3)'}}>{stats.scheduled??0} scheduled</span>
            </div>
            <div className="db-chart">
              {(() => {
                const weekData = weekRes?.data ?? []
                const maxCount = Math.max(1, ...weekData.map(d=>d.count||0))
                const todayStr = new Date().toISOString().slice(0,10)
                return (weekData.length>0 ? weekData : ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d=>({day:d,count:0,date:''}))).map((d,i) => {
                  const isToday = d.date === todayStr
                  const pct = weekData.length>0 ? Math.max(8, Math.round((d.count/maxCount)*100)) : 20
                  return (
                    <div key={i} className="db-bar-col" title={`${d.day}: ${d.count||0} posts`}>
                      <div className="db-bar" style={{
                        height: pct+'%',
                        background: isToday ? 'linear-gradient(to top,#00c2cb,#00a8b0)' : 'linear-gradient(to top,#5b3cf5,#7c5ef7)',
                        opacity: d.count>0||isToday ? 1 : 0.2,
                        boxShadow: isToday ? '0 4px 12px rgba(0,194,203,.3)' : 'none',
                        position:'relative'
                      }}>
                        {d.count>0 && <span style={{position:'absolute',top:-18,left:'50%',transform:'translateX(-50%)',fontSize:9,fontWeight:700,color:'var(--text3)'}}>{d.count}</span>}
                      </div>
                      <div className="db-bar-lbl">{d.day}</div>
                    </div>
                  )
                })
              })()}
            </div>
          </div>

          {/* Platforms */}
          <div className="db-card" style={{padding:20}}>
            <div className="db-card-hdr" style={{marginBottom:14}}>
              <div className="db-card-title" style={{fontSize:14}}><Globe size={15} color="#5b3cf5"/> Platforms</div>
            </div>
            <div className="db-plat-grid">
              {topPlats.map(([key, count]) => (
                <div key={key} className="db-plat-item">
                  <div className="db-plat-dot" style={{background:(PLAT_COLORS[key]||'#5b3cf5')+'22', color:PLAT_COLORS[key]||'#5b3cf5'}}>
                    {PLAT_LABELS[key]||'●'}
                  </div>
                  <div className="db-plat-name">{key.charAt(0).toUpperCase()+key.slice(1)}</div>
                  <div className="db-plat-count">{count}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Row 2 */}
      <div className="db-grid2">
        {/* Queue */}
        <div className="db-card">
          <div className="db-card-hdr">
            <div className="db-card-title"><Clock size={16} color="#5b3cf5"/> Upcoming Queue</div>
            <Link to="/queue"><button className="db-card-action">Manage</button></Link>
          </div>
          {queue.length === 0
            ? <div style={{fontSize:13,color:'var(--text3)',textAlign:'center',padding:'20px 0'}}>Queue is empty</div>
            : queue.map(q => (
              <div key={q.id} className="db-q-item">
                <div className="db-q-time">{q.fire_at ? format(parseISO(q.fire_at),'MMM d · h:mma') : 'Soon'}</div>
                <div className="db-q-txt">{q.caption?.slice(0,80)}...</div>
                <div className="db-q-plat">{q.platform_key ? (PLAT_LABELS[q.platform_key]||'📱') : '📱'}</div>
              </div>
            ))
          }
        </div>

        {/* Sites */}
        <div className="db-card">
          <div className="db-card-hdr">
            <div className="db-card-title"><Globe size={16} color="#5b3cf5"/> Active Sites ({sites.length})</div>
            <Link to="/sites"><button className="db-card-action">Manage</button></Link>
          </div>
          <div className="db-site-tags">
            {sites.map((s,i) => {
              const colors = ['#3b1f6b','#0a1f44','#006400','#1a1a2e','#16213e','#0f3460','#533483','#e94560','#2d6a4f','#1b4332']
              return (
                <div key={s.id} className="db-site-tag">
                  <div className="db-site-dot" style={{background:colors[i%colors.length]}}/>
                  {s.domain || s.name}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
