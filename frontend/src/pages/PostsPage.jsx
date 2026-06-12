import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { api } from '../utils/api'
import { useMultiSelect } from '../hooks/useMultiSelect'
import BulkActionBar from '../components/BulkActionBar'
import toast from 'react-hot-toast'
import { Plus, Edit2, Trash2, Send } from 'lucide-react'

const STATUS_COLORS = {
  draft:     'bg-gray-500/20 text-gray-400',
  scheduled: 'bg-blue-500/20 text-blue-400',
  published: 'bg-green-500/20 text-green-400',
  failed:    'bg-red-500/20 text-red-400',
  cancelled: 'bg-yellow-500/20 text-yellow-400',
}

export default function PostsPage() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['posts', status, page],
    queryFn: () => api.get(`/posts?status=${status}&page=${page}&per_page=50`).then(r => r.data),
  })

  const posts = data?.data ?? data?.items ?? []
  const total = data?.total ?? 0

  const ms = useMultiSelect(posts)

  const deleteMutation = useMutation({
    mutationFn: (ids) => ids.length === 1
      ? api.delete(`/posts/${ids[0]}`)
      : api.post('/posts/bulk-delete', { ids }),
    onSuccess: (_, ids) => {
      qc.invalidateQueries({ queryKey: ['posts'] })
      toast.success(`${ids.length} post${ids.length > 1 ? 's' : ''} deleted`)
      ms.clear()
    },
    onError: (e) => toast.error(e.message),
  })

  const publishMutation = useMutation({
    mutationFn: (id) => api.post(`/posts/${id}/publish-now`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['posts'] }); toast.success('Publishing now…') },
    onError: (e) => toast.error(e.message),
  })

  const confirmDelete = (ids) => {
    if (!window.confirm(`Delete ${ids.length} post${ids.length > 1 ? 's' : ''}?`)) return
    deleteMutation.mutate(ids)
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Posts</h1>
        <button
          onClick={() => navigate('/compose')}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-xl text-sm font-medium hover:bg-purple-700 transition-colors"
        ><Plus size={16}/> New Post</button>
      </div>

      <div className="flex gap-2 mb-5 flex-wrap">
        {['','draft','scheduled','published','failed'].map(s => (
          <button key={s} onClick={() => { setStatus(s); setPage(1) }}
            className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize transition-colors ${status === s ? 'bg-purple-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
          >{s || 'All'}</button>
        ))}
      </div>

      {isLoading && <p className="text-gray-400">Loading…</p>}
      {!isLoading && posts.length === 0 && <p className="text-gray-500 text-center py-16">No posts found</p>}

      {posts.length > 0 && (
        <div className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10 text-xs text-gray-500">
                <th className="p-3 w-10">
                  <input type="checkbox" checked={ms.allSelected} ref={el => el && (el.indeterminate = ms.someSelected)}
                    onChange={ms.toggleAll} className="accent-purple-500 w-4 h-4"/>
                </th>
                <th className="p-3 text-left">Caption</th>
                <th className="p-3 text-left">Status</th>
                <th className="p-3 text-left">Scheduled</th>
                <th className="p-3 w-24"/>
              </tr>
            </thead>
            <tbody>
              {posts.map(post => (
                <tr key={post.id} className={`border-b border-white/5 hover:bg-white/5 transition-colors ${ms.selected.has(post.id) ? 'bg-purple-500/10' : ''}`}>
                  <td className="p-3">
                    <input type="checkbox" checked={ms.selected.has(post.id)} onChange={() => ms.toggle(post.id)}
                      className="accent-purple-500 w-4 h-4"/>
                  </td>
                  <td className="p-3 max-w-xs">
                    <p className="text-sm text-gray-200 truncate">{post.caption || '(no caption)'}</p>
                  </td>
                  <td className="p-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full capitalize font-medium ${STATUS_COLORS[post.status] ?? 'bg-gray-500/20 text-gray-400'}`}>{post.status}</span>
                  </td>
                  <td className="p-3 text-xs text-gray-400">
                    {post.scheduled_at ? new Date(post.scheduled_at).toLocaleString() : '—'}
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-1 justify-end">
                      {post.status === 'draft' && (
                        <button onClick={() => publishMutation.mutate(post.id)}
                          className="p-1.5 text-blue-400 hover:bg-blue-600/20 rounded-lg" title="Publish now">
                          <Send size={13}/>
                        </button>
                      )}
                      <button onClick={() => navigate(`/compose/${post.id}`)}
                        className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg">
                        <Edit2 size={13}/>
                      </button>
                      <button onClick={() => confirmDelete([post.id])}
                        className="p-1.5 text-red-400 hover:bg-red-600/20 rounded-lg">
                        <Trash2 size={13}/>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {total > 50 && (
        <div className="flex justify-center gap-2 mt-4">
          <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1}
            className="px-3 py-1.5 text-sm bg-white/5 rounded-lg disabled:opacity-40 hover:bg-white/10">Prev</button>
          <span className="px-3 py-1.5 text-sm text-gray-400">Page {page}</span>
          <button onClick={() => setPage(p => p+1)} disabled={posts.length < 50}
            className="px-3 py-1.5 text-sm bg-white/5 rounded-lg disabled:opacity-40 hover:bg-white/10">Next</button>
        </div>
      )}

      <BulkActionBar
        count={ms.count}
        onDelete={() => confirmDelete([...ms.selected])}
        onClear={ms.clear}
        deleting={deleteMutation.isPending}
      />
    </div>
  )
}
