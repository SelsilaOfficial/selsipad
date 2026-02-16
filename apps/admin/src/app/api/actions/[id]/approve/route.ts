import { NextRequest, NextResponse } from 'next/server';
import {
    approveOrRejectAction,
    requireAdmin,
    errorResponse,
    successResponse,
    extractIdempotencyKey,
    withIdempotency
} from '@selsipad/shared';

/**
 * POST /api/admin/actions/[id]/approve
 * Approve or reject a two-man rule action
 */
export async function POST(
    req: NextRequest,
    { params }: { params: { id: string } }
) {
    try {
        const userId = req.headers.get('x-user-id');
        if (!userId) {
            return NextResponse.json(
                errorResponse('UNAUTHORIZED', 'Authentication required'),
                { status: 401 }
            );
        }

        await requireAdmin(userId);

        const { decision, reason } = await req.json();
        const actionId = params.id;

        if (!decision || !['APPROVE', 'REJECT'].includes(decision)) {
            return NextResponse.json(
                errorResponse('INVALID_INPUT', 'decision must be APPROVE or REJECT'),
                { status: 400 }
            );
        }

        // Extract idempotency key (critical for approvals)
        const idempotencyKey = extractIdempotencyKey(req.headers);
        if (!idempotencyKey) {
            return NextResponse.json(
                errorResponse('IDEMPOTENCY_KEY_REQUIRED', 'Idempotency-Key header is required for approvals'),
                { status: 400 }
            );
        }

        // Execute with idempotency
        await withIdempotency(
            `action-approval:${actionId}:${idempotencyKey}`,
            async () => {
                await approveOrRejectAction({
                    actionId,
                    approvedBy: userId,
                    decision,
                    reason
                });
            }
        );

        return NextResponse.json(
            successResponse({
                success: true,
                action_id: actionId,
                decision
            }),
            { status: 200 }
        );
    } catch (error: any) {
        console.error('[Action Approve] Error:', error);

        if (error.message.includes('CANNOT_APPROVE_OWN_REQUEST')) {
            return NextResponse.json(
                errorResponse('SELF_APPROVAL_DENIED', 'Cannot approve your own request'),
                { status: 403 }
            );
        }

        if (error.message.includes('ACTION_NOT_PENDING')) {
            return NextResponse.json(
                errorResponse('ACTION_NOT_PENDING', 'Action is not pending approval'),
                { status: 400 }
            );
        }

        return NextResponse.json(
            errorResponse('INTERNAL_ERROR', error.message || 'Failed to process approval'),
            { status: 500 }
        );
    }
}
