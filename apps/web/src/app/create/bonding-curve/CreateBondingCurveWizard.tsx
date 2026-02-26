'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ArrowRight, Zap, CheckCircle2, AlertCircle, Upload, X, Globe, Twitter, MessageCircle, Image as ImageIcon } from 'lucide-react';
import { z } from 'zod';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, usePublicClient } from 'wagmi';
import { parseEther, parseAbi, decodeEventLog } from 'viem';

// Ensure this matches your deployment
const FACTORY_ADDRESS = '0x8572CF00E6a91D54cEAF009bd4cbbEC8CCA41F4b';
const CREATE_FEE = '0.05'; // 0.05 BNB

const FACTORY_ABI = parseAbi([
  'function launchToken(string _name, string _symbol, address _referrer) external payable',
  'event TokenLaunched(address indexed tokenAddress, string name, string symbol, address indexed creator)',
]);

const bondingCurveBasicsSchema = z.object({
  name: z.string().min(3, 'Min 3 characters').max(50, 'Max 50 characters'),
  symbol: z.string().min(2, 'Min 2 characters').max(10, 'Max 10 characters'),
  description: z.string().min(10, 'Min 10 characters'),
});

interface CreateBondingCurveWizardProps {
  walletAddress: string;
}

const STORAGE_KEY = 'wizard:bondingcurve:v2:evm';

const BONDING_CURVE_STEPS = [
  { id: 1, name: 'Token Info', description: 'Name, logo & banner' },
  { id: 2, name: 'Social Links', description: 'Website & socials' },
  { id: 3, name: 'Review', description: 'Confirm details' },
  { id: 4, name: 'Deploy', description: 'Create pool' },
];

export function CreateBondingCurveWizard({ walletAddress }: CreateBondingCurveWizardProps) {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient();
  const [currentStep, setCurrentStep] = useState(1);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [errors, setErrors] = useState<any>({});
  const [isSavingMetadata, setIsSavingMetadata] = useState(false);

  // Logo & Banner previews
  const [logoPreview, setLogoPreview] = useState<string>('');
  const [bannerPreview, setBannerPreview] = useState<string>('');
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  const [wizardData, setWizardData] = useState({
    basics: {
      name: '',
      symbol: '',
      description: '',
    },
    socials: {
      website: '',
      twitter: '',
      telegram: '',
    },
    referrer: '0x0000000000000000000000000000000000000000',
  });

  // Wagmi hooks
  const { writeContract, data: txHash, isPending: isTxPending, error: txError } = useWriteContract();
  const { isLoading: isTxConfirming, isSuccess: isTxSuccess } = useWaitForTransactionReceipt({
    hash: txHash,
  });

  // Load referrer from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref');
    if (ref && /^0x[a-fA-F0-9]{40}$/.test(ref)) {
      setWizardData(prev => ({ ...prev, referrer: ref }));
    }
  }, []);

  // Load draft
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setWizardData(prev => ({
            ...parsed,
            referrer: prev.referrer !== '0x0000000000000000000000000000000000000000'
              ? prev.referrer
              : parsed.referrer,
          }));
        } catch (e) {
          console.error('Failed to load draft:', e);
        }
      }
    }
  }, []);

  // Save draft (don't save files — just text data)
  useEffect(() => {
    if (wizardData.basics?.name) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(wizardData));
    }
  }, [wizardData]);

  // After tx confirms → upload images & save metadata to Supabase
  useEffect(() => {
    if (!isTxSuccess || !txHash) return;

    async function saveMetadata() {
      setIsSavingMetadata(true);
      try {
        const { createClient } = await import('@/lib/supabase/client');
        const supabase = createClient();

        // ── Step 1: Extract token address from tx receipt logs ──
        let tokenAddress = '';
        try {
          if (publicClient) {
            const receipt = await publicClient.getTransactionReceipt({ hash: txHash! });
            console.log('[Wizard] Got receipt with', receipt.logs.length, 'logs');
            for (const log of receipt.logs) {
              try {
                const decoded = decodeEventLog({
                  abi: FACTORY_ABI,
                  data: log.data,
                  topics: log.topics,
                });
                if (decoded.eventName === 'TokenLaunched') {
                  tokenAddress = (decoded.args as any).tokenAddress.toLowerCase();
                  console.log('[Wizard] Extracted token address:', tokenAddress);
                  break;
                }
              } catch { /* skip non-matching logs */ }
            }
          }
        } catch (err) {
          console.warn('[Wizard] Failed to get tx receipt:', err);
        }

        // ── Step 2: Fallback — find pool by creator wallet + token name ──
        if (!tokenAddress) {
          console.log('[Wizard] Log decode failed, using DB fallback lookup...');
          // Wait for indexer to create the row
          for (let attempt = 0; attempt < 6; attempt++) {
            await new Promise(r => setTimeout(r, 3000));
            const { data: pool } = await supabase
              .from('bonding_pools')
              .select('token_address')
              .eq('creator_wallet', address?.toLowerCase() || '')
              .eq('token_name', wizardData.basics.name)
              .order('created_at', { ascending: false })
              .limit(1)
              .single();
            if (pool?.token_address) {
              tokenAddress = pool.token_address.toLowerCase();
              console.log('[Wizard] Found token via fallback:', tokenAddress);
              break;
            }
            console.log(`[Wizard] Waiting for indexer... attempt ${attempt + 1}/6`);
          }
        }

        if (!tokenAddress) {
          console.error('[Wizard] Could not find token address. Metadata will not be saved.');
          return;
        }

        // ── Step 3: Upload logo ──
        let logoUrl = '';
        if (logoFile) {
          const ext = logoFile.name.split('.').pop() || 'png';
          const path = `logos/${Date.now()}_${wizardData.basics.symbol}.${ext}`;
          const { error: uploadErr } = await supabase.storage
            .from('bonding-curve')
            .upload(path, logoFile, { contentType: logoFile.type, upsert: true });
          if (!uploadErr) {
            const { data: urlData } = supabase.storage.from('bonding-curve').getPublicUrl(path);
            logoUrl = urlData.publicUrl;
            console.log('[Wizard] Logo uploaded:', logoUrl);
          } else {
            console.error('[Wizard] Logo upload error:', uploadErr);
          }
        }

        // ── Step 4: Upload banner ──
        let bannerUrl = '';
        if (bannerFile) {
          const ext = bannerFile.name.split('.').pop() || 'png';
          const path = `banners/${Date.now()}_${wizardData.basics.symbol}.${ext}`;
          const { error: uploadErr } = await supabase.storage
            .from('bonding-curve')
            .upload(path, bannerFile, { contentType: bannerFile.type, upsert: true });
          if (!uploadErr) {
            const { data: urlData } = supabase.storage.from('bonding-curve').getPublicUrl(path);
            bannerUrl = urlData.publicUrl;
            console.log('[Wizard] Banner uploaded:', bannerUrl);
          } else {
            console.error('[Wizard] Banner upload error:', uploadErr);
          }
        }

        // ── Step 5: Update DB row ──
        const updatePayload: any = {};
        if (logoUrl) updatePayload.logo_url = logoUrl;
        if (bannerUrl) updatePayload.banner_url = bannerUrl;
        if (wizardData.basics.description) updatePayload.description = wizardData.basics.description;
        if (wizardData.socials.website) updatePayload.website = wizardData.socials.website;
        if (wizardData.socials.twitter) updatePayload.twitter = wizardData.socials.twitter;
        if (wizardData.socials.telegram) updatePayload.telegram = wizardData.socials.telegram;

        if (Object.keys(updatePayload).length > 0) {
          console.log('[Wizard] Updating pool', tokenAddress, 'with:', Object.keys(updatePayload));
          const { data: updated, error: updateErr } = await supabase
            .from('bonding_pools')
            .update(updatePayload)
            .eq('token_address', tokenAddress)
            .select('id');
          if (updateErr) {
            console.error('[Wizard] DB update error:', updateErr);
          } else {
            console.log('[Wizard] ✅ Pool metadata saved!', updated);
          }
        }
      } catch (err) {
        console.error('[Wizard] Error saving metadata:', err);
      } finally {
        setIsSavingMetadata(false);
        localStorage.removeItem(STORAGE_KEY);
        router.push(`/bonding-curve?created=true&tx=${txHash}`);
      }
    }

    saveMetadata();
  }, [isTxSuccess, txHash]);

  // Image handlers
  const handleImageSelect = useCallback((
    e: React.ChangeEvent<HTMLInputElement>,
    type: 'logo' | 'banner'
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate size (2MB)
    if (file.size > 2 * 1024 * 1024) {
      setErrors((prev: any) => ({ ...prev, [type]: 'Max file size is 2MB' }));
      return;
    }

    // Validate type
    if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type)) {
      setErrors((prev: any) => ({ ...prev, [type]: 'Only PNG, JPG, WebP, GIF allowed' }));
      return;
    }

    setErrors((prev: any) => ({ ...prev, [type]: undefined }));

    const reader = new FileReader();
    reader.onloadend = () => {
      if (type === 'logo') {
        setLogoPreview(reader.result as string);
        setLogoFile(file);
      } else {
        setBannerPreview(reader.result as string);
        setBannerFile(file);
      }
    };
    reader.readAsDataURL(file);
  }, []);

  const validateStep = (step: number): boolean => {
    setErrors({});
    try {
      switch (step) {
        case 1:
          bondingCurveBasicsSchema.parse(wizardData.basics);
          break;
        case 3:
          if (!termsAccepted) {
            setErrors({ terms: 'You must accept the terms' });
            return false;
          }
          break;
      }
      return true;
    } catch (error: any) {
      if (error.errors) {
        const fieldErrors: any = {};
        error.errors.forEach((err: any) => {
          fieldErrors[err.path[0]] = err.message;
        });
        setErrors(fieldErrors);
      }
      return false;
    }
  };

  const handleNext = () => {
    if (validateStep(currentStep)) {
      if (!completedSteps.includes(currentStep)) {
        setCompletedSteps([...completedSteps, currentStep]);
      }
      setCurrentStep(currentStep + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleDeploy = () => {
    if (!isConnected) {
      alert("Please connect your wallet first.");
      return;
    }
    try {
      writeContract({
        address: FACTORY_ADDRESS as `0x${string}`,
        abi: FACTORY_ABI,
        functionName: 'launchToken',
        args: [
          wizardData.basics.name,
          wizardData.basics.symbol,
          wizardData.referrer as `0x${string}`
        ],
        value: parseEther(CREATE_FEE)
      });
    } catch (err: any) {
      console.error(err);
      alert('Transaction failed: ' + err.message);
    }
  };

  const updateBasics = (field: string, value: string) => {
    setWizardData({
      ...wizardData,
      basics: { ...wizardData.basics, [field]: value },
    });
  };

  const updateSocials = (field: string, value: string) => {
    setWizardData({
      ...wizardData,
      socials: { ...wizardData.socials, [field]: value },
    });
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Zap className="w-8 h-8 text-cyan-400" />
          <h1 className="text-3xl font-bold text-white">Create Bonding Curve Token</h1>
        </div>
        <p className="text-gray-400">Launch a permissionless token on BSC Testnet with fair pricing.</p>

        <div className="mt-4 bg-cyan-950/30 border border-cyan-800/40 rounded-lg p-4">
          <div className="flex gap-3">
            <AlertCircle className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="text-cyan-300 font-medium mb-1">Features:</p>
              <ul className="text-cyan-200/80 space-y-1 text-xs">
                <li>• <strong>No Seed Liquidity Required</strong> — Fair Launch</li>
                <li>• <strong>Constant-product AMM</strong> pricing</li>
                <li>• <strong>Auto-migration</strong> to PancakeSwap at 1 BNB</li>
                <li>• <strong>Create Fee:</strong> 0.05 BNB | <strong>Swap Fee:</strong> 1.5%</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Stepper */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {BONDING_CURVE_STEPS.map((step, index) => (
            <div key={step.id} className="flex items-center flex-1">
              <button
                onClick={() =>
                  currentStep > step.id || completedSteps.includes(step.id)
                    ? setCurrentStep(step.id)
                    : null
                }
                className={`flex flex-col items-center ${currentStep >= step.id ? 'opacity-100' : 'opacity-50'}`}
              >
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                    currentStep === step.id
                      ? 'bg-cyan-600 text-white'
                      : completedSteps.includes(step.id)
                        ? 'bg-green-600 text-white'
                        : 'bg-gray-700 text-gray-400'
                  }`}
                >
                  {completedSteps.includes(step.id) ? '✓' : step.id}
                </div>
                <span className="text-xs text-gray-400 mt-1 hidden md:block">{step.name}</span>
              </button>
              {index < BONDING_CURVE_STEPS.length - 1 && (
                <div
                  className={`flex-1 h-0.5 mx-2 ${currentStep > step.id ? 'bg-cyan-600' : 'bg-gray-700'}`}
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 mb-6">

        {/* ──────── Step 1: Token Info + Images ──────── */}
        {currentStep === 1 && (
          <div>
            <h2 className="text-xl font-bold text-white mb-6">Token Information</h2>

            {/* Logo & Banner Upload */}
            <div className="mb-6">
              {/* Banner Upload */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Banner Image <span className="text-gray-500">(optional · recommended 1200×400)</span>
                </label>
                <div
                  onClick={() => bannerInputRef.current?.click()}
                  className={`relative w-full h-40 rounded-xl border-2 border-dashed cursor-pointer overflow-hidden transition-all ${
                    bannerPreview
                      ? 'border-cyan-500/50'
                      : 'border-gray-700 hover:border-cyan-600/50 bg-gray-800/50'
                  }`}
                >
                  {bannerPreview ? (
                    <>
                      <img src={bannerPreview} alt="Banner" className="w-full h-full object-cover" />
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setBannerPreview('');
                          setBannerFile(null);
                        }}
                        className="absolute top-2 right-2 bg-black/70 text-white rounded-full p-1 hover:bg-red-500/80 transition"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-gray-400">
                      <ImageIcon className="w-8 h-8 mb-2" />
                      <span className="text-sm">Click to upload banner</span>
                      <span className="text-xs text-gray-500 mt-1">PNG, JPG, WebP, GIF · Max 2MB</span>
                    </div>
                  )}
                </div>
                <input
                  ref={bannerInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="hidden"
                  onChange={(e) => handleImageSelect(e, 'banner')}
                />
                {errors.banner && <p className="text-red-400 text-sm mt-1">{errors.banner}</p>}
              </div>

              {/* Logo Upload */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Logo <span className="text-gray-500">(optional · recommended 256×256)</span>
                </label>
                <div className="flex items-start gap-4">
                  <div
                    onClick={() => logoInputRef.current?.click()}
                    className={`relative w-24 h-24 rounded-2xl border-2 border-dashed cursor-pointer overflow-hidden flex-shrink-0 transition-all ${
                      logoPreview
                        ? 'border-cyan-500/50'
                        : 'border-gray-700 hover:border-cyan-600/50 bg-gray-800/50'
                    }`}
                  >
                    {logoPreview ? (
                      <>
                        <img src={logoPreview} alt="Logo" className="w-full h-full object-cover" />
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setLogoPreview('');
                            setLogoFile(null);
                          }}
                          className="absolute top-0.5 right-0.5 bg-black/70 text-white rounded-full p-0.5 hover:bg-red-500/80 transition"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </>
                    ) : (
                      <div className="flex flex-col items-center justify-center h-full text-gray-400">
                        <Upload className="w-5 h-5 mb-1" />
                        <span className="text-[10px]">Logo</span>
                      </div>
                    )}
                  </div>
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    className="hidden"
                    onChange={(e) => handleImageSelect(e, 'logo')}
                  />
                  <div className="text-xs text-gray-500 pt-2">
                    <p>Square image works best.</p>
                    <p>PNG, JPG, WebP, GIF · Max 2MB</p>
                  </div>
                </div>
                {errors.logo && <p className="text-red-400 text-sm mt-1">{errors.logo}</p>}
              </div>
            </div>

            {/* Text Inputs */}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Token Name *</label>
                <input
                  type="text"
                  value={wizardData.basics?.name || ''}
                  onChange={(e) => updateBasics('name', e.target.value)}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-cyan-500 focus:outline-none transition"
                  placeholder="e.g., Selsipad Test Token"
                />
                {errors.name && <p className="text-red-400 text-sm mt-1">{errors.name}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Symbol *</label>
                <input
                  type="text"
                  value={wizardData.basics?.symbol || ''}
                  onChange={(e) => updateBasics('symbol', e.target.value.toUpperCase())}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-cyan-500 focus:outline-none transition"
                  placeholder="STT"
                  maxLength={10}
                />
                {errors.symbol && <p className="text-red-400 text-sm mt-1">{errors.symbol}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Description *</label>
                <textarea
                  value={wizardData.basics?.description || ''}
                  onChange={(e) => updateBasics('description', e.target.value)}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-cyan-500 focus:outline-none transition"
                  rows={4}
                  placeholder="Describe your token's vision and utility..."
                />
                {errors.description && <p className="text-red-400 text-sm mt-1">{errors.description}</p>}
              </div>
            </div>
          </div>
        )}

        {/* ──────── Step 2: Social Links ──────── */}
        {currentStep === 2 && (
          <div>
            <h2 className="text-xl font-bold text-white mb-2">Social Links</h2>
            <p className="text-gray-400 text-sm mb-6">Add your project's social links so traders can learn more. All fields are optional.</p>

            <div className="space-y-4">
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
                  <Globe className="w-4 h-4 text-cyan-400" /> Website
                </label>
                <input
                  type="url"
                  value={wizardData.socials?.website || ''}
                  onChange={(e) => updateSocials('website', e.target.value)}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-cyan-500 focus:outline-none transition"
                  placeholder="https://yourproject.com"
                />
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
                  <Twitter className="w-4 h-4 text-blue-400" /> X (Twitter)
                </label>
                <input
                  type="text"
                  value={wizardData.socials?.twitter || ''}
                  onChange={(e) => updateSocials('twitter', e.target.value)}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-cyan-500 focus:outline-none transition"
                  placeholder="https://x.com/yourproject"
                />
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
                  <MessageCircle className="w-4 h-4 text-blue-300" /> Telegram
                </label>
                <input
                  type="text"
                  value={wizardData.socials?.telegram || ''}
                  onChange={(e) => updateSocials('telegram', e.target.value)}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white focus:border-cyan-500 focus:outline-none transition"
                  placeholder="https://t.me/yourgroup"
                />
              </div>
            </div>

            {/* Fee Disclosure (moved from old step 2) */}
            <div className="mt-8">
              <h3 className="text-lg font-bold text-white mb-3">Fee Structure</h3>
              <div className="bg-gray-800 border border-gray-700 rounded-lg p-4">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between border-b border-gray-700 pb-2">
                    <span className="text-gray-400">Creation Fee</span>
                    <span className="text-white font-medium">0.05 BNB</span>
                  </div>
                  <div className="flex justify-between border-b border-gray-700 pb-2">
                    <span className="text-gray-400">Swap Fee (per trade)</span>
                    <span className="text-white font-medium">1.5%</span>
                  </div>
                  <div className="flex justify-between border-b border-gray-700 pb-2">
                    <span className="text-gray-400">Referral Reward</span>
                    <span className="text-green-400 font-medium">0.75% of Trade Volume</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400">Migration Target</span>
                    <span className="text-cyan-400 font-medium">PancakeSwap (1 BNB)</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ──────── Step 3: Review ──────── */}
        {currentStep === 3 && (
          <div>
            <h2 className="text-xl font-bold text-white mb-4">Review & Confirmation</h2>

            {/* Preview Card */}
            <div className="bg-gray-800 border border-gray-700 rounded-xl overflow-hidden mb-6">
              {bannerPreview && (
                <div className="h-32 w-full">
                  <img src={bannerPreview} alt="Banner" className="w-full h-full object-cover" />
                </div>
              )}
              <div className="p-5">
                <div className="flex items-center gap-4 mb-4">
                  {logoPreview ? (
                    <img src={logoPreview} alt="Logo" className="w-14 h-14 rounded-xl object-cover border border-gray-600" />
                  ) : (
                    <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-cyan-500/30 to-blue-500/30 flex items-center justify-center text-xl font-bold text-cyan-300">
                      {wizardData.basics?.symbol?.charAt(0) || 'T'}
                    </div>
                  )}
                  <div>
                    <h3 className="text-lg font-bold text-white">{wizardData.basics?.name || 'Token Name'}</h3>
                    <span className="text-sm text-cyan-400 font-medium">${wizardData.basics?.symbol || 'TKN'}</span>
                  </div>
                </div>

                {wizardData.basics?.description && (
                  <p className="text-gray-400 text-sm mb-4">{wizardData.basics.description}</p>
                )}

                {/* Social links preview */}
                {(wizardData.socials?.website || wizardData.socials?.twitter || wizardData.socials?.telegram) && (
                  <div className="flex gap-3 border-t border-gray-700 pt-3">
                    {wizardData.socials.website && (
                      <span className="flex items-center gap-1 text-xs text-gray-400">
                        <Globe className="w-3.5 h-3.5" /> Website
                      </span>
                    )}
                    {wizardData.socials.twitter && (
                      <span className="flex items-center gap-1 text-xs text-gray-400">
                        <Twitter className="w-3.5 h-3.5" /> X
                      </span>
                    )}
                    {wizardData.socials.telegram && (
                      <span className="flex items-center gap-1 text-xs text-gray-400">
                        <MessageCircle className="w-3.5 h-3.5" /> Telegram
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Cost Summary */}
            <div className="bg-gray-800 border border-gray-700 rounded-lg p-5 mb-6">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Network:</span>
                  <span className="text-cyan-400">BSC Testnet</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-gray-700">
                  <span className="text-gray-400">Total Upfront Cost:</span>
                  <span className="text-xl font-bold text-yellow-400">0.05 BNB</span>
                </div>
              </div>
            </div>

            {errors.terms && <p className="text-red-400 text-sm mb-2">{errors.terms}</p>}
            <label className="flex items-start gap-3 cursor-pointer bg-gray-800/50 p-4 rounded-lg border border-gray-700 hover:border-gray-600 transition">
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={(e) => setTermsAccepted(e.target.checked)}
                className="mt-1 flex-shrink-0 accent-cyan-500"
              />
              <span className="text-sm text-gray-300">
                I understand I am interacting with a decentralized smart contract. I acknowledge the creation fee of 0.05 BNB and agree to the platform's terms.
              </span>
            </label>
          </div>
        )}

        {/* ──────── Step 4: Deploy ──────── */}
        {currentStep === 4 && (
          <div className="text-center py-8">
            <Zap className="w-16 h-16 text-cyan-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white mb-2">Ready to Deploy!</h2>
            <p className="text-gray-400 mb-6">Your token will be launched on-chain with bonding curve pricing.</p>

            <div className="space-y-3 mb-8 text-left max-w-sm mx-auto">
              <div className="flex items-center gap-3 text-green-400 bg-gray-800/40 p-3 rounded border border-gray-700">
                <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm">Token info validated</span>
              </div>
              <div className="flex items-center gap-3 text-green-400 bg-gray-800/40 p-3 rounded border border-gray-700">
                <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm">Creation fee: 0.05 BNB</span>
              </div>
              {(logoFile || bannerFile) && (
                <div className="flex items-center gap-3 text-cyan-400 bg-cyan-900/20 p-3 rounded border border-cyan-800/40">
                  <ImageIcon className="w-5 h-5 flex-shrink-0" />
                  <span className="text-sm">
                    {[logoFile && 'Logo', bannerFile && 'Banner'].filter(Boolean).join(' + ')} will be uploaded after deploy
                  </span>
                </div>
              )}
              {wizardData.referrer !== '0x0000000000000000000000000000000000000000' && (
                <div className="flex items-center gap-3 text-blue-400 bg-blue-900/20 p-3 rounded border border-blue-800/40">
                  <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                  <span className="text-sm break-all">Referrer applied</span>
                </div>
              )}
            </div>

            {txError && (
              <div className="mb-4 text-red-400 bg-red-900/20 p-4 rounded border border-red-800/50 text-sm max-w-lg mx-auto text-left break-words">
                <strong>Error:</strong><br />
                {txError.message}
              </div>
            )}

            <button
              onClick={handleDeploy}
              disabled={isTxPending || isTxConfirming || isSavingMetadata || !isConnected}
              className="px-8 py-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-cyan-900/20 transition-all w-full md:w-auto min-w-[280px]"
            >
              {!isConnected
                ? 'Please Connect Wallet'
                : isTxPending
                  ? 'Confirm in Wallet...'
                  : isTxConfirming
                    ? 'Processing on-chain...'
                    : isSavingMetadata
                      ? 'Uploading images & metadata...'
                      : 'Deploy Token Now'}
            </button>
            {(isTxPending || isTxConfirming || isSavingMetadata) && (
              <p className="mt-4 text-cyan-400 text-sm animate-pulse">
                {isSavingMetadata
                  ? 'Saving images and metadata to Supabase...'
                  : 'Please do not close this window while transaction is pending...'}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between border-t border-gray-800 pt-6">
        <button
          onClick={handleBack}
          disabled={currentStep === 1 || isTxPending || isTxConfirming}
          className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-colors ${
            currentStep === 1 || isTxPending || isTxConfirming
              ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
              : 'bg-gray-800 text-white hover:bg-gray-700'
          }`}
        >
          <ArrowLeft className="w-5 h-5" />
          Back
        </button>

        <div className="flex gap-3">
          {currentStep < 4 && (
            <button
              onClick={handleNext}
              className="flex items-center gap-2 px-6 py-3 rounded-lg font-medium bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-700 hover:to-blue-700 text-white"
            >
              Continue
              <ArrowRight className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
