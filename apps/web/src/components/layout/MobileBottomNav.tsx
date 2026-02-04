'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Globe, LayoutGrid, User, MessageSquare } from 'lucide-react';

export function MobileBottomNav() {
  const pathname = usePathname();

  const navItems = [
    {
      label: 'Home',
      icon: <Home className="w-6 h-6" />,
      href: '/',
    },
    {
      label: 'Explore',
      icon: <Globe className="w-6 h-6" />,
      href: '/explore',
    },
    {
      label: 'Portfolio',
      icon: <LayoutGrid className="w-6 h-6" />, // Or User
      href: '/profile',
    },
    {
      label: 'Feed',
      icon: <MessageSquare className="w-6 h-6" />,
      href: '/feed',
    },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-bg-surface/90 backdrop-blur-lg border-t border-border-subtle md:hidden safe-bottom">
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`
                flex flex-col items-center justify-center w-full h-full space-y-1
                transition-colors duration-200
                ${isActive ? 'text-primary-main' : 'text-text-tertiary hover:text-text-secondary'}
              `}
            >
              {item.icon}
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
