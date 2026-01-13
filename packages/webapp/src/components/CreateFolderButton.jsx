import { useState, useRef, useEffect } from 'react'

export default function CreateFolderButton({ onCreateFolder }) {
  const [isCreating, setIsCreating] = useState(false)
  const [folderName, setFolderName] = useState('')
  const [saving, setSaving] = useState(false)
  const inputRef = useRef(null)

  useEffect(() => {
    if (isCreating && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isCreating])

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!folderName.trim() || saving) return

    setSaving(true)
    const { error } = await onCreateFolder(folderName.trim())
    setSaving(false)

    if (!error) {
      setFolderName('')
      setIsCreating(false)
    }
  }

  const handleCancel = () => {
    setFolderName('')
    setIsCreating(false)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      handleCancel()
    }
  }

  if (!isCreating) {
    return (
      <button
        onClick={() => setIsCreating(true)}
        className="flex items-center justify-center w-9 h-9 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
        title="Create folder"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </button>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <input
        ref={inputRef}
        type="text"
        value={folderName}
        onChange={(e) => setFolderName(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Folder name"
        className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-200"
      />
      <button
        type="submit"
        disabled={!folderName.trim() || saving}
        className="p-2 text-gray-500 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      </button>
      <button
        type="button"
        onClick={handleCancel}
        className="p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    </form>
  )
}
