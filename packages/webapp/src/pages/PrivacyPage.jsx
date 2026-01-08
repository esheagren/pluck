export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-2xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="mb-12">
          <a href="/" className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-800 transition-colors mb-8">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            Back to Pluckk
          </a>
          <h1 className="text-3xl font-semibold text-gray-800 mb-2">Privacy Policy</h1>
          <p className="text-gray-500">Last updated: January 2025</p>
        </div>

        {/* Overview */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-medium text-gray-800 mb-4">Overview</h2>
          <p className="text-gray-600 leading-relaxed">
            Pluckk is a browser extension that helps users create flashcards from highlighted text.
            This policy explains what data we collect and how we use it.
          </p>
        </div>

        {/* Information We Collect */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-medium text-gray-800 mb-4">Information We Collect</h2>

          <div className="space-y-4 text-gray-600">
            <div>
              <p className="font-medium text-gray-700 mb-1">Text Selections</p>
              <p className="leading-relaxed">
                When you use Pluckk, the text you highlight and surrounding context is temporarily processed
                to generate flashcards. This text is sent to your chosen AI provider (Anthropic Claude API
                or Google Gemini API) for processing.
              </p>
            </div>

            <div>
              <p className="font-medium text-gray-700 mb-1">API Keys</p>
              <p className="leading-relaxed">
                Your API keys for Claude, Gemini, and Mochi are stored locally in your browser using
                Chrome's secure storage API. These keys never leave your device except when making
                authorized API calls to their respective services.
              </p>
            </div>

            <div>
              <p className="font-medium text-gray-700 mb-1">Account Information</p>
              <p className="leading-relaxed">
                If you create an account, we store your email address and authentication credentials
                securely to provide you access to your flashcards across devices.
              </p>
            </div>

            <div>
              <p className="font-medium text-gray-700 mb-1">Mochi Integration</p>
              <p className="leading-relaxed">
                If you connect your Mochi account, your Mochi API key is stored locally and used only
                to send flashcards to your Mochi decks.
              </p>
            </div>
          </div>
        </div>

        {/* Information We Don't Collect */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-medium text-gray-800 mb-4">Information We Do Not Collect</h2>
          <ul className="space-y-2 text-gray-600">
            <li className="flex items-start gap-2">
              <span className="text-gray-400 mt-1">•</span>
              <span>We do not track your browsing history</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-gray-400 mt-1">•</span>
              <span>We do not sell any data</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-gray-400 mt-1">•</span>
              <span>We do not use analytics or tracking services</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-gray-400 mt-1">•</span>
              <span>We do not store your highlighted text on our servers permanently</span>
            </li>
          </ul>
        </div>

        {/* Third-Party Services */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-medium text-gray-800 mb-4">Third-Party Services</h2>
          <p className="text-gray-600 mb-4">Pluckk integrates with the following third-party services:</p>
          <ul className="space-y-2 text-gray-600">
            <li className="flex items-start gap-2">
              <span className="text-gray-400 mt-1">•</span>
              <span>
                <strong>Anthropic Claude API</strong> - for AI card generation
                (<a href="https://www.anthropic.com/privacy" target="_blank" rel="noopener noreferrer" className="text-gray-500 underline hover:text-gray-800">privacy policy</a>)
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-gray-400 mt-1">•</span>
              <span>
                <strong>Google Gemini API</strong> - for AI card generation
                (<a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-gray-500 underline hover:text-gray-800">privacy policy</a>)
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-gray-400 mt-1">•</span>
              <span>
                <strong>Mochi</strong> - for flashcard storage
                (<a href="https://mochi.cards/privacy" target="_blank" rel="noopener noreferrer" className="text-gray-500 underline hover:text-gray-800">privacy policy</a>)
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-gray-400 mt-1">•</span>
              <span>
                <strong>Supabase</strong> - for authentication and data storage
                (<a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer" className="text-gray-500 underline hover:text-gray-800">privacy policy</a>)
              </span>
            </li>
          </ul>
          <p className="text-gray-600 mt-4">Your use of these services is subject to their respective privacy policies.</p>
        </div>

        {/* Data Storage */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-medium text-gray-800 mb-4">Data Storage</h2>
          <p className="text-gray-600 leading-relaxed mb-4">
            User preferences and API keys are stored locally in your browser using Chrome's storage.sync API.
            This data syncs across your Chrome browsers if you are signed into Chrome, but is not accessible to us.
          </p>
          <p className="text-gray-600 leading-relaxed">
            If you create an account, your flashcards are stored securely in our database to enable
            cross-device access and the review functionality.
          </p>
        </div>

        {/* Data Security */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-medium text-gray-800 mb-4">Data Security</h2>
          <ul className="space-y-2 text-gray-600">
            <li className="flex items-start gap-2">
              <span className="text-gray-400 mt-1">•</span>
              <span>API keys are stored using Chrome's secure storage mechanism</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-gray-400 mt-1">•</span>
              <span>All API communications use HTTPS encryption</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-gray-400 mt-1">•</span>
              <span>Account data is stored securely with industry-standard encryption</span>
            </li>
          </ul>
        </div>

        {/* Your Rights */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-medium text-gray-800 mb-4">Your Rights</h2>
          <p className="text-gray-600 mb-3">You can delete all stored data at any time by:</p>
          <ul className="space-y-2 text-gray-600">
            <li className="flex items-start gap-2">
              <span className="text-gray-400 mt-1">•</span>
              <span>Removing the Pluckk extension from Chrome (deletes local data)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-gray-400 mt-1">•</span>
              <span>Deleting your account in settings (deletes all cloud-stored data)</span>
            </li>
          </ul>
        </div>

        {/* Changes */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-medium text-gray-800 mb-4">Changes to This Policy</h2>
          <p className="text-gray-600 leading-relaxed">
            We may update this privacy policy from time to time. We will notify users of any
            material changes by updating the "Last updated" date.
          </p>
        </div>

        {/* Contact */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-medium text-gray-800 mb-4">Contact</h2>
          <p className="text-gray-600 leading-relaxed">
            For questions about this privacy policy, please contact us at{' '}
            <a href="https://eriksheagren.notion.site" target="_blank" rel="noopener noreferrer" className="text-gray-500 underline hover:text-gray-800">
              eriksheagren.notion.site
            </a>.
          </p>
        </div>

        {/* Back link */}
        <div className="text-center">
          <a
            href="/"
            className="inline-block px-6 py-3 bg-gray-800 text-white text-sm font-medium rounded-lg hover:bg-gray-900 transition-colors"
          >
            Back to Pluckk
          </a>
        </div>
      </div>
    </div>
  )
}
