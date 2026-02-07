'use client';

import { MultiChainConnectWallet } from '@/components/wallet/MultiChainConnectWallet';
import Link from 'next/link';

export function DashboardHeader() {
  return (
    <header className="w-full border-b border-transparent bg-transparent sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
        {/* Logo & Nav - REMOVED per user request */}
        <div className="flex items-center gap-8">
          {/* Branding and Nav deleted, verifying if user wants text back? 
               User said: "sekarang buat tulisan selsipad di navbar..." 
               So I MUST put it back now.
           */}
          <Link href="/" className="flex flex-col">
            <span className="font-extrabold text-2xl tracking-tight animate-text-glow leading-none">
              SELSIPAD
            </span>
            <span className="text-[11px] text-white/80 font-medium tracking-wide whitespace-nowrap">
              Launchpad Multi Network
            </span>
          </Link>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            {/* Profile removed as it is in BottomNav */}

            <div>
              <MultiChainConnectWallet />
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
