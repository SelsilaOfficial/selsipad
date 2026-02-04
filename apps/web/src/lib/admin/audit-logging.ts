import { getServiceClient } from './rbac';

export interface AuditLogEntry {
  actor_admin_id: string;
  action: string;
  entity_type: string;
  entity_id: string;
  before_data?: any;
  after_data?: any;
  ip_address?: string | null;
  user_agent?: string | null;
}

/**
 * Log admin action to audit_logs table
 * All admin actions MUST be logged for compliance
 * 
 * @param entry - Audit log entry data
 * @returns Success boolean
 */
export async function logAdminAction(entry: AuditLogEntry): Promise<boolean> {
  const supabase = getServiceClient();

  const { error } = await supabase.from('admin_audit_logs').insert({
    actor_admin_id: entry.actor_admin_id,
    action: entry.action,
    entity_type: entry.entity_type,
    entity_id: entry.entity_id,
    before_data: entry.before_data || null,
    after_data: entry.after_data || null,
    ip_address: entry.ip_address || null,
    user_agent: entry.user_agent || null,
    created_at: new Date().toISOString(),
  });

  if (error) {
    console.error('[Audit Log] Failed to log action:', error);
    return false;
  }

  return true;
}

/**
 * Extract IP address from Next.js request
 * @param request - NextRequest object
 * @returns IP address string or null
 */
export function getClientIP(request: Request): string | null {
  // Try various headers (depending on deployment setup)
  const headers = request.headers;
  
  return (
    headers.get('x-real-ip') ||
    headers.get('x-forwarded-for')?.split(',')[0] ||
    headers.get('cf-connecting-ip') || // Cloudflare
    null
  );
}

/**
 * Extract user agent from request
 * @param request - NextRequest object
 * @returns User agent string or null
 */
export function getUserAgent(request: Request): string | null {
  return request.headers.get('user-agent');
}
