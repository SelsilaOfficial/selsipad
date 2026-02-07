'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Home, Rocket, FileText, User } from 'lucide-react';

interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: React.ElementType;
}

export const BottomNav: React.FC = () => {
  const pathname = usePathname();

  const navItems: NavItem[] = [
    {
      id: 'home',
      label: 'HOME',
      href: '/',
      icon: Home,
    },
    {
      id: 'project',
      label: 'PROJECT',
      href: '/explore',
      icon: Rocket,
    },
    {
      id: 'feed',
      label: 'FEED',
      href: '/feed',
      icon: FileText,
    },
    {
      id: 'profile',
      label: 'PROFILE',
      href: '/profile',
      icon: User,
    },
  ];

  return (
    <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[90%] max-w-[360px]">
      <div className="bg-black/80 backdrop-blur-xl border border-white/10 rounded-full px-6 py-4 shadow-2xl flex items-center justify-between">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href || (item.href !== '/' && pathname?.startsWith(item.href));

          return (
            <Link
              key={item.id}
              href={item.href}
              className={cn(
                'flex flex-col items-center justify-center w-full relative group',
                'transition-all duration-300 py-1'
              )}
            >
              <div
                className={cn(
                  'p-2 rounded-xl transition-all duration-300 mb-1',
                  isActive
                    ? 'text-[#6366F1] bg-[#6366F1]/10'
                    : 'text-gray-400 group-hover:text-gray-200'
                )}
              >
                <item.icon
                  className={cn('w-5 h-5', isActive && 'fill-current/20')}
                  strokeWidth={isActive ? 2.5 : 2}
                />
              </div>

              <span
                className={cn(
                  'text-[10px] font-bold tracking-wider transition-colors duration-300',
                  isActive ? 'text-[#6366F1]' : 'text-gray-500 group-hover:text-gray-300'
                )}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
};
