'use client';

/**
 * Contract Verification Button Component
 * Shows verification status and allows admin to trigger verification
 */

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, Loader2, ExternalLink, Shield } from 'lucide-react';
import {
  verifyFairlaunchContracts,
  getVerificationStatus,
} from '@/actions/admin/verify-fairlaunch-contracts';

interface VerificationStatusProps {
  roundId: string;
  poolAddress?: string | null;
  tokenAddress?: string | null;
  vestingAddress?: string | null;
  network?: string;
  initialVerified?: boolean;
}

export function ContractVerificationButton({
  roundId,
  poolAddress,
  tokenAddress,
  vestingAddress,
  network = 'bsc_testnet',
  initialVerified = false,
}: VerificationStatusProps) {
  const [isVerifying, setIsVerifying] = useState(false);
  const [verified, setVerified] = useState(initialVerified);
  const [verificationDetails, setVerificationDetails] = useState<any>(null);

  const baseUrl = network === 'bsc_testnet' ? 'https://testnet.bscscan.com' : 'https://bscscan.com';

  const handleVerify = async () => {
    if (!poolAddress) {
      alert('Error: Contract not deployed yet');
      return;
    }

    setIsVerifying(true);
    try {
      const result = await verifyFairlaunchContracts(roundId);

      if (result.success) {
        setVerified(true);
        setVerificationDetails(result);

        const verifiedCount = [
          result.fairlaunch?.verified,
          result.token?.verified,
          result.vesting?.verified,
        ].filter(Boolean).length;

        alert(`Success! Verified ${verifiedCount} contract(s) successfully!`);
      } else {
        alert(`Error: ${result.error || 'Verification failed'}`);
      }
    } catch (error: any) {
      console.error('Verification error:', error);
      alert(`Error: ${error.message || 'Failed to verify contracts'}`);
    } finally {
      setIsVerifying(false);
    }
  };

  const loadStatus = async () => {
    const result = await getVerificationStatus(roundId);
    if (result.success) {
      setVerificationDetails(result);
      setVerified(
        result.fairlaunch?.verified || result.token?.verified || result.vesting?.verified || false
      );
    }
  };

  return (
    <div className="space-y-3">
      {/* Status Badge */}
      {verified ? (
        <Badge variant="default" className="gap-1.5 bg-green-600 hover:bg-green-700">
          <CheckCircle className="h-3.5 w-3.5" />
          Verified on BSCScan
        </Badge>
      ) : (
        <Badge variant="secondary" className="gap-1.5">
          <Shield className="h-3.5 w-3.5" />
          Not Verified
        </Badge>
      )}

      {/* Verify Button */}
      {!verified && poolAddress && (
        <Button
          variant="secondary"
          size="sm"
          onClick={handleVerify}
          disabled={isVerifying}
          className="w-full"
        >
          {isVerifying ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Verifying...
            </>
          ) : (
            <>
              <Shield className="mr-2 h-4 w-4" />
              Verify Contracts
            </>
          )}
        </Button>
      )}

      {/* Verification Details */}
      {(verified || verificationDetails) && (
        <div className="space-y-2 text-sm">
          {/* Fairlaunch */}
          {poolAddress && (
            <div className="flex items-center justify-between p-2 rounded-md bg-muted/50">
              <div className="flex items-center gap-2">
                {verificationDetails?.fairlaunch?.verified ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-gray-400" />
                )}
                <span className="font-medium">Fairlaunch</span>
              </div>
              <a
                href={`${baseUrl}/address/${poolAddress}#code`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                View <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}

          {/* Token */}
          {tokenAddress && (
            <div className="flex items-center justify-between p-2 rounded-md bg-muted/50">
              <div className="flex items-center gap-2">
                {verificationDetails?.token?.verified ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-gray-400" />
                )}
                <span className="font-medium">Token</span>
              </div>
              <a
                href={`${baseUrl}/address/${tokenAddress}#code`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                View <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}

          {/* Vesting */}
          {vestingAddress && (
            <div className="flex items-center justify-between p-2 rounded-md bg-muted/50">
              <div className="flex items-center gap-2">
                {verificationDetails?.vesting?.verified ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-gray-400" />
                )}
                <span className="font-medium">Vesting</span>
              </div>
              <a
                href={`${baseUrl}/address/${vestingAddress}#code`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                View <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}
        </div>
      )}

      {/* Refresh Status */}
      {verified && (
        <Button variant="ghost" size="sm" onClick={loadStatus} className="w-full text-xs">
          Refresh Status
        </Button>
      )}
    </div>
  );
}
