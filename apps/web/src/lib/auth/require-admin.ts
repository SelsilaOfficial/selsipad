import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export type RequireAdminResult = { userId: string } | NextResponse;

/**
 * Resolve authenticated user from request.
 * Priority:
 *   1. admin_session cookie (set by admin login — always maps to admin wallet)
 *   2. Authorization Bearer header (Supabase JWT)
 *   3. session_token cookie (regular user session — may not be admin)
 * Returns userId or null.
 */
export async function getAuthUserId(request: NextRequest): Promise<string | null> {
  let userId: string | null = null;

  // 1. Try admin_session cookie first (set by /api/auth/admin-login)
  const cookieStore = await cookies();
  const adminCookie = cookieStore.get('admin_session')?.value;
  if (adminCookie) {
    try {
      const adminSession = JSON.parse(adminCookie);
      if (adminSession.userId) {
        userId = adminSession.userId;
        console.log('[requireAdmin] Using admin_session cookie, userId:', userId);
        return userId;
      }
    } catch {
      // Invalid JSON, fall through
    }
  }

  // 2. Try Authorization Bearer header
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.replace('Bearer ', '');
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);
    if (!error && user) userId = user.id;
  }

  // 3. Fallback: session_token cookie
  if (!userId) {
    const sessionToken = cookieStore.get('session_token')?.value;
    if (sessionToken) {
      const { data: session } = await supabase
        .from('auth_sessions')
        .select('wallets!inner(user_id)')
        .eq('session_token', sessionToken)
        .gt('expires_at', new Date().toISOString())
        .single();
      const w = session?.wallets as { user_id: string } | undefined;
      if (w?.user_id) userId = w.user_id;
    }
  }

  return userId;
}

/**
 * Resolve authenticated user from request, then verify profiles.is_admin; return 401/403 or { userId }.
 */
export async function requireAdmin(request: NextRequest): Promise<RequireAdminResult> {
  const userId = await getAuthUserId(request);
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('user_id', userId)
    .single();

  if (!profile?.is_admin) {
    console.log('[requireAdmin] User is not admin:', userId, 'is_admin:', profile?.is_admin);
    return NextResponse.json({ error: 'Forbidden: admin only' }, { status: 403 });
  }

  return { userId };
}
