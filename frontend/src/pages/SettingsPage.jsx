import { useState, useEffect } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { settingsApi, api } from '../utils/api'
import toast from 'react-hot-toast'
import { Settings, Sparkles, Image, Mic, Video, Key, Save, CheckCircle, Loader, Code, Terminal, Copy, RefreshCw, Eye, EyeOff } from 'lucide-react'

const AI_PROVIDERS = [
  { value:'anthropic', label:'Claude (Anthropic)', models:['claude-haiku-4-5-20251001','claude-sonnet-4-6','claude-opus-4-6'] },
  { value:'openai',    label:'OpenAI (GPT)',        models:['gpt-4o-mini','gpt-4o','gpt-4-turbo'] },
  { value:'gemini',    label:'Google Gemini',       models:['gemini-1.5-flash','gemini-1.5-pro','gemini-2.0-flash'] },
]
const IMAGE_PROVIDERS = [
  { value:'dall-e',   label:'DALL-E 3 (OpenAI)',     requires:'openai' },
  { value:'gemini',   label:'Imagen (Google Gemini)', requires:'gemini' },
]
const VOICE_PROVIDERS = [
  { value:'openai-tts', label:'OpenAI TTS', voices:[
    {id:'alloy',label:'Alloy'},{id:'echo',label:'Echo'},{id:'fable',label:'Fable'},
    {id:'onyx',label:'Onyx'},{id:'nova',label:'Nova'},{id:'shimmer',label:'Shimmer'},
  ]},
  { value:'elevenlabs', label:'ElevenLabs', voices:[
    {id:'CwhRBWXzGAHq8TQ4Fs17',label:'Roger — Laid-Back'},
    {id:'EXAVITQu4vr4xnSDxMaL',label:'Sarah — Mature'},
    {id:'FGY2WhTYpPnrIDTdsKH5',label:'Laura — Enthusiast'},
    {id:'IKne3meq5aSn9XLyUdCD',label:'Charlie — Deep'},
    {id:'JBFqnCBsd6RMkjVDRZzb',label:'George — Storyteller'},
    {id:'SAz9YHcvj6GT2YYXdXww',label:'River — Relaxed'},
    {id:'TX3LPaxmHKxFdv7VOQHJ',label:'Liam — Social Media'},
    {id:'Xb7hH8MSUJpSbSDYk0k2',label:'Alice — Educator'},
    {id:'XrExE9yKIg1WjnnlVkGX',label:'Matilda — Professional'},
    {id:'cgSgspJ2msm6clMCkdW9',label:'Jessica — Playful'},
    {id:'cjVigY5qzO86Huf0OWal',label:'Eric — Smooth'},
    {id:'iP95p4xoKVk53GoZ742B',label:'Chris — Charming'},
    {id:'nPczCjzI2devNBz1zQrb',label:'Brian — Deep'},
    {id:'onwK4e9ZLuTAKqWW03F9',label:'Daniel — Broadcaster'},
    {id:'pFZP5JQG7iQjIQuC4Bku',label:'Lily — Velvety'},
    {id:'uPdPVJPZIryn3WAH8mKG',label:'Moses — Storyteller'},
    {id:'EkK5I93UQWFDigLMpZcX',label:'James — Bold'},
    {id:'dPah2VEoifKnZT37774q',label:'Knox Dark — Serious'},
    {id:'sUwtOYEjCoROzbhBKwqi',label:'Moses Sam Paul — Deep'},
  ]},
]
const VIDEO_PROVIDERS = [
  { value:'gemini', label:'Google Veo 2 (Gemini)' },
  { value:'runway', label:'Runway Gen-3 Alpha Turbo' },
]

const PLATFORM_CREDS = [
  { key:'meta_app_id',           label:'Meta App ID' },
  { key:'meta_app_secret',       label:'Meta App Secret',       type:'password' },
  { key:'linkedin_client_id',    label:'LinkedIn Client ID' },
  { key:'linkedin_client_secret',label:'LinkedIn Client Secret',type:'password' },
  { key:'tiktok_client_id',      label:'TikTok Client ID' },
  { key:'tiktok_client_secret',  label:'TikTok Client Secret',  type:'password' },
  { key:'youtube_client_id',     label:'YouTube Client ID' },
  { key:'youtube_client_secret', label:'YouTube Client Secret', type:'password' },
  { key:'twitter_client_id',     label:'Twitter/X Client ID' },
  { key:'twitter_client_secret', label:'Twitter/X Client Secret',type:'password' },
  { key:'reddit_client_id',      label:'Reddit Client ID' },
  { key:'reddit_client_secret',  label:'Reddit Client Secret',  type:'password' },
  { key:'pinterest_client_id',   label:'Pinterest App ID' },
  { key:'pinterest_client_secret',label:'Pinterest App Secret', type:'password' },
]

function Section({ icon, title, children }) {
  return (
    <div className="fp-card" style={{ marginBottom:16 }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:20, paddingBottom:14, borderBottom:'1px solid var(--border)' }}>
        <div style={{ color:'var(--primary)' }}>{icon}</div>
        <div style={{ fontFamily:'Familjen Grotesk,sans-serif', fontSize:15, fontWeight:700 }}>{title}</div>
      </div>
      {children}
    </div>
  )
}

function Field({ label, hint, children }) {
  return (
    <div className="fp-field" style={{ marginBottom:16 }}>
      <label className="fp-label">{label}</label>
      {children}
      {hint && <div style={{ fontSize:11, color:'var(--text3)', marginTop:4 }}>{hint}</div>}
    </div>
  )
}

function DeveloperSection() {
  const [apiKey, setApiKey]       = useState('')
  const [roKey, setRoKey]         = useState('')
  const [revealed, setRevealed]   = useState(false)
  const [roRevealed, setRoRevealed] = useState(false)
  const [loading, setLoading]     = useState(false)
  const [roLoading, setRoLoading] = useState(false)
  const [cliTab, setCliTab]       = useState('local')
  const [authTab, setAuthTab]     = useState('cli')
  const [client, setClient]       = useState('Claude Code')
  const appUrl = window.location.origin
  const mcpUrl = appUrl + '/api/mcp'

  const key = revealed && apiKey ? apiKey : 'YOUR_RW_KEY'
  const CLIENTS = {
    'Claude Code': `claude mcp add flomipost --transport http --header "Authorization: Bearer ${key}" "${mcpUrl}"`,
    'ChatGPT': `# ChatGPT Settings → Connected Apps → Add MCP Server\n# Name: FlomiPost\n# URL: ${mcpUrl}\n# Auth Header: Authorization: Bearer ${key}`,
    'Gemini/Google': `# Google AI Studio → Tools → Add MCP\n# URL: ${mcpUrl}\n# Header: Authorization: Bearer ${key}`,
    'Cursor': `// .cursor/mcp.json\n{"mcpServers":{"flomipost":{"url":"${mcpUrl}","headers":{"Authorization":"Bearer ${key}"}}}}`,
    'VS Code/Copilot': `// .vscode/mcp.json\n{"servers":{"flomipost":{"type":"http","url":"${mcpUrl}","headers":{"Authorization":"Bearer ${key}"}}}}`,
    'Windsurf': `// windsurf mcp config\n{"mcpServers":{"flomipost":{"serverUrl":"${mcpUrl}","headers":{"Authorization":"Bearer ${key}"}}}}`,
    'Codex': `codex mcp add --url "${mcpUrl}" --header "Authorization: Bearer ${key}"`,
    'Gemini CLI': `gemini mcp add flomipost --url "${mcpUrl}" --header "Authorization: Bearer ${key}"`,
    'Warp': `# Warp → AI → MCP Servers → Add:\n# URL: ${mcpUrl}\n# Header: Authorization: Bearer ${key}`,
  }
  useEffect(() => {
    api.get('/developer/api-key').then(r => {
      setApiKey(r.data?.key || '')
      setRoKey(r.data?.readonly_key || '')
    }).catch(()=>{})
  }, [])

  const rotateKey = async () => {
    if (!window.confirm('Rotate your Read+Write key? The old key will stop working immediately.')) return
    setLoading(true)
    try { const r = await api.post('/developer/rotate-key', {scope:'write'}); setApiKey(r.data.key); toast.success('Read+Write key rotated!') }
    catch(e) { toast.error(e.message) } finally { setLoading(false) }
  }

  const rotateRoKey = async () => {
    if (!window.confirm('Rotate your Read-Only key? The old key will stop working immediately.')) return
    setRoLoading(true)
    try { const r = await api.post('/developer/rotate-key', {scope:'read'}); setRoKey(r.data.key); toast.success('Read-Only key rotated!') }
    catch(e) { toast.error(e.message) } finally { setRoLoading(false) }
  }

  const maskedKey   = apiKey ? apiKey.slice(0,10) + '•'.repeat(24) + apiKey.slice(-6) : '—'
  const maskedRoKey = roKey  ? roKey.slice(0,10)  + '•'.repeat(24) + roKey.slice(-6)  : '—'
  const tabBtn = (label, active, onClick) => (
    <button onClick={onClick} style={{padding:'6px 16px',borderRadius:6,border:'none',cursor:'pointer',
      background:active?'var(--primary)':'transparent',color:active?'#fff':'var(--text2)',
      fontSize:12,fontWeight:600,transition:'all .15s'}}>
      {label}
    </button>
  )

  return (
    <div style={{display:'flex',flexDirection:'column',gap:28}}>

      {/* API Keys - Read+Write and Read Only */}
      <div>
        <div style={{fontWeight:700,fontSize:14,marginBottom:4}}>API Keys</div>
        <div style={{fontSize:12,color:'var(--text3)',marginBottom:16}}>Use these keys to connect FlomiPost to external tools, AI agents, and automations.</div>

        {/* Read+Write Key */}
        <div style={{background:'var(--bg2)',borderRadius:10,padding:16,marginBottom:12,border:'1px solid var(--border)'}}>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
            <span style={{background:'#7c3aed',color:'#fff',fontSize:11,fontWeight:700,padding:'2px 10px',borderRadius:20}}>READ + WRITE</span>
            <span style={{fontSize:12,color:'var(--text3)'}}>Full access — schedule posts, manage content, read analytics</span>
          </div>
          <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
            <input readOnly value={revealed ? apiKey : maskedKey}
              style={{flex:1,minWidth:220,fontFamily:'monospace',fontSize:12,padding:'8px 12px',
                background:'var(--surface)',border:'1px solid var(--border)',borderRadius:8,color:'var(--text)'}}/>
            <button className="fp-btn fp-btn-ghost fp-btn-sm" onClick={()=>setRevealed(v=>!v)}>
              {revealed ? <><EyeOff size={13}/> Hide</> : <><Eye size={13}/> Reveal</>}
            </button>
            <button className="fp-btn fp-btn-ghost fp-btn-sm" onClick={()=>{navigator.clipboard.writeText(apiKey);toast.success('Copied!')}} disabled={!apiKey}>
              <Copy size={13}/> Copy
            </button>
            <button className="fp-btn fp-btn-ghost fp-btn-sm" onClick={rotateKey} disabled={loading}>
              {loading ? <Loader size={13}/> : <RefreshCw size={13}/>} Rotate
            </button>
          </div>
        </div>

        {/* Read-Only Key */}
        <div style={{background:'var(--bg2)',borderRadius:10,padding:16,border:'1px solid var(--border)'}}>
          <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
            <span style={{background:'#059669',color:'#fff',fontSize:11,fontWeight:700,padding:'2px 10px',borderRadius:20}}>READ ONLY</span>
            <span style={{fontSize:12,color:'var(--text3)'}}>Safe for analytics tools — can read posts and data, cannot create or modify</span>
          </div>
          <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap'}}>
            <input readOnly value={roRevealed ? roKey : maskedRoKey}
              style={{flex:1,minWidth:220,fontFamily:'monospace',fontSize:12,padding:'8px 12px',
                background:'var(--surface)',border:'1px solid var(--border)',borderRadius:8,color:'var(--text)'}}/>
            <button className="fp-btn fp-btn-ghost fp-btn-sm" onClick={()=>setRoRevealed(v=>!v)}>
              {roRevealed ? <><EyeOff size={13}/> Hide</> : <><Eye size={13}/> Reveal</>}
            </button>
            <button className="fp-btn fp-btn-ghost fp-btn-sm" onClick={()=>{navigator.clipboard.writeText(roKey);toast.success('Copied!')}} disabled={!roKey}>
              <Copy size={13}/> Copy
            </button>
            <button className="fp-btn fp-btn-ghost fp-btn-sm" onClick={rotateRoKey} disabled={roLoading}>
              {roLoading ? <Loader size={13}/> : <RefreshCw size={13}/>} Rotate
            </button>
          </div>
        </div>
      </div>

      {/* CLI & AI Skills */}
      <div>
        <div style={{fontWeight:700,fontSize:14,marginBottom:4}}>CLI & AI Skills</div>
        <div style={{fontSize:12,color:'var(--text3)',marginBottom:12}}>Use the FlomiPost CLI to automate posting from your terminal, or install the skill to let your AI agent schedule posts for you.</div>
        <div style={{display:'flex',gap:4,marginBottom:16,background:'var(--bg2)',borderRadius:8,padding:4,width:'fit-content'}}>
          {tabBtn('Locally', cliTab==='local', ()=>setCliTab('local'))}
          {tabBtn('CI / Remote servers', cliTab==='remote', ()=>setCliTab('remote'))}
        </div>
        {cliTab==='local' ? (
          <div style={{display:'flex',flexDirection:'column',gap:10}}>
            {[
              {label:'1. Set your API key', cmd:`export FLOWPOST_API_KEY="${revealed&&apiKey?apiKey:'your_key_here'}"
export FLOWPOST_URL="${appUrl}"`},
              {label:'2. Create a post via API', cmd:`curl -X POST ${appUrl}/api/posts \
  -H "Authorization: Bearer $FLOWPOST_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"caption":"Hello World","site_id":1}'`},
              {label:'3. Add FlomiPost MCP to Claude Code', cmd:`claude mcp add flomipost \
  --transport http \
  --header "Authorization: Bearer $FLOWPOST_API_KEY" \
  "${mcpUrl}"`},
            ].map(({label,cmd})=>(
              <div key={label}>
                <div style={{fontSize:11,color:'var(--text3)',marginBottom:4}}>{label}</div>
                <div style={{position:'relative'}}>
                  <pre style={{background:'#0d1117',color:'#e6edf3',padding:'10px 40px 10px 14px',borderRadius:8,fontSize:11,fontFamily:'monospace',margin:0,whiteSpace:'pre-wrap',overflowX:'auto'}}>{cmd}</pre>
                  <button onClick={()=>{navigator.clipboard.writeText(cmd);toast.success('Copied!')}}
                    className="fp-btn fp-btn-ghost fp-btn-sm" style={{position:'absolute',top:6,right:6,padding:'3px 8px',fontSize:10}}>
                    <Copy size={10}/> Copy
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div>
            <div style={{fontSize:12,color:'var(--text3)',marginBottom:10}}>Use environment variables for CI/CD pipelines:</div>
            <pre style={{background:'#0d1117',color:'#e6edf3',padding:'12px 14px',borderRadius:8,fontSize:11,fontFamily:'monospace',margin:0,whiteSpace:'pre-wrap'}}>{`FLOWPOST_API_KEY=${revealed&&apiKey?apiKey:'your_key_here'}
FLOWPOST_URL=${appUrl}`}</pre>
          </div>
        )}
      </div>

      {/* MCP Client Configuration */}
      <div>
        <div style={{fontWeight:700,fontSize:14,marginBottom:4}}>MCP Client Configuration</div>
        <div style={{fontSize:12,color:'var(--text3)',marginBottom:16}}>Connect FlomiPost MCP server to your client (HTTP streaming) to schedule your posts faster!</div>

        <div style={{marginBottom:12}}>
          <div style={{fontSize:12,fontWeight:600,marginBottom:8,color:'var(--text2)'}}>Authentication</div>
          <div style={{display:'flex',gap:4,background:'var(--bg2)',borderRadius:8,padding:4,width:'fit-content'}}>
            {tabBtn('CLI (Claude Code / Codex)', authTab==='cli', ()=>setAuthTab('cli'))}
            {tabBtn('Remote servers (ChatGPT, Claude)', authTab==='remote', ()=>setAuthTab('remote'))}
          </div>
        </div>

        <div style={{marginBottom:12}}>
          <div style={{fontSize:12,fontWeight:600,marginBottom:8,color:'var(--text2)'}}>Client</div>
          <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
            {Object.keys(CLIENTS).map(c=>(
              <button key={c} onClick={()=>setClient(c)}
                style={{padding:'5px 12px',borderRadius:6,border:'1px solid var(--border)',cursor:'pointer',fontSize:12,
                  background:client===c?'var(--primary)':'var(--bg2)',color:client===c?'#fff':'var(--text2)',fontWeight:client===c?700:400}}>
                {c}
              </button>
            ))}
          </div>
        </div>

        <div style={{fontSize:11,color:'var(--text3)',marginBottom:8}}>Run this command in your terminal.</div>
        <div style={{position:'relative'}}>
          <pre style={{background:'#0d1117',color:'#e6edf3',padding:'12px 50px 12px 14px',borderRadius:8,fontSize:11,fontFamily:'monospace',margin:0,whiteSpace:'pre-wrap',overflowX:'auto'}}>{CLIENTS[client]||''}</pre>
          <button onClick={()=>{navigator.clipboard.writeText(CLIENTS[client]||'');toast.success('Copied!')}}
            className="fp-btn fp-btn-ghost fp-btn-sm" style={{position:'absolute',top:6,right:6,padding:'3px 8px',fontSize:10}}>
            <Copy size={10}/> Copy
          </button>
        </div>

        <div style={{display:'flex',gap:8,marginTop:10}}>
          <button className="fp-btn fp-btn-ghost fp-btn-sm" onClick={()=>setRevealed(v=>!v)}>
            {revealed ? <><EyeOff size={12}/> Hide</> : <><Eye size={12}/> Reveal</>}
          </button>
          <button className="fp-btn fp-btn-ghost fp-btn-sm" onClick={()=>{navigator.clipboard.writeText(apiKey);toast.success('Copied!')}}>
            <Copy size={12}/> Copy
          </button>
          <button className="fp-btn fp-btn-ghost fp-btn-sm" onClick={()=>{navigator.clipboard.writeText(mcpUrl);toast.success('URL copied!')}}>
            <Copy size={12}/> Copy URL
          </button>
        </div>
      </div>

    </div>
  )
}

export default function SettingsPage() {
  const { data } = useQuery({ queryKey:['settings'], queryFn: settingsApi.get })
  const settings = data?.data ?? {}

  const [form, setForm] = useState({})
  useEffect(() => { if (data?.data) setForm(data.data) }, [data])

  const mut = useMutation({
    mutationFn: settingsApi.update,
    onSuccess: () => toast.success('Settings saved!'),
    onError: e => toast.error(e.message),
  })

  const set = (k,v) => setForm(f=>({...f,[k]:v}))
  const save = () => mut.mutate(form)

  const aiProvider = form.ai_provider || 'openai'
  const providerObj = AI_PROVIDERS.find(p=>p.value===aiProvider) || AI_PROVIDERS[1]

  return (
    <div>
      <div className="fp-page-header" style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:24}}>
        <div>
          <h1 className="fp-page-title">Settings</h1>
          <p className="fp-page-sub">Configure your FlomiPost platform</p>
        </div>
        <button className="fp-btn fp-btn-primary" onClick={save} disabled={mut.isPending}>
          {mut.isPending ? <><Loader size={14}/> Saving…</> : <><Save size={14}/> Save Settings</>}
        </button>
      </div>

      <Section icon={<Settings size={18}/>} title="General">
        <Field label="Site Name">
          <input className="fp-input" value={form.site_name||''} onChange={e=>set('site_name',e.target.value)} placeholder="My FlomiPost"/>
        </Field>
        <Field label="Timezone">
          <input className="fp-input" value={form.timezone||''} onChange={e=>set('timezone',e.target.value)} placeholder="America/Chicago"/>
        </Field>
      </Section>

      <Section icon={<Key size={18}/>} title="API Keys">
        <Field label="OpenAI API Key" hint="Used for AI captions, TTS voice, and DALL-E images">
          <input className="fp-input" type="password" value={form.openai_api_key||''} onChange={e=>set('openai_api_key',e.target.value)} placeholder="sk-..."/>
        </Field>
        <Field label="Anthropic API Key" hint="Used for Claude AI captions">
          <input className="fp-input" type="password" value={form.anthropic_api_key||''} onChange={e=>set('anthropic_api_key',e.target.value)} placeholder="sk-ant-..."/>
        </Field>
        <Field label="Google Gemini API Key" hint="Used for Gemini captions, Imagen, and Veo 2 video">
          <input className="fp-input" type="password" value={form.gemini_api_key||''} onChange={e=>set('gemini_api_key',e.target.value)} placeholder="AIza..."/>
        </Field>
        <Field label="ElevenLabs API Key" hint="Used for AI voice generation">
          <input className="fp-input" type="password" value={form.elevenlabs_api_key||''} onChange={e=>set('elevenlabs_api_key',e.target.value)} placeholder="sk_..."/>
        </Field>
        <Field label="Runway API Key" hint="Used for AI video generation">
          <input className="fp-input" type="password" value={form.runway_api_key||''} onChange={e=>set('runway_api_key',e.target.value)} placeholder="key_..."/>
        </Field>
        <Field label="Kling AI API Key" hint="High-quality video — klingai.com → API">
          <input className="fp-input" type="password" value={form.kling_api_key||''} onChange={e=>set('kling_api_key',e.target.value)} placeholder="kling_..."/>
        </Field>
        <Field label="Luma Dream Machine API Key" hint="Cinematic video — lumalabs.ai → API">
          <input className="fp-input" type="password" value={form.luma_api_key||''} onChange={e=>set('luma_api_key',e.target.value)} placeholder="luma_..."/>
        </Field>
        <Field label="InVideo AI API Key" hint="Full video production — invideo.ai → Settings → API">
          <input className="fp-input" type="password" value={form.invideo_api_key||''} onChange={e=>set('invideo_api_key',e.target.value)} placeholder="inv_..."/>
        </Field>
        <Field label="SendGrid API Key" hint="Used for email delivery">
          <input className="fp-input" type="password" value={form.sendgrid_api_key||''} onChange={e=>set('sendgrid_api_key',e.target.value)} placeholder="SG...."/>
        </Field>
      </Section>

      <Section icon={<Sparkles size={18}/>} title="AI Caption Generation">
        <Field label="AI Provider">
          <select className="fp-select" value={aiProvider} onChange={e=>set('ai_provider',e.target.value)}>
            {AI_PROVIDERS.map(p=><option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </Field>
        <Field label="Model">
          <select className="fp-select" value={form.ai_model||''} onChange={e=>set('ai_model',e.target.value)}>
            {providerObj.models.map(m=><option key={m} value={m}>{m}</option>)}
          </select>
        </Field>
      </Section>

      <Section icon={<Image size={18}/>} title="AI Image Generation">
        <Field label="Image Provider">
          <select className="fp-select" value={form.image_provider||'dall-e'} onChange={e=>set('image_provider',e.target.value)}>
            {IMAGE_PROVIDERS.map(p=><option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </Field>
        <Field label="Default Image Size">
          <select className="fp-select" value={form.image_size||'1024x1024'} onChange={e=>set('image_size',e.target.value)}>
            {['1024x1024','1792x1024','1024x1792'].map(s=><option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
      </Section>

      <Section icon={<Mic size={18}/>} title="AI Voice Generation">
        <Field label="Voice Provider">
          <select className="fp-select" value={form.voice_provider||'openai-tts'} onChange={e=>set('voice_provider',e.target.value)}>
            {VOICE_PROVIDERS.map(p=><option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </Field>
        <Field label="Default Voice">
          <select className="fp-select" value={form.default_voice||'alloy'} onChange={e=>set('default_voice',e.target.value)}>
            {(VOICE_PROVIDERS.find(p=>p.value===(form.voice_provider||'openai-tts'))?.voices||[]).map(v=>(
              <option key={v.id} value={v.id}>{v.label}</option>
            ))}
          </select>
        </Field>
      </Section>

      <Section icon={<Video size={18}/>} title="AI Video Generation">
        <Field label="Video Provider">
          <select className="fp-select" value={form.video_provider||'gemini'} onChange={e=>set('video_provider',e.target.value)}>
            {VIDEO_PROVIDERS.map(p=><option key={p.value} value={p.value}>{p.label}</option>)}
          </select>
        </Field>
      </Section>

      <Section icon={<Key size={18}/>} title="Platform Credentials">
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
          {PLATFORM_CREDS.map(c=>(
            <Field key={c.key} label={c.label}>
              <input className="fp-input" type={c.type||'text'} value={form[c.key]||''} onChange={e=>set(c.key,e.target.value)}
                style={{fontSize:12}}/>
            </Field>
          ))}
        </div>
      </Section>

      <Section icon={<Code size={18}/>} title="Developer">
        <DeveloperSection />
      </Section>

    </div>
  )
}
