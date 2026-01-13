import { useDroppable } from '@dnd-kit/core'

export default function DroppableFolder({ id, children, className = '' }) {
  const { isOver, setNodeRef } = useDroppable({
    id: id,
  })

  return (
    <div
      ref={setNodeRef}
      className={`${className} ${isOver ? 'ring-2 ring-gray-400 bg-gray-100' : ''} transition-all`}
    >
      {children}
    </div>
  )
}
