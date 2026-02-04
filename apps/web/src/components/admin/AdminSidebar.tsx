'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  LayoutDashboard, 
  Rocket, 
  Coins, 
  Lock, 
  UserCheck, 
  ShieldCheck, 
  FileText, 
  Activity, 
  MessageSquare,
  LogOut,
  Menu,
  X 
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';

const menuItems = [
  {
    title: 'Dashboard',
    href: '/admin',
    icon: LayoutDashboard,
    exact: true
  },
  {
    title: 'Fairlaunch',
    href: '/admin/fairlaunch',
    icon: Rocket
  },
  {
    title: 'Presales',
    href: '/admin/presales',
    icon: Coins
  },
  {
    title: 'Liquidity Locks',
    href: '/admin/liquidity-locks',
    icon: Lock
  },
  {
    title: 'KYC & Verification',
    href: '/admin/kyc',
    icon: UserCheck
  },
  {
    title: 'Badges',
    href: '/admin/badges',
    icon: ShieldCheck
  },
  {
    title: 'Smart Contracts',
    href: '/admin/contracts',
    icon: FileText
  },
  {
    title: 'Audit Logs',
    href: '/admin/audit-log',
    icon: Activity
  },
  {
    title: 'AMA & Feed',
    href: '/admin/ama',
    icon: MessageSquare
  },
];

export function AdminSidebar({ 
  className,
  onClose 
}: { 
  className?: string;
  onClose?: () => void;
}) {
  const pathname = usePathname();

  return (
    <div className={cn("flex flex-col h-full bg-gray-900/50 backdrop-blur-xl border-r border-gray-800", className)}>
      {/* Logo Area */}
      <div className="p-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-green-400 to-emerald-600 flex items-center justify-center">
            <span className="font-bold text-white">S</span>
          </div>
          <span className="text-xl font-bold text-white tracking-tight">
            Selsipad <span className="text-gray-500 text-sm font-normal">Admin</span>
          </span>
        </div>
        {onClose && (
          <button onClick={onClose} className="lg:hidden text-gray-400 hover:text-white">
            <X size={24} />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {menuItems.map((item) => {
          const isActive = item.exact 
            ? pathname === item.href
            : pathname.startsWith(item.href);
            
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onClose}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group",
                isActive 
                  ? "bg-green-500/10 text-green-400 border border-green-500/20" 
                  : "text-gray-400 hover:text-white hover:bg-gray-800/50"
              )}
            >
              <item.icon 
                size={18} 
                className={cn(
                  "transition-colors",
                  isActive ? "text-green-400" : "text-gray-500 group-hover:text-white"
                )}
              />
              <span className="font-medium text-sm">{item.title}</span>
              {isActive && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.5)]" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* User / Logout */}
      <div className="p-4 border-t border-gray-800">
        <div className="bg-gray-800/50 rounded-lg p-3 flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-gradient-to-r from-purple-500 to-blue-500 flex items-center justify-center text-white font-bold text-xs ring-2 ring-gray-900">
            A
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white truncate">Administrator</p>
            <p className="text-xs text-gray-500 truncate">Super User</p>
          </div>
        </div>
      </div>
    </div>
  );
}
