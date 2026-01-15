export default function PublicCardsGrid({ cards = [], loading = false }) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-gray-100 rounded-lg p-4 animate-pulse h-32" />
        ))}
      </div>
    )
  }

  if (cards.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        No public cards yet
      </div>
    )
  }

  const styleLabels = {
    qa: 'Q&A',
    cloze: 'Cloze',
    conceptual: 'Concept',
    diagram: 'Diagram'
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {cards.map((card) => (
        <div
          key={card.id}
          className="bg-white border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors"
        >
          {/* Card Style Badge */}
          {card.style && (
            <span className="inline-block text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded mb-2">
              {styleLabels[card.style] || card.style}
            </span>
          )}

          {/* Question */}
          <div className="text-sm font-medium text-gray-800 line-clamp-2 mb-2">
            {card.question}
          </div>

          {/* Answer Preview */}
          <div className="text-xs text-gray-500 line-clamp-2">
            {card.answer}
          </div>

          {/* Tags */}
          {card.tags && card.tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1">
              {card.tags.slice(0, 3).map((tag, i) => (
                <span
                  key={i}
                  className="text-xs text-gray-400 bg-gray-50 px-1.5 py-0.5 rounded"
                >
                  {tag}
                </span>
              ))}
              {card.tags.length > 3 && (
                <span className="text-xs text-gray-400">+{card.tags.length - 3}</span>
              )}
            </div>
          )}

          {/* Date */}
          <div className="mt-3 text-xs text-gray-400">
            {new Date(card.createdAt).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: 'numeric'
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
