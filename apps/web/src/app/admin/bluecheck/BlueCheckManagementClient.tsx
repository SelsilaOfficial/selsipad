/**
 * Client Component: Blue Check Management UI
 *
 * Interactive UI for admin actions (grant, revoke, restore, ban)
 */

'use client';

import { useState } from 'react';
import { Card, CardContent, Button } from '@/components/ui';
import { useToast } from '@/components/ui';

interface BlueCheckManagementClientProps {
  recentPurchases: any[];
}

export function BlueCheckManagementClient({ recentPurchases }: BlueCheckManagementClientProps) {
  const { showToast } = useToast();
  const [targetUserId, setTargetUserId] = useState('');
  const [reason, setReason] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleGrant = async () => {
    if (!targetUserId || !reason) {
      showToast('error', 'Please provide user ID and reason');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/admin/bluecheck/grant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_user_id: targetUserId, reason }),
      });

      const data = await response.json();

      if (response.ok) {
        showToast('success', data.message);
        setTargetUserId('');
        setReason('');
      } else {
        showToast('error', data.error);
      }
    } catch (error) {
      showToast('error', 'Failed to grant Blue Check');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRevoke = async () => {
    if (!targetUserId || !reason) {
      showToast('error', 'Please provide user ID and reason');
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/admin/bluecheck/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_user_id: targetUserId, reason }),
      });

      const data = await response.json();

      if (response.ok) {
        showToast('success', data.message);
        setTargetUserId('');
        setReason('');
      } else {
        showToast('error', data.error);
      }
    } catch (error) {
      showToast('error', 'Failed to revoke Blue Check');
    } finally {
      setIsLoading(false);
    }
  };

  const handleBan = async () => {
    if (!targetUserId || !reason) {
      showToast('error', 'Please provide user ID and reason');
      return;
    }

    if (!confirm('Are you sure you want to BAN this user? This will remove their Blue Check.')) {
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/admin/bluecheck/ban', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_user_id: targetUserId, reason }),
      });

      const data = await response.json();

      if (response.ok) {
        showToast('success', data.message);
        setTargetUserId('');
        setReason('');
      } else {
        showToast('error', data.error);
      }
    } catch (error) {
      showToast('error', 'Failed to ban user');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Quick Actions */}
      <Card>
        <CardContent className="space-y-4">
          <h3 className="text-heading-md">Admin Actions</h3>

          <div className="space-y-3">
            <div>
              <label className="text-body-sm text-text-secondary mb-1 block">Target User ID</label>
              <input
                type="text"
                value={targetUserId}
                onChange={(e) => setTargetUserId(e.target.value)}
                placeholder="Enter user UUID"
                className="w-full p-2 bg-bg-elevated border border-border-subtle rounded-md text-text-primary"
              />
            </div>

            <div>
              <label className="text-body-sm text-text-secondary mb-1 block">Reason</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Enter reason for action"
                rows={3}
                className="w-full p-2 bg-bg-elevated border border-border-subtle rounded-md text-text-primary"
              />
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleGrant}
                disabled={isLoading}
                className="bg-success-main hover:bg-success-hover"
              >
                Grant Blue Check
              </Button>

              <Button
                onClick={handleRevoke}
                disabled={isLoading}
                className="bg-warning-main hover:bg-warning-hover"
              >
                Revoke
              </Button>

              <Button
                onClick={handleBan}
                disabled={isLoading}
                className="bg-error-main hover:bg-error-hover"
              >
                Ban User
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Recent Purchases */}
      <Card>
        <CardContent className="space-y-4">
          <h3 className="text-heading-md">Recent Purchases</h3>

          {recentPurchases.length === 0 ? (
            <p className="text-body-sm text-text-secondary">No recent purchases</p>
          ) : (
            <div className="space-y-2">
              {recentPurchases.map((purchase) => (
                <div
                  key={purchase.id}
                  className="flex items-center justify-between p-3 bg-bg-elevated rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    {purchase.target_user?.avatar_url ? (
                      <img
                        src={purchase.target_user.avatar_url}
                        alt={purchase.target_user.username}
                        className="w-10 h-10 rounded-full"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-primary-main flex items-center justify-center text-white font-semibold">
                        {purchase.target_user?.username?.[0]?.toUpperCase()}
                      </div>
                    )}
                    <div>
                      <p className="text-body-sm font-medium">{purchase.target_user?.username}</p>
                      <p className="text-caption text-text-secondary">
                        {new Date(purchase.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>

                  {purchase.tx_hash && (
                    <a
                      href={`${purchase.chain === '97' ? 'https://testnet.bscscan.com' : 'https://bscscan.com'}/tx/${purchase.tx_hash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-caption text-primary-main hover:underline"
                    >
                      View TX
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
