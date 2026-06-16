import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api, sitesApi } from '../utils/api'
import toast from 'react-hot-toast'
import { FileText, Sparkles, Copy, Send, Info } from 'lucide-react'

const PLATFORMS = ['twitter','linkedin','instagram','facebook','telegram','tiktok','threads']

export default function BlogToSocialPage() {
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [profileId, setProfileId] = useState('')
  const [platforms, setPlatforms] = useState(['twitter','linkedin','instagram','facebook'])
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState(null)
  const [showHelp, setShowHelp] = useState(false)

  const { data: profilesRes } = useQuery({ queryKey:['voice-profiles'], queryFn:()=>api.get('/voice-profiles') })
  const profiles = profilesRes?.data ?? []
  const navigate = useNavigate()

  const sendToCompose = (text) => {
    sessionStorage.setItem('fp_compose_prefill', JSON.stringify({ caption: text }))
    navigate('/compose')
  }

  const togglePlatform = p => setPlatforms(prev => prev.includes(p)?prev.filter(x=>x!==p):[...prev,p])

  const generate = async () => {
    if (!url && !content) return toast.error('Enter a URL or paste content')
    if (platforms.length===0) return toast.error('Select at least one platform')
    setLoading(true)
    setResults(null)
    try {
      const r = await api.post('/ai/blog-to-social', { url, title, content, platforms, profile_id:parseInt(profileId)||0 })
      setResults(r.data)
      toast.success(`Generated ${Object.keys(r.data.posts||{}).length} posts!`)
    } catch(e) { toast.error(e.message) }
    finally { setLoading(false) }
  }

  const PLATFORM_COLORS = { twitter:'#000',linkedin:'#0077b5',instagram:'#e1306c',facebook:'#1877f2',telegram:'#0088cc',tiktok:'#010101',threads:'#000' }

  return (
    <div>
      <div className="fp-page-header" style={{marginBottom:24}}>
        <h1 className="fp-page-title">Blog → Social Posts</h1>
        <p className="fp-page-sub">Turn one blog post or article into platform-specific social posts automatically</p>
      </div>

      {/* Inline how-to */}
      <div style={{marginBottom:16}}>
        <button onClick={()=>setShowHelp(v=>!v)} style={{display:'flex',alignItems:'center',gap:6,background:'none',border:'none',cursor:'pointer',color:'var(--violet)',fontSize:13,fontWeight:600,padding:0}}>
          <Info size={14}/> How it works {showHelp?'▲':'▼'}
        </button>
        {showHelp && (
          <div className="fp-card" style={{marginTop:8,fontSize:13,color:'var(--text2)',lineHeight:1.8}}>
            <ol style={{margin:0,paddingLeft:18}}>
              <li>Paste a blog/article <strong>URL</strong>, or paste the title + content directly.</li>
              <li>(Optional) choose a <strong>Voice Profile</strong> to match your tone.</li>
              <li>Tap the <strong>platform pills</strong> to pick which networks to write for.</li>
              <li>Click <strong>Generate Posts</strong> — a custom post appears for each platform.</li>
              <li>Click <strong>Compose</strong> on any result to drop it into the Composer (then pick accounts &amp; schedule), or <strong>Copy</strong> to paste it elsewhere.</li>
            </ol>
          </div>
        )}
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,alignItems:'start'}}>
        <div className="fp-card">
          <div style={{fontWeight:700,fontSize:13,marginBottom:12}}>Input</div>
          <div style={{marginBottom:10}}><label className="fp-label">Blog/Article URL</label>
            <input className="fp-input" value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://ssiministries.org/prayer-is-your-deadliest-weapon/"/>
          </div>
          <div style={{marginBottom:10,textAlign:'center',color:'var(--text3)',fontSize:12}}>— or paste content directly —</div>
          <div style={{marginBottom:10}}><label className="fp-label">Title (optional)</label>
            <input className="fp-input" value={title} onChange={e=>setTitle(e.target.value)} placeholder="Prayer is Your Deadliest Weapon"/>
          </div>
          <div style={{marginBottom:12}}><label className="fp-label">Content (optional)</label>
            <textarea className="fp-input" rows={4} value={content} onChange={e=>setContent(e.target.value)} style={{width:'100%',resize:'vertical'}} placeholder="Paste article text here..."/>
          </div>

          <div style={{marginBottom:12}}>
            <label className="fp-label">Voice Profile (optional)</label>
            <select className="fp-select" value={profileId} onChange={e=>setProfileId(e.target.value)}>
              <option value="">Generic AI</option>
              {profiles.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>

          <div style={{marginBottom:14}}>
            <label className="fp-label">Generate for</label>
            <div style={{display:'flex',flexWrap:'wrap',gap:6}}>
              {PLATFORMS.map(p=>(
                <button key={p} onClick={()=>togglePlatform(p)}
                  style={{padding:'4px 12px',borderRadius:20,border:'1.5px solid '+(platforms.includes(p)?PLATFORM_COLORS[p]:'var(--border)'),
                    background:platforms.includes(p)?PLATFORM_COLORS[p]+'15':'transparent',
                    color:platforms.includes(p)?PLATFORM_COLORS[p]:'var(--text3)',
                    fontSize:12,fontWeight:600,cursor:'pointer'}}>
                  {p}
                </button>
              ))}
            </div>
          </div>

          <button className="fp-btn fp-btn-primary" onClick={generate} disabled={loading} style={{width:'100%',justifyContent:'center'}}>
            {loading?<><Sparkles size={14} style={{animation:'spin 1s linear infinite'}}/> Generating...</>:<><Sparkles size={14}/> Generate {platforms.length} Posts</>}
          </button>
        </div>

        {/* Results */}
        <div>
          <div style={{fontWeight:700,fontSize:13,marginBottom:12}}>Generated Posts</div>
          {!results && <div className="fp-card" style={{textAlign:'center',padding:40,color:'var(--text3)'}}><FileText size={32} style={{opacity:.2,marginBottom:8}}/><p>Posts will appear here after generation.</p></div>}
          {results && Object.entries(results.posts||{}).map(([platform, text])=>(
            <div key={platform} className="fp-card" style={{marginBottom:10}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                <span style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'.08em',color:PLATFORM_COLORS[platform]||'var(--primary)'}}>{platform}</span>
                <div style={{display:'flex',gap:4}}>
                  <button onClick={()=>{navigator.clipboard.writeText(text);toast.success('Copied!')}} className="fp-btn fp-btn-ghost fp-btn-sm" style={{fontSize:11}}><Copy size={11}/> Copy</button>
                  <button onClick={()=>sendToCompose(text)} className="fp-btn fp-btn-primary fp-btn-sm" style={{fontSize:11}} title="Open in Composer to pick accounts & schedule"><Send size={11}/> Compose</button>
                </div>
              </div>
              <div style={{fontSize:13,lineHeight:1.7,whiteSpace:'pre-wrap',color:'var(--text)'}}>{text}</div>
              <div style={{fontSize:10,color:'var(--text3)',marginTop:6}}>{text.length} chars</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
