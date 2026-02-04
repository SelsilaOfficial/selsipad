/**
 * Hook for polling deployment and verification status
 */

import { useState, useEffect, useCallback } from 'react';

export interface DeploymentStatusData {
  deployment_status: string;
  verification_status: string;
  contract_address: string | null;
  deployment_tx_hash: string | null;
  deployed_at: string | null;
  verified_at: string | null;
  tokens_funded_at: string | null;
  verification_error: string | null;
}

export function useDeploymentStatusPolling(
  launchRoundId: string | null,
  enabled: boolean = true,
  intervalMs: number = 5000 // Poll every 5 seconds
) {
  const [status, setStatus] = useState<DeploymentStatusData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    if (!launchRoundId || !enabled) return;

    try {
      setIsLoading(true);
      setError(null);

      const response = await fetch(`/api/fairlaunch/deployment/${launchRoundId}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch deployment status');
      }

      const data = await response.json();
      setStatus(data.deployment);
    } catch (err: any) {
      setError(err.message);
      console.error('[useDeploymentStatusPolling] Error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [launchRoundId, enabled]);

  // Initial fetch
  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Polling
  useEffect(() => {
    if (!enabled || !launchRoundId) return;

    const intervalId = setInterval(fetchStatus, intervalMs);

    return () => clearInterval(intervalId);
  }, [enabled, launchRoundId, intervalMs, fetchStatus]);

  // Manual refresh
  const refresh = useCallback(() => {
    return fetchStatus();
  }, [fetchStatus]);

  return {
    status,
    isLoading,
    error,
    refresh,
  };
}
