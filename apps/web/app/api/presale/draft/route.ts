import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthUserId } from '@/lib/auth/require-admin';

import { TOKEN_FACTORY_ADDRESSES } from '@/lib/web3/token-factory';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const CHAIN_MAP: Record<string, string> = {
  ethereum: '1',
  sepolia: '11155111',
  bsc: '56',
  bnb: '56',
  bsc_testnet: '97',
  base: '8453',
  base_sepolia: '84532',
  polygon: '137',
  avalanche: '43114',
  solana: 'SOLANA',
};

/**
 * Normalise a datetime value to a valid ISO-8601 UTC string.
 * datetime-local inputs arrive as  e.g. "2026-02-11T06:30" (no TZ).
 * new Date() in Node (V8) treats such strings as **local time**, but
 * we must store them as UTC.  If the string already contains a TZ
 * indicator (Z, +, −) we leave it alone.
 */
function normalizeToUTC(value: string | undefined | null, fallback: string): string {
  if (!value) return fallback;
  try {
    // datetime-local inputs arrive without timezone, e.g. "2026-02-11T13:35".
    // The UI labels say "WIB (UTC+7)", so we treat bare strings as WIB.
    // Only skip if the string has an explicit TZ suffix after the time part:
    //   ends with Z, or has +HH:MM / -HH:MM at the end (e.g. "+07:00", "-05:00")
    let toParse = value;
    const hasTZ = /Z$/i.test(value) || /[+-]\d{2}:\d{2}$/.test(value) || /[+-]\d{4}$/.test(value);
    if (!hasTZ) {
      toParse = value + '+07:00'; // Treat as WIB → will be converted to UTC by toISOString()
    }
    const d = new Date(toParse);
    if (isNaN(d.getTime())) return fallback;
    return d.toISOString();
  } catch {
    return fallback;
  }
}

/**
 * POST /api/presale/draft
 * Create presale project + round.
 *
 * When escrowTxHash + creationFeeTxHash are provided (from Step 9 on-chain flow),
 * the round is created with status SUBMITTED.
 * Otherwise, status is DRAFT (for auto-draft during wizard editing).
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getAuthUserId(request);
    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const basics = body.basics || {};
    const sale_params = body.sale_params || {};
    const network = body.network || basics.network || 'bsc_testnet';
    // Chain must be a numeric string to pass the valid_chain constraint
    const chain = body.chain_id?.toString() || CHAIN_MAP[network] || '97';

    // Determine status based on whether on-chain TX hashes are provided
    const hasOnChainProof = !!(body.escrowTxHash && body.creationFeeTxHash);
    const status = hasOnChainProof ? 'SUBMITTED' : 'DRAFT';

    // Determine factory address for this network (for SAFU/SC Pass badges)
    const tokenAddress = body.contract_address || sale_params.token_address || '';
    const factoryAddr = TOKEN_FACTORY_ADDRESSES[network] as string | undefined;
    const hasFactoryToken =
      tokenAddress && factoryAddr && factoryAddr !== '0x0000000000000000000000000000000000000000';

    // Create project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .insert({
        name: basics.name || 'Untitled Presale',
        description: basics.description || '',
        owner_user_id: userId,
        type: 'PRESALE',
        chain_id: parseInt(chain) || 97,
        token_address: tokenAddress,
        factory_address: hasFactoryToken ? factoryAddr : null,
        status,
        kyc_status: 'PENDING',
        sc_scan_status: 'IDLE',
        logo_url: basics.logo_url || null,
        banner_url: basics.banner_url || null,
        website: basics.website_url || null,
        telegram: basics.telegram_url || null,
        twitter: basics.twitter_url || null,
        discord: basics.discord_url || null,
        github: basics.github_url || null,
        symbol: body.token_symbol || null,
        creator_wallet: body.creator_wallet || null,
        metadata: hasFactoryToken ? { security_badges: ['SAFU', 'SC_PASS'] } : {},
      })
      .select('id')
      .single();

    if (projectError || !project) {
      console.error('Presale draft project create:', projectError);
      return NextResponse.json({ error: 'Failed to create project' }, { status: 500 });
    }

    const projectId = project.id;

    const roundData: Record<string, any> = {
      project_id: projectId,
      created_by: userId,
      status,
      chain,
      type: 'PRESALE',
      token_address: body.contract_address || sale_params.token_address || '',
      raise_asset: sale_params.payment_token || 'NATIVE',
      start_at: normalizeToUTC(sale_params.start_at, new Date(Date.now() + 3600000).toISOString()),
      end_at: normalizeToUTC(
        sale_params.end_at,
        new Date(Date.now() + 7 * 24 * 3600000).toISOString()
      ),
      params: {
        price: parseFloat(sale_params.price || '0'),
        softcap: parseFloat(sale_params.softcap || '0'),
        hardcap: parseFloat(sale_params.hardcap || '0'),
        token_for_sale: parseFloat(sale_params.total_tokens || '0'),
        min_contribution: parseFloat(sale_params.min_contribution || '0'),
        max_contribution: parseFloat(sale_params.max_contribution || '0'),
        investor_vesting: body.investor_vesting,
        team_vesting: body.team_vesting,
        lp_lock: body.lp_lock,
        project_name: basics.name,
        project_description: basics.description,
        logo_url: basics.logo_url,
        banner_url: basics.banner_url,
        anti_bot: body.anti_bot,
        fees_referral: body.fees_referral,
      },
    };

    // Add on-chain escrow + fee data if provided (SUBMITTED flow)
    if (hasOnChainProof) {
      roundData.escrow_tx_hash = body.escrowTxHash;
      roundData.creation_fee_tx_hash = body.creationFeeTxHash;
      // creation_fee_paid is numeric(78,0) — store the fee amount in wei, not boolean
      // 0.5 BNB = 500000000000000000 wei
      roundData.creation_fee_paid = body.creation_fee_amount || '500000000000000000';
      if (body.escrow_amount) {
        roundData.escrow_amount = body.escrow_amount;
      }
    }

    const { data: round, error: roundError } = await supabase
      .from('launch_rounds')
      .insert(roundData)
      .select()
      .single();

    if (roundError) {
      console.error('Presale draft round create:', roundError);
      // Try to clean up the project if round fails
      await supabase.from('projects').delete().eq('id', projectId);
      return NextResponse.json(
        { error: 'Failed to create draft round', details: roundError.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { round: { ...round, project_id: projectId }, project_id: projectId },
      { status: 201 }
    );
  } catch (err) {
    console.error('Presale draft error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
