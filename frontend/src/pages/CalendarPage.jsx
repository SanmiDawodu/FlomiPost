import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { api } from '../utils/api'
import toast from 'react-hot-toast'
import {
  format, parseISO, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
  eachDayOfInterval, isSameMonth, isSameDay, isToday, addMonths, subMonths
} from 'date-fns'
import { ChevronLeft, ChevronRight, Plus, X, Clock, Globe } from 'lucide-react'

const STATUS_COLOR = {
  scheduled: '#7c3aed', published: '#10b981', failed: '#ef4444',
  draft: '#94a3b8', queued: '#f59e0b', publishing: '#3b82f6', cancelled: '#6b7280',
}

const PLAT_COLORS = {
  facebook:'#1877f2', instagram:'#e1306c', youtube:'#ff0000',
  twitter:'#000', x:'#000', tiktok:'#010101', whatsapp:'#25D366',
  linkedin:'#0a66c2', telegram:'#229ed9',
}

const SITE_COLORS = ['#7c3aed','#2563eb','#16a34a','#ea580c','#db2777']
const SITE_NAMES  = { 1:'SSIM', 2:'SDM', 3:'Personal Brand' }

export default function CalendarPage() {
  const qc = useQueryClient()
  const [current,  setCurrent]  = useState(new Date())
  const [selected, setSelected] = useState(null)
  const [siteFilter, setSiteFilter] = useState('all')

  // Fetch posts from ALL sites by fetching with high per_page
  // and no site filter — backend returns site_id in each post
  const { data, isLoading } = useQuery({
    queryKey: ['calendar-posts', format(current, 'yyyy-MM')],
    queryFn: async () => {
      const start = format(startOfWeek(startOfMonth(current), {weekStartsOn:0}), 'yyyy-MM-dd')
      const end   = format(endOfWeek(endOfMonth(current), {weekStartsOn:0}), 'yyyy-MM-dd')
      const res = await api.get(`/calendar?from=${start}&to=${end}`)
      return res
    },
    refetchInterval: 60000,
  })

  const allPosts = data?.data ?? []

  // Filter by site
  const posts = useMemo(() =>
    siteFilter === 'all' ? allPosts : allPosts.filter(p => String(p.site_id) === siteFilter)
  , [allPosts, siteFilter])

  // Get unique sites
  const sites = useMemo(() => {
    const ids = [...new Set(allPosts.map(p => p.site_id).filter(Boolean))]
    return ids.sort()
  }, [allPosts])

  // Group posts by day
  const postsByDay = useMemo(() => {
    const map = {}
    posts.forEach(p => {
      if (!p.scheduled_at) return
      const key = format(parseISO(p.scheduled_at), 'yyyy-MM-dd')
      if (!map[key]) map[key] = []
      map[key].push(p)
    })
    return map
  }, [posts])

  // Calendar days grid
  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(current), {weekStartsOn:0})
    const end   = endOfWeek(endOfMonth(current), {weekStartsOn:0})
    return eachDayOfInterval({start, end})
  }, [current])

  const rescheduleMut = useMutation({
    mutationFn: ({id, date}) => api.put(`/posts/${id}`, { scheduled_at: date + 'T09:00:00' }),
    onSuccess: () => { toast.success('Post rescheduled!'); qc.invalidateQueries({queryKey:['calendar-posts']}) },
    onError: e => toast.error(e.message),
  })

  const selectedKey  = selected ? format(selected, 'yyyy-MM-dd') : null
  const selectedPosts = selectedKey ? (postsByDay[selectedKey] || []) : []

  const totalThisMonth = Object.values(postsByDay).flat().length

  return (
    <div>
      {/* Header */}
      <div className="fp-page-header">
        <div>
          <div className="fp-page-title">Calendar</div>
          <div className="fp-page-sub">
            {format(current, 'MMMM yyyy')} · {totalThisMonth} posts
          </div>
        </div>
        <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
          <button className="fp-btn fp-btn-ghost fp-btn-sm" onClick={()=>setCurrent(subMonths(current,1))}>
            <ChevronLeft size={14}/>
          </button>
          <button className="fp-btn fp-btn-ghost fp-btn-sm" onClick={()=>setCurrent(new Date())}>
            Today
          </button>
          <button className="fp-btn fp-btn-ghost fp-btn-sm" onClick={()=>setCurrent(addMonths(current,1))}>
            <ChevronRight size={14}/>
          </button>
          <Link to="/compose" className="fp-btn fp-btn-primary fp-btn-sm">
            <Plus size={13}/> New Post
          </Link>
        </div>
      </div>

      {/* Site filter pills */}
      <div style={{ display:'flex', gap:6, marginBottom:16, flexWrap:'wrap', alignItems:'center' }}>
        <Globe size={13} style={{ color:'var(--text3)' }}/>
        <button onClick={()=>setSiteFilter('all')}
          style={{ padding:'4px 12px', borderRadius:20, border:'1.5px solid var(--border)',
            cursor:'pointer', fontSize:12, fontWeight:600,
            background: siteFilter==='all' ? 'var(--violet)' : 'var(--bg2)',
            color: siteFilter==='all' ? '#fff' : 'var(--text2)' }}>
          All Sites
        </button>
        {sites.map((id,i) => (
          <button key={id} onClick={()=>setSiteFilter(String(id))}
            style={{ padding:'4px 12px', borderRadius:20, border:'1.5px solid var(--border)',
              cursor:'pointer', fontSize:12, fontWeight:600,
              background: siteFilter===String(id) ? SITE_COLORS[i] : 'var(--bg2)',
              color: siteFilter===String(id) ? '#fff' : 'var(--text2)' }}>
            {SITE_NAMES[id] || `Site ${id}`}
          </button>
        ))}

        {/* Status legend */}
        <div style={{ marginLeft:'auto', display:'flex', gap:8, alignItems:'center' }}>
          {Object.entries(STATUS_COLOR).filter(([s])=>['scheduled','published','failed'].includes(s)).map(([s,c])=>(
            <span key={s} style={{ display:'flex', alignItems:'center', gap:4, fontSize:11, color:'var(--text3)' }}>
              <span style={{ width:8, height:8, borderRadius:'50%', background:c, display:'inline-block' }}/>
              {s}
            </span>
          ))}
        </div>
      </div>

      {/* Calendar + Detail panel */}
      <div style={{ display:'grid', gridTemplateColumns: selected ? '1fr 300px' : '1fr', gap:16, alignItems:'start' }}>

        {/* Calendar grid */}
        <div className="fp-card" style={{ padding:16 }}>
          {/* Day headers */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2, marginBottom:4 }}>
            {['Sun','Mon','Tue','Wed','Thu','Fri','Sat'].map(d=>(
              <div key={d} style={{ textAlign:'center', fontSize:11, fontWeight:700,
                color:'var(--text3)', padding:'4px 0', textTransform:'uppercase', letterSpacing:'0.05em' }}>
                {d}
              </div>
            ))}
          </div>

          {/* Day cells */}
          {isLoading ? (
            <div className="fp-loader"><div className="fp-spinner"/></div>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:2 }}>
              {days.map(day => {
                const key     = format(day, 'yyyy-MM-dd')
                const dp      = postsByDay[key] || []
                const inMonth = isSameMonth(day, current)
                const isToday_ = isToday(day)
                const isSel   = selected && isSameDay(day, selected)

                return (
                  <div key={key}
                    onClick={()=>setSelected(isSel ? null : day)}
                    style={{
                      minHeight:90, padding:'6px 4px', borderRadius:8, cursor:'pointer',
                      border: isSel ? '2px solid var(--violet)' : '1.5px solid var(--border)',
                      background: isSel ? 'var(--violet-soft,#f3f0ff)' : inMonth ? 'var(--bg2)' : 'var(--bg)',
                      opacity: inMonth ? 1 : 0.4,
                      transition:'all .1s',
                    }}>
                    {/* Day number */}
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4 }}>
                      <span style={{
                        width:22, height:22, borderRadius:'50%', display:'flex',
                        alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700,
                        background: isToday_ ? 'var(--violet)' : 'transparent',
                        color: isToday_ ? '#fff' : 'var(--text)',
                      }}>
                        {format(day,'d')}
                      </span>
                      {dp.length > 0 && (
                        <span style={{ fontSize:10, fontWeight:700, padding:'1px 5px', borderRadius:10,
                          background:'var(--violet)', color:'#fff' }}>
                          {dp.length}
                        </span>
                      )}
                    </div>

                    {/* Post dots */}
                    {dp.slice(0,3).map(p => {
                      const siteIdx = sites.indexOf(p.site_id)
                      const col = STATUS_COLOR[p.status] || '#888'
                      return (
                        <Link key={p.id} to={`/compose/${p.id}`}
                          onClick={e=>e.stopPropagation()}
                          style={{
                            display:'block', padding:'2px 5px', marginBottom:2,
                            borderRadius:4, fontSize:10, lineHeight:1.3,
                            background: col+'18', color: col,
                            borderLeft: `3px solid ${col}`,
                            textDecoration:'none', overflow:'hidden',
                            whiteSpace:'nowrap', textOverflow:'ellipsis',
                          }}>
                          {p.caption?.substring(0,20) || 'Post'}
                        </Link>
                      )
                    })}
                    {dp.length > 3 && (
                      <div style={{ fontSize:10, color:'var(--text3)', padding:'1px 4px', fontWeight:600 }}>
                        +{dp.length-3} more
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Day detail panel */}
        {selected && (
          <div className="fp-card" style={{ position:'sticky', top:20 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between',
              padding:'12px 16px', borderBottom:'1px solid var(--border)' }}>
              <div style={{ fontWeight:700, fontSize:15 }}>
                {format(selected,'EEE, MMM d')}
              </div>
              <button onClick={()=>setSelected(null)}
                style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text3)' }}>
                <X size={16}/>
              </button>
            </div>

            {selectedPosts.length === 0 ? (
              <div style={{ padding:'32px 16px', textAlign:'center' }}>
                <div style={{ fontSize:32, marginBottom:8 }}>📭</div>
                <div style={{ fontSize:13, color:'var(--text3)', marginBottom:16 }}>No posts scheduled</div>
                <Link to="/compose" className="fp-btn fp-btn-primary fp-btn-sm">
                  <Plus size={12}/> Schedule Post
                </Link>
              </div>
            ) : (
              <div style={{ padding:'8px 0', maxHeight:500, overflowY:'auto' }}>
                {selectedPosts.map(p => {
                  const col      = STATUS_COLOR[p.status] || '#888'
                  const siteIdx  = sites.indexOf(p.site_id)
                  const siteName = SITE_NAMES[p.site_id] || `Site ${p.site_id}`
                  const siteCol  = SITE_COLORS[siteIdx] || '#888'
                  return (
                    <div key={p.id} style={{ padding:'10px 16px', borderBottom:'1px solid var(--border)' }}>
                      {/* Status + time */}
                      <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4 }}>
                        <span style={{ fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:20,
                          background:col+'18', color:col }}>
                          {p.status}
                        </span>
                        <span style={{ fontSize:10, fontWeight:700, padding:'2px 7px', borderRadius:20,
                          background:siteCol+'18', color:siteCol }}>
                          {siteName}
                        </span>
                        <span style={{ fontSize:11, color:'var(--text3)', marginLeft:'auto',
                          display:'flex', alignItems:'center', gap:3 }}>
                          <Clock size={10}/>
                          {p.scheduled_at ? format(parseISO(p.scheduled_at),'h:mm a') : '—'}
                        </span>
                      </div>

                      {/* Caption */}
                      <div style={{ fontSize:12, color:'var(--text2)', lineHeight:1.5, marginBottom:8 }}>
                        {p.caption?.substring(0,100)}{p.caption?.length > 100 ? '…' : ''}
                      </div>

                      {/* Actions */}
                      <div style={{ display:'flex', gap:6 }}>
                        <Link to={`/compose/${p.id}`} className="fp-btn fp-btn-ghost fp-btn-sm">
                          Edit
                        </Link>
                        {p.status === 'scheduled' && (
                          <span style={{ fontSize:11, color:'var(--text3)', alignSelf:'center' }}>
                            Drag to reschedule
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Add post button */}
            <div style={{ padding:'12px 16px', borderTop:'1px solid var(--border)' }}>
              <Link to="/compose" className="fp-btn fp-btn-ghost fp-btn-sm" style={{ width:'100%', justifyContent:'center' }}>
                <Plus size={13}/> Add post for {format(selected,'MMM d')}
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
