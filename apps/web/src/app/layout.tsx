import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import '../styles/globals.css';
import { BottomNav } from '@/components/layout';
import { ToastProvider } from '@/components/ui';

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
        <div
          className="fixed inset-0 -z-10"
          style={{
            background: 'radial-gradient(circle at 50% 0%, #1e1b4b 0%, #020617 60%)',
          }}
        />
        {/* Load Spline Viewer Script */}

        <ToastProvider>
          {children}
          <BottomNav />
        </ToastProvider>
      </body>
    </html>
  );
}
