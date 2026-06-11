import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../utils/api'
import toast from 'react-hot-toast'
import { CheckCircle, XCircle, AlertCircle, RefreshCw } from 'lucide-react'

const PLATFORM_COLORS = {
  facebook: '#1877f2', instagram: '#e1306c', twitter: '#1da1f2',
  linkedin: '#0a66c2', tiktok: '#ff0050', telegram: '#2ca5e0',
  discord: '#5865f2', whatsapp: '#25d366',
}

function HealthBadge({ rate }) {
  if (rate >= 90) return <span className="text-green-400 flex items-center gap-1"><CheckCircle size={13}/>{rate}%</span>
  if (rate >= 70) return <span className="text-yellow-400 flex items-center gap-1"><AlertCircle size={13}/>{rate}%</span>
  return <span className="text-red-400 flex items-center gap-1"><XCircle size={13}/>{rate}%</span>
}

export default function ChannelHealthPage() {
  const qc = useQueryClient()

  const { data, isLoading, dataUpdatedAt } = useQuery({
    queryKey: ['channel-health'],
    queryFn: () => api.get('/health/channels').then(r => r.data.data ?? r.data),
    refetchInterval: 60000,
  })

  const channels = Array.isArray(data) ? data : []

  const successRate = (ch) => {
    const total = (ch.success_count ?? 0) + (ch.failure_count ?? 0)
    if (!total) return null
    return Math.round((ch.success_count / total) * 100)
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Channel Health</h1>
          {dataUpdatedAt > 0 && (
            <p className="text-xs text-gray-500 mt-0.5">Last updated {new Date(dataUpdatedAt).toLocaleTimeString()}</p>
          )}
        </div>
        <button
          onClick={() => qc.invalidateQueries({ queryKey: ['channel-health'] })}
          className="flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-sm hover:bg-white/10 transition-colors"
        ><RefreshCw size={14}/> Refresh</button>
      </div>

      {isLoading && <p className="text-gray-400">Loading…</p>}

      {!isLoading && channels.length === 0 && (
        <div className="text-center py-16">
          <p className="text-gray-500 mb-2">No health data yet</p>
          <p className="text-xs text-gray-600">Data is recorded automatically as posts are published</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {channels.map(ch => {
          const rate = successRate(ch)
          const color = PLATFORM_COLORS[ch.platform] ?? '#888'
          return (
            <div key={ch.id} className="bg-white/5 border border-white/10 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: color }}/>
                    <span className="font-medium capitalize text-sm">{ch.platform}</span>
                  </div>
                  {ch.account_name && (
                    <p className="text-xs text-gray-500 mt-0.5 truncate max-w-[180px]">{ch.account_name}</p>
                  )}
                </div>
                {rate !== null && <HealthBadge rate={rate}/>}
                {rate === null && <span className="text-xs text-gray-500">No data</span>}
              </div>

              <div className="grid grid-cols-3 gap-2 text-center text-xs mb-3">
                <div className="bg-white/5 rounded-lg p-2">
                  <p className="text-green-400 font-semibold">{ch.success_count ?? 0}</p>
                  <p className="text-gray-500">Success</p>
                </div>
                <div className="bg-white/5 rounded-lg p-2">
                  <p className="text-red-400 font-semibold">{ch.failure_count ?? 0}</p>
                  <p className="text-gray-500">Failed</p>
                </div>
                <div className="bg-white/5 rounded-lg p-2">
                  <p className="text-gray-300 font-semibold">{ch.age_minutes != null ? `${Math.round(ch.age_minutes)}m` : '—'}</p>
                  <p className="text-gray-500">Age</p>
                </div>
              </div>

              {ch.last_error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-2">
                  <p className="text-xs text-red-400 line-clamp-2">{ch.last_error}</p>
                </div>
              )}

              {rate !== null && (
                <div className="mt-3">
                  <div className="w-full bg-white/10 rounded-full h-1.5">
                    <div
                      className="h-1.5 rounded-full transition-all"
                      style={{ width: `${rate}%`, background: rate >= 90 ? '#10b981' : rate >= 70 ? '#f59e0b' : '#ef4444' }}
                    />
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
