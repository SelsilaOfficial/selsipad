'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Home, Rocket, Plus, MessageCircle, User } from 'lucide-react';

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
      label: 'Home',
      href: '/',
      icon: Home,
    },
    {
      id: 'explore',
      label: 'Explore',
      href: '/explore',
      icon: Rocket,
    },
    {
      id: 'create',
      label: 'Create',
      href: '/create',
      icon: Plus,
    },
    {
      id: 'feed',
      label: 'Feed',
      href: '/feed',
      icon: MessageCircle,
    },
    {
      id: 'profile',
      label: 'Profile',
      href: '/profile',
      icon: User,
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
      <div className="bg-black/40 backdrop-blur-xl border-t border-[#39AEC4]/15 shadow-[0_-4px_30px_rgba(0,0,0,0.6)] relative overflow-hidden">
        {/* Glass Reflection Effect */}
        <div className="absolute inset-0 bg-gradient-to-b from-white/[0.03] to-transparent pointer-events-none" />

        <div className="flex items-stretch justify-around relative px-1 pt-2 pb-[env(safe-area-inset-bottom,8px)]">
          {navItems.map((item) => {
            const isActive =
              pathname === item.href || (item.href !== '/' && pathname?.startsWith(item.href));

            return (
              <Link
                key={item.id}
                href={item.href}
                className="flex-1 flex flex-col items-center justify-center relative group"
              >
                {/* Active pill background */}
                <div
                  className={cn(
                    'flex flex-col items-center justify-center rounded-[14px] px-3 py-1.5 transition-all duration-300',
                    isActive ? 'bg-[#39AEC4]/15' : 'bg-transparent'
                  )}
                >
                  <item.icon
                    className={cn(
                      'w-[22px] h-[22px] transition-all duration-300',
                      isActive ? 'text-[#39AEC4]' : 'text-gray-500 group-hover:text-gray-400'
                    )}
                    strokeWidth={isActive ? 2.5 : 1.8}
                  />
                  <span
                    className={cn(
                      'text-[10px] font-medium tracking-wide transition-colors duration-300 mt-0.5',
                      isActive ? 'text-[#39AEC4]' : 'text-gray-500 group-hover:text-gray-400'
                    )}
                  >
                    {item.label}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
};
