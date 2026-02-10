import type { Metadata } from 'next';
import { Orbitron, Audiowide } from 'next/font/google';
import './globals.css';
import { BottomNav } from '@/components/layout';
import { ToastProvider } from '@/components/ui';

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
        <div
          className="fixed inset-0 -z-10"
          style={{
            background: 'radial-gradient(circle at 50% 0%, #1e1b4b 0%, #020617 60%)',
          }}
        />
        {/* Load Spline Viewer Script */}

        <ToastProvider>
          {children}
          {/* <BottomNav /> */}
        </ToastProvider>
      </body>
    </html>
  );
}
