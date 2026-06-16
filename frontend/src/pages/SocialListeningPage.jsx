import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../utils/api'
import toast from 'react-hot-toast'
import { Search, Plus, Trash2, X, Radio, Eye, EyeOff } from 'lucide-react'

function timeAgo(dt) {
  const s = Math.floor((Date.now()-new Date(dt))/1000)
  if(s<60) return 'just now'; if(s<3600) return Math.floor(s/60)+'m ago'
  if(s<86400) return Math.floor(s/3600)+'h ago'; return Math.floor(s/86400)+'d ago'
}

const PLAT_COLORS = { facebook:'#1877f2',instagram:'#e1306c',twitter:'#000',x:'#000',tiktok:'#010101' }

export default function SocialListeningPage() {
  const qc = useQueryClient()
  const [kw, setKw] = useState('')
  const [platform, setPlatform] = useState('')
  const [searchQ, setSearchQ] = useState('')
  const [newKeyword, setNewKeyword] = useState('')
  const [showAdd, setShowAdd] = useState(false)

  const { data: mentionsRes, isLoading } = useQuery({
    queryKey: ['mentions', kw, platform],
    queryFn: () => api.get(`/listening/mentions?${kw?'keyword='+kw:''}${platform?'&platform='+platform:''}`),
    refetchInterval: 60000,
  })
  const { data: keywordsRes } = useQuery({ queryKey:['keywords'], queryFn:()=>api.get('/listening/keywords') })

  const mentions  = mentionsRes?.data ?? []
  const keywords  = keywordsRes?.data ?? []
  const unread    = mentions.filter(m=>!m.is_read).length

  const addKwMutation = useMutation({
    mutationFn: () => api.post('/listening/keywords', { keyword: newKeyword }),
    onSuccess: () => { toast.success('Keyword added!'); qc.invalidateQueries({queryKey:['keywords']}); setNewKeyword(''); setShowAdd(false) },
    onError: e => toast.error(e.message),
  })
  const deleteKwMutation = useMutation({
    mutationFn: id => api.delete(`/listening/keywords/${id}`),
    onSuccess: () => { qc.invalidateQueries({queryKey:['keywords']}) },
  })
  const readMutation = useMutation({
    mutationFn: id => api.post(`/listening/mentions/${id}/read`),
    onSuccess: () => qc.invalidateQueries({queryKey:['mentions']}),
  })
  const searchMutation = useMutation({
    mutationFn: () => api.get(`/listening/search?q=${encodeURIComponent(searchQ)}`),
    onSuccess: d => { toast.success(`Found ${d.data?.count||0} results`); qc.invalidateQueries({queryKey:['mentions']}) },
    onError: e => toast.error(e.message),
  })

  return (
    <div>
      <div className="fp-page-header">
        <div>
          <div className="fp-page-title">Social Listening</div>
          <div className="fp-page-sub">Monitor brand mentions and keywords across platforms</div>
        </div>
        <div style={{display:'flex',gap:8}}>
          <div style={{display:'flex',gap:6}}>
            <input className="fp-input" placeholder="Search now…" value={searchQ} onChange={e=>setSearchQ(e.target.value)}
              style={{width:200,fontSize:13}} onKeyDown={e=>e.key==='Enter'&&searchQ&&searchMutation.mutate()}/>
            <button className="fp-btn fp-btn-primary fp-btn-sm" onClick={()=>searchMutation.mutate()} disabled={!searchQ||searchMutation.isPending}>
              <Search size={13}/> {searchMutation.isPending?'Searching…':'Search'}
            </button>
          </div>
          <button className="fp-btn fp-btn-ghost fp-btn-sm" onClick={()=>setShowAdd(true)}><Plus size={13}/> Add Keyword</button>
        </div>
      </div>

      {/* Keywords */}
      <div className="fp-card" style={{padding:'14px 18px',marginBottom:20}}>
        <div style={{display:'flex',alignItems:'center',gap:8,flexWrap:'wrap'}}>
          <Radio size={14} color="var(--violet)"/>
          <span style={{fontSize:13,fontWeight:700,color:'var(--text3)'}}>Tracking:</span>
          <button onClick={()=>setKw('')}
            style={{padding:'4px 12px',borderRadius:20,cursor:'pointer',fontSize:12,fontWeight:700,
              border:!kw?'none':'1.5px solid var(--border)',background:!kw?'var(--violet)':'var(--bg2)',color:!kw?'#fff':'var(--text2)'}}>
            All
          </button>
          {keywords.map(k=>(
            <div key={k.id} style={{display:'flex',alignItems:'center',gap:2}}>
              <button onClick={()=>setKw(k.keyword)}
                style={{padding:'4px 12px',borderRadius:20,cursor:'pointer',fontSize:12,fontWeight:700,
                  border:kw===k.keyword?'none':'1.5px solid var(--border)',
                  background:kw===k.keyword?'var(--violet)':'var(--bg2)',
                  color:kw===k.keyword?'#fff':'var(--text2)'}}>
                #{k.keyword}
              </button>
              <button onClick={()=>deleteKwMutation.mutate(k.id)}
                style={{background:'none',border:'none',cursor:'pointer',color:'var(--text3)',padding:'2px'}}>
                <X size={11}/>
              </button>
            </div>
          ))}
          {keywords.length===0 && <span style={{fontSize:12,color:'var(--text3)'}}>No keywords yet — add some to start tracking</span>}
        </div>
      </div>

      {/* Platform filter */}
      <div style={{display:'flex',gap:8,marginBottom:16,alignItems:'center'}}>
        <span style={{fontSize:13,color:'var(--text3)',fontWeight:600}}>Platform:</span>
        {['','facebook','instagram','twitter','tiktok'].map(p=>(
          <button key={p} onClick={()=>setPlatform(p)}
            style={{padding:'5px 14px',borderRadius:20,cursor:'pointer',fontSize:12,fontWeight:700,
              border:platform===p?'none':'1.5px solid var(--border)',
              background:platform===p?(PLAT_COLORS[p]||'var(--violet)'):'var(--bg2)',
              color:platform===p?'#fff':'var(--text2)',textTransform:'capitalize'}}>
            {p||'All'}
          </button>
        ))}
        {unread>0 && <span style={{marginLeft:'auto',fontSize:12,fontWeight:700,color:'var(--violet)'}}>{unread} unread</span>}
      </div>

      {/* Mentions */}
      {isLoading ? <div className="fp-loader"><div className="fp-spinner"/></div> :
        mentions.length===0 ? (
          <div className="fp-card" style={{textAlign:'center',padding:'48px 24px'}}>
            <div style={{fontSize:36,marginBottom:12}}>📡</div>
            <div style={{fontSize:16,fontWeight:700,marginBottom:8}}>No mentions found</div>
            <div style={{fontSize:13,color:'var(--text3)',marginBottom:16}}>Use the Search button to find mentions now, or add keywords to track automatically.</div>
          </div>
        ) : (
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {mentions.map(m=>(
              <div key={m.id} onClick={()=>!m.is_read&&readMutation.mutate(m.id)}
                style={{background:'var(--bg2)',border:m.is_read?'1.5px solid var(--border)':`1.5px solid ${PLAT_COLORS[m.platform]||'var(--violet)'}50`,
                  borderLeft:m.is_read?'4px solid var(--border)':`4px solid ${PLAT_COLORS[m.platform]||'var(--violet)'}`,
                  borderRadius:10,padding:'14px 16px',cursor:m.is_read?'default':'pointer'}}>
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6,flexWrap:'wrap'}}>
                  <span style={{fontSize:12,fontWeight:700,padding:'2px 8px',borderRadius:20,
                    background:(PLAT_COLORS[m.platform]||'#888')+'18',color:PLAT_COLORS[m.platform]||'#888',textTransform:'capitalize'}}>
                    {m.platform}
                  </span>
                  <span style={{fontSize:12,fontWeight:600,color:'var(--text2)'}}>{m.author_name||m.author_handle||'Unknown'}</span>
                  <span style={{fontSize:11,background:'var(--bg3)',padding:'1px 7px',borderRadius:20,color:'var(--text3)'}}>#{m.keyword}</span>
                  {!m.is_read && <span style={{width:7,height:7,borderRadius:'50%',background:PLAT_COLORS[m.platform]||'var(--violet)',display:'inline-block'}}/>}
                  <span style={{fontSize:11,color:'var(--text3)',marginLeft:'auto'}}>{timeAgo(m.created_at)}</span>
                </div>
                <div style={{fontSize:14,color:'var(--text2)',lineHeight:1.5}}>{m.content}</div>
                {m.url && <a href={m.url} target="_blank" rel="noreferrer" style={{fontSize:11,color:'var(--violet)',textDecoration:'none'}}>View post ↗</a>}
              </div>
            ))}
          </div>
        )
      }

      {/* Add keyword modal */}
      {showAdd && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:500,padding:20}}
          onClick={e=>e.target===e.currentTarget&&setShowAdd(false)}>
          <div className="fp-modal">
            <div className="fp-modal-header">
              <div className="fp-modal-title">Track a Keyword</div>
              <button className="fp-modal-close" onClick={()=>setShowAdd(false)}><X size={18}/></button>
            </div>
            <div className="fp-field">
              <label className="fp-label">Keyword or brand name</label>
              <input className="fp-input" placeholder="e.g. sanmidawodu, kaff homecare, #godislove" value={newKeyword} onChange={e=>setNewKeyword(e.target.value)}
                onKeyDown={e=>e.key==='Enter'&&newKeyword&&addKwMutation.mutate()}/>
            </div>
            <div style={{display:'flex',gap:8,marginTop:16}}>
              <button className="fp-btn fp-btn-ghost" onClick={()=>setShowAdd(false)}>Cancel</button>
              <button className="fp-btn fp-btn-primary" onClick={()=>addKwMutation.mutate()} disabled={!newKeyword.trim()||addKwMutation.isPending}>Add Keyword</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
