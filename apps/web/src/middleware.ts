import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for admin login page
  if (pathname === '/admin') {
    return NextResponse.next();
  }

  // Admin route protection (for /admin/dashboard and subpages)
  if (pathname.startsWith('/admin')) {
    // Read admin_session cookie (set by /api/auth/admin-login)
    const adminSessionRaw = request.cookies.get('admin_session')?.value;

    if (!adminSessionRaw) {
      const redirectUrl = new URL('/admin', request.url);
      redirectUrl.searchParams.set('error', 'auth_required');
      return NextResponse.redirect(redirectUrl);
    }

    // Parse session JSON
    let session: { wallet?: string; userId?: string; roles?: string[]; chain?: string };
    try {
      session = JSON.parse(adminSessionRaw);
    } catch {
      // Invalid cookie data — clear and redirect
      const redirectUrl = new URL('/admin', request.url);
      redirectUrl.searchParams.set('error', 'auth_required');
      const response = NextResponse.redirect(redirectUrl);
      response.cookies.delete('admin_session');
      return response;
    }

    const adminWallet = session.wallet;
    const adminUserId = session.userId;

    if (!adminWallet || !adminUserId) {
      const redirectUrl = new URL('/admin', request.url);
      redirectUrl.searchParams.set('error', 'auth_required');
      return NextResponse.redirect(redirectUrl);
    }

    // Verify admin is still valid using service role client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Step 1: Verify wallet exists and get user_id
    const { data: wallet } = await supabase
      .from('wallets')
      .select('user_id')
      .eq('address', adminWallet.toLowerCase())
      .limit(1)
      .maybeSingle();

    if (!wallet) {
      const redirectUrl = new URL('/admin', request.url);
      redirectUrl.searchParams.set('error', 'wallet_not_found');
      return NextResponse.redirect(redirectUrl);
    }

    // Step 2: Verify user is admin via profiles table
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('user_id', wallet.user_id)
      .single();

    // Redirect if not admin
    if (!profile?.is_admin) {
      const redirectUrl = new URL('/admin', request.url);
      redirectUrl.searchParams.set('error', 'admin_access_denied');
      return NextResponse.redirect(redirectUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
