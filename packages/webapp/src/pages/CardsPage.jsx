import { useState, useEffect, useRef, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import CardGrid from '../components/CardGrid'
import CreateFolderButton from '../components/CreateFolderButton'
import FolderList from '../components/FolderList'
import FolderBadge from '../components/FolderBadge'

export default function CardsPage({
  cards,
  loading,
  onUpdateCard,
  onDeleteCard,
  onMoveCardToFolder,
  folders,
  foldersLoading,
  onCreateFolder,
  onUpdateFolder,
  onDeleteFolder
}) {
  const [searchParams, setSearchParams] = useSearchParams()
  const [selectedCard, setSelectedCard] = useState(null)
  const [editQuestion, setEditQuestion] = useState('')
  const [editAnswer, setEditAnswer] = useState('')
  const [saving, setSaving] = useState(false)
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [activeId, setActiveId] = useState(null)
  const questionRef = useRef(null)
  const answerRef = useRef(null)

  // Get selected folder from URL (default to 'unfiled' if no param)
  const selectedFolderId = searchParams.get('folder') ?? 'unfiled'

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  )

  // Filter cards based on selected folder
  const filteredCards = useMemo(() => {
    if (selectedFolderId === 'all') return cards
    if (selectedFolderId === 'unfiled') {
      return cards.filter(c => !c.folder_id)
    }
    return cards.filter(c => c.folder_id === selectedFolderId)
  }, [cards, selectedFolderId])

  // Get the active card being dragged
  const activeCard = useMemo(() => {
    if (!activeId) return null
    return cards.find(c => c.id === activeId)
  }, [activeId, cards])

  // Get the current folder name for the header
  const currentFolderName = useMemo(() => {
    if (selectedFolderId === 'all') return null
    if (selectedFolderId === 'unfiled') return 'Unfiled'
    const folder = folders.find(f => f.id === selectedFolderId)
    return folder?.name || null
  }, [selectedFolderId, folders])

  // Update edit fields when a card is selected
  useEffect(() => {
    if (selectedCard) {
      setEditQuestion(selectedCard.question)
      setEditAnswer(selectedCard.answer)
      setIsConfirmingDelete(false)
    }
  }, [selectedCard])

  const handleDelete = async () => {
    if (!selectedCard || !onDeleteCard) return
    setDeleting(true)
    await onDeleteCard(selectedCard.id)
    setDeleting(false)
    setSelectedCard(null)
    setIsConfirmingDelete(false)
  }

  // Auto-resize textareas when content is set
  useEffect(() => {
    if (questionRef.current) {
      questionRef.current.style.height = 'auto'
      questionRef.current.style.height = questionRef.current.scrollHeight + 'px'
    }
    if (answerRef.current) {
      answerRef.current.style.height = 'auto'
      answerRef.current.style.height = answerRef.current.scrollHeight + 'px'
    }
  }, [editQuestion, editAnswer])

  const handleSave = async () => {
    if (!selectedCard || !onUpdateCard) return

    setSaving(true)
    const { error } = await onUpdateCard(selectedCard.id, {
      question: editQuestion,
      answer: editAnswer
    })
    setSaving(false)

    if (!error) {
      setSelectedCard(null)
    }
  }

  const hasChanges = selectedCard && (
    editQuestion !== selectedCard.question ||
    editAnswer !== selectedCard.answer
  )

  const handleSelectFolder = (folderId) => {
    setSearchParams({ folder: folderId })
  }

  // DnD handlers
  const handleDragStart = (event) => {
    setActiveId(event.active.id)
  }

  const handleDragEnd = async (event) => {
    const { active, over } = event
    setActiveId(null)

    if (!over || !onMoveCardToFolder) return

    const cardId = active.id
    const targetFolderId = over.id === 'unfiled' ? null : over.id

    // Find the card to check if it's already in this folder
    const card = cards.find(c => c.id === cardId)
    if (!card || card.folder_id === targetFolderId) return

    await onMoveCardToFolder(cardId, targetFolderId)
  }

  if (loading || foldersLoading) {
    return (
      <div className="flex flex-col items-center justify-center text-center gap-4">
        <div className="spinner w-8 h-8 border-3 border-gray-200 border-t-gray-800 rounded-full"></div>
        <p className="text-gray-500 text-sm">Loading cards...</p>
      </div>
    )
  }

  if (cards.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center text-center gap-4">
        <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-2">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-400">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
            <line x1="9" y1="9" x2="15" y2="15"></line>
            <line x1="15" y1="9" x2="9" y2="15"></line>
          </svg>
        </div>
        <h2 className="text-lg font-medium text-gray-800">No cards yet</h2>
        <p className="text-gray-500 text-sm">Use the Pluckk extension to create some flashcards.</p>
      </div>
    )
  }

  return (
    <DndContext
      sensors={sensors}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="w-full flex flex-col items-center">
        {/* Header with Create Folder */}
        <div className="w-full max-w-5xl mb-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-800">
              {currentFolderName || 'All Cards'}
              <span className="ml-2 text-base font-normal text-gray-500">
                ({filteredCards.length} {filteredCards.length === 1 ? 'card' : 'cards'})
              </span>
            </h2>
            <CreateFolderButton onCreateFolder={onCreateFolder} />
          </div>

          {/* Folder list / filter bar */}
          <div className="pb-4 border-b border-gray-200">
            <FolderList
              folders={folders}
              cards={cards}
              selectedFolderId={selectedFolderId}
              onSelectFolder={handleSelectFolder}
              onDeleteFolder={onDeleteFolder}
              onRenameFolder={onUpdateFolder}
            />
          </div>
        </div>

        <CardGrid
          cards={filteredCards}
          onCardClick={setSelectedCard}
          showFolderBadge={selectedFolderId === 'all' || selectedFolderId === 'unfiled'}
        />

        {/* Drag overlay for visual feedback */}
        <DragOverlay>
          {activeCard ? (
            <div className="bg-white border border-gray-300 rounded-xl p-5 shadow-lg opacity-90 w-[300px]">
              <div className="text-sm text-gray-800 line-clamp-2 mb-2">
                {activeCard.question}
              </div>
              {activeCard.folder && (
                <FolderBadge folder={activeCard.folder} />
              )}
            </div>
          ) : null}
        </DragOverlay>

        {/* Card Edit Modal */}
        {selectedCard && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
            onClick={() => setSelectedCard(null)}
          >
            <div
              className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Folder badge */}
              {selectedCard.folder && (
                <div className="mb-4">
                  <FolderBadge folder={selectedCard.folder} />
                </div>
              )}

              <div className="mb-4">
                <label className="text-xs text-gray-400 uppercase tracking-wide mb-2 block">Question</label>
                <textarea
                  ref={questionRef}
                  value={editQuestion}
                  onChange={(e) => {
                    setEditQuestion(e.target.value)
                    e.target.style.height = 'auto'
                    e.target.style.height = e.target.scrollHeight + 'px'
                  }}
                  onFocus={(e) => {
                    e.target.style.height = 'auto'
                    e.target.style.height = e.target.scrollHeight + 'px'
                  }}
                  className="w-full p-3 border border-gray-200 rounded-lg text-gray-800 resize-none focus:outline-none focus:ring-2 focus:ring-gray-200 overflow-hidden min-h-[60px]"
                />
              </div>
              <div className="border-t border-gray-100 pt-4">
                <label className="text-xs text-gray-400 uppercase tracking-wide mb-2 block">Answer</label>
                <textarea
                  ref={answerRef}
                  value={editAnswer}
                  onChange={(e) => {
                    setEditAnswer(e.target.value)
                    e.target.style.height = 'auto'
                    e.target.style.height = e.target.scrollHeight + 'px'
                  }}
                  onFocus={(e) => {
                    e.target.style.height = 'auto'
                    e.target.style.height = e.target.scrollHeight + 'px'
                  }}
                  className="w-full p-3 border border-gray-200 rounded-lg text-gray-800 resize-none focus:outline-none focus:ring-2 focus:ring-gray-200 overflow-hidden min-h-[60px]"
                />
              </div>
              <div className="mt-6 flex gap-3">
                {!isConfirmingDelete ? (
                  <>
                    <button
                      onClick={() => setIsConfirmingDelete(true)}
                      className="p-3 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="Delete card"
                    >
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                      </svg>
                    </button>
                    <button
                      onClick={() => setSelectedCard(null)}
                      className="flex-1 py-3 bg-gray-100 text-gray-800 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={!hasChanges || saving}
                      className="flex-1 py-3 bg-gray-800 text-white text-sm font-medium rounded-lg hover:bg-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => setIsConfirmingDelete(false)}
                      className="flex-1 py-3 bg-gray-100 text-gray-800 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleDelete}
                      disabled={deleting}
                      className="flex-1 py-3 bg-red-500 text-white text-sm font-medium rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {deleting ? 'Deleting...' : 'Confirm Delete'}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </DndContext>
  )
}
