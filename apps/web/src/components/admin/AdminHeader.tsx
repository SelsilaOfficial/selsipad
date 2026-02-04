'use client';

import { Bell, Search, Menu } from 'lucide-react';
import { useAccount, useChainId, useDisconnect } from 'wagmi';
import { useWeb3Modal } from '@web3modal/wagmi/react';

export function AdminHeader({ 
  onMenuClick 
}: { 
  onMenuClick: () => void;
}) {
  const { address, isConnected, chain } = useAccount();
  const { open } = useWeb3Modal();

  return (
    <header className="h-16 flex items-center justify-between px-4 lg:px-8 border-b border-gray-800 bg-gray-900/50 backdrop-blur-xl sticky top-0 z-30">
      <div className="flex items-center gap-4">
        <button 
          onClick={onMenuClick}
          className="lg:hidden p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
        >
          <Menu size={20} />
        </button>
        
        {/* Search Bar - Visual only for now */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-gray-800/50 border border-gray-700/50 rounded-full w-64 focus-within:border-gray-600 focus-within:bg-gray-800 transition-all">
          <Search size={14} className="text-gray-500" />
          <input 
            type="text" 
            placeholder="Search..." 
            className="bg-transparent border-none outline-none text-sm text-white placeholder-gray-500 w-full"
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Notifications */}
        <button className="relative p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors">
          <Bell size={20} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-gray-900" />
        </button>

        {/* Wallet Connect (Web3Modal + Wagmi) */}
        <div className="flex items-center">
            {!isConnected ? (
              <button
                onClick={() => open()}
                type="button"
                className="bg-green-600 hover:bg-green-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              >
                Connect Wallet
              </button>
            ) : (
              <div className="flex items-center gap-3">
                {/* Network Button */}
                <button
                  onClick={() => open({ view: 'Networks' })}
                  className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg border border-gray-700 transition-colors"
                  type="button"
                >
                  <div className="relative flex h-4 w-4">
                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${chain?.id === 56 ? 'bg-yellow-400' : 'bg-blue-400'}`}></span>
                    <span className={`relative inline-flex rounded-full h-4 w-4 ${chain?.id === 56 ? 'bg-yellow-500' : 'bg-blue-500'}`}></span>
                  </div>
                  <span className="text-sm font-medium text-gray-300">{chain?.name || 'Unknown Network'}</span>
                </button>

                {/* Account Button */}
                <button 
                  onClick={() => open()} 
                  type="button" 
                  className="px-3 py-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg flex items-center gap-2 transition-colors"
                >
                    <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
                    <span className="text-sm font-medium text-white">
                      {address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Connected'}
                    </span>
                </button>
              </div>
            )}
        </div>
      </div>
    </header>
  );
}
