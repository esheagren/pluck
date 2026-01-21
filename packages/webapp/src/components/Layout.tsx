import type { JSX } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import MobileNav from './MobileNav';
import SandAnimation from './SandAnimation';
import { useTheme } from '../hooks/useTheme';

export default function Layout(): JSX.Element {
  const { isDark } = useTheme();

  return (
    <div className="flex min-h-screen bg-gray-50 dark:bg-dark-bg relative overflow-hidden">
      {/* Background animation */}
      <div className="fixed inset-0 pointer-events-none">
        <SandAnimation filterPosition={0.875} speed={0.2} opacity={0.2} darkMode={isDark} />
      </div>

      <Sidebar />
      <MobileNav />
      <main className="relative z-10 flex-1 ml-[220px] flex items-start justify-center p-10 max-md:ml-0 max-md:pt-20 max-md:px-4">
        <Outlet />
      </main>
    </div>
  );
}
