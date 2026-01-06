import { useState, useEffect } from 'react'
import CardGrid from '../components/CardGrid'

export default function CardsPage({ cards, loading, onUpdateCard }) {
  const [selectedCard, setSelectedCard] = useState(null)
  const [editQuestion, setEditQuestion] = useState('')
  const [editAnswer, setEditAnswer] = useState('')
  const [saving, setSaving] = useState(false)

  // Update edit fields when a card is selected
  useEffect(() => {
    if (selectedCard) {
      setEditQuestion(selectedCard.question)
      setEditAnswer(selectedCard.answer)
    }
  }, [selectedCard])

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
    <div className="w-full flex flex-col items-center">
      <div className="w-full max-w-5xl mb-6">
        <h2 className="text-xl font-semibold text-gray-800">{cards.length} Cards</h2>
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
                value={editQuestion}
                onChange={(e) => setEditQuestion(e.target.value)}
                className="w-full p-3 border border-gray-200 rounded-lg text-gray-800 resize-none focus:outline-none focus:ring-2 focus:ring-gray-200"
                rows={3}
              />
            </div>
            <div className="border-t border-gray-100 pt-4">
              <label className="text-xs text-gray-400 uppercase tracking-wide mb-2 block">Answer</label>
              <textarea
                value={editAnswer}
                onChange={(e) => setEditAnswer(e.target.value)}
                className="w-full p-3 border border-gray-200 rounded-lg text-gray-800 resize-none focus:outline-none focus:ring-2 focus:ring-gray-200"
                rows={4}
              />
            </div>
            <div className="mt-6 flex gap-3">
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
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
