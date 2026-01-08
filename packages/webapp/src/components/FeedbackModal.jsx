import { useState } from 'react'
import { submitFeedback } from '@pluckk/shared/supabase'


export default function FeedbackModal({ isOpen, onClose, userId }) {
  const [feedback, setFeedback] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState(null)

  if (!isOpen) return null

  const handleSubmit = async () => {
    if (!feedback.trim()) return

    setSubmitting(true)
    setError(null)

    try {
      await submitFeedback(userId, feedback.trim())
      setSubmitted(true)
      setFeedback('')
    } catch (err) {
      setError('Failed to submit feedback. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleClose = () => {
    setFeedback('')
    setSubmitted(false)
    setError(null)
    onClose()
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
      onClick={handleClose}
    >
      <div
        className="bg-white rounded-2xl max-w-xl w-full p-8 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {submitted ? (
          <>
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
              onClick={handleClose}
              className="w-full py-3 bg-gray-800 text-white text-sm font-medium rounded-lg hover:bg-gray-900 transition-colors mt-4"
            >
              Close
            </button>
          </>
        ) : (
          <>
            <h3 className="text-xl font-semibold text-gray-800 mb-6">Share Feedback</h3>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Tell us what you think..."
              className="w-full p-4 border border-gray-200 rounded-lg text-gray-800 resize-none focus:outline-none focus:ring-2 focus:ring-gray-200 min-h-[180px] text-base"
              autoFocus
            />
            {error && (
              <p className="text-sm text-red-500 mt-2">{error}</p>
            )}
            <div className="mt-6 flex gap-3">
              <button
                onClick={handleClose}
                className="flex-1 py-3.5 bg-gray-100 text-gray-800 font-medium rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!feedback.trim() || submitting}
                className="flex-1 py-3.5 bg-gray-800 text-white font-medium rounded-lg hover:bg-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Submitting...' : 'Submit'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
