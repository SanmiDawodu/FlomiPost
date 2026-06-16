import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, sitesApi } from '../utils/api'
import toast from 'react-hot-toast'
import { Layers, Sparkles, Copy, Download } from 'lucide-react'

export default function CarouselPage() {
  const qc = useQueryClient()
  const [form, setForm] = useState({ topic:'', site_id:'', slides:7, brand_color:'#5b3cf5', profile_id:'' })
  const [loading, setLoading] = useState(false)
  const [slides, setSlides] = useState([])
  const [currentSlide, setCurrentSlide] = useState(0)

  const { data: sitesRes }    = useQuery({ queryKey:['sites'],         queryFn: sitesApi.list })
  const { data: profilesRes } = useQuery({ queryKey:['voice-profiles'],queryFn:()=>api.get('/voice-profiles') })
  const { data: carouselRes } = useQuery({ queryKey:['carousels'],     queryFn:()=>api.get('/carousels') })

  const sites    = sitesRes?.data ?? []
  const profiles = profilesRes?.data ?? []
  const carousels= carouselRes?.data ?? []

  const s = (k,v) => setForm(f=>({...f,[k]:v}))

  const generate = async () => {
    if (!form.topic) return toast.error('Enter a topic')
    setLoading(true)
    try {
      const r = await api.post('/ai/generate-carousel', { ...form, site_id:parseInt(form.site_id||1), profile_id:parseInt(form.profile_id)||0 })
      setSlides(r.data.slides)
      setCurrentSlide(0)
      qc.invalidateQueries(['carousels'])
      toast.success(`${r.data.slide_count} slides generated!`)
    } catch(e) { toast.error(e.message) }
    finally { setLoading(false) }
  }

  const slide = slides[currentSlide]
  const bgColors = { cover: form.brand_color, content:'#fff', cta: form.brand_color }
  const textColors = { cover:'#fff', content:'#1a1a2e', cta:'#fff' }

  return (
    <div>
      <div className="fp-page-header" style={{marginBottom:24}}>
        <h1 className="fp-page-title">AI Carousel Creator</h1>
        <p className="fp-page-sub">Generate multi-slide carousel posts for Instagram, LinkedIn and Facebook</p>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'320px 1fr',gap:20,alignItems:'start'}}>
        {/* Controls */}
        <div className="fp-card">
          <div style={{fontWeight:700,fontSize:13,marginBottom:12}}>Create Carousel</div>
          <div style={{marginBottom:10}}><label className="fp-label">Topic *</label>
            <input className="fp-input" value={form.topic} onChange={e=>s('topic',e.target.value)} placeholder="5 Reasons Prayer Changes Everything"/></div>
          <div style={{marginBottom:10}}><label className="fp-label">Site</label>
            <select className="fp-select" value={form.site_id} onChange={e=>s('site_id',e.target.value)}>
              <option value="">Select...</option>
              {sites.map(st=><option key={st.id} value={st.id}>{st.name}</option>)}
            </select>
          </div>
          <div style={{marginBottom:10}}><label className="fp-label">Voice Profile</label>
            <select className="fp-select" value={form.profile_id} onChange={e=>s('profile_id',e.target.value)}>
              <option value="">Generic AI</option>
              {profiles.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:8,marginBottom:12}}>
            <div><label className="fp-label">Slides</label>
              <select className="fp-select" value={form.slides} onChange={e=>s('slides',parseInt(e.target.value))}>
                {[5,6,7,8,9,10].map(n=><option key={n} value={n}>{n} slides</option>)}
              </select>
            </div>
            <div><label className="fp-label">Brand color</label>
              <input type="color" value={form.brand_color} onChange={e=>s('brand_color',e.target.value)} style={{width:'100%',height:38,borderRadius:6,border:'1px solid var(--border)',padding:2,cursor:'pointer'}}/>
            </div>
          </div>
          <button className="fp-btn fp-btn-primary" onClick={generate} disabled={loading} style={{width:'100%',justifyContent:'center'}}>
            {loading?<><Sparkles size={14} style={{animation:'spin 1s linear infinite'}}/> Generating...</>:<><Sparkles size={14}/> Generate Carousel</>}
          </button>

          {carousels.length>0 && (
            <div style={{marginTop:16}}>
              <div style={{fontWeight:600,fontSize:12,marginBottom:8,color:'var(--text3)'}}>Recent Carousels</div>
              {carousels.slice(0,5).map(c=>(
                <div key={c.id} onClick={async()=>{ const r=await api.get('/carousels/'+c.id); setSlides(JSON.parse(r.data.slides||'[]')); setCurrentSlide(0); setForm(f=>({...f,brand_color:r.data.brand_color||'#5b3cf5'})) }}
                  style={{fontSize:12,padding:'6px 8px',borderRadius:6,cursor:'pointer',marginBottom:4,background:'var(--bg2)'}}>
                  {c.title?.slice(0,40)}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Slide Preview */}
        <div>
          {slides.length===0 && (
            <div className="fp-card" style={{textAlign:'center',padding:60,color:'var(--text3)'}}>
              <Layers size={40} style={{opacity:.2,marginBottom:10}}/>
              <p>Your carousel preview will appear here.</p>
            </div>
          )}
          {slides.length>0 && (
            <>
              {/* Slide viewer */}
              <div style={{marginBottom:16,display:'flex',alignItems:'center',gap:12}}>
                <button onClick={()=>setCurrentSlide(i=>Math.max(0,i-1))} disabled={currentSlide===0} className="fp-btn fp-btn-ghost fp-btn-sm">← Prev</button>
                <span style={{fontSize:13,fontWeight:700}}>{currentSlide+1} / {slides.length}</span>
                <button onClick={()=>setCurrentSlide(i=>Math.min(slides.length-1,i+1))} disabled={currentSlide===slides.length-1} className="fp-btn fp-btn-ghost fp-btn-sm">Next →</button>
              </div>

              {slide && (
                <div style={{borderRadius:16,overflow:'hidden',maxWidth:480,margin:'0 auto',boxShadow:'0 4px 24px rgba(0,0,0,.12)'}}>
                  <div style={{background:bgColors[slide.type]||form.brand_color,padding:'40px 32px',minHeight:320,display:'flex',flexDirection:'column',justifyContent:'center',position:'relative'}}>
                    {slide.type==='cover' && <div style={{fontSize:11,fontWeight:700,textTransform:'uppercase',letterSpacing:'.1em',color:'rgba(255,255,255,.7)',marginBottom:16}}>Slide 1 of {slides.length}</div>}
                    <div style={{fontSize:48,marginBottom:16}}>{slide.emoji}</div>
                    <h2 style={{fontSize:28,fontWeight:900,color:textColors[slide.type]||'#fff',margin:'0 0 16px',lineHeight:1.2}}>{slide.headline}</h2>
                    <p style={{fontSize:16,color:slide.type==='content'?'#555':'rgba(255,255,255,.9)',lineHeight:1.7,margin:0}}>{slide.body}</p>
                    {slide.type==='cta' && <div style={{marginTop:24,padding:'12px 24px',background:'rgba(255,255,255,.2)',borderRadius:8,textAlign:'center',fontWeight:700,color:'#fff',fontSize:14}}>Save & Share →</div>}
                    <div style={{position:'absolute',bottom:16,right:16,fontSize:10,color:'rgba(255,255,255,.4)',fontWeight:700,textTransform:'uppercase'}}>FlomiPost</div>
                  </div>
                </div>
              )}

              {/* All slides text */}
              <div style={{marginTop:24}}>
                <div style={{fontWeight:700,fontSize:13,marginBottom:10}}>All Slides</div>
                <div style={{display:'flex',flexDirection:'column',gap:8}}>
                  {slides.map((sl,i)=>(
                    <div key={i} onClick={()=>setCurrentSlide(i)} className="fp-card" style={{cursor:'pointer',padding:'10px 14px',border:currentSlide===i?'2px solid var(--primary)':'2px solid transparent',display:'flex',gap:10,alignItems:'flex-start'}}>
                      <span style={{fontSize:20,flexShrink:0}}>{sl.emoji}</span>
                      <div style={{flex:1}}>
                        <div style={{fontWeight:700,fontSize:13}}>{i+1}. {sl.headline}</div>
                        <div style={{fontSize:12,color:'var(--text3)'}}>{sl.body?.slice(0,80)}...</div>
                      </div>
                      <button onClick={e=>{e.stopPropagation();navigator.clipboard.writeText(sl.headline+'\n\n'+sl.body);toast.success('Copied!')}} className="fp-btn fp-btn-ghost fp-btn-sm" style={{fontSize:10}}><Copy size={10}/></button>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
