export default function CardGrid({ cards, onCardClick }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 w-full max-w-5xl">
      {cards.map((card) => (
        <div
          key={card.id}
          onClick={() => onCardClick?.(card)}
          className="bg-white border border-gray-200 rounded-xl p-5 cursor-pointer hover:shadow-md hover:border-gray-300 transition-all"
        >
          <div className="text-sm text-gray-800 line-clamp-3 mb-3">
            {card.question}
          </div>
          <div className="text-xs text-gray-400 line-clamp-2">
            {card.answer}
          </div>
        </div>
      ))}
    </div>
  )
}
