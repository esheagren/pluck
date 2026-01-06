export default function ReviewCard({ card, isFlipped, onFlip }) {
  return (
    <div className="card-wrapper">
      <div
        className={`card w-[500px] h-[300px] relative cursor-pointer max-md:w-[calc(100vw-48px)] max-md:h-[250px] ${isFlipped ? 'flipped' : ''}`}
        onClick={() => !isFlipped && onFlip()}
      >
        {/* Front - Question */}
        <div className="card-face absolute w-full h-full bg-white border border-gray-200 rounded-2xl flex items-center justify-center p-8 shadow-lg">
          <div className="text-lg leading-relaxed text-center text-gray-800 max-h-full overflow-y-auto">
            {card.question}
          </div>
        </div>

        {/* Back - Answer + Image */}
        <div className="card-face card-back absolute w-full h-full bg-gradient-to-br from-gray-50 to-white border border-gray-200 rounded-2xl flex flex-col items-center justify-center p-8 shadow-lg">
          <div className="text-lg leading-relaxed text-center text-gray-800 max-h-full overflow-y-auto">
            {card.answer}
          </div>
          {card.image_url && (
            <img
              src={card.image_url}
              alt=""
              className="mt-4 max-h-28 rounded-lg object-contain"
            />
          )}
        </div>
      </div>
    </div>
  )
}
