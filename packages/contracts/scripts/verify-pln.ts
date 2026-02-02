import { verifyFairlaunchContract } from './verify-contract';

const CONTRACT_ADDRESS = '0xc009b2895db5972187f1289e06cba8be22eacd9a';

// Constructor arguments for PLN Fairlaunch
const CONSTRUCTOR_ARGS = [
  '0x10250daee0bab6bf0f776ad17b11e09da9db2b81', // factory
  '0x1b56c5c186409d39f6d5be3d9d7f296c036fa7bd', // projectToken (PLN)
  '0x9da91cdb79801eb8efe403bbe3be0c0ddeabcefe', // vestingVault
  '0xaC89Bf746dAf1c782Ed87e81a89fe8885CF979F5', // feeSplitter (creator wallet for now)
  {
    // CreateParams struct
    projectToken: '0x1b56c5c186409d39f6d5be3d9d7f296c036fa7bd',
    softcap: '5000000000000000000', // 5 BNB
    tokensForSale: '400000000000000000000000', // 400k tokens
    minContribution: '1000000000000000000', // 1 BNB
    maxContribution: '2000000000000000000', // 2 BNB
    startTime: 1738544460, // 2026-02-03 00:01:00
    endTime: 1738683120, // 2026-02-04 13:52:00
    projectOwner: '0xac89bf746daf1c782ed87e81a89fe8885cf979f5',
    listingPremiumBps: 0,
  },
  {
    // TeamVestingParams struct
    beneficiary: '0xac89bf746daf1c782ed87e81a89fe8885cf979f5',
    startTime: 1738683120,
    durations: [
      2592000, 5184000, 7776000, 10368000, 12960000, 15552000,
      18144000, 20736000, 23328000, 25920000, 28512000, 31104000,
    ],
    amounts: [
      '22518000000000000000000',
      '22518000000000000000000',
      '22518000000000000000000',
      '22518000000000000000000',
      '22491000000000000000000',
      '22491000000000000000000',
      '22491000000000000000000',
      '22491000000000000000000',
      '22491000000000000000000',
      '22491000000000000000000',
      '22491000000000000000000',
      '22491000000000000000000',
    ],
  },
];

async function main() {
  console.log('🔍 Verifying PLN Fairlaunch Contract on BSCScan Testnet');
  console.log('='.repeat(60));
  console.log('Contract:', CONTRACT_ADDRESS);
  console.log('Network: BSC Testnet (Chain ID 97)');
  console.log('='.repeat(60));

  const result = await verifyFairlaunchContract(CONTRACT_ADDRESS, CONSTRUCTOR_ARGS);

  if (result.verified) {
    console.log('\n✅ SUCCESS - Contract verified!');
    console.log(`View on BSCScan: https://testnet.bscscan.com/address/${CONTRACT_ADDRESS}#code`);
  } else {
    console.log('\n❌ FAILED:', result.error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
