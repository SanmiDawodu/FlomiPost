import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../utils/api'
import { useNavigate } from 'react-router-dom'
import { useMultiSelect } from '../hooks/useMultiSelect'
import BulkActionBar from '../components/BulkActionBar'
import toast from 'react-hot-toast'
import { Plus, Trash2, FileText, ArrowRight } from 'lucide-react'

const CHANNELS = ['facebook','instagram','twitter','linkedin','tiktok','telegram','discord','whatsapp']

export default function TemplatesPage() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ name: '', channel: 'facebook', content: '', site_id: '' })
  const [useModal, setUseModal] = useState(null)
  const [schedDate, setSchedDate] = useState('')

  const { data: sitesRes } = useQuery({
    queryKey: ['sites'],
    queryFn: () => api.get('/sites').then(r => r.data),
  })
  const sites = sitesRes?.data ?? sitesRes ?? []

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['templates'],
    queryFn: () => api.get('/templates').then(r => r.data.data ?? r.data),
  })

  const ms = useMultiSelect(templates)

  const createMutation = useMutation({
    mutationFn: () => api.post('/templates', { ...form, site_id: parseInt(form.site_id) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['templates'] })
      toast.success('Template created')
      setShowForm(false)
      setForm({ name: '', channel: 'facebook', content: '', site_id: '' })
    },
    onError: (e) => toast.error(e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (ids) => ids.length === 1
      ? api.delete(`/templates/${ids[0]}`)
      : api.post('/templates/bulk-delete', { ids }),
    onSuccess: (_, ids) => {
      qc.invalidateQueries({ queryKey: ['templates'] })
      toast.success(`${ids.length} template${ids.length > 1 ? 's' : ''} deleted`)
      ms.clear()
    },
    onError: (e) => toast.error(e.message),
  })

  const useMutation2 = useMutation({
    mutationFn: () => api.post(`/templates/${useModal.id}/use`, {
      site_id: useModal.site_id,
      scheduled_at: schedDate || null,
    }),
    onSuccess: (res) => {
      toast.success('Post created from template')
      const postId = res.data.data?.post_id
      setUseModal(null)
      if (postId) navigate(`/compose/${postId}`)
    },
    onError: (e) => toast.error(e.message),
  })

  const confirmDelete = (ids) => {
    if (!window.confirm(`Delete ${ids.length} template${ids.length > 1 ? 's' : ''}?`)) return
    deleteMutation.mutate(ids)
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Post Templates</h1>
        <button onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-xl text-sm font-medium hover:bg-purple-700 transition-colors"
        ><Plus size={16}/> New Template</button>
      </div>

      {showForm && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-6">
          <h3 className="font-semibold mb-4">New Template</h3>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Template Name</label>
              <input className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500"
                placeholder="E.g. Weekly Product Highlight" value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}/>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Channel</label>
              <select className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500"
                value={form.channel} onChange={e => setForm(f => ({ ...f, channel: e.target.value }))}>
                {CHANNELS.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
          <div className="mb-4">
            <label className="block text-sm text-gray-400 mb-1">Site</label>
            <select className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-purple-500"
              value={form.site_id} onChange={e => setForm(f => ({ ...f, site_id: e.target.value }))}>
              <option value="">Select site…</option>
              {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div className="mb-4">
            <label className="block text-sm text-gray-400 mb-1">Content</label>
            <textarea className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm resize-none h-32 focus:outline-none focus:border-purple-500"
              placeholder="Template caption…" value={form.content}
              onChange={e => setForm(f => ({ ...f, content: e.target.value }))}/>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-400 hover:text-white">Cancel</button>
            <button onClick={() => createMutation.mutate()}
              disabled={!form.name || !form.content || !form.site_id || createMutation.isPending}
              className="px-4 py-2 text-sm bg-purple-600 text-white rounded-lg disabled:opacity-40 hover:bg-purple-700 transition-colors"
            >{createMutation.isPending ? 'Creating…' : 'Create Template'}</button>
          </div>
        </div>
      )}

      {templates.length > 0 && (
        <div className="flex items-center gap-3 mb-4">
          <input type="checkbox" checked={ms.allSelected} ref={el => el && (el.indeterminate = ms.someSelected)}
            onChange={ms.toggleAll} className="accent-purple-500 w-4 h-4"/>
          <span className="text-sm text-gray-400">{ms.count > 0 ? `${ms.count} selected` : 'Select all'}</span>
        </div>
      )}

      {isLoading && <p className="text-gray-400">Loading…</p>}
      {!isLoading && templates.length === 0 && (
        <p className="text-gray-500 text-center py-16">No templates yet.</p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {templates.map(tpl => (
          <div key={tpl.id}
            className={`bg-white/5 border rounded-xl p-4 flex flex-col gap-3 transition-colors ${ms.selected.has(tpl.id) ? 'border-purple-500/50 bg-purple-500/10' : 'border-white/10'}`}>
            <div className="flex items-start gap-2">
              <input type="checkbox" checked={ms.selected.has(tpl.id)} onChange={() => ms.toggle(tpl.id)}
                className="accent-purple-500 w-4 h-4 mt-0.5 shrink-0"/>
              <div className="flex items-center justify-between flex-1 min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText size={15} className="text-purple-400 shrink-0"/>
                  <span className="font-medium text-sm truncate">{tpl.name}</span>
                </div>
                <span className="text-xs bg-white/10 text-gray-300 px-2 py-0.5 rounded-full capitalize shrink-0 ml-2">{tpl.channel}</span>
              </div>
            </div>
            <p className="text-xs text-gray-400 line-clamp-3 ml-6">{tpl.content}</p>
            <div className="flex gap-2 mt-auto ml-6">
              <button onClick={() => setUseModal(tpl)}
                className="flex items-center gap-1 px-3 py-1.5 bg-purple-600/20 text-purple-400 rounded-lg text-xs hover:bg-purple-600/30 transition-colors"
              ><ArrowRight size={12}/> Use</button>
              <button onClick={() => confirmDelete([tpl.id])}
                className="ml-auto p-1.5 text-red-400 hover:bg-red-600/20 rounded-lg">
                <Trash2 size={14}/>
              </button>
            </div>
          </div>
        ))}
      </div>

      {useModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-[#1a0f4e] border border-white/10 rounded-2xl p-6 w-full max-w-md">
            <h3 className="font-semibold mb-1">Use Template</h3>
            <p className="text-sm text-gray-400 mb-4">"{useModal.name}" will create a new draft post.</p>
            <label className="block text-sm text-gray-400 mb-1">Schedule (optional)</label>
            <input type="datetime-local"
              className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:border-purple-500"
              value={schedDate} onChange={e => setSchedDate(e.target.value)}/>
            <div className="flex justify-end gap-2">
              <button onClick={() => setUseModal(null)} className="px-4 py-2 text-sm text-gray-400 hover:text-white">Cancel</button>
              <button onClick={() => useMutation2.mutate()} disabled={useMutation2.isPending}
                className="px-4 py-2 text-sm bg-purple-600 text-white rounded-lg disabled:opacity-40 hover:bg-purple-700 transition-colors"
              >{useMutation2.isPending ? 'Creating…' : 'Create Post'}</button>
            </div>
          </div>
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
