'use client';

import { EVMWalletProvider } from '@/lib/wallet/EVMWalletProvider';
import { AdminShell } from '@/components/admin/AdminShell';

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Admin layout with EVM wallet provider for RainbowKit
  // Font isolation: admin uses system fonts instead of Orbitron/Audiowide
  return (
    <div
      style={{
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      }}
    >
      <EVMWalletProvider>
        <AdminShell>{children}</AdminShell>
      </EVMWalletProvider>
    </div>
  );
}
