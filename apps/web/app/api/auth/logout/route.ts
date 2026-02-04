import { logout } from '@/lib/auth/session';
import { NextResponse } from 'next/server';

/**
 * API Route: POST /api/auth/logout
 * Calls server action to delete session from database
 */
export async function POST() {
  try {
    // Call server action to delete session & redirect
    await logout();

    // Revalidate cached pages to show logged-out state
    const { revalidatePath } = await import('next/cache');
    revalidatePath('/profile');
    revalidatePath('/');

    return NextResponse.json({ 
      success: true,
      message: 'Logged out successfully' 
    });
  } catch (error) {
    console.error('[Logout API] Error:', error);
    return NextResponse.json({ error: 'Logout failed' }, { status: 500 });
  }
}
