'use client';

import * as React from 'react';
import { ethers } from 'ethers';
import { useAccount } from 'wagmi';
import { Button } from '@/components/ui/Button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Copy, ExternalLink, CheckCircle2, AlertCircle } from 'lucide-react';

export interface TokenFundingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contractAddress: string;
  tokenAddress: string;
  tokenSymbol: string;
  tokenDecimals: number;
  requiredTokens: string; // Human-readable amount
  explorerUrl?: string;
  onFundingComplete?: () => void;
}

/**
 * Modal to guide user through funding their deployed Fairlaunch contract
 */
export function TokenFundingModal({
  open,
  onOpenChange,
  contractAddress,
  tokenAddress,
  tokenSymbol,
  tokenDecimals,
  requiredTokens,
  explorerUrl,
  onFundingComplete,
}: TokenFundingModalProps) {
  const { address: userAddress } = useAccount();
  const [fundingTxHash, setFundingTxHash] = React.useState('');
  const [isChecking, setIsChecking] = React.useState(false);
  const [checkResult, setCheckResult] = React.useState<{
    success: boolean;
    message: string;
  } | null>(null);

  // Token balance tracking via manual check
  const [tokenBalanceValue, setTokenBalanceValue] = React.useState<bigint | null>(null);

  // Check if user has sufficient balance
  const hasSufficientBalance = React.useMemo(() => {
    if (tokenBalanceValue === null) return false;
    const required = ethers.parseUnits(requiredTokens, tokenDecimals);
    return tokenBalanceValue >= required;
  }, [tokenBalanceValue, requiredTokens, tokenDecimals]);

  // Copy contract address to clipboard
  const handleCopyAddress = async () => {
    try {
      await navigator.clipboard.writeText(contractAddress);
      // Could add a toast notification here
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  // Check if contract has been funded
  const handleCheckFunding = async () => {
    setIsChecking(true);
    setCheckResult(null);

    try {
      // Query contract balance via eth_call
      const provider = new ethers.BrowserProvider(window.ethereum);
      const tokenContract = new ethers.Contract(
        tokenAddress,
        ['function balanceOf(address) view returns (uint256)'],
        provider
      );

      const balance = await (tokenContract as any).balanceOf(contractAddress);
      const required = ethers.parseUnits(requiredTokens, tokenDecimals);

      if (balance >= required) {
        setCheckResult({
          success: true,
          message: `✅ Contract funded! ${ethers.formatUnits(balance, tokenDecimals)} ${tokenSymbol} detected.`,
        });
      } else {
        const formatted = ethers.formatUnits(balance, tokenDecimals);
        setCheckResult({
          success: false,
          message: `Current balance: ${formatted} ${tokenSymbol}. Need ${requiredTokens} ${tokenSymbol}.`,
        });
      }
    } catch (error: any) {
      setCheckResult({
        success: false,
        message: `Failed to check balance: ${error.message}`,
      });
    } finally {
      setIsChecking(false);
    }
  };

  // Mark as funded and continue
  const handleMarkAsFunded = async () => {
    // Optionally verify one more time
    await handleCheckFunding();

    if (checkResult?.success) {
      onFundingComplete?.();
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            📦 Fund Your Fairlaunch Contract
          </DialogTitle>
          <DialogDescription>
            Send {requiredTokens} {tokenSymbol} to your deployed contract to complete setup
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Contract Address */}
          <div className="space-y-2">
            <Label>Contract Address</Label>
            <div className="flex gap-2">
              <Input value={contractAddress} readOnly className="font-mono text-sm" />
              <Button
                variant="secondary"
                size="sm"
                onClick={handleCopyAddress}
                title="Copy address"
              >
                <Copy className="h-4 w-4" />
              </Button>
              {explorerUrl && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => window.open(explorerUrl, '_blank')}
                  title="View on explorer"
                >
                  <ExternalLink className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Token Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Required Amount</Label>
              <div className="rounded-md border px-3 py-2 bg-muted">
                <p className="font-semibold">
                  {requiredTokens} {tokenSymbol}
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Your Balance</Label>
              <div className="rounded-md border px-3 py-2 bg-muted">
                <p
                  className={`font-semibold ${hasSufficientBalance ? 'text-green-600' : 'text-red-600'}`}
                >
                  {tokenBalanceValue !== null
                    ? `${ethers.formatUnits(tokenBalanceValue, tokenDecimals)} ${tokenSymbol}`
                    : 'Click Check Balance'}
                  {hasSufficientBalance && ' ✅'}
                </p>
              </div>
            </div>
          </div>

          {/* Warning Alert */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>Important:</strong> Send exactly{' '}
              <strong>
                {requiredTokens} {tokenSymbol}
              </strong>{' '}
              to the contract address above. This is required for your Fairlaunch to function
              properly.
            </AlertDescription>
          </Alert>

          {/* Insufficient Balance Warning */}
          {!hasSufficientBalance && tokenBalanceValue !== null && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                You don't have enough {tokenSymbol} tokens in your wallet. Please acquire more
                tokens before proceeding.
              </AlertDescription>
            </Alert>
          )}

          {/* Optional TX Hash Input */}
          <div className="space-y-2">
            <Label htmlFor="txHash">Funding Transaction Hash (Optional)</Label>
            <Input
              id="txHash"
              placeholder="0x..."
              value={fundingTxHash}
              onChange={(e) => setFundingTxHash(e.target.value)}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Enter the transaction hash after sending tokens (optional, for tracking purposes)
            </p>
          </div>

          {/* Check Result */}
          {checkResult && (
            <Alert variant={checkResult.success ? 'default' : 'destructive'}>
              {checkResult.success ? (
                <CheckCircle2 className="h-4 w-4" />
              ) : (
                <AlertCircle className="h-4 w-4" />
              )}
              <AlertDescription>{checkResult.message}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="secondary" onClick={handleCheckFunding} disabled={isChecking}>
            {isChecking ? 'Checking...' : 'Check Balance'}
          </Button>
          <Button onClick={handleMarkAsFunded} disabled={!checkResult?.success}>
            Continue
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
