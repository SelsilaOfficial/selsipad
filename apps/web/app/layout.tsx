import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import '../src/styles/globals.css';
import { ConditionalBottomNav } from '@/components/layout/ConditionalBottomNav';
import { ToastProvider } from '@/components/ui';
import { MultiChainWalletProvider } from '@/lib/wallet/MultiChainWalletProvider';
import { GlobalBackButton } from '@/components/ui/GlobalBackButton';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'SELSIPAD Web',
  description: 'SELSIPAD - Multi-chain Launchpad Platform',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body className={inter.className}>
        <MultiChainWalletProvider>
          <ToastProvider>
            <GlobalBackButton />
            {children}
            <ConditionalBottomNav />
          </ToastProvider>
        </MultiChainWalletProvider>
      </body>
    </html>
  );
}
