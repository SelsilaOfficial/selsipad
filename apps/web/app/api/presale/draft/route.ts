import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthUserId } from '@/lib/auth/require-admin';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const CHAIN_MAP: Record<string, string> = {
  ethereum: '1',
  bsc: '56',
  polygon: '137',
  avalanche: '43114',
  solana: 'SOLANA',
};

/**
 * POST /api/presale/draft
 * Create presale draft (project + round in DRAFT). Used by wizard.
 * Body: wizard config (basics, sale_params, investor_vesting, team_vesting, lp_lock, anti_bot, fees_referral).
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
    const network = basics.network || 'ethereum';
    const chain = CHAIN_MAP[network] || '1';

    // Create project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .insert({
        name: basics.name || 'Untitled Presale',
        description: basics.description || '',
        owner_user_id: userId,
        kyc_status: 'PENDING',
      })
      .select('id')
      .single();

    if (projectError || !project) {
      console.error('Presale draft project create:', projectError);
      return NextResponse.json({ error: 'Failed to create project' }, { status: 500 });
    }

    const projectId = project.id;

    const draftData = {
      project_id: projectId,
      created_by: userId,
      status: 'DRAFT',
      chain,
      type: 'PRESALE',
      token_address: sale_params.token_address || '',
      raise_asset: sale_params.payment_token || 'NATIVE',
      start_at: sale_params.start_at || new Date(Date.now() + 3600000).toISOString(),
      end_at: sale_params.end_at || new Date(Date.now() + 7 * 24 * 3600000).toISOString(),
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

    const { data: round, error: roundError } = await supabase
      .from('launch_rounds')
      .insert(draftData)
      .select()
      .single();

    if (roundError) {
      console.error('Presale draft round create:', roundError);
      return NextResponse.json({ error: 'Failed to create draft round' }, { status: 500 });
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
