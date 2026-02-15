import type { Metadata } from 'next';
import { Orbitron, Audiowide } from 'next/font/google';
import { Suspense } from 'react';
import './globals.css';
import { ConditionalBottomNav } from '@/components/layout/ConditionalBottomNav';
import { ToastProvider } from '@/components/ui';
import { MultiChainWalletProvider } from '@/lib/wallet/MultiChainWalletProvider';
import { GlobalBackButton } from '@/components/ui/GlobalBackButton';
import { ReferralCapture } from '@/components/ReferralCapture';

const orbitron = Orbitron({ subsets: ['latin'], variable: '--font-orbitron' });
const audiowide = Audiowide({ weight: '400', subsets: ['latin'], variable: '--font-audiowide' });

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
      <body className={`${orbitron.variable} ${audiowide.variable} font-sans`}>
        <MultiChainWalletProvider>
          <ToastProvider>
            <Suspense fallback={null}>
              <ReferralCapture />
            </Suspense>
            <GlobalBackButton />
            {children}
            <ConditionalBottomNav />
          </ToastProvider>
        </MultiChainWalletProvider>
      </body>
    </html>
  );
}
