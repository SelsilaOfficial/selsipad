import { useState, useEffect } from 'react';
import { useAccount, useChainId, useSwitchChain } from 'wagmi';
import { useTokenInfo } from '@/hooks/useTokenInfo';
import { useTokenSecurity, SecurityBadges } from '@/hooks/useTokenSecurity';
import { CreateTokenModal } from '@/components/fairlaunch/CreateTokenModal';
import { Shield, ShieldAlert, BadgeCheck, Activity, Lock, Search, AlertTriangle, Check, Loader2, AlertCircle } from 'lucide-react';

interface Step1Props {
  data: any;
  updateData: (data: any) => void;
  onNext: () => void;
  errors: any;
}

const NETWORKS = [
  { id: 'bnb', name: 'BNB Chain', chainId: 97, icon: '🟡' },
  { id: 'ethereum', name: 'Ethereum', chainId: 11155111, icon: '🔵' },
  { id: 'base', name: 'Base', chainId: 84532, icon: '🔵' },
];

export function Step1NetworkToken({ data, updateData, onNext, errors }: Step1Props) {
  const { address } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  
  const [tokenMode, setTokenMode] = useState<'existing' | 'create'>('existing');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [localTokenConfig, setLocalTokenConfig] = useState(data.step1?.token_address || '');

  // Token Hooks
  const tokenInfo = useTokenInfo(localTokenConfig, address, NETWORKS.find(n => n.id === data.step1?.network)?.chainId || 97);
  const { scanToken, badges, isScanning, error: scanError } = useTokenSecurity();

  // Auto-scan when token info is loaded
  useEffect(() => {
    if (tokenInfo.isValid && localTokenConfig) {
      // If platform token (created via wizard), auto-pass
      if (data.step1?.is_platform_token) {
        // Platform tokens are safe by definition
        return; 
      }
      scanToken(localTokenConfig);
    }
  }, [tokenInfo.isValid, localTokenConfig, scanToken, data.step1?.is_platform_token]);

  // Update parent data when token info changes
  useEffect(() => {
    if (tokenInfo.isValid) {
      updateData({
        step1: {
          ...data.step1,
          token_address: localTokenConfig,
          token_name: tokenInfo.name,
          token_symbol: tokenInfo.symbol,
          token_decimals: tokenInfo.decimals,
          token_supply: tokenInfo.totalSupply, // Save supply for calculations
        },
        basics: {
          ...data.basics,
          name: data.basics?.name || tokenInfo.name, // Auto-fill if empty
        }
      });
    }
  }, [tokenInfo, localTokenConfig]);

  const handleNetworkSelect = (networkId: string) => {
    const net = NETWORKS.find(n => n.id === networkId);
    if (net && chainId !== net.chainId) {
      switchChain?.({ chainId: net.chainId });
    }
    updateData({ step1: { ...data.step1, network: networkId } });
  };

  const handleTokenCreated = (info: any) => {
    setLocalTokenConfig(info.address);
    setShowCreateModal(false);
    setTokenMode('existing'); // Switch to view mode
    // Auto-set as platform token
    updateData({
      step1: {
        ...data.step1,
        token_address: info.address,
        token_name: info.name,
        token_symbol: info.symbol,
        token_decimals: info.decimals,
        token_supply: info.totalSupply,
        is_platform_token: true
      },
      basics: {
        ...data.basics,
        name: data.basics?.name || info.name, // Auto-fill if empty
      }
    });
  };

  // Badge Display Component
  const BadgeItem = ({ label, passed, icon: Icon }: any) => (
    <div className={`flex items-center justify-between p-3 rounded-lg border ${passed ? 'bg-green-950/20 border-green-800/30' : 'bg-red-950/20 border-red-800/30'}`}>
      <div className="flex items-center gap-3">
        <Icon className={`w-5 h-5 ${passed ? 'text-green-400' : 'text-red-400'}`} />
        <span className={`text-sm font-medium ${passed ? 'text-green-300' : 'text-red-300'}`}>{label}</span>
      </div>
      {passed ? <Check className="w-4 h-4 text-green-400" /> : <AlertTriangle className="w-4 h-4 text-red-400" />}
    </div>
  );

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* Network Selection */}
      <section>
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Activity className="w-5 h-5 text-purple-400" />
          Select Network
        </h3>
        <div className="grid grid-cols-3 gap-4">
          {NETWORKS.map((net) => (
            <button
              key={net.id}
              onClick={() => handleNetworkSelect(net.id)}
              className={`
                relative overflow-hidden group p-4 rounded-xl border transition-all duration-300
                ${data.step1?.network === net.id 
                  ? 'bg-purple-500/10 border-purple-500 shadow-[0_0_20px_rgba(168,85,247,0.15)]' 
                  : 'bg-gray-900/50 border-gray-800 hover:border-gray-700 hover:bg-gray-800'}
              `}
            >
              <div className="flex flex-col items-center gap-2">
                <span className="text-2xl filter drop-shadow-lg">{net.icon}</span>
                <span className={`font-medium ${data.step1?.network === net.id ? 'text-white' : 'text-gray-400'}`}>
                  {net.name}
                </span>
              </div>
            </button>
          ))}
        </div>
      </section>

      {/* Token Setup */}
      <section>
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <BadgeCheck className="w-5 h-5 text-blue-400" />
          Token Configuration
        </h3>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <button
            onClick={() => setTokenMode('create')}
            className={`p-4 rounded-lg border text-center transition-all ${tokenMode === 'create' ? 'bg-blue-600/20 border-blue-500 text-white' : 'bg-gray-900 border-gray-800 text-gray-400'}`}
          >
            Create New Token
          </button>
          <button
            onClick={() => setTokenMode('existing')}
            className={`p-4 rounded-lg border text-center transition-all ${tokenMode === 'existing' ? 'bg-blue-600/20 border-blue-500 text-white' : 'bg-gray-900 border-gray-800 text-gray-400'}`}
          >
            Use Existing Token
          </button>
        </div>

        {tokenMode === 'create' ? (
          <div className="bg-gradient-to-br from-blue-900/10 to-purple-900/10 border border-blue-800/30 rounded-xl p-6 text-center">
            <Shield className="w-12 h-12 text-blue-400 mx-auto mb-4" />
            <h4 className="text-white font-bold mb-2">Create Standard Token</h4>
            <p className="text-gray-400 text-sm mb-6 max-w-md mx-auto">
              Deploy a verification-ready token instantly. 
              <br/>
              <span className="text-green-400 font-medium">✓ SAFU Badge Auto-Included</span>
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg transition shadow-lg shadow-blue-900/20"
            >
              Launch Token Creator
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
              <input
                type="text"
                value={localTokenConfig}
                onChange={(e) => setLocalTokenConfig(e.target.value)}
                placeholder="Paste token address (0x...)"
                className="w-full pl-12 pr-4 py-4 bg-gray-900 border border-gray-800 rounded-xl text-white focus:ring-2 focus:ring-blue-500/50 outline-none transition"
              />
            </div>

            {/* Token Info Card */}
            {tokenInfo.isValid && (
              <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4 flex justify-between items-center">
                <div>
                   <h4 className="text-white font-bold">{tokenInfo.name} <span className="text-gray-500 text-sm">({tokenInfo.symbol})</span></h4>
                   <p className="text-gray-400 text-xs mt-1">Supply: {parseFloat(tokenInfo.totalSupply).toLocaleString()}</p>
                </div>
                {data.step1?.is_platform_token ? (
                  <span className="px-3 py-1 bg-green-500/20 text-green-400 text-xs font-bold rounded-full border border-green-500/20">
                    🛡️ SAFU VERIFIED
                  </span>
                ) : (
                   <span className="px-3 py-1 bg-gray-800 text-gray-400 text-xs rounded-full">
                    Custom Token
                   </span>
                )}
              </div>
            )}

            {/* Security Scanner */}
            {(localTokenConfig && !data.step1?.is_platform_token) && (
              <div className="border border-gray-800 rounded-xl overflow-hidden">
                <div className="bg-gray-900 p-4 border-b border-gray-800 flex justify-between items-center">
                  <h4 className="font-semibold text-white flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-orange-400" />
                    Security Scan
                  </h4>
                  {isScanning && <div className="flex items-center gap-2 text-xs text-blue-400"><Loader2 className="w-3 h-3 animate-spin"/> Analyzing...</div>}
                </div>
                
                <div className="p-4 bg-gray-900/30 grid grid-cols-1 md:grid-cols-2 gap-3">
                   {badges ? (
                     <>
                        <BadgeItem label="No Mint Function" passed={!badges.isMintable} icon={Lock} />
                        <BadgeItem label="Trading Pausable" passed={!badges.isPausable} icon={Activity} />
                        <BadgeItem label="Blacklist Capability" passed={!badges.isBlacklistable} icon={AlertTriangle} />
                        <BadgeItem label="Tax Modifiable" passed={!badges.hasTaxModifiability} icon={AlertCircle} />
                     </>
                   ) : (
                     <div className="col-span-2 text-center py-8 text-gray-500 text-sm italic">
                       {isScanning ? 'Scanning contract bytecode...' : 'Waiting for scan...'}
                     </div>
                   )}
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Create Token Modal */}
      <CreateTokenModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={handleTokenCreated}
        selectedChain={data.step1?.network || 'bnb'}
        mode="fairlaunch"
      />
      
      {/* Navigation */}
      <div className="flex justify-end pt-6">
        <button
          onClick={onNext}
          disabled={!tokenInfo.isValid || (tokenMode === 'existing' && !data.step1?.is_platform_token && isScanning)}
          className="px-8 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold rounded-lg hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          Next Step →
        </button>
      </div>
    </div>
  );
}
