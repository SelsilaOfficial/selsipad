import { ethers } from 'ethers';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '../../.env' }); // Adjust path to project root if needed

export const RPC_URL = process.env.NEXT_PUBLIC_EVM_RPC_URL || 'https://data-seed-prebsc-1-s1.binance.org:8545/';
export const FACTORY_ADDRESS = '0x9cE2f9284EF7C711ec541f1bC07c844097722618'; // From recent deploy
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
export const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing Supabase configuration');
  process.exit(1);
}

export const provider = new ethers.JsonRpcProvider(RPC_URL);
export const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
