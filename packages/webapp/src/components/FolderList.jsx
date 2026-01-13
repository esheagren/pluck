import { useState } from 'react'
import { DndContext, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, useSortable, horizontalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import DroppableFolder from './DroppableFolder'

// Sortable wrapper for folder tabs
function SortableFolderTab({ id, children }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    cursor: 'grab',
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      {children}
    </div>
  )
}

export default function FolderList({
  folders,
  cards,
  selectedFolderId,
  onSelectFolder,
  onDeleteFolder,
  onRenameFolder,
  orderedItems = [],
  onReorder,
  isDraggingCard = false
}) {
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)

  const getCardCount = (folderId) => {
    if (folderId === null || folderId === 'unfiled') {
      return cards.filter(c => !c.folder_id).length
    }
    return cards.filter(c => c.folder_id === folderId).length
  }

  const handleStartEdit = (folder) => {
    setEditingId(folder.id)
    setEditName(folder.name)
  }

  const handleSaveEdit = async (folderId) => {
    if (editName.trim()) {
      await onRenameFolder(folderId, { name: editName.trim() })
    }
    setEditingId(null)
    setEditName('')
  }

  const handleKeyDown = (e, folderId) => {
    if (e.key === 'Enter') {
      handleSaveEdit(folderId)
    } else if (e.key === 'Escape') {
      setEditingId(null)
      setEditName('')
    }
  }

  const handleDelete = async (folderId) => {
    await onDeleteFolder(folderId)
    setConfirmDeleteId(null)
    if (selectedFolderId === folderId) {
      onSelectFolder('unfiled')
    }
  }

  // Render a folder tab (used for both unfiled and user folders)
  const renderFolderTab = (folder, isUnfiled = false) => {
    const id = isUnfiled ? 'unfiled' : folder.id
    const name = isUnfiled ? 'Unfiled' : folder.name
    const count = getCardCount(isUnfiled ? null : folder.id)
    const color = isUnfiled ? null : folder.color

    if (!isUnfiled && editingId === folder.id) {
      return (
        <input
          type="text"
          value={editName}
          onChange={(e) => setEditName(e.target.value)}
          onKeyDown={(e) => handleKeyDown(e, folder.id)}
          onBlur={() => handleSaveEdit(folder.id)}
          autoFocus
          className="px-3 py-2 text-sm font-medium rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400"
        />
      )
    }

    if (!isUnfiled && confirmDeleteId === folder.id) {
      return (
        <div className="flex items-center gap-1 px-3 py-2 bg-red-50 rounded-lg">
          <span className="text-sm text-red-600">Delete?</span>
          <button
            onClick={() => handleDelete(folder.id)}
            className="p-1 text-red-600 hover:text-red-700"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </button>
          <button
            onClick={() => setConfirmDeleteId(null)}
            className="p-1 text-gray-500 hover:text-gray-700"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
      )
    }

    return (
      <div className="group relative">
        <button
          onClick={() => onSelectFolder(id)}
          className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
            selectedFolderId === id
              ? 'bg-gray-800 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          {color && (
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="currentColor"
              style={{ color }}
            >
              <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
            </svg>
          )}
          {name}
          <span className="text-xs opacity-70">({count})</span>
        </button>

        {/* Edit/Delete buttons on hover (only for user folders) */}
        {!isUnfiled && (
          <div className="absolute -top-1 -right-1 hidden group-hover:flex gap-0.5 bg-white rounded-lg shadow-sm border border-gray-200 z-10">
            <button
              onClick={(e) => {
                e.stopPropagation()
                handleStartEdit(folder)
              }}
              className="p-1 text-gray-400 hover:text-gray-600"
              title="Rename"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
            </button>
            <button
              onClick={(e) => {
                e.stopPropagation()
                setConfirmDeleteId(folder.id)
              }}
              className="p-1 text-gray-400 hover:text-red-500"
              title="Delete"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </button>
          </div>
        )}
      </div>
    )
  }

  // Build ordered list of items to render
  const sortableIds = orderedItems.length > 0 ? orderedItems : ['unfiled', ...folders.map(f => f.id)]

  // Sensors for folder tab sorting (separate from card DnD)
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  // Handle folder tab reorder
  const handleDragEnd = (event) => {
    const { active, over } = event
    if (!over || active.id === over.id) return

    const oldIndex = sortableIds.indexOf(active.id)
    const newIndex = sortableIds.indexOf(over.id)

    if (oldIndex !== -1 && newIndex !== -1) {
      const newOrder = arrayMove(sortableIds, oldIndex, newIndex)
      onReorder(newOrder)
    }
  }

  return (
    <div className="flex-1 flex items-center justify-between gap-2">
      {/* Left side: Sortable folder tabs */}
      <div className="flex flex-wrap gap-2 items-center">
        <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
          <SortableContext items={sortableIds} strategy={horizontalListSortingStrategy}>
            {sortableIds.map(id => {
              const isUnfiled = id === 'unfiled'
              const folder = isUnfiled ? null : folders.find(f => f.id === id)

              // Skip if folder doesn't exist (was deleted)
              if (!isUnfiled && !folder) return null

              // Unfiled is not a drop target (cards are already unfiled)
              // Other folders become drop targets, expanded when dragging
              return (
                <SortableFolderTab key={id} id={id}>
                  {isUnfiled ? (
                    renderFolderTab(folder, isUnfiled)
                  ) : (
                    <DroppableFolder id={id} className="rounded-lg" expanded={isDraggingCard}>
                      {renderFolderTab(folder, isUnfiled)}
                    </DroppableFolder>
                  )}
                </SortableFolderTab>
              )
            })}
          </SortableContext>
        </DndContext>
      </div>

      {/* Right side: All Cards option - fixed position */}
      <button
        onClick={() => onSelectFolder('all')}
        className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
          selectedFolderId === 'all'
            ? 'bg-gray-800 text-white'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }`}
      >
        All Cards
        <span className="ml-1.5 text-xs opacity-70">({cards.length})</span>
      </button>
    </div>
  )
}
