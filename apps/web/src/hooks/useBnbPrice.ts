'use client';

import { useState, useEffect } from 'react';

/**
 * Fetches the current BNB/USD price from CoinGecko API.
 * Caches the result for 60 seconds to avoid rate limiting.
 */

let cachedPrice: number | null = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 60_000; // 60 seconds

export function useBnbPrice() {
  const [price, setPrice] = useState<number>(cachedPrice || 0);
  const [loading, setLoading] = useState(!cachedPrice);

  useEffect(() => {
    async function fetchPrice() {
      // Use cache if still valid
      if (cachedPrice && Date.now() - cacheTimestamp < CACHE_DURATION) {
        setPrice(cachedPrice);
        setLoading(false);
        return;
      }

      try {
        const res = await fetch(
          'https://api.coingecko.com/api/v3/simple/price?ids=binancecoin&vs_currencies=usd',
          { next: { revalidate: 60 } }
        );
        const data = await res.json();
        const bnbUsd = data?.binancecoin?.usd || 0;
        
        cachedPrice = bnbUsd;
        cacheTimestamp = Date.now();
        setPrice(bnbUsd);
      } catch (err) {
        console.warn('[useBnbPrice] Failed to fetch BNB price:', err);
        // Fallback: use a reasonable default if API fails
        if (!cachedPrice) {
          setPrice(600); // approximate fallback
        }
      } finally {
        setLoading(false);
      }
    }

    fetchPrice();

    // Refresh every 60 seconds
    const interval = setInterval(fetchPrice, CACHE_DURATION);
    return () => clearInterval(interval);
  }, []);

  return { bnbPrice: price, loading };
}
