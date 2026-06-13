import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRef } from 'react';
import { Image, Upload, Trash2 } from 'lucide-react';

const token = () => localStorage.getItem('fp_token');
const authHeader = () => ({ Authorization: `Bearer ${token()}` });

export default function MediaPage() {
  const qc = useQueryClient();
  const fileRef = useRef(null);

  const { data, isLoading, error } = useQuery({
    queryKey: ['media'],
    queryFn: async () => {
      const r = await fetch('/api/media', { headers: authHeader() });
      if (!r.ok) throw new Error('Failed to fetch media');
      const j = await r.json(); return j.data || j;
    },
  });

  const upload = useMutation({
    mutationFn: async (file) => {
      const fd = new FormData(); fd.append('file', file);
      const r = await fetch('/api/media', { method: 'POST', headers: authHeader(), body: fd });
      if (!r.ok) throw new Error('Upload failed');
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['media'] }),
  });

  const remove = useMutation({
    mutationFn: async (id) => {
      const r = await fetch(`/api/media/${id}`, { method: 'DELETE', headers: authHeader() });
      if (!r.ok) throw new Error('Delete failed');
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['media'] }),
  });

  const handleFile = (e) => { if (e.target.files[0]) upload.mutate(e.target.files[0]); };

  const page = { padding: '2rem', maxWidth: '1100px' };
  const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '1rem', marginTop: '1.5rem' };
  const cell = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden', position: 'relative' };
  const btn = { padding: '0.4rem 0.9rem', borderRadius: 'var(--radius)', border: '1px solid var(--border)', background: 'var(--accent)', color: 'var(--text)', cursor: 'pointer', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: '0.35rem' };

  return (
    <div style={page}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <h1 style={{ color: 'var(--text)', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Image size={22} /> Media Library</h1>
        <button style={btn} onClick={() => fileRef.current?.click()}>
          <Upload size={15} /> Upload
        </button>
        <input ref={fileRef} type="file" accept="image/*,video/*" style={{ display: 'none' }} onChange={handleFile} />
      </div>
      {upload.isPending && <p style={{ color: 'var(--text2)' }}>Uploading…</p>}
      {upload.isError && <p style={{ color: 'var(--danger)' }}>{upload.error.message}</p>}
      {isLoading && <p style={{ color: 'var(--text2)' }}>Loading…</p>}
      {error && <p style={{ color: 'var(--danger)' }}>{error.message}</p>}
      <div style={grid}>
        {data?.map(m => (
          <div key={m.id} style={cell}>
            {m.mime_type?.startsWith('video') ? (
              <video src={m.url} style={{ width: '100%', height: '120px', objectFit: 'cover' }} />
            ) : (
              <img src={m.url || m.thumbnail_url} alt={m.filename} style={{ width: '100%', height: '120px', objectFit: 'cover' }} />
            )}
            <div style={{ padding: '0.5rem' }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.filename || m.name}</div>
              <button onClick={() => remove.mutate(m.id)} style={{ marginTop: '0.4rem', background: 'transparent', border: 'none', color: 'var(--danger)', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem' }}>
                <Trash2 size={12} /> Delete
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
