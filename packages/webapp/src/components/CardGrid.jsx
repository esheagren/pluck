import DraggableCard from './DraggableCard'
import FolderBadge from './FolderBadge'

export default function CardGrid({
  cards,
  onCardClick,
  showFolderBadge = true,
  selectedCardIds = new Set(),
  onToggleSelect,
  activeId = null  // The card currently being dragged
}) {
  const handleCardClick = (card, event) => {
    if (event.shiftKey) {
      // Shift+click toggles selection for multi-select
      event.preventDefault()
      // Clear any browser text selection caused by shift+click
      window.getSelection()?.removeAllRanges()
      onToggleSelect?.(card.id)
    } else {
      // Normal click opens card modal
      onCardClick?.(card)
    }
  }

  // Check if we're in a multi-select drag (dragged card is part of selection)
  const isMultiDrag = activeId && selectedCardIds.has(activeId)

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 w-full max-w-5xl">
      {cards.map((card) => {
        // Card should disappear if it's selected and we're doing a multi-drag (but not the actual dragged card)
        const isBeingDraggedAway = isMultiDrag && selectedCardIds.has(card.id) && card.id !== activeId

        return (
          <DraggableCard
            key={card.id}
            id={card.id}
            isSelected={selectedCardIds.has(card.id)}
            isBeingDraggedAway={isBeingDraggedAway}
          >
          <div
            onClick={(e) => handleCardClick(card, e)}
            className="group bg-white border border-gray-200 rounded-xl p-5 pt-10 cursor-pointer hover:shadow-md hover:border-gray-300 transition-all h-full select-none"
          >
            <div className="text-sm text-gray-800 line-clamp-3 mb-3">
              {card.question}
            </div>
            <div className="text-xs text-gray-400 line-clamp-2 mb-3">
              {card.answer}
            </div>
            {showFolderBadge && card.folder && (
              <FolderBadge folder={card.folder} />
            )}
          </div>
        </DraggableCard>
        )
      })}
    </div>
  )
}
