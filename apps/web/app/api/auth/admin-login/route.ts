import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getUserRoles, isAdmin } from '@/lib/admin/rbac';
import { logAdminAction, getClientIP, getUserAgent } from '@/lib/admin/audit-logging';

export async function POST(request: NextRequest) {
  try {
    const { walletAddress } = await request.json();

    if (!walletAddress) {
      return NextResponse.json({ error: 'Wallet address required' }, { status: 400 });
    }

    // Use service role to bypass RLS
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Step 1: Get user_id from wallets table (EVM wallet)
    // Support multiple EVM chain formats:
    // - Legacy: EVM_1 (Ethereum), EVM_56 (BSC), etc.
    // - New: evm-1 (Ethereum), evm-56 (BSC), etc.
    const { data: wallet, error: walletError } = await supabase
      .from('wallets')
      .select('user_id, chain')
      .eq('address', walletAddress.toLowerCase())
      .or('chain.ilike.evm_%,chain.like.evm-%')
      .single();

    if (walletError || !wallet) {
      console.log('[Admin Auth] EVM wallet not found:', walletAddress);
      console.log('[Admin Auth] Error:', walletError);
      return NextResponse.json(
        { error: 'EVM wallet not found. Please connect your wallet to the app first.' },
        { status: 404 }
      );
    }

    const userId = wallet.user_id;

    // Step 2: Check if user has any admin roles
    const roles = await getUserRoles(userId);

    if (roles.length === 0) {
      console.log('[Admin Auth] Access denied - no admin roles:', walletAddress);
      
      // Audit failed login attempt
      await logAdminAction({
        actor_admin_id: userId,
        action: 'ADMIN_LOGIN_FAILED',
        entity_type: 'auth',
        entity_id: userId,
        after_data: { reason: 'no_admin_roles', wallet: walletAddress },
        ip_address: getClientIP(request),
        user_agent: getUserAgent(request),
      });

      return NextResponse.json(
        { error: 'Access denied. Your wallet is not authorized as admin.' },
        { status: 403 }
      );
    }

    // Step 3: Check MFA status (DISABLED for now - MFA setup not implemented)
    // const { data: profile } = await supabase
    //   .from('profiles')
    //   .select('mfa_enabled, mfa_verified_at')
    //   .eq('user_id', userId)
    //   .single();

    // Skip MFA for now - can be enabled later
    const mfaRequired = false;

    console.log('[Admin Auth] Success:', {
      wallet: walletAddress,
      user_id: userId,
      roles: roles,
      chain: wallet.chain,
      mfa_required: mfaRequired,
    });

    // Audit successful login
    await logAdminAction({
      actor_admin_id: userId,
      action: 'ADMIN_LOGIN_SUCCESS',
      entity_type: 'auth',
      entity_id: userId,
      after_data: {
        wallet: walletAddress,
        chain: wallet.chain,
        roles: roles,
        mfa_enabled: false,
      },
      ip_address: getClientIP(request),
      user_agent: getUserAgent(request),
    });

    // Create response with admin session cookie
    const response = NextResponse.json({
      success: true,
      message: 'Admin authentication successful',
      roles: roles,
      mfa_required: mfaRequired,
      redirectTo: '/admin/dashboard',
    });

    // Set admin session cookie (httpOnly for security)
    const sessionData = {
      wallet: walletAddress,
      userId: userId,
      roles: roles,
      chain: wallet.chain,
    };

    response.cookies.set('admin_session', JSON.stringify(sessionData), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/admin',
    });

    return response;
  } catch (error) {
    console.error('[Admin Auth] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
