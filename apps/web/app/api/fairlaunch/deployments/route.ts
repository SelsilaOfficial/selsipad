/**
 * GET /api/fairlaunch/deployments
 * 
 * Monitoring API for deployment pipeline
 * Returns list of deployments with status tracking
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Query parameters
    const status = searchParams.get('status'); // deployment_status filter
    const chainId = searchParams.get('chainId');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Build query
    let query = supabase
      .from('deployment_pipeline')
      .select('*', { count: 'exact' });

    // Apply filters
    if (status) {
      query = query.eq('deployment_status', status);
    }
    if (chainId) {
      query = query.eq('chain', chainId);
    }

    // Apply pagination
    query = query
      .range(offset, offset + limit - 1)
      .order('created_at', { ascending: false });

    const { data, error, count } = await query;

    if (error) {
      console.error('Query error:', error);
      return NextResponse.json(
        { error: 'Failed to fetch deployments', details: error.message },
        { status: 500 }
      );
    }

    // Calculate statistics
    const stats = await getDeploymentStats();

    return NextResponse.json({
      deployments: data || [],
      pagination: {
        total: count || 0,
        limit,
        offset,
        hasMore: (count || 0) > offset + limit,
      },
      stats,
    });
  } catch (error: any) {
    console.error('Deployment monitoring error:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * Get deployment statistics
 */
async function getDeploymentStats() {
  try {
    // Get counts by status
    const { data: statusCounts } = await supabase
      .from('launch_rounds')
      .select('deployment_status')
      .not('deployment_status', 'eq', 'NOT_DEPLOYED');

    // Get verification counts
    const { data: verificationCounts } = await supabase
      .from('launch_rounds')
      .select('verification_status')
      .not('deployment_status', 'eq', 'NOT_DEPLOYED');

    // Count by deployment status
    const deploymentStats = (statusCounts || []).reduce((acc, row) => {
      const status = row.deployment_status || 'UNKNOWN';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Count by verification status
    const verificationStats = (verificationCounts || []).reduce((acc, row) => {
      const status = row.verification_status || 'NOT_VERIFIED';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Get recent deployment count (last 24 hours)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { count: recentCount } = await supabase
      .from('launch_rounds')
      .select('*', { count: 'exact', head: true })
      .not('deployment_status', 'eq', 'NOT_DEPLOYED')
      .gte('deployed_at', oneDayAgo);

    return {
      total: statusCounts?.length || 0,
      recent24h: recentCount || 0,
      byDeploymentStatus: deploymentStats,
      byVerificationStatus: verificationStats,
    };
  } catch (error) {
    console.error('Stats calculation error:', error);
    return {
      total: 0,
      recent24h: 0,
      byDeploymentStatus: {},
      byVerificationStatus: {},
    };
  }
}
