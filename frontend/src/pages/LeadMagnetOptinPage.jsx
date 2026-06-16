import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api, sitesApi } from '../utils/api'
import toast from 'react-hot-toast'
import { Plus, Trash2, Copy, Gift, Users, ToggleLeft, ToggleRight } from 'lucide-react'

export default function LeadMagnetOptinPage() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({
    name:'', site_id:'', magnet_title:'', magnet_url:'', double_optin:true,
    from_email:'', from_name:'', redirect_url:'',
    confirm_subject:'Please confirm your email to get your free resource',
    delivery_subject:'Your free resource is here!',
    confirm_body:'', delivery_body:''
  })

  const { data: sitesRes } = useQuery({ queryKey:['sites'], queryFn: sitesApi.list })
  const { data: formsRes, refetch } = useQuery({ queryKey:['lead-magnet-optins'], queryFn:()=>api.get('/lead-magnet-optins') })
  const sites = sitesRes?.data ?? []
  const forms = formsRes?.data ?? []
  const s = (k,v) => setForm(f=>({...f,[k]:v}))
  const appUrl = window.location.origin

  const createMut = useMutation({
    mutationFn: ()=>api.post('/lead-magnet-optins', {...form, site_id:parseInt(form.site_id), double_optin:form.double_optin?1:0}),
    onSuccess:()=>{ refetch(); setShowForm(false); setForm({name:'',site_id:'',magnet_title:'',magnet_url:'',double_optin:true,from_email:'',from_name:'',redirect_url:'',confirm_subject:'Please confirm your email to get your free resource',delivery_subject:'Your free resource is here!',confirm_body:'',delivery_body:''}); toast.success('Opt-in form created!') },
    onError:e=>toast.error(e.message)
  })

  const delMut = useMutation({
    mutationFn: id=>api.delete('/lead-magnet-optins/'+id),
    onSuccess:()=>{ refetch(); toast.success('Deleted') }
  })

  const copyEmbed = (id) => {
    const code = `<!-- FlomiPost Lead Magnet Opt-in Form -->
<form onsubmit="fpOptinSubmit(event,'${id}')" style="display:flex;flex-direction:column;gap:10px;max-width:400px">
  <input type="text" name="name" placeholder="Your Name" style="padding:10px;border:1px solid #ddd;border-radius:6px"/>
  <input type="email" name="email" placeholder="Your Email *" required style="padding:10px;border:1px solid #ddd;border-radius:6px"/>
  <button type="submit" style="background:#5b3cf5;color:#fff;padding:12px;border:none;border-radius:6px;font-weight:700;cursor:pointer">
    Get My Free Resource
  </button>
  <div id="fp-optin-msg-${id}" style="text-align:center;font-size:13px"></div>
</form>
<script>
async function fpOptinSubmit(e,formId){
  e.preventDefault();
  const fd=new FormData(e.target);
  const msg=document.getElementById('fp-optin-msg-'+formId);
  msg.textContent='Sending...';
  const r=await fetch('${appUrl}/api/optin/'+formId,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:fd.get('name'),email:fd.get('email')})});
  const d=await r.json();
  msg.textContent=d.message||d.error||'Done!';
  msg.style.color=r.ok?'green':'red';
  if(r.ok)e.target.reset();
}
</script>`
    navigator.clipboard.writeText(code)
    toast.success('Embed code copied! Paste it on your website.')
  }

  const copyApiUrl = (id) => {
    navigator.clipboard.writeText(`${appUrl}/api/optin/${id}`)
    toast.success('API URL copied!')
  }

  return (
    <div>
      <div className="fp-page-header" style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:24}}>
        <div>
          <h1 className="fp-page-title">Lead Magnet Opt-in</h1>
          <p className="fp-page-sub">Create opt-in forms with single or double opt-in confirmation and automatic lead magnet delivery</p>
        </div>
        <button className="fp-btn fp-btn-primary" onClick={()=>setShowForm(v=>!v)}><Plus size={14}/> Create Form</button>
      </div>

      {showForm && (
        <div className="fp-card" style={{marginBottom:20}}>
          <div style={{fontWeight:700,fontSize:14,marginBottom:16,display:'flex',alignItems:'center',gap:6}}><Gift size={15}/> New Lead Magnet Opt-in Form</div>

          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
            <div><label className="fp-label">Form name *</label><input className="fp-input" value={form.name} onChange={e=>s('name',e.target.value)} placeholder="VOG Free Chapter Opt-in"/></div>
            <div><label className="fp-label">Site *</label>
              <select className="fp-select" value={form.site_id} onChange={e=>s('site_id',e.target.value)}>
                <option value="">Select site...</option>
                {sites.map(st=><option key={st.id} value={st.id}>{st.name}</option>)}
              </select>
            </div>
          </div>

          <div style={{display:'grid',gridTemplateColumns:'2fr 1fr',gap:10,marginBottom:10}}>
            <div><label className="fp-label">Lead magnet title *</label><input className="fp-input" value={form.magnet_title} onChange={e=>s('magnet_title',e.target.value)} placeholder="How to Recognize the Voice of God — Day 1 FREE"/></div>
            <div><label className="fp-label">Download URL *</label><input className="fp-input" value={form.magnet_url} onChange={e=>s('magnet_url',e.target.value)} placeholder="https://ssiministries.org/vog-day1.pdf"/></div>
          </div>

          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10,marginBottom:10}}>
            <div><label className="fp-label">From email *</label><input className="fp-input" value={form.from_email} onChange={e=>s('from_email',e.target.value)} placeholder="noreply@ssiministries.org"/></div>
            <div><label className="fp-label">From name</label><input className="fp-input" value={form.from_name} onChange={e=>s('from_name',e.target.value)} placeholder="Sanmi Dawodu Ministries"/></div>
            <div><label className="fp-label">Redirect after confirm (optional)</label><input className="fp-input" value={form.redirect_url} onChange={e=>s('redirect_url',e.target.value)} placeholder="https://sanmidawodu.org/thank-you"/></div>
          </div>

          {/* Double opt-in toggle */}
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:16,padding:'10px 14px',background:'var(--bg2)',borderRadius:8}}>
            <button onClick={()=>s('double_optin',!form.double_optin)} style={{background:'none',border:'none',cursor:'pointer',color:form.double_optin?'var(--green)':'var(--text3)',display:'flex',alignItems:'center',gap:6}}>
              {form.double_optin ? <ToggleRight size={28}/> : <ToggleLeft size={28}/>}
              <span style={{fontWeight:700,fontSize:13}}>Double Opt-in {form.double_optin?'ON':'OFF'}</span>
            </button>
            <span style={{fontSize:12,color:'var(--text3)'}}>
              {form.double_optin ? 'Subscriber confirms email first → then receives lead magnet (recommended, GDPR compliant)' : 'Lead magnet delivered immediately on sign-up (faster but less verified)'}
            </span>
          </div>

          {form.double_optin && (
            <div style={{marginBottom:10}}>
              <label className="fp-label">Confirmation email subject</label>
              <input className="fp-input" value={form.confirm_subject} onChange={e=>s('confirm_subject',e.target.value)}/>
            </div>
          )}

          <div style={{marginBottom:10}}>
            <label className="fp-label">Delivery email subject</label>
            <input className="fp-input" value={form.delivery_subject} onChange={e=>s('delivery_subject',e.target.value)}/>
          </div>

          <div style={{display:'flex',gap:8,marginTop:4}}>
            <button className="fp-btn fp-btn-primary fp-btn-sm" onClick={()=>createMut.mutate()} disabled={createMut.isPending}>{createMut.isPending?'Saving...':'Create Form'}</button>
            <button className="fp-btn fp-btn-ghost fp-btn-sm" onClick={()=>setShowForm(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{display:'flex',flexDirection:'column',gap:12}}>
        {forms.length===0 && (
          <div className="fp-card" style={{textAlign:'center',padding:40,color:'var(--text3)'}}>
            <Gift size={36} style={{opacity:.2,marginBottom:10}}/>
            <p>No opt-in forms yet. Create one to start collecting leads and delivering your free resources automatically.</p>
          </div>
        )}
        {forms.map(f=>(
          <div key={f.id} className="fp-card">
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
              <div style={{flex:1}}>
                <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
                  <div style={{fontWeight:700,fontSize:15}}>{f.name}</div>
                  <span style={{fontSize:11,padding:'2px 8px',borderRadius:12,fontWeight:700,background:f.double_optin?'var(--green)':'var(--orange)',color:'#fff'}}>{f.double_optin?'Double Opt-in':'Single Opt-in'}</span>
                </div>
                <div style={{fontSize:13,color:'var(--text3)',marginBottom:4}}>Magnet: <strong>{f.magnet_title}</strong></div>
                <div style={{fontSize:12,color:'var(--text3)',marginBottom:8}}>
                  Site: {sites.find(s=>String(s.id)===String(f.site_id))?.name} · {f.subscribers_count} subscribers · From: {f.from_email}
                </div>

                {/* Embed instructions */}
                <div style={{background:'var(--bg2)',borderRadius:8,padding:'10px 14px',marginBottom:8}}>
                  <div style={{fontSize:11,fontWeight:700,color:'var(--text3)',marginBottom:6,textTransform:'uppercase',letterSpacing:'.06em'}}>How to use</div>
                  <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                    <button className="fp-btn fp-btn-ghost fp-btn-sm" onClick={()=>copyEmbed(f.id)}><Copy size={12}/> Copy HTML embed code</button>
                    <button className="fp-btn fp-btn-ghost fp-btn-sm" onClick={()=>copyApiUrl(f.id)}><Copy size={12}/> Copy API URL</button>
                    <span style={{fontSize:11,color:'var(--text3)',alignSelf:'center'}}>POST to: {appUrl}/api/optin/{f.id}</span>
                  </div>
                </div>

                <div style={{fontSize:11,color:'var(--text3)'}}>
                  Confirm link sent to: /api/confirm-optin/[token] · Redirect: {f.redirect_url||'FlomiPost default'}
                </div>
              </div>
              <button className="fp-btn fp-btn-ghost fp-btn-sm" style={{color:'var(--red)',marginLeft:12}} onClick={()=>delMut.mutate(f.id)}><Trash2 size={13}/></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
