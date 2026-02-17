/**
 * API: Prepare Finalization
 * POST /api/admin/presale/[id]/prepare-finalize
 *
 * ADMIN ONLY - Server-side merkle generation
 *
 * Flow:
 * 1. Load presale + vesting addresses from DB
 * 2. Load contributions snapshot from DB (NO RPC scanning)
 * 3. Compute token allocations
 * 4. Generate merkle tree (2+ leaves enforced)
 * 5. Persist root + proofs to DB
 * 6. Return proposal payload
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { generateMerkleTree } from '@/lib/server/merkle/generate-tree';
import { parseEther } from 'viem';
import { ethers } from 'ethers';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // 1. Verify admin auth via admin_session cookie (set by /api/auth/admin-login)
    const cookieStore = await cookies();
    const adminSessionRaw = cookieStore.get('admin_session')?.value;

    if (!adminSessionRaw) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let adminSession: { wallet: string; userId: string; roles: string[]; chain: string };
    try {
      adminSession = JSON.parse(adminSessionRaw);
    } catch {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const userId = adminSession.userId;
    if (!userId) {
      return NextResponse.json({ error: 'Session expired' }, { status: 401 });
    }

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('is_admin')
      .eq('user_id', userId)
      .single();

    if (!profile?.is_admin) {
      return NextResponse.json({ error: 'Forbidden - Admin only' }, { status: 403 });
    }

    const supabase = supabaseAdmin;

    // 2. Load presale round data
    const { data: round, error: roundError } = await supabase
      .from('launch_rounds')
      .select('*')
      .eq('id', params.id)
      .single();

    if (roundError || !round) {
      return NextResponse.json({ error: 'Presale not found' }, { status: 404 });
    }

    if (!round.round_address || !round.vesting_vault_address) {
      return NextResponse.json({ error: 'Presale not deployed on-chain' }, { status: 400 });
    }

    // 3. Load contributions — try DB first, fallback to on-chain events
    let contributionList: { wallet_address: string; amount: string }[] = [];

    const { data: dbContributions } = await supabase
      .from('contributions')
      .select('wallet_address, amount')
      .eq('round_id', params.id)
      .gt('amount', 0);

    if (dbContributions && dbContributions.length > 0) {
      contributionList = dbContributions.map((c) => ({
        wallet_address: c.wallet_address,
        amount: String(c.amount),
      }));
      console.log(`[prepare-finalize] Found ${contributionList.length} contributions in DB`);
    } else {
      // Fallback: scan on-chain Contributed events via Alchemy PAYG RPC
      console.log('[prepare-finalize] No DB contributions, scanning on-chain via Alchemy...');

      const { createPublicClient, http: viemHttp, formatEther: fmtEther } = await import('viem');
      const { bscTestnet, bsc } = await import('viem/chains');

      const viemChain = (round.chain_id || 97) === 56 ? bsc : bscTestnet;
      const rpcUrl = process.env.BSC_TESTNET_RPC_URL || 'https://bsc-testnet-rpc.publicnode.com';
      const client = createPublicClient({
        chain: viemChain,
        transport: viemHttp(rpcUrl),
      });

      const contributedEventAbi = [
        {
          type: 'event' as const,
          name: 'Contributed',
          inputs: [
            { name: 'contributor', type: 'address', indexed: true },
            { name: 'amount', type: 'uint256', indexed: false },
            { name: 'referrer', type: 'address', indexed: true },
          ],
        },
      ] as const;

      try {
        // Scan in 2000-block chunks via Alchemy PAYG (supports larger ranges than free)
        const currentBlock = await client.getBlockNumber();
        const CHUNK_SIZE = 2000n;
        const MAX_SCAN_RANGE = 500000n; // ~2 days on BSC testnet
        const startBlock = currentBlock > MAX_SCAN_RANGE ? currentBlock - MAX_SCAN_RANGE : 0n;

        console.log(
          `[prepare-finalize] Scanning blocks ${startBlock} - ${currentBlock} (${Number(currentBlock - startBlock)} blocks in ${CHUNK_SIZE}-block chunks)...`
        );

        const allLogs: any[] = [];
        for (let from = startBlock; from <= currentBlock; from += CHUNK_SIZE) {
          const to = from + CHUNK_SIZE - 1n > currentBlock ? currentBlock : from + CHUNK_SIZE - 1n;
          try {
            const logs = await client.getLogs({
              address: round.round_address as `0x${string}`,
              event: contributedEventAbi[0],
              fromBlock: from,
              toBlock: to,
            });
            if (logs.length > 0) {
              console.log(`[prepare-finalize] Found ${logs.length} events in blocks ${from}-${to}`);
              allLogs.push(...logs);
            }
          } catch (chunkErr: any) {
            // If a chunk fails, log and continue
            console.warn(
              `[prepare-finalize] Chunk ${from}-${to} failed: ${chunkErr.message?.substring(0, 100)}`
            );
          }
        }

        console.log(`[prepare-finalize] Total: ${allLogs.length} Contributed events found`);

        // Aggregate contributions per wallet
        const walletMap = new Map<string, bigint>();
        for (const log of allLogs) {
          const contributor = (log.args as any).contributor as string;
          const amount = (log.args as any).amount as bigint;
          const existing = walletMap.get(contributor.toLowerCase()) || 0n;
          walletMap.set(contributor.toLowerCase(), existing + amount);
        }

        // Convert to contribution list
        for (const [wallet, amountWei] of walletMap) {
          contributionList.push({
            wallet_address: wallet,
            amount: fmtEther(amountWei),
          });
        }

        console.log(`[prepare-finalize] ${contributionList.length} unique contributors`);

        // Sync total_raised to DB
        const onChainTotal = await client.readContract({
          address: round.round_address as `0x${string}`,
          abi: [
            {
              inputs: [],
              name: 'totalRaised',
              outputs: [{ name: '', type: 'uint256' }],
              stateMutability: 'view',
              type: 'function',
            },
          ],
          functionName: 'totalRaised',
        });
        const totalRaisedStr = fmtEther(onChainTotal as bigint);
        await supabase
          .from('launch_rounds')
          .update({ total_raised: totalRaisedStr })
          .eq('id', params.id);
        console.log(`[prepare-finalize] Synced total_raised to DB: ${totalRaisedStr}`);
      } catch (scanError: any) {
        console.error('[prepare-finalize] On-chain scan failed:', scanError);
        return NextResponse.json(
          { error: `Failed to scan on-chain contributions: ${scanError.message}` },
          { status: 500 }
        );
      }
    }

    if (contributionList.length === 0) {
      return NextResponse.json(
        { error: 'No contributions found — neither in DB nor on-chain' },
        { status: 400 }
      );
    }

    const contributions = contributionList;

    // 4. Read token decimals on-chain (FIX 3: don't assume 18 decimals)
    const roundParams = round.params as any;
    const rpcUrl = process.env.BSC_TESTNET_RPC_URL || 'https://bsc-testnet-rpc.publicnode.com';
    const provider = new ethers.JsonRpcProvider(rpcUrl);
    const tokenContract = new ethers.Contract(
      round.token_address,
      ['function decimals() view returns (uint8)'],
      provider
    );
    const tokenDecimals = Number(await (tokenContract as any).decimals());
    const tokenUnit = 10n ** BigInt(tokenDecimals);

    // FIX 3: token_for_sale parsed ONLY via parseUnits(tokenDecimals)
    const tokensForSaleWei = ethers.parseUnits(
      String(roundParams?.token_for_sale || '0'),
      tokenDecimals
    );
    const pricePerToken = roundParams?.price ? parseFloat(roundParams.price) : 0;

    if (tokensForSaleWei === 0n) {
      return NextResponse.json(
        { error: 'token_for_sale is 0 — cannot calculate allocations' },
        { status: 400 }
      );
    }

    if (pricePerToken <= 0) {
      return NextResponse.json(
        { error: 'price_per_token is 0 — cannot calculate allocations' },
        { status: 400 }
      );
    }

    // Fixed price allocation: tokens = contribution * tokenUnit / priceWei
    const priceWei = parseEther(String(pricePerToken));
    const allocations: { address: string; allocation: bigint }[] = contributions.map((c) => {
      const contributionWei = parseEther(String(c.amount));
      const tokenAllocation = (contributionWei * tokenUnit) / priceWei;
      return {
        address: c.wallet_address,
        allocation: tokenAllocation,
      };
    });

    // Read feeBps from on-chain contract EARLY (needed for team calc + LP calc)
    const roundContract = new ethers.Contract(
      round.round_address,
      [
        'function feeConfig() view returns (uint256 totalBps, uint256 treasuryBps, uint256 referralPoolBps, uint256 sbtStakingBps)',
      ],
      provider
    );
    const feeConfig = await (roundContract as any).feeConfig();
    const feeBps = BigInt(feeConfig.totalBps);

    // ─── Team Wallet Allocations ───
    // Include team wallets in the SAME merkle tree as investors.
    // Team tokens use the same vesting schedule.
    const teamWallets: { address: string; share_percent: number }[] =
      roundParams?.team_vesting?.team_wallets || [];

    if (teamWallets.length > 0) {
      // Backend validation: duplicate addresses
      const teamAddrs = teamWallets.map((w: any) => w.address?.toLowerCase()).filter(Boolean);
      if (new Set(teamAddrs).size !== teamAddrs.length) {
        return NextResponse.json({ error: 'Duplicate team wallet addresses' }, { status: 400 });
      }

      // Backend validation: share sum = 100%
      const shareSum = teamWallets.reduce(
        (s: number, w: any) => s + (Number(w.share_percent) || 0),
        0
      );
      if (Math.abs(shareSum - 100) > 0.01) {
        return NextResponse.json(
          { error: `Team wallet shares must total 100% (got ${shareSum}%)` },
          { status: 400 }
        );
      }

      // Backend validation: valid addresses
      for (const tw of teamWallets) {
        if (!/^0x[a-fA-F0-9]{40}$/.test(tw.address)) {
          return NextResponse.json(
            { error: `Invalid team wallet address: ${tw.address}` },
            { status: 400 }
          );
        }
      }

      // Calculate team tokens using shared math lib
      const { calculatePresaleSupply } = await import('@/lib/presale/helpers');
      const hardcapWei = parseEther(
        String(roundParams?.hardcap || roundParams?.sale_params?.hardcap || '0')
      );
      const lpBps = BigInt(Math.round((roundParams?.lp_lock?.percentage || 60) * 100));

      // ─── Smart team_allocation → teamBps conversion ───
      // The wizard Step5 stores team_allocation as percentage (e.g. "36" = 36% = 3600 BPS).
      // However, some entries may have stored it as a token count (e.g. 360000).
      // Detect format and convert accordingly:
      const rawTeamAlloc = parseFloat(roundParams?.team_vesting?.team_allocation || '0');
      const tokenForSale = parseFloat(
        roundParams?.token_for_sale || roundParams?.sale_params?.total_tokens || '0'
      );

      console.log(
        '[prepare-finalize] Raw team_allocation:',
        rawTeamAlloc,
        '| tokenForSale:',
        tokenForSale
      );

      let teamBps: bigint;
      const explicitFormat = roundParams?.team_vesting?.team_allocation_format;

      if (rawTeamAlloc === 0) {
        teamBps = 0n;
      } else if (explicitFormat === 'percentage' || rawTeamAlloc <= 50) {
        // Explicit percentage format OR clearly a percentage (max wizard allows is 50%)
        teamBps = BigInt(Math.round(rawTeamAlloc * 100));
      } else if (rawTeamAlloc < 10000 && rawTeamAlloc > 50) {
        // Could be BPS (e.g. 3600) — use as-is if valid
        teamBps = BigInt(Math.round(rawTeamAlloc));
      } else if (tokenForSale > 0) {
        // Value too large for percentage/BPS — treat as a token count.
        // Derive BPS: teamBps = (teamTokens / (saleTokens + teamTokens)) * 10000
        const totalWithTeam = tokenForSale + rawTeamAlloc;
        const derivedBps = Math.round((rawTeamAlloc / totalWithTeam) * 10000);
        teamBps = derivedBps < 10000 ? BigInt(derivedBps) : 0n;
        console.log('[prepare-finalize] Derived teamBps from token count:', derivedBps);
      } else {
        // Cannot derive — fall back to 0
        console.warn('[prepare-finalize] Cannot derive teamBps from:', rawTeamAlloc, '— using 0');
        teamBps = 0n;
      }
      console.log('[prepare-finalize] Final teamBps:', teamBps.toString());

      const supplyCalc = calculatePresaleSupply({
        hardcapWei: BigInt(hardcapWei.toString()),
        priceWei: BigInt(priceWei.toString()),
        tokenDecimals,
        lpBps,
        feeBps,
        teamBps,
      });

      const totalTeamTokens = supplyCalc.teamTokens;
      console.log('[prepare-finalize] Team tokens calculated:', totalTeamTokens.toString());

      // Distribute team tokens by share percentage
      for (const tw of teamWallets) {
        const shareBps = BigInt(Math.round(tw.share_percent * 100));
        const teamAlloc = (totalTeamTokens * shareBps) / 10000n;

        // Check no overlap with investor addresses
        const existingIdx = allocations.findIndex(
          (a) => a.address.toLowerCase() === tw.address.toLowerCase()
        );
        if (existingIdx >= 0) {
          // Merge: add team tokens to existing investor allocation
          allocations[existingIdx]!.allocation += teamAlloc;
          console.log(
            `[prepare-finalize] Team wallet ${tw.address} is also investor — merged allocation`
          );
        } else {
          allocations.push({
            address: tw.address.toLowerCase(),
            allocation: teamAlloc,
          });
        }
      }
    }

    // LP calculation — use actual contributions sum, not DB total_raised (may be stale)
    const totalRaisedWei = contributions.reduce((sum, c) => sum + parseEther(String(c.amount)), 0n);
    const feeAmount = (totalRaisedWei * feeBps) / 10000n;
    const netAfterFee = totalRaisedWei - feeAmount;
    const lpPercentBps = BigInt((roundParams.lp_lock?.percentage || 60) * 100);
    const lpBnbAmount = (netAfterFee * lpPercentBps) / 10000n;
    const tokensForLP = (lpBnbAmount * tokenUnit) / priceWei;

    // Burn = tokensForSale - sold - LP reserve
    const totalTokensSold = contributions.reduce((sum, c) => {
      const cWei = parseEther(String(c.amount));
      return sum + (cWei * tokenUnit) / priceWei;
    }, 0n);
    const unsoldToBurn =
      tokensForSaleWei > totalTokensSold + tokensForLP
        ? tokensForSaleWei - totalTokensSold - tokensForLP
        : 0n;

    // Slippage (default 5%)
    const slippageBps = BigInt(roundParams.slippage_bps || 500);
    const tokenMinLP = (tokensForLP * (10000n - slippageBps)) / 10000n;
    const bnbMinLP = (lpBnbAmount * (10000n - slippageBps)) / 10000n;

    console.log('[prepare-finalize] tokensForSale:', tokensForSaleWei.toString());
    console.log('[prepare-finalize] totalTokensSold:', totalTokensSold.toString());
    console.log('[prepare-finalize] tokensForLP:', tokensForLP.toString());
    console.log('[prepare-finalize] unsoldToBurn:', unsoldToBurn.toString());
    console.log('[prepare-finalize] feeBps (from contract):', feeBps.toString());

    // 5. Generate merkle tree
    const merkleData = generateMerkleTree(
      allocations,
      round.vesting_vault_address,
      round.chain_id || 97, // BSC Testnet
      round.schedule_salt || '0x0000000000000000000000000000000000000000000000000000000000000000'
    );

    // 6. Persist merkle root + proofs to DB
    // Store in presale_merkle_proofs table
    for (const alloc of allocations) {
      const proof = merkleData.proofsByWallet[alloc.address.toLowerCase()];

      await supabase.from('presale_merkle_proofs').upsert({
        round_id: params.id,
        wallet_address: alloc.address.toLowerCase(),
        allocation: alloc.allocation.toString(),
        proof: proof,
      });
    }

    // Update launch_rounds with merkle root
    await supabase
      .from('launch_rounds')
      .update({
        merkle_root: merkleData.root,
      })
      .eq('id', params.id);

    // 7. Return proposal payload (V2.4: includes LP params)
    return NextResponse.json({
      success: true,
      merkleRoot: merkleData.root,
      totalAllocation: merkleData.totalAllocation.toString(),
      unsoldToBurn: unsoldToBurn.toString(),
      tokensForLP: tokensForLP.toString(),
      tokenMinLP: tokenMinLP.toString(),
      bnbMinLP: bnbMinLP.toString(),
      feeBps: feeBps.toString(),
      allocations: allocations.map((a) => ({
        address: a.address,
        allocation: a.allocation.toString(),
        allocationFormatted: (Number(a.allocation) / Number(tokenUnit)).toFixed(6),
      })),
      snapshotHash: merkleData.snapshotHash,
      target: round.round_address,
      message: 'Merkle tree generated and persisted. Ready for finalization.',
    });
  } catch (error: any) {
    console.error('Prepare finalize error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
