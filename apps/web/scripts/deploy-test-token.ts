
import { createWalletClient, http, publicActions, parseUnits, parseEther } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { bscTestnet } from 'viem/chains';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Try loading .env.local first, then .env
dotenv.config({ path: resolve(__dirname, '../.env.local') });
dotenv.config({ path: resolve(__dirname, '../.env') });
dotenv.config({ path: resolve(__dirname, '../../../.env.local') });
dotenv.config({ path: resolve(__dirname, '../../../.env') });
dotenv.config({ path: resolve(__dirname, '../../../contracts/presale/.env') });

const key = process.env.PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY || process.env.WALLET_PRIVATE_KEY || process.env.KEY;
const userKey = process.env.USER_PRIVATE_KEY; // Just in case it's named specifically

const finalKey = key || userKey;

if (!finalKey) {
    console.error('❌ Error: Could not find PRIVATE_KEY, DEPLOYER_PRIVATE_KEY, WALLET_PRIVATE_KEY, or KEY in environment.');
    console.log('Debug: Available keys:', Object.keys(process.env).filter(k => k.includes('KEY')));
    process.exit(1);
}

// Add 0x prefix if missing
const privateKey = (finalKey.startsWith('0x') ? finalKey : `0x${finalKey}`) as `0x${string}`;

const account = privateKeyToAccount(privateKey);

const client = createWalletClient({
    account,
    chain: bscTestnet,
    transport: http('https://bsc-testnet.publicnode.com')
}).extend(publicActions);

const TOKEN_FACTORY_ADDRESS = '0xB05fd8F59f723ab590aB4eCb47d16701568B4e12';

const abi = [
  {
    type: 'function',
    name: 'createToken',
    stateMutability: 'payable',
    inputs: [
      { name: 'name', type: 'string' },
      { name: 'symbol', type: 'string' },
      { name: 'decimals', type: 'uint8' },
      { name: 'totalSupply', type: 'uint256' },
      { name: 'antiBotConfig', type: 'uint256[3]' },
    ],
    outputs: [{ type: 'address' }],
  },
] as const;

async function main() {
    console.log(`🚀 Deploying Selsi Test Token using wallet: ${account.address}`);
    console.log(`   Network: BSC Testnet (${bscTestnet.id})`);
    
    // Check balance
    const balance = await client.getBalance({ address: account.address });
    console.log(`   Balance: ${Number(balance) / 1e18} BNB`);

    if (balance < parseEther('0.21')) { // 0.2 fee + gas
        console.error('❌ Insufficient balance. Need approx 0.21 BNB.');
        // process.exit(1); // Try anyway? No, it will fail.
    }

    console.log('⏳ Sending createToken transaction...');
    console.log('   Factory:', TOKEN_FACTORY_ADDRESS);
    console.log('   Supply:', '100000000000');
    console.log('   Fee:', '0.2 BNB');
    
    try {
        const hash = await client.writeContract({
            address: TOKEN_FACTORY_ADDRESS,
            abi,
            functionName: 'createToken',
            args: [
                'Selsi Test Token',
                'STT',
                18,
                parseUnits('100000000000', 18), // 100 Billion
                [0n, 0n, 0n]
            ],
            value: parseEther('0.5')
        });

        console.log(`✅ Transaction sent: ${hash}`);
        console.log('⏳ Waiting for confirmation...');
        
        const receipt = await client.waitForTransactionReceipt({ hash });
        
        console.log('📝 Receipt Logs:', receipt.logs.length);
        console.log('✅ Deployment Confirmed!');
        console.log(`🔗 Explorer: https://testnet.bscscan.com/tx/${hash}`);
        
        // Try to parse logs for token address
        // TokenCreated(address indexed token, ...)
        // Topic 1 is token address
        for (const log of receipt.logs) {
            if (log.address.toLowerCase() === TOKEN_FACTORY_ADDRESS.toLowerCase()) {
                 if (log.topics.length >= 2) {
                     const tokenAddress = '0x' + log.topics[1]?.substring(26);
                     console.log(`🎉 Token Address: ${tokenAddress}`);
                 }
            }
        }
        
    } catch (error) {
        console.error('❌ Deployment failed:', error);
    }
}

main();
