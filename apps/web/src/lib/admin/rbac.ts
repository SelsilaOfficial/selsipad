import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * Get service role Supabase client untuk admin operations
 * Bypasses RLS for server-side admin operations
 */
export function getServiceClient() {
  return createClient(supabaseUrl, supabaseServiceKey);
}

/**
 * Check if user has specific permission
 * @param userId - User ID from profiles table
 * @param permission - Permission to check (e.g., 'kyc:view', 'badge:grant')
 * @returns true if user has permission, false otherwise
 */
export async function hasPermission(
  userId: string,
  permission: string
): Promise<boolean> {
  const supabase = getServiceClient();

  // Query user's roles and permissions
  const { data, error } = await supabase
    .from('admin_roles')
    .select(`
      role,
      admin_permissions!inner(permission)
    `)
    .eq('user_id', userId);

  if (error || !data || data.length === 0) {
    return false;
  }

  // Check if user has wildcard permission (super_admin)
  const hasWildcard = data.some((roleData: any) =>
    roleData.admin_permissions.some((p: any) => p.permission === '*')
  );

  if (hasWildcard) {
    return true;
  }

  // Check if user has specific permission
  const hasSpecificPermission = data.some((roleData: any) =>
    roleData.admin_permissions.some((p: any) => p.permission === permission)
  );

  return hasSpecificPermission;
}

/**
 * Get all roles for a user
 * @param userId - User ID from profiles table
 * @returns Array of role names
 */
export async function getUserRoles(userId: string): Promise<string[]> {
  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from('admin_roles')
    .select('role')
    .eq('user_id', userId);

  if (error || !data) {
    return [];
  }

  return data.map((r) => r.role);
}

/**
 * Get all permissions for a user (across all their roles)
 * @param userId - User ID from profiles table
 * @returns Array of unique permissions
 */
export async function getUserPermissions(userId: string): Promise<string[]> {
  const supabase = getServiceClient();

  const { data, error } = await supabase
    .from('admin_roles')
    .select(`
      role,
      admin_permissions!inner(permission)
    `)
    .eq('user_id', userId);

  if (error || !data) {
    return [];
  }

  // Flatten and deduplicate permissions
  const permissions = new Set<string>();
  
  data.forEach((roleData: any) => {
    roleData.admin_permissions.forEach((p: any) => {
      permissions.add(p.permission);
    });
  });

  return Array.from(permissions);
}

/**
 * Check if user has ANY of the specified permissions
 * Useful for OR-based permission checks
 * @param userId - User ID from profiles table
 * @param permissions - Array of permissions to check
 * @returns true if user has at least one permission
 */
export async function hasAnyPermission(
  userId: string,
  permissions: string[]
): Promise<boolean> {
  const userPermissions = await getUserPermissions(userId);
  
  // Check for wildcard
  if (userPermissions.includes('*')) {
    return true;
  }

  // Check if any permission matches
  return permissions.some((p) => userPermissions.includes(p));
}

/**
 * Check if user has ALL of the specified permissions
 * Useful for AND-based permission checks
 * @param userId - User ID from profiles table
 * @param permissions - Array of permissions to check
 * @returns true if user has all permissions
 */
export async function hasAllPermissions(
  userId: string,
  permissions: string[]
): Promise<boolean> {
  const userPermissions = await getUserPermissions(userId);
  
  // Wildcard covers everything
  if (userPermissions.includes('*')) {
    return true;
  }

  // Check if all permissions are present
  return permissions.every((p) => userPermissions.includes(p));
}

/**
 * Check if user is admin (has any admin role)
 * @param userId - User ID from profiles table
 * @returns true if user has at least one admin role
 */
export async function isAdmin(userId: string): Promise<boolean> {
  const roles = await getUserRoles(userId);
  return roles.length > 0;
}

/**
 * Check if user is super admin
 * @param userId - User ID from profiles table
 * @returns true if user has super_admin role
 */
export async function isSuperAdmin(userId: string): Promise<boolean> {
  const roles = await getUserRoles(userId);
  return roles.includes('super_admin');
}
