import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { DndContext, DragOverlay, PointerSensor, useSensor, useSensors, closestCenter } from '@dnd-kit/core'
import { arrayMove } from '@dnd-kit/sortable'
import CardGrid from '../components/CardGrid'
import CreateFolderButton from '../components/CreateFolderButton'
import FolderList from '../components/FolderList'
import FolderBadge from '../components/FolderBadge'

const FOLDER_ORDER_KEY = 'pluckk-folder-order'

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
  const [folderOrder, setFolderOrder] = useState([])
  const [selectedCardIds, setSelectedCardIds] = useState(new Set())
  const [isDragging, setIsDragging] = useState(false)
  const questionRef = useRef(null)
  const answerRef = useRef(null)

  // Load folder order from localStorage on mount
  useEffect(() => {
    const savedOrder = localStorage.getItem(FOLDER_ORDER_KEY)
    if (savedOrder) {
      try {
        setFolderOrder(JSON.parse(savedOrder))
      } catch (e) {
        // Invalid JSON, use default
        setFolderOrder([])
      }
    }
  }, [])

  // Escape key clears card selection
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && selectedCardIds.size > 0) {
        setSelectedCardIds(new Set())
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedCardIds.size])

  // Compute ordered items: merge saved order with current folders
  const orderedItems = useMemo(() => {
    const allIds = ['unfiled', ...folders.map(f => f.id)]

    if (folderOrder.length === 0) {
      return allIds
    }

    // Start with saved order, filter out any that no longer exist
    const validSavedOrder = folderOrder.filter(id => allIds.includes(id))

    // Add any new folders that aren't in the saved order
    const newFolders = allIds.filter(id => !validSavedOrder.includes(id))

    return [...validSavedOrder, ...newFolders]
  }, [folders, folderOrder])

  // Get default folder (first in order)
  const defaultFolderId = orderedItems[0] || 'unfiled'

  // Get selected folder from URL (default to first in order if no param)
  const selectedFolderId = searchParams.get('folder') ?? defaultFolderId

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

  // Handle folder tab reorder
  const handleFolderReorder = useCallback((newOrder) => {
    setFolderOrder(newOrder)
    localStorage.setItem(FOLDER_ORDER_KEY, JSON.stringify(newOrder))
  }, [])

  // Toggle card selection for multi-select (Shift+click)
  const toggleCardSelection = useCallback((cardId) => {
    setSelectedCardIds(prev => {
      const next = new Set(prev)
      if (next.has(cardId)) {
        next.delete(cardId)
      } else {
        next.add(cardId)
      }
      return next
    })
  }, [])

  // Get count of selected cards for drag overlay
  const selectedCount = useMemo(() => {
    if (!activeId) return 0
    // If the dragged card is selected, use selection count; otherwise just 1
    return selectedCardIds.has(activeId) ? selectedCardIds.size : 1
  }, [activeId, selectedCardIds])

  // DnD handlers
  const handleDragStart = (event) => {
    setActiveId(event.active.id)
    setIsDragging(true)
  }

  const handleDragEnd = async (event) => {
    const { active, over } = event
    setActiveId(null)
    setIsDragging(false)

    if (!over || !onMoveCardToFolder) return

    const targetFolderId = over.id === 'unfiled' ? null : over.id

    // Determine which cards to move: selected cards if dragged card is selected, otherwise just the dragged card
    const cardsToMove = selectedCardIds.has(active.id)
      ? [...selectedCardIds]
      : [active.id]

    // Move all cards (filter out ones already in target folder)
    const movePromises = cardsToMove
      .filter(cardId => {
        const card = cards.find(c => c.id === cardId)
        return card && card.folder_id !== targetFolderId
      })
      .map(cardId => onMoveCardToFolder(cardId, targetFolderId))

    await Promise.all(movePromises)

    // Clear selection after move
    setSelectedCardIds(new Set())
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
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <div className="w-full flex flex-col items-center">
        {/* Folder list / filter bar */}
        <div className="w-full max-w-5xl mb-4">
          <div className="pb-4 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <CreateFolderButton onCreateFolder={onCreateFolder} />
              <FolderList
                folders={folders}
                cards={cards}
                selectedFolderId={selectedFolderId}
                onSelectFolder={handleSelectFolder}
                onDeleteFolder={onDeleteFolder}
                onRenameFolder={onUpdateFolder}
                orderedItems={orderedItems}
                onReorder={handleFolderReorder}
                isDraggingCard={isDragging}
              />
            </div>
          </div>
        </div>

        <CardGrid
          cards={filteredCards}
          onCardClick={setSelectedCard}
          showFolderBadge={selectedFolderId === 'all' || selectedFolderId === 'unfiled'}
          selectedCardIds={selectedCardIds}
          onToggleSelect={toggleCardSelection}
          activeId={activeId}
        />

        {/* Drag overlay for visual feedback */}
        <DragOverlay>
          {activeCard ? (
            <div className="bg-white border-2 border-blue-500 rounded-xl p-4 shadow-xl w-[280px]">
              {selectedCount > 1 ? (
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold">
                    {selectedCount}
                  </div>
                  <span className="text-sm font-medium text-gray-700">
                    Moving {selectedCount} cards
                  </span>
                </div>
              ) : (
                <>
                  <div className="text-sm text-gray-800 line-clamp-2 mb-2">
                    {activeCard.question}
                  </div>
                  {activeCard.folder && (
                    <FolderBadge folder={activeCard.folder} />
                  )}
                </>
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
