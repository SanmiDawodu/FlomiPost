import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Radio, Send } from 'lucide-react';

const token = () => localStorage.getItem('fp_token');
const headers = () => ({ Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' });

export default function BroadcastPage() {
  const [form, setForm] = useState({ connection_id: '', segment_id: '', message: '' });
  const [success, setSuccess] = useState(false);

  const { data: connections } = useQuery({
    queryKey: ['connections-wa'],
    queryFn: async () => {
      const r = await fetch('/api/connections?platform=whatsapp', { headers: headers() });
      const j = await r.json(); return j.data || j;
    },
  });

  const { data: segments } = useQuery({
    queryKey: ['wa-segments'],
    queryFn: async () => {
      const r = await fetch('/api/whatsapp/segments', { headers: headers() });
      const j = await r.json(); return j.data || j;
    },
  });

  const send = useMutation({
    mutationFn: async (payload) => {
      const r = await fetch('/api/whatsapp/broadcast', { method: 'POST', headers: headers(), body: JSON.stringify(payload) });
      if (!r.ok) throw new Error('Broadcast failed');
    },
    onSuccess: () => { setSuccess(true); setForm({ connection_id: '', segment_id: '', message: '' }); },
  });

  const page = { padding: '2rem', maxWidth: '640px' };
  const label = { display: 'block', color: 'var(--text2)', fontSize: '0.82rem', marginBottom: '0.35rem' };
  const input = { width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text)', padding: '0.6rem 0.75rem', fontSize: '0.9rem', boxSizing: 'border-box' };
  const field = { marginBottom: '1.1rem' };
  const btn = { padding: '0.55rem 1.25rem', borderRadius: 'var(--radius)', background: 'var(--accent)', border: 'none', color: 'var(--text)', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem' };

  return (
    <div style={page}>
      <h1 style={{ color: 'var(--text)', margin: '0 0 1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Radio size={22} /> WhatsApp Broadcast</h1>
      {success && <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid var(--success)', borderRadius: 'var(--radius)', padding: '0.75rem 1rem', color: 'var(--success)', marginBottom: '1rem' }}>Broadcast sent successfully!</div>}
      {send.isError && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid var(--danger)', borderRadius: 'var(--radius)', padding: '0.75rem 1rem', color: 'var(--danger)', marginBottom: '1rem' }}>{send.error.message}</div>}
      <form onSubmit={(e) => { e.preventDefault(); send.mutate(form); }}>
        <div style={field}>
          <label style={label}>WhatsApp Connection</label>
          <select style={input} value={form.connection_id} onChange={e => setForm(f => ({ ...f, connection_id: e.target.value }))}>
            <option value="">Select connection…</option>
            {connections?.map(c => <option key={c.id} value={c.id}>{c.account_name || c.username}</option>)}
          </select>
        </div>
        <div style={field}>
          <label style={label}>Segment (optional)</label>
          <select style={input} value={form.segment_id} onChange={e => setForm(f => ({ ...f, segment_id: e.target.value }))}>
            <option value="">All contacts</option>
            {segments?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
        <div style={field}>
          <label style={label}>Message</label>
          <textarea style={{ ...input, minHeight: '120px', resize: 'vertical' }} value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} placeholder="Type your broadcast message…" required />
        </div>
        <button type="submit" style={btn} disabled={send.isPending}><Send size={15} />{send.isPending ? 'Sending…' : 'Send Broadcast'}</button>
      </form>
    </div>
  );
}
