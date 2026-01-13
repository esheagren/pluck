import { useDraggable } from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'

// 6-dot grip icon for drag handle
function GripIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" className="text-gray-400">
      <circle cx="3" cy="2" r="1.5" />
      <circle cx="9" cy="2" r="1.5" />
      <circle cx="3" cy="6" r="1.5" />
      <circle cx="9" cy="6" r="1.5" />
      <circle cx="3" cy="10" r="1.5" />
      <circle cx="9" cy="10" r="1.5" />
    </svg>
  )
}

export default function DraggableCard({ id, children, isSelected, onToggleSelect }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: id,
  })

  const style = {
    transform: CSS.Translate.toString(transform),
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative ${isDragging ? 'opacity-50' : ''} ${isSelected ? 'ring-2 ring-blue-500 rounded-xl' : ''}`}
    >
      {/* Drag handle - only this area triggers drag */}
      <div
        {...listeners}
        {...attributes}
        className="absolute top-3 left-3 p-1.5 cursor-grab hover:bg-gray-100 active:cursor-grabbing rounded z-10 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={(e) => e.stopPropagation()}
      >
        <GripIcon />
      </div>

      {/* Selection checkbox */}
      <div
        className="absolute top-3 right-3 z-10"
        onClick={(e) => e.stopPropagation()}
      >
        <input
          type="checkbox"
          checked={isSelected}
          onChange={(e) => onToggleSelect?.(id, e)}
          className="w-4 h-4 rounded border-gray-300 text-blue-500 focus:ring-blue-500 cursor-pointer"
        />
      </div>

      {/* Card content - click opens modal (no drag conflict) */}
      {children}

      {isDragging && (
        <div className="absolute inset-0 bg-gray-100 rounded-xl border-2 border-dashed border-gray-300" />
      )}
    </div>
  )
}
