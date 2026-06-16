import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, sitesApi } from '../utils/api'
import toast from 'react-hot-toast'
import { Zap, Webhook, Bot, ShoppingBag, Plus, Trash2, Copy, ExternalLink, CheckCircle, Circle, RefreshCw, ChevronDown, ChevronRight } from 'lucide-react'

const SOURCES = [
  { value:'generic',     label:'Generic (any app)' },
  { value:'zapier',      label:'Zapier' },
  { value:'make',        label:'Make (Integromat)' },
  { value:'n8n',         label:'n8n' },
  { value:'shopify',     label:'Shopify' },
  { value:'woocommerce', label:'WooCommerce' },
  { value:'hubspot',     label:'HubSpot' },
  { value:'typeform',    label:'Typeform' },
  { value:'airtable',    label:'Airtable' },
]

const INTEGRATIONS = [
  {
    id:'zapier', name:'Zapier', icon:'⚡', color:'#FF4A00',
    desc:'Connect FlomiPost to 6,000+ apps. Use your API key to trigger posts from any Zapier workflow.',
    category:'automation',
    steps:[
      'Go to zapier.com → Create Zap',
      'Choose a Trigger (e.g. Google Sheets row, form submission)',
      'Action: Webhooks by Zapier → POST',
      'URL: your FlomiPost Inbound Webhook URL (create one below)',
      'Body: {"caption":"{{your field}}"}'
    ]
  },
  {
    id:'make', name:'Make (Integromat)', icon:'🔵', color:'#6D00CC',
    desc:'Build powerful automation flows. Use HTTP module to POST to your FlomiPost inbound webhook.',
    category:'automation',
    steps:[
      'Open Make → Create new Scenario',
      'Add a Trigger module (e.g. Google Forms, Typeform)',
      'Add: HTTP → Make a request',
      'Method: POST, URL: your Inbound Webhook URL',
      'Body type: Raw, Content type: JSON, Body: {"caption":"{{text}}"}'
    ]
  },
  {
    id:'n8n', name:'n8n', icon:'🔶', color:'#FF6D00',
    desc:'Self-hosted automation. Use the HTTP Request node with your Read+Write API key to schedule posts.',
    category:'automation',
    steps:[
      'In n8n, add HTTP Request node',
      'Method: POST, URL: https://scheduler.flomicso.dev/api/posts',
      'Headers: Authorization: Bearer YOUR_RW_KEY',
      'Body: {"caption":"...","site_id":1,"scheduled_at":"2024-01-01 09:00:00"}'
    ]
  },
  {
    id:'shopify', name:'Shopify', icon:'🛍️', color:'#96BF48',
    desc:'Auto-post when a new product is published. Connect via inbound webhook.',
    category:'ecommerce',
    steps:[
      'In Shopify Admin → Settings → Notifications → Webhooks',
      'Event: Product creation, Format: JSON',
      'URL: your FlomiPost Inbound Webhook',
      'Set template: New product: {{title}} - {{body_html}}'
    ]
  },
  {
    id:'woocommerce', name:'WooCommerce', icon:'🛒', color:'#7F54B3',
    desc:'Post when a new product or order is created in WooCommerce.',
    category:'ecommerce',
    steps:[
      'WooCommerce → Settings → Advanced → Webhooks',
      'Add webhook: Topic = Product created',
      'Delivery URL: your FlomiPost Inbound Webhook URL',
      'Set template: New: {{name}} — {{short_description}}'
    ]
  },
  {
    id:'hubspot', name:'HubSpot', icon:'🧡', color:'#FF7A59',
    desc:'Trigger social posts from HubSpot deal stage changes or form submissions.',
    category:'crm',
    steps:[
      'HubSpot → Automation → Workflows',
      'Trigger: Deal stage changed / Form submitted',
      'Action: Send webhook → POST to your Inbound Webhook URL',
      'Include deal/contact data in the payload'
    ]
  },
  {
    id:'salesforce', name:'Salesforce', icon:'☁️', color:'#00A1E0',
    desc:'Post to social when a deal is closed, lead is created, or opportunity is updated.',
    category:'crm',
    steps:[
      'Salesforce → Setup → Process Builder or Flow',
      'Trigger: Record created/updated (Lead, Opportunity, Account)',
      'Action: HTTP Callout → POST to your FlomiPost Inbound Webhook',
      'Map fields: {{Name}}, {{Description}}, {{StageName}} in your template'
    ]
  },
  {
    id:'zoho', name:'Zoho CRM', icon:'🟠', color:'#E42527',
    desc:'Trigger social posts from Zoho CRM deal stage changes, new leads, or custom events.',
    category:'crm',
    steps:[
      'Zoho CRM → Settings → Automation → Webhooks',
      'Create webhook: Trigger on Lead/Contact/Deal update',
      'Notification URL: your FlomiPost Inbound Webhook',
      'Template: New Lead: {{First Name}} {{Last Name}} from {{Company}}'
    ]
  },
  {
    id:'pipedrive', name:'Pipedrive', icon:'🟢', color:'#28A745',
    desc:'Auto-post when a deal is won, a new contact is added, or a stage is updated.',
    category:'crm',
    steps:[
      'Pipedrive → Tools → Webhooks → Add webhook',
      'Event: deal.updated / person.added',
      'URL: your FlomiPost Inbound Webhook',
      'Template: Deal won: {{title}} — {{org_name}}'
    ]
  },
  {
    id:'gohighlevel', name:'GoHighLevel', icon:'🔷', color:'#0066FF',
    desc:'Connect GHL workflows to auto-post when a contact is added, funnel step triggered, or appointment booked.',
    category:'crm',
    steps:[
      'GHL → Automation → Workflows → Add Action',
      'Action: Webhook → POST',
      'URL: your FlomiPost Inbound Webhook URL',
      'Body: {"caption":"New booking: {{contact.full_name}} — {{appointment.title}}"}'
    ]
  },
  {
    id:'keap', name:'Keap (Infusionsoft)', icon:'🔴', color:'#CC0000',
    desc:'Trigger social posts from Keap campaigns, contact tags, or purchase events.',
    category:'crm',
    steps:[
      'Keap → Campaign Builder → Add HTTP Post step',
      'URL: your FlomiPost Inbound Webhook',
      'Payload: contact name, tag, purchase info as caption fields'
    ]
  },
  {
    id:'etsy', name:'Etsy', icon:'🧶', color:'#F56400',
    desc:'Auto-post new Etsy listings via Zapier or Make — Etsy does not have native webhooks.',
    category:'ecommerce',
    steps:[
      'Use Zapier or Make as middleware',
      'Trigger: Etsy → New listing published',
      'Action: HTTP POST to your FlomiPost Inbound Webhook',
      'Template: New on Etsy: {{title}} — {{description}}'
    ]
  },
  {
    id:'bigcommerce', name:'BigCommerce', icon:'🛒', color:'#34313F',
    desc:'Post when a new product is created or a sale milestone is reached.',
    category:'ecommerce',
    steps:[
      'BigCommerce → Advanced Settings → Webhooks',
      'Topic: store/product/created',
      'Destination: your FlomiPost Inbound Webhook URL',
      'Template: New product: {{name}} — {{description}}'
    ]
  },
  {
    id:'squarespace', name:'Squarespace', icon:'⬛', color:'#000000',
    desc:'Use Zapier to trigger posts when new blog content or products are published.',
    category:'ecommerce',
    steps:[
      'Squarespace does not support native webhooks',
      'Use Zapier: Squarespace → New Blog Post → FlomiPost Inbound Webhook',
      'Or use Squarespace RSS feed → FlomiPost RSS Auto Post feature'
    ]
  },
  {
    id:'claude', name:'Claude / ChatGPT', icon:'🤖', color:'#7C3AED',
    desc:'Give your AI agent Read+Write access to schedule posts on your behalf.',
    category:'ai',
    steps:[
      'Copy your Read+Write API key from Settings → Developer',
      'Give the AI this instruction: "Use FlomiPost API at scheduler.flomicso.dev/api with Bearer token YOUR_KEY"',
      'Or add the MCP server: claude mcp add flomipost --transport http --header "Authorization: Bearer YOUR_KEY" URL'
    ]
  },
]

function InboundWebhooks({ sites }) {
  const qc = useQueryClient()
  const appUrl = window.location.origin
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name:'', site_id:'', source:'generic', template:'', schedule_time:'09:00', auto_schedule:1 })
  const [copied, setCopied] = useState(null)

  const { data } = useQuery({ queryKey:['inbound-webhooks'], queryFn:()=>api.get('/integrations/inbound') })
  const hooks = data?.data ?? []

  const create = useMutation({
    mutationFn: d=>api.post('/integrations/inbound', d),
    onSuccess:()=>{ qc.invalidateQueries(['inbound-webhooks']); setShowForm(false); setForm({name:'',site_id:'',source:'generic',template:'',schedule_time:'09:00',auto_schedule:1}); toast.success('Inbound webhook created!') },
    onError:e=>toast.error(e.message)
  })

  const del = useMutation({
    mutationFn: id=>api.delete('/integrations/inbound/'+id),
    onSuccess:()=>{ qc.invalidateQueries(['inbound-webhooks']); toast.success('Deleted') }
  })

  const copy = (text, id) => { navigator.clipboard.writeText(text); setCopied(id); setTimeout(()=>setCopied(null), 2000) }

  return (
    <div>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
        <div>
          <div style={{fontWeight:700,fontSize:15}}>Inbound Webhooks</div>
          <div style={{fontSize:12,color:'var(--text3)'}}>Generate a unique URL — any app can POST to it to create a scheduled post</div>
        </div>
        <button className="fp-btn fp-btn-primary fp-btn-sm" onClick={()=>setShowForm(v=>!v)}><Plus size={13}/> New Webhook</button>
      </div>

      {showForm && (
        <div className="fp-card" style={{marginBottom:16,border:'1px solid var(--primary)',borderRadius:10}}>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10,marginBottom:10}}>
            <div><label className="fp-label">Name *</label><input className="fp-input" value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} placeholder="Shopify New Product"/></div>
            <div><label className="fp-label">Site *</label>
              <select className="fp-select" value={form.site_id} onChange={e=>setForm(f=>({...f,site_id:e.target.value}))}>
                <option value="">Select site...</option>
                {sites.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div><label className="fp-label">Source App</label>
              <select className="fp-select" value={form.source} onChange={e=>setForm(f=>({...f,source:e.target.value}))}>
                {SOURCES.map(s=><option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>
          <div style={{marginBottom:10}}>
            <label className="fp-label">Caption Template (use {'{{field}}'} for payload values)</label>
            <textarea className="fp-input" rows={3} value={form.template} onChange={e=>setForm(f=>({...f,template:e.target.value}))}
              placeholder="New Product: {{title}} — {{body_html}}" style={{width:'100%',resize:'vertical'}}/>
            <div style={{fontSize:11,color:'var(--text3)',marginTop:4}}>Leave blank to auto-extract caption from payload. Use {'{{title}}'}, {'{{message}}'}, {'{{name}}'} etc.</div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:12}}>
            <div><label className="fp-label">Schedule Time</label><input type="time" className="fp-input" value={form.schedule_time} onChange={e=>setForm(f=>({...f,schedule_time:e.target.value}))}/></div>
            <div style={{display:'flex',alignItems:'center',gap:8,paddingTop:20}}>
              <input type="checkbox" id="auto_sched" checked={!!form.auto_schedule} onChange={e=>setForm(f=>({...f,auto_schedule:e.target.checked?1:0}))}/>
              <label htmlFor="auto_sched" style={{fontSize:13}}>Auto-schedule incoming posts</label>
            </div>
          </div>
          <div style={{display:'flex',gap:8}}>
            <button className="fp-btn fp-btn-primary fp-btn-sm" onClick={()=>create.mutate(form)} disabled={create.isPending}>Create Webhook</button>
            <button className="fp-btn fp-btn-ghost fp-btn-sm" onClick={()=>setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      {hooks.length === 0 && !showForm && (
        <div style={{textAlign:'center',padding:'32px 20px',color:'var(--text3)',background:'var(--bg2)',borderRadius:10}}>
          <Webhook size={32} style={{opacity:.2,marginBottom:8}}/>
          <div>No inbound webhooks yet. Create one to start receiving data from external apps.</div>
        </div>
      )}

      {hooks.map(h=>{
        const url = appUrl + '/api/inbound/' + h.token
        return (
          <div key={h.id} className="fp-card" style={{marginBottom:10,borderLeft:'3px solid var(--primary)'}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
              <div style={{flex:1}}>
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
                  <span style={{fontWeight:700,fontSize:14}}>{h.name}</span>
                  <span style={{fontSize:11,padding:'2px 8px',borderRadius:12,background:'var(--bg2)',color:'var(--text3)'}}>{h.source}</span>
                  {h.trigger_count > 0 && <span style={{fontSize:11,color:'var(--primary)'}}>{h.trigger_count} triggers</span>}
                </div>
                <div style={{display:'flex',alignItems:'center',gap:6,background:'var(--bg2)',borderRadius:6,padding:'6px 10px',fontSize:12,fontFamily:'monospace'}}>
                  <span style={{flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{url}</span>
                  <button onClick={()=>copy(url, h.id)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--primary)',padding:'0 4px'}}>
                    {copied===h.id ? <CheckCircle size={14}/> : <Copy size={14}/>}
                  </button>
                </div>
                {h.template && <div style={{fontSize:11,color:'var(--text3)',marginTop:4}}>Template: {h.template.slice(0,80)}</div>}
              </div>
              <button onClick={()=>del.mutate(h.id)} style={{background:'none',border:'none',cursor:'pointer',color:'var(--text3)',marginLeft:12}}><Trash2 size={14}/></button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function IntegrationCard({ intg, apiKey, appUrl }) {
  const [open, setOpen] = useState(false)
  const mcpUrl = appUrl + '/api/mcp'

  return (
    <div className="fp-card" style={{border:'1px solid var(--border)',borderRadius:10,overflow:'hidden'}}>
      <div style={{display:'flex',alignItems:'center',gap:12,cursor:'pointer'}} onClick={()=>setOpen(v=>!v)}>
        <div style={{width:44,height:44,borderRadius:10,background:intg.color+'22',display:'flex',alignItems:'center',justifyContent:'center',fontSize:24,flexShrink:0}}>
          {intg.icon}
        </div>
        <div style={{flex:1}}>
          <div style={{fontWeight:700,fontSize:14}}>{intg.name}</div>
          <div style={{fontSize:12,color:'var(--text3)'}}>{intg.desc}</div>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:8}}>
          <span style={{fontSize:11,padding:'2px 10px',borderRadius:12,
            background:'var(--bg2)',color:'var(--text3)',fontWeight:600}}>
            {intg.category}
          </span>
          {open ? <ChevronDown size={16}/> : <ChevronRight size={16}/>}
        </div>
      </div>

      {open && (
        <div style={{marginTop:16,paddingTop:16,borderTop:'1px solid var(--border)'}}>
          <div style={{fontWeight:600,fontSize:13,marginBottom:10,color:'var(--text2)'}}>How to connect:</div>
          <ol style={{margin:'0 0 16px',paddingLeft:20}}>
            {intg.steps.map((s,i)=><li key={i} style={{fontSize:13,lineHeight:1.7,color:'var(--text)',marginBottom:4}}>{s}</li>)}
          </ol>

          {intg.id === 'n8n' && (
            <div>
              <div style={{fontWeight:600,fontSize:12,marginBottom:6,color:'var(--text3)'}}>Example n8n HTTP Request body:</div>
              <pre style={{background:'#0d1117',color:'#e6edf3',padding:12,borderRadius:8,fontSize:11,overflow:'auto'}}>{`{
  "caption": "{{ $json.title }} — {{ $json.description }}",
  "site_id": 1,
  "scheduled_at": "{{ $now.toISO() }}"
}`}</pre>
            </div>
          )}

          {intg.id === 'claude' && apiKey && (
            <div>
              <div style={{fontWeight:600,fontSize:12,marginBottom:6,color:'var(--text3)'}}>Add MCP to Claude Code:</div>
              <pre style={{background:'#0d1117',color:'#e6edf3',padding:12,borderRadius:8,fontSize:11,overflow:'auto'}}>{`claude mcp add flomipost \\
  --transport http \\
  --header "Authorization: Bearer ${apiKey}" \\
  "${mcpUrl}"`}</pre>
              <button onClick={()=>{navigator.clipboard.writeText(`claude mcp add flomipost --transport http --header "Authorization: Bearer ${apiKey}" "${mcpUrl}"`);toast.success('Copied!')}}
                className="fp-btn fp-btn-ghost fp-btn-sm" style={{marginTop:8}}><Copy size={12}/> Copy Command</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function IntegrationsPage() {
  const appUrl = window.location.origin
  const [apiKey, setApiKey] = useState('')
  const [filter, setFilter] = useState('all')

  const { data: sitesRes } = useQuery({ queryKey:['sites'], queryFn: sitesApi.list })
  const sites = sitesRes?.data ?? []

  useEffect(() => {
    api.get('/developer/api-key').then(r=>setApiKey(r.data?.key||'')).catch(()=>{})
  }, [])

  const categories = [
    {v:'all',l:'All'},
    {v:'automation',l:'⚡ Automation'},
    {v:'ecommerce',l:'🛍️ E-Commerce'},
    {v:'crm',l:'🧡 CRM'},
    {v:'ai',l:'🤖 AI Agents'},
  ]

  const filtered = filter==='all' ? INTEGRATIONS : INTEGRATIONS.filter(i=>i.category===filter)

  return (
    <div>
      <div className="fp-page-header" style={{marginBottom:24}}>
        <h1 className="fp-page-title">Integrations</h1>
        <p className="fp-page-sub">Connect FlomiPost to your favourite tools, automations, and AI agents</p>
      </div>

      {/* Stats bar */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:28}}>
        {[
          {label:'Integrations Available', value:INTEGRATIONS.length, icon:'🔌'},
          {label:'Zapier Actions', value:'5', icon:'⚡'},
          {label:'Make Modules', value:'3', icon:'🔵'},
          {label:'API Endpoints', value:'20+', icon:'🤖'},
        ].map(s=>(
          <div key={s.label} className="fp-card" style={{textAlign:'center',padding:'16px 12px'}}>
            <div style={{fontSize:24,marginBottom:4}}>{s.icon}</div>
            <div style={{fontWeight:700,fontSize:22}}>{s.value}</div>
            <div style={{fontSize:11,color:'var(--text3)'}}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Inbound Webhooks */}
      <div className="fp-card" style={{marginBottom:24}}>
        <InboundWebhooks sites={sites}/>
      </div>

      {/* Integration Directory */}
      <div style={{marginBottom:16}}>
        <div style={{fontWeight:700,fontSize:15,marginBottom:4}}>Integration Directory</div>
        <div style={{fontSize:12,color:'var(--text3)',marginBottom:14}}>Click any integration to see setup instructions</div>
        <div style={{display:'flex',gap:8,flexWrap:'wrap',marginBottom:16}}>
          {categories.map(c=>(
            <button key={c.v} onClick={()=>setFilter(c.v)}
              style={{padding:'6px 16px',borderRadius:20,border:'1px solid var(--border)',cursor:'pointer',fontSize:13,
                background:filter===c.v?'var(--primary)':'var(--bg2)',
                color:filter===c.v?'#fff':'var(--text2)',fontWeight:filter===c.v?700:400}}>
              {c.l}
            </button>
          ))}
        </div>
        <div style={{display:'flex',flexDirection:'column',gap:10}}>
          {filtered.map(intg=>(
            <IntegrationCard key={intg.id} intg={intg} apiKey={apiKey} appUrl={appUrl}/>
          ))}
        </div>
      </div>

      {/* API Reference quick card */}
      <div className="fp-card" style={{background:'var(--navy,#0D1B3E)',color:'#fff',borderRadius:12}}>
        <div style={{fontWeight:700,fontSize:15,marginBottom:6}}>📡 Direct API Access</div>
        <div style={{fontSize:13,opacity:.8,marginBottom:14}}>Any app that supports HTTP requests can connect to FlomiPost directly.</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10}}>
          {[
            {method:'POST',path:'/api/posts',desc:'Schedule a new post'},
            {method:'GET', path:'/api/posts',desc:'List all posts'},
            {method:'GET', path:'/api/sites',desc:'List connected sites'},
            {method:'GET', path:'/api/analytics',desc:'Get analytics data'},
          ].map(ep=>(
            <div key={ep.path} style={{background:'rgba(255,255,255,.08)',borderRadius:8,padding:'10px 14px',display:'flex',gap:10,alignItems:'center'}}>
              <span style={{background:ep.method==='POST'?'#7c3aed':'#059669',fontSize:11,padding:'2px 8px',borderRadius:4,fontWeight:700,color:'#fff',flexShrink:0}}>{ep.method}</span>
              <div>
                <div style={{fontFamily:'monospace',fontSize:12}}>{ep.path}</div>
                <div style={{fontSize:11,opacity:.7}}>{ep.desc}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{marginTop:14,fontSize:12,opacity:.7}}>
          Auth: <code style={{background:'rgba(255,255,255,.15)',padding:'2px 8px',borderRadius:4}}>Authorization: Bearer YOUR_API_KEY</code>
          &nbsp;— get your key from <strong>Settings → Developer</strong>
        </div>
      </div>
    </div>
  )
}
