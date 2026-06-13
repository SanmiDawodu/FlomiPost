import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { GalleryHorizontal, Plus, Trash2, Send } from 'lucide-react';

const token = () => localStorage.getItem('fp_token');
const h = () => ({ Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' });

export default function CarouselPage() {
  const [title, setTitle] = useState('');
  const [slides, setSlides] = useState([{ headline: '', body: '' }]);
  const [saved, setSaved] = useState(null);

  const create = useMutation({
    mutationFn: async (p) => {
      const r = await fetch('/api/carousel', { method: 'POST', headers: h(), body: JSON.stringify(p) });
      if (!r.ok) throw new Error('Failed to create carousel');
      return r.json();
    },
    onSuccess: (d) => setSaved(d.data || d),
  });

  const addSlide = () => setSlides(s => [...s, { headline: '', body: '' }]);
  const removeSlide = (i) => setSlides(s => s.filter((_, idx) => idx !== i));
  const updateSlide = (i, key, val) => setSlides(s => s.map((sl, idx) => idx === i ? { ...sl, [key]: val } : sl));

  const page = { padding: '2rem', maxWidth: '760px' };
  const input = { width: '100%', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text)', padding: '0.6rem 0.75rem', fontSize: '0.9rem', boxSizing: 'border-box', marginBottom: '0.5rem' };
  const btn = (v) => ({ padding: '0.45rem 0.9rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: v === 'accent' ? 'var(--accent)' : 'transparent', color: v === 'danger' ? 'var(--danger)' : 'var(--text)', cursor: 'pointer', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: '0.35rem' });
  const slideCard = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1rem', marginBottom: '0.75rem' };

  return (
    <div style={page}>
      <h1 style={{ color: 'var(--text)', margin: '0 0 1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><GalleryHorizontal size={22} /> Carousel Builder</h1>
      {saved && <div style={{ background: 'rgba(34,197,94,0.1)', border: '1px solid var(--success)', borderRadius: 'var(--radius)', padding: '0.75rem 1rem', color: 'var(--success)', marginBottom: '1rem' }}>Carousel saved! ID: {saved.id}</div>}
      {create.isError && <p style={{ color: 'var(--danger)' }}>{create.error.message}</p>}
      <input style={input} placeholder="Carousel title" value={title} onChange={e => setTitle(e.target.value)} />
      <h3 style={{ color: 'var(--text)', margin: '1rem 0 0.75rem' }}>Slides</h3>
      {slides.map((sl, i) => (
        <div key={i} style={slideCard}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ color: 'var(--text2)', fontSize: '0.8rem' }}>Slide {i + 1}</span>
            {slides.length > 1 && <button style={btn('danger')} onClick={() => removeSlide(i)}><Trash2 size={12} /></button>}
          </div>
          <input style={input} placeholder="Headline" value={sl.headline} onChange={e => updateSlide(i, 'headline', e.target.value)} />
          <textarea style={{ ...input, minHeight: '80px', resize: 'vertical' }} placeholder="Body text…" value={sl.body} onChange={e => updateSlide(i, 'body', e.target.value)} />
        </div>
      ))}
      <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
        <button style={btn('default')} onClick={addSlide}><Plus size={14} /> Add Slide</button>
        <button style={btn('accent')} onClick={() => create.mutate({ title, slides })} disabled={create.isPending || !title}><Send size={14} />{create.isPending ? 'Saving…' : 'Save Carousel'}</button>
      </div>
    </div>
  );
}
