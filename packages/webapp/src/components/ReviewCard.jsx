import { useState, useEffect, useRef } from 'react'

export default function ReviewCard({ card, isFlipped, onFlip, onUpdateCard, onDeleteCard }) {
  const [isEditing, setIsEditing] = useState(false)
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)
  const [editAnswer, setEditAnswer] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const answerRef = useRef(null)

  useEffect(() => {
    if (isEditing) {
      setEditAnswer(card.answer)
      // Focus and resize after state updates
      setTimeout(() => {
        if (answerRef.current) {
          answerRef.current.focus()
          answerRef.current.style.height = 'auto'
          answerRef.current.style.height = answerRef.current.scrollHeight + 'px'
        }
      }, 0)
    }
  }, [isEditing, card.answer])

  const handleSave = async () => {
    if (!onUpdateCard || editAnswer === card.answer) {
      setIsEditing(false)
      return
    }
    setSaving(true)
    const { error } = await onUpdateCard(card.id, { answer: editAnswer })
    setSaving(false)
    if (!error) {
      setIsEditing(false)
    }
  }

  const handleCancel = () => {
    setEditAnswer(card.answer)
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
      if (isConfirmingDelete) {
        setIsConfirmingDelete(false)
      } else {
        handleCancel()
      }
    } else if (e.key === 'Enter' && e.metaKey) {
      handleSave()
    }
  }

  return (
    <div className="card-wrapper">
      <div
        className={`card w-[500px] min-h-[300px] relative cursor-pointer max-md:w-[calc(100vw-48px)] ${isFlipped ? 'flipped' : ''}`}
        onClick={() => !isFlipped && !isEditing && onFlip()}
      >
        {/* Front - Question */}
        <div className={`card-face bg-white border border-gray-200 rounded-2xl flex items-center justify-center p-8 shadow-lg w-full min-h-[300px] ${isFlipped ? 'hidden' : ''}`}>
          <div className="text-lg leading-relaxed text-center text-gray-800">
            {card.question}
          </div>
        </div>

        {/* Back - Answer + Image + Source */}
        <div className={`card-face card-back bg-gradient-to-br from-gray-50 to-white border border-gray-200 rounded-2xl flex flex-col items-center justify-between p-8 shadow-lg w-full min-h-[300px] relative ${isFlipped ? '' : 'hidden'}`}>
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
              />
            ) : (
              <div className="text-lg leading-relaxed text-center text-gray-800">
                {card.answer}
              </div>
            )}
            {card.image_url && (
              <img
                src={card.image_url}
                alt=""
                className="mt-4 max-h-40 rounded-lg object-contain"
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
    </div>
  )
}
