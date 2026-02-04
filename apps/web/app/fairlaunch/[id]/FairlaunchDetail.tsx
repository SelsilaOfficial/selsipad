'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useWalletClient, usePublicClient } from 'wagmi';
import { ArrowLeft, ExternalLink, Globe, Twitter, Send, MessageCircle, Shield, CheckCircle, Copy, Clock, TrendingUp, Lock, Users, AlertCircle, Loader2, DollarSign } from 'lucide-react';
import { NetworkBadge } from '@/components/presale/NetworkBadge';
import { StatusPill } from '@/components/presale/StatusPill';

import { useRouter } from 'next/navigation';
import { Countdown } from '@/components/ui/Countdown';
import { ethers } from 'ethers';

interface Fairlaunch {
  id: string;
  status: string;
  chain: string; // Used to be network
  chain_id: number;
  params: any;
  start_at: string;
  end_at: string;
  total_raised: number;
  total_participants: number;
  created_by: string;
  // Added fields
  contract_address?: string;
  deployment_status?: string;
  vesting_vault_address?: string;
  project?: {
    id: string;
    name: string;
    symbol: string;
    description: string;
    logo_url: string;
    token_address: string;
    token_decimals: number;
    token_total_supply: number;
    chain_id?: number;
    website_url: string;
    twitter_url: string;
    telegram_url: string;
    discord_url: string;
    metadata?: any;
  };
}

interface FairlaunchDetailProps {
  fairlaunch: Fairlaunch;
  userAddress?: string;
}

// Helper to get display network name from chain ID or network name
function getNetworkDisplay(chain?: string, chainId?: string | number): string {
  // Map standard chain keys to display names
  const keyMap: Record<string, string> = {
    'bsc_testnet': 'BSC Testnet',
    'sepolia': 'Sepolia',
    'base_sepolia': 'Base Sepolia',
    'ethereum': 'Ethereum',
    'bnb': 'BNB Chain',
    'base': 'Base',
    '97': 'BSC Testnet',
    '56': 'BNB Chain',
    '11155111': 'Sepolia',
    '1': 'Ethereum',
    '8453': 'Base',
    '84532': 'Base Sepolia',
  };

  if (chain && keyMap[chain]) return keyMap[chain];
  if (chainId) {
    const mapped = keyMap[chainId.toString()];
    if (mapped) return mapped;
  }
  
  return chain || 'Unknown Network';
}

// Helper to get native currency symbol
function getNativeCurrency(chain?: string, chainId?: string | number): string {
  const c = chain?.toLowerCase() || '';
  const cid = chainId?.toString() || '';
  
  // Debug logging
  console.log('getNativeCurrency debug:', { chain, chainId, c, cid });
  
  // IMPORTANT: Sometimes chain_id is stored in 'chain' field instead of 'chainId'
  // Check if 'chain' is a number (like '97', '56', etc.)
  const isChainNumeric = /^\d+$/.test(c);
  const effectiveChainId = isChainNumeric ? c : cid;
  
  console.log('Effective chain ID:', effectiveChainId);
  
  // Check chain_id first (most reliable)
  if (effectiveChainId === '97' || effectiveChainId === '56') {
    console.log('Detected BNB chain by ID:', effectiveChainId);
    return 'BNB';
  }
  
  // Then check chain string (only if not numeric)
  if (!isChainNumeric && (c.includes('bsc') || c.includes('bnb'))) {
    console.log('Detected BNB chain by name:', c);
    return 'BNB';
  }
  
  // Base network
  if (effectiveChainId === '8453' || effectiveChainId === '84532' || c.includes('base')) {
    console.log('Detected Base chain');
    return 'ETH';
  }
  
  // Ethereum networks
  if (effectiveChainId === '1' || effectiveChainId === '11155111' || c.includes('eth') || c.includes('sepolia')) {
    console.log('Detected Ethereum chain');
    return 'ETH';
  }
  
  console.warn('Unknown network, defaulting to ETH. chain:', c, 'chainId:', cid, 'effectiveChainId:', effectiveChainId);
  return 'ETH'; // Default
}

type TabType = 'overview' | 'contribute' | 'claim' | 'refund' | 'transactions';

export function FairlaunchDetail({ fairlaunch, userAddress }: FairlaunchDetailProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<TabType>('overview');


  // Consolidate data access with robust fallbacks
  // Network logic: prefer explicit chain_id, fall back to chain string
  const chainId = fairlaunch.chain_id || fairlaunch.project?.chain_id || fairlaunch.params?.chain_id;
  const chainKey = fairlaunch.chain || '';
  
  // Debug logging for network detection
  console.log('Fairlaunch network debug:', {
    fairlaunch_chain_id: fairlaunch.chain_id,
    fairlaunch_chain: fairlaunch.chain,
    project_chain_id: fairlaunch.project?.chain_id,
    params_chain_id: fairlaunch.params?.chain_id,
    resolved_chainId: chainId,
    resolved_chainKey: chainKey
  });
  
  const networkName = getNetworkDisplay(chainKey, chainId);
  const nativeCurrency = getNativeCurrency(chainKey, chainId);
  
  // Token Data
  const tokenDecimals = parseInt(
    fairlaunch.project?.metadata?.token_decimals || 
    fairlaunch.project?.token_decimals || 
    fairlaunch.params?.token_decimals || 
    '18'
  );

  const tokensForSale = parseFloat(fairlaunch.params?.tokens_for_sale || '0');
  const liquidityTokens = parseFloat(fairlaunch.params?.liquidity_tokens || '0');
  const teamTokens = parseFloat(
    fairlaunch.params?.team_vesting_tokens || 
    fairlaunch.params?.team_allocation || 
    '0'
  );

  // Calculate Total Supply if not provided
  let tokenSupply = parseFloat(
    fairlaunch.project?.metadata?.token_total_supply || 
    fairlaunch.project?.token_total_supply || 
    fairlaunch.params?.token_total_supply || 
    '0'
  );

  // Fallback calculation: if supply is 0 but we have component parts, sum them up
  // This is a heuristic: Sale + Liquidity + Team is usually the bulk of it.
  if (tokenSupply === 0 && tokensForSale > 0) {
      // If we can't get exact, we assume these components make up the supply or at least display them
      // But usually Total Supply >= Sale + Liquidity + Team
      tokenSupply = tokensForSale + liquidityTokens + teamTokens;
  }

  // State calculations
  // Priority: Project Table > Launch Params > Defaults
  const projectName = fairlaunch.project?.name || fairlaunch.params?.project_name || 'Unnamed Project';
  const projectSymbol = fairlaunch.project?.symbol || fairlaunch.params?.token_symbol || 'TBD';
  const projectDesc = fairlaunch.project?.description || fairlaunch.params?.project_description || 'No description';
  const projectLogo = fairlaunch.project?.logo_url || fairlaunch.params?.logo_url;
  
  const softcap = parseFloat(fairlaunch.params?.softcap || '0');
  const raised = fairlaunch.total_raised || 0;
  
  const finalPrice = tokensForSale > 0 ? raised / tokensForSale : 0;
  const progress = softcap > 0 ? (raised / softcap) * 100 : 0;

  // Tokenomics Percentages
  // Use 1 as fallback denominator to prevent division by zero/NaN
  const calculationSupply = tokenSupply > 0 ? tokenSupply : 1;
  const presalePercent = (tokensForSale / calculationSupply) * 100;
  const teamPercent = (teamTokens / calculationSupply) * 100;
  // Ensure we don't show negative unlocked if data is bad
  const unlockedPercent = Math.max(0, 100 - presalePercent - teamPercent);

  // Calculate time-based status
  const timeStatus = getTimeStatus(fairlaunch.start_at, fairlaunch.end_at);
  const isLive = timeStatus === 'live';
  const isEnded = timeStatus === 'ended';
  const isFinalized = fairlaunch.status === 'FINALIZED_SUCCESS' || fairlaunch.status === 'FINALIZED_FAIL';

  const tabs: { key: TabType; label: string; enabled: boolean; hasIndicator?: boolean }[] = [
    { key: 'overview', label: 'Overview', enabled: true },
    { 
      key: 'contribute', 
      label: 'Contribute', 
      // Enable if time-based status is 'live' OR database status is 'LIVE'
      enabled: isLive || fairlaunch.status === 'LIVE',
      hasIndicator: isLive || fairlaunch.status === 'LIVE'
    },
    { 
      key: 'claim', 
      label: 'Claim', 
      // Enable if ended AND softcap reached, OR status is ENDED/SUCCESS
      enabled: (isEnded && raised >= softcap) || fairlaunch.status === 'ENDED' || fairlaunch.status === 'SUCCESS',
      hasIndicator: (isEnded && raised >= softcap) || fairlaunch.status === 'ENDED'
    },
    {
      key: 'refund',
      label: 'Refund',
      // Enable if ended below softcap OR finalized as fail/refunding
      enabled: (isEnded && raised < softcap) || fairlaunch.status === 'FINALIZED_FAIL' || fairlaunch.status === 'FAILED' || fairlaunch.status === 'REFUNDING',
      hasIndicator: (isEnded && raised < softcap) || fairlaunch.status === 'FAILED'
    },
    { key: 'transactions', label: 'Transactions', enabled: !!userAddress },
  ];

  // Helper for funding check


  // Helper for explorer URL
  const getExplorerUrl = (id: string) => {
    // Simplified map
    if (id === '97' || id.includes('bsc')) return 'https://testnet.bscscan.com';
    if (id === '8453' || id.includes('base')) return 'https://basescan.org';
    return '#';
  };



  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Link href="/fairlaunch/list" className="inline-flex items-center text-gray-400 hover:text-white mb-6">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Back to Fairlaunch List
      </Link>




      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-start gap-4">
            {projectLogo && (
              <img
                src={projectLogo}
                alt={projectName}
                className="w-16 h-16 rounded-lg object-cover"
              />
            )}
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">{projectName}</h1>
              <p className="text-gray-400 mb-3">
                {projectDesc}
              </p>
              <div className="flex items-center gap-3 flex-wrap">
                {/* Security Badges */}
                {fairlaunch.params?.token_source === 'factory' && fairlaunch.params?.security_badges?.length > 0 && (
                  <>
                    {fairlaunch.params.security_badges.includes('SAFU') && (
                      <span className="px-3 py-1 bg-yellow-500/10 border border-yellow-500/30 rounded-full text-xs font-medium text-yellow-400 flex items-center gap-1">
                        <Shield className="w-3 h-3" />
                        SAFU
                      </span>
                    )}
                    {fairlaunch.params.security_badges.includes('SC_PASS') && (
                      <span className="px-3 py-1 bg-green-500/10 border border-green-500/30 rounded-full text-xs font-medium text-green-400 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" />
                        SC Pass
                      </span>
                    )}
                  </>
                )}

                {projectSymbol && (
                  <span className="text-sm text-gray-500">
                    Token:{' '}
                    <span className="text-white font-semibold">
                      {projectSymbol}
                    </span>
                  </span>
                )}
              </div>
              
              {/* Social Media Links from Project Table or Params */}
              <div className="flex items-center gap-2 mt-3">
                  {(fairlaunch.project?.website_url || fairlaunch.params?.social_links?.website) && (
                    <a
                      href={fairlaunch.project?.website_url || fairlaunch.params?.social_links?.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
                      title="Website"
                    >
                      <Globe className="w-4 h-4 text-gray-400" />
                    </a>
                  )}
                  {(fairlaunch.project?.twitter_url || fairlaunch.params?.social_links?.twitter) && (
                    <a
                      href={fairlaunch.project?.twitter_url || fairlaunch.params?.social_links?.twitter}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
                      title="Twitter"
                    >
                      <Twitter className="w-4 h-4 text-gray-400" />
                    </a>
                  )}
                  {(fairlaunch.project?.telegram_url || fairlaunch.params?.social_links?.telegram) && (
                    <a
                      href={fairlaunch.project?.telegram_url || fairlaunch.params?.social_links?.telegram}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
                      title="Telegram"
                    >
                      <Send className="w-4 h-4 text-gray-400" />
                    </a>
                  )}
                  {(fairlaunch.project?.discord_url || fairlaunch.params?.social_links?.discord) && (
                    <a
                      href={fairlaunch.project?.discord_url || fairlaunch.params?.social_links?.discord}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
                      title="Discord"
                    >
                      <MessageCircle className="w-4 h-4 text-gray-400" />
                    </a>
                  )}
              </div>
            </div>
          </div>
        </div>

        {/* Timeline Section */}
        <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 mb-4">
          {/* Current Status */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-400 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Status
            </span>
            {(() => {
              const status = getTimeStatus(fairlaunch.start_at, fairlaunch.end_at);
              const colors = {
                upcoming: 'bg-blue-500/10 border-blue-500/30 text-blue-400',
                live: 'bg-green-500/10 border-green-500/30 text-green-400',
                ended: 'bg-gray-500/10 border-gray-500/30 text-gray-400',
              };
              return (
                <span className={`px-3 py-1 rounded-full text-xs font-semibold border uppercase ${colors[status]}`}>
                  {status === 'live' ? '🟢 Live' : status === 'upcoming' ? '⏰ Upcoming' : '⏹️ Ended'}
                </span>
              );
            })()}
          </div>

          {/* Timeline Bar */}
          <div className="relative h-2 bg-gray-700 rounded-full mb-3">
            <div
              className="absolute h-full bg-green-500 rounded-full transition-all"
              style={{ width: `${calculateTimeProgress(fairlaunch.start_at, fairlaunch.end_at)}%` }}
            />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-4 text-sm mb-3">
            <div>
              <div className="text-gray-400">Start</div>
              <div className="text-white font-medium" suppressHydrationWarning>
                {new Date(fairlaunch.start_at).toLocaleString()}
              </div>
            </div>
            <div className="text-right">
              <div className="text-gray-400">End</div>
              <div className="text-white font-medium" suppressHydrationWarning>
                {new Date(fairlaunch.end_at).toLocaleString()}
              </div>
            </div>
          </div>

          {/* Countdown */}
          {getTimeStatus(fairlaunch.start_at, fairlaunch.end_at) === 'live' && (
            <div className="mt-3 text-center bg-green-500/5 border border-green-500/20 rounded-lg py-2">
              <div className="text-gray-400 text-xs mb-1">Time Remaining</div>
              <div className="text-xl font-bold text-green-400">
                <Countdown targetDate={fairlaunch.end_at} />
              </div>
              <div className="text-gray-500 text-[10px] mt-1" suppressHydrationWarning>
                {Intl.DateTimeFormat().resolvedOptions().timeZone}
              </div>
            </div>
          )}
          {getTimeStatus(fairlaunch.start_at, fairlaunch.end_at) === 'upcoming' && (
            <div className="mt-3 text-center bg-blue-500/5 border border-blue-500/20 rounded-lg py-2">
              <div className="text-gray-400 text-xs mb-1">Starts In</div>
              <div className="text-xl font-bold text-blue-400">
                <Countdown targetDate={fairlaunch.start_at} />
              </div>
              <div className="text-gray-500 text-[10px] mt-1" suppressHydrationWarning>
                {Intl.DateTimeFormat().resolvedOptions().timeZone}
              </div>
            </div>
          )}
        </div>

        {/* Progress Bar */}
        <div>
          <div className="flex justify-between text-sm mb-2">
            <span className="text-gray-400">Progress</span>
            <span className="text-white font-semibold">{progress.toFixed(1)}%</span>
          </div>
          <div className="w-full h-3 bg-gray-800 rounded-full overflow-hidden mb-2">
            <div
              className="h-full bg-gradient-to-r from-green-600 to-emerald-600 transition-all"
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
          <div className="flex justify-between text-sm">
            <div>
              <span className="text-gray-500">Raised: </span>
              <span className="text-white font-semibold">{raised.toLocaleString()}</span>
            </div>
            <div>
              <span className="text-gray-500">Softcap: </span>
              <span className="text-white font-semibold">{softcap.toLocaleString()}</span>
            </div>
            <div>
              <span className="text-gray-500">Participants: </span>
              <span className="text-white font-semibold">{fairlaunch.total_participants || 0}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 border-b border-gray-800">
        <div className="flex gap-4 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => tab.enabled && setActiveTab(tab.key)}
              disabled={!tab.enabled}
              className={`pb-3 px-1 font-medium transition-colors whitespace-nowrap relative ${
                activeTab === tab.key
                  ? 'text-green-400 border-b-2 border-green-400'
                  : tab.enabled
                    ? 'text-gray-500 hover:text-gray-300'
                    : 'text-gray-600 cursor-not-allowed'
              }`}
            >
              {tab.label}
              {tab.hasIndicator && activeTab !== tab.key && (
                <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-6">
        {activeTab === 'overview' && (
          <OverviewTab 
             fairlaunch={fairlaunch} 
             finalPrice={finalPrice}
             projectSymbol={projectSymbol}
             tokenSupply={tokenSupply}
             tokenDecimals={tokenDecimals}
             networkName={networkName}
             nativeCurrency={nativeCurrency}
             tokensForSale={tokensForSale}
             softcap={softcap}
             presalePercent={presalePercent}
             teamPercent={teamPercent}
             unlockedPercent={unlockedPercent}
             teamTokens={teamTokens}
          />
        )}
        {activeTab === 'contribute' && <ContributeTab userAddress={userAddress} fairlaunch={fairlaunch} />}
        {activeTab === 'claim' && <ClaimTab fairlaunch={fairlaunch} userAddress={userAddress} />}
        {activeTab === 'refund' && <RefundTab userAddress={userAddress} fairlaunch={fairlaunch} />}
        {activeTab === 'transactions' && <TransactionsTab roundId={fairlaunch.id} chain={fairlaunch.chain} />}
      </div>
    </div>
  );
}

// Updated OverviewTab to accept prepared props
function OverviewTab({ 
  fairlaunch, 
  finalPrice,
  projectSymbol,
  tokenSupply,
  tokenDecimals,
  networkName,
  nativeCurrency,
  tokensForSale,
  softcap,
  presalePercent,
  teamPercent,
  unlockedPercent,
  teamTokens
}: { 
  fairlaunch: Fairlaunch; 
  finalPrice: number;
  projectSymbol: string;
  tokenSupply: number;
  tokenDecimals: number;
  networkName: string;
  nativeCurrency: string;
  tokensForSale: number;
  softcap: number;
  presalePercent: number;
  teamPercent: number;
  unlockedPercent: number;
  teamTokens: number;
}) {

  return (
    <div className="space-y-6">
      {/* Fairlaunch Rules */}
      <div className="bg-gradient-to-r from-green-500/10 to-emerald-500/10 border border-green-500/30 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-white mb-4">🚀 Fairlaunch Mechanics</h3>
        <div className="space-y-3 text-sm">
          <div className="flex items-start gap-3">
            <span className="text-green-400 font-bold">•</span>
            <div>
              <p className="text-white font-medium">No Hardcap</p>
              <p className="text-gray-400">All contributions accepted until sale ends</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-green-400 font-bold">•</span>
            <div>
              <p className="text-white font-medium">Final Price Formula</p>
              <p className="text-gray-400 font-mono">
                Price = Total Raised / {tokensForSale.toLocaleString()} tokens
              </p>
              {finalPrice > 0 && (
                <p className="text-emerald-400 mt-1">Current: {finalPrice.toFixed(6)} per token</p>
              )}
            </div>
          </div>
          <div className="flex items-start gap-3">
            <span className="text-green-400 font-bold">•</span>
            <div>
              <p className="text-white font-medium">Refund Condition</p>
              <p className="text-gray-400">
                If total raised {'<'} softcap → all participants get refunds
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Token Information */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-3">🪙 Token Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-gray-800 rounded-lg">
            <div className="text-sm text-gray-400 mb-1">Token Name</div>
            <div className="text-white font-medium">{fairlaunch.project?.name || fairlaunch.params?.token_name || 'N/A'}</div>
          </div>
          <div className="p-4 bg-gray-800 rounded-lg">
            <div className="text-sm text-gray-400 mb-1">Symbol</div>
            <div className="text-white font-medium">{projectSymbol}</div>
          </div>
          <div className="p-4 bg-gray-800 rounded-lg col-span-full">
            <div className="text-sm text-gray-400 mb-1">Contract Address</div>
            <div className="flex items-center gap-2">
              <code className="text-white font-mono text-sm">{fairlaunch.project?.token_address || fairlaunch.params?.token_address || 'N/A'}</code>
              {(fairlaunch.project?.token_address || fairlaunch.params?.token_address) && (
                <button
                  onClick={() => navigator.clipboard.writeText(fairlaunch.project?.token_address || fairlaunch.params.token_address)}
                  className="p-1 hover:bg-gray-700 rounded transition-colors"
                  title="Copy address"
                >
                  <Copy className="w-4 h-4 text-gray-400" />
                </button>
              )}
            </div>
          </div>
          <div className="p-4 bg-gray-800 rounded-lg col-span-full">
            <div className="text-sm text-gray-400 mb-1">Pool Contract Address</div>
            <div className="flex items-center gap-2">
              <code className="text-white font-mono text-sm">{fairlaunch.contract_address || fairlaunch.params?.contract_address || 'Not deployed yet'}</code>
              {(fairlaunch.contract_address || fairlaunch.params?.contract_address) && (
                <>
                  <button
                    onClick={() => navigator.clipboard.writeText(fairlaunch.contract_address || fairlaunch.params.contract_address)}
                    className="p-1 hover:bg-gray-700 rounded transition-colors"
                    title="Copy address"
                  >
                    <Copy className="w-4 h-4 text-gray-400" />
                  </button>
                  <a
                    href={`${getExplorerUrl(String(fairlaunch.chain_id || fairlaunch.chain))}/address/${fairlaunch.contract_address || fairlaunch.params?.contract_address}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1 hover:bg-gray-700 rounded transition-colors"
                    title="View on explorer"
                  >
                    <ExternalLink className="w-4 h-4 text-gray-400" />
                  </a>
                </>
              )}
            </div>
          </div>
          <div className="p-4 bg-gray-800 rounded-lg col-span-full">
            <div className="text-sm text-gray-400 mb-1">Vesting Vault Address</div>
            <div className="flex items-center gap-2">
              <code className="text-white font-mono text-sm">{fairlaunch.vesting_vault_address || 'Not deployed yet'}</code>
              {fairlaunch.vesting_vault_address && (
                <>
                  <button
                    onClick={() => navigator.clipboard.writeText(fairlaunch.vesting_vault_address || '')}
                    className="p-1 hover:bg-gray-700 rounded transition-colors"
                    title="Copy address"
                  >
                    <Copy className="w-4 h-4 text-gray-400" />
                  </button>
                  <a
                    href={`${getExplorerUrl(String(fairlaunch.chain_id || fairlaunch.chain))}/address/${fairlaunch.vesting_vault_address || ''}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1 hover:bg-gray-700 rounded transition-colors"
                    title="View on explorer"
                  >
                    <ExternalLink className="w-4 h-4 text-gray-400" />
                  </a>
                </>
              )}
            </div>
          </div>
          <div className="p-4 bg-gray-800 rounded-lg">
            <div className="text-sm text-gray-400 mb-1">Decimals</div>
            <div className="text-white font-medium">{tokenDecimals}</div>
          </div>
          <div className="p-4 bg-gray-800 rounded-lg">
            <div className="text-sm text-gray-400 mb-1">Total Supply</div>
            <div className="text-white font-medium">{tokenSupply.toLocaleString()}</div>
          </div>
          <div className="p-4 bg-gray-800 rounded-lg">
            <div className="text-sm text-gray-400 mb-1">Network</div>
            <div className="flex items-center gap-2">
                <NetworkBadge chainId={fairlaunch.chain_id?.toString() || ''} network={fairlaunch.chain || ''} />
               <span className="text-white font-medium">{networkName}</span>
            </div>
          </div>
          <div className="p-4 bg-gray-800 rounded-lg">
            <div className="text-sm text-gray-400 mb-1">Tokens for Sale</div>
            <div className="text-white font-medium">{tokensForSale.toLocaleString()}</div>
          </div>
        </div>
      </div>

      {/* Sale Parameters */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-3">💰 Sale Parameters</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-gray-800 rounded-lg">
            <div className="text-sm text-gray-400 mb-1">Softcap</div>
            <div className="text-white font-medium">{softcap} {nativeCurrency}</div>
          </div>
          <div className="p-4 bg-gray-800 rounded-lg">
            <div className="text-sm text-gray-400 mb-1">Hardcap</div>
            <div className="text-white font-medium">No Hardcap</div>
          </div>
          <div className="p-4 bg-gray-800 rounded-lg">
            <div className="text-sm text-gray-400 mb-1">Min Contribution</div>
            <div className="text-white font-medium">{fairlaunch.params?.min_contribution || 0} {nativeCurrency}</div>
          </div>
          <div className="p-4 bg-gray-800 rounded-lg">
            <div className="text-sm text-gray-400 mb-1">Max Contribution</div>
            <div className="text-white font-medium">{fairlaunch.params?.max_contribution || 0} {nativeCurrency}</div>
          </div>
          <div className="p-4 bg-gray-800 rounded-lg">
            <div className="text-sm text-gray-400 mb-1">Listing On</div>
            <div className="text-white font-medium capitalize">{fairlaunch.params?.dex_platform || 'PancakeSwap'}</div>
          </div>
        </div>
      </div>

      {/* Tokenomics */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-3">📊 Tokenomics</h3>
        <div className="bg-gray-800 rounded-lg p-6">
          <div className="flex flex-col md:flex-row items-center gap-8">
            {/* Donut Chart */}
            <div className="relative w-48 h-48 flex-shrink-0">
              <svg viewBox="0 0 100 100" className="transform -rotate-90">
                {(() => {
                  const radius = 40;
                  const circumference = 2 * Math.PI * radius;
                  
                  const presaleLength = (presalePercent / 100) * circumference;
                  const teamLength = (teamPercent / 100) * circumference;
                  const unlockedLength = (unlockedPercent / 100) * circumference;
                  
                  let offset = 0;
                  
                  return (
                    <>
                      {/* Presale - Green */}
                      <circle
                        cx="50"
                        cy="50"
                        r={radius}
                        fill="none"
                        stroke="#10b981"
                        strokeWidth="16"
                        strokeDasharray={`${presaleLength} ${circumference}`}
                        strokeDashoffset={-offset}
                        className="transition-all"
                      />
                      {/* Team - Blue */}
                      {teamPercent > 0 && (
                        <circle
                          cx="50"
                          cy="50"
                          r={radius}
                          fill="none"
                          stroke="#3b82f6"
                          strokeWidth="16"
                          strokeDasharray={`${teamLength} ${circumference}`}
                          strokeDashoffset={-(offset + presaleLength)}
                          className="transition-all"
                        />
                      )}
                      {/* Unlocked - Gray */}
                      <circle
                        cx="50"
                        cy="50"
                        r={radius}
                        fill="none"
                        stroke="#4b5563"
                        strokeWidth="16"
                        strokeDasharray={`${unlockedLength} ${circumference}`}
                        strokeDashoffset={-(offset + presaleLength + teamLength)}
                        className="transition-all"
                      />
                    </>
                  );
                })()}
              </svg>
              
              {/* Center text */}
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div className="text-2xl font-bold text-white">
                  {(tokenSupply / 1000000).toFixed(1)}M
                </div>
                <div className="text-xs text-gray-400">Total Supply</div>
              </div>
            </div>

            <div className="flex-1 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-green-500" />
                  <span className="text-gray-400">Presale</span>
                </div>
                <span className="text-white font-medium">
                  {tokensForSale.toLocaleString()} ({presalePercent.toFixed(1)}%)
                </span>
              </div>
              
              {teamPercent > 0 && (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-blue-500" />
                    <span className="text-gray-400">Team Vesting</span>
                  </div>
                  <span className="text-white font-medium">
                    {teamTokens.toLocaleString()} ({teamPercent.toFixed(1)}%)
                  </span>
                </div>
              )}

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-gray-600" />
                  <span className="text-gray-400">Unlocked</span>
                </div>
                <span className="text-white font-medium">
                  {(tokenSupply - tokensForSale - teamTokens).toLocaleString()} ({unlockedPercent.toFixed(1)}%)
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ContributeTab({ userAddress, fairlaunch }: { userAddress?: string; fairlaunch: Fairlaunch }) {
  const [amount, setAmount] = useState('');
  const [isContributing, setIsContributing] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Wagmi hooks
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  
  // Get contract address and network info
  // Try multiple sources for contract address
  const fairlaunchAddress = (
    fairlaunch.contract_address || 
    fairlaunch.params?.round_address || 
    fairlaunch.params?.contract_address
  ) as `0x${string}` | undefined;
  
  console.log('ContributeTab - Contract address debug:', {
    contract_address: fairlaunch.contract_address,
    params_round_address: fairlaunch.params?.round_address,
    params_contract_address: fairlaunch.params?.contract_address,
    resolved_address: fairlaunchAddress,
    deployment_status: fairlaunch.deployment_status
  });
  
  const minContribution = Number(fairlaunch.params?.min_contribution || 0);
  const maxContribution = Number(fairlaunch.params?.max_contribution || 0);
  const nativeCurrency = getNativeCurrency(fairlaunch.chain, String(fairlaunch.params?.chain_id || ''));
  
  const handleContribute = async () => {
    if (!userAddress) {
      setError('Please connect your wallet first');
      return;
    }
    
    if (!walletClient) {
      setError('Wallet not connected');
      return;
    }
    
    if (!publicClient) {
      setError('Network not available');
      return;
    }
    
    if (!fairlaunchAddress) {
      setError('Fairlaunch contract address not found');
      return;
    }
    
    try {
      setIsContributing(true);
      setError('');
      setSuccess('');
      
      const amountNum = parseFloat(amount);
      
      // Validation
      if (isNaN(amountNum) || amountNum <= 0) {
        throw new Error('Please enter a valid amount');
      }
      
      if (amountNum < minContribution) {
        throw new Error(`Minimum contribution is ${minContribution} ${nativeCurrency}`);
      }
      
      if (amountNum > maxContribution) {
        throw new Error(`Maximum contribution is ${maxContribution} ${nativeCurrency}`);
      }
      
      // Import helpers
      const { parseEther } = await import('viem');
      const { FAIRLAUNCH_ABI } = await import('@/contracts/Fairlaunch');
      
      // Convert to wei
      const valueInWei = parseEther(amount);
      
      // Call contribute function using walletClient
      const txHash = await walletClient.writeContract({
        address: fairlaunchAddress,
        abi: FAIRLAUNCH_ABI,
        functionName: 'contribute',
        value: valueInWei,
      });
      
      setSuccess(`Transaction sent! Hash: ${txHash.slice(0, 10)}...`);
      
      // Wait for confirmation using publicClient
      const receipt = await publicClient.waitForTransactionReceipt({
        hash: txHash,
        confirmations: 2,
      });
      
      if (receipt.status === 'reverted') {
        throw new Error('Transaction failed');
      }
      
      // ✅ Save to database and trigger referral tracking
      console.log('[ContributeTab] Saving contribution:', {
        roundId: fairlaunch.id,
        amount: valueInWei.toString(),
        txHash,
        chain: String(fairlaunch.params?.chain_id || fairlaunch.chain || '97'),
      });
      
      const { saveFairlaunchContribution } = await import('@/actions/fairlaunch/save-contribution');
      const saveResult = await saveFairlaunchContribution({
        roundId: fairlaunch.id,
        amount: valueInWei.toString(),
        txHash,
        chain: String(fairlaunch.params?.chain_id || fairlaunch.chain || '97'),
        walletAddress: userAddress, // Pass wallet address from client
      });
      
      console.log('[ContributeTab] Save result:', saveResult);
      
      if (!saveResult.success) {
        console.error('[ContributeTab] Failed to save contribution:', saveResult.error);
        // Alert user but don't fail the whole transaction
        alert(`⚠️ Transaction successful but failed to update database: ${saveResult.error}\n\nPlease contact support with TX: ${txHash}`);
      }
      
      setSuccess(`Contribution successful! You contributed ${amount} ${nativeCurrency}`);
      setAmount('');
      
      // Refresh page after 2 seconds
      setTimeout(() => {
        window.location.reload();
      }, 2000);
      
    } catch (err: any) {
      console.error('Contribution error:', err);
      setError(err.message || 'Failed to contribute');
    } finally {
      setIsContributing(false);
    }
  };
  
  if (!userAddress) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">🔒</div>
        <h3 className="text-xl font-semibold text-white mb-2">Connect Wallet</h3>
        <p className="text-gray-400">
          Connect your wallet to contribute to this Fairlaunch
        </p>
      </div>
    );
  }
  
  
  // Check if sale is active based on time
  const timeStatus = getTimeStatus(fairlaunch.start_at, fairlaunch.end_at);
  const isTimeBasedLive = timeStatus === 'live';
  const isDatabaseLive = fairlaunch.status === 'LIVE';
  const isSaleActive = isTimeBasedLive || isDatabaseLive;
  
  if (!isSaleActive) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">⏸️</div>
        <h3 className="text-xl font-semibold text-white mb-2">Sale Not Active</h3>
        <p className="text-gray-400">
          This Fairlaunch is currently {fairlaunch.status.toLowerCase()}
        </p>
        <p className="text-sm text-gray-500 mt-2">
          Time status: {timeStatus}
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="glass-panel p-8">
        <h3 className="text-2xl font-bold text-white mb-6">Contribute to Fairlaunch</h3>
        
        {/* Contribution Limits */}
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className="bg-white/5 rounded-lg p-4">
            <div className="text-sm text-gray-400 mb-1">Minimum</div>
            <div className="text-lg font-semibold text-white">
              {minContribution} {nativeCurrency}
            </div>
          </div>
          <div className="bg-white/5 rounded-lg p-4">
            <div className="text-sm text-gray-400 mb-1">Maximum</div>
            <div className="text-lg font-semibold text-white">
              {maxContribution} {nativeCurrency}
            </div>
          </div>
        </div>
        
        {/* Amount Input */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Contribution Amount ({nativeCurrency})
          </label>
          <div className="relative">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder={`Min: ${minContribution} ${nativeCurrency}`}
              step="0.01"
              min={minContribution}
              max={maxContribution}
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
              disabled={isContributing}
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 font-medium">
              {nativeCurrency}
            </div>
          </div>
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => setAmount(minContribution.toString())}
              className="px-3 py-1 text-sm bg-white/5 hover:bg-white/10 rounded border border-white/10 text-gray-300"
              disabled={isContributing}
            >
              Min
            </button>
            <button
              onClick={() => setAmount(maxContribution.toString())}
              className="px-3 py-1 text-sm bg-white/5 hover:bg-white/10 rounded border border-white/10 text-gray-300"
              disabled={isContributing}
            >
              Max
            </button>
          </div>
        </div>
        
        {/* Error/Success Messages */}
        {error && (
          <div className="mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}
        
        {success && (
          <div className="mb-4 p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
            <p className="text-green-400 text-sm">{success}</p>
          </div>
        )}
        
        {/* Contribute Button */}
        <button
          onClick={handleContribute}
          disabled={isContributing || !amount || parseFloat(amount) <= 0}
          className="w-full py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-all transform hover:scale-[1.02] disabled:scale-100"
        >
          {isContributing ? (
            <span className="flex items-center justify-center gap-2">
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              {success ? 'Confirming...' : 'Processing...'}
            </span>
          ) : (
            `Contribute ${amount || '0'} ${nativeCurrency}`
          )}
        </button>
        
        {/* Info */}
        <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <p className="text-sm text-blue-300">
            💡 Your contribution will be used to purchase tokens at the sale price. 
            You can claim your tokens after the sale ends successfully.
          </p>
        </div>
      </div>
    </div>
  );
}

function ClaimTab({ fairlaunch, userAddress }: { fairlaunch: Fairlaunch; userAddress?: string }) {
  const [claimInfo, setClaimInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [error, setError] = useState('');
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();

  useEffect(() => {
    loadClaimInfo();
  }, [fairlaunch.id, userAddress]);

  async function loadClaimInfo() {
    if (!userAddress) {
      setLoading(false);
      return;
    }

    try {
      console.log('[ClaimTab] Loading claim info for:', userAddress);
      const { claimFairlaunchTokens } = await import('@/actions/fairlaunch/claim-tokens');
      const result = await claimFairlaunchTokens(fairlaunch.id);
      
      console.log('[ClaimTab] Claim result:', result);
      
      if (result.success) {
        setClaimInfo(result);
      } else {
        console.error('[ClaimTab] Claim error:', result.error);
        setError(result.error || 'Failed to load claim info');
      }
    } catch (err: any) {
      console.error('[ClaimTab] Exception:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleClaim() {
    if (!walletClient || !claimInfo) return;

    setClaiming(true);
    setError('');

    try {
      // Import contract ABI
      const FairlaunchABI = (await import('@/lib/web3/abis/Fairlaunch.json')).default;
      
      // Call claimTokens() on contract
      const hash = await walletClient.writeContract({
        address: claimInfo.contractAddress as `0x${string}`,
        abi: FairlaunchABI.abi || FairlaunchABI,
        functionName: 'claimTokens', // Correct function name from ABI
        args: [],
      });

      console.log('[ClaimTab] Transaction sent:', hash);

      // Wait for confirmation
      const receipt = await publicClient!.waitForTransactionReceipt({ hash });
      console.log('[ClaimTab] Transaction confirmed:', receipt);

      // Mark as claimed in database
      const { markTokensClaimed } = await import('@/actions/fairlaunch/claim-tokens');
      await markTokensClaimed({
        contributionId: claimInfo.contributionId,
        txHash: hash,
      });

      alert(`✅ Claim successful!
      
Tokens claimed: ${parseFloat(claimInfo.claimable).toLocaleString()} ${fairlaunch.project?.symbol || 'tokens'}
Transaction: ${hash}

Check your wallet!`);

      // Reload claim info
      await loadClaimInfo();
    } catch (err: any) {
      console.error('[ClaimTab] Claim error:', err);
      setError(err.message || 'Claim transaction failed');
    } finally {
      setClaiming(false);
    }
  }

  if (!userAddress) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">🔒</div>
        <h3 className="text-xl font-semibold text-white mb-2">Connect Wallet</h3>
        <p className="text-gray-400">Please connect your wallet to claim tokens</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin text-4xl mb-4">⏳</div>
        <p className="text-gray-400">Loading claim info...</p>
      </div>
    );
  }

  if (error && !claimInfo) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">ℹ️</div>
        <h3 className="text-xl font-semibold text-white mb-2">Cannot Claim</h3>
        <p className="text-gray-400">{error}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Claim Info Card */}
      <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-purple-500/20 rounded-xl">
            <CheckCircle className="w-6 h-6 text-purple-400" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">Claim Your Tokens</h3>
            <p className="text-sm text-gray-400">Token distribution is now available</p>
          </div>
        </div>

        {/* Contribution Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-black/20 rounded-xl p-4">
            <div className="text-sm text-gray-400 mb-1">Your Contribution</div>
            <div className="text-2xl font-bold text-white">
              {parseFloat(claimInfo.contribution).toFixed(4)} BNB
            </div>
          </div>

          <div className="bg-black/20 rounded-xl p-4">
            <div className="text-sm text-gray-400 mb-1">Your Share</div>
            <div className="text-2xl font-bold text-purple-400">
              {claimInfo.userShare}%
            </div>
          </div>

          <div className="bg-black/20 rounded-xl p-4">
            <div className="text-sm text-gray-400 mb-1">Claimable Tokens</div>
            <div className="text-2xl font-bold text-green-400">
              {parseFloat(claimInfo.claimable).toLocaleString()}
            </div>
            <div className="text-xs text-gray-500 mt-1">
              {fairlaunch.project?.symbol || 'TOKENS'}
            </div>
          </div>
        </div>

        {/* Claim Button */}
        {error ? (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-4">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        ) : null}

        <button
          onClick={handleClaim}
          disabled={claiming || !walletClient}
          className="w-full px-6 py-4 bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white font-bold rounded-xl transition flex items-center justify-center gap-2"
        >
          {claiming ? (
            <>
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              Claiming...
            </>
          ) : (
            <>
              <CheckCircle className="w-5 h-5" />
              Claim {parseFloat(claimInfo.claimable).toLocaleString()} {fairlaunch.project?.symbol || 'Tokens'}
            </>
          )}
        </button>

        <p className="text-xs text-gray-500 text-center mt-4">
          * Tokens will be sent to your connected wallet
        </p>
      </div>
    </div>
  );
}

function RefundTab({ userAddress, fairlaunch }: { userAddress?: string; fairlaunch: Fairlaunch }) {
  const [refunding, setRefunding] = useState(false);
  const [contribution, setContribution] = useState<number | null>(null);
  const [refunded, setRefunded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch user's contribution
  useEffect(() => {
    async function fetchContribution() {
      if (!userAddress || !fairlaunch.contract_address) return;

      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const contract = new ethers.Contract(
          fairlaunch.contract_address,
          ['function contributions(address) view returns (uint256)'],
          provider
        );

        const amount = await contract.contributions(userAddress);
        setContribution(parseFloat(ethers.formatEther(amount)));
      } catch (err: any) {
        console.error('Error fetching contribution:', err);
      }
    }

    fetchContribution();
  }, [userAddress, fairlaunch.contract_address]);

  const handleRefund = async () => {
    if (!userAddress || !fairlaunch.contract_address) return;

    setRefunding(true);
    setError(null);

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(
        fairlaunch.contract_address,
        ['function refund()'],
        signer
      );

      const tx = await contract.refund();
      console.log('Refund tx:', tx.hash);

      await tx.wait();
      
      setRefunded(true);
      setContribution(0);
      alert('✅ Refund successful! BNB returned to your wallet.');
    } catch (err: any) {
      console.error('Refund error:', err);
      setError(err.message || 'Refund failed');
    } finally {
      setRefunding(false);
    }
  };

  if (!userAddress) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">🔐</div>
        <h3 className="text-xl font-semibold text-white mb-2">Connect Wallet</h3>
        <p className="text-gray-400">Connect your wallet to claim refund</p>
      </div>
    );
  }

  if (contribution === null) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">⏳</div>
        <h3 className="text-xl font-semibold text-white mb-2">Loading...</h3>
        <p className="text-gray-400">Checking your contribution</p>
      </div>
    );
  }

  if (contribution === 0 || refunded) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">✅</div>
        <h3 className="text-xl font-semibold text-white mb-2">
          {refunded ? 'Refund Claimed!' : 'No Contribution Found'}
        </h3>
        <p className="text-gray-400">
          {refunded 
            ? 'Your funds have been returned to your wallet' 
            : 'You did not contribute to this fairlaunch'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Refund Info Card */}
      <div className="bg-gradient-to-br from-orange-500/10 to-red-500/10 border border-orange-500/20 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-orange-500/20 rounded-xl">
            <AlertCircle className="w-6 h-6 text-orange-400" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-white">Claim Your Refund</h3>
            <p className="text-sm text-gray-400">Softcap not reached - Get your funds back</p>
          </div>
        </div>

        <div className="grid gap-4 mb-6">
          <div className="bg-black/20 rounded-xl p-4">
            <p className="text-sm text-gray-400 mb-1">Your Contribution</p>
            <p className="text-2xl font-bold text-white">{contribution.toFixed(4)} BNB</p>
          </div>

          <div className="bg-black/20 rounded-xl p-4">
            <p className="text-sm text-gray-400 mb-1">Status</p>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
              <p className="text-white font-semibold">Refund Available</p>
            </div>
          </div>
        </div>

        <button
          onClick={handleRefund}
          disabled={refunding}
          className="w-full py-4 bg-gradient-to-r from-orange-500 to-red-600 hover:from-orange-600 hover:to-red-700 disabled:from-gray-600 disabled:to-gray-700 text-white font-bold rounded-xl transition flex items-center justify-center gap-2"
        >
          {refunding ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Processing Refund...
            </>
          ) : (
            <>
              <DollarSign className="w-5 h-5" />
              Claim Refund ({contribution.toFixed(4)} BNB)
            </>
          )}
        </button>

        {error && (
          <div className="mt-4 bg-red-500/10 border border-red-500 rounded-lg p-3">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="bg-gray-800/50 rounded-xl p-4">
        <h4 className="font-semibold text-white mb-2">ℹ️ Refund Information</h4>
        <ul className="text-sm text-gray-400 space-y-1">
          <li>• Softcap was not reached - all contributions can be refunded</li>
          <li>• You will receive 100% of your contribution back</li>
          <li>• Gas fees apply for the refund transaction</li>
          <li>• Funds will be sent directly to your wallet</li>
        </ul>
      </div>
    </div>
  );
}

function TransactionsTab({ roundId, chain }: { roundId: string; chain: string }) {
  const [contributions, setContributions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadContributions() {
      console.log('[TransactionsTab] Loading contributions for roundId:', roundId);
      try {
        const { getFairlaunchContributions } = await import('@/actions/fairlaunch/get-contributions');
        const result = await getFairlaunchContributions(roundId);
        console.log('[TransactionsTab] Result:', result);
        if (result.success) {
          setContributions(result.contributions);
        }
      } catch (error) {
        console.error('[TransactionsTab] Error loading contributions:', error);
      }
      setLoading(false);
    }
    loadContributions();
  }, [roundId]);

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">⏳</div>
        <p className="text-gray-400">Loading contributions...</p>
      </div>
    );
  }

  if (contributions.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">📊</div>
        <h3 className="text-xl font-semibold text-white mb-2">No Contributions Yet</h3>
        <p className="text-gray-400">Be the first to contribute!</p>
      </div>
    );
  }

  // Get block explorer URL based on chain
  const getExplorerUrl = (txHash: string) => {
    const explorers: Record<string, string> = {
      '1': 'https://etherscan.io',
      '56': 'https://bscscan.com',
      '97': 'https://testnet.bscscan.com',
      '8453': 'https://basescan.org',
      '84532': 'https://sepolia.basescan.org',
    };
    return `${explorers[chain] || 'https://testnet.bscscan.com'}/tx/${txHash}`;
  };

  // Format wallet address
  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  // Format date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-semibold text-white">
          Contribution History ({contributions.length})
        </h3>
        <p className="text-sm text-gray-400">
          Total: {contributions.reduce((sum, c) => sum + Number(c.amount), 0).toFixed(2)} BNB
        </p>
      </div>

      <div className="space-y-3">
        {contributions.map((contribution, index) => (
          <div
            key={contribution.id}
            className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4 hover:bg-white/10 transition-all"
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-white/40 text-sm">#{contributions.length - index}</span>
                  <code className="text-white font-mono text-sm">
                    {formatAddress(contribution.wallet_address)}
                  </code>
                  <a
                    href={getExplorerUrl(contribution.tx_hash)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-cyan-400 hover:text-cyan-300 text-xs flex items-center gap-1"
                  >
                    View TX ↗
                  </a>
                </div>
                <p className="text-gray-400 text-xs">
                  {formatDate(contribution.created_at)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-bold text-white">
                  {Number(contribution.amount).toFixed(2)}
                </p>
                <p className="text-sm text-gray-400">BNB</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Helper functions for timeline features
function getTimeStatus(start: string, end: string): 'upcoming' | 'live' | 'ended' {
  const now = Date.now();
  const startTime = new Date(start).getTime();
  const endTime = new Date(end).getTime();

  if (now < startTime) return 'upcoming';
  if (now > endTime) return 'ended';
  return 'live';
}

function calculateTimeProgress(start: string, end: string): number {
  const now = Date.now();
  const startTime = new Date(start).getTime();
  const endTime = new Date(end).getTime();
  
  if (now < startTime) return 0;
  if (now > endTime) return 100;
  
  return ((now - startTime) / (endTime - startTime)) * 100;
}
function getDexLogo(platform: string): string {
  const logos: Record<string, string> = {
    pancakeswap: '/dex/pancakeswap.png',
    uniswap: '/dex/uniswap.png',
    sushiswap: '/dex/sushiswap.png',
  };
  return logos[platform.toLowerCase()] || '/dex/default.png';
}

function getExplorerUrl(chainId?: string): string {
  const urls: Record<string, string> = {
    '97': 'https://testnet.bscscan.com',
    '56': 'https://bscscan.com',
    '8453': 'https://basescan.org',
    '84532': 'https://sepolia.basescan.org',
    '11155111': 'https://sepolia.etherscan.io',
    '1': 'https://etherscan.io',
  };
  return urls[chainId || ''] || 'https://bscscan.com';
}

function getDexName(platform: string): string {
  const names: Record<string, string> = {
    pancakeswap: 'PancakeSwap',
    uniswap: 'Uniswap',
    sushiswap: 'SushiSwap',
  };
  return names[platform.toLowerCase()] || platform;
}

