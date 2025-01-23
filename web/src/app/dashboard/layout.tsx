'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { CloudArrowUpIcon, FilmIcon } from '@heroicons/react/24/outline';
import type { ComponentType } from 'react';

interface NavItem {
  name: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
}

const navItems: NavItem[] = [
  { name: 'Upload', href: '/dashboard/upload', icon: CloudArrowUpIcon },
  { name: 'Library', href: '/dashboard/library', icon: FilmIcon },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div className="min-h-screen bg-black">
      {/* Navbar */}
      <header className="navbar bg-black fixed top-0 z-50 px-4 h-14">
        <div className="flex-1">          
          <span className="text-xl font-bold bg-gradient-to-r from-purple-500 to-cyan-500 text-transparent bg-clip-text">
            ShortRelay
          </span>
        </div>
        <div className="flex-none">
          <button 
            onClick={() => router.push('/login')}
            className="px-6 py-2 rounded-full bg-gradient-to-r from-purple-500 to-cyan-500 text-white text-sm font-medium"
          >
            Logout
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-14 pb-16 lg:pb-0 px-4">
        {children}
      </main>

      {/* Mobile Bottom Navigation */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-black/80 backdrop-blur-sm border-t border-gray-800">
        <div className="flex justify-around items-center h-16 px-4">
          {navItems.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className="flex flex-col items-center justify-center w-full h-full"
              >
                <item.icon 
                  className={`w-6 h-6 ${
                    isActive 
                      ? 'text-transparent fill-purple-500 stroke-purple-500' 
                      : 'text-gray-400'
                  }`}
                />
                <span 
                  className={`text-xs mt-1 ${
                    isActive
                      ? 'bg-gradient-to-r from-purple-500 to-cyan-500 text-transparent bg-clip-text font-medium'
                      : 'text-gray-400'
                  }`}
                >
                  {item.name}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Desktop Sidebar */}
      <div className="hidden lg:block fixed top-14 left-0 w-64 h-[calc(100vh-3.5rem)] bg-gray-900/50 backdrop-blur-sm">
        <nav className="p-4">
          <ul className="space-y-2">
            {navItems.map((item) => (
              <li key={item.name}>
                <Link
                  href={item.href}
                  className={`flex items-center px-4 py-3 rounded-lg transition-colors ${
                    pathname === item.href
                      ? 'bg-gradient-to-r from-purple-500 to-cyan-500 text-white'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800'
                  }`}
                >
                  <item.icon className="w-5 h-5 mr-3" />
                  {item.name}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </div>
  );
}