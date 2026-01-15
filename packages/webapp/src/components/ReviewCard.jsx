import { useState, useEffect, useRef } from 'react'
import FolderBadge from './FolderBadge'

export default function ReviewCard({ card, isFlipped, onFlip, onUpdateCard, onDeleteCard }) {
  const [isEditing, setIsEditing] = useState(false)
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)
  const [isImageExpanded, setIsImageExpanded] = useState(false)
  const [editQuestion, setEditQuestion] = useState('')
  const [editAnswer, setEditAnswer] = useState('')
  // Track displayed values (may differ from card prop after edit)
  const [displayQuestion, setDisplayQuestion] = useState(card.question)
  const [displayAnswer, setDisplayAnswer] = useState(card.answer)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const questionRef = useRef(null)
  const answerRef = useRef(null)

  // Update display values when card prop changes (new card)
  // Skip if actively editing to avoid overwriting user's unsaved changes
  useEffect(() => {
    if (!isEditing) {
      setDisplayQuestion(card.question)
      setDisplayAnswer(card.answer)
    }
  }, [card.id, card.question, card.answer, isEditing])

  useEffect(() => {
    if (isEditing) {
      setEditQuestion(displayQuestion)
      setEditAnswer(displayAnswer)
      // Focus question field and resize both after state updates
      const timeoutId = setTimeout(() => {
        if (questionRef.current) {
          questionRef.current.focus()
          questionRef.current.style.height = 'auto'
          questionRef.current.style.height = questionRef.current.scrollHeight + 'px'
        }
        if (answerRef.current) {
          answerRef.current.style.height = 'auto'
          answerRef.current.style.height = answerRef.current.scrollHeight + 'px'
        }
      }, 0)
      return () => clearTimeout(timeoutId)
    }
    // Only trigger when entering edit mode, not when display values change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditing])

  const handleSave = async () => {
    const questionChanged = editQuestion !== displayQuestion
    const answerChanged = editAnswer !== displayAnswer

    if (!onUpdateCard || (!questionChanged && !answerChanged)) {
      setIsEditing(false)
      return
    }

    setSaving(true)
    const updates = {}
    if (questionChanged) updates.question = editQuestion
    if (answerChanged) updates.answer = editAnswer

    const { error } = await onUpdateCard(card.id, updates)
    setSaving(false)

    if (!error) {
      // Update local display values to reflect the saved changes
      if (questionChanged) setDisplayQuestion(editQuestion)
      if (answerChanged) setDisplayAnswer(editAnswer)
      setIsEditing(false)
    }
  }

  const handleCancel = () => {
    setEditQuestion(displayQuestion)
    setEditAnswer(displayAnswer)
    setIsEditing(false)
  }

  const handleDelete = async () => {
    if (!onDeleteCard) return
    setDeleting(true)
    await onDeleteCard(card.id)
    setDeleting(false)
    setIsConfirmingDelete(false)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      if (isImageExpanded) {
        setIsImageExpanded(false)
      } else if (isConfirmingDelete) {
        setIsConfirmingDelete(false)
      } else {
        handleCancel()
      }
    } else if (e.key === 'Enter' && e.metaKey) {
      handleSave()
    }
  }

  // Close expanded image on Escape
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      if (e.key === 'Escape' && isImageExpanded) {
        setIsImageExpanded(false)
      }
    }
    if (isImageExpanded) {
      document.addEventListener('keydown', handleGlobalKeyDown)
      return () => document.removeEventListener('keydown', handleGlobalKeyDown)
    }
  }, [isImageExpanded])

  return (
    <div className="card-wrapper">
      <div
        className={`card w-[500px] min-h-[300px] relative cursor-pointer max-md:w-[calc(100vw-80px)] ${isFlipped ? 'flipped' : ''}`}
        onClick={() => !isFlipped && !isEditing && onFlip()}
      >
        {/* Front - Question */}
        <div className={`card-face bg-white border border-gray-200 rounded-2xl flex items-center justify-center p-8 shadow-lg w-full min-h-[300px] relative ${isFlipped ? 'hidden' : ''}`}>
          {card.folder && (
            <div className="absolute top-3 left-3">
              <FolderBadge folder={card.folder} />
            </div>
          )}
          {card.is_new && (
            <div className="absolute top-3 right-3">
              <span className="px-2 py-1 text-xs font-medium text-blue-600 bg-blue-50 rounded-full">
                New
              </span>
            </div>
          )}
          <div className="text-lg leading-relaxed text-center text-gray-800">
            {displayQuestion}
          </div>
        </div>

        {/* Back - Answer + Image + Source */}
        <div className={`card-face card-back bg-gradient-to-br from-gray-50 to-white border border-gray-200 rounded-2xl flex flex-col items-center justify-between p-8 shadow-lg w-full min-h-[300px] relative ${isFlipped ? '' : 'hidden'}`}>
          {/* Folder badge */}
          {card.folder && (
            <div className="absolute top-3 left-3">
              <FolderBadge folder={card.folder} />
            </div>
          )}

          {/* Action buttons */}
          {!isEditing && !isConfirmingDelete && (
            <div className="absolute top-3 right-3 flex gap-1">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setIsConfirmingDelete(true)
                }}
                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                title="Delete card"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setIsEditing(true)
                }}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                title="Edit card"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
              </button>
            </div>
          )}

          {/* Delete confirmation */}
          {isConfirmingDelete && (
            <div className="absolute top-3 right-3 flex items-center gap-2 bg-white px-2 py-1 rounded-lg shadow-sm border border-gray-200">
              <span className="text-xs text-gray-500">Delete?</span>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  setIsConfirmingDelete(false)
                }}
                className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
                title="Cancel"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleDelete()
                }}
                disabled={deleting}
                className="p-1.5 text-red-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                title="Confirm delete"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </button>
            </div>
          )}

          {/* Save/Cancel buttons when editing */}
          {isEditing && (
            <div className="absolute top-3 right-3 flex gap-1">
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleCancel()
                }}
                className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                title="Cancel (Esc)"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18"></line>
                  <line x1="6" y1="6" x2="18" y2="18"></line>
                </svg>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation()
                  handleSave()
                }}
                disabled={saving}
                className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors disabled:opacity-50"
                title="Save (⌘+Enter)"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12"></polyline>
                </svg>
              </button>
            </div>
          )}

          <div className="flex-1 flex flex-col items-center justify-center w-full">
            {/* Question - editable when in edit mode */}
            {isEditing ? (
              <textarea
                ref={questionRef}
                value={editQuestion}
                onChange={(e) => {
                  setEditQuestion(e.target.value)
                  e.target.style.height = 'auto'
                  e.target.style.height = e.target.scrollHeight + 'px'
                }}
                onKeyDown={handleKeyDown}
                onClick={(e) => e.stopPropagation()}
                className="w-full text-sm text-gray-500 text-center mt-4 mb-3 pb-3 border-b border-gray-200 bg-transparent resize-none focus:outline-none focus:ring-0"
                style={{ minHeight: '1.5em' }}
                placeholder="Question"
              />
            ) : (
              <div className="text-sm text-gray-500 text-center mt-4 mb-3 pb-3 border-b border-gray-200 w-full">
                {displayQuestion}
              </div>
            )}
            {/* Answer - editable when in edit mode */}
            {isEditing ? (
              <textarea
                ref={answerRef}
                value={editAnswer}
                onChange={(e) => {
                  setEditAnswer(e.target.value)
                  e.target.style.height = 'auto'
                  e.target.style.height = e.target.scrollHeight + 'px'
                }}
                onKeyDown={handleKeyDown}
                onClick={(e) => e.stopPropagation()}
                className="w-full text-lg leading-relaxed text-center text-gray-800 bg-transparent border-none resize-none focus:outline-none focus:ring-0"
                style={{ minHeight: '1.5em' }}
                placeholder="Answer"
              />
            ) : (
              <div className="text-lg leading-relaxed text-center text-gray-800">
                {displayAnswer}
              </div>
            )}
            {card.image_url && (
              <img
                src={card.image_url}
                alt=""
                onClick={(e) => {
                  e.stopPropagation()
                  setIsImageExpanded(true)
                }}
                className="mt-4 max-h-40 rounded-lg object-contain cursor-zoom-in hover:opacity-90 transition-opacity"
              />
            )}
          </div>
          {card.source_url && (
            <a
              href={card.source_url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="mt-4 text-xs text-blue-500 hover:text-blue-600 hover:underline"
            >
              Source
            </a>
          )}
        </div>
      </div>

      {/* Image Lightbox */}
      {isImageExpanded && card.image_url && (
        <div
          className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 cursor-zoom-out"
          onClick={() => setIsImageExpanded(false)}
        >
          <img
            src={card.image_url}
            alt=""
            className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg shadow-2xl cursor-zoom-out"
            onClick={() => setIsImageExpanded(false)}
          />
          <button
            onClick={() => setIsImageExpanded(false)}
            className="absolute top-4 right-4 p-2 text-white/70 hover:text-white transition-colors"
            title="Close (Esc)"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </div>
      )}
    </div>
  )
}
