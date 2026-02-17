import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

// GET /api/presale/[id]/contract-address
// Returns the round contract address for a presale
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createClient();

    // Fetch presale contract address from DB
    const { data: presale, error } = await supabase
      .from('launch_rounds')
      .select('round_address, vesting_vault_address, chain_id')
      .eq('id', params.id)
      .single();

    if (error || !presale) {
      return NextResponse.json({ error: 'Presale not found' }, { status: 404 });
    }

    if (!presale.round_address) {
      return NextResponse.json({ error: 'Presale contract not deployed yet' }, { status: 400 });
    }

    return NextResponse.json({
      roundAddress: presale.round_address,
      vestingVaultAddress: presale.vesting_vault_address,
      chainId: presale.chain_id || 97,
    });
  } catch (error: any) {
    console.error('Error fetching contract address:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
