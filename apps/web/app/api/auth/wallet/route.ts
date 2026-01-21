import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
import { PublicKey } from '@solana/web3.js';
import nacl from 'tweetnacl';
import { decodeUTF8 } from 'tweetnacl-util';
import { verifyMessage } from 'viem';
import crypto from 'crypto';

interface WalletAuthRequest {
  walletType: 'solana' | 'evm';
  address: string;
  message: string;
  signature: string;
}

/**
 * Wallet Authentication API - Wallet-Only Auth (No Email Required)
 *
 * Verifies wallet signature and creates custom session
 */
export async function POST(request: NextRequest) {
  try {
    const body: WalletAuthRequest = await request.json();
    const { walletType, address, message, signature } = body;

    // Validate inputs
    if (!walletType || !address || !message || !signature) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Verify message contains the address (anti-tampering)
    if (!message.includes(address)) {
      return NextResponse.json({ error: 'Message does not match address' }, { status: 400 });
    }

    // Verify signature based on wallet type
    let isValid = false;
    let verificationError: string | undefined = undefined;

    if (walletType === 'solana') {
      const result = await verifySolanaSignature(address, message, signature);
      isValid = result.valid;
      verificationError = result.error;
    } else if (walletType === 'evm') {
      const result = await verifyEVMSignature(address, message, signature);
      isValid = result.valid;
      verificationError = result.error;
    } else {
      return NextResponse.json({ error: 'Invalid wallet type' }, { status: 400 });
    }

    if (!isValid) {
      console.error('[Auth] Signature verification failed:', verificationError);
      return NextResponse.json(
        {
          error: 'Invalid signature',
          details: verificationError || 'Signature verification failed',
        },
        { status: 401 }
      );
    }

    // Signature is valid! Now handle user authentication
    const supabase = createClient();

    // Determine chain based on wallet type
    const chain = walletType === 'solana' ? 'SOLANA' : 'EVM_1';

    // Normalize address (lowercase for EVM)
    const normalizedAddress = walletType === 'evm' ? address.toLowerCase() : address;

    // Check if wallet already exists
    const { data: existingWallet } = await supabase
      .from('wallets')
      .select('user_id, id')
      .eq('address', normalizedAddress)
      .eq('chain', chain)
      .maybeSingle();

    if (existingWallet) {
      // Wallet exists - create session for existing user
      const { createSession } = await import('@/lib/auth/session');
      const sessionToken = await createSession(normalizedAddress, chain, existingWallet.user_id);

      // Set session cookie
      cookies().set('session_token', sessionToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 30 * 24 * 60 * 60, // 30 days
        path: '/',
      });

      console.log('[Auth] Existing user authenticated', {
        userId: existingWallet.user_id,
        address: normalizedAddress,
      });

      return NextResponse.json({
        success: true,
        userId: existingWallet.user_id,
        address: normalizedAddress,
        message: 'Authenticated successfully',
      });
    }

    // User doesn't exist - create new user and wallet
    console.log('[Auth] Creating new user with wallet-only auth');

    // Step 1: Create profile with generated UUID (no Supabase Auth dependency)
    const userId = crypto.randomUUID(); // Generate UUID ourselves

    const { error: profileError } = await supabase.from('profiles').insert({
      user_id: userId, // Manually set user_id
      username: `user_${normalizedAddress.slice(0, 8)}`,
    });

    if (profileError) {
      console.error('Profile creation error:', profileError);
      return NextResponse.json(
        { error: 'Failed to create user profile', details: profileError?.message },
        { status: 500 }
      );
    }

    // Step 2: Create wallet entry with wallet_role PRIMARY
    const { error: walletError } = await supabase.from('wallets').insert({
      user_id: userId,
      address: normalizedAddress,
      chain: chain,
      is_primary: true,
      wallet_role: 'PRIMARY', // Set as PRIMARY wallet for authentication
    });

    if (walletError) {
      console.error('Wallet creation error:', walletError);
      // Rollback profile creation
      await supabase.from('profiles').delete().eq('user_id', userId);
      return NextResponse.json(
        { error: 'Failed to link wallet', details: walletError.message },
        { status: 500 }
      );
    }

    // Step 3: Create session using custom auth_sessions table
    const { createSession } = await import('@/lib/auth/session');
    const sessionToken = await createSession(normalizedAddress, chain, userId);

    // Step 4: Set session cookie
    cookies().set('session_token', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 60 * 60, // 30 days
      path: '/',
    });

    console.log('[Auth] New user created with wallet-only auth', {
      userId,
      address: normalizedAddress,
    });

    return NextResponse.json({
      success: true,
      userId,
      address: normalizedAddress,
      message: 'User created and authenticated successfully',
    });
  } catch (error: any) {
    console.error('Wallet auth error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * Verify Solana wallet signature
 */
async function verifySolanaSignature(
  address: string,
  message: string,
  signature: string
): Promise<{ valid: boolean; error?: string }> {
  try {
    console.log('[Solana Verify] Starting verification...');
    console.log('[Solana Verify] Address:', address);
    console.log('[Solana Verify] Message:', message.substring(0, 100) + '...');
    console.log('[Solana Verify] Signature length:', signature.length);

    const publicKey = new PublicKey(address);
    const messageBytes = decodeUTF8(message);
    const signatureBytes = Buffer.from(signature, 'hex');

    if (signatureBytes.length !== 64) {
      const error = `Invalid signature length: ${signatureBytes.length} (expected 64)`;
      console.error('[Solana Verify]', error);
      return { valid: false, error };
    }

    const verified = nacl.sign.detached.verify(messageBytes, signatureBytes, publicKey.toBytes());

    console.log('[Solana Verify] Result:', verified);

    return { valid: verified, error: verified ? undefined : 'Signature verification failed' };
  } catch (error: any) {
    const errorMsg = error.message || 'Unknown error';
    console.error('[Solana Verify] Error:', errorMsg);
    return { valid: false, error: errorMsg };
  }
}

/**
 * Verify EVM wallet signature
 */
async function verifyEVMSignature(
  address: string,
  message: string,
  signature: string
): Promise<{ valid: boolean; error?: string }> {
  try {
    console.log('[EVM Verify] Starting verification...');
    console.log('[EVM Verify] Address:', address);
    console.log('[EVM Verify] Message:', message.substring(0, 100) + '...');
    console.log('[EVM Verify] Signature length:', signature.length);

    if (!signature.startsWith('0x')) {
      const error = 'Signature must start with 0x';
      console.error('[EVM Verify]', error);
      return { valid: false, error };
    }

    const recoveredAddress = await verifyMessage({
      address: address as `0x${string}`,
      message,
      signature: signature as `0x${string}`,
    });

    // viem returns boolean, not address string
    const verified = typeof recoveredAddress === 'boolean' ? recoveredAddress : false;

    console.log('[EVM Verify] Verification result:', verified);
    console.log('[EVM Verify] Result type:', typeof recoveredAddress);

    return {
      valid: verified,
      error: verified ? undefined : 'Signature verification failed',
    };
  } catch (error: any) {
    const errorMsg = error.message || 'Unknown error';
    console.error('[EVM Verify] Error:', errorMsg);
    return { valid: false, error: errorMsg };
  }
}
