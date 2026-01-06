import { NavLink } from 'react-router-dom'

export default function Sidebar({ user, billingInfo, reviewedCount, totalCards, onSignOut, onUpgrade, onManage }) {
  return (
    <nav className="w-[220px] bg-white border-r border-gray-200 flex flex-col fixed top-0 left-0 bottom-0 max-md:hidden">
      {/* Header */}
      <div className="px-5 py-6 border-b border-gray-200">
        <h1 className="text-lg font-semibold text-gray-800 tracking-tight">Pluckk</h1>
      </div>

      {/* Nav Links */}
      <div className="flex-1 p-3 flex flex-col gap-1">
        <NavLink
          to="/"
          className={({ isActive }) =>
            `flex items-center gap-3 px-3.5 py-3 rounded-lg text-sm font-medium transition-all ${
              isActive ? 'bg-gray-100 text-gray-800' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
            }`
          }
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
            <polyline points="9 22 9 12 15 12 15 22"></polyline>
          </svg>
          <span>Review</span>
        </NavLink>

        <NavLink
          to="/cards"
          className={({ isActive }) =>
            `flex items-center gap-3 px-3.5 py-3 rounded-lg text-sm font-medium transition-all ${
              isActive ? 'bg-gray-100 text-gray-800' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
            }`
          }
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="7" height="7" rx="1"></rect>
            <rect x="14" y="3" width="7" height="7" rx="1"></rect>
            <rect x="3" y="14" width="7" height="7" rx="1"></rect>
            <rect x="14" y="14" width="7" height="7" rx="1"></rect>
          </svg>
          <span>Cards</span>
        </NavLink>

        <NavLink
          to="/settings"
          className={({ isActive }) =>
            `flex items-center gap-3 px-3.5 py-3 rounded-lg text-sm font-medium transition-all ${
              isActive ? 'bg-gray-100 text-gray-800' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-800'
            }`
          }
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
          </svg>
          <span>Settings</span>
        </NavLink>
      </div>

      {/* Footer */}
      <div className="p-5 border-t border-gray-200">
        {/* Progress */}
        <div className="flex flex-col gap-0.5">
          <span className="text-xl font-semibold text-gray-800">{reviewedCount} / {totalCards}</span>
          <span className="text-xs text-gray-500">cards reviewed</span>
        </div>

        {/* User Profile */}
        {user && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <div className="text-sm text-gray-800 break-all mb-2">{user.email}</div>

            {/* Billing Info */}
            {billingInfo && !billingInfo.isPro && (
              <div className="mt-3 flex items-center gap-2">
                <span className="text-xs text-gray-500">{billingInfo.cardsUsed} / {billingInfo.limit} cards</span>
                <button
                  onClick={onUpgrade}
                  className="btn-upgrade text-white text-xs font-medium px-2.5 py-1 rounded transition-all"
                >
                  Upgrade
                </button>
              </div>
            )}

            {billingInfo?.isPro && (
              <div className="mt-3 flex items-center gap-2">
                <span className="pro-badge text-white text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wide">
                  Pro
                </span>
                <button
                  onClick={onManage}
                  className="text-xs text-gray-500 underline hover:text-gray-800"
                >
                  Manage
                </button>
              </div>
            )}

            <button
              onClick={onSignOut}
              className="mt-3 text-xs text-gray-500 underline hover:text-gray-800"
            >
              Sign out
            </button>
          </div>
        )}
      </div>
    </nav>
  )
}
