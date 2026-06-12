import { useState, useCallback } from 'react'

export function useMultiSelect(items = [], idKey = 'id') {
  const [selected, setSelected] = useState(new Set())

  const toggle = useCallback((id) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }, [])

  const toggleAll = useCallback(() => {
    setSelected(prev =>
      prev.size === items.length
        ? new Set()
        : new Set(items.map(i => i[idKey]))
    )
  }, [items, idKey])

  const clear = useCallback(() => setSelected(new Set()), [])

  const allSelected = items.length > 0 && selected.size === items.length
  const someSelected = selected.size > 0 && !allSelected

  return { selected, toggle, toggleAll, clear, allSelected, someSelected, count: selected.size }
}
