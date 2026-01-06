export default function ReviewCard({ card, isFlipped, onFlip }) {
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

        {/* Back - Answer + Image */}
        <div className={`card-face card-back bg-gradient-to-br from-gray-50 to-white border border-gray-200 rounded-2xl flex flex-col items-center justify-center p-8 shadow-lg w-full min-h-[300px] ${isFlipped ? '' : 'hidden'}`}>
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
      </div>
    </div>
  )
}
