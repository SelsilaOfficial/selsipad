'use client';

import { useEffect } from 'react';
import { useSearchParams } from 'next/navigation';

/**
 * Global component that captures ?ref= URL parameter on ANY page
 * and persists it to localStorage for cross-page referral tracking.
 *
 * This ensures that when a user lands on the homepage with ?ref=CODE,
 * the code is saved and available when they navigate to a project page.
 */
export function ReferralCapture() {
  const searchParams = useSearchParams();

  useEffect(() => {
    const ref = searchParams.get('ref');
    if (ref) {
      localStorage.setItem('selsipad_referral', ref);
      console.log('[Referral] Captured ref code:', ref);
    }
  }, [searchParams]);

  return null; // Invisible component
}
