import { useState, useEffect, useRef } from 'react'

export default function ReviewCard({ card, isFlipped, onFlip, onUpdateCard }) {
  const [isEditing, setIsEditing] = useState(false)
  const [editQuestion, setEditQuestion] = useState('')
  const [editAnswer, setEditAnswer] = useState('')
  const [saving, setSaving] = useState(false)
  const questionRef = useRef(null)
  const answerRef = useRef(null)

  useEffect(() => {
    if (isEditing) {
      setEditQuestion(card.question)
      setEditAnswer(card.answer)
    }
  }, [isEditing, card])

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
    if (!onUpdateCard) return
    setSaving(true)
    const { error } = await onUpdateCard(card.id, {
      question: editQuestion,
      answer: editAnswer
    })
    setSaving(false)
    if (!error) {
      setIsEditing(false)
    }
  }

  const hasChanges = editQuestion !== card.question || editAnswer !== card.answer

  return (
    <div className="card-wrapper">
      <div
        className={`card w-[500px] min-h-[300px] relative cursor-pointer max-md:w-[calc(100vw-48px)] ${isFlipped ? 'flipped' : ''}`}
        onClick={() => !isFlipped && onFlip()}
      >
        {/* Front - Question */}
        <div className={`card-face bg-white border border-gray-200 rounded-2xl flex items-center justify-center p-8 shadow-lg w-full min-h-[300px] ${isFlipped ? 'hidden' : ''}`}>
          <div className="text-lg leading-relaxed text-center text-gray-800">
            {card.question}
          </div>
        </div>

        {/* Back - Answer + Image + Source */}
        <div className={`card-face card-back bg-gradient-to-br from-gray-50 to-white border border-gray-200 rounded-2xl flex flex-col items-center justify-between p-8 shadow-lg w-full min-h-[300px] relative ${isFlipped ? '' : 'hidden'}`}>
          {/* Edit button */}
          <button
            onClick={(e) => {
              e.stopPropagation()
              setIsEditing(true)
            }}
            className="absolute top-3 right-3 p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
            title="Edit card"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
          </button>

          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="text-lg leading-relaxed text-center text-gray-800">
              {card.answer}
            </div>
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

      {/* Edit Modal */}
      {isEditing && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
          onClick={() => setIsEditing(false)}
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
                className="w-full p-3 border border-gray-200 rounded-lg text-gray-800 resize-none focus:outline-none focus:ring-2 focus:ring-gray-200 overflow-hidden min-h-[60px]"
              />
            </div>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setIsEditing(false)}
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
