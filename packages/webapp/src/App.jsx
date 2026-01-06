import { Routes, Route } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import { useCards } from './hooks/useCards'
import Layout from './components/Layout'
import ReviewPage from './pages/ReviewPage'
import CardsPage from './pages/CardsPage'
import SettingsPage from './pages/SettingsPage'
import LandingPage from './pages/LandingPage'

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
  const { cards, loading: cardsLoading, updateCard, deleteCard } = useCards(user?.id)

  // Show loading while checking auth
  if (authLoading) {
    return <LoadingScreen />
  }

  // Show landing page if not authenticated
  if (!user) {
    return <LandingPage onSignIn={signIn} />
  }

  // Authenticated - show main app
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route
          path="/"
          element={
            <ReviewPage
              cards={cards}
              loading={cardsLoading}
              onUpdateCard={updateCard}
              onDeleteCard={deleteCard}
            />
          }
        />
        <Route
          path="/cards"
          element={
            <CardsPage
              cards={cards}
              loading={cardsLoading}
              onUpdateCard={updateCard}
            />
          }
        />
        <Route
          path="/settings"
          element={
            <SettingsPage
              user={user}
              billingInfo={billingInfo}
              onSignOut={signOut}
              onUpgrade={handleUpgrade}
              onManage={handleManageSubscription}
            />
          }
        />
      </Route>
    </Routes>
  )
}
