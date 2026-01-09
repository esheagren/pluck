import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { submitFeedback } from '@pluckk/shared/supabase'

export default function FeedbackPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [feedback, setFeedback] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async () => {
    if (!feedback.trim()) return

    setSubmitting(true)
    setError(null)

    try {
      await submitFeedback(user?.id, feedback.trim())
      setSubmitted(true)
      setFeedback('')
    } catch (err) {
      setError('Failed to submit feedback. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (submitted) {
    return (
      <div className="w-full max-w-2xl mx-auto px-4 md:px-0">
        <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-gray-200">
          <div className="text-center py-4">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-green-600">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Thanks for your feedback!</h3>
            <p className="text-sm text-gray-500">We appreciate you taking the time to help us improve.</p>
          </div>
          <button
            onClick={() => navigate('/')}
            className="w-full py-3 bg-gray-800 text-white text-sm font-medium rounded-lg hover:bg-gray-900 transition-colors mt-4"
          >
            Back to Review
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-2xl mx-auto px-4 md:px-0">
      <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-gray-200">
        <h2 className="text-lg md:text-xl font-semibold text-gray-800 mb-4 md:mb-6">Share Feedback</h2>
        <textarea
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder="Tell us what you think..."
          className="w-full p-3 border border-gray-200 rounded-lg text-gray-800 resize-none focus:outline-none focus:ring-2 focus:ring-gray-200 min-h-[150px]"
          autoFocus
        />
        {error && (
          <p className="text-sm text-red-500 mt-2">{error}</p>
        )}
        <div className="mt-6 flex gap-3">
          <button
            onClick={() => navigate(-1)}
            className="flex-1 py-3 bg-gray-100 text-gray-800 text-sm font-medium rounded-lg hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!feedback.trim() || submitting}
            className="flex-1 py-3 bg-gray-800 text-white text-sm font-medium rounded-lg hover:bg-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submitting ? 'Submitting...' : 'Submit'}
          </button>
        </div>
      </div>
    </div>
  )
}
