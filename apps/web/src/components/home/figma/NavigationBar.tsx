'use client';

import React, { useState } from 'react';
import { Home, Rocket, Plus, MessageSquare, User } from 'lucide-react';
import { Button } from './ui/button';
import { cn } from '@/lib/utils';

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  {
    id: 'home',
    label: 'Home',
    icon: <Home className="w-5 h-5" />,
  },
  {
    id: 'Launchpad',
    label: 'explore',
    icon: <Rocket className="w-5 h-5" />,
  },
  {
    id: 'create',
    label: 'Create',
    icon: <Plus className="w-5 h-5" />,
  },
  {
    id: 'feed',
    label: 'Feed',
    icon: <MessageSquare className="w-5 h-5" />,
  },
  {
    id: 'profile',
    label: 'Profile',
    icon: <User className="w-5 h-5" />,
  },
];

export function NavigationBar() {
  const [activeNav, setActiveNav] = useState('home');

  return (
    <nav className="w-full">
      {/* Desktop Navigation */}
      <div className="hidden md:flex items-center justify-center gap-2">
        {navItems.map((item) => (
          <Button
            key={item.id}
            onClick={() => setActiveNav(item.id)}
            variant="ghost"
            className={cn(
              'px-6 py-6 rounded-[20px] font-medium transition-all duration-300 flex items-center gap-2 border hover:bg-transparent',
              activeNav === item.id
                ? 'bg-gradient-to-r from-[#39AEC4] to-[#756BBA] text-white shadow-lg shadow-[#756BBA]/50 border-transparent hover:text-white'
                : 'bg-black/40 text-gray-400 hover:text-[#39AEC4] hover:bg-[#39AEC4]/10 border-[#39AEC4]/20'
            )}
          >
            {item.icon}
            <span>{item.label}</span>
          </Button>
        ))}
      </div>

      {/* Mobile Navigation */}
      <div className="md:hidden flex items-center justify-around gap-1">
        {navItems.map((item) => (
          <Button
            key={item.id}
            onClick={() => setActiveNav(item.id)}
            variant="ghost"
            className={cn(
              'flex flex-col items-center gap-1 px-3 py-8 h-auto rounded-[20px] transition-all duration-300 flex-1 border hover:bg-transparent',
              activeNav === item.id
                ? 'bg-gradient-to-r from-[#39AEC4] to-[#756BBA] text-white shadow-lg shadow-[#756BBA]/50 border-transparent hover:text-white'
                : 'bg-black/40 text-gray-400 border-[#39AEC4]/20 hover:text-[#39AEC4] hover:bg-[#39AEC4]/10'
            )}
          >
            {item.icon}
            <span className="text-xs font-medium">{item.label}</span>
          </Button>
        ))}
      </div>
    </nav>
  );
}
