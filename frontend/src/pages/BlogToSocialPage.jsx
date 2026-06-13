import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { BookOpen, Wand2 } from 'lucide-react';

const token = () => localStorage.getItem('fp_token');
const h = () => ({ Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' });

export default function BlogToSocialPage() {
  const [url, setUrl] = useState('');
  const [results, setResults] = useState(null);

  const convert = useMutation({
    mutationFn: async (blogUrl) => {
      const r = await fetch('/api/blog-to-social', { method: 'POST', headers: h(), body: JSON.stringify({ url: blogUrl }) });
      if (!r.ok) throw new Error('Conversion failed');
      const j = await r.json(); return j.data || j;
    },
    onSuccess: (data) => setResults(data),
  });

  const page = { padding: '2rem', maxWidth: '760px' };
  const input = { flex: 1, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text)', padding: '0.65rem 0.9rem', fontSize: '0.9rem' };
  const btn = { padding: '0.6rem 1.25rem', borderRadius: 'var(--radius)', background: 'var(--accent)', border: 'none', color: 'var(--text)', cursor: 'pointer', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 };
  const postCard = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1rem 1.25rem', marginBottom: '0.75rem' };
  const platformBadge = { padding: '0.18rem 0.6rem', borderRadius: '99px', fontSize: '0.72rem', background: 'var(--accent)', color: 'var(--text)', marginBottom: '0.5rem', display: 'inline-block' };

  return (
    <div style={page}>
      <h1 style={{ color: 'var(--text)', margin: '0 0 0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><BookOpen size={22} /> Blog to Social</h1>
      <p style={{ color: 'var(--text2)', marginBottom: '1.5rem', fontSize: '0.9rem' }}>Paste a blog URL and AI will generate social posts for each platform.</p>
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem' }}>
        <input style={input} type="url" placeholder="https://yourblog.com/post…" value={url} onChange={e => setUrl(e.target.value)} onKeyDown={e => e.key === 'Enter' && convert.mutate(url)} />
        <button style={btn} onClick={() => convert.mutate(url)} disabled={convert.isPending || !url}>
          <Wand2 size={15} />{convert.isPending ? 'Converting…' : 'Convert'}
        </button>
      </div>
      {convert.isError && <p style={{ color: 'var(--danger)', marginBottom: '1rem' }}>{convert.error.message}</p>}
      {results && (
        <div>
          <h2 style={{ color: 'var(--text)', fontSize: '1rem', marginBottom: '1rem' }}>Generated Posts</h2>
          {(Array.isArray(results) ? results : results.posts || []).map((p, i) => (
            <div key={i} style={postCard}>
              <div style={platformBadge}>{p.platform || 'Social'}</div>
              <p style={{ color: 'var(--text)', margin: 0, fontSize: '0.88rem', lineHeight: 1.6 }}>{p.content || p.caption || p.text}</p>
            </div>
          ))}
          {results.url && <div style={postCard}><p style={{ color: 'var(--text)', margin: 0 }}>{JSON.stringify(results)}</p></div>}
        </div>
      )}
    </div>
  );
}
