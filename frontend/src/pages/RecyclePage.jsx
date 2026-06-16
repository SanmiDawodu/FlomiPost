import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { postsApi } from '../utils/api'
import { RotateCcw, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { format, parseISO } from 'date-fns'

export default function RecyclePage() {
  const qc = useQueryClient()
  const { data, isLoading } = useQuery({ queryKey: ['posts-recycled'], queryFn: () => postsApi.list({ status: 'draft', per_page: 50 }) })
  const posts = data?.data ?? []

  return (
    <div>
      <div className="fp-page-header">
        <div>
          <div className="fp-page-title">Recycle</div>
          <div className="fp-page-sub">Reuse and repurpose your best performing posts</div>
        </div>
      </div>
      <div className="fp-card">
        <div style={{fontSize:13,color:'var(--text3)',marginBottom:16}}>Select posts to reschedule or duplicate</div>
        {isLoading ? <div style={{textAlign:'center',padding:40,color:'var(--text3)'}}>Loading...</div>
        : posts.length === 0 ? <div style={{textAlign:'center',padding:40,color:'var(--text3)'}}>No posts to recycle yet.</div>
        : posts.map(p => (
          <div key={p.id} style={{display:'flex',alignItems:'flex-start',gap:12,padding:'12px 0',borderBottom:'1px solid var(--border)'}}>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:13,fontWeight:500,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{p.caption}</div>
              <div style={{fontSize:11,color:'var(--text3)',marginTop:4}}>{p.site_name} · {p.scheduled_at ? format(parseISO(p.scheduled_at),'MMM d, yyyy') : 'No date'}</div>
            </div>
            <a href={`/compose/${p.id}`} className="fp-btn fp-btn-ghost fp-btn-sm"><RotateCcw size={12}/> Reschedule</a>
          </div>
        ))}
      </div>
    </div>
  )
}
