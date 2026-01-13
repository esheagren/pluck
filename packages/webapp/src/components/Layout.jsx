import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import MobileNav from './MobileNav'
import SandAnimation from './SandAnimation'

export default function Layout({ folders = [] }) {
  return (
    <div className="flex min-h-screen bg-gray-50 relative overflow-hidden">
      {/* Background animation */}
      <div className="fixed inset-0 pointer-events-none">
        <SandAnimation filterPosition={0.875} speed={0.2} opacity={0.2} />
      </div>

      <Sidebar folders={folders} />
      <MobileNav folders={folders} />
      <main className="relative z-10 flex-1 ml-[220px] flex items-center justify-center p-10 max-md:ml-0">
        <Outlet />
      </main>
      <footer className="fixed bottom-4 right-6 text-xs">
        <a href="/privacy" className="text-gray-400 hover:text-gray-600 hover:underline">
          Privacy Policy
        </a>
      </footer>
    </div>
  )
}
