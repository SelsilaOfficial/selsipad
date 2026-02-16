import { NextRequest, NextResponse } from 'next/server';
import {
    getAuditLogs,
    requireAdmin,
    errorResponse,
    successResponse
} from '@selsipad/shared';

/**
 * GET /api/admin/audit-logs
 * Get audit logs with filtering
 */
export async function GET(req: NextRequest) {
    try {
        const userId = req.headers.get('x-user-id');
        if (!userId) {
            return NextResponse.json(
                errorResponse('UNAUTHORIZED', 'Authentication required'),
                { status: 401 }
            );
        }

        await requireAdmin(userId);

        // Extract query params
        const url = new URL(req.url);
        const filters = {
            actor: url.searchParams.get('actor') || undefined,
            action: url.searchParams.get('action') || undefined,
            entityType: url.searchParams.get('entityType') || undefined,
            entityId: url.searchParams.get('entityId') || undefined,
            startDate: url.searchParams.get('startDate') || undefined,
            endDate: url.searchParams.get('endDate') || undefined,
            limit: parseInt(url.searchParams.get('limit') || '50'),
            offset: parseInt(url.searchParams.get('offset') || '0')
        };

        const { data, count } = await getAuditLogs(filters);

        return NextResponse.json(
            successResponse(
                { logs: data },
                {
                    total: count,
                    limit: filters.limit,
                    offset: filters.offset,
                    page: Math.floor(filters.offset / filters.limit) + 1
                }
            ),
            { status: 200 }
        );
    } catch (error: any) {
        console.error('[Audit Logs] Error:', error);
        return NextResponse.json(
            errorResponse('INTERNAL_ERROR', error.message || 'Failed to fetch audit logs'),
            { status: 500 }
        );
    }
}
