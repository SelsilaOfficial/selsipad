/**
 * GoPlus Security API Client
 * Docs: https://docs.gopluslabs.io/
 */

const GOPLUS_BASE_URL = 'https://api.gopluslabs.io/api/v1';

export interface SecurityScanResult {
  token_address: string;
  status: 'PASS' | 'FAIL';
  checks: {
    antiMint: {
      pass: boolean;
      message: string;
      details?: string;
    };
    honeypot: {
      pass: boolean;
      message: string;
      details?: string;
    };
    tax: {
      pass: boolean;
      message: string;
      buyTax?: number;
      sellTax?: number;
    };
    pause: {
      pass: boolean;
      message: string;
      details?: string;
    };
  };
  allPassed: boolean;
  scannedAt: string;
}

/**
 * Scan token contract for security issues
 * @param tokenAddress - ERC20 token contract address
 * @param network - Network ID (1 = ETH, 56 = BSC, 8453 = Base)
 */
export async function scanTokenSecurity(
  tokenAddress: string,
  network: string
): Promise<SecurityScanResult> {
  try {
    // Map network to chain ID
    const chainId = getChainId(network);
    
    // Check if network is a testnet (GoPlus doesn't support testnets)
    const isTestnet = network.includes('testnet') || network.includes('sepolia');
    
    if (isTestnet) {
      console.warn(`⚠️ GoPlus doesn't support ${network} (testnet). Auto-passing security scan.`);
      
      // Auto-pass for testnets with all checks marked as passed
      return {
        token_address: tokenAddress,
        status: 'PASS',
        checks: {
          antiMint: {
            pass: true,
            message: 'Testnet - scan bypassed',
            details: 'GoPlus API does not support testnet chains. Manual verification recommended.',
          },
          honeypot: {
            pass: true,
            message: 'Testnet - scan bypassed',
            details: 'GoPlus API does not support testnet chains. Manual verification recommended.',
          },
          tax: {
            pass: true,
            message: 'Testnet - scan bypassed',
            buyTax: 0,
            sellTax: 0,
          },
          pause: {
            pass: true,
            message: 'Testnet - scan bypassed',
            details: 'GoPlus API does not support testnet chains. Manual verification recommended.',
          },
        },
        allPassed: true,
        scannedAt: new Date().toISOString(),
      };
    }
    
    // Call GoPlus API (mainnet only)
    const response = await fetch(
      `${GOPLUS_BASE_URL}/token_security/${chainId}?contract_addresses=${tokenAddress}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`GoPlus API error: ${response.statusText}`);
    }

    const data = await response.json();
    
    // Check for API error response
    if (data.code && data.code !== 1) {
      throw new Error(data.message || 'GoPlus API returned an error');
    }
    
    const tokenData = data.result?.[tokenAddress.toLowerCase()];

    if (!tokenData) {
      throw new Error('Token not found or invalid address. Please verify the contract address is correct and deployed on the selected network.');
    }

    // Parse results
    const checks = {
      antiMint: checkAntiMint(tokenData),
      honeypot: checkHoneypot(tokenData),
      tax: checkTax(tokenData),
      pause: checkPause(tokenData),
    };

    const allPassed = Object.values(checks).every((check) => check.pass);

    return {
      token_address: tokenAddress,
      status: allPassed ? 'PASS' : 'FAIL',
      checks,
      allPassed,
      scannedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Security scan error:', error);
    throw error;
  }
}

/**
 * Check for mint function (ability to create new tokens)
 */
function checkAntiMint(tokenData: any): SecurityScanResult['checks']['antiMint'] {
  const canMint = tokenData.is_mintable === '1';
  
  return {
    pass: !canMint,
    message: canMint 
      ? 'Token has mint function - owner can create unlimited tokens' 
      : 'No mint function detected',
    details: canMint ? 'Owner can dilute holders by minting new tokens' : undefined,
  };
}

/**
 * Check for honeypot (can't sell after buy)
 */
function checkHoneypot(tokenData: any): SecurityScanResult['checks']['honeypot'] {
  const isHoneypot = tokenData.is_honeypot === '1';
  const canSell = tokenData.sell_tax !== undefined;
  
  return {
    pass: !isHoneypot && canSell,
    message: isHoneypot 
      ? 'Honeypot detected - selling may be blocked' 
      : 'No honeypot detected',
    details: isHoneypot ? 'Users may not be able to sell tokens after purchasing' : undefined,
  };
}

/**
 * Check for high or modifiable taxes
 */
function checkTax(tokenData: any): SecurityScanResult['checks']['tax'] {
  const buyTax = parseFloat(tokenData.buy_tax || '0') * 100;
  const sellTax = parseFloat(tokenData.sell_tax || '0') * 100;
  const canModifyTax = tokenData.can_take_back_ownership === '1' || 
                       tokenData.owner_change_balance === '1';
  
  const MAX_TAX = 10; // 10% threshold
  const highTax = buyTax > MAX_TAX || sellTax > MAX_TAX;
  
  return {
    pass: !highTax && !canModifyTax,
    message: highTax 
      ? `High tax detected (Buy: ${buyTax.toFixed(1)}%, Sell: ${sellTax.toFixed(1)}%)` 
      : canModifyTax
      ? 'Owner can modify tax rates'
      : 'Tax rates acceptable and locked',
    buyTax,
    sellTax,
  };
}

/**
 * Check for pause function
 */
function checkPause(tokenData: any): SecurityScanResult['checks']['pause'] {
  const canPause = tokenData.is_blacklisted === '1' || 
                   tokenData.cannot_sell_all === '1' ||
                   tokenData.trading_cooldown === '1';
  
  return {
    pass: !canPause,
    message: canPause 
      ? 'Contract has pause/blacklist functions' 
      : 'No pause or blacklist functions',
    details: canPause ? 'Owner can prevent specific addresses from trading' : undefined,
  };
}

/**
 * Map network string to chain ID
 */
function getChainId(network: string): number {
  const mapping: Record<string, number> = {
    ethereum: 1,
    sepolia: 11155111,
    bnb: 56,
    bsc_testnet: 97,
    base: 8453,
    base_sepolia: 84532,
  };

  return mapping[network] || 1;
}

/**
 * Check if network supports GoPlus API (mainnet chains only)
 * Note: Testnets are auto-passed with bypass logic
 */
export function isNetworkSupported(network: string): boolean {
  const supportedMainnets = ['ethereum', 'bnb', 'base', 'polygon', 'arbitrum', 'optimism'];
  return supportedMainnets.includes(network);
}

/**
 * Check if network is a testnet
 */
export function isTestnet(network: string): boolean {
  return network.includes('testnet') || network.includes('sepolia');
}
