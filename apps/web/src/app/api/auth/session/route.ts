import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getServerSession } from '@/lib/auth/session';

/**
 * Get current session info
 */
export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await getServerSession();

  if (!session) {
    return NextResponse.json({ authenticated: false });
  }

  return NextResponse.json({
    authenticated: true,
    userId: session.userId,
    address: session.address,
    chain: session.chain,
  });
}
