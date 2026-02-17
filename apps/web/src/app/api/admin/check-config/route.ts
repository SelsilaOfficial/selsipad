import { createClient } from '@supabase/supabase-js';

// Public diagnostic endpoint - no auth required
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(supabaseUrl, supabaseServiceKey);

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Check all users with admin status
    const { data: admins, error: adminError } = await supabase
      .from('profiles')
      .select('user_id, is_admin, created_at')
      .eq('is_admin', true);

    if (adminError) {
      return Response.json(
        { error: 'Database query failed', details: adminError },
        { status: 500 }
      );
    }

    if (!admins || admins.length === 0) {
      return Response.json({
        message: 'No admin users found',
        admins: [],
        instructions: [
          '1. Connect your wallet to the app',
          '2. Check your wallet address',
          "3. Run SQL to set admin: UPDATE profiles SET is_admin = true WHERE user_id = (SELECT user_id FROM wallets WHERE address = 'YOUR_WALLET_ADDRESS');",
        ],
      });
    }

    // Get wallets for each admin
    const adminsWithWallets = await Promise.all(
      admins.map(async (admin) => {
        const { data: wallets } = await supabase
          .from('wallets')
          .select('address, chain_type, is_primary')
          .eq('user_id', admin.user_id);

        return {
          ...admin,
          wallets: wallets || [],
        };
      })
    );

    return Response.json({
      message: `Found ${admins.length} admin user(s)`,
      admins: adminsWithWallets,
    });
  } catch (error) {
    console.error('Error checking admin status:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
