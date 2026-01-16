import type { JSX } from 'react';
export default function PrivacyPage(): JSX.Element {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-dark-bg">
      <div className="max-w-2xl mx-auto px-6 py-16">
        {/* Header */}
        <div className="mb-12">
          <a
            href="/"
            className="inline-flex items-center gap-2 text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors mb-8"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
            Back to Pluckk
          </a>
          <h1 className="text-3xl font-semibold text-gray-800 dark:text-gray-100 mb-2">Privacy Policy</h1>
          <p className="text-gray-500 dark:text-gray-400">Last updated: January 2025</p>
        </div>

        {/* Overview */}
        <div className="bg-white dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-dark-border p-6 mb-6">
          <h2 className="text-lg font-medium text-gray-800 dark:text-gray-100 mb-4">Overview</h2>
          <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
            Pluckk is a browser extension that helps users create flashcards from highlighted text.
            This policy explains what data we collect and how we use it.
          </p>
        </div>

        {/* Information We Collect */}
        <div className="bg-white dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-dark-border p-6 mb-6">
          <h2 className="text-lg font-medium text-gray-800 dark:text-gray-100 mb-4">Information We Collect</h2>

          <div className="space-y-4 text-gray-600 dark:text-gray-300">
            <div>
              <p className="font-medium text-gray-700 dark:text-gray-200 mb-1">Text Selections</p>
              <p className="leading-relaxed">
                When you use Pluckk, the text you highlight and surrounding context is sent to our
                backend servers for processing. We use AI services (Anthropic Claude or Google
                Gemini) to generate flashcard suggestions. Your highlighted text is not permanently
                stored after processing.
              </p>
            </div>

            <div>
              <p className="font-medium text-gray-700 dark:text-gray-200 mb-1">Account Information</p>
              <p className="leading-relaxed">
                When you create an account, we store your email address and authentication
                credentials securely to provide you access to your flashcards across devices.
              </p>
            </div>

            <div>
              <p className="font-medium text-gray-700 dark:text-gray-200 mb-1">Flashcards</p>
              <p className="leading-relaxed">
                The flashcards you create are stored in our database, associated with your account,
                to enable cross-device access and spaced repetition review.
              </p>
            </div>

            <div>
              <p className="font-medium text-gray-700 dark:text-gray-200 mb-1">Mochi Integration</p>
              <p className="leading-relaxed">
                If you connect your Mochi account, we securely store your Mochi API key on our
                servers, associated with your account. This key is used only to send flashcards to
                your Mochi decks when you choose to export them.
              </p>
            </div>
          </div>
        </div>

        {/* Information We Don't Collect */}
        <div className="bg-white dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-dark-border p-6 mb-6">
          <h2 className="text-lg font-medium text-gray-800 dark:text-gray-100 mb-4">Information We Do Not Collect</h2>
          <ul className="space-y-2 text-gray-600 dark:text-gray-300">
            <li className="flex items-start gap-2">
              <span className="text-gray-400 dark:text-gray-500 mt-1">*</span>
              <span>We do not track your browsing history</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-gray-400 dark:text-gray-500 mt-1">*</span>
              <span>We do not sell any data</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-gray-400 dark:text-gray-500 mt-1">*</span>
              <span>We do not use analytics or tracking services</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-gray-400 dark:text-gray-500 mt-1">*</span>
              <span>We do not store your highlighted text on our servers permanently</span>
            </li>
          </ul>
        </div>

        {/* Third-Party Services */}
        <div className="bg-white dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-dark-border p-6 mb-6">
          <h2 className="text-lg font-medium text-gray-800 dark:text-gray-100 mb-4">Third-Party Services</h2>
          <p className="text-gray-600 dark:text-gray-300 mb-4">
            Pluckk integrates with the following third-party services:
          </p>
          <ul className="space-y-2 text-gray-600 dark:text-gray-300">
            <li className="flex items-start gap-2">
              <span className="text-gray-400 dark:text-gray-500 mt-1">*</span>
              <span>
                <strong>Anthropic Claude API</strong> - for AI card generation (
                <a
                  href="https://www.anthropic.com/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-500 dark:text-gray-400 underline hover:text-gray-800 dark:hover:text-gray-200"
                >
                  privacy policy
                </a>
                )
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-gray-400 dark:text-gray-500 mt-1">*</span>
              <span>
                <strong>Google Gemini API</strong> - for AI card generation (
                <a
                  href="https://policies.google.com/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-500 dark:text-gray-400 underline hover:text-gray-800 dark:hover:text-gray-200"
                >
                  privacy policy
                </a>
                )
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-gray-400 dark:text-gray-500 mt-1">*</span>
              <span>
                <strong>Mochi</strong> - for flashcard storage (
                <a
                  href="https://mochi.cards/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-500 dark:text-gray-400 underline hover:text-gray-800 dark:hover:text-gray-200"
                >
                  privacy policy
                </a>
                )
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-gray-400 dark:text-gray-500 mt-1">*</span>
              <span>
                <strong>Supabase</strong> - for authentication and data storage (
                <a
                  href="https://supabase.com/privacy"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-500 dark:text-gray-400 underline hover:text-gray-800 dark:hover:text-gray-200"
                >
                  privacy policy
                </a>
                )
              </span>
            </li>
          </ul>
          <p className="text-gray-600 dark:text-gray-300 mt-4">
            Your use of these services is subject to their respective privacy policies.
          </p>
        </div>

        {/* Data Storage */}
        <div className="bg-white dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-dark-border p-6 mb-6">
          <h2 className="text-lg font-medium text-gray-800 dark:text-gray-100 mb-4">Data Storage</h2>
          <p className="text-gray-600 dark:text-gray-300 leading-relaxed mb-4">
            Your flashcards, account information, and integration credentials (such as your Mochi
            API key) are stored securely in our database hosted on Supabase.
          </p>
          <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
            Some user preferences may be stored locally in your browser using Chrome's storage API
            for a better experience.
          </p>
        </div>

        {/* Data Security */}
        <div className="bg-white dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-dark-border p-6 mb-6">
          <h2 className="text-lg font-medium text-gray-800 dark:text-gray-100 mb-4">Data Security</h2>
          <ul className="space-y-2 text-gray-600 dark:text-gray-300">
            <li className="flex items-start gap-2">
              <span className="text-gray-400 dark:text-gray-500 mt-1">*</span>
              <span>
                All communications between the extension and our servers use HTTPS encryption
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-gray-400 dark:text-gray-500 mt-1">*</span>
              <span>
                Integration credentials (like Mochi API keys) are stored securely and encrypted
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-gray-400 dark:text-gray-500 mt-1">*</span>
              <span>Account data is protected with industry-standard security practices</span>
            </li>
          </ul>
        </div>

        {/* Your Rights */}
        <div className="bg-white dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-dark-border p-6 mb-6">
          <h2 className="text-lg font-medium text-gray-800 dark:text-gray-100 mb-4">Your Rights</h2>
          <p className="text-gray-600 dark:text-gray-300 mb-3">You can delete all stored data at any time by:</p>
          <ul className="space-y-2 text-gray-600 dark:text-gray-300">
            <li className="flex items-start gap-2">
              <span className="text-gray-400 dark:text-gray-500 mt-1">*</span>
              <span>Removing the Pluckk extension from Chrome (deletes local data)</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-gray-400 dark:text-gray-500 mt-1">*</span>
              <span>Deleting your account in settings (deletes all cloud-stored data)</span>
            </li>
          </ul>
        </div>

        {/* Changes */}
        <div className="bg-white dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-dark-border p-6 mb-6">
          <h2 className="text-lg font-medium text-gray-800 dark:text-gray-100 mb-4">Changes to This Policy</h2>
          <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
            We may update this privacy policy from time to time. We will notify users of any
            material changes by updating the "Last updated" date.
          </p>
        </div>

        {/* Contact */}
        <div className="bg-white dark:bg-dark-surface rounded-xl border border-gray-200 dark:border-dark-border p-6 mb-6">
          <h2 className="text-lg font-medium text-gray-800 dark:text-gray-100 mb-4">Contact</h2>
          <p className="text-gray-600 dark:text-gray-300 leading-relaxed">
            For questions about this privacy policy, please contact us at{' '}
            <a
              href="https://eriksheagren.notion.site"
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-500 dark:text-gray-400 underline hover:text-gray-800 dark:hover:text-gray-200"
            >
              eriksheagren.notion.site
            </a>
            .
          </p>
        </div>

        {/* Back link */}
        <div className="text-center">
          <a
            href="/"
            className="inline-block px-6 py-3 bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-900 text-sm font-medium rounded-lg hover:bg-gray-900 dark:hover:bg-white transition-colors"
          >
            Back to Pluckk
          </a>
        </div>
      </div>
    </div>
  );
}
