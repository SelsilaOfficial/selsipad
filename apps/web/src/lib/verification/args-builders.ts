/**
 * Constructor Args Builders
 * Build properly formatted constructor arguments for contract verification
 */

export interface FairlaunchConstructorParams {
  projectToken: string;
  paymentToken: string; // address(0) for native
  softcap: string; // in wei
  tokensForSale: string; // in wei
  minContribution: string; // in wei
  maxContribution: string; // in wei
  startTime: number; // unix timestamp
  endTime: number; // unix timestamp
  listingPremiumBps: number;
  feeSplitter: string;
  teamVesting: string; // can be address(0)
  projectOwner: string;
  adminExecutor: string; // factory address
  liquidityPercent: number; // BPS (e.g., 8000 = 80%)
  lpLockMonths: number;
  dexId: string; // bytes32
}

export interface VestingConstructorParams {
  beneficiary: string;
  startTime: number;
  durations: number[]; // array of durations in seconds
  amounts: string[]; // array of amounts in wei
}

export interface TokenConstructorParams {
  name: string;
  symbol: string;
  totalSupply: string; // in wei
  owner: string;
}

/**
 * Build constructor args for Fairlaunch contract
 */
export function buildFairlaunchArgs(params: FairlaunchConstructorParams): any[] {
  return [
    params.projectToken,
    params.paymentToken,
    params.softcap,
    params.tokensForSale,
    params.minContribution,
    params.maxContribution,
    params.startTime,
    params.endTime,
    params.listingPremiumBps,
    params.feeSplitter,
    params.teamVesting,
    params.projectOwner,
    params.adminExecutor,
    params.liquidityPercent,
    params.lpLockMonths,
    params.dexId,
  ];
}

/**
 * Build constructor args for Vesting vault contract
 */
export function buildVestingArgs(params: VestingConstructorParams): any[] {
  return [
    params.beneficiary,
    params.startTime,
    params.durations,
    params.amounts,
  ];
}

/**
 * Build constructor args for ERC20 Token contract
 */
export function buildTokenArgs(params: TokenConstructorParams): any[] {
  return [
    params.name,
    params.symbol,
    params.totalSupply,
    params.owner,
  ];
}

/**
 * Helper to convert database params to FairlaunchConstructorParams
 */
export function buildFairlaunchArgsFromDB(data: {
  projectToken: string;
  softcap: string;
  tokensForSale: string;
  minContribution: string;
  maxContribution: string;
  startTime: Date;
  endTime: Date;
  listingPremiumBps?: number;
  feeSplitter: string;
  vestingVault: string;
  projectOwner: string;
  factoryAddress: string;
  liquidityPercent: number;
  lpLockMonths: number;
  dexId: string;
}): any[] {
  return buildFairlaunchArgs({
    projectToken: data.projectToken,
    paymentToken: '0x0000000000000000000000000000000000000000', // Native BNB default
    softcap: data.softcap,
    tokensForSale: data.tokensForSale,
    minContribution: data.minContribution,
    maxContribution: data.maxContribution,
    startTime: Math.floor(new Date(data.startTime).getTime() / 1000),
    endTime: Math.floor(new Date(data.endTime).getTime() / 1000),
    listingPremiumBps: data.listingPremiumBps || 0,
    feeSplitter: data.feeSplitter,
    teamVesting: data.vestingVault,
    projectOwner: data.projectOwner,
    adminExecutor: data.factoryAddress,
    liquidityPercent: data.liquidityPercent,
    lpLockMonths: data.lpLockMonths,
    dexId: data.dexId,
  });
}

/**
 * Helper to convert database params to VestingConstructorParams
 */
export function buildVestingArgsFromDB(data: {
  beneficiary: string;
  startTime: Date;
  durations: number[];
  amounts: string[];
}): any[] {
  return buildVestingArgs({
    beneficiary: data.beneficiary,
    startTime: Math.floor(new Date(data.startTime).getTime() / 1000),
    durations: data.durations,
    amounts: data.amounts,
  });
}
