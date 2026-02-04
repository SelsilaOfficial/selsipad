'use server';

import { createClient } from '@/lib/supabase/server';
import { getServerSession } from '@/lib/auth/session';

/**
 * Get user's referral code
 */
export async function getReferralCode(): Promise<{
  success: boolean;
  code?: string;
  error?: string;
}> {
  try {
    // Get current session (wallet-based auth)
    const session = await getServerSession();
    
    if (!session) {
      console.error('[getReferralCode] No session found');
      return { success: false, error: 'Not authenticated' };
    }
    
    console.log('[getReferralCode] User ID:', session.userId);
    
    const supabase = createClient();
    
    // Get user's profile with referral code
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('referral_code')
      .eq('user_id', session.userId)
      .single();
    
    if (profileError) {
      console.error('[getReferralCode] Profile error:', profileError);
      return { success: false, error: profileError.message };
    }
    
    if (!profile?.referral_code) {
      console.error('[getReferralCode] No referral code in profile:', profile);
      return { success: false, error: 'Referral code not found' };
    }
    
    console.log('[getReferralCode] Success! Code:', profile.referral_code);
    
    return {
      success: true,
      code: profile.referral_code,
    };
  } catch (error: any) {
    console.error('getReferralCode error:', error);
    return {
      success: false,
      error: error.message || 'Failed to get referral code',
    };
  }
}

/**
 * Register a new user with a referral code
 * This should be called during registration/onboarding
 */
export async function registerWithReferral(referralCode: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    // Get current session
    const session = await getServerSession();
    
    if (!session) {
      return { success: false, error: 'Not authenticated' };
    }
    
    const supabase = createClient();
    
    // Validate referral code format (8 chars, alphanumeric)
    if (!/^[A-Z0-9]{8}$/.test(referralCode)) {
      return { success: false, error: 'Invalid referral code format' };
    }
    
    // Find referrer by code
    const { data: referrerProfile, error: referrerError } = await supabase
      .from('profiles')
      .select('user_id')
      .eq('referral_code', referralCode)
      .single();
    
    if (referrerError || !referrerProfile) {
      return { success: false, error: 'Referral code not found' };
    }
    
    // Cannot refer yourself
    if (referrerProfile.user_id === session.userId) {
      return { success: false, error: 'Cannot use your own referral code' };
    }
    
    // Check if relationship already exists
    const { data: existing } = await supabase
      .from('referral_relationships')
      .select('id')
      .eq('referee_id', session.userId)
      .single();
    
    if (existing) {
      return { success: false, error: 'You have already registered with a referral code' };
    }
    
    // Create referral relationship
    const { error: insertError } = await supabase
      .from('referral_relationships')
      .insert({
        referrer_id: referrerProfile.user_id,
        referee_id: session.userId,
        code: referralCode,
      });
    
    if (insertError) {
      return { success: false, error: insertError.message };
    }
    
    return { success: true };
  } catch (error: any) {
    console.error('registerWithReferral error:', error);
    return {
      success: false,
      error: error.message || 'Failed to register with referral code',
    };
  }
}

/**
 * Check if user has used a referral code
 */
export async function hasReferralRelationship(): Promise<{
  success: boolean;
  hasReferral: boolean;
  referrerCode?: string;
  error?: string;
}> {
  try {
    const session = await getServerSession();
    
    if (!session) {
      return { success: false, hasReferral: false, error: 'Not authenticated' };
    }
    
    const supabase = createClient();
    
    const { data: relationship } = await supabase
      .from('referral_relationships')
      .select('code')
      .eq('referee_id', session.userId)
      .single();
    
    return {
      success: true,
      hasReferral: !!relationship,
      referrerCode: relationship?.code,
    };
  } catch (error: any) {
    return {
      success: false,
      hasReferral: false,
      error: error.message,
    };
  }
}
