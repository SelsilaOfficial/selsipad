import { NextRequest, NextResponse } from 'next/server';
import {
    requestAction,
    requireRole,
    errorResponse,
    successResponse
} from '@selsipad/shared';

/**
 * POST /api/admin/actions/request
 * Request a two-man rule action
 */
export async function POST(req: NextRequest) {
    try {
        const userId = req.headers.get('x-user-id');
        if (!userId) {
            return NextResponse.json(
                errorResponse('UNAUTHORIZED', 'Authentication required'),
                { status: 401 }
            );
        }

        const { type, payload, expiresInHours } = await req.json();

        if (!type || !payload) {
            return NextResponse.json(
                errorResponse('INVALID_INPUT', 'type and payload are required'),
                { status: 400 }
            );
        }

        // Check role permissions based on action type
        const roleRequirements: Record<string, string[]> = {
            role_grant: ['super_admin'],
            role_revoke: ['super_admin'],
            payout: ['finance'],
            fee_change: ['super_admin', 'finance'],
            scan_override: ['super_admin', 'reviewer']
        };

        const requiredRoles = roleRequirements[type];
        if (requiredRoles) {
            try {
                await requireRole(userId, requiredRoles);
            } catch (error: any) {
                return NextResponse.json(
                    errorResponse('INSUFFICIENT_PERMISSIONS', error.message),
                    { status: 403 }
                );
            }
        }

        // Create action request
        const action = await requestAction({
            type,
            payload,
            requestedBy: userId,
            expiresInHours
        });

        return NextResponse.json(
            successResponse({ action }),
            { status: 201 }
        );
    } catch (error: any) {
        console.error('[Action Request] Error:', error);
        return NextResponse.json(
            errorResponse('INTERNAL_ERROR', error.message || 'Failed to create action'),
            { status: 500 }
        );
    }
}

/**
 * GET /api/admin/actions
 * Get pending actions (approval queue)
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

        // Must be admin
        try {
            await requireRole(userId, ['super_admin', 'reviewer', 'ops', 'finance', 'support']);
        } catch {
            return NextResponse.json(
                errorResponse('FORBIDDEN', 'Admin access required'),
                { status: 403 }
            );
        }

        const { getPendingActions } = await import('@selsipad/shared');

        // Get filters from query params
        const url = new URL(req.url);
        const type = url.searchParams.get('type') || undefined;

        const actions = await getPendingActions({ type });

        return NextResponse.json(
            successResponse({ actions, count: actions.length }),
            { status: 200 }
        );
    } catch (error: any) {
        console.error('[Get Actions] Error:', error);
        return NextResponse.json(
            errorResponse('INTERNAL_ERROR', error.message),
            { status: 500 }
        );
    }
}
