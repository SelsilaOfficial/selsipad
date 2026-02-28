'use client';

import { useState, useEffect } from 'react';
import { ethers } from 'ethers';

const ERC20_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
];

interface TokenInfo {
  isValid: boolean;
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: string;
  balance: string;
  isLoading: boolean;
  error: string | null;
}

const CHAIN_RPC: Record<number, string> = {
  97: 'https://data-seed-prebsc-1-s1.bnbchain.org:8545',
  11155111: 'https://ethereum-sepolia-rpc.publicnode.com',
  84532: 'https://sepolia.base.org',
  56: 'https://bsc-dataseed.binance.org',
  1: 'https://eth.llamarpc.com',
  8453: 'https://mainnet.base.org',
};

export function useTokenInfo(
  tokenAddress: string | undefined,
  ownerAddress: string | undefined,
  chainId: number = 97
): TokenInfo {
  const [info, setInfo] = useState<TokenInfo>({
    isValid: false,
    name: '',
    symbol: '',
    decimals: 18,
    totalSupply: '0',
    balance: '0',
    isLoading: false,
    error: null,
  });

  useEffect(() => {
    if (!tokenAddress || !ethers.isAddress(tokenAddress)) {
      setInfo((prev) => ({ ...prev, isValid: false, error: null }));
      return;
    }

    const fetchTokenInfo = async () => {
      setInfo((prev) => ({ ...prev, isLoading: true, error: null }));

      try {
        const rpcUrl = CHAIN_RPC[chainId] || CHAIN_RPC[97];
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);

        const [name, symbol, decimals, totalSupply] = await Promise.all([
          (contract as any).name(),
          (contract as any).symbol(),
          (contract as any).decimals(),
          (contract as any).totalSupply(),
        ]);

        let balance = '0';
        if (ownerAddress && ethers.isAddress(ownerAddress)) {
          try {
            const bal = await (contract as any).balanceOf(ownerAddress);
            balance = ethers.formatUnits(bal, decimals);
          } catch {
            // Ignore balance errors
          }
        }

        setInfo({
          isValid: true,
          name,
          symbol,
          decimals: Number(decimals),
          totalSupply: ethers.formatUnits(totalSupply, decimals),
          balance,
          isLoading: false,
          error: null,
        });
      } catch (err: any) {
        setInfo({
          isValid: false,
          name: '',
          symbol: '',
          decimals: 18,
          totalSupply: '0',
          balance: '0',
          isLoading: false,
          error: err?.message || 'Failed to fetch token info',
        });
      }
    };

    fetchTokenInfo();
  }, [tokenAddress, ownerAddress, chainId]);

  return info;
}
