import { useState, useCallback } from 'react'
import { Routes, Route } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import { useCards } from './hooks/useCards'
import Layout from './components/Layout'
import ReviewPage from './pages/ReviewPage'
import CardsPage from './pages/CardsPage'

// Login Screen Component
function LoginScreen({ onSignIn }) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="flex flex-col items-center text-center gap-5">
        <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mb-2">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-gray-400">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
            <circle cx="12" cy="7" r="4"></circle>
          </svg>
        </div>
        <h2 className="text-xl font-medium text-gray-800">Welcome to Pluckk</h2>
        <p className="text-gray-500 text-sm">Sign in to review your flashcards</p>
        <button
          onClick={onSignIn}
          className="mt-2 flex items-center gap-3 px-6 py-3 bg-white text-gray-800 text-sm font-medium border border-gray-200 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-all"
        >
          <svg width="18" height="18" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Sign in with Google
        </button>
      </div>
    </div>
  )
}

// Loading Screen Component
function LoadingScreen() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <div className="spinner w-8 h-8 border-3 border-gray-200 border-t-gray-800 rounded-full"></div>
        <p className="text-gray-500 text-sm">Loading...</p>
      </div>
    </div>
  )
}

export default function App() {
  const { user, loading: authLoading, billingInfo, signIn, signOut, handleUpgrade, handleManageSubscription } = useAuth()
  const { cards, loading: cardsLoading } = useCards(user?.id)

  const [reviewProgress, setReviewProgress] = useState({ reviewed: 0, total: 0 })

  const handleProgressChange = useCallback((reviewed, total) => {
    setReviewProgress({ reviewed, total })
  }, [])

  // Show loading while checking auth
  if (authLoading) {
    return <LoadingScreen />
  }

  // Show login if not authenticated
  if (!user) {
    return <LoginScreen onSignIn={signIn} />
  }

  // Authenticated - show main app
  return (
    <Routes>
      <Route
        element={
          <Layout
            user={user}
            billingInfo={billingInfo}
            reviewedCount={reviewProgress.reviewed}
            totalCards={cards.length}
            onSignOut={signOut}
            onUpgrade={handleUpgrade}
            onManage={handleManageSubscription}
          />
        }
      >
        <Route
          path="/"
          element={
            <ReviewPage
              cards={cards}
              loading={cardsLoading}
              onProgressChange={handleProgressChange}
            />
          }
        />
        <Route
          path="/cards"
          element={
            <CardsPage
              cards={cards}
              loading={cardsLoading}
            />
          }
        />
      </Route>
    </Routes>
  )
}
