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
 * Get all badge definitions
 */
export async function getBadgeDefinitions(): Promise<ActionResult> {
  try {
    const supabase = createClient();

    const { data, error } = await supabase
      .from('badge_definitions')
      .select('*')
      .order('badge_type', { ascending: true });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to fetch badges' };
  }
}

/**
 * Grant badge to project (manual)
 */
export async function grantProjectBadge(
  projectId: string,
  badgeKey: string,
  reason: string
): Promise<ActionResult> {
  try {
    const session = await getServerSession();
    if (!session) {
      return { success: false, error: 'Not authenticated' };
    }

    if (!reason || reason.trim().length < 10) {
      return { success: false, error: 'Reason required (min 10 chars)' };
    }

    const supabase = createClient();

    // Verify admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('wallet_address', session.address)
      .single();

    if (!profile?.is_admin) {
      return { success: false, error: 'Unauthorized' };
    }

    // Get badge definition
    const { data: badge, error: badgeError } = await supabase
      .from('badge_definitions')
      .select('id')
      .eq('badge_key', badgeKey)
      .single();

    if (badgeError || !badge) {
      return { success: false, error: 'Badge not found' };
    }

    // Grant badge
    const { error: grantError } = await supabase.from('project_badges').insert({
      project_id: projectId,
      badge_id: badge.id,
      awarded_by: session.address,
      reason: reason.trim(),
    });

    if (grantError) {
      if (grantError.code === '23505') {
        return { success: false, error: 'Badge already granted to this project' };
      }
      return { success: false, error: grantError.message };
    }

    // TODO: Log admin action
    // await logAdminAction('BADGE_GRANT_PROJECT', session.address, { projectId, badgeKey });

    revalidatePath('/admin/badges');
    return { success: true };
  } catch (error: any) {
    console.error('Grant project badge error:', error);
    return { success: false, error: error.message || 'Failed to grant badge' };
  }
}

/**
 * Revoke badge from project
 */
export async function revokeProjectBadge(
  projectBadgeId: string,
  reason: string
): Promise<ActionResult> {
  try {
    const session = await getServerSession();
    if (!session) {
      return { success: false, error: 'Not authenticated' };
    }

    if (!reason || reason.trim().length < 10) {
      return { success: false, error: 'Revocation reason required (min 10 chars)' };
    }

    const supabase = createClient();

    // Verify admin
    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('wallet_address', session.address)
      .single();

    if (!profile?.is_admin) {
      return { success: false, error: 'Unauthorized' };
    }

    // Delete badge (soft delete by updating metadata would be better, but schema doesn't have status field)
    // For now, we'll just delete and rely on audit log
    const { error: deleteError } = await supabase
      .from('project_badges')
      .delete()
      .eq('id', projectBadgeId);

    if (deleteError) {
      return { success: false, error: deleteError.message };
    }

    // TODO: Log admin action with reason
    // await logAdminAction('BADGE_REVOKE', session.address, { projectBadgeId, reason });

    revalidatePath('/admin/badges');
    return { success: true };
  } catch (error: any) {
    console.error('Revoke badge error:', error);
    return { success: false, error: error.message || 'Failed to revoke badge' };
  }
}

/**
 * Get badge instances (granted badges)
 */
export async function getBadgeInstances(filters?: {
  badgeType?: string;
  search?: string;
}): Promise<ActionResult> {
  try {
    const supabase = createClient();

    let query = supabase
      .from('project_badges')
      .select(
        `
        *,
        badge_definitions(badge_key, name, badge_type, icon_url),
        projects(id, name)
      `
      )
      .order('created_at', { ascending: false });

    // Apply filters if provided
    // Note: Filtering needs to be done client-side or via more complex queries

    const { data, error } = await query;

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, data };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to fetch badge instances' };
  }
}

/**
 * Get badge stats
 */
export async function getBadgeStats(): Promise<ActionResult> {
  try {
    const supabase = createClient();

    const [totalDefs, totalInstances, autoInstances, manualInstances] = await Promise.all([
      // Total badge definitions
      supabase.from('badge_definitions').select('id', { count: 'exact', head: true }),

      // Total badge instances
      supabase.from('project_badges').select('id', { count: 'exact', head: true }),

      // Auto-awarded (awarded_by is NULL)
      supabase
        .from('project_badges')
        .select('id', { count: 'exact', head: true })
        .is('awarded_by', null),

      // Manual (awarded_by is NOT NULL)
      supabase
        .from('project_badges')
        .select('id', { count: 'exact', head: true })
        .not('awarded_by', 'is', null),
    ]);

    return {
      success: true,
      data: {
        totalDefinitions: totalDefs.count || 0,
        totalInstances: totalInstances.count || 0,
        autoAwarded: autoInstances.count || 0,
        manualAwarded: manualInstances.count || 0,
      },
    };
  } catch (error: any) {
    return { success: false, error: error.message || 'Failed to fetch stats' };
  }
}
