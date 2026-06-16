// PostsPage.jsx
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { api } from '../utils/api'
import { useMultiSelect } from '../hooks/useMultiSelect'
import BulkActionBar from '../components/BulkActionBar'
import toast from 'react-hot-toast'
import { Plus, Edit2, Trash2, Send, FileText } from 'lucide-react'
import { format, parseISO } from 'date-fns'

const STATUSES = ['', 'draft', 'scheduled', 'published', 'failed']
const PER_PAGE = 50

// Upcoming-focused tabs show the next post to fire first; history tabs show
// newest first. 'smart' = upcoming soonest-first, then past newest-first.
const SORT_BY_STATUS = { '': 'smart', draft: 'smart', scheduled: 'asc', published: 'desc', failed: 'desc' }

export default function PostsPage() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['posts', status, page],
    queryFn: () => api.get(`/posts?status=${status}&page=${page}&per_page=${PER_PAGE}&sort=${SORT_BY_STATUS[status] ?? 'desc'}`),
  })

  const posts = data?.data ?? []
  const total = data?.meta?.total ?? posts.length
  const pages = Math.max(1, Math.ceil(total / PER_PAGE))

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

  const fmtDate = (s) => {
    if (!s) return '—'
    try { return format(parseISO(s), 'MMM d, yyyy HH:mm') } catch { return s }
  }

  return (
    <div>
      <div className="fp-page-header">
        <div>
          <div className="fp-page-title">Posts</div>
          <div className="fp-page-sub">{total} post{total === 1 ? '' : 's'}</div>
        </div>
        <button className="fp-btn fp-btn-primary" onClick={() => navigate('/compose')}>
          <Plus size={16}/> New Post
        </button>
      </div>

      <div className="fp-tabs">
        {STATUSES.map(s => (
          <div key={s} className={`fp-tab ${status === s ? 'active' : ''}`}
            style={{textTransform:'capitalize'}}
            onClick={() => { setStatus(s); setPage(1); ms.clear() }}>
            {s || 'All'}
          </div>
        ))}
      </div>

      <div className="fp-card">
        <div className="fp-card-title"><FileText size={15}/> {status ? `${status} posts` : 'All posts'}</div>
        {isLoading ? <div className="fp-loader"><div className="fp-spinner"/></div>
        : posts.length === 0 ? (
          <div className="fp-empty">
            <div className="fp-empty-icon">📝</div>
            <h3>No posts found</h3>
            <p>Create a post to see it here.</p>
          </div>
        ) : (
          <div className="fp-table-wrap">
            <table className="fp-table">
              <thead>
                <tr>
                  <th style={{width:36}}>
                    <input type="checkbox" checked={ms.allSelected}
                      ref={el => el && (el.indeterminate = ms.someSelected)}
                      onChange={ms.toggleAll}
                      style={{accentColor:'var(--violet)',width:15,height:15,cursor:'pointer'}}/>
                  </th>
                  <th>Caption</th>
                  <th>Site</th>
                  <th>Status</th>
                  <th>Scheduled</th>
                  <th/>
                </tr>
              </thead>
              <tbody>
                {posts.map(post => (
                  <tr key={post.id} style={ms.selected.has(post.id) ? {background:'var(--violet-lt)'} : undefined}>
                    <td>
                      <input type="checkbox" checked={ms.selected.has(post.id)} onChange={() => ms.toggle(post.id)}
                        style={{accentColor:'var(--violet)',width:15,height:15,cursor:'pointer'}}/>
                    </td>
                    <td style={{maxWidth:340}}>
                      <div style={{overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                        {post.caption || <span style={{color:'var(--text3)'}}>(no caption)</span>}
                      </div>
                    </td>
                    <td style={{fontSize:11,color:'var(--text3)',whiteSpace:'nowrap'}}>{post.site_name || '—'}</td>
                    <td><span className={`fp-badge fp-badge-${post.status}`}>{post.status}</span></td>
                    <td style={{fontFamily:'JetBrains Mono,monospace',fontSize:12,whiteSpace:'nowrap'}}>{fmtDate(post.scheduled_at)}</td>
                    <td>
                      <div style={{display:'flex',gap:6,justifyContent:'flex-end'}}>
                        {post.status === 'draft' && (
                          <button className="fp-btn fp-btn-ghost fp-btn-xs" title="Publish now"
                            disabled={publishMutation.isPending}
                            onClick={() => publishMutation.mutate(post.id)}>
                            <Send size={13}/>
                          </button>
                        )}
                        <button className="fp-btn fp-btn-ghost fp-btn-xs" title="Edit"
                          onClick={() => navigate(`/compose/${post.id}`)}>
                          <Edit2 size={13}/>
                        </button>
                        <button className="fp-btn fp-btn-danger fp-btn-xs" title="Delete"
                          onClick={() => confirmDelete([post.id])}>
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
      </div>

      {pages > 1 && (
        <div style={{display:'flex',justifyContent:'center',alignItems:'center',gap:10,marginTop:16}}>
          <button className="fp-btn fp-btn-ghost fp-btn-sm" disabled={page === 1}
            onClick={() => setPage(p => Math.max(1, p - 1))}>Prev</button>
          <span style={{fontSize:13,color:'var(--text3)'}}>Page {page} of {pages}</span>
          <button className="fp-btn fp-btn-ghost fp-btn-sm" disabled={page >= pages}
            onClick={() => setPage(p => p + 1)}>Next</button>
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
