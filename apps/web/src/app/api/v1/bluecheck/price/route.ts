/**
 * GET /api/v1/bluecheck/price
 * Get current Blue Check price and supported payment methods
 */

import { NextResponse } from 'next/server';

const BLUECHECK_PRICE_USD = 10.0;

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    return NextResponse.json({
      price_usd: BLUECHECK_PRICE_USD.toFixed(2),
      supported_chains: [
        {
          chain: 'ethereum',
          tokens: [
            { address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', symbol: 'USDT', decimals: 6 },
            { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', symbol: 'USDC', decimals: 6 },
          ],
        },
        {
          chain: 'bsc',
          tokens: [
            { address: '0x55d398326f99059fF775485246999027B3197955', symbol: 'USDT', decimals: 18 },
            { address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', symbol: 'USDC', decimals: 18 },
          ],
        },
      ],
    });
  } catch (error) {
    console.error('Error in GET /api/v1/bluecheck/price:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
