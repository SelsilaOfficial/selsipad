'use server';

import { createClient } from '@/lib/supabase/server';

/**
 * Get all contributions for a fairlaunch round
 * Public data for transparency
 */
export async function getFairlaunchContributions(roundId: string) {
  try {
    console.log('[getFairlaunchContributions] Called with roundId:', roundId);
    const supabase = createClient();
    
    const { data: contributions, error } = await supabase
      .from('contributions')
      .select('id, wallet_address, amount, tx_hash, chain, created_at, confirmed_at, status')
      .eq('round_id', roundId)
      .eq('status', 'CONFIRMED')
      .order('created_at', { ascending: false });
    
    console.log('[getFairlaunchContributions] Query result:', { 
      count: contributions?.length || 0, 
      error: error?.message,
      roundId 
    });
    
    if (error) {
      console.error('Error fetching contributions:', error);
      return { success: false, contributions: [] };
    }
    
    return { 
      success: true, 
      contributions: contributions || [] 
    };
  } catch (error: any) {
    console.error('getFairlaunchContributions error:', error);
    return { success: false, contributions: [] };
  }
}
