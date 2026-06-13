import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Sparkles, Wand2, Trash2, Calendar } from 'lucide-react';

const token = () => localStorage.getItem('fp_token');
const h = () => ({ Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' });
const PLATFORMS = ['Twitter','Instagram','Facebook','LinkedIn','TikTok'];

export default function AISchedulePage() {
  const qc = useQueryClient();
  const [form, setForm] = useState({ topic: '', duration_days: 7, platforms: ['Twitter','Instagram'] });
  const [generating, setGenerating] = useState(false);
  const [genResult, setGenResult] = useState(null);

  const { data, isLoading } = useQuery({
    queryKey: ['ai-calendars'],
    queryFn: async () => { const r = await fetch('/api/ai-calendars', { headers: h() }); const j = await r.json(); return j.data || j; },
  });

  const generate = useMutation({
    mutationFn: async (p) => {
      setGenerating(true);
      const r = await fetch('/api/ai-calendars/generate', { method: 'POST', headers: h(), body: JSON.stringify(p) });
      if (!r.ok) throw new Error('Generation failed');
      return r.json();
    },
    onSuccess: (d) => { setGenResult(d.data || d); qc.invalidateQueries({ queryKey: ['ai-calendars'] }); setGenerating(false); },
    onError: () => setGenerating(false),
  });

  const del = useMutation({
    mutationFn: async (id) => { await fetch(`/api/ai-calendars/${id}`, { method: 'DELETE', headers: h() }); },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ai-calendars'] }),
  });

  const togglePlatform = (p) => setForm(f => ({ ...f, platforms: f.platforms.includes(p) ? f.platforms.filter(x => x !== p) : [...f.platforms, p] }));

  const page = { padding: '2rem', maxWidth: '900px' };
  const input = { width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text)', padding: '0.6rem 0.75rem', fontSize: '0.9rem', boxSizing: 'border-box', marginBottom: '0.75rem' };
  const card = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1rem 1.25rem', marginBottom: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' };
  const btn = (v) => ({ padding: '0.45rem 1rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: v === 'accent' ? 'var(--accent)' : 'transparent', color: v === 'danger' ? 'var(--danger)' : 'var(--text)', cursor: 'pointer', fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' });
  const pChip = (active) => ({ padding: '0.3rem 0.75rem', borderRadius: '99px', border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`, background: active ? 'rgba(139,92,246,0.15)' : 'transparent', color: active ? 'var(--accent)' : 'var(--text2)', cursor: 'pointer', fontSize: '0.8rem' });

  return (
    <div style={page}>
      <h1 style={{ color: 'var(--text)', margin: '0 0 1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Sparkles size={22} /> AI Content Calendar</h1>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1.5rem', marginBottom: '1.5rem' }}>
        <h3 style={{ color: 'var(--text)', margin: '0 0 1rem' }}>Generate AI Schedule</h3>
        <input style={input} placeholder="Topic or niche (e.g. SaaS marketing, fitness tips)" value={form.topic} onChange={e => setForm(f => ({ ...f, topic: e.target.value }))} />
        <div style={{ marginBottom: '0.75rem' }}>
          <label style={{ color: 'var(--text2)', fontSize: '0.82rem', display: 'block', marginBottom: '0.35rem' }}>Duration: {form.duration_days} days</label>
          <input type="range" min={3} max={30} value={form.duration_days} onChange={e => setForm(f => ({ ...f, duration_days: Number(e.target.value) }))} style={{ width: '100%', accentColor: 'var(--accent)' }} />
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label style={{ color: 'var(--text2)', fontSize: '0.82rem', display: 'block', marginBottom: '0.5rem' }}>Platforms</label>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            {PLATFORMS.map(p => <button key={p} style={pChip(form.platforms.includes(p))} onClick={() => togglePlatform(p)}>{p}</button>)}
          </div>
        </div>
        <button style={btn('accent')} onClick={() => generate.mutate(form)} disabled={generating || !form.topic || form.platforms.length === 0}>
          <Wand2 size={15} />{generating ? 'Generating…' : 'Generate Calendar'}
        </button>
        {generate.isError && <p style={{ color: 'var(--danger)', marginTop: '0.5rem', fontSize: '0.82rem' }}>{generate.error.message}</p>}
      </div>
      {genResult && (
        <div style={{ background: 'rgba(139,92,246,0.08)', border: '1px solid rgba(139,92,246,0.3)', borderRadius: 'var(--radius)', padding: '1.25rem', marginBottom: '1.5rem' }}>
          <h3 style={{ color: 'var(--text)', margin: '0 0 0.75rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}><Calendar size={16} /> Generated Calendar</h3>
          {(genResult.posts || genResult.schedule || []).map((p, i) => (
            <div key={i} style={{ borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--accent)', fontWeight: 600 }}>{p.date} · {p.platform}</span>
              <p style={{ color: 'var(--text)', fontSize: '0.85rem', margin: '0.2rem 0 0' }}>{p.content || p.caption}</p>
            </div>
          ))}
        </div>
      )}
      <h2 style={{ color: 'var(--text)', fontSize: '1rem', marginBottom: '1rem' }}>Saved Calendars</h2>
      {isLoading && <p style={{ color: 'var(--text2)' }}>Loading…</p>}
      {data?.map(c => (
        <div key={c.id} style={card}>
          <div>
            <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: '0.2rem' }}>{c.topic || c.name}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text2)' }}>{c.duration_days} days · {(c.platforms || []).join(', ')}</div>
          </div>
          <button style={btn('danger')} onClick={() => del.mutate(c.id)}><Trash2 size={13} /></button>
        </div>
      ))}
    </div>
  );
}
