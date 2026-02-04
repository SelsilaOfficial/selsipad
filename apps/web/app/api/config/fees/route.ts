/**
 * GET /api/config/fees
 * 
 * Get creation fee configuration for different chains and project types
 */

import { NextResponse } from 'next/server';

// Fee structure from Modul 15
const FEE_CONFIG = {
  // BSC (Chain ID 56 & 97)
  56: {
    FAIRLAUNCH: '0.2', // BNB
    PRESALE: '0.5', // BNB
  },
  97: {
    FAIRLAUNCH: '0.2', // BNB (testnet)
    PRESALE: '0.5', // BNB (testnet)
  },
  // Ethereum (Chain ID 1 & 11155111)
  1: {
    FAIRLAUNCH: '0.1', // ETH
    PRESALE: '0.1', // ETH
  },
  11155111: {
    FAIRLAUNCH: '0.1', // ETH (sepolia)
    PRESALE: '0.1', // ETH (sepolia)
  },
  // Base (Chain ID 8453 & 84532)
  8453: {
    FAIRLAUNCH: '0.1', // ETH
    PRESALE: '0.1', // ETH
  },
  84532: {
    FAIRLAUNCH: '0.1', // ETH (sepolia)
    PRESALE: '0.1', // ETH (sepolia)
  },
};

// Treasury wallet addresses per chain
const TREASURY_WALLETS = {
  56: process.env.BSC_TREASURY_WALLET || '0x0000000000000000000000000000000000000000',
  97: process.env.BSC_TESTNET_TREASURY_WALLET || process.env.PLATFORM_WALLET_ADDRESS || '0xaC89Bf746dAf1c782Ed87e81a89fe8885CF979F5', // Fallback to platform wallet for testing
  1: process.env.ETH_TREASURY_WALLET || '0x0000000000000000000000000000000000000000',
  11155111: process.env.ETH_SEPOLIA_TREASURY_WALLET || '0x0000000000000000000000000000000000000000',
  8453: process.env.BASE_TREASURY_WALLET || '0x0000000000000000000000000000000000000000',
  84532: process.env.BASE_SEPOLIA_TREASURY_WALLET || '0x0000000000000000000000000000000000000000',
};

// Escrow vault addresses per chain
const ESCROW_VAULTS = {
  97: '0x6849A09c27F26fF0e58a2E36Dd5CAB2F9d0c617F', // BSC Testnet (from Phase 1)
  56: '0x0000000000000000000000000000000000000000', // TODO: Deploy to mainnet
};

export async function GET() {
  try {
    return NextResponse.json({
      success: true,
      fees: FEE_CONFIG,
      treasuryWallets: TREASURY_WALLETS,
      escrowVaults: ESCROW_VAULTS,
    });
  } catch (error: any) {
    console.error('[Fee Config] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
