/**
 * GET /api/fairlaunch/deployment/[id]
 * 
 * Get detailed deployment status by launch round ID
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    // Fetch deployment details
    const { data: deployment, error } = await supabase
      .from('launch_rounds')
      .select(`
        id,
        type,
        contract_address,
        chain,
        deployment_status,
        deployment_tx_hash,
        deployment_block_number,
        deployer_address,
        deployed_at,
        verification_status,
        verification_guid,
        verified_at,
        verification_attempts,
        verification_error,
        tokens_funded_at,
        funding_tx_hash,
        created_at,
        params
      `)
      .eq('id', id)
      .single();

    if (error || !deployment) {
      return NextResponse.json(
        { error: 'Deployment not found' },
        { status: 404 }
      );
    }

    // Build timeline
    const timeline = buildDeploymentTimeline(deployment);

    // Get explorer URLs
    const explorerUrls = getExplorerUrls(
      deployment.chain,
      deployment.contract_address,
      deployment.deployment_tx_hash,
      deployment.funding_tx_hash
    );

    return NextResponse.json({
      deployment,
      timeline,
      explorerUrls,
    });
  } catch (error: any) {
    console.error('Deployment detail error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * Build deployment timeline from database record
 */
function buildDeploymentTimeline(deployment: any) {
  const events = [];

  // Created
  if (deployment.created_at) {
    events.push({
      status: 'CREATED',
      timestamp: deployment.created_at,
      label: 'Deployment initiated',
    });
  }

  // Deployed
  if (deployment.deployed_at) {
    events.push({
      status: 'DEPLOYED',
      timestamp: deployment.deployed_at,
      label: 'Contract deployed',
      txHash: deployment.deployment_tx_hash,
      blockNumber: deployment.deployment_block_number,
    });
  }

  // Funded
  if (deployment.tokens_funded_at) {
    events.push({
      status: 'FUNDED',
      timestamp: deployment.tokens_funded_at,
      label: 'Tokens funded',
      txHash: deployment.funding_tx_hash,
    });
  }

  // Verified
  if (deployment.verified_at) {
    events.push({
      status: 'VERIFIED',
      timestamp: deployment.verified_at,
      label: 'Contract verified',
      guid: deployment.verification_guid,
    });
  }

  // Sort by timestamp
  return events.sort((a, b) => 
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );
}

/**
 * Get block explorer URLs for chain
 */
function getExplorerUrls(
  chain: string,
  contractAddress: string | null,
  deploymentTx: string | null,
  fundingTx: string | null
) {
  const chainId = parseInt(chain);
  const baseUrls: Record<number, string> = {
    97: 'https://testnet.bscscan.com',
    56: 'https://bscscan.com',
    11155111: 'https://sepolia.etherscan.io',
    1: 'https://etherscan.io',
    84532: 'https://sepolia.basescan.org',
    8453: 'https://basescan.org',
  };

  const baseUrl = baseUrls[chainId] || '';

  return {
    contract: contractAddress ? `${baseUrl}/address/${contractAddress}#code` : null,
    deploymentTx: deploymentTx ? `${baseUrl}/tx/${deploymentTx}` : null,
    fundingTx: fundingTx ? `${baseUrl}/tx/${fundingTx}` : null,
  };
}
