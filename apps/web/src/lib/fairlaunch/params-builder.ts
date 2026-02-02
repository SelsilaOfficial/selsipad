/**
 * Fairlaunch Constructor Parameter Builder
 * 
 * Builds the 16 constructor parameters required for Fairlaunch contract deployment
 */

import { ethers } from 'ethers';
import { DeployerWallet } from '../web3/deployer-wallet';

export interface FairlaunchDeployParams {
  // Token & Sale Parameters
  projectToken: string; // Token contract address
  softcap: string; // In native currency (e.g., "5" for 5 BNB)
  tokensForSale: string; // Token amount (will be scaled by decimals)
  tokenDecimals: number; // Token decimals (usually 18)
  minContribution: string; // Minimum contribution in native currency
  maxContribution: string; // Maximum contribution in native currency
  
  // Timing
  startTime: Date; // When sale starts
  endTime: Date; // When sale ends
  
  // Liquidity Settings
  liquidityPercent: number; // Percentage for liquidity (e.g., 70 = 70%)
  lpLockMonths: number; // LP lock duration in months
  dexPlatform: 'PancakeSwap' | 'Uniswap' | 'SushiSwap' | 'QuickSwap';
  listingPremiumBps?: number; // Optional listing price premium in basis points (default: 0)
  
  // Vesting (optional)
  teamVestingAddress?: string; // Team vesting contract address (optional)
  
  // Creator & Network
  creatorWallet: string; // Project owner address
  chainId: number; // Network chain ID
}

export type FairlaunchConstructorArgs = [
  string,  // _projectToken
  string,  // _paymentToken
  bigint,  // _softcap
  bigint,  // _tokensForSale
  bigint,  // _minContribution
  bigint,  // _maxContribution
  bigint,  // _startTime
  bigint,  // _endTime
  number,  // _listingPremiumBps
  string,  // _feeSplitter
  string,  // _teamVesting
  string,  // _projectOwner
  string,  // _adminExecutor
  bigint,  // _liquidityPercent
  bigint,  // _lpLockMonths
  string   // _dexId
];

export class FairlaunchParamsBuilder {
  /**
   * Build constructor arguments array from deployment parameters
   */
  static buildConstructorArgs(params: FairlaunchDeployParams): FairlaunchConstructorArgs {
    // Get network configuration
    const networkConfig = DeployerWallet.getNetworkConfig(params.chainId);
    
    // Convert DEX platform to bytes32 identifier
    const dexId = ethers.id(params.dexPlatform);
    
    // Parse and scale amounts
    const softcap = ethers.parseEther(params.softcap.toString());
    const tokensForSale = ethers.parseUnits(
      params.tokensForSale.toString(),
      params.tokenDecimals
    );
    const minContribution = ethers.parseEther(params.minContribution.toString());
    const maxContribution = ethers.parseEther(params.maxContribution.toString());
    
    // Convert timestamps to Unix seconds
    const startTime = BigInt(Math.floor(params.startTime.getTime() / 1000));
    const endTime = BigInt(Math.floor(params.endTime.getTime() / 1000));
    
    // Convert liquidity percent to basis points (70% = 7000 BPS)
    const liquidityPercent = BigInt(params.liquidityPercent * 100);
    const lpLockMonths = BigInt(params.lpLockMonths);
    
    // Listing premium (default 0 = no premium)
    const listingPremiumBps = params.listingPremiumBps || 0;
    
    // Team vesting (zero address if not provided)
    const teamVesting = params.teamVestingAddress || ethers.ZeroAddress;
    
    // Build constructor arguments array
    const constructorArgs: FairlaunchConstructorArgs = [
      params.projectToken,              // _projectToken
      ethers.ZeroAddress,               // _paymentToken (native token = address(0))
      softcap,                          // _softcap
      tokensForSale,                    // _tokensForSale
      minContribution,                  // _minContribution
      maxContribution,                  // _maxContribution
      startTime,                        // _startTime
      endTime,                          // _endTime
      listingPremiumBps,                // _listingPremiumBps
      networkConfig.feeSplitter,        // _feeSplitter
      teamVesting,                      // _teamVesting
      params.creatorWallet,             // _projectOwner
      networkConfig.platformAdmin,      // _adminExecutor
      liquidityPercent,                 // _liquidityPercent
      lpLockMonths,                     // _lpLockMonths
      dexId,                            // _dexId
    ];
    
    return constructorArgs;
  }
  
  /**
   * Validate deployment parameters
   */
  static validateParams(params: FairlaunchDeployParams): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Validate addresses
    if (!ethers.isAddress(params.projectToken)) {
      errors.push('Invalid project token address');
    }
    if (!ethers.isAddress(params.creatorWallet)) {
      errors.push('Invalid creator wallet address');
    }
    if (params.teamVestingAddress && !ethers.isAddress(params.teamVestingAddress)) {
      errors.push('Invalid team vesting address');
    }
    
    // Validate amounts
    try {
      const softcap = parseFloat(params.softcap);
      const min = parseFloat(params.minContribution);
      const max = parseFloat(params.maxContribution);
      const tokens = parseFloat(params.tokensForSale);
      
      if (softcap <= 0) errors.push('Softcap must be greater than 0');
      if (min <= 0) errors.push('Min contribution must be greater than 0');
      if (max <= min) errors.push('Max contribution must be greater than min');
      if (tokens <= 0) errors.push('Tokens for sale must be greater than 0');
      
      // Softcap should be achievable with max contribution
      if (softcap > max * 100) {
        errors.push('Softcap may be unrealistic (would require too many max contributors)');
      }
      
    } catch (e) {
      errors.push('Invalid numeric values');
    }
    
    // Validate timing
    const now = new Date();
    if (params.startTime <= now) {
      errors.push('Start time must be in the future');
    }
    if (params.endTime <= params.startTime) {
      errors.push('End time must be after start time');
    }
    
    const durationHours = (params.endTime.getTime() - params.startTime.getTime()) / (1000 * 60 * 60);
    if (durationHours < 1) {
      errors.push('Sale duration must be at least 1 hour');
    }
    if (durationHours > 30 * 24) {
      errors.push('Sale duration must not exceed 30 days');
    }
    
    // Validate liquidity settings
    if (params.liquidityPercent < 50 || params.liquidityPercent > 100) {
      errors.push('Liquidity percent must be between 50-100%');
    }
    if (params.lpLockMonths < 1 || params.lpLockMonths > 60) {
      errors.push('LP lock must be between 1-60 months');
    }
    
    // Validate token decimals
    if (params.tokenDecimals < 0 || params.tokenDecimals > 18) {
      errors.push('Token decimals must be between 0-18');
    }
    
    return {
      valid: errors.length === 0,
      errors,
    };
  }
  
  /**
   * Calculate total tokens needed (sale + vesting)
   */
  static calculateTotalTokensNeeded(params: FairlaunchDeployParams, teamVestingAmount?: string): bigint {
    const tokensForSale = ethers.parseUnits(
      params.tokensForSale.toString(),
      params.tokenDecimals
    );
    
    if (!teamVestingAmount) {
      return tokensForSale;
    }
    
    const vestingTokens = ethers.parseUnits(
      teamVestingAmount.toString(),
      params.tokenDecimals
    );
    
    return tokensForSale + vestingTokens;
  }
  
  /**
   * Encode constructor arguments for BSCScan verification
   */
  static encodeConstructorArgs(args: FairlaunchConstructorArgs): string {
    const types = [
      'address', 'address', 'uint256', 'uint256', 'uint256', 'uint256',
      'uint256', 'uint256', 'uint16', 'address', 'address', 'address',
      'address', 'uint256', 'uint256', 'bytes32'
    ];
    
    const encoded = ethers.AbiCoder.defaultAbiCoder().encode(types, args);
    return encoded.slice(2); // Remove '0x' prefix for BSCScan
  }
}
