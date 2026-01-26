'use client';

import { EVMWalletProvider } from '@/lib/wallet/EVMWalletProvider';

export default function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Admin layout with EVM wallet provider for RainbowKit
  return (
    <EVMWalletProvider>
      <div className="min-h-screen bg-black p-6">{children}</div>
    </EVMWalletProvider>
  );
}
