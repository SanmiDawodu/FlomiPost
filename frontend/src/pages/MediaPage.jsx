import { useState, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { mediaApi, sitesApi } from '../utils/api'
import { useDropzone } from 'react-dropzone'
import toast from 'react-hot-toast'
import { Image, Upload } from 'lucide-react'
import { format, parseISO } from 'date-fns'

export default function MediaPage() {
  const qc = useQueryClient()
  const [siteFilter, setSiteFilter] = useState('')
  const [uploading, setUploading] = useState(false)

  const { data: sitesRes } = useQuery({ queryKey: ['sites'], queryFn: sitesApi.list })
  const { data: mediaRes, isLoading } = useQuery({
    queryKey: ['media', siteFilter],
    queryFn: () => mediaApi.list({ site_id: siteFilter || undefined }),
  })

  const sites = sitesRes?.data ?? []
  const media = mediaRes?.data ?? []
  const meta  = mediaRes?.meta ?? {}

  const onDrop = useCallback(async (files) => {
    setUploading(true)
    let ok = 0, fail = 0
    for (const file of files) {
      try {
        await mediaApi.upload(file, siteFilter || undefined)
        ok++
      } catch (e) {
        fail++
      }
    }
    setUploading(false)
    if (ok) toast.success(`${ok} file${ok>1?'s':''} uploaded!`)
    if (fail) toast.error(`${fail} upload${fail>1?'s':''} failed`)
    qc.invalidateQueries({ queryKey: ['media'] })
  }, [siteFilter])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop, accept: { 'image/*': [], 'video/mp4': [] }, maxSize: 50 * 1024 * 1024,
  })

  return (
    <div>
      <div className="fp-page-header">
        <div>
          <div className="fp-page-title">Media Library</div>
          <div className="fp-page-sub">{meta.total ?? 0} files</div>
        </div>
        <select className="fp-select" style={{width:180}} value={siteFilter} onChange={e=>setSiteFilter(e.target.value)}>
          <option value="">All Sites</option>
          {sites.map(s=><option key={s.id} value={s.id}>{s.domain}</option>)}
        </select>
      </div>

      {/* Dropzone */}
      <div className={`fp-dropzone${isDragActive?' active':''}`} {...getRootProps()} style={{marginBottom:20}}>
        <input {...getInputProps()}/>
        <Upload size={28} style={{margin:'0 auto 10px',display:'block',color:'var(--text3)'}}/>
        <div style={{fontWeight:500,color:'var(--text2)',marginBottom:4}}>
          {uploading ? 'Uploading…' : isDragActive ? 'Drop files here…' : 'Drag & drop or click to upload'}
        </div>
        <div style={{fontSize:11}}>Images (JPG, PNG, GIF, WebP) and MP4 video · Max 50MB</div>
      </div>

      {/* Grid */}
      {isLoading ? <div className="fp-loader"><div className="fp-spinner"/></div>
        : media.length === 0 ? (
        <div className="fp-empty">
          <div className="fp-empty-icon">🖼️</div>
          <h3>No media yet</h3>
          <p>Upload images to attach to your posts</p>
        </div>
      ) : (
        <div className="fp-media-grid">
          {media.map(m => (
            <div key={m.id} style={{borderRadius:8,overflow:'hidden',border:'1px solid var(--border)',background:'var(--bg3)'}}>
              <div style={{aspectRatio:'1',overflow:'hidden'}}>
                {m.mime_type?.startsWith('image/') ? (
                  <img src={m.url} alt={m.alt_text||''} style={{width:'100%',height:'100%',objectFit:'cover'}} loading="lazy"/>
                ) : (
                  <div style={{width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center',color:'var(--text3)'}}>
                    🎬 video
                  </div>
                )}
              </div>
              <div style={{padding:'8px 10px'}}>
                <div style={{fontSize:10,color:'var(--text3)',fontFamily:'DM Mono,monospace',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
                  {m.filename}
                </div>
                <div style={{fontSize:10,color:'var(--text3)',marginTop:2}}>
                  {m.width && m.height ? `${m.width}×${m.height} · ` : ''}
                  {(m.size/1024).toFixed(0)}KB
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
