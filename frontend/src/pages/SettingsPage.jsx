import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Settings } from 'lucide-react';

const token = () => localStorage.getItem('fp_token');
const h = () => ({ Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' });

export default function SettingsPage() {
  const [form, setForm] = useState({ site_name: '', timezone: 'UTC', notify_email: true, notify_slack: false, openai_api_key: '' });
  const [saved, setSaved] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => { const r = await fetch('/api/settings', { headers: h() }); const j = await r.json(); return j.data || j; },
  });

  useEffect(() => { if (data) setForm(f => ({ ...f, ...data })); }, [data]);

  const save = useMutation({
    mutationFn: async (p) => { const r = await fetch('/api/settings', { method: 'PUT', headers: h(), body: JSON.stringify(p) }); if (!r.ok) throw new Error('Save failed'); },
    onSuccess: () => { setSaved(true); setTimeout(() => setSaved(false), 3000); },
  });

  const page = { padding: '2rem', maxWidth: '680px' };
  const section = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1.5rem', marginBottom: '1.25rem' };
  const label = { display: 'block', color: 'var(--text2)', fontSize: '0.82rem', marginBottom: '0.35rem' };
  const input = { width: '100%', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text)', padding: '0.6rem 0.75rem', fontSize: '0.9rem', boxSizing: 'border-box', marginBottom: '1rem' };
  const toggle = { display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.75rem' };
  const btn = { padding: '0.55rem 1.25rem', borderRadius: 'var(--radius)', background: 'var(--accent)', border: 'none', color: 'var(--text)', cursor: 'pointer', fontWeight: 600 };

  if (isLoading) return <div style={page}><p style={{ color: 'var(--text2)' }}>Loading…</p></div>;

  return (
    <div style={page}>
      <h1 style={{ color: 'var(--text)', margin: '0 0 1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Settings size={22} /> Settings</h1>
      {saved && <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid var(--success)', borderRadius: 'var(--radius)', padding: '0.75rem 1rem', color: 'var(--success)', marginBottom: '1rem' }}>Settings saved.</div>}
      <div style={section}>
        <h3 style={{ color: 'var(--text)', margin: '0 0 1rem' }}>General</h3>
        <label style={label}>Site / Workspace Name</label>
        <input style={input} value={form.site_name} onChange={e => setForm(f => ({ ...f, site_name: e.target.value }))} placeholder="My Workspace" />
        <label style={label}>Timezone</label>
        <input style={input} value={form.timezone} onChange={e => setForm(f => ({ ...f, timezone: e.target.value }))} placeholder="UTC" />
      </div>
      <div style={section}>
        <h3 style={{ color: 'var(--text)', margin: '0 0 1rem' }}>API Keys</h3>
        <label style={label}>OpenAI API Key</label>
        <input style={input} type="password" value={form.openai_api_key} onChange={e => setForm(f => ({ ...f, openai_api_key: e.target.value }))} placeholder="sk-…" />
      </div>
      <div style={section}>
        <h3 style={{ color: 'var(--text)', margin: '0 0 1rem' }}>Notifications</h3>
        <div style={toggle}>
          <input type="checkbox" id="notif-email" checked={!!form.notify_email} onChange={e => setForm(f => ({ ...f, notify_email: e.target.checked }))} style={{ accentColor: 'var(--accent)', width: 16, height: 16 }} />
          <label htmlFor="notif-email" style={{ color: 'var(--text)', fontSize: '0.9rem', cursor: 'pointer' }}>Email notifications</label>
        </div>
        <div style={toggle}>
          <input type="checkbox" id="notif-slack" checked={!!form.notify_slack} onChange={e => setForm(f => ({ ...f, notify_slack: e.target.checked }))} style={{ accentColor: 'var(--accent)', width: 16, height: 16 }} />
          <label htmlFor="notif-slack" style={{ color: 'var(--text)', fontSize: '0.9rem', cursor: 'pointer' }}>Slack notifications</label>
        </div>
      </div>
      {save.isError && <p style={{ color: 'var(--danger)' }}>{save.error.message}</p>}
      <button style={btn} onClick={() => save.mutate(form)} disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save Settings'}</button>
    </div>
  );
}
