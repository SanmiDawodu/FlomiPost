import { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, postsApi, sitesApi, platformsApi, aiApi, mediaApi, connectionsApi } from '../utils/api'
import DatePicker from 'react-datepicker'
import 'react-datepicker/dist/react-datepicker.css'
import ReactQuill, { Quill } from 'react-quill'
import 'react-quill/dist/quill.snow.css'
import toast from 'react-hot-toast'
import { Sparkles, Image, Send, Save, Clock, X, ChevronDown, Mic, Video, Loader, Upload } from 'lucide-react'
import { format } from 'date-fns'

const EL_VOICES = [
  // Males
  {id:'CwhRBWXzGAHq8TQ4Fs17', name:'Roger — Laid-Back (M)'},
  {id:'IKne3meq5aSn9XLyUdCD', name:'Charlie — Deep (M)'},
  {id:'JBFqnCBsd6RMkjVDRZzb', name:'George — Storyteller (M)'},
  {id:'TX3LPaxmHKxFdv7VOQHJ', name:'Liam — Social Media (M)'},
  {id:'cjVigY5qzO86Huf0OWal', name:'Eric — Smooth (M)'},
  {id:'iP95p4xoKVk53GoZ742B', name:'Chris — Charming (M)'},
  {id:'nPczCjzI2devNBz1zQrb', name:'Brian — Deep (M)'},
  {id:'onwK4e9ZLuTAKqWW03F9', name:'Daniel — Broadcaster (M)'},
  {id:'uPdPVJPZIryn3WAH8mKG', name:'Moses — Storyteller (M)'},
  {id:'EkK5I93UQWFDigLMpZcX', name:'James — Bold (M)'},
  {id:'dPah2VEoifKnZT37774q', name:'Knox — Serious (M)'},
  {id:'sUwtOYEjCoROzbhBKwqi', name:'Moses Sam Paul — Deep (M)'},
  {id:'bIHbv24MWmeRgasZH58o', name:'Will — Friendly (M)'},
  {id:'N2lVS1w4EtoT3dr4eOWO', name:'Callum — Intense (M)'},
  {id:'D38z5RcWu1voky8WS1ja', name:'Fin — Sailor (M)'},
  // Females
  {id:'EXAVITQu4vr4xnSDxMaL', name:'Sarah — Mature (F)'},
  {id:'FGY2WhTYpPnrIDTdsKH5', name:'Laura — Enthusiast (F)'},
  {id:'SAz9YHcvj6GT2YYXdXww', name:'River — Relaxed (F)'},
  {id:'Xb7hH8MSUJpSbSDYk0k2', name:'Alice — Educator (F)'},
  {id:'XrExE9yKIg1WjnnlVkGX', name:'Matilda — Professional (F)'},
  {id:'cgSgspJ2msm6clMCkdW9', name:'Jessica — Playful (F)'},
  {id:'pFZP5JQG7iQjIQuC4Bku', name:'Lily — Velvety (F)'},
  {id:'9BWtsMINqrJLrRacOk9x', name:'Aria — Expressive (F)'},
  {id:'XB0fDUnXU5powFXDhCwa', name:'Charlotte — Warm (F)'},
  {id:'Ize3IdZnUBMNsAGSM6fR', name:'Emily — Calm (F)'},
  {id:'jsCqWAovK2LkecY7zXl4', name:'Freya — Oversharing (F)'},
]

const OPENAI_VOICES = [
  {id:'alloy',   name:'Alloy — Neutral'},
  {id:'echo',    name:'Echo — Male'},
  {id:'fable',   name:'Fable — Expressive'},
  {id:'onyx',    name:'Onyx — Deep Male'},
  {id:'nova',    name:'Nova — Female'},
  {id:'shimmer', name:'Shimmer — Soft Female'},
]


const TONES = ['professional','inspirational','casual','urgent','educational','promotional']

const PLAT_COLORS = {
  facebook:'#1877f2',instagram:'#e1306c',twitter:'#1da1f2',x:'#000',
  tiktok:'#010101',youtube:'#ff0000',telegram:'#0088cc',linkedin:'#0077b5',
  pinterest:'#e60023',reddit:'#ff4500',discord:'#5865f2',
}
const ICON_SLUG = {
  facebook:'facebook', facebook_group:'facebook',
  instagram:'instagram', instagram_reel:'instagram', instagram_story:'instagram',
  instagram_business:'instagram',
  x:'x', twitter:'x',
  linkedin:'linkedin', linkedin_page:'linkedin',
  youtube:'youtube', tiktok:'tiktok', telegram:'telegram',
  pinterest:'pinterest', reddit:'reddit', threads:'threads',
  whatsapp:'whatsapp', whatsapp_channel:'whatsapp', whatsapp_broadcast:'whatsapp',
  discord:'discord', snapchat:'snapchat',
  bluesky:'bluesky', mastodon:'mastodon',
  google_business:'google', dribbble:'dribbble',
  slack:'slack', kick:'kick', twitch:'twitch',
  farcaster:'farcaster', nostr:'nostr', vk:'vk',
  medium:'medium', devto:'devdotto', hashnode:'hashnode',
  wordpress:'wordpress', listmonk:'listmonk',
  lemmy:'lemmy', mewe:'mewe', skool:'skool',
}


// Register all fonts with Quill
const Font = Quill.import('formats/font')
Font.whitelist = ['sans-serif','serif','monospace','arial','georgia','verdana','trebuchet','times-new-roman','courier-new','palatino','garamond','bookman','comic-sans','impact','lucida','tahoma','helvetica']
Quill.register(Font, true)

const Size = Quill.import('attributors/style/size')
Size.whitelist = ['10px','11px','12px','13px','14px','15px','16px','18px','20px','22px','24px','26px','28px','32px','36px','42px','48px','56px','64px','72px']
Quill.register(Size, true)

const QUILL_MODULES = {
  toolbar: [
    [{ font: ['sans-serif','serif','monospace','arial','georgia','verdana','trebuchet','times-new-roman','courier-new','palatino','garamond','comic-sans','impact','tahoma','helvetica'] }],
    [{ size: ['10px','11px','12px','13px','14px','15px','16px','18px','20px','22px','24px','26px','28px','32px','36px','42px','48px'] }],
    ['bold', 'italic', 'underline', 'strike'],
    [{ color: [] }, { background: [] }],
    [{ align: [] }],
    ['link', 'blockquote'],
    ['clean'],
  ],
}

const QUILL_FORMATS = ['font','size','bold','italic','underline','strike','color','background','align','link','blockquote']

// Returns #000 or #fff — whichever contrasts better against bgHex
function contrastColor(hex) {
  const h = hex.replace('#','')
  const r=parseInt(h.slice(0,2),16), g=parseInt(h.slice(2,4),16), b=parseInt(h.slice(4,6),16)
  return (0.299*r + 0.587*g + 0.114*b) / 255 > 0.55 ? '#000000' : '#ffffff'
}

function AccountAvatar({ conn, selected, onClick }) {
  const rawColor = PLAT_COLORS[conn.key_name] || conn.color || '#888888'
  const color    = /^#[0-9a-fA-F]{6}$/.test(rawColor) ? rawColor : '#888888'
  const hexSlug  = color.replace('#','')
  const initials = (conn.account_name || '?').slice(0,2).toUpperCase()
  const shortName = (conn.account_name || '').slice(0,13)
  const badgeContrast = contrastColor(color)
  const slug = ICON_SLUG[conn.key_name] || conn.key_name || 'circle'
  return (
    <div onClick={onClick} title={conn.account_name + ' (' + conn.platform_name + ')'}
      style={{ position:'relative', cursor:'pointer', userSelect:'none', display:'flex', flexDirection:'column', alignItems:'center', gap:4, minWidth:58, flexShrink:0 }}>
      {/* Main 48px avatar — neutral bg, brand-coloured icon */}
      <div style={{
        width:48, height:48, borderRadius:'50%', background:'var(--bg3)',
        display:'flex', alignItems:'center', justifyContent:'center',
        border: selected ? `2px solid ${color}` : '2px solid var(--border)',
        boxShadow: selected ? `0 0 0 3px ${color}28` : 'none',
        opacity: selected ? 1 : 0.5, transition:'all .15s', overflow:'hidden', position:'relative',
      }}>
        {conn.picture
          ? <img src={conn.picture} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}} onError={e=>e.target.style.display='none'} />
          : <img
              src={`https://cdn.simpleicons.org/${slug}/${hexSlug}`}
              alt={conn.key_name}
              style={{width:'52%',height:'52%',objectFit:'contain'}}
              onError={e=>{e.target.style.display='none';e.target.insertAdjacentHTML('afterend',`<span style="font-size:13px;font-weight:700;color:${color}">${initials}</span>`)}}
            />
        }
      </div>
      {/* Platform badge dot — platform colour with contrast-safe icon */}
      <div style={{
        position:'absolute', top:31, right:0, width:16, height:16, borderRadius:'50%',
        background:color, border:'2px solid var(--bg)',
        display:'flex', alignItems:'center', justifyContent:'center',
      }}>
        <img
          src={`https://cdn.simpleicons.org/${slug}/${badgeContrast.replace('#','')}`}
          alt=""
          style={{width:'9px',height:'9px',objectFit:'contain'}}
          onError={e=>{e.target.style.display='none';e.target.insertAdjacentHTML('afterend',`<span style="font-size:7px;font-weight:800;color:${badgeContrast}">${(conn.key_name||'?')[0].toUpperCase()}</span>`)}}
        />
      </div>
      <span style={{ fontSize:9, color: selected ? 'var(--text1)' : 'var(--text3)', textAlign:'center', lineHeight:1.2, maxWidth:56, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{shortName}</span>
    </div>
  )
}


export default function ComposePage() {
  const { id }   = useParams()
  const navigate = useNavigate()
  const qc       = useQueryClient()
  const isEdit   = !!id

  const [siteId,      setSiteId]      = useState('')
  const [caption,     setCaption]     = useState('')
  const [captionHtml, setCaptionHtml] = useState('')
  const [connections, setConnections] = useState([])
  const [segmentId,   setSegmentId]   = useState('')   // WhatsApp audience (contact segment)
  const [schedDate,   setSchedDate]   = useState(null)
  const [linkUrl,     setLinkUrl]     = useState('')
  const [notes,       setNotes]       = useState('')
  const [showAI,      setShowAI]      = useState(false)
  const [aiTone,      setAiTone]      = useState('professional')
  const [aiTopic,     setAiTopic]     = useState('')
  const [aiPlatform,  setAiPlatform]  = useState('instagram')
  const [aiLoading,   setAiLoading]   = useState(false)
  const [mediaIds,    setMediaIds]    = useState([])
  const [showMedia,   setShowMedia]   = useState(false)
  const [showImgAI,   setShowImgAI]   = useState(false)
  const [showVoice,   setShowVoice]   = useState(false)
  const [voiceProvider, setVoiceProvider] = useState('openai-tts')
  const [elVoiceId,     setElVoiceId]     = useState('CwhRBWXzGAHq8TQ4Fs17')
  const [openaiVoice,   setOpenaiVoice]   = useState('alloy')
  const [showVideo,   setShowVideo]   = useState(false)
  const [imgPrompt,   setImgPrompt]   = useState('')
  const [voiceText,   setVoiceText]   = useState('')
  const [videoPrompt, setVideoPrompt] = useState('')
  const [aiMediaLoading, setAiMediaLoading] = useState(false)
  const [videoTaskId, setVideoTaskId] = useState(null)
  const [generatedImages, setGeneratedImages] = useState([])
  const [generatedVoice, setGeneratedVoice] = useState(null)
  const [generatedVideo, setGeneratedVideo] = useState(null)
  const [videoStatus, setVideoStatus] = useState(null)
  const [showSched,      setShowSched]      = useState(false)
  const [showThread,     setShowThread]     = useState(false)
  const [threadTweets,   setThreadTweets]   = useState(['',''])
  const [showImgEdit,    setShowImgEdit]    = useState(false)
  const [showCanva,      setShowCanva]      = useState(false)
  const [canvaDesigns,   setCanvaDesigns]   = useState([])
  const [canvaLoading,   setCanvaLoading]   = useState(false)
  const [canvaConnected, setCanvaConnected] = useState(false)
  const [editingImg,     setEditingImg]     = useState(null)
  const [imgBrightness, setImgBrightness]  = useState(100)
  const [imgContrast,   setImgContrast]    = useState(100)
  const [imgSaturate,   setImgSaturate]    = useState(100)
  const [showWatermark,  setShowWatermark]  = useState(false)
  const [wmLogoUrl,      setWmLogoUrl]      = useState('')
  const [wmPosition,     setWmPosition]     = useState('bottom-right')
  const [wmOpacity,      setWmOpacity]      = useState(70)
  const [wmScale,        setWmScale]        = useState(20)
  const [wmProcessing,   setWmProcessing]   = useState(false)
  const [wmResult,       setWmResult]       = useState(null)
  const [firstComment,setFirstComment] = useState('')
  const [showFirstComment, setShowFirstComment] = useState(false)
  const [linkUrl2,    setLinkUrl2]    = useState('')
  const [utmSource,   setUtmSource]   = useState('flomipost')
  const [utmMedium,   setUtmMedium]   = useState('social')
  const [utmCampaign, setUtmCampaign] = useState('')
  const [shortUrl,    setShortUrl]    = useState('')
  const [showUtm,     setShowUtm]     = useState(false)
  const [campaignId,  setCampaignId]  = useState('')
  const [expandedGroup, setExpandedGroup] = useState(null)  // key_name of expanded platform group
  const [mobileView,    setMobileView]    = useState('edit') // 'edit' | 'preview' — mobile-only pane toggle
  const topBarRef = useRef(null)
  const expandedPanelRef = useRef(null)

  // Close dropdown when clicking outside the top bar
  useEffect(() => {
    const handler = e => {
      if (topBarRef.current && !topBarRef.current.contains(e.target) &&
          expandedPanelRef.current && !expandedPanelRef.current.contains(e.target)) {
        setExpandedGroup(null)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const { data: sitesRes }       = useQuery({ queryKey:['sites'],       queryFn: sitesApi.list })
  const { data: platformsRes }   = useQuery({ queryKey:['platforms'],   queryFn: platformsApi.list })
  const { data: connectionsRes } = useQuery({ queryKey:['connections'], queryFn: () => connectionsApi.list() })
  const { data: mediaRes }       = useQuery({ queryKey:['media'],       queryFn: () => mediaApi.list({}) })
  const { data: postRes }        = useQuery({ queryKey:['post', id],    queryFn: () => postsApi.get(id), enabled:!!id })
  const { data: campaignsRes }   = useQuery({ queryKey:['campaigns'],         queryFn: () => api.get('/campaigns') })
  const campaigns = campaignsRes?.data ?? []
  const { data: setsRes }        = useQuery({ queryKey:['sets', siteId], queryFn: () => api.get('/sets?site_id='+siteId), enabled: !!siteId })
  const sets = setsRes?.data ?? []
  const { data: waSegRes }       = useQuery({ queryKey:['wa-segments', siteId], queryFn: () => api.get('/whatsapp/segments?site_id='+siteId), enabled: !!siteId })

  const sites     = sitesRes?.data ?? []
  const allPlats  = platformsRes?.data ?? []
  const allConns  = connectionsRes?.data ?? []
  const mediaList = mediaRes?.data ?? []
  // Filter connections by selected site; fall back to all if no site selected
  const siteConns = (() => {
    const filtered = siteId ? allConns.filter(c => String(c.site_id) === String(siteId)) : allConns
    // Add site_label to connections with duplicate account names
    const nameCounts = {}
    filtered.forEach(c => { nameCounts[c.account_name] = (nameCounts[c.account_name]||0)+1 })
    const siteMap = {}
    sites.forEach(s => { siteMap[s.id] = s.name })
    return filtered.map(c => ({
      ...c,
      display_name: nameCounts[c.account_name] > 1
        ? c.account_name + ' (' + (siteMap[c.site_id] || 'Site '+c.site_id) + ')'
        : c.account_name
    }))
  })()
  const waSegments = waSegRes?.data ?? []
  const hasWhatsApp = connections.some(id => {
    const c = siteConns.find(cc => String(cc.id) === String(id))
    return c && String(c.key_name || '').startsWith('whatsapp')
  })
  // Which Set (if any) exactly matches the current account selection — so the dropdown shows it
  const activeSetId = (() => {
    const cur = [...connections].map(String).sort()
    if (!cur.length) return ''
    const m = sets.find(st => {
      let ids = []
      try { ids = (JSON.parse(st.connection_ids || '[]') || []).map(String).sort() } catch {}
      return ids.length === cur.length && ids.every((v, i) => v === cur[i])
    })
    return m ? String(m.id) : ''
  })()

  useEffect(() => {
    if (postRes?.data) {
      const p = postRes.data
      setSiteId(String(p.site_id))
      setCaption(p.caption)
      setCaptionHtml(p.caption)
      setConnections(p.targets.map(t => String(t.connection_id)).filter(Boolean))
      if (p.segment_id) setSegmentId(String(p.segment_id))
      setLinkUrl(p.link_url || '')
      setNotes(p.notes || '')
      setMediaIds(p.media_ids || [])
      if (p.scheduled_at) { setSchedDate(new Date(p.scheduled_at)); setShowSched(true) }
    }
  }, [postRes])

  useEffect(() => { setConnections([]); setSegmentId('') }, [siteId])

  // Handle Canva OAuth callback
  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    if (p.get('oauth_success') === 'canva') {
      window.history.replaceState({}, '', window.location.pathname)
      if (window.opener) {
        window.opener.postMessage({type:'canva_connected'}, '*')
        window.close()
        return
      }
    }
  }, [])

  // Listen for Canva connection message from popup
  useEffect(() => {
    const handler = e => {
      if (e.data?.type === 'canva_connected') {
        setCanvaConnected(true)
        api.get('/canva/designs').then(d => setCanvaDesigns(d.data?.designs||[]))
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [])

  // Auto-select site if only one exists
  useEffect(() => {
    if (sites.length === 1 && !siteId) setSiteId(String(sites[0].id))
  }, [sites])

  // Prefill caption from Blog→Social "Send to Compose"
  useEffect(() => {
    if (id) return
    try {
      const raw = sessionStorage.getItem('fp_compose_prefill')
      if (raw) {
        const d = JSON.parse(raw)
        if (d.caption) { setCaption(d.caption); setCaptionHtml(d.caption) }
        sessionStorage.removeItem('fp_compose_prefill')
        toast.success('Loaded from Blog → Social. Pick accounts and schedule.')
      }
    } catch {}
  }, [])

  const handleQuillChange = (html, delta, source, editor) => {
    setCaptionHtml(html)
    setCaption(editor.getText().trim())
  }

  // Apply a saved Set: select all of its accounts that belong to this site
  const applySet = (setId) => {
    const s = sets.find(x => String(x.id) === String(setId))
    if (!s) return
    let ids = []
    try { ids = JSON.parse(s.connection_ids || '[]') } catch {}
    const valid = ids.map(String).filter(cid => siteConns.some(c => String(c.id) === cid))
    setConnections(valid)
    if (!valid.length) toast.error(`"${s.name}" has no accounts on this site`)
    else if (valid.length < ids.length) toast(`Selected ${valid.length} (some accounts aren't on this site)`, { icon:'⚠️' })
    else toast.success(`Selected ${valid.length} accounts from "${s.name}"`)
  }

  const saveMutation = useMutation({
    mutationFn: (data) => isEdit ? postsApi.update(id, data) : postsApi.create(data),
    onSuccess: async (res, vars) => {
      qc.invalidateQueries({ queryKey: ['posts-recent'] })
      // If publishing now (no schedule date, not draft), call publish-now endpoint
      if (!vars._asDraft && !vars.scheduled_at) {
        const newId = res?.data?.id || id
        if (newId) {
          try {
            await postsApi.publishNow(newId)
            toast.success('Post sent for publishing!')
          } catch(e) { toast.error('Saved but publish failed: ' + e.message) }
        }
      } else {
        toast.success(isEdit ? 'Post updated!' : vars.scheduled_at ? 'Post scheduled!' : 'Post saved as draft!')
      }
      if (!isEdit) navigate('/posts')
    },
    onError: (err) => toast.error(err.message),
  })

  const publishNowMutation = useMutation({
    mutationFn: () => postsApi.publishNow(id),
    onSuccess: () => { toast.success('Publishing now!'); qc.invalidateQueries({ queryKey:['queue'] }) },
    onError: (err) => toast.error(err.message),
  })

  const toggleConn = (cid) => setConnections(p => p.includes(cid) ? p.filter(x => x !== cid) : [...p, cid])

  const handleSave = (asDraft = false) => {
    if (!siteId)             return toast.error('Select a site')
    if (!caption.trim())     return toast.error('Caption is required')
    if (!connections.length) return toast.error('Select at least one account')
    const isScheduled = !asDraft && schedDate
    saveMutation.mutate({
      site_id: parseInt(siteId), caption,
      caption_raw: captionHtml,
      connection_ids: connections.map(Number),
      segment_id: (hasWhatsApp && segmentId) ? parseInt(segmentId) : null,
      scheduled_at: isScheduled ? schedDate.toISOString() : null,
      link_url: linkUrl || null, notes: notes || null, media_ids: mediaIds,
      status: asDraft ? 'draft' : (isScheduled ? 'scheduled' : 'queued'),
      _asDraft: asDraft,
    })
  }

  const generateImage = async () => {
    if (!imgPrompt.trim()) return toast.error('Enter an image prompt')
    setAiMediaLoading(true)
    try {
      const res = await api.post('/ai/generate-image', { prompt: imgPrompt, size: '1024x1024' })
      const url = res.data.url
      const mediaId = res.data.media_id
      if (!url) throw new Error('No image URL returned')
      // Add to generated images list to show in composer
      setGeneratedImages(prev => [...prev, { url, prompt: imgPrompt, mediaId }])
      // Attach to post media_ids if we have a media record
      if (mediaId) setMediaIds(prev => [...prev, mediaId])
      toast.success('Image generated and attached!')
      setShowImgAI(false); setImgPrompt('')
    } catch(e) { toast.error('Image failed: ' + e.message) }
    finally { setAiMediaLoading(false) }
  }

  const generateVoice = async (voiceName='alloy') => {
    const text = voiceText || caption
    if (!text.trim()) return toast.error('Write a caption first or enter text')
    setAiMediaLoading(true)
    try {
      const res = await api.post('/ai/generate-voice', { text: text.slice(0, 20000), voice: voiceName })
      setGeneratedVoice(res.data.url); if(res.data?.media_id){ setMediaIds(p=>[...new Set([...p, res.data.media_id])]) }
      toast.success('Voice generated and attached!')
      setShowVoice(false)
    } catch(e) { toast.error('Voice failed: ' + e.message) }
    finally { setAiMediaLoading(false) }
  }

  const generateVideo = async () => {
    if (!videoPrompt.trim() && !caption.trim()) return toast.error('Enter a video prompt')
    const provider = document.getElementById('videoProvider')?.value || 'gemini'
    const prompt = videoPrompt || caption

    // Endpoint + status endpoint per provider
    const ENDPOINTS = {
      gemini:  ['/ai/generate-video',  '/ai/video-status'],
      runway:  ['/ai/runway-video',    '/ai/runway-status'],
      kling:   ['/ai/kling-video',     '/ai/kling-status'],
      luma:    ['/ai/luma-video',      '/ai/luma-status'],
      invideo: ['/ai/invideo-video',   '/ai/invideo-status'],
    }
    const [genEp, statusEp] = ENDPOINTS[provider] || ENDPOINTS.gemini

    setAiMediaLoading(true)
    try {
      const res = await api.post(genEp, { prompt, duration: 5 })
      // InVideo may return video directly
      if (res.data?.url && res.data?.status === 'SUCCEEDED') {
        toast.success('Video ready!'); setGeneratedVideo(res.data.url); setShowVideo(false); setAiMediaLoading(false); return
      }
      const taskId = res.data?.task_id
      if (!taskId) { toast.error('No task ID returned'); setAiMediaLoading(false); return }
      setVideoTaskId(taskId); setVideoStatus('pending')
      toast.success(`${provider.toUpperCase()} video generation started!`)
      const poll = setInterval(async () => {
        try {
          const s = await api.post(statusEp, { task_id: taskId })
          setVideoStatus(s.data.status)
          if (s.data.status === 'SUCCEEDED') {
            clearInterval(poll); toast.success('Video ready!')
            setGeneratedVideo(s.data.url); if(s.data?.media_id){setMediaIds(p=>[...new Set([...p,s.data.media_id])])}
            setShowVideo(false); setAiMediaLoading(false)
          } else if (s.data.status === 'FAILED') {
            clearInterval(poll); toast.error('Video generation failed: '+(s.data.error||'')); setAiMediaLoading(false)
          }
        } catch(e) { clearInterval(poll); setAiMediaLoading(false) }
      }, 5000)
    } catch(e) { toast.error('Video failed: ' + e.message); setAiMediaLoading(false) }
  }


  const applyWatermark = async (imageUrl) => {
    if (!imageUrl) return toast.error('No image selected to watermark')
    setWmProcessing(true)
    try {
      const res = await api.post('/media/watermark', {
        image_url: imageUrl,
        logo_url:  wmLogoUrl || null,
        position:  wmPosition,
        opacity:   wmOpacity,
        scale:     wmScale,
      })
      setWmResult(res.data.image_base64)
      toast.success('Watermark applied!')
    } catch(e) { toast.error(e.message) } finally { setWmProcessing(false) }
  }

  const shortenLink = async () => {
    if (!linkUrl.trim()) return toast.error('Enter a link URL first')
    try {
      const res = await api.post('/links/shorten', {
        url: linkUrl, utm_source: utmSource, utm_medium: utmMedium, utm_campaign: utmCampaign
      })
      setShortUrl(res.data.short_url)
      setLinkUrl(res.data.short_url)
      toast.success('Link shortened!')
    } catch(e) { toast.error(e.message) }
  }

  const generateCaption = async () => {
    if (!aiTopic.trim()) return toast.error('Enter a topic first')
    setAiLoading(true)
    try {
      const res = await aiApi.generate({ platform:aiPlatform, tone:aiTone, topic:aiTopic, brand:sites.find(s=>String(s.id)===siteId)?.name||'' })
      setCaption(res.data.caption)
      setCaptionHtml(res.data.caption)
      toast.success('Caption generated!'); setShowAI(false)
    } catch(e) { toast.error(e.message) } finally { setAiLoading(false) }
  }

  const improveCaption = async (ins) => {
    if (!caption.trim()) return toast.error('Write a caption first')
    setAiLoading(true)
    try {
      const res = await aiApi.improve(caption, ins)
      setCaption(res.data.caption); setCaptionHtml(res.data.caption); toast.success('Done!')
    } catch(e) { toast.error(e.message) } finally { setAiLoading(false) }
  }

  return (
    <div className="fp-compose-root" style={{ height:'calc(100vh - 60px)', display:'flex', flexDirection:'column', overflow:'hidden', position:'relative' }}>

      {/* Top bar — site selector + platform icons + action buttons */}
      <div ref={topBarRef} className="fp-compose-topbar" style={{ padding:'8px 12px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:10, background:'var(--surface)', flexShrink:0, flexWrap:'wrap' }}>
        {/* Site selector */}
        <select className="fp-select" value={siteId} onChange={e=>setSiteId(e.target.value)}
          style={{ width:150, fontSize:12, padding:'5px 8px', flexShrink:0 }}>
          <option value="">Select site…</option>
          {sites.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        {campaigns.length > 0 && (
          <select className="fp-select" value={campaignId} onChange={e=>setCampaignId(e.target.value)}
            style={{ width:140, fontSize:12, padding:'5px 8px', flexShrink:0 }}>
            <option value="">No campaign</option>
            {campaigns.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        )}
        {sets.length > 0 && (
          <select className="fp-select" value={activeSetId} title="Set = a saved group of YOUR accounts to publish from"
            onChange={e=>{ if(e.target.value) applySet(e.target.value) }}
            style={{ width:200, fontSize:12, padding:'5px 8px', flexShrink:0 }}>
            <option value="">Use a Set (accounts)…</option>
            {sets.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
        {hasWhatsApp && (
          <select className="fp-select" value={segmentId} onChange={e=>setSegmentId(e.target.value)}
            title="Segment = which WhatsApp contacts RECEIVE this message"
            style={{ width:170, fontSize:12, padding:'5px 8px', flexShrink:0, border:'1.5px solid #25D366' }}>
            <option value="">WhatsApp: all contacts</option>
            {waSegments.map(sg=>(
              <option key={sg.id} value={sg.id}>👥 {sg.name}{sg.contact_count!=null?` (${sg.contact_count})`:''}</option>
            ))}
          </select>
        )}

        {/* Platform icons — grouped by platform, scrollable */}
        <div style={{ flex:1, minWidth:0, display:'flex', gap:12, overflowX:'auto', alignItems:'center',
          scrollbarWidth:'none', msOverflowStyle:'none', padding:'2px 4px' }}>
          {siteConns.length === 0 && (
            <span style={{ fontSize:12, color:'var(--text3)', whiteSpace:'nowrap' }}>
              {siteId ? 'No accounts — connect in Settings' : 'Select a site'}
            </span>
          )}
          {/* Group by key_name, then render each group */}
          {(() => {
            const order = [...new Set(siteConns.map(c => c.key_name))]
            return order.map(keyName => {
              const group = siteConns.filter(c => c.key_name === keyName)
              const platColor = PLAT_COLORS[keyName] || group[0]?.color || '#888888'
              const slug = ICON_SLUG[keyName] || keyName || 'circle'
              const allGroupSelected = group.every(c => connections.includes(String(c.id)))
              const someGroupSelected = group.some(c => connections.includes(String(c.id)))
              return (
                <div key={keyName} style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:3, flexShrink:0 }}>
                  {/* Platform icon — single click toggles all, badge click expands dropdown */}
                  <div style={{ position:'relative' }}>
                    <button
                      onClick={() => {
                        if (group.length === 1) {
                          const id = String(group[0].id)
                          setConnections(p => p.includes(id) ? p.filter(x=>x!==id) : [...p, id])
                          setExpandedGroup(null)
                        } else {
                          setExpandedGroup(g => g === keyName ? null : keyName)
                        }
                      }}
                      title={`${group[0]?.platform_name || keyName} (${group.length} account${group.length>1?'s':''})`}
                      style={{
                        width:34, height:34, borderRadius:'50%', border:'none', cursor:'pointer',
                        padding:0, flexShrink:0, transition:'all .15s',
                        background: allGroupSelected ? platColor : someGroupSelected ? `${platColor}55` : 'var(--bg3)',
                        boxShadow: allGroupSelected
                          ? `0 0 0 2px ${platColor}, 0 0 0 4px ${platColor}30`
                          : someGroupSelected ? `0 0 0 2px ${platColor}88` : `0 0 0 1.5px var(--border)`,
                        display:'flex', alignItems:'center', justifyContent:'center',
                        opacity: siteId ? 1 : 0.35, position:'relative',
                      }}>
                      <img
                        src={`https://cdn.simpleicons.org/${slug}`}
                        alt={keyName}
                        style={{
                          width:18, height:18, objectFit:'contain',
                          filter: allGroupSelected ? 'brightness(0) invert(1)' : 'opacity(0.75)',
                          transition:'filter .15s',
                        }}
                        onError={e=>{ e.target.style.display='none'; e.target.parentNode.insertAdjacentHTML('beforeend',
                          `<span style="font-size:11px;font-weight:800;color:${allGroupSelected?'#fff':platColor}">${(keyName||'?')[0].toUpperCase()}</span>`) }}
                      />
                      {/* Count badge */}
                      {group.length > 1 && (
                        <span style={{
                          position:'absolute', top:-3, right:-3, width:14, height:14,
                          background: expandedGroup===keyName ? platColor : allGroupSelected ? 'var(--text1)' : platColor,
                          color:'#fff', borderRadius:'50%', fontSize:8, fontWeight:800,
                          display:'flex', alignItems:'center', justifyContent:'center',
                          border:'1.5px solid var(--bg)',
                        }}>{group.length}</span>
                      )}
                    </button>

                    {/* Dropdown — individual accounts */}
                    {expandedGroup === keyName && group.length > 1 && (
                      <div style={{
                        position:'absolute', top:42, left:'50%', transform:'translateX(-50%)',
                        background:'var(--surface)', border:'1.5px solid var(--border)',
                        borderRadius:10, padding:'8px 10px', zIndex:200,
                        boxShadow:'0 8px 24px rgba(0,0,0,.18)',
                        minWidth:170, display:'flex', flexDirection:'column', gap:4,
                      }}>
                        {/* Arrow tip */}
                        <div style={{
                          position:'absolute', top:-7, left:'50%',
                          width:12, height:12, background:'var(--surface)',
                          border:'1.5px solid var(--border)', borderBottom:'none', borderRight:'none',
                          transform:'translateX(-50%) rotate(45deg)',
                        }}/>
                        <div style={{ fontSize:10, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.06em', marginBottom:4, paddingBottom:4, borderBottom:'1px solid var(--border)' }}>
                          {group[0]?.platform_name || keyName}
                          <button onClick={()=>setExpandedGroup(null)} style={{ float:'right', background:'none', border:'none', cursor:'pointer', color:'var(--text3)', fontSize:12, lineHeight:1 }}>×</button>
                        </div>
                        {/* Select/Deselect all row */}
                        <div style={{ display:'flex', gap:4, marginBottom:2 }}>
                          <button onClick={()=>setConnections(p=>[...new Set([...p,...group.map(c=>String(c.id))])])}
                            style={{ flex:1, fontSize:10, fontWeight:700, padding:'3px 6px', background:`${platColor}18`, color:platColor, border:`1px solid ${platColor}44`, borderRadius:6, cursor:'pointer' }}>All</button>
                          <button onClick={()=>setConnections(p=>p.filter(x=>!group.map(c=>String(c.id)).includes(x)))}
                            style={{ flex:1, fontSize:10, fontWeight:700, padding:'3px 6px', background:'var(--bg3)', color:'var(--text3)', border:'1px solid var(--border)', borderRadius:6, cursor:'pointer' }}>None</button>
                        </div>
                        {group.map(c => {
                          const isSel = connections.includes(String(c.id))
                          return (
                            <label key={c.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'5px 6px', borderRadius:7, cursor:'pointer', background: isSel ? `${platColor}12` : 'transparent', transition:'background .12s' }}>
                              <input type="checkbox" checked={isSel}
                                onChange={e=>{ e.stopPropagation(); const id=String(c.id); setConnections(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id]) }}
                                style={{ accentColor:platColor, width:13, height:13, cursor:'pointer' }}/>
                              <span style={{ fontSize:12, fontWeight: isSel?600:400, color: isSel?'var(--text1)':'var(--text2)', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                                {c.display_name || c.account_name || c.platform_name}
                              </span>
                            </label>
                          )
                        })}
                      </div>
                    )}
                  </div>
                  {/* Platform name label */}
                  <span style={{ fontSize:8, color:'var(--text3)', fontWeight:600,
                    textTransform:'uppercase', letterSpacing:'.03em',
                    maxWidth:38, textAlign:'center', lineHeight:1.1,
                    overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {(group[0]?.platform_name || keyName).replace(/ .*/,'')}
                  </span>
                </div>
              )
            })
          })()}
          {siteConns.length > 1 && (
            <button onClick={()=>connections.length===siteConns.length
              ? setConnections([]) : setConnections(siteConns.map(c=>String(c.id)))}
              style={{ fontSize:11, fontWeight:700, color:'var(--primary)', background:'none',
                border:'1px solid var(--border)', borderRadius:20, cursor:'pointer',
                padding:'3px 10px', whiteSpace:'nowrap', flexShrink:0, alignSelf:'center' }}>
              {connections.length===siteConns.length ? 'None' : 'All'}
            </button>
          )}
        </div>

        {/* Action buttons */}
        <div className="fp-compose-actions" style={{ display:'flex', gap:6, flexShrink:0 }}>
          <button className="fp-btn fp-btn-ghost fp-btn-sm fp-mobile-only" onClick={()=>setMobileView(v=>v==='edit'?'preview':'edit')}>
            {mobileView==='edit' ? 'Preview' : 'Edit'}
          </button>
          {isEdit && <button className="fp-btn fp-btn-ghost fp-btn-sm" onClick={()=>publishNowMutation.mutate()}><Send size={13}/></button>}
          <button className="fp-btn fp-btn-ghost fp-btn-sm" onClick={()=>handleSave(true)}><Save size={13}/> Draft</button>
          <button className="fp-btn fp-btn-primary fp-btn-sm" onClick={()=>handleSave(false)} disabled={saveMutation.isPending}>
            <Clock size={13}/> {schedDate ? 'Schedule' : 'Post'}
          </button>
        </div>
      </div>

      {/* Platform account picker — shown below top bar when a grouped icon is clicked */}
      {expandedGroup && (() => {
        const group = siteConns.filter(c => c.key_name === expandedGroup)
        if (!group.length) return null
        const platColor = PLAT_COLORS[expandedGroup] || group[0]?.color || '#888888'
        return (
          <div ref={expandedPanelRef} onClick={e=>e.stopPropagation()} style={{
            background:'var(--surface)', borderBottom:'2px solid var(--border)',
            padding:'10px 16px', display:'flex', alignItems:'center', gap:10, flexWrap:'wrap',
            flexShrink:0, animation:'fadeIn .15s ease',
          }}>
            <span style={{ fontSize:12, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'.06em', marginRight:4 }}>
              {group[0]?.platform_name || expandedGroup}
            </span>
            <button onClick={()=>setConnections(p=>[...new Set([...p,...group.map(c=>String(c.id))])])}
              style={{ fontSize:11, fontWeight:700, padding:'3px 10px', background:`${platColor}15`, color:platColor, border:`1px solid ${platColor}40`, borderRadius:20, cursor:'pointer' }}>All</button>
            <button onClick={()=>setConnections(p=>p.filter(x=>!group.map(c=>String(c.id)).includes(x)))}
              style={{ fontSize:11, fontWeight:700, padding:'3px 10px', background:'var(--bg3)', color:'var(--text3)', border:'1px solid var(--border)', borderRadius:20, cursor:'pointer' }}>None</button>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap', flex:1 }}>
              {group.map(c => {
                const isSel = connections.includes(String(c.id))
                return (
                  <label key={c.id} onClick={e=>e.stopPropagation()} style={{ display:'flex', alignItems:'center', gap:6, padding:'5px 10px', borderRadius:20, cursor:'pointer',
                    background: isSel ? `${platColor}15` : 'var(--bg3)',
                    border: isSel ? `1.5px solid ${platColor}` : '1.5px solid var(--border)',
                    transition:'all .12s' }}>
                    <input type="checkbox" checked={isSel}
                      onChange={e=>{ e.stopPropagation(); const id=String(c.id); setConnections(p=>p.includes(id)?p.filter(x=>x!==id):[...p,id]) }}
                      style={{ accentColor:platColor, width:13, height:13, cursor:'pointer' }}/>
                    <span style={{ fontSize:12, fontWeight: isSel?700:400, color: isSel?platColor:'var(--text2)', whiteSpace:'nowrap' }}>
                      {c.display_name || c.account_name || c.platform_name}
                    </span>
                  </label>
                )
              })}
            </div>
            <button onClick={()=>setExpandedGroup(null)}
              style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text3)', fontSize:18, lineHeight:1, padding:'0 4px' }}>×</button>
          </div>
        )
      })()}

      {/* Body */}
      <style>{`
        /* The Edit/Preview toggle only appears once the layout is single-column. */
        .fp-mobile-only { display: none; }

        /* Tablet/narrow: single column; let the preview be toggled into view
           (the two-class selector beats index.css's .fp-compose-preview hide). */
        @media (max-width: 900px) {
          .fp-compose-body { grid-template-columns: 1fr !important; }
          .fp-compose-preview { display: none !important; }
          .fp-compose-preview.show { display: flex !important; }
          .fp-compose-left.hide-mobile { display: none !important; }
          .fp-mobile-only { display: inline-flex; }
        }

        /* Phone/tablet: stop forcing a viewport-tall, clipped box. Let the page
           flow and scroll so the bottom toolbar + Post buttons stay reachable,
           and let the crowded top bar wrap instead of shoving buttons off-screen. */
        @media (max-width: 768px) {
          .fp-compose-root { height: auto !important; min-height: calc(100vh - 92px); overflow: visible !important; }
          .fp-compose-body { overflow: visible !important; max-height: none !important; }
          .fp-compose-left { overflow: visible !important; }
          .fp-compose-topbar > .fp-select { flex: 1 1 140px; width: auto !important; }
          .fp-compose-actions { margin-left: auto; }
          .fp-quill .ql-toolbar { flex-wrap: wrap; }
          .fp-quill .ql-editor { min-height: 200px; }
        }
      `}</style>
      <div className="fp-compose-body" style={{ flex:1, display:'grid', gridTemplateColumns:'1fr 340px', overflow:'hidden', minHeight:0, maxHeight:'100%' }}>

        {/* Left */}
        <div className={`fp-compose-left${mobileView==='preview' ? ' hide-mobile' : ''}`} style={{ display:'flex', flexDirection:'column', borderRight:'1px solid var(--border)', overflowX:'hidden', overflowY:'auto', minHeight:0 }}>



          {/* Rich text editor */}
          <div style={{ flex:1, display:'flex', flexDirection:'column', overflow:'hidden', minHeight:0 }}>
            <style>{`
              .fp-quill .ql-toolbar { background: var(--surface); border-color: var(--border) !important; border-left:none !important; border-right:none !important; }
              .fp-quill .ql-container { border-color: var(--border) !important; border-left:none !important; border-right:none !important; border-bottom:none !important; background: var(--bg); flex:1; min-height:0; }
              .fp-quill .ql-editor { color: var(--text1); font-size:14px; line-height:1.6; min-height:200px; }
              .fp-quill .ql-editor.ql-blank::before { color: var(--text3); font-style:normal; }
              .fp-quill .ql-stroke { stroke: var(--text2) !important; }
              .fp-quill .ql-fill { fill: var(--text2) !important; }
              .fp-quill .ql-picker-label { color: var(--text2) !important; }
              .fp-quill { display:flex; flex-direction:column; flex:1; min-height:0; }
            `}</style>
            <ReactQuill
              className="fp-quill"
              theme="snow"
              value={captionHtml}
              onChange={handleQuillChange}
              modules={QUILL_MODULES}
              formats={QUILL_FORMATS}
              placeholder="Write something…"
            />
          </div>

          {/* AI Panel */}
          {showAI && (
            <div style={{ padding:'12px 20px', background:'var(--surface)', borderTop:'1px solid var(--border)', flexShrink:0 }}>
              <div style={{ fontWeight:700, fontSize:12, color:'var(--gold)', marginBottom:10, display:'flex', alignItems:'center', gap:6 }}><Sparkles size={13}/> AI Caption</div>
              <input className="fp-input" placeholder="Topic / brief…" value={aiTopic} onChange={e=>setAiTopic(e.target.value)} style={{ marginBottom:8, fontSize:12 }}/>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:10 }}>
                <select className="fp-select" value={aiPlatform} onChange={e=>setAiPlatform(e.target.value)} style={{ fontSize:12 }}>
                  {allPlats.map(p=><option key={p.key_name} value={p.key_name}>{p.name}</option>)}
                </select>
                <select className="fp-select" value={aiTone} onChange={e=>setAiTone(e.target.value)} style={{ fontSize:12 }}>
                  {TONES.map(t=><option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
                </select>
              </div>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap', marginBottom:10 }}>
                {['Add hashtags','Shorter','Add CTA','More engaging'].map(ins=>(
                  <button key={ins} className="fp-ai-btn" onClick={()=>improveCaption(ins)} disabled={aiLoading}>{ins}</button>
                ))}
              </div>
              <button className="fp-btn fp-btn-primary fp-btn-sm" onClick={generateCaption} disabled={aiLoading}><Sparkles size={12}/> {aiLoading?'Generating…':'Generate'}</button>
            </div>
          )}

          {/* Media panel */}
          {showMedia && (
            <div style={{ padding:'12px 20px', background:'var(--surface)', borderTop:'1px solid var(--border)', maxHeight:240, overflowY:'auto', flexShrink:0 }}>
              {/* Upload button */}
              <div style={{ marginBottom:10, display:'flex', gap:8, alignItems:'center' }}>
                <label style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'6px 14px', background:'var(--primary)', color:'#fff', borderRadius:8, cursor:'pointer', fontSize:12, fontWeight:700 }}>
                  <Upload size={13}/> Upload from Computer
                  <input type="file" multiple accept="image/*,video/*,audio/*" style={{ display:'none' }}
                    onChange={async e => {
                      const files = Array.from(e.target.files)
                      if (!files.length) return
                      for (const file of files) {
                        try {
                          const fd = new FormData()
                          fd.append('file', file)
                          const r = await fetch('/api/media/upload', { method:'POST', body:fd, credentials:'include' })
                          const d = await r.json()
                          if (d.data?.id) {
                            setMediaIds(p=>[...new Set([...p, d.data.id])])
                            toast.success(file.name + ' uploaded!')
                          }
                        } catch(err) { toast.error('Upload failed: ' + file.name) }
                      }
                    }}
                  />
                </label>
                <span style={{ fontSize:11, color:'var(--text3)' }}>or select from library below</span>
              </div>
              {mediaList.length===0
                ? <div style={{ fontSize:12, color:'var(--text3)' }}>No media in library yet.</div>
                : <div className="fp-media-grid">{mediaList.map(m=>(
                    <div key={m.id} className={`fp-media-item${mediaIds.includes(m.id)?' selected':''}`}
                      onClick={()=>setMediaIds(p=>p.includes(m.id)?p.filter(x=>x!==m.id):[...p,m.id])}>
                      <img src={m.url} alt="" loading="lazy"/>
                    </div>
                  ))}</div>
              }
            </div>
          )}

          {/* Selected media strip */}
          {mediaIds.length > 0 && (
            <div style={{ padding:'8px 20px', borderTop:'1px solid var(--border)', display:'flex', gap:8, overflowX:'auto', flexShrink:0 }}>
              {mediaIds.map(mid => {
                const m = mediaList.find(x=>x.id===mid)
                return m ? (
                  <div key={mid} style={{ position:'relative', flexShrink:0, width:60, height:60, borderRadius:6, overflow:'hidden', border:'1px solid var(--border)' }}>
                    <img src={m.url} alt="" style={{ width:'100%',height:'100%',objectFit:'cover' }}/>
                    <button onClick={()=>setMediaIds(p=>p.filter(x=>x!==mid))}
                      style={{ position:'absolute',top:2,right:2,background:'rgba(0,0,0,.7)',border:'none',color:'#fff',borderRadius:3,cursor:'pointer',width:16,height:16,fontSize:10,display:'flex',alignItems:'center',justifyContent:'center' }}>×</button>
                  </div>
                ) : null
              })}
            </div>
          )}

          {/* AI Image panel */}
          {showImgAI && (
            <div id="ai-img-panel" style={{ padding:'12px 20px', background:'var(--surface)', borderTop:'1px solid var(--border)', flexShrink:0 }}>
              <div style={{ fontWeight:700, fontSize:12, color:'var(--gold)', marginBottom:10, display:'flex', alignItems:'center', gap:6 }}><Image size={13}/> AI Image Generation</div>
              <div style={{ display:'flex', gap:8 }}>
                <input className="fp-input" placeholder="Describe the image..." value={imgPrompt} onChange={e=>setImgPrompt(e.target.value)} style={{ flex:1, fontSize:12 }}/>
                <button className="fp-btn fp-btn-primary fp-btn-sm" onClick={generateImage} disabled={aiMediaLoading}>
                  {aiMediaLoading ? <><Loader size={12}/> Generating…</> : <><Image size={12}/> Generate</>}
                </button>
              </div>
            </div>
          )}

          {/* Voice panel */}
          {showVoice && (
            <div style={{ padding:'12px 20px', background:'var(--surface)', borderTop:'1px solid var(--border)', flexShrink:0 }}>
              <div style={{ fontWeight:700, fontSize:12, color:'var(--gold)', marginBottom:10, display:'flex', alignItems:'center', gap:6 }}><Mic size={13}/> AI Voice Generation</div>
              <div style={{ display:'flex', gap:8, marginBottom:8 }}>
                <select className="fp-select" style={{fontSize:12}} value={voiceProvider} onChange={e=>setVoiceProvider(e.target.value)}>
                  <option value="openai-tts">OpenAI TTS</option>
                  <option value="elevenlabs">ElevenLabs</option>
                </select>
                {voiceProvider==='elevenlabs' && (
                  <select className="fp-select" style={{flex:1,fontSize:12}} value={elVoiceId} onChange={e=>setElVoiceId(e.target.value)}>
                    {EL_VOICES.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>
                )}
                {voiceProvider==='openai-tts' && (
                  <select className="fp-select" style={{flex:1,fontSize:12}} value={openaiVoice} onChange={e=>setOpenaiVoice(e.target.value)}>
                    {OPENAI_VOICES.map(v=><option key={v.id} value={v.id}>{v.name}</option>)}
                  </select>
                )}
              </div>
              <div style={{ fontSize:12, color:'var(--text3)', marginBottom:8 }}>Leave blank to use your caption text</div>
              <div style={{ display:'flex', gap:8 }}>
                <input className="fp-input" placeholder="Or enter custom text..." value={voiceText} onChange={e=>setVoiceText(e.target.value)} style={{ flex:1, fontSize:12 }}/>
                <button className="fp-btn fp-btn-primary fp-btn-sm" onClick={async()=>{
                  if(voiceProvider==='elevenlabs'){
                    setAiMediaLoading(true)
                    try{
                      const res = await api.post('/ai/elevenlabs-tts',{text:(voiceText||caption).slice(0,20000),voice_id:elVoiceId})
                      setGeneratedVoice(res.data.url); setShowVoice(false)
                      if(res.data.media_id) { setMediaIds(p=>[...new Set([...p, res.data.media_id])]); toast.success('Voice saved to Media Library!') }
                    }catch(e){toast.error(e.message)}
                    finally{setAiMediaLoading(false)}
                  } else { generateVoice(openaiVoice) }
                }} disabled={aiMediaLoading}>
                  {aiMediaLoading ? <><Loader size={12}/> Generating…</> : <><Mic size={12}/> Generate</>}
                </button>
              </div>
            </div>
          )}

          {/* Video panel */}
          {showVideo && (
            <div style={{ padding:'12px 20px', background:'var(--surface)', borderTop:'1px solid var(--border)', flexShrink:0 }}>
              <div style={{ fontWeight:700, fontSize:12, color:'var(--gold)', marginBottom:10, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <div style={{display:'flex',alignItems:'center',gap:6}}><Video size={13}/> AI Video Generation</div>
                <select className="fp-select" style={{width:160,fontSize:11,padding:'3px 8px'}} id="videoProvider">
                  <option value="gemini">Google Veo 2</option>
                  <option value="runway">Runway Gen-3</option>
                  <option value="kling">Kling AI</option>
                  <option value="luma">Luma Dream Machine</option>
                  <option value="invideo">InVideo AI</option>
                </select>
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <input className="fp-input" placeholder="Describe the video (or uses caption)..." value={videoPrompt} onChange={e=>setVideoPrompt(e.target.value)} style={{ flex:1, fontSize:12 }}/>
                <button className="fp-btn fp-btn-primary fp-btn-sm" onClick={generateVideo} disabled={aiMediaLoading}>
                  {aiMediaLoading ? <><Loader size={12}/> {videoStatus==='pending'?'Processing...':'Starting…'}</> : <><Video size={12}/> Generate</>}
                </button>
              </div>
              {videoTaskId && videoStatus && (
                <div style={{ marginTop:8, fontSize:11, color:'var(--text3)' }}>
                  Task: {videoTaskId} · Status: <strong>{videoStatus}</strong>
                </div>
              )}
            </div>
          )}

          {/* Generated AI media */}
          {(generatedImages.length > 0 || generatedVoice || generatedVideo) && (
            <div style={{ padding:'8px 20px', borderTop:'1px solid var(--border)', flexShrink:0, background:'var(--surface)' }}>
              <div style={{ fontSize:11, color:'var(--text3)', marginBottom:6, fontWeight:600 }}>AI Generated Media</div>
              <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
                {generatedImages.map((img,i) => (
                  <div key={i} style={{ position:'relative', width:70, height:70, borderRadius:8, overflow:'hidden', border:'2px solid var(--primary)', flexShrink:0 }}>
                    <img src={img.url} alt={img.prompt} style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
                    <button onClick={()=>setGeneratedImages(p=>p.filter((_,j)=>j!==i))} style={{ position:'absolute',top:2,right:2,background:'rgba(0,0,0,.7)',border:'none',color:'#fff',borderRadius:3,cursor:'pointer',width:16,height:16,fontSize:10,display:'flex',alignItems:'center',justifyContent:'center' }}>×</button>
                  </div>
                ))}
                {generatedVoice && (
                  <div style={{ flex:1, minWidth:200 }}>
                    <audio controls src={generatedVoice} style={{ height:36, width:'100%' }}/>
                    <div style={{ display:'flex', gap:8, marginTop:4 }}>
                      <a href={generatedVoice} download="voice.mp3" style={{ fontSize:11, fontWeight:600, color:'var(--violet)', textDecoration:'none' }}>↓ Download</a>
                      <button onClick={()=>setGeneratedVoice(null)} style={{ fontSize:11, color:'var(--coral)', background:'none', border:'none', cursor:'pointer' }}>Remove</button>
                    </div>
                  </div>
                )}
                {generatedVideo && (
                  <div style={{ flex:1, minWidth:200 }}>
                    <video controls src={generatedVideo} style={{ maxHeight:120, borderRadius:8, border:'2px solid var(--primary)', width:'100%' }}/>
                    <div style={{ display:'flex', gap:8, marginTop:4 }}>
                      <a href={generatedVideo} download="video.mp4" style={{ fontSize:11, fontWeight:600, color:'var(--violet)', textDecoration:'none' }}>↓ Download</a>
                      <button onClick={()=>setGeneratedVideo(null)} style={{ fontSize:11, color:'var(--coral)', background:'none', border:'none', cursor:'pointer' }}>Remove</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Bottom toolbar */}
          <div style={{ padding:'8px 12px', borderTop:'1px solid var(--border)', display:'flex', gap:6, alignItems:'center', background:'var(--surface)', flexShrink:0, flexWrap:'wrap' }}>
            <button className="fp-btn fp-btn-ghost fp-btn-sm" onClick={()=>{setShowMedia(v=>!v);setShowAI(false);setShowImgAI(false);setShowVoice(false);setShowVideo(false)}}><Image size={13}/> Media</button>
            <button className="fp-btn fp-btn-ghost fp-btn-sm" onClick={()=>{setShowAI(v=>!v);setShowMedia(false);setShowImgAI(false);setShowVoice(false);setShowVideo(false)}}><Sparkles size={13}/> AI Caption</button>
            <button className="fp-btn fp-btn-ghost fp-btn-sm" onClick={()=>{setShowImgAI(v=>!v);setShowAI(false);setShowMedia(false);setShowVoice(false);setShowVideo(false);setShowCanva(false);setTimeout(()=>document.getElementById('ai-img-panel')?.scrollIntoView({behavior:'smooth',block:'nearest'}),100)}}><Image size={13}/> AI Image</button>
            <button className="fp-btn fp-btn-ghost fp-btn-sm" onClick={()=>{setShowVoice(v=>!v);setShowAI(false);setShowMedia(false);setShowImgAI(false);setShowVideo(false)}}><Mic size={13}/> Voice</button>
            <button className="fp-btn fp-btn-ghost fp-btn-sm" onClick={()=>{setShowVideo(v=>!v);setShowAI(false);setShowMedia(false);setShowImgAI(false);setShowVoice(false)}}><Video size={13}/> Video</button>
            <button className="fp-btn fp-btn-ghost fp-btn-sm" onClick={()=>setShowFirstComment(v=>!v)} title="Schedule first comment (Instagram hashtags)">💬 1st Comment</button>
            <button className="fp-btn fp-btn-ghost fp-btn-sm" onClick={()=>setShowWatermark(v=>!v)} title="Add watermark to images">🔏 Watermark</button>
            {connections.some(id=>{const c=allConns.find(x=>String(x.id)===id);return c&&['x','twitter'].includes(c.key_name)}) && (
              <button className="fp-btn fp-btn-ghost fp-btn-sm" onClick={()=>setShowThread(v=>!v)} title="Post as X/Twitter thread">🧵 Thread</button>
            )}
            <button className="fp-btn fp-btn-ghost fp-btn-sm" onClick={()=>setShowImgEdit(v=>!v)} title="Edit images">✏️ Edit Image</button>
            <button className="fp-btn fp-btn-ghost fp-btn-sm" onClick={async()=>{
                setShowCanva(v=>!v)
                if(!showCanva){
                  setCanvaLoading(true)
                  try{
                    const s=await api.get('/canva/status')
                    setCanvaConnected(s.data?.connected)
                    if(s.data?.connected){
                      const d=await api.get('/canva/designs')
                      setCanvaDesigns(d.data?.designs||[])
                    }
                  }catch(e){}finally{setCanvaLoading(false)}
                }
              }} title="Import from Canva">🎨 Canva</button>
            <button className="fp-btn fp-btn-ghost fp-btn-sm" onClick={()=>setShowUtm(v=>!v)} title="UTM & link shortener">🔗 UTM</button>
            <div style={{ flex:1 }}/>
            <span style={{ fontSize:11, color:'var(--text3)' }}>{caption.length} chars</span>
          </div>

          {/* First comment panel */}
          {showFirstComment && (
            <div style={{ padding:'10px 20px', background:'var(--surface)', borderTop:'1px solid var(--border)', flexShrink:0 }}>
              <div style={{ fontSize:12, fontWeight:700, color:'var(--violet)', marginBottom:6 }}>💬 First Comment — Instagram hashtags or extra text</div>
              <input className="fp-input" placeholder="e.g. #faith #ministry #blessed #gospel" value={firstComment} onChange={e=>setFirstComment(e.target.value)} style={{ fontSize:13 }}/>
              <div style={{ fontSize:11, color:'var(--text3)', marginTop:4 }}>Will post as the first comment immediately after publishing (Facebook & Instagram)</div>
            </div>
          )}

          {/* Watermark panel */}
          {showWatermark && (
            <div style={{ padding:'12px 20px', background:'var(--surface)', borderTop:'1px solid var(--border)', flexShrink:0 }}>
              <div style={{ fontSize:12, fontWeight:700, color:'var(--violet)', marginBottom:10 }}>🔏 Image Watermark</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:10 }}>
                <div>
                  <label className="fp-label">Position</label>
                  <select className="fp-select" value={wmPosition} onChange={e=>setWmPosition(e.target.value)} style={{fontSize:12}}>
                    {['top-left','top-right','bottom-left','bottom-right','center'].map(p=>(
                      <option key={p} value={p}>{p.replace('-',' ')}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="fp-label">Opacity ({wmOpacity}%)</label>
                  <input type="range" min={10} max={100} value={wmOpacity} onChange={e=>setWmOpacity(+e.target.value)}
                    style={{width:'100%',marginTop:6,accentColor:'var(--violet)'}}/>
                </div>
                <div>
                  <label className="fp-label">Logo Size ({wmScale}%)</label>
                  <input type="range" min={5} max={50} value={wmScale} onChange={e=>setWmScale(+e.target.value)}
                    style={{width:'100%',marginTop:6,accentColor:'var(--violet)'}}/>
                </div>
              </div>
              <div style={{ display:'flex', gap:8, marginBottom:8 }}>
                <input className="fp-input" placeholder="Logo URL (leave blank for text watermark)"
                  value={wmLogoUrl} onChange={e=>setWmLogoUrl(e.target.value)} style={{flex:1,fontSize:12}}/>
              </div>
              {mediaIds.length > 0 ? (
                <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                  {mediaIds.map(mid=>{
                    const m = mediaList.find(x=>x.id===mid)
                    return m ? (
                      <button key={mid} className="fp-btn fp-btn-primary fp-btn-sm"
                        onClick={()=>applyWatermark(m.url)} disabled={wmProcessing}>
                        {wmProcessing ? 'Processing…' : `Watermark ${m.url.split('/').pop().slice(0,20)}`}
                      </button>
                    ) : null
                  })}
                </div>
              ) : (
                <div style={{fontSize:12,color:'var(--text3)'}}>Select images from Media first, then apply watermark</div>
              )}
              {wmResult && (
                <div style={{marginTop:10}}>
                  <div style={{fontSize:11,fontWeight:700,color:'var(--green)',marginBottom:6}}>✅ Watermarked preview:</div>
                  <img src={wmResult} alt="watermarked" style={{maxWidth:'100%',maxHeight:180,borderRadius:8,border:'2px solid var(--green)'}}/>
                  <a href={wmResult} download="watermarked.png"
                    style={{display:'inline-block',marginTop:6,fontSize:12,fontWeight:700,color:'var(--violet)'}}>
                    ↓ Download watermarked image
                  </a>
                </div>
              )}
            </div>
          )}


          {/* Image Edit panel */}
          {showImgEdit && (
            <div style={{ padding:'12px 20px', background:'var(--surface)', borderTop:'1px solid var(--border)', flexShrink:0 }}>
              <div style={{ fontSize:12, fontWeight:700, color:'var(--blue)', marginBottom:10 }}>✏️ Edit Image</div>
              {mediaIds.length === 0 ? (
                <div style={{fontSize:12,color:'var(--text3)'}}>Upload an image in Media first, then edit it here.</div>
              ) : (
                <div style={{display:'flex', flexDirection:'column', gap:10}}>
                  {mediaIds.map(mid => {
                    const m = mediaList.find(x => x.id === mid)
                    if (!m || !m.url.match(/\.(jpg|jpeg|png|gif|webp)/i)) return null
                    return (
                      <div key={mid} style={{display:'flex', gap:10, alignItems:'flex-start', flexWrap:'wrap'}}>
                        <img src={m.url} alt="" style={{width:80, height:80, objectFit:'cover', borderRadius:8, border:'1px solid var(--border)'}}/>
                        <div style={{display:'flex', flexDirection:'column', gap:6, flex:1, minWidth:200}}>
                          <div style={{fontSize:11, color:'var(--text3)', marginBottom:2}}>{m.url.split('/').pop()}</div>
                          <div style={{display:'flex', gap:6, flexWrap:'wrap'}}>
                            <a href={`/api/media/edit?id=${mid}&action=crop`} target="_blank" rel="noreferrer"
                              className="fp-btn fp-btn-ghost fp-btn-sm" style={{fontSize:11}}>✂️ Crop</a>
                            <button className="fp-btn fp-btn-ghost fp-btn-sm" style={{fontSize:11}}
                              onClick={async()=>{
                                try{
                                  const r = await api.post('/ai/remove-background',{media_id:mid})
                                  if(r.data?.url){ toast.success('Background removed!'); setMediaIds(p=>[...new Set([...p,r.data.media_id||mid])]) }
                                }catch(e){toast.error(e.message)}
                              }}>🪄 Remove BG</button>
                            <button className="fp-btn fp-btn-ghost fp-btn-sm" style={{fontSize:11}}
                              onClick={async()=>{
                                try{
                                  const r = await api.post('/ai/enhance-image',{media_id:mid})
                                  if(r.data?.url){ toast.success('Image enhanced!') }
                                }catch(e){toast.error('Enhancement: '+e.message)}
                              }}>✨ Enhance</button>
                            <a href={m.url} download target="_blank" rel="noreferrer"
                              className="fp-btn fp-btn-ghost fp-btn-sm" style={{fontSize:11}}>⬇️ Download</a>
                          </div>
                          <div style={{display:'flex', gap:6, alignItems:'center', flexWrap:'wrap'}}>
                            <span style={{fontSize:11,color:'var(--text3)'}}>Resize:</span>
                            {[['1:1','1080x1080'],['16:9','1920x1080'],['9:16','1080x1920'],['4:5','1080x1350']].map(([label,size])=>(
                              <button key={label} className="fp-btn fp-btn-ghost fp-btn-sm" style={{fontSize:10,padding:'3px 7px'}}
                                onClick={async()=>{
                                  try{
                                    const [w,h] = size.split('x')
                                    const r = await api.post('/ai/resize-image',{media_id:mid, width:+w, height:+h})
                                    if(r.data?.media_id){ setMediaIds(p=>[...new Set([...p,r.data.media_id])]); toast.success(`Resized to ${label}`) }
                                  }catch(e){toast.error(e.message)}
                                }}>{label}</button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Canva panel */}
          {showCanva && (
            <div style={{ padding:'12px 20px', background:'var(--surface)', borderTop:'1px solid var(--border)', flexShrink:0 }}>
              <div style={{ fontSize:12, fontWeight:700, color:'var(--violet)', marginBottom:10, display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <span>🎨 Canva Designs</span>
                <div style={{display:'flex',gap:6}}>
                  {canvaConnected && (
                    <a href="https://www.canva.com/" target="_blank" rel="noreferrer"
                      className="fp-btn fp-btn-ghost fp-btn-sm" style={{fontSize:11}}>
                      + Create New
                    </a>
                  )}
                  {!canvaConnected && (
                    <button className="fp-btn fp-btn-primary fp-btn-sm" onClick={()=>window.open('/api/oauth/canva/start','canva_oauth','width=600,height=700')}>
                      Connect Canva
                    </button>
                  )}
                </div>
              </div>
              {canvaLoading ? <div style={{fontSize:12,color:'var(--text3)'}}>Loading…</div> :
                !canvaConnected ? (
                  <div style={{fontSize:12,color:'var(--text3)'}}>Connect your Canva account to import designs directly into this post.</div>
                ) : canvaDesigns.length === 0 ? (
                  <div style={{fontSize:12,color:'var(--text3)'}}>No designs found. Create one in Canva first.</div>
                ) : (
                  <div style={{display:'flex',gap:8,overflowX:'auto',paddingBottom:8}}>
                    {canvaDesigns.map(d=>(
                      <div key={d.id} style={{flexShrink:0,cursor:'pointer',borderRadius:8,overflow:'hidden',border:'1.5px solid var(--border)',width:100}}
                        onClick={async()=>{
                          try{
                            const imgUrl=d.thumbnail?.url
                            if(!imgUrl){toast.error('No thumbnail');return}
                            const res=await api.post('/canva/import',{image_url:imgUrl,design_id:d.id})
                            if(res.data?.media_id) setMediaIds(p=>[...new Set([...p,res.data.media_id])])
                            toast.success('Imported from Canva!')
                            setShowCanva(false)
                          }catch(e){toast.error(e.message)}
                        }}>
                        {d.thumbnail?.url
                          ? <img src={d.thumbnail.url} alt={d.title} style={{width:'100%',height:70,objectFit:'cover'}}/>
                          : <div style={{width:'100%',height:70,background:'var(--bg3)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:10,color:'var(--text3)'}}>No preview</div>}
                        <div style={{fontSize:9,padding:'3px 5px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',color:'var(--text2)'}}>{d.title||'Untitled'}</div>
                      </div>
                    ))}
                  </div>
                )
              }
            </div>
          )}

          {/* UTM + link shortener panel */}
          {showUtm && (
            <div style={{ padding:'12px 20px', background:'var(--surface)', borderTop:'1px solid var(--border)', flexShrink:0 }}>
              <div style={{ fontSize:12, fontWeight:700, color:'var(--violet)', marginBottom:10 }}>🔗 Link Shortener + UTM Tracking</div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom:8 }}>
                <div>
                  <label className="fp-label">UTM Source</label>
                  <input className="fp-input" value={utmSource} onChange={e=>setUtmSource(e.target.value)} placeholder="flomipost" style={{ fontSize:12 }}/>
                </div>
                <div>
                  <label className="fp-label">UTM Medium</label>
                  <input className="fp-input" value={utmMedium} onChange={e=>setUtmMedium(e.target.value)} placeholder="social" style={{ fontSize:12 }}/>
                </div>
                <div>
                  <label className="fp-label">UTM Campaign</label>
                  <input className="fp-input" value={utmCampaign} onChange={e=>setUtmCampaign(e.target.value)} placeholder="campaign name" style={{ fontSize:12 }}/>
                </div>
              </div>
              <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                <input className="fp-input" placeholder="Paste your link here to shorten + add UTM" value={linkUrl} onChange={e=>setLinkUrl(e.target.value)} style={{ flex:1, fontSize:12 }}/>
                <button className="fp-btn fp-btn-primary fp-btn-sm" onClick={shortenLink}>Shorten</button>
              </div>
              {shortUrl && <div style={{ marginTop:8, fontSize:12, color:'var(--green)', fontWeight:600 }}>✅ Short link: {shortUrl}</div>}
            </div>
          )}

          {/* Link + schedule bar */}
          <div style={{ padding:'10px 20px', borderTop:'1px solid var(--border)', background:'var(--surface)', display:'flex', gap:8, alignItems:'center', flexWrap:'wrap', flexShrink:0 }}>
            <input className="fp-input" placeholder="Link URL (optional)" value={linkUrl} onChange={e=>setLinkUrl(e.target.value)} style={{ flex:1, minWidth:160, fontSize:12 }}/>
            <button className="fp-btn fp-btn-ghost fp-btn-sm" onClick={()=>setShowSched(v=>!v)}>
              <Clock size={13}/> {schedDate ? format(schedDate,"MMM d HH:mm") : 'Schedule'} <ChevronDown size={11}/>
            </button>
          </div>
          {showSched && (
            <div style={{ padding:'0 20px 12px', background:'var(--surface)', flexShrink:0 }}>
              <DatePicker selected={schedDate} onChange={d=>{setSchedDate(d);if(!d)setShowSched(false)}}
                showTimeSelect timeFormat="HH:mm" timeIntervals={15}
                dateFormat="MMM d, yyyy HH:mm" placeholderText="Pick date & time…"
                className="fp-input" minDate={new Date()} isClearable inline/>
            </div>
          )}
        </div>

        {/* Right — preview */}
        <div className={`fp-compose-preview${mobileView==='preview' ? ' show' : ''}`} style={{ display:'flex', flexDirection:'column', background:'var(--surface)', overflow:'hidden', minHeight:0 }}>
          <div style={{ padding:'14px 16px', borderBottom:'1px solid var(--border)', fontSize:13, fontWeight:700, flexShrink:0 }}>Post Preview</div>
          <div style={{ flex:1, overflowY:'auto', padding:'12px 16px' }}>
            {!caption.trim()
              ? <div style={{ textAlign:'center', marginTop:40 }}>
                  <div style={{ fontSize:28, marginBottom:8 }}>✏️</div>
                  <div style={{ fontSize:13, color:'var(--text3)', fontWeight:500 }}>Start writing to see a preview</div>
                </div>
              : connections.length === 0
              ? <div style={{ textAlign:'center', marginTop:40 }}>
                  <div style={{ fontSize:28, marginBottom:8 }}>👆</div>
                  <div style={{ fontSize:13, color:'var(--text3)', fontWeight:500 }}>Select a platform icon above<br/>to preview your post</div>
                </div>
              : <>
                  {connections.some(id=>{const c=allConns.find(x=>String(x.id)===id);return c?.key_name==='facebook'}) && (
                    <div style={{ background:'var(--bg)', border:'1px solid var(--border)', borderRadius:10, padding:14, marginBottom:12 }}>
                      <div style={{ fontSize:10, color:'var(--text3)', marginBottom:6, fontWeight:600 }}>FACEBOOK</div>
                      <div style={{ fontSize:13, lineHeight:1.5 }} dangerouslySetInnerHTML={{ __html: captionHtml }}/>
                      {mediaIds.length>0 && mediaList.find(m=>m.id===mediaIds[0]) && (
                        <img src={mediaList.find(m=>m.id===mediaIds[0]).url} alt="" style={{ width:'100%',borderRadius:6,marginTop:8,objectFit:'cover',maxHeight:180 }}/>
                      )}
                    </div>
                  )}
                  {connections.some(id=>{const c=allConns.find(x=>String(x.id)===id);return c?.key_name==='instagram'}) && (
                    <div style={{ background:'var(--bg)', border:'1px solid var(--border)', borderRadius:10, padding:14, marginBottom:12 }}>
                      <div style={{ fontSize:10, color:'var(--text3)', marginBottom:6, fontWeight:600 }}>INSTAGRAM</div>
                      {mediaIds.length>0 && mediaList.find(m=>m.id===mediaIds[0]) && (
                        <img src={mediaList.find(m=>m.id===mediaIds[0]).url} alt="" style={{ width:'100%',borderRadius:6,marginBottom:8,objectFit:'cover',maxHeight:200 }}/>
                      )}
                      <div style={{ fontSize:13, lineHeight:1.5 }} dangerouslySetInnerHTML={{ __html: captionHtml }}/>
                    </div>
                  )}
                  {connections.some(id=>{const c=allConns.find(x=>String(x.id)===id);return c&&['x','twitter'].includes(c.key_name)}) && (
                    <div style={{ background:'var(--bg)', border:'1px solid var(--border)', borderRadius:10, padding:14, marginBottom:12 }}>
                      <div style={{ fontSize:10, color:'var(--text3)', marginBottom:6, fontWeight:600, display:'flex', alignItems:'center', gap:6 }}>
                        <span style={{ width:8, height:8, borderRadius:'50%', background:'#000', display:'inline-block' }}/>X / TWITTER
                      </div>
                      <div style={{ fontSize:14, lineHeight:1.6 }}>{caption.slice(0,280)}{caption.length>280?'…':''}</div>
                      {caption.length > 0 && <div style={{ fontSize:11, color: caption.length>280?'var(--coral)':'var(--text3)', marginTop:6 }}>{caption.length}/280</div>}
                    </div>
                  )}
                  {connections.some(id=>{const c=allConns.find(x=>String(x.id)===id);return c&&['linkedin','linkedin_page'].includes(c.key_name)}) && (
                    <div style={{ background:'var(--bg)', border:'1px solid var(--border)', borderRadius:10, padding:14, marginBottom:12 }}>
                      <div style={{ fontSize:10, color:'var(--text3)', marginBottom:8, fontWeight:600, display:'flex', alignItems:'center', gap:6 }}>
                        <span style={{ width:8, height:8, borderRadius:2, background:'#0077b5', display:'inline-block' }}/>LINKEDIN
                      </div>
                      <div style={{ fontSize:14, lineHeight:1.6 }}>{caption.slice(0,3000)}{caption.length>3000?'…':''}</div>
                      {mediaIds.length>0 && mediaList.find(m=>m.id===mediaIds[0]) && (
                        <img src={mediaList.find(m=>m.id===mediaIds[0]).url} alt="" style={{ width:'100%',borderRadius:6,marginTop:8,objectFit:'cover',maxHeight:200 }}/>
                      )}
                    </div>
                  )}
                  {connections.some(id=>{const c=allConns.find(x=>String(x.id)===id);return c&&c.key_name==='tiktok'}) && (
                    <div style={{ background:'var(--bg)', border:'1px solid var(--border)', borderRadius:10, padding:14, marginBottom:12 }}>
                      <div style={{ fontSize:10, color:'var(--text3)', marginBottom:6, fontWeight:600, display:'flex', alignItems:'center', gap:6 }}>
                        <span style={{ width:8, height:8, borderRadius:'50%', background:'#010101', display:'inline-block' }}/>TIKTOK
                      </div>
                      <div style={{ fontSize:14, lineHeight:1.6 }}>{caption.slice(0,150)}{caption.length>150?'…':''}</div>
                      {generatedVideo && <video src={generatedVideo} controls style={{ width:'100%', maxHeight:200, borderRadius:8, marginTop:8 }}/>}
                    </div>
                  )}
                  {connections.some(id=>{const c=allConns.find(x=>String(x.id)===id);return c&&c.key_name==='youtube'}) && (
                    <div style={{ background:'var(--bg)', border:'1px solid var(--border)', borderRadius:10, padding:14, marginBottom:12 }}>
                      <div style={{ fontSize:10, color:'var(--text3)', marginBottom:6, fontWeight:600, display:'flex', alignItems:'center', gap:6 }}>
                        <span style={{ width:8, height:8, borderRadius:'50%', background:'#ff0000', display:'inline-block' }}/>YOUTUBE
                      </div>
                      {generatedVideo
                        ? <video src={generatedVideo} controls style={{ width:'100%', maxHeight:200, borderRadius:8, marginBottom:8 }}/>
                        : <div style={{ background:'var(--bg3)', borderRadius:8, height:100, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:8, fontSize:12, color:'var(--text3)' }}>Add a video for YouTube</div>}
                      <div style={{ fontSize:14, fontWeight:600 }}>{caption.slice(0,100)}{caption.length>100?'…':''}</div>
                    </div>
                  )}
                  {connections.some(id=>{const c=allConns.find(x=>String(x.id)===id);return c&&!['facebook','instagram','x','twitter','linkedin','linkedin_page','tiktok','youtube'].includes(c.key_name)}) && (
                    <div style={{ background:'var(--bg)', border:'1px solid var(--border)', borderRadius:10, padding:14, marginBottom:12 }}>
                      <div style={{ fontSize:10, color:'var(--text3)', marginBottom:6, fontWeight:600 }}>OTHER PLATFORMS</div>
                      <div style={{ fontSize:13, lineHeight:1.5, whiteSpace:'pre-wrap', wordBreak:'break-word' }}>{caption.slice(0,280)}{caption.length>280?'…':''}</div>
                    </div>
                  )}
                </>
            }
          </div>
          {schedDate && (
            <div style={{ padding:'10px 16px', borderTop:'1px solid var(--border)', fontSize:12, color:'var(--gold)', display:'flex', alignItems:'center', gap:6, flexShrink:0 }}>
              <Clock size={12}/> {format(schedDate,"MMM d, yyyy 'at' HH:mm")}
              <button onClick={()=>{setSchedDate(null);setShowSched(false)}} style={{ marginLeft:'auto',background:'none',border:'none',color:'var(--text3)',cursor:'pointer' }}><X size={12}/></button>
            </div>
          )}
          <div style={{ padding:'12px 16px', borderTop:'1px solid var(--border)', display:'flex', flexDirection:'column', gap:8, flexShrink:0 }}>
            <button className="fp-btn fp-btn-primary" onClick={()=>handleSave(false)} disabled={saveMutation.isPending} style={{ justifyContent:'center', fontSize:13 }}>
              <Clock size={14}/> {schedDate?'Schedule Post':'Post Now'}
            </button>
            <button className="fp-btn fp-btn-ghost" onClick={()=>handleSave(true)} style={{ justifyContent:'center', fontSize:13 }}>
              <Save size={14}/> Save as Draft
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
