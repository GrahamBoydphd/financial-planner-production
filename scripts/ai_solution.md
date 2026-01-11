🤖 Connecting to gemini-3-pro-preview (Paid Tier)...
<file path='frontend/components/Layout.tsx'>"use client";

import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

export default function Layout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, user, logout } = useAuth();

  return (
    <div className="min-h-screen flex flex-col">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <Link href="/" className="flex-shrink-0 flex items-center font-bold text-xl text-blue-600">
                Financial Planner
              </Link>
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                <Link href="/" className="border-transparent text-gray-500 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">
                  Dashboard
                </Link>
                <Link href="/structure" className="border-transparent text-gray-500 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium">
                  Structure (Funds & Companies)
                </Link>
                <Link 
                  href="/help" 
                  className="border-transparent text-gray-500 hover:text-gray-700 inline-flex items-center px-1 pt-1 border-b-2 text-sm font-medium"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Help
                </Link>
              </div>
            </div>
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
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
</file>

