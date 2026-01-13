import { useState } from 'react'
import DroppableFolder from './DroppableFolder'

export default function FolderList({
  folders,
  cards,
  selectedFolderId,
  onSelectFolder,
  onDeleteFolder,
  onRenameFolder
}) {
  const [editingId, setEditingId] = useState(null)
  const [editName, setEditName] = useState('')
  const [confirmDeleteId, setConfirmDeleteId] = useState(null)

  const getCardCount = (folderId) => {
    if (folderId === null) {
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
      onSelectFolder(null)
    }
  }

  const unfiledCount = getCardCount(null)

  return (
    <div className="flex flex-wrap gap-2">
      {/* All Cards option */}
      <button
        onClick={() => onSelectFolder(null)}
        className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
          selectedFolderId === null
            ? 'bg-gray-800 text-white'
            : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
        }`}
      >
        All Cards
        <span className="ml-1.5 text-xs opacity-70">({cards.length})</span>
      </button>

      {/* Unfiled option - droppable target */}
      <DroppableFolder id="unfiled" className="rounded-lg">
        <button
          onClick={() => onSelectFolder('unfiled')}
          className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
            selectedFolderId === 'unfiled'
              ? 'bg-gray-800 text-white'
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
          }`}
        >
          Unfiled
          <span className="ml-1.5 text-xs opacity-70">({unfiledCount})</span>
        </button>
      </DroppableFolder>

      {/* User folders */}
      {folders.map(folder => (
        <DroppableFolder key={folder.id} id={folder.id} className="rounded-lg">
          <div className="group relative">
            {editingId === folder.id ? (
              <input
                type="text"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onKeyDown={(e) => handleKeyDown(e, folder.id)}
                onBlur={() => handleSaveEdit(folder.id)}
                autoFocus
                className="px-3 py-2 text-sm font-medium rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-400"
              />
            ) : confirmDeleteId === folder.id ? (
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
            ) : (
              <button
                onClick={() => onSelectFolder(folder.id)}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                  selectedFolderId === folder.id
                    ? 'bg-gray-800 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                  style={{ color: folder.color }}
                >
                  <path d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
                {folder.name}
                <span className="text-xs opacity-70">({getCardCount(folder.id)})</span>
              </button>
            )}

            {/* Edit/Delete buttons on hover */}
            {editingId !== folder.id && confirmDeleteId !== folder.id && (
              <div className="absolute -top-1 -right-1 hidden group-hover:flex gap-0.5 bg-white rounded-lg shadow-sm border border-gray-200">
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
        </DroppableFolder>
      ))}
    </div>
  )
}
