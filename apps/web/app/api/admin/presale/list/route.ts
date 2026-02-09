import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    // Verify admin session
    const cookieStore = await cookies();
    const sessionToken = cookieStore.get('session_token')?.value;

    if (!sessionToken) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Look up session → wallet → profile
    const { data: session } = await supabase
      .from('auth_sessions')
      .select('wallets!inner(user_id)')
      .eq('session_token', sessionToken)
      .gt('expires_at', new Date().toISOString())
      .single();

    const userId = (session?.wallets as any)?.user_id;
    if (!userId) {
      return NextResponse.json({ error: 'Session expired' }, { status: 401 });
    }

    // Check admin status
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('user_id', userId)
      .single();

    if (!profile?.is_admin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Fetch all presale rounds with project info (service-role bypasses RLS)
    const { data: rounds, error: fetchError } = await supabase
      .from('launch_rounds')
      .select(
        `
        *,
        projects (
          id, name, symbol, logo_url, description, creator_wallet, token_address
        )
      `
      )
      .eq('type', 'PRESALE')
      .order('created_at', { ascending: false });

    if (fetchError) {
      console.error('[Admin Presale List] Fetch error:', fetchError);
      return NextResponse.json({ error: fetchError.message }, { status: 500 });
    }

    return NextResponse.json({ rounds: rounds || [] });
  } catch (err: any) {
    console.error('[Admin Presale List] Error:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
