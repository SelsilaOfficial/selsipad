interface NetworkBadgeProps {
  network: string;
  chainId?: string;
}

export function NetworkBadge({ network, chainId }: NetworkBadgeProps) {
  const getNetworkDisplay = () => {
    if (network === 'SOLANA') {
      return { name: 'Solana', color: 'from-purple-500 to-pink-500', icon: '◎' };
    }

    // EVM chains (mainnet + testnet)
    switch (chainId || network) {
      case '1':
        return { name: 'Ethereum', color: 'from-blue-500 to-blue-600', icon: 'Ξ' };
      case '11155111':
        return { name: 'Sepolia', color: 'from-blue-400 to-blue-500', icon: 'Ξ' };
      case '56':
        return { name: 'BNB', color: 'from-yellow-500 to-yellow-600', icon: 'B' };
      case '97':
        return { name: 'BNB', color: 'from-yellow-400 to-yellow-500', icon: 'B' };
      case '8453':
        return { name: 'Base', color: 'from-blue-600 to-blue-700', icon: '🔵' };
      case '84532':
        return { name: 'Base', color: 'from-blue-500 to-blue-600', icon: '🔵' };
      case '137':
        return { name: 'Polygon', color: 'from-purple-600 to-purple-700', icon: 'P' };
      case '43114':
        return { name: 'Avalanche', color: 'from-red-500 to-red-600', icon: 'A' };
      default:
        return { name: 'EVM', color: 'from-gray-500 to-gray-600', icon: 'E' };
    }
  };

  const networkInfo = getNetworkDisplay();

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full bg-gradient-to-r ${networkInfo.color} text-white text-xs font-medium`}
    >
      <span>{networkInfo.icon}</span>
      <span>{networkInfo.name}</span>
    </span>
  );
}
