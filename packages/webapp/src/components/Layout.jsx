import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'

export default function Layout({ user, billingInfo, reviewedCount, totalCards, onSignOut, onUpgrade, onManage }) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar
        user={user}
        billingInfo={billingInfo}
        reviewedCount={reviewedCount}
        totalCards={totalCards}
        onSignOut={onSignOut}
        onUpgrade={onUpgrade}
        onManage={onManage}
      />
      <main className="flex-1 ml-[220px] flex items-center justify-center p-10 max-md:ml-0">
        <Outlet />
      </main>
      <footer className="fixed bottom-4 right-6 text-xs">
        <a href="/privacy.html" className="text-gray-400 hover:text-gray-600 hover:underline">
          Privacy Policy
        </a>
      </footer>
    </div>
  )
}
