import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, Plus, Trash2, TrendingUp } from 'lucide-react'

const tok = () => localStorage.getItem('fp_token')
const api = (url, opts={}) => fetch(url, {headers:{'Authorization':`Bearer ${tok()}`,'Content-Type':'application/json'},...opts}).then(r=>r.json())

export default function SocialListeningPage() {
  const qc = useQueryClient()
  const [keyword, setKeyword] = useState('')

  const { data, isLoading } = useQuery({ queryKey: ['listening-keywords'], queryFn: () => api('/api/listening/keywords') })

  const add = useMutation({
    mutationFn: () => api('/api/listening/keywords', { method: 'POST', body: JSON.stringify({ keyword }) }),
    onSuccess: () => { qc.invalidateQueries(['listening-keywords']); setKeyword('') }
  })

  const del = useMutation({
    mutationFn: (id) => api(`/api/listening/keywords/${id}`, { method: 'DELETE' }),
    onSuccess: () => qc.invalidateQueries(['listening-keywords'])
  })

  const items = data?.data || data || []

  return (
    <div style={{ padding: '2rem', maxWidth: 760 }}>
      <h1 style={{ color: 'var(--text)', margin: '0 0 1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <Search size={22} /> Social Listening
      </h1>
      <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '2rem' }}>
        <input
          value={keyword}
          onChange={e => setKeyword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && keyword.trim() && add.mutate()}
          placeholder="Add keyword to monitor…"
          style={{ flex: 1, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', color: 'var(--text)', padding: '0.6rem 0.75rem', fontSize: '0.9rem' }}
        />
        <button onClick={() => keyword.trim() && add.mutate()} disabled={add.isPending || !keyword.trim()}
          style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--accent)', color: '#fff', border: 'none', borderRadius: 'var(--radius)', padding: '0 16px', cursor: 'pointer', fontWeight: 600 }}>
          <Plus size={16} /> Add
        </button>
      </div>

      {isLoading && <p style={{ color: 'var(--text2)' }}>Loading…</p>}
      {items.length === 0 && !isLoading && <p style={{ color: 'var(--text2)' }}>No keywords monitored yet.</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
        {items.map(item => (
          <div key={item.id} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <span style={{ fontWeight: 600, color: 'var(--text)' }}>{item.keyword}</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text2)', display: 'flex', alignItems: 'center', gap: 4 }}>
                <TrendingUp size={13} /> {item.mention_count ?? 0} mentions
              </span>
            </div>
            <button onClick={() => del.mutate(item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--danger)' }}>
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
