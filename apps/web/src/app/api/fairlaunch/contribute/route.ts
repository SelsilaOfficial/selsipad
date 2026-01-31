/**
 * POST /api/fairlaunch/contribute
 * 
 * Records a Fairlaunch contribution in the database
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { fairlaunchAddress, contributorAddress, amount, txHash } = body;

    // Validate required fields
    if (!fairlaunchAddress || !contributorAddress || !amount || !txHash) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const supabase = await createClient();

    // Get launch_round ID from contract address
    const { data: launchRound, error: roundError } = await supabase
      .from('launch_rounds')
      .select('id')
      .eq('contract_address', fairlaunchAddress.toLowerCase())
      .single();

    if (roundError || !launchRound) {
      console.error('Launch round not found for contract:', fairlaunchAddress);
      return NextResponse.json({ error: 'Launch round not found' }, { status: 404 });
    }

    // Insert contribution record
    const { data, error } = await supabase.from('contributions').insert({
      launch_round_id: launchRound.id,
      contributor_wallet: contributorAddress.toLowerCase(),
      amount_contributed: amount,
      transaction_hash: txHash.toLowerCase(),
      contributed_at: new Date().toISOString(),
    });

    if (error) {
      console.error('Error inserting contribution:', error);
      return NextResponse.json({ error: 'Failed to record contribution' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Unexpected error in /api/fairlaunch/contribute:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
