import { Trash2, X } from 'lucide-react'

export default function BulkActionBar({ count, onDelete, onClear, deleting, extraActions }) {
  if (count === 0) return null
  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 bg-[#1a0f4e] border border-purple-500/40 rounded-2xl px-5 py-3 shadow-2xl shadow-purple-900/40">
      <span className="text-sm font-medium text-purple-200">{count} selected</span>
      <div className="w-px h-4 bg-white/20"/>
      {extraActions}
      {onDelete && (
        <button
          onClick={onDelete}
          disabled={deleting}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600/20 text-red-400 rounded-lg text-sm hover:bg-red-600/30 disabled:opacity-40 transition-colors"
        >
          <Trash2 size={14}/>{deleting ? 'Deleting…' : 'Delete'}
        </button>
      )}
      <button onClick={onClear} className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-white/10">
        <X size={16}/>
      </button>
    </div>
  )
}
