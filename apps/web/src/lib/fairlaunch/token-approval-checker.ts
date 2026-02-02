/**
 * Token Approval Checker Service
 * Validates that project token has sufficient allowance and balance
 * before Fairlaunch deployment
 */

import { ethers } from 'ethers';
import { DeployerWallet } from '../web3/deployer-wallet';

// Standard ERC20 ABI for approval checking
const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function name() view returns (string)',
];

export interface TokenApprovalCheck {
  isValid: boolean;
  tokenAddress: string;
  ownerAddress: string;
  spenderAddress?: string;
  requiredAmount: bigint;
  balance: bigint;
  allowance: bigint;
  decimals: number;
  symbol: string;
  name: string;
  errors: string[];
}

export class TokenApprovalChecker {
  private provider: ethers.Provider;
  private chainId: number;

  constructor(chainId: number) {
    this.chainId = chainId;
    const deployerWallet = new DeployerWallet(chainId);
    this.provider = deployerWallet.getProvider();
  }

  /**
   * Check if owner has sufficient token balance and approval
   */
  async checkTokenApproval(
    tokenAddress: string,
    ownerAddress: string,
    requiredAmount: string | bigint,
    spenderAddress?: string
  ): Promise<TokenApprovalCheck> {
    const errors: string[] = [];

    try {
      // Validate addresses
      if (!ethers.isAddress(tokenAddress)) {
        errors.push('Invalid token address');
      }
      if (!ethers.isAddress(ownerAddress)) {
        errors.push('Invalid owner address');
      }
      if (spenderAddress && !ethers.isAddress(spenderAddress)) {
        errors.push('Invalid spender address');
      }

      if (errors.length > 0) {
        return {
          isValid: false,
          tokenAddress,
          ownerAddress,
          spenderAddress,
          requiredAmount: BigInt(0),
          balance: BigInt(0),
          allowance: BigInt(0),
          decimals: 18,
          symbol: 'UNKNOWN',
          name: 'Unknown Token',
          errors,
        };
      }

      // Create token contract instance
      const token = new ethers.Contract(tokenAddress, ERC20_ABI, this.provider);

      // Fetch token metadata
      const [decimals, symbol, name] = await Promise.all([
        token.decimals().catch(() => 18),
        token.symbol().catch(() => 'UNKNOWN'),
        token.name().catch(() => 'Unknown Token'),
      ]);

      // Convert required amount to BigInt
      const required = typeof requiredAmount === 'string' 
        ? ethers.parseUnits(requiredAmount, decimals) 
        : BigInt(requiredAmount);

      // Check balance
      const balance = await token.balanceOf(ownerAddress);

      if (balance < required) {
        const balanceFormatted = ethers.formatUnits(balance, decimals);
        const requiredFormatted = ethers.formatUnits(required, decimals);
        errors.push(
          `Insufficient token balance. Required: ${requiredFormatted} ${symbol}, Available: ${balanceFormatted} ${symbol}`
        );
      }

      // Check allowance if spender is provided
      let allowance = BigInt(0);
      if (spenderAddress) {
        allowance = await token.allowance(ownerAddress, spenderAddress);

        if (allowance < required) {
          const allowanceFormatted = ethers.formatUnits(allowance, decimals);
          const requiredFormatted = ethers.formatUnits(required, decimals);
          errors.push(
            `Insufficient token allowance. Required: ${requiredFormatted} ${symbol}, Approved: ${allowanceFormatted} ${symbol}`
          );
        }
      }

      return {
        isValid: errors.length === 0,
        tokenAddress,
        ownerAddress,
        spenderAddress,
        requiredAmount: required,
        balance,
        allowance,
        decimals,
        symbol,
        name,
        errors,
      };
    } catch (error: any) {
      errors.push(`Token check failed: ${error.message}`);
      
      return {
        isValid: false,
        tokenAddress,
        ownerAddress,
        spenderAddress,
        requiredAmount: BigInt(0),
        balance: BigInt(0),
        allowance: BigInt(0),
        decimals: 18,
        symbol: 'ERROR',
        name: 'Error checking token',
        errors,
      };
    }
  }

  /**
   * Pre-deployment validation for Fairlaunch
   * Checks if creator has enough tokens to fund the sale
   */
  async validateFairlaunchFunding(
    tokenAddress: string,
    creatorAddress: string,
    tokensForSale: string,
    tokenDecimals: number = 18
  ): Promise<TokenApprovalCheck> {
    // Parse tokens for sale
    const requiredTokens = ethers.parseUnits(tokensForSale, tokenDecimals);

    // Check creator's balance (no approval needed yet, just balance check)
    return this.checkTokenApproval(
      tokenAddress,
      creatorAddress,
      requiredTokens
    );
  }

  /**
   * Get human-readable approval status message
   */
  getApprovalStatusMessage(check: TokenApprovalCheck): string {
    if (check.isValid) {
      const formattedAmount = ethers.formatUnits(check.requiredAmount, check.decimals);
      return `✅ Token check passed. You have sufficient ${check.symbol} tokens (${formattedAmount})`;
    }

    return `❌ Token check failed:\n${check.errors.join('\n')}`;
  }

  /**
   * Check if token contract is valid and readable
   */
  async isValidERC20(tokenAddress: string): Promise<{
    isValid: boolean;
    decimals?: number;
    symbol?: string;
    name?: string;
    error?: string;
  }> {
    try {
      if (!ethers.isAddress(tokenAddress)) {
        return {
          isValid: false,
          error: 'Invalid token address format',
        };
      }

      const token = new ethers.Contract(tokenAddress, ERC20_ABI, this.provider);

      const [decimals, symbol, name] = await Promise.all([
        token.decimals(),
        token.symbol(),
        token.name(),
      ]);

      return {
        isValid: true,
        decimals,
        symbol,
        name,
      };
    } catch (error: any) {
      return {
        isValid: false,
        error: `Not a valid ERC20 token: ${error.message}`,
      };
    }
  }
}
