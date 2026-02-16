🤖 Connecting to gemini-3-pro-preview (Paid Tier)...
<file path='frontend/components/Layout.tsx'>
"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user, logout } = useAuth();
  const pathname = usePathname();

  // Helper to determine if a tab is active
  const isActive = (path: string) => {
    if (path === '/') return pathname === '/';
    return pathname?.startsWith(path);
  };

  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Master Banner / Navigation */}
      <nav className="bg-gray-200 border-b border-gray-300">
        <div className="max-w-[92rem] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              {/* Logo Section - Vertically Centered */}
              <div className="flex-shrink-0 flex items-center mr-8">
                <Link href="/" className="flex items-center font-bold text-xl text-blue-600">
                  <img src="/logo.png" alt="Evolutesix Logo" className="h-12 w-auto mr-3" />
                  Financial Planner
                </Link>
              </div>

              {/* Navigation Tabs - Aligned to Bottom for Browser-Tab look */}
              <div className="hidden sm:flex sm:space-x-2 items-end">
                <Link
                  href="/"
                  className={`px-4 py-2 text-sm font-medium rounded-t-md transition-colors duration-200 ${
                    isActive('/') 
                      ? 'bg-white text-indigo-600 shadow-sm' 
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  Dashboard
                </Link>
                <Link
                  href="/structure"
                  className={`px-4 py-2 text-sm font-medium rounded-t-md transition-colors duration-200 ${
                    isActive('/structure') 
                      ? 'bg-white text-indigo-600 shadow-sm' 
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  Structure (Funds & Companies)
                </Link>
                <Link
                  href="/help"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`px-4 py-2 text-sm font-medium rounded-t-md transition-colors duration-200 ${
                    isActive('/help') 
                      ? 'bg-white text-indigo-600 shadow-sm' 
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  Guide & Help
                </Link>
                <Link
                  href="/improve"
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`px-4 py-2 text-sm font-medium rounded-t-md transition-colors duration-200 ${
                    isActive('/improve') 
                      ? 'bg-white text-indigo-600 shadow-sm' 
                      : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  How can we improve?
                </Link>
              </div>
            </div>

            {/* User Section - Vertically Centered */}
            <div className="flex items-center">
              {isAuthenticated ? (
                <div className="flex items-center space-x-4">
                  <span className="text-sm text-gray-700">
                    Welcome, {user?.username}
                  </span>
                  <button
                    onClick={logout}
                    className="text-sm text-red-600 hover:text-red-800 font-medium"
                  >
                    Logout
                  </button>
                </div>
              ) : (
                <span className="text-sm text-gray-500">Not Logged In</span>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 max-w-[92rem] w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
</file>

