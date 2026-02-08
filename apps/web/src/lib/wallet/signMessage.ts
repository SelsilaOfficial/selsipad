import { PublicKey } from '@solana/web3.js';
import { useWallet } from '@solana/wallet-adapter-react';
import { useAccount, useSignMessage as useSignMessageWagmi } from 'wagmi';

/**
 * Sign In with Wallet Utilities
 */

export interface SignMessageResult {
  message: string;
  signature: string;
  address: string;
}

/**
 * Generate authentication message
 */
export function generateAuthMessage(address: string): string {
  const timestamp = Date.now();
  return `Sign this message to authenticate with SELSIPAD\n\nWallet: ${address}\nTimestamp: ${timestamp}\n\nThis request will not trigger any blockchain transaction or cost any gas fees.`;
}

/**
 * Sign message with Solana wallet
 */
export async function signMessageSolana(
  signMessage: (message: Uint8Array) => Promise<Uint8Array>,
  publicKey: PublicKey
): Promise<SignMessageResult> {
  const address = publicKey.toBase58();
  const message = generateAuthMessage(address);
  const messageBytes = new TextEncoder().encode(message);

  const signature = await signMessage(messageBytes);
  const signatureHex = Buffer.from(signature).toString('hex');

  return {
    message,
    signature: signatureHex,
    address,
  };
}

/**
 * Sign message with EVM wallet
 */
export async function signMessageEVM(
  signMessage: (args: { message: string }) => Promise<string>,
  address: string
): Promise<SignMessageResult> {
  const message = generateAuthMessage(address);

  console.log('[Frontend EVM] Message to sign:', message);
  console.log('[Frontend EVM] Message length:', message.length);

  const signature = await signMessage({ message });

  console.log('[Frontend EVM] Signature received:', signature);
  console.log('[Frontend EVM] Signature length:', signature.length);

  return {
    message,
    signature,
    address,
  };
}

/**
 * Send signature to backend for verification
 */
export async function verifyAndCreateSession(
  walletType: 'solana' | 'evm',
  signResult: SignMessageResult,
  referralCode?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    console.log('[Frontend] Sending to API:', {
      walletType,
      address: signResult.address,
      messageLength: signResult.message.length,
      signatureLength: signResult.signature.length,
      referralCode: referralCode || '(none)',
    });

    const response = await fetch('/api/auth/wallet', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        walletType,
        address: signResult.address,
        message: signResult.message,
        signature: signResult.signature,
        ...(referralCode ? { referralCode } : {}),
      }),
    });

    const data = await response.json();

    console.log('[Frontend] API Response:', {
      status: response.status,
      ok: response.ok,
      data,
    });

    if (!response.ok) {
      console.error('[Frontend] Auth failed:', data);
      return {
        success: false,
        error: data.error || 'Authentication failed',
      };
    }

    return { success: true };
  } catch (error: any) {
    console.error('[Frontend] Verify session error:', error);
    return {
      success: false,
      error: 'Network error: ' + error.message,
    };
  }
}
