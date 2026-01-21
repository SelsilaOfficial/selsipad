'use client';

import { useState } from 'react';
import { Card, CardContent, ConfirmModal, ActionMenu, useToast, Button } from '@/components/ui';
import type { MenuItem } from '@/components/ui';
import { PageHeader, PageContainer, BottomSheet } from '@/components/layout';
import {
  setPrimaryWalletAction,
  removeWalletAction,
  addWalletAction,
  type Wallet,
} from './actions';

interface WalletManagementClientProps {
  initialWallets: Wallet[];
}

export function WalletManagementClient({ initialWallets }: WalletManagementClientProps) {
  const [wallets, setWallets] = useState<Wallet[]>(initialWallets);
  const [addSheetOpen, setAddSheetOpen] = useState(false);
  const [removeModalOpen, setRemoveModalOpen] = useState(false);
  const [selectedWallet, setSelectedWallet] = useState<Wallet | null>(null);
  const [newWalletAddress, setNewWalletAddress] = useState('');
  const [newWalletNetwork, setNewWalletNetwork] = useState<'SOL' | 'EVM'>('SOL');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { showToast } = useToast();

  const handleSetPrimary = async (walletId: string) => {
    try {
      await setPrimaryWalletAction(walletId);
      setWallets(
        wallets.map((w) => ({
          ...w,
          is_primary: w.id === walletId,
        }))
      );
      showToast('success', 'Primary wallet updated');
    } catch (error) {
      showToast('error', 'Failed to set primary wallet');
    }
  };

  const handleRemove = async () => {
    if (!selectedWallet) return;

    setIsSubmitting(true);
    try {
      await removeWalletAction(selectedWallet.id);
      setWallets(wallets.filter((w) => w.id !== selectedWallet.id));
      showToast('success', 'Wallet removed');
      setRemoveModalOpen(false);
      setSelectedWallet(null);
    } catch (error) {
      showToast('error', 'Failed to remove wallet');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddWallet = async () => {
    if (!newWalletAddress) {
      showToast('error', 'Please enter wallet address');
      return;
    }

    setIsSubmitting(true);
    try {
      const newWallet = await addWalletAction(newWalletAddress, newWalletNetwork);
      setWallets([...wallets, newWallet]);
      showToast('success', 'Wallet added successfully');
      setAddSheetOpen(false);
      setNewWalletAddress('');
    } catch (error) {
      showToast('error', 'Failed to add wallet');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getMenuItems = (wallet: Wallet): MenuItem[] => {
    const items: MenuItem[] = [];

    if (!wallet.is_primary) {
      items.push({
        id: 'set-primary',
        label: 'Set as Primary',
        onClick: () => handleSetPrimary(wallet.id),
      });
    }

    items.push({
      id: 'remove',
      label: 'Remove Wallet',
      onClick: () => {
        setSelectedWallet(wallet);
        setRemoveModalOpen(true);
      },
      variant: 'danger',
      disabled: wallet.is_primary,
    });

    return items;
  };

  return (
    <div className="min-h-screen bg-bg-page pb-20">
      <PageHeader
        showBack
        title="Wallet Management"
        actions={
          <button
            onClick={() => setAddSheetOpen(true)}
            className="p-2 text-primary-main hover:bg-bg-elevated rounded-md transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
          </button>
        }
      />

      <PageContainer className="py-4 space-y-4">
        {/* Wallet List */}
        {wallets.map((wallet) => (
          <Card
            key={wallet.id}
            variant={wallet.is_primary ? 'bordered' : 'default'}
            className={wallet.is_primary ? 'border-l-4 border-primary-main' : ''}
          >
            <CardContent>
              <div className="flex items-start justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="text-heading-sm font-mono truncate">{wallet.address}</h3>
                    {wallet.is_primary && (
                      <span className="px-2 py-0.5 bg-primary-soft/20 text-primary-main text-caption rounded-full border border-primary-main/30 flex-shrink-0">
                        Primary
                      </span>
                    )}
                    {wallet.wallet_role === 'PRIMARY' && (
                      <span className="px-2 py-0.5 bg-success-soft/20 text-success-main text-caption rounded-full border border-success-main/30 flex-shrink-0">
                        Identity
                      </span>
                    )}
                    {wallet.wallet_role === 'SECONDARY' && (
                      <span className="px-2 py-0.5 bg-bg-elevated text-text-secondary text-caption rounded-full border border-border-subtle flex-shrink-0">
                        Feature Wallet
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 bg-bg-elevated text-text-secondary text-caption rounded-full">
                      {wallet.network}
                    </span>
                    {wallet.label && (
                      <span className="text-caption text-text-tertiary">{wallet.label}</span>
                    )}
                  </div>
                </div>

                <ActionMenu items={getMenuItems(wallet)} />
              </div>
            </CardContent>
          </Card>
        ))}

        {/* Info Note */}
        <Card variant="bordered" className="border-l-4 border-status-info-text">
          <CardContent>
            <div className="space-y-2">
              <p className="text-body-sm text-text-secondary">
                💡 <strong>Identity Wallet (EVM):</strong> Your primary wallet for login, profile,
                and transactions. Cannot be removed.
              </p>
              <p className="text-body-sm text-text-secondary">
                💡 <strong>Feature Wallets (Solana):</strong> Additional wallets for chain-specific
                features like Bonding Curve. Can be removed anytime.
              </p>
            </div>
          </CardContent>
        </Card>
      </PageContainer>

      {/* Add Wallet Bottom Sheet */}
      <BottomSheet isOpen={addSheetOpen} onClose={() => setAddSheetOpen(false)} title="Add Wallet">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-text-primary mb-2">
              Select Network
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(['SOL', 'EVM'] as const).map((network) => (
                <button
                  key={network}
                  onClick={() => setNewWalletNetwork(network)}
                  className={`px-4 py-3 rounded-md text-body-sm font-medium transition-colors ${
                    newWalletNetwork === network
                      ? 'bg-primary-main text-primary-text'
                      : 'bg-bg-card border border-border-subtle text-text-primary hover:border-primary-main'
                  }`}
                >
                  {network}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-text-primary mb-2">
              Wallet Address
            </label>
            <input
              type="text"
              placeholder="Enter wallet address..."
              value={newWalletAddress}
              onChange={(e) => setNewWalletAddress(e.target.value)}
              className="w-full bg-bg-input border border-border-subtle rounded-md px-4 py-2 text-text-primary placeholder:text-text-tertiary focus:border-primary-main focus:ring-2 focus:ring-primary-main/20 transition-all font-mono text-sm"
            />
            <p className="text-caption text-text-tertiary mt-1">
              You'll need to sign a message to verify ownership
            </p>
          </div>

          <Button
            className="w-full"
            onClick={handleAddWallet}
            isLoading={isSubmitting}
            disabled={!newWalletAddress}
          >
            Connect & Verify
          </Button>
        </div>
      </BottomSheet>

      {/* Remove Confirmation Modal */}
      <ConfirmModal
        isOpen={removeModalOpen}
        onClose={() => setRemoveModalOpen(false)}
        onConfirm={handleRemove}
        title="Remove Wallet"
        description={`Are you sure you want to remove ${selectedWallet?.address}? This action cannot be undone.`}
        confirmText="Remove"
        variant="danger"
        isLoading={isSubmitting}
      />
    </div>
  );
}
