'use client';

import { useState } from 'react';
import { ConfirmModal, useToast, Button } from '@/components/ui';
import { BottomSheet } from '@/components/layout';
import { AnimatedBackground } from '@/components/home/figma/AnimatedBackground';
import {
  ArrowLeft,
  Plus,
  Wallet,
  Star,
  Trash2,
  Copy,
  CheckCircle,
  Shield,
  Link2,
  Info,
  ChevronDown,
  MoreVertical,
} from 'lucide-react';
import {
  setPrimaryWalletAction,
  removeWalletAction,
  linkSolanaWalletAction,
  type Wallet as WalletType,
} from './actions';

interface WalletManagementClientProps {
  initialWallets: WalletType[];
}

export function WalletManagementClient({ initialWallets }: WalletManagementClientProps) {
  const [wallets, setWallets] = useState<WalletType[]>(initialWallets);
  const [addSheetOpen, setAddSheetOpen] = useState(false);
  const [removeModalOpen, setRemoveModalOpen] = useState(false);
  const [selectedWallet, setSelectedWallet] = useState<WalletType | null>(null);
  const [newWalletAddress, setNewWalletAddress] = useState('');
  const [newWalletNetwork, setNewWalletNetwork] = useState<'SOL' | 'EVM'>('SOL');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
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
    setOpenMenuId(null);
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
      // For Solana wallets, use the link action
      // Note: In a real flow, signature verification would happen client-side first
      await linkSolanaWalletAction(newWalletAddress, '', '');
      // Refresh the page to get updated wallet list
      window.location.reload();
    } catch (error: any) {
      showToast('error', error?.message || 'Failed to add wallet');
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyAddress = (id: string, address: string) => {
    navigator.clipboard.writeText(address);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const primaryWallet = wallets.find((w) => w.is_primary);
  const otherWallets = wallets.filter((w) => !w.is_primary);

  return (
    <div className="min-h-screen bg-black text-white dark relative overflow-hidden">
      {/* Animated Background */}
      <AnimatedBackground />
      <div className="fixed inset-0 bg-black/30 pointer-events-none z-[1]" />

      {/* Content Layer */}
      <div className="relative z-10">
        {/* Sticky Header */}
        <header className="sticky top-0 z-50 backdrop-blur-xl bg-black/60 border-b border-[#39AEC4]/20">
          <div className="container mx-auto px-4 sm:px-6 py-3 sm:py-4 max-w-3xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => window.history.back()}
                  className="p-2 rounded-full hover:bg-[#39AEC4]/10 transition-colors"
                >
                  <ArrowLeft className="w-5 h-5 text-[#39AEC4]" />
                </button>
                <div>
                  <h1 className="text-lg sm:text-xl font-bold">Wallet Management</h1>
                  <p className="text-xs text-gray-400">Manage your connected wallets</p>
                </div>
              </div>

              <button
                onClick={() => setAddSheetOpen(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-[#39AEC4] to-[#756BBA] hover:from-[#4EABC8] hover:to-[#756BBA] transition-all shadow-lg shadow-[#756BBA]/30 font-semibold text-sm"
              >
                <Plus className="w-4 h-4" />
                Add Wallet
              </button>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="container mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-24 md:pb-12 max-w-3xl space-y-6">
          {/* Overview Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
            <div className="rounded-[16px] bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl border border-[#39AEC4]/20 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Wallet className="w-4 h-4 text-[#39AEC4]" />
                <span className="text-xs text-gray-400">Total Wallets</span>
              </div>
              <p className="text-2xl font-bold">{wallets.length}</p>
            </div>
            <div className="rounded-[16px] bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl border border-[#39AEC4]/20 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Link2 className="w-4 h-4 text-[#756BBA]" />
                <span className="text-xs text-gray-400">Networks</span>
              </div>
              <p className="text-2xl font-bold">{new Set(wallets.map((w) => w.network)).size}</p>
            </div>
            <div className="col-span-2 sm:col-span-1 rounded-[16px] bg-gradient-to-br from-[#39AEC4]/10 to-[#756BBA]/10 backdrop-blur-xl border border-[#39AEC4]/30 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="w-4 h-4 text-[#39AEC4]" />
                <span className="text-xs text-gray-400">Primary</span>
              </div>
              <p className="text-sm font-mono truncate text-[#39AEC4]">
                {primaryWallet
                  ? `${primaryWallet.address.slice(0, 6)}...${primaryWallet.address.slice(-4)}`
                  : 'None'}
              </p>
            </div>
          </div>

          {/* Primary Wallet */}
          {primaryWallet && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Star className="w-4 h-4 text-[#39AEC4]" />
                <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
                  Primary Wallet
                </h2>
              </div>
              <WalletCard
                wallet={primaryWallet}
                isPrimary
                onCopy={copyAddress}
                copiedId={copiedId}
                onSetPrimary={handleSetPrimary}
                onRemove={(w) => {
                  setSelectedWallet(w);
                  setRemoveModalOpen(true);
                }}
                openMenuId={openMenuId}
                setOpenMenuId={setOpenMenuId}
              />
            </section>
          )}

          {/* Other Wallets */}
          {otherWallets.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-3">
                <Wallet className="w-4 h-4 text-[#756BBA]" />
                <h2 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">
                  Feature Wallets
                </h2>
              </div>
              <div className="space-y-3">
                {otherWallets.map((wallet) => (
                  <WalletCard
                    key={wallet.id}
                    wallet={wallet}
                    isPrimary={false}
                    onCopy={copyAddress}
                    copiedId={copiedId}
                    onSetPrimary={handleSetPrimary}
                    onRemove={(w) => {
                      setSelectedWallet(w);
                      setRemoveModalOpen(true);
                    }}
                    openMenuId={openMenuId}
                    setOpenMenuId={setOpenMenuId}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Empty State */}
          {wallets.length === 0 && (
            <div className="rounded-[20px] bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl border border-[#39AEC4]/20 p-12 text-center">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-[#39AEC4]/20 to-[#756BBA]/20 border border-[#39AEC4]/30 flex items-center justify-center">
                <Wallet className="w-8 h-8 text-[#39AEC4]" />
              </div>
              <h3 className="text-lg font-bold mb-2">No Wallets Connected</h3>
              <p className="text-gray-400 text-sm mb-6">Connect your first wallet to get started</p>
              <button
                onClick={() => setAddSheetOpen(true)}
                className="px-6 py-3 rounded-full bg-gradient-to-r from-[#39AEC4] to-[#756BBA] hover:from-[#4EABC8] hover:to-[#756BBA] transition-all shadow-lg shadow-[#756BBA]/30 font-semibold text-sm"
              >
                <Plus className="w-4 h-4 inline mr-2" />
                Add Wallet
              </button>
            </div>
          )}

          {/* Info Cards */}
          <div className="space-y-3">
            <div className="rounded-[16px] bg-gradient-to-br from-[#39AEC4]/5 to-transparent backdrop-blur-sm border border-[#39AEC4]/15 p-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-full bg-[#39AEC4]/10 flex-shrink-0 mt-0.5">
                  <Shield className="w-4 h-4 text-[#39AEC4]" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white mb-1">Identity Wallet (EVM)</p>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    Your primary wallet for login, profile, and transactions. Cannot be removed.
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-[16px] bg-gradient-to-br from-[#756BBA]/5 to-transparent backdrop-blur-sm border border-[#756BBA]/15 p-4">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-full bg-[#756BBA]/10 flex-shrink-0 mt-0.5">
                  <Link2 className="w-4 h-4 text-[#756BBA]" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-white mb-1">Feature Wallets (Solana)</p>
                  <p className="text-xs text-gray-400 leading-relaxed">
                    Additional wallets for chain-specific features like Bonding Curve. Can be
                    removed anytime.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      {/* Add Wallet Bottom Sheet */}
      <BottomSheet isOpen={addSheetOpen} onClose={() => setAddSheetOpen(false)} title="Add Wallet">
        <div className="space-y-5">
          <div>
            <label className="block text-sm font-semibold text-white mb-3">Select Network</label>
            <div className="grid grid-cols-2 gap-3">
              {(['SOL', 'EVM'] as const).map((network) => (
                <button
                  key={network}
                  onClick={() => setNewWalletNetwork(network)}
                  className={`px-4 py-3.5 rounded-[14px] text-sm font-semibold transition-all ${
                    newWalletNetwork === network
                      ? 'bg-gradient-to-r from-[#39AEC4] to-[#756BBA] text-white shadow-lg shadow-[#756BBA]/30'
                      : 'bg-white/5 border border-white/10 text-gray-300 hover:border-[#39AEC4]/30'
                  }`}
                >
                  {network === 'SOL' ? '◎ Solana' : '⬡ EVM'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-white mb-2">Wallet Address</label>
            <input
              type="text"
              placeholder="Enter wallet address..."
              value={newWalletAddress}
              onChange={(e) => setNewWalletAddress(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-[14px] px-4 py-3 text-white placeholder:text-gray-500 focus:border-[#39AEC4]/50 focus:ring-2 focus:ring-[#39AEC4]/20 transition-all font-mono text-sm outline-none"
            />
            <p className="text-xs text-gray-500 mt-2">
              You'll need to sign a message to verify ownership
            </p>
          </div>

          <button
            onClick={handleAddWallet}
            disabled={!newWalletAddress || isSubmitting}
            className="w-full py-3.5 rounded-[14px] bg-gradient-to-r from-[#39AEC4] to-[#756BBA] hover:from-[#4EABC8] hover:to-[#756BBA] transition-all shadow-lg shadow-[#756BBA]/30 font-semibold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? 'Connecting...' : 'Connect & Verify'}
          </button>
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

/* ---------- Wallet Card Sub-Component ---------- */
function WalletCard({
  wallet,
  isPrimary,
  onCopy,
  copiedId,
  onSetPrimary,
  onRemove,
  openMenuId,
  setOpenMenuId,
}: {
  wallet: WalletType;
  isPrimary: boolean;
  onCopy: (id: string, address: string) => void;
  copiedId: string | null;
  onSetPrimary: (id: string) => void;
  onRemove: (w: WalletType) => void;
  openMenuId: string | null;
  setOpenMenuId: (id: string | null) => void;
}) {
  const isMenuOpen = openMenuId === wallet.id;

  return (
    <div
      className={`rounded-[20px] bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl overflow-hidden transition-all duration-300 hover:shadow-lg ${
        isPrimary
          ? 'border border-[#39AEC4]/40 shadow-md shadow-[#39AEC4]/10'
          : 'border border-white/10 hover:border-[#756BBA]/30'
      }`}
    >
      {/* Accent top glow for primary */}
      {isPrimary && <div className="h-[2px] bg-gradient-to-r from-[#39AEC4] to-[#756BBA]" />}

      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          {/* Wallet Info */}
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {/* Avatar */}
            <div
              className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center flex-shrink-0 ${
                isPrimary
                  ? 'bg-gradient-to-br from-[#39AEC4] to-[#756BBA]'
                  : 'bg-gradient-to-br from-white/10 to-white/5 border border-white/10'
              }`}
            >
              <Wallet
                className={`w-5 h-5 sm:w-6 sm:h-6 ${isPrimary ? 'text-white' : 'text-gray-400'}`}
              />
            </div>

            <div className="flex-1 min-w-0">
              {/* Address + Copy */}
              <div className="flex items-center gap-2 mb-1.5">
                <h3 className="text-sm sm:text-base font-mono truncate text-white">
                  {wallet.address.slice(0, 8)}...{wallet.address.slice(-6)}
                </h3>
                <button
                  onClick={() => onCopy(wallet.id, wallet.address)}
                  className="p-1 rounded-md hover:bg-white/10 transition-colors flex-shrink-0"
                >
                  {copiedId === wallet.id ? (
                    <CheckCircle className="w-3.5 h-3.5 text-green-400" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-gray-500" />
                  )}
                </button>
              </div>

              {/* Badges */}
              <div className="flex flex-wrap items-center gap-1.5">
                {/* Network badge */}
                <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white/10 text-gray-300 border border-white/5">
                  {wallet.network}
                </span>

                {isPrimary && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#39AEC4]/15 text-[#39AEC4] border border-[#39AEC4]/30">
                    ★ Primary
                  </span>
                )}

                {wallet.wallet_role === 'PRIMARY' && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-green-500/15 text-green-400 border border-green-500/30">
                    Identity
                  </span>
                )}

                {wallet.wallet_role === 'SECONDARY' && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#756BBA]/15 text-[#756BBA] border border-[#756BBA]/30">
                    Feature
                  </span>
                )}

                {wallet.label && <span className="text-[10px] text-gray-500">{wallet.label}</span>}
              </div>
            </div>
          </div>

          {/* Actions Menu */}
          <div className="relative flex-shrink-0">
            <button
              onClick={() => setOpenMenuId(isMenuOpen ? null : wallet.id)}
              className="p-2 rounded-full hover:bg-white/10 transition-colors"
            >
              <MoreVertical className="w-4 h-4 text-gray-400" />
            </button>

            {isMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setOpenMenuId(null)} />
                <div className="absolute right-0 top-full mt-1 z-50 w-48 rounded-[14px] bg-gray-900/95 backdrop-blur-xl border border-white/10 shadow-2xl shadow-black/50 overflow-hidden">
                  {!isPrimary && (
                    <button
                      onClick={() => onSetPrimary(wallet.id)}
                      className="w-full px-4 py-2.5 text-left text-sm text-white hover:bg-white/10 transition-colors flex items-center gap-2"
                    >
                      <Star className="w-4 h-4 text-[#39AEC4]" />
                      Set as Primary
                    </button>
                  )}
                  <button
                    onClick={() => {
                      onRemove(wallet);
                      setOpenMenuId(null);
                    }}
                    disabled={wallet.wallet_role === 'PRIMARY'}
                    className="w-full px-4 py-2.5 text-left text-sm text-red-400 hover:bg-red-500/10 transition-colors flex items-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <Trash2 className="w-4 h-4" />
                    Remove Wallet
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
