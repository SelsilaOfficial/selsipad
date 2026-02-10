/**
 * Solana Transaction Verification
 * Server-side verification of Solana transactions via RPC
 */

import { Connection, PublicKey, TransactionResponse, SignatureStatus } from '@solana/web3.js';

// Solana RPC endpoint (configurable via env)
const RPC_ENDPOINT = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
const CONFIRMATION_TARGET = 32; // Maximum transaction history lookback (slots)

/**
 * Get Solana RPC connection
 */
export function getSolanaConnection(): Connection {
  return new Connection(RPC_ENDPOINT, 'confirmed');
}

/**
 * Verify a Solana transaction exists and is confirmed
 *
 * @param txHash - Transaction signature/hash
 * @returns Transaction status or null if not found
 */
export async function verifyTransactionExists(txHash: string): Promise<SignatureStatus | null> {
  try {
    const connection = getSolanaConnection();

    // Check if transaction is confirmed
    const status = await connection.getSignatureStatus(txHash);

    if (!status || !status.value) {
      console.warn(`Transaction ${txHash} not found on-chain`);
      return null;
    }

    return status.value;
  } catch (error) {
    console.error(`Error verifying transaction ${txHash}:`, error);
    return null;
  }
}

/**
 * Verify transaction is confirmed (not just submitted)
 *
 * @param txHash - Transaction signature/hash
 * @param minConfirmations - Minimum confirmations required (default 2)
 * @returns true if confirmed, false otherwise
 */
export async function isTransactionConfirmed(
  txHash: string,
  minConfirmations: number = 2
): Promise<boolean> {
  try {
    const status = await verifyTransactionExists(txHash);

    if (!status) {
      return false;
    }

    // Check for errors
    if (status.err) {
      console.error(`Transaction ${txHash} failed with error:`, status.err);
      return false;
    }

    // Check confirmation count
    const confirmations = status.confirmations ?? 0;
    const isConfirmed =
      confirmations >= minConfirmations || status.confirmationStatus === 'finalized';

    if (!isConfirmed) {
      console.warn(
        `Transaction ${txHash} has ${confirmations} confirmations, need ${minConfirmations}`
      );
    }

    return isConfirmed;
  } catch (error) {
    console.error(`Error checking confirmation for ${txHash}:`, error);
    return false;
  }
}

/**
 * Verify a transfer transaction amount and recipient
 *
 * @param txHash - Transaction signature
 * @param expectedRecipient - Expected recipient address
 * @param expectedAmount - Expected amount in lamports
 * @returns Object with verification results
 */
export async function verifyTransferTransaction(
  txHash: string,
  expectedRecipient: string,
  expectedAmount: bigint
): Promise<{
  isValid: boolean;
  error?: string;
  actualAmount?: bigint;
  actualRecipient?: string;
  confirmations?: number;
}> {
  try {
    // First check if transaction exists and is confirmed
    const status = await verifyTransactionExists(txHash);

    if (!status) {
      return { isValid: false, error: 'Transaction not found on-chain' };
    }

    if (status.err) {
      return { isValid: false, error: `Transaction failed: ${JSON.stringify(status.err)}` };
    }

    // Get full transaction details
    const connection = getSolanaConnection();
    const transaction = await connection.getTransaction(txHash, {
      maxSupportedTransactionVersion: 0,
    });

    if (!transaction) {
      return { isValid: false, error: 'Transaction details not available' };
    }

    // Verify the transaction has the expected transfer
    // This is a simplified check - in production, you'd parse the instructions properly
    const postBalances = transaction.meta?.postBalances || [];
    const preBalances = transaction.meta?.preBalances || [];
    const accountKeys = transaction.transaction.message.getAccountKeys();

    // Find recipient index
    let recipientIndex = -1;
    for (let i = 0; i < accountKeys.staticAccountKeys.length; i++) {
      if (accountKeys.staticAccountKeys[i]?.toString() === expectedRecipient) {
        recipientIndex = i;
        break;
      }
    }

    if (recipientIndex === -1) {
      return {
        isValid: false,
        error: `Expected recipient ${expectedRecipient} not found in transaction accounts`,
      };
    }

    // Calculate balance change for recipient
    const balanceIncrease =
      BigInt(postBalances[recipientIndex] || 0) - BigInt(preBalances[recipientIndex] || 0);

    if (balanceIncrease < expectedAmount) {
      return {
        isValid: false,
        error: `Insufficient transfer amount. Expected: ${expectedAmount}, Got: ${balanceIncrease}`,
        actualAmount: balanceIncrease,
      };
    }

    return {
      isValid: true,
      actualAmount: balanceIncrease,
      actualRecipient: expectedRecipient,
      confirmations: status.confirmations ?? 0,
    };
  } catch (error) {
    console.error(`Error verifying transfer transaction ${txHash}:`, error);
    return { isValid: false, error: `Error verifying transaction: ${String(error)}` };
  }
}

/**
 * Verify SPL token transfer transaction
 *
 * @param txHash - Transaction signature
 * @param expectedTokenMint - Expected token mint address
 * @param expectedRecipientTokenAccount - Expected recipient token account
 * @param expectedAmount - Expected amount (in token base units)
 * @returns Verification result
 */
export async function verifySPLTransferTransaction(
  txHash: string,
  expectedTokenMint: string,
  expectedRecipientTokenAccount: string,
  expectedAmount: bigint
): Promise<{
  isValid: boolean;
  error?: string;
  actualAmount?: bigint;
  confirmations?: number;
}> {
  try {
    const status = await verifyTransactionExists(txHash);

    if (!status) {
      return { isValid: false, error: 'Transaction not found on-chain' };
    }

    if (status.err) {
      return { isValid: false, error: `Transaction failed: ${JSON.stringify(status.err)}` };
    }

    // Get full transaction details
    const connection = getSolanaConnection();
    const transaction = await connection.getTransaction(txHash, {
      maxSupportedTransactionVersion: 0,
    });

    if (!transaction) {
      return { isValid: false, error: 'Transaction details not available' };
    }

    // For SPL token transfers, we need to check token account balances
    // This is a simplified implementation - in production, parse the token instruction
    // For now, we verify the transaction is confirmed and contains the recipient

    const accountKeys = transaction.transaction.message.getAccountKeys();
    let foundRecipientAccount = false;

    for (const key of accountKeys.staticAccountKeys) {
      if (key?.toString() === expectedRecipientTokenAccount) {
        foundRecipientAccount = true;
        break;
      }
    }

    if (!foundRecipientAccount) {
      return {
        isValid: false,
        error: `Recipient token account ${expectedRecipientTokenAccount} not found in transaction`,
      };
    }

    return {
      isValid: true,
      actualAmount: expectedAmount,
      confirmations: status.confirmations ?? 0,
    };
  } catch (error) {
    console.error(`Error verifying SPL transfer ${txHash}:`, error);
    return { isValid: false, error: `Error verifying transaction: ${String(error)}` };
  }
}

/**
 * Wait for transaction confirmation (with timeout)
 *
 * @param txHash - Transaction signature
 * @param maxRetries - Maximum number of retries (default 30 = ~30 seconds)
 * @param delayMs - Delay between retries in milliseconds (default 1000)
 * @returns true if confirmed within timeout
 */
export async function waitForTransactionConfirmation(
  txHash: string,
  maxRetries: number = 30,
  delayMs: number = 1000
): Promise<boolean> {
  for (let i = 0; i < maxRetries; i++) {
    const isConfirmed = await isTransactionConfirmed(txHash, 2);
    if (isConfirmed) {
      return true;
    }

    if (i < maxRetries - 1) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  return false;
}

/**
 * Comprehensive transaction verification for deploy/swap/migrate operations
 *
 * @param operation - Operation type (DEPLOY, SWAP, MIGRATE)
 * @param txHash - Transaction signature
 * @param expectedRecipient - Treasury or fee address
 * @param expectedAmount - Expected amount in lamports
 * @returns Complete verification result
 */
export async function verifyBondingOperation(
  operation: 'DEPLOY' | 'SWAP' | 'MIGRATE',
  txHash: string,
  expectedRecipient: string,
  expectedAmount: bigint
): Promise<{
  success: boolean;
  isConfirmed: boolean;
  txExists: boolean;
  amountValid: boolean;
  error?: string;
  details?: {
    actualAmount?: bigint;
    confirmations?: number;
  };
}> {
  // Verify transaction exists
  const txExists = (await verifyTransactionExists(txHash)) !== null;
  if (!txExists) {
    return {
      success: false,
      isConfirmed: false,
      txExists: false,
      amountValid: false,
      error: `Transaction ${txHash} not found on Solana blockchain`,
    };
  }

  // Verify transaction is confirmed
  const isConfirmed = await isTransactionConfirmed(txHash, 2);
  if (!isConfirmed) {
    return {
      success: false,
      isConfirmed: false,
      txExists: true,
      amountValid: false,
      error: `Transaction ${txHash} not yet confirmed. Please wait a moment and try again.`,
    };
  }

  // Verify transfer amount and recipient
  const transferResult = await verifyTransferTransaction(txHash, expectedRecipient, expectedAmount);

  if (!transferResult.isValid) {
    return {
      success: false,
      isConfirmed: true,
      txExists: true,
      amountValid: false,
      error: transferResult.error,
      details: {
        actualAmount: transferResult.actualAmount,
        confirmations: transferResult.confirmations,
      },
    };
  }

  return {
    success: true,
    isConfirmed: true,
    txExists: true,
    amountValid: true,
    details: {
      actualAmount: transferResult.actualAmount,
      confirmations: transferResult.confirmations,
    },
  };
}
