import { getServiceClient } from './rbac';
import { logAdminAction } from './audit-logging';

/**
 * Execute approved two-man rule actions
 * Called after an action is approved to actually perform the action
 */
export async function executeApprovedAction(
  actionId: string,
  executorId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = getServiceClient();

  // Get the action
  const { data: action, error: fetchError } = await supabase
    .from('admin_actions')
    .select('*')
    .eq('id', actionId)
    .single();

  if (fetchError || !action) {
    return { success: false, error: 'Action not found' };
  }

  // Only execute APPROVED actions
  if (action.status !== 'APPROVED') {
    return { success: false, error: `Action is ${action.status}, not APPROVED` };
  }

  const payload = action.payload;

  try {
    switch (action.type) {
      case 'ROLE_GRANT': {
        // Grant admin role
        const { target_user_id, role } = payload;

        const { error } = await supabase.from('admin_roles').insert({
          user_id: target_user_id,
          role,
          granted_by: executorId,
        });

        if (error) {
          return { success: false, error: `Failed to grant role: ${error.message}` };
        }

        // Audit log
        await logAdminAction({
          actor_admin_id: executorId,
          action: 'ROLE_GRANTED',
          entity_type: 'admin_role',
          entity_id: target_user_id,
          after_data: { role, via_two_man_rule: actionId },
        });

        break;
      }

      case 'ROLE_REVOKE': {
        // Revoke admin role
        const { target_user_id, role } = payload;

        const { error } = await supabase
          .from('admin_roles')
          .delete()
          .eq('user_id', target_user_id)
          .eq('role', role);

        if (error) {
          return { success: false, error: `Failed to revoke role: ${error.message}` };
        }

        // Audit log
        await logAdminAction({
          actor_admin_id: executorId,
          action: 'ROLE_REVOKED',
          entity_type: 'admin_role',
          entity_id: target_user_id,
          after_data: { role, via_two_man_rule: actionId },
        });

        break;
      }

      // Add more action types here as needed
      // case 'LP_UNLOCK': { ... }
      // case 'FEE_CHANGE': { ... }

      default:
        return { success: false, error: `Unknown action type: ${action.type}` };
    }

    // Mark action as EXECUTED
    await supabase
      .from('admin_actions')
      .update({
        status: 'EXECUTED',
        executed_at: new Date().toISOString(),
        execution_result: { success: true },
      })
      .eq('id', actionId);

    return { success: true };
  } catch (error: any) {
    // Mark as EXECUTED but with error
    await supabase
      .from('admin_actions')
      .update({
        status: 'EXECUTED',
        executed_at: new Date().toISOString(),
        execution_result: { success: false, error: error.message },
      })
      .eq('id', actionId);

    return { success: false, error: error.message };
  }
}
