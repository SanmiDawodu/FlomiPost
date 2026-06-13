import { useState, useEffect } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Settings, Bell, Key, Save } from 'lucide-react'

const tok = () => localStorage.getItem('fp_token')
const api = (url, opts={}) => fetch(url, {headers:{'Authorization':`Bearer ${tok()}`,'Content-Type':'application/json'},...opts}).then(r=>r.json())

export default function SettingsPage() {
  const [form, setForm] = useState({ app_name: '', timezone: '', notify_email: true, notify_post_fail: true, openai_key: '', ga_key: '' })
  const [saved, setSaved] = useState(false)
  const [tab, setTab] = useState('general')

  const { data } = useQuery({ queryKey: ['settings'], queryFn: () => api('/api/settings') })
  useEffect(() => { if (data) setForm(f => ({ ...f, ...data })) }, [data])

  const save = useMutation({
    mutationFn: () => api('/api/settings', { method: 'POST', body: JSON.stringify(form) }),
    onSuccess: () => { setSaved(true); setTimeout(() => setSaved(false), 2500) }
  })

  const inp = { width: '100%', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text)', padding: '0.6rem 0.75rem', fontSize: '0.9rem', boxSizing: 'border-box' }
  const lbl = { display: 'block', color: 'var(--text2)', fontSize: '0.82rem', marginBottom: '0.35rem' }
  const field = { marginBottom: '1.1rem' }
  const tabs = ['general', 'notifications', 'api-keys']

  return (
    <div style={{ padding: '2rem', maxWidth: 680 }}>
      <h1 style={{ color: 'var(--text)', margin: '0 0 1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Settings size={22} /> Settings
      </h1>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
        {tabs.map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ padding: '0.4rem 1rem', borderRadius: 'var(--radius)', border: 'none', background: tab === t ? 'var(--accent)' : 'transparent', color: tab === t ? '#fff' : 'var(--text2)', cursor: 'pointer', fontSize: '0.85rem', fontWeight: tab === t ? 600 : 400 }}>
            {t === 'general' ? 'General' : t === 'notifications' ? 'Notifications' : 'API Keys'}
          </button>
        ))}
      </div>

      {tab === 'general' && (
        <div>
          <div style={field}><label style={lbl}>App Name</label><input style={inp} value={form.app_name || ''} onChange={e => setForm(f => ({ ...f, app_name: e.target.value }))} /></div>
          <div style={field}><label style={lbl}>Timezone</label>
            <select style={inp} value={form.timezone || ''} onChange={e => setForm(f => ({ ...f, timezone: e.target.value }))}>
              {['UTC','America/New_York','America/Chicago','America/Los_Angeles','Europe/London','Europe/Paris','Asia/Dubai','Asia/Lagos'].map(tz => <option key={tz} value={tz}>{tz}</option>)}
            </select>
          </div>
        </div>
      )}

      {tab === 'notifications' && (
        <div>
          {[['notify_email','Email notifications'],['notify_post_fail','Alert on post failure']].map(([key, label]) => (
            <div key={key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ color: 'var(--text)', fontSize: '0.9rem' }}>{label}</span>
              <input type="checkbox" checked={!!form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.checked }))} style={{ width: 18, height: 18, cursor: 'pointer' }} />
            </div>
          ))}
        </div>
      )}

      {tab === 'api-keys' && (
        <div>
          <div style={field}><label style={lbl}>OpenAI API Key</label><input type="password" style={inp} value={form.openai_key || ''} onChange={e => setForm(f => ({ ...f, openai_key: e.target.value }))} placeholder="sk-…" /></div>
          <div style={field}><label style={lbl}>Google Analytics Key</label><input type="password" style={inp} value={form.ga_key || ''} onChange={e => setForm(f => ({ ...f, ga_key: e.target.value }))} placeholder="GA4 measurement ID" /></div>
        </div>
      )}

      <div style={{ marginTop: '1.5rem', display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <button onClick={() => save.mutate()} disabled={save.isPending} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius)', padding: '8px 18px', cursor: 'pointer', fontWeight: 600 }}>
          <Save size={15} /> {save.isPending ? 'Saving…' : 'Save'}
        </button>
        {saved && <span style={{ color: 'var(--success)', fontSize: '0.85rem' }}>Saved!</span>}
      </div>
    </div>
  )
}
