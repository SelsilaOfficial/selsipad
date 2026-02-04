'use client';

import { usePathname, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

export function GlobalBackButton() {
  const pathname = usePathname();
  const router = useRouter();

  // Don't show on homepage
  if (pathname === '/') return null;

  return (
    <button
      onClick={() => router.back()}
      className="fixed bottom-6 left-6 z-50 p-3 bg-gray-900/90 border border-gray-700 rounded-full text-white shadow-lg hover:bg-gray-800 transition-all backdrop-blur-sm lg:hidden"
      aria-label="Go Back"
    >
      <ArrowLeft className="w-6 h-6" />
    </button>
  );
}
