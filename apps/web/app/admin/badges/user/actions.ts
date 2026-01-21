'use server';

import { createClient } from '@/lib/supabase/server';
import { getServerSession } from '@/lib/auth/session';
import { revalidatePath } from 'next/cache';

interface ActionResult {
  success: boolean;
  data?: any;
  error?: string;
}

/**
 * Grant badge to user
 */
export async function grantUserBadge(
  userId: string,
  badgeKey: string,
  reason: string
): Promise<ActionResult> {
  try {
    const session = await getServerSession();
    if (!session) {
      return { success: false, error: 'Not authenticated' };
    }

    // Use service role to bypass RLS
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const { createClient: createSupabaseClient } = await import('@supabase/supabase-js');
    const supabase = createSupabaseClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Get badge definition
    const { data: badge, error: badgeError } = await supabase
      .from('badge_definitions')
      .select('id, scope')
      .eq('badge_key', badgeKey)
      .single();

    if (badgeError || !badge) {
      return { success: false, error: 'Badge not found' };
    }

    if (badge.scope !== 'USER') {
      return { success: false, error: 'This badge is for projects, not users' };
    }

    // Check if user already has this active badge
    const { data: existing } = await supabase
      .from('badge_instances')
      .select('id')
      .eq('user_id', userId)
      .eq('badge_id', badge.id)
      .eq('status', 'ACTIVE')
      .single();

    if (existing) {
      return { success: false, error: 'User already has this badge' };
    }

    // Award badge
    const { data, error } = await supabase
      .from('badge_instances')
      .insert({
        user_id: userId,
        badge_id: badge.id,
        awarded_by: session.userId,
        award_reason: reason,
        status: 'ACTIVE',
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to grant badge:', error);
      return { success: false, error: error.message };
    }

    revalidatePath('/admin/badges');
    return { success: true, data };
  } catch (error: any) {
    console.error('Grant user badge error:', error);
    return { success: false, error: error.message || 'Failed to grant badge' };
  }
}

/**
 * Revoke user badge
 */
export async function revokeUserBadge(instanceId: string, reason: string): Promise<ActionResult> {
  try {
    const session = await getServerSession();
    if (!session) {
      return { success: false, error: 'Not authenticated' };
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const { createClient: createSupabaseClient } = await import('@supabase/supabase-js');
    const supabase = createSupabaseClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data, error } = await supabase
      .from('badge_instances')
      .update({
        status: 'REVOKED',
        revoked_by: session.userId,
        revoked_at: new Date().toISOString(),
        revoke_reason: reason,
      })
      .eq('id', instanceId)
      .select()
      .single();

    if (error) {
      console.error('Failed to revoke badge:', error);
      return { success: false, error: error.message };
    }

    revalidatePath('/admin/badges');
    return { success: true, data };
  } catch (error: any) {
    console.error('Revoke badge error:', error);
    return { success: false, error: error.message || 'Failed to revoke badge' };
  }
}
