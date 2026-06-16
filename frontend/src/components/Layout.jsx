import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { LayoutDashboard, Mail, PenSquare, MessageSquare, Megaphone, FileBarChart, Smartphone, Radio, LineChart, AtSign, Clock, List, Globe, Plug, Image, Users, Settings, LogOut, Zap, Menu, X, CalendarDays, Bell, BarChart3, FileText, RotateCcw, Upload, Rss, Tag, CheckSquare, Sparkles, Layers, PenLine, Bot, Code, Gift, Mic, Linkedin, BookOpen, MessageCircle } from 'lucide-react';
import { useState, useRef, useEffect } from 'react'
import toast from 'react-hot-toast'

const nav = [
  {to:"/",              icon:LayoutDashboard, label:"Dashboard",         section:"OVERVIEW"},
  {to:"/calendar",      icon:CalendarDays,    label:"Calendar"},
  {to:"/help",          icon:BookOpen,        label:"Help & Guides"},
  {to:"/compose",       icon:PenSquare,       label:"Compose",           section:"CONTENT"},
  {to:"/posts",         icon:List,            label:"All Posts"},
  {to:"/queue",         icon:Clock,           label:"Queue"},
  {to:"/analytics",     icon:BarChart3,       label:"Analytics"},
  {to:"/inbox",         icon:MessageCircle,   label:"Inbox",             section:"ENGAGE"},
  {to:"/email-inbox",   icon:Mail,            label:"Email Inbox"},
  {to:"/tasks",         icon:CheckSquare,     label:"Tasks"},
  {to:"/campaigns",     icon:Megaphone,       label:"Campaigns"},
  {to:"/reports",       icon:FileBarChart,    label:"Reports"},
  {to:"/broadcast",     icon:Radio,           label:"Broadcast"},
  {to:"/whatsapp-contacts", icon:Smartphone,  label:"WhatsApp Contacts"},
  {to:"/listening",     icon:Radio,           label:"Social Listening"},
  {to:"/ga-analytics",  icon:LineChart,       label:"Google Analytics"},
  {to:"/email",         icon:AtSign,          label:"Email Marketing"},
  {to:"/lead-magnet-optin", icon:Gift,        label:"Lead Magnet Opt-in"},
  {to:"/templates",     icon:FileText,        label:"Templates"},
  {to:"/comment-templates", icon:CheckSquare, label:"Comment Templates"},
  {to:"/auto-post",     icon:Bot,             label:"AI Auto Post"},
  {to:"/ai-schedule",   icon:Sparkles,        label:"AI Auto-Schedule"},
  {to:"/recycle",       icon:RotateCcw,       label:"Recycle"},
  {to:"/bulk-import",   icon:Upload,          label:"Bulk Import"},
  {to:"/rss-feeds",     icon:Rss,             label:"RSS Feeds"},
  {to:"/sites",         icon:Globe,           label:"Sites",             section:"MANAGE"},
  {to:"/integrations",  icon:Zap,             label:"Integrations"},
  {to:"/lead-outreach", icon:Linkedin,        label:"Sales Navigator"},
  {to:"/connections",   icon:Plug,            label:"Connections"},
  {to:"/media",         icon:Image,           label:"Media"},
  {to:"/voice-learning", icon:Mic,            label:"Voice Learning"},
  {to:"/blog-to-social", icon:FileText,       label:"Blog to Social"},
  {to:"/carousel",      icon:Layers,          label:"Carousel Creator"},
  {to:"/users",         icon:Users,           label:"Users",             section:"ADMIN", adminOnly:true},
  {to:"/team",          icon:Users,           label:"Team"},
  {to:"/webhooks",      icon:Zap,             label:"Webhooks"},
  {to:"/sets",          icon:Layers,          label:"Sets"},
  {to:"/signatures",    icon:PenLine,         label:"Signatures"},
  {to:"/settings",      icon:Settings,        label:"Settings"},
]

// Live notifications — polls every 30 seconds
function useNotifs() {
  const [notifs, setNotifs] = useState([])
  useEffect(() => {
    const load = async () => {
      try {
        const token = localStorage.getItem('fp_token') || sessionStorage.getItem('fp_token') || ''
        const res = await fetch('/api/notifications', {
          headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
          credentials: 'include'
        })
        if (res.ok) { const d = await res.json(); setNotifs(d.data || []) }
      } catch {}
    }
    load()
    const interval = setInterval(load, 30000)
    return () => clearInterval(interval)
  }, [])
  return notifs
}

async function markRead(id) {
  try {
    const token = localStorage.getItem('fp_token') || sessionStorage.getItem('fp_token') || ''
    await fetch(`/api/notifications/${id}/read`, {
      method: 'POST', credentials: 'include',
      headers: { 'Authorization': 'Bearer ' + token }
    })
  } catch {}
}

async function markAllRead() {
  try {
    const token = localStorage.getItem('fp_token') || sessionStorage.getItem('fp_token') || ''
    await fetch('/api/notifications/read-all', {
      method: 'POST', credentials: 'include',
      headers: { 'Authorization': 'Bearer ' + token }
    })
  } catch {}
}

export default function Layout() {
  const {user,logout,isAdmin} = useAuthStore()
  const navigate = useNavigate()
  const [open,setOpen] = useState(false)
  const [showNotifs,setShowNotifs] = useState(false)
  const notifRef = useRef(null)
  const [NOTIFS, setNOTIFS] = useState([])
  const _notifs = useNotifs()
  useEffect(()=>setNOTIFS(_notifs), [_notifs])

  // Handle any OAuth popup callbacks
  useEffect(()=>{
    const p = new URLSearchParams(window.location.search)
    const ok  = p.get('oauth_success')
    const err = p.get('oauth_error')
    if (ok) {
      window.history.replaceState({}, '', window.location.pathname)
      if (window.opener) {
        window.opener.postMessage({ type: ok + '_connected', oauth: ok }, '*')
        window.close()
      }
    } else if (err) {
      window.history.replaceState({}, '', window.location.pathname)
      if (window.opener) {
        window.opener.postMessage({ type: 'oauth_error', error: err }, '*')
        window.close()
      }
    }
  }, [])

  useEffect(()=>{
    const h = e => { if(notifRef.current&&!notifRef.current.contains(e.target)) setShowNotifs(false) }
    document.addEventListener('mousedown',h)
    return ()=>document.removeEventListener('mousedown',h)
  },[])

  const handleLogout = async()=>{ await logout(); toast.success('Logged out'); navigate('/login') }
  const filtered = nav.filter(n=>!n.adminOnly||isAdmin())

  return (
    <div className="fp-layout">
      {open&&<div className="fp-overlay" onClick={()=>setOpen(false)}/>}
      <div className={`fp-sidebar-wrap${open?' open':''}`}>
        <aside className="fp-sidebar">
          <div className="fp-brand">
            <div className="fp-logo-mark" style={{borderRadius:10,width:34,height:34,overflow:"hidden",flexShrink:0}}><img src="https://scheduler.flomicso.dev/storage/media/fp_6a1f5d3184c104.04916493.png" style={{width:34,height:34,objectFit:"cover"}}/></div>
            <div><div className="fp-brand-name">FlomiPost</div><div className="fp-brand-tagline">scheduler.flomicso.dev</div></div>
          </div>
          <nav className="fp-nav">
            {filtered.map(item=>(
              <div key={item.to}>
                {item.section&&<div className="fp-nav-section">{item.section}</div>}
                <NavLink to={item.to} end={item.to==='/'} className={({isActive})=>`fp-nav-item${isActive?' active':''}`} onClick={()=>setOpen(false)}>
                  <item.icon size={15}/><span>{item.label}</span>
                </NavLink>
              </div>
            ))}
          </nav>
          <div className="fp-sidebar-footer">
            <div className="fp-user-row">
              <div className="fp-user-avatar">{user?.name?.[0]?.toUpperCase()}</div>
              <div className="fp-user-info"><div className="fp-user-name">{user?.name}</div><div className="fp-user-role">{user?.role}</div></div>
              <button className="fp-logout-btn" onClick={handleLogout} title="Logout"><LogOut size={14}/></button>
            </div>
          </div>
        </aside>
      </div>
      <div className="fp-main">
        <header className="fp-topbar">
          <button className="fp-menu-btn" onClick={()=>setOpen(o=>!o)}>{open?<X size={20}/>:<Menu size={20}/>}</button>
          <div className="fp-topbar-right">
            <div style={{position:'relative'}} ref={notifRef}>
              <button className="fp-notif-btn" onClick={()=>setShowNotifs(v=>!v)}>
                <Bell size={16}/>
                {NOTIFS.some(n=>!n.is_read) && <span className="fp-notif-dot"/>}
              </button>
              {showNotifs&&(
                <div className="fp-notif-panel">
                  <div className="fp-notif-header">
                    Notifications
                    <span style={{fontSize:11,color:'var(--text3)',fontWeight:400}}>{NOTIFS.filter(n=>!n.is_read).length} new</span>
                    {NOTIFS.some(n=>!n.is_read) && (
                      <button onClick={()=>{ markAllRead(); setNOTIFS(p=>p.map(n=>({...n,is_read:1}))) }}
                        style={{marginLeft:'auto',fontSize:10,fontWeight:700,color:'var(--primary)',background:'none',border:'none',cursor:'pointer'}}>
                        Mark all read
                      </button>
                    )}
                  </div>
                  {NOTIFS.length === 0 && (
                    <div style={{padding:'24px 16px',textAlign:'center',fontSize:12,color:'var(--text3)'}}>
                      <div style={{fontSize:24,marginBottom:6}}>🔔</div>
                      No notifications yet
                    </div>
                  )}
                  {NOTIFS.map(n=>(
                    <div key={n.id} className={`fp-notif-item${!n.is_read?' unread':''}`}
                      onClick={()=>{ markRead(n.id); setNOTIFS(p=>p.map(x=>x.id===n.id?{...x,is_read:1}:x)); if(n.link) navigate(n.link); setShowNotifs(false) }}
                      style={{cursor: n.link ? 'pointer' : 'default'}}>
                      <div className="fp-notif-icon" style={{background:(n.color||'#6366f1')+'20'}}>{n.icon}</div>
                      <div className="fp-notif-text">
                        <div className="fp-notif-msg" style={{fontWeight: n.is_read?400:600}}>{n.message}</div>
                        <div className="fp-notif-time">{new Date(n.created_at).toLocaleString()}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <NavLink to="/compose" className="fp-compose-btn"><PenSquare size={14}/>New Post</NavLink>
          </div>
        </header>
        <main className="fp-content"><Outlet/></main>
      </div>
    </div>
  )
}
