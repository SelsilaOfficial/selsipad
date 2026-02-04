'use client';

import { EVMWalletProvider } from '@/lib/wallet/EVMWalletProvider';
import { AdminShell } from '@/components/admin/AdminShell';

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Admin layout with EVM wallet provider for RainbowKit
  return (
    <EVMWalletProvider>
      <AdminShell>
        {children}
      </AdminShell>
    </EVMWalletProvider>
  );
}
