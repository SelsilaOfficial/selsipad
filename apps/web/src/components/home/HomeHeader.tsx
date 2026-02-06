'use client';

import Link from 'next/link';
import { Search, Bell } from 'lucide-react';
import NextImage from 'next/image';
import { MultiChainConnectWallet } from '@/components/wallet/MultiChainConnectWallet';

export function HomeHeader() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 transition-all duration-300 bg-[#020617]/80 backdrop-blur-xl border-b border-white/5 safe-top">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between gap-4">
        
        {/* Logo (Mobile: Icon only, Desktop: Full) */}
        <Link href="/" className="shrink-0 flex items-center gap-2">
           <NextImage 
             src="/assets/selsipad-logo.png" 
             alt="Selsipad" 
             width={32} 
             height={32} 
             className="w-8 h-8 object-contain"
           />
           <span className="hidden sm:block text-lg font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
             Selsipad
           </span>
        </Link>
        
        {/* Search Bar (Expanded on desktop, collapsed on mobile maybe? For now full bar) */}
        <div className="flex-1 max-w-md hidden sm:block">
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-400 group-focus-within:text-indigo-400 transition-colors" />
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-3 py-2 border border-white/5 rounded-full leading-5 bg-white/5 text-gray-300 placeholder-gray-500 focus:outline-none focus:bg-white/10 focus:ring-1 focus:ring-indigo-500/50 sm:text-sm transition-colors"
              placeholder="Search projects, tokens..."
            />
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-3 md:gap-4 shrink-0">
          <button className="p-2 rounded-full text-gray-400 hover:text-white hover:bg-white/5 transition-colors relative">
            <Bell className="w-5 h-5" />
            <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-[#020617]"></span>
          </button>
          
          <Link
            href="/profile"
            className="relative group overflow-hidden rounded-full border border-white/10 hover:border-indigo-500/50 transition-colors"
          >
            <NextImage 
              src="/assets/user-avatar-3d.png" 
              alt="Profile" 
              width={32} 
              height={32} 
              className="w-8 h-8 object-cover group-hover:scale-110 transition-transform duration-300"
            />
          </Link>
          
          <div className="hidden md:block">
            <MultiChainConnectWallet />
          </div>
        </div>
      </div>
      
      {/* Mobile Search Bar (Below Header) */}
      <div className="sm:hidden px-4 pb-3">
         <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-4 w-4 text-gray-500" />
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-3 py-2 border border-white/5 rounded-xl leading-5 bg-white/5 text-gray-300 placeholder-gray-500 focus:outline-none focus:bg-white/10 text-sm"
              placeholder="Search..."
            />
         </div>
      </div>
    </header>
  );
}
