import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { RefreshCw, Plus, Trash2, ToggleLeft, ToggleRight } from 'lucide-react'

const tok = () => localStorage.getItem('fp_token')
const api = (url, opts={}) => fetch(url, {headers:{'Authorization':`Bearer ${tok()}`,'Content-Type':'application/json'},...opts}).then(r=>r.json())

export default function RecyclePage() {
  const qc = useQueryClient()
  const [postId, setPostId] = useState('')

  const { data, isLoading } = useQuery({ queryKey: ['recycle'], queryFn: () => api('/api/recycle') })

  const addMut = useMutation({
    mutationFn: (body) => api('/api/recycle', { method: 'POST', body: JSON.stringify(body) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['recycle'] }); setPostId('') }
  })

  const toggleMut = useMutation({
    mutationFn: ({ id, active }) => api(`/api/recycle/${id}`, { method: 'PUT', body: JSON.stringify({ active }) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recycle'] })
  })

  const removeMut = useMutation({
    mutationFn: (id) => api(`/api/recycle/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['recycle'] })
  })

  const posts = data?.posts || data || []

  return (
    <div style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 700, color: 'var(--text)' }}>Evergreen Recycle</h1>
          <p style={{ color: 'var(--text2)', fontSize: '14px' }}>Automatically re-publish your best posts.</p>
        </div>
      </div>

      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '20px', marginBottom: '24px' }}>
        <h3 style={{ color: 'var(--text)', marginBottom: '12px' }}>Add Post to Recycle Queue</h3>
        <div style={{ display: 'flex', gap: '12px' }}>
          <input value={postId} onChange={e => setPostId(e.target.value)} placeholder="Post ID or URL" style={{ flex: 1, padding: '8px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text)' }} />
          <button onClick={() => addMut.mutate({ post_id: postId })} disabled={!postId || addMut.isPending} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius)', cursor: 'pointer' }}>
            <Plus size={16} /> {addMut.isPending ? 'Adding...' : 'Add to Queue'}
          </button>
        </div>
      </div>

      {isLoading ? <p style={{ color: 'var(--text2)' }}>Loading...</p> : posts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text2)' }}>
          <RefreshCw size={48} style={{ margin: '0 auto 16px' }} />
          <p>No posts in recycle queue. Add evergreen posts to automatically re-share them.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {posts.map(post => (
            <div key={post.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ flex: 1 }}>
                <p style={{ color: 'var(--text)', fontSize: '14px', marginBottom: '4px' }}>{post.content || post.post_id}</p>
                <div style={{ display: 'flex', gap: '16px' }}>
                  <span style={{ color: 'var(--text2)', fontSize: '12px' }}>Recycled {post.recycle_count ?? 0}x</span>
                  {post.last_recycled && <span style={{ color: 'var(--text2)', fontSize: '12px' }}>Last: {new Date(post.last_recycled).toLocaleDateString()}</span>}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <button onClick={() => toggleMut.mutate({ id: post.id, active: !post.active })} style={{ background: 'none', border: 'none', cursor: 'pointer', color: post.active ? 'var(--success)' : 'var(--text2)' }}>
                  {post.active ? <ToggleRight size={24} /> : <ToggleLeft size={24} />}
                </button>
                <button onClick={() => removeMut.mutate(post.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)' }}><Trash2 size={16} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
