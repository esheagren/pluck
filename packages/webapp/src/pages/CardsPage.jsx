import { useState, useEffect, useRef } from 'react'
import CardGrid from '../components/CardGrid'

export default function CardsPage({ cards, loading, onUpdateCard, onDeleteCard }) {
  const [selectedCard, setSelectedCard] = useState(null)
  const [editQuestion, setEditQuestion] = useState('')
  const [editAnswer, setEditAnswer] = useState('')
  const [saving, setSaving] = useState(false)
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const questionRef = useRef(null)
  const answerRef = useRef(null)

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

  if (loading) {
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
    <div className="w-full flex flex-col items-center px-4 md:px-0">
      <div className="w-full max-w-5xl mb-4 md:mb-6">
        <h2 className="text-lg md:text-xl font-semibold text-gray-800">{cards.length} Cards</h2>
      </div>

      <CardGrid cards={cards} onCardClick={setSelectedCard} />

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
  )
}
