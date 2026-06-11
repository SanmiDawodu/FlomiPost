import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../utils/api'
import toast from 'react-hot-toast'
import { Plus, Trash2, Send, ChevronDown, ChevronUp, Copy, Check } from 'lucide-react'

const ALL_EVENTS = [
  'post.published', 'post.failed', 'post.approved', 'post.rejected',
  'queue.processed', 'webhook.test',
]

export default function WebhooksPage() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [url, setUrl] = useState('')
  const [events, setEvents] = useState(['post.published', 'post.failed'])
  const [expandedId, setExpandedId] = useState(null)
  const [copiedId, setCopiedId] = useState(null)

  const { data: webhooks = [], isLoading } = useQuery({
    queryKey: ['webhooks'],
    queryFn: () => api.get('/webhooks').then(r => r.data.data ?? r.data),
  })

  const { data: deliveries } = useQuery({
    queryKey: ['wh-deliveries', expandedId],
    queryFn: () => api.get(`/webhooks/${expandedId}/deliveries`).then(r => r.data.data ?? r.data),
    enabled: !!expandedId,
  })

  const createMutation = useMutation({
    mutationFn: () => api.post('/webhooks', { url, events }),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['webhooks'] })
      toast.success('Webhook created')
      const secret = res.data.data?.secret
      if (secret) toast(`Save your secret: ${secret}`, { duration: 10000, icon: '🔑' })
      setShowForm(false); setUrl(''); setEvents(['post.published','post.failed'])
    },
    onError: (e) => toast.error(e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/webhooks/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['webhooks'] }); toast.success('Deleted') },
    onError: (e) => toast.error(e.message),
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, active }) => api.put(`/webhooks/${id}`, { active: active ? 0 : 1 }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['webhooks'] }),
    onError: (e) => toast.error(e.message),
  })

  const testMutation = useMutation({
    mutationFn: (id) => api.post(`/webhooks/${id}/test`),
    onSuccess: () => toast.success('Test event sent'),
    onError: (e) => toast.error(e.message),
  })

  const toggleEvent = (ev) => setEvents(prev =>
    prev.includes(ev) ? prev.filter(e => e !== ev) : [...prev, ev]
  )

  const copyUrl = (id, u) => {
    navigator.clipboard.writeText(u)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Outbound Webhooks</h1>
        <button
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-xl text-sm font-medium hover:bg-purple-700 transition-colors"
        ><Plus size={16}/> New Webhook</button>
      </div>

      {showForm && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-6">
          <h3 className="font-semibold mb-4">New Webhook</h3>
          <label className="block text-sm text-gray-400 mb-1">Endpoint URL</label>
          <input
            type="url"
            className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:border-purple-500"
            placeholder="https://your-server.com/webhook"
            value={url}
            onChange={e => setUrl(e.target.value)}
          />
          <label className="block text-sm text-gray-400 mb-2">Events to subscribe</label>
          <div className="flex flex-wrap gap-2 mb-4">
            {ALL_EVENTS.map(ev => (
              <button
                key={ev}
                onClick={() => toggleEvent(ev)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${events.includes(ev) ? 'bg-purple-600 text-white' : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
              >{ev}</button>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-white">Cancel</button>
            <button
              onClick={() => createMutation.mutate()}
              disabled={!url || !events.length || createMutation.isPending}
              className="px-4 py-2 text-sm bg-purple-600 text-white rounded-lg disabled:opacity-40 hover:bg-purple-700 transition-colors"
            >{createMutation.isPending ? 'Creating…' : 'Create Webhook'}</button>
          </div>
        </div>
      )}

      {isLoading && <p className="text-gray-400">Loading…</p>}
      {!isLoading && webhooks.length === 0 && (
        <p className="text-gray-500 text-center py-16">No webhooks yet. Create one to receive real-time events.</p>
      )}

      <div className="space-y-3">
        {webhooks.map(wh => (
          <div key={wh.id} className="bg-white/5 border border-white/10 rounded-xl overflow-hidden">
            <div className="flex items-center gap-3 p-4">
              <div className={`w-2 h-2 rounded-full shrink-0 ${wh.active ? 'bg-green-400' : 'bg-gray-500'}`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-mono truncate">{wh.url}</p>
                  <button onClick={() => copyUrl(wh.id, wh.url)} className="text-gray-500 hover:text-white shrink-0">
                    {copiedId === wh.id ? <Check size={13}/> : <Copy size={13}/>}
                  </button>
                </div>
                <div className="flex flex-wrap gap-1 mt-1">
                  {(typeof wh.events === 'string' ? JSON.parse(wh.events) : wh.events ?? []).map(ev => (
                    <span key={ev} className="text-xs bg-purple-600/20 text-purple-300 px-2 py-0.5 rounded-full">{ev}</span>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => testMutation.mutate(wh.id)}
                  className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-600/20 text-blue-400 rounded-lg text-xs hover:bg-blue-600/30"
                ><Send size={11}/> Test</button>
                <button
                  onClick={() => toggleMutation.mutate({ id: wh.id, active: wh.active })}
                  className={`px-2.5 py-1.5 rounded-lg text-xs ${wh.active ? 'bg-yellow-600/20 text-yellow-400 hover:bg-yellow-600/30' : 'bg-green-600/20 text-green-400 hover:bg-green-600/30'}`}
                >{wh.active ? 'Disable' : 'Enable'}</button>
                <button
                  onClick={() => deleteMutation.mutate(wh.id)}
                  className="p-1.5 text-red-400 hover:bg-red-600/20 rounded-lg"
                ><Trash2 size={14}/></button>
                <button
                  onClick={() => setExpandedId(expandedId === wh.id ? null : wh.id)}
                  className="p-1.5 text-gray-400 hover:text-white"
                >{expandedId === wh.id ? <ChevronUp size={14}/> : <ChevronDown size={14}/>}</button>
              </div>
            </div>

            {expandedId === wh.id && (
              <div className="border-t border-white/10 p-4">
                <p className="text-xs text-gray-400 mb-2 font-semibold">Recent Deliveries</p>
                {!deliveries || deliveries.length === 0
                  ? <p className="text-xs text-gray-500">No deliveries yet</p>
                  : (
                    <div className="space-y-1">
                      {deliveries.map((d, i) => (
                        <div key={i} className="flex items-center gap-3 text-xs">
                          <span className={`font-mono ${d.response_code >= 200 && d.response_code < 300 ? 'text-green-400' : 'text-red-400'}`}>{d.response_code ?? '—'}</span>
                          <span className="text-gray-400">{d.event}</span>
                          <span className="text-gray-600 ml-auto">{d.delivered_at ? new Date(d.delivered_at).toLocaleString() : '—'}</span>
                        </div>
                      ))}
                    </div>
                  )
                }
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
