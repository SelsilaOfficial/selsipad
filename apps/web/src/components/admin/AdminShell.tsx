'use client';

import { useState } from 'react';
import { AdminSidebar } from './AdminSidebar';
import { AdminHeader } from './AdminHeader';
import { cn } from '@/lib/utils';

export function AdminShell({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen bg-[#0a0a0a]">
      {/* Desktop Sidebar */}
      <div className="hidden lg:block w-72 fixed inset-y-0 z-40">
        <AdminSidebar />
      </div>

      {/* Mobile Sidebar (Drawer) */}
      <div className={cn(
        "lg:hidden fixed inset-0 z-50 bg-black/80 backdrop-blur-sm transition-opacity duration-300",
        sidebarOpen ? "opacity-100" : "opacity-0 pointer-events-none"
      )} onClick={() => setSidebarOpen(false)} />
      
      <div className={cn(
        "lg:hidden fixed inset-y-0 left-0 z-50 w-72 bg-gray-900 transition-transform duration-300 transform",
        sidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <AdminSidebar onClose={() => setSidebarOpen(false)} />
      </div>

      {/* Main Content */}
      <div className="flex-1 lg:ml-72 flex flex-col min-h-screen">
        <AdminHeader onMenuClick={() => setSidebarOpen(true)} />
        <main className="flex-1 p-4 lg:p-8 overflow-x-hidden">
          <div className="max-w-7xl mx-auto w-full animate-fade-in">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
