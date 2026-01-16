import type { JSX } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import MobileNav from './MobileNav';
import SandAnimation from './SandAnimation';

export default function Layout(): JSX.Element {
  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-dark-bg relative overflow-hidden">
      {/* Background animation */}
      <div className="fixed inset-0 pointer-events-none dark:opacity-30">
        <SandAnimation filterPosition={0.875} speed={0.2} opacity={0.2} />
      </div>

      <Sidebar />
      <MobileNav />
      <main className="relative z-10 flex-1 ml-[220px] flex items-start justify-center p-10 max-md:ml-0">
        <Outlet />
      </main>
      <footer className="fixed bottom-4 right-6 text-xs">
        <a
          href="/privacy"
          className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:underline"
        >
          Privacy Policy
        </a>
      </footer>
    </div>
  );
}
