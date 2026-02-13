'use client';

import { usePathname, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

function getParentRoute(pathname: string): string {
  // Map specific deep routes to their logical parents
  if (pathname.match(/^\/presales\/[^/]+/)) return '/explore';
  if (pathname.match(/^\/fairlaunch\/[^/]+/)) return '/explore';
  if (pathname.match(/^\/bonding-curve\/[^/]+/)) return '/explore';
  if (pathname.match(/^\/ama\/[^/]+/)) return '/ama';
  if (pathname.match(/^\/explore\/[^/]+/)) return '/explore';
  // Default: go to the parent path segment
  const segments = pathname.split('/').filter(Boolean);
  if (segments.length > 1) {
    return '/' + segments.slice(0, -1).join('/');
  }
  return '/';
}

export function GlobalBackButton() {
  const pathname = usePathname();
  const router = useRouter();

  // Don't show on homepage or pages with custom headers
  if (
    pathname === '/' ||
    pathname.startsWith('/feed') ||
    pathname.startsWith('/profile') ||
    pathname.startsWith('/rewards') ||
    pathname.startsWith('/lock') ||
    pathname.startsWith('/staking') ||
    pathname.startsWith('/create')
  ) {
    return null;
  }

  return (
    <button
      onClick={() => router.push(getParentRoute(pathname))}
      className="fixed bottom-6 left-6 z-50 p-3 bg-gray-900/90 border border-gray-700 rounded-full text-white shadow-lg hover:bg-gray-800 transition-all backdrop-blur-sm lg:hidden"
      aria-label="Go Back"
    >
      <ArrowLeft className="w-6 h-6" />
    </button>
  );
}
