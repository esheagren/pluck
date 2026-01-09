export default function InfoPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-4 md:px-6 py-8 md:py-16">
        {/* Back Button */}
        <a
          href="/"
          className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-800 transition-colors mb-8"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          <span className="text-sm font-medium">Back to app</span>
        </a>

        {/* Header */}
        <div className="text-center mb-8 md:mb-12">
          <h1 className="text-2xl md:text-3xl font-semibold text-gray-800 mb-2">Pluckk</h1>
          <p className="text-gray-500 text-sm md:text-base">Turn any content into lasting knowledge</p>
        </div>

        {/* About Section */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-medium text-gray-800 mb-4">About</h2>
          <p className="text-gray-600 leading-relaxed mb-4">
            Pluckk is a browser extension that helps you create spaced repetition flashcards
            from any content you encounter on the web. Simply highlight text or paste a
            screenshot, and Pluckk will generate smart flashcard suggestions using AI.
          </p>
          <p className="text-gray-600 leading-relaxed">
            Built on the science of spaced repetition, Pluckk helps you retain what you
            learn by turning passive reading into active recall practice.
          </p>
        </div>

        {/* How It Works */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-medium text-gray-800 mb-4">How It Works</h2>
          <ol className="space-y-3 text-gray-600">
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center text-sm font-medium text-gray-700">1</span>
              <span>Highlight text on any webpage or paste a screenshot</span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center text-sm font-medium text-gray-700">2</span>
              <span>Pluckk generates 2-4 flashcard suggestions using AI</span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center text-sm font-medium text-gray-700">3</span>
              <span>Select and edit the cards you want to keep</span>
            </li>
            <li className="flex gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center text-sm font-medium text-gray-700">4</span>
              <span>Store cards to review later with spaced repetition</span>
            </li>
          </ol>
        </div>

        {/* Features */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-medium text-gray-800 mb-4">Features</h2>
          <ul className="space-y-2 text-gray-600">
            <li className="flex items-start gap-2">
              <span className="text-gray-400 mt-1">•</span>
              <span>AI-powered flashcard generation from text and images</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-gray-400 mt-1">•</span>
              <span>Multiple card styles: Q&A, cloze deletion, explanations</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-gray-400 mt-1">•</span>
              <span>Optional Mochi integration for seamless export</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-gray-400 mt-1">•</span>
              <span>Built-in spaced repetition review system</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-gray-400 mt-1">•</span>
              <span>Works on any website</span>
            </li>
          </ul>
        </div>

        {/* Links */}
        <div className="text-center space-y-4">
          <a
            href="/"
            className="inline-block px-6 py-3 bg-gray-800 text-white text-sm font-medium rounded-lg hover:bg-gray-900 transition-colors"
          >
            Go to App
          </a>
          <p className="text-sm text-gray-400">
            Version 1.0.0
          </p>
        </div>
      </div>
    </div>
  )
}
