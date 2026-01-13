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

export default function DraggableCard({ id, children, isSelected }) {
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

      {/* Card content */}
      {children}

      {isDragging && (
        <div className="absolute inset-0 bg-gray-100 rounded-xl border-2 border-dashed border-gray-300" />
      )}
    </div>
  )
}
