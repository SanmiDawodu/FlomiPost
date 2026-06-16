import { Trash2, X } from 'lucide-react'

export default function BulkActionBar({ count, onDelete, onClear, deleting, extraActions }) {
  if (count === 0) return null
  return (
    <div className="fp-bulkbar">
      <span className="fp-bulkbar-count">{count} selected</span>
      <div className="fp-bulkbar-sep"/>
      {extraActions}
      {onDelete && (
        <button onClick={onDelete} disabled={deleting} className="fp-btn fp-btn-danger fp-btn-sm">
          <Trash2 size={14}/>{deleting ? 'Deleting…' : 'Delete'}
        </button>
      )}
      <button onClick={onClear} className="fp-btn fp-btn-ghost fp-btn-sm fp-btn-icon" title="Clear selection">
        <X size={16}/>
      </button>
    </div>
  )
}
