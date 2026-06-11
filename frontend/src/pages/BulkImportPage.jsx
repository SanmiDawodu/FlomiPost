import { useState, useRef } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { api } from '../utils/api'
import toast from 'react-hot-toast'
import { Upload, Download, CheckCircle, AlertCircle } from 'lucide-react'

const TEMPLATE_HEADERS = ['caption','channel','scheduled_at','media_url']
const TEMPLATE_EXAMPLE = [
  ['Check out our latest product! #launch','facebook','2026-07-01 09:00:00',''],
  ['New blog post is live — link in bio','instagram','2026-07-02 10:00:00',''],
  ['Exciting announcement coming soon…','twitter','2026-07-03 08:00:00',''],
]

function downloadTemplate() {
  const rows = [TEMPLATE_HEADERS, ...TEMPLATE_EXAMPLE]
  const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'flomipost-bulk-template.csv'
  a.click()
}

function parseCsv(text) {
  const lines = text.trim().split('\n')
  const headers = lines[0].split(',').map(h => h.replace(/^"|"$/g,'').trim().toLowerCase())
  return lines.slice(1).map(line => {
    const vals = line.match(/(".*?"|[^,]+|(?<=,)(?=,))/g) ?? []
    const obj = {}
    headers.forEach((h, i) => { obj[h] = (vals[i] ?? '').replace(/^"|"$/g,'').trim() })
    return obj
  }).filter(r => r.caption)
}

export default function BulkImportPage() {
  const fileRef = useRef()
  const [rows, setRows] = useState([])
  const [siteId, setSiteId] = useState('')
  const [result, setResult] = useState(null)

  const { data: sitesRes } = useQuery({
    queryKey: ['sites'],
    queryFn: () => api.get('/sites').then(r => r.data),
  })
  const sites = sitesRes?.data ?? sitesRes ?? []

  const importMutation = useMutation({
    mutationFn: () => api.post('/posts/bulk-import', { site_id: parseInt(siteId), rows }),
    onSuccess: (res) => {
      setResult(res.data.data ?? res.data)
      toast.success(`Import done: ${res.data.data?.imported ?? 0} posts created`)
    },
    onError: (e) => toast.error(e.message),
  })

  const handleFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const parsed = parseCsv(ev.target.result)
      setRows(parsed)
      setResult(null)
      toast.success(`${parsed.length} rows loaded`)
    }
    reader.readAsText(file)
  }

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">Bulk Import Posts</h1>
      <p className="text-sm text-gray-400 mb-6">Upload a CSV to create up to 500 scheduled posts at once. All posts are created as drafts.</p>

      <div className="flex gap-3 mb-6">
        <button
          onClick={downloadTemplate}
          className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-sm hover:bg-white/10 transition-colors"
        ><Download size={15}/> Download Template</button>
      </div>

      <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-6">
        <h3 className="font-semibold mb-4">Import Settings</h3>
        <label className="block text-sm text-gray-400 mb-1">Site</label>
        <select
          className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:border-purple-500"
          value={siteId}
          onChange={e => setSiteId(e.target.value)}
        >
          <option value="">Select site…</option>
          {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>

        <label className="block text-sm text-gray-400 mb-1">CSV File</label>
        <div
          className="border-2 border-dashed border-white/10 rounded-xl p-8 text-center cursor-pointer hover:border-purple-500/50 transition-colors"
          onClick={() => fileRef.current?.click()}
        >
          <Upload size={28} className="mx-auto mb-2 text-gray-500"/>
          <p className="text-sm text-gray-400">{rows.length > 0 ? `${rows.length} rows loaded — click to replace` : 'Click to upload CSV'}</p>
          <p className="text-xs text-gray-600 mt-1">Required columns: caption, channel, scheduled_at</p>
          <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile}/>
        </div>
      </div>

      {rows.length > 0 && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-6 overflow-x-auto">
          <p className="text-sm font-medium mb-3">{rows.length} rows ready to import</p>
          <table className="w-full text-xs">
            <thead>
              <tr className="text-gray-500 border-b border-white/10">
                <th className="text-left pb-2 pr-4">Caption</th>
                <th className="text-left pb-2 pr-4">Channel</th>
                <th className="text-left pb-2">Scheduled At</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 5).map((r, i) => (
                <tr key={i} className="border-b border-white/5">
                  <td className="py-1.5 pr-4 max-w-xs truncate text-gray-300">{r.caption}</td>
                  <td className="py-1.5 pr-4 capitalize text-gray-400">{r.channel}</td>
                  <td className="py-1.5 text-gray-400">{r.scheduled_at}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length > 5 && <p className="text-xs text-gray-500 mt-2">… and {rows.length - 5} more rows</p>}
        </div>
      )}

      {result && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-6">
          <p className="font-semibold mb-3">Import Results</p>
          <div className="flex gap-6 text-sm">
            <div className="flex items-center gap-2 text-green-400">
              <CheckCircle size={16}/> {result.imported ?? 0} imported
            </div>
            {(result.errors?.length ?? 0) > 0 && (
              <div className="flex items-center gap-2 text-red-400">
                <AlertCircle size={16}/> {result.errors.length} errors
              </div>
            )}
          </div>
          {result.errors?.length > 0 && (
            <ul className="mt-3 space-y-1">
              {result.errors.map((e, i) => (
                <li key={i} className="text-xs text-red-400">Row {e.row}: {e.message}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <button
        onClick={() => importMutation.mutate()}
        disabled={!rows.length || !siteId || importMutation.isPending}
        className="w-full py-3 bg-purple-600 text-white rounded-xl font-medium disabled:opacity-40 hover:bg-purple-700 transition-colors"
      >
        {importMutation.isPending ? 'Importing…' : `Import ${rows.length} Posts`}
      </button>

      <div className="mt-6 p-4 bg-blue-900/20 border border-blue-500/20 rounded-xl text-xs text-blue-300">
        <p className="font-semibold mb-1">CSV Format</p>
        <p>Required: <code>caption</code>, <code>channel</code>, <code>scheduled_at</code> (YYYY-MM-DD HH:MM:SS)</p>
        <p>Optional: <code>media_url</code></p>
        <p className="mt-1">Valid channels: facebook, instagram, twitter, linkedin, tiktok, telegram, discord, whatsapp</p>
        <p>Max 500 rows per import. All posts created as drafts.</p>
      </div>
    </div>
  )
}
