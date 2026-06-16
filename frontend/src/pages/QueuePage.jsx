// QueuePage.jsx
import { useQuery } from '@tanstack/react-query'
import { queueApi } from '../utils/api'
import { format, parseISO } from 'date-fns'
import { Clock } from 'lucide-react'

export function QueuePage() {
  const { data, isLoading } = useQuery({ queryKey: ['queue'], queryFn: queueApi.list, refetchInterval: 30000 })
  const queue = data?.data ?? []

  return (
    <div>
      <div className="fp-page-header">
        <div>
          <div className="fp-page-title">Publish Queue</div>
          <div className="fp-page-sub">{queue.length} posts pending · refreshes every 30s</div>
        </div>
      </div>
      <div className="fp-card">
        <div className="fp-card-title"><Clock size={15}/> Upcoming</div>
        {isLoading ? <div className="fp-loader"><div className="fp-spinner"/></div>
          : queue.length === 0 ? (
            <div className="fp-empty">
              <div className="fp-empty-icon">✅</div>
              <h3>Queue is empty</h3>
              <p>All caught up! Schedule a post to see it here.</p>
            </div>
          ) : (
          <div className="fp-table-wrap">
            <table className="fp-table">
              <thead><tr><th>Fire At</th><th>Site</th><th>Caption</th><th>Priority</th><th>Attempts</th></tr></thead>
              <tbody>
                {queue.map(item => (
                  <tr key={item.id}>
                    <td style={{fontFamily:'DM Mono,monospace',fontSize:12,color:'var(--gold)'}}>
                      {format(parseISO(item.fire_at),'MMM d, HH:mm')}
                    </td>
                    <td style={{fontSize:11,color:'var(--text3)'}}>{item.site_name}</td>
                    <td style={{maxWidth:300}}>{item.caption?.substring(0,80)}…</td>
                    <td><span className="fp-badge fp-badge-scheduled">{item.priority}</span></td>
                    <td style={{fontSize:11,color:'var(--text3)'}}>{item.attempts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default QueuePage
