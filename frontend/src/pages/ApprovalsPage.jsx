import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../utils/api'
import { useMultiSelect } from '../hooks/useMultiSelect'
import BulkActionBar from '../components/BulkActionBar'
import toast from 'react-hot-toast'
import { CheckCircle, XCircle, Send, CheckSquare } from 'lucide-react'

const STATUS_COLORS = {
  pending:  'text-yellow-400',
  approved: 'text-green-400',
  rejected: 'text-red-400',
  draft:    'text-gray-400',
}

export default function ApprovalsPage() {
  const qc = useQueryClient()
  const [status, setStatus] = useState('pending')
  const [rejectId, setRejectId] = useState(null)
  const [rejectNote, setRejectNote] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['approvals', status],
    queryFn: () => api.get(`/approvals?status=${status}`).then(r => r.data.data ?? r.data),
  })

  const posts = data ?? []
  const ms = useMultiSelect(posts)

  const approveMutation = useMutation({
    mutationFn: (ids) => Promise.all(ids.map(id => api.post(`/approvals/${id}/approve`))),
    onSuccess: (_, ids) => {
      qc.invalidateQueries({ queryKey: ['approvals'] })
      toast.success(`${ids.length} post${ids.length > 1 ? 's' : ''} approved`)
      ms.clear()
    },
    onError: (e) => toast.error(e.message),
  })

  const rejectMutation = useMutation({
    mutationFn: ({ id, note }) => api.post(`/approvals/${id}/reject`, { note }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['approvals'] })
      toast.success('Post rejected')
      setRejectId(null); setRejectNote('')
    },
    onError: (e) => toast.error(e.message),
  })

  const requestMutation = useMutation({
    mutationFn: (ids) => Promise.all(ids.map(id => api.post(`/approvals/${id}/request`))),
    onSuccess: (_, ids) => {
      qc.invalidateQueries({ queryKey: ['approvals'] })
      toast.success(`Approval requested for ${ids.length} post${ids.length > 1 ? 's' : ''}`)
      ms.clear()
    },
    onError: (e) => toast.error(e.message),
  })

  const bulkApproveActions = status === 'pending' ? (
    <>
      <button
        onClick={() => approveMutation.mutate([...ms.selected])}
        disabled={approveMutation.isPending}
        className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600/20 text-green-400 rounded-lg text-sm hover:bg-green-600/30 disabled:opacity-40 transition-colors"
      ><CheckSquare size={14}/> Approve all</button>
    </>
  ) : null

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Post Approvals</h1>

      <div className="flex gap-2 mb-6">
        {['pending','approved','rejected','draft'].map(s => (
          <button key={s} onClick={() => { setStatus(s); ms.clear() }}
            className={`px-4 py-1.5 rounded-full text-sm font-medium capitalize transition-colors ${status === s ? 'bg-purple-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
          >{s}</button>
        ))}
      </div>

      {posts.length > 0 && (
        <div className="flex items-center gap-3 mb-4">
          <input type="checkbox" checked={ms.allSelected} ref={el => el && (el.indeterminate = ms.someSelected)}
            onChange={ms.toggleAll} className="accent-purple-500 w-4 h-4"/>
          <span className="text-sm text-gray-400">{ms.count > 0 ? `${ms.count} selected` : 'Select all'}</span>
        </div>
      )}

      {isLoading && <p className="text-gray-400">Loading…</p>}
      {!isLoading && posts.length === 0 && <p className="text-gray-500 text-center py-16">No {status} posts</p>}

      <div className="space-y-3">
        {posts.map(post => (
          <div key={post.id}
            className={`border rounded-xl p-4 transition-colors ${ms.selected.has(post.id) ? 'border-purple-500/50 bg-purple-500/10' : 'bg-white/5 border-white/10'}`}>
            <div className="flex items-start gap-3">
              <input type="checkbox" checked={ms.selected.has(post.id)} onChange={() => ms.toggle(post.id)}
                className="accent-purple-500 w-4 h-4 mt-1 shrink-0"/>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-300 line-clamp-3">{post.caption}</p>
                <div className="flex gap-3 mt-2 text-xs text-gray-500">
                  <span>By {post.author_name}</span>
                  {post.scheduled_at && <span>Scheduled: {new Date(post.scheduled_at).toLocaleString()}</span>}
                  <span className={`font-medium capitalize ${STATUS_COLORS[post.approval_status]}`}>{post.approval_status}</span>
                </div>
                {post.approval_note && <p className="text-xs text-red-400 mt-1">Note: {post.approval_note}</p>}
              </div>
              <div className="flex gap-2 shrink-0">
                {post.approval_status === 'draft' && (
                  <button onClick={() => requestMutation.mutate([post.id])}
                    className="flex items-center gap-1 px-3 py-1.5 bg-blue-600/20 text-blue-400 rounded-lg text-xs hover:bg-blue-600/30 transition-colors"
                  ><Send size={12}/> Request</button>
                )}
                {post.approval_status === 'pending' && (
                  <>
                    <button onClick={() => approveMutation.mutate([post.id])}
                      className="flex items-center gap-1 px-3 py-1.5 bg-green-600/20 text-green-400 rounded-lg text-xs hover:bg-green-600/30 transition-colors"
                    ><CheckCircle size={12}/> Approve</button>
                    <button onClick={() => setRejectId(post.id)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-red-600/20 text-red-400 rounded-lg text-xs hover:bg-red-600/30 transition-colors"
                    ><XCircle size={12}/> Reject</button>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {rejectId && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a0f4e] border border-white/10 rounded-2xl p-6 w-full max-w-md">
            <h3 className="font-semibold mb-3">Rejection Reason</h3>
            <textarea
              className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-sm resize-none h-24 focus:outline-none focus:border-purple-500"
              placeholder="Explain why this post is being rejected…"
              value={rejectNote} onChange={e => setRejectNote(e.target.value)}/>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setRejectId(null)} className="px-4 py-2 text-sm text-gray-400 hover:text-white">Cancel</button>
              <button onClick={() => rejectMutation.mutate({ id: rejectId, note: rejectNote })}
                disabled={!rejectNote.trim()}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg disabled:opacity-40 hover:bg-red-700 transition-colors"
              >Reject Post</button>
            </div>
          </div>
        </div>
      )}

      <BulkActionBar
        count={ms.count}
        onDelete={null}
        onClear={ms.clear}
        deleting={false}
        extraActions={bulkApproveActions}
      />
    </div>
  )
}
