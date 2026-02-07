const { ethers } = require('hardhat');

async function main() {
  const txHash = '0xf679aaf834bc125736faa415f552f5fce0d01e3c20bdba07bd82c57b61f0d7f0';
  console.log(`Checking TX: ${txHash}`);

  const provider = ethers.provider;
  const receipt = await provider.getTransactionReceipt(txHash);

  if (!receipt) {
    console.log('Transaction not found or pending.');
    return;
  }

  console.log('Status:', receipt.status === 1 ? 'Success' : 'Failed');
  console.log('Block:', receipt.blockNumber);
  console.log('Gas Used:', receipt.gasUsed.toString());

  // Find FairlaunchCreated event
  // Event signature: event FairlaunchCreated(address indexed fairlaunch, address indexed vesting, uint256 fairlaunchId, address projectOwner);
  // Topic 0: keccak256("FairlaunchCreated(address,address,uint256,address)")

  const iface = new ethers.Interface([
    'event FairlaunchCreated(address indexed fairlaunch, address indexed vesting, uint256 fairlaunchId, address projectOwner)',
  ]);

  let fairlaunchAddress = null;

  for (const log of receipt.logs) {
    try {
      const parsed = iface.parseLog(log);
      if (parsed && parsed.name === 'FairlaunchCreated') {
        console.log('\nFairlaunchCreated Event Found:');
        console.log('Fairlaunch Address:', parsed.args.fairlaunch);
        console.log('Vesting Address:', parsed.args.vesting);
        console.log('Project Owner:', parsed.args.projectOwner);
        fairlaunchAddress = parsed.args.fairlaunch;
        break;
      }
    } catch (e) {
      // ignore
    }
  }

  if (fairlaunchAddress) {
    console.log(`\nVerifying Contract Status at ${fairlaunchAddress}...`);
    const Fairlaunch = await ethers.getContractFactory('Fairlaunch');
    const fairlaunch = Fairlaunch.attach(fairlaunchAddress);

    const status = await fairlaunch.status();
    const statusStr = ['UPCOMING', 'LIVE', 'ENDED', 'SUCCESS', 'FAILED', 'CANCELLED'][
      Number(status)
    ];
    console.log('Current Status:', statusStr);

    const tokensForSale = await fairlaunch.tokensForSale();
    console.log('Tokens For Sale:', ethers.formatEther(tokensForSale));
  } else {
    console.log(
      'Could not find FairlaunchCreated event. Maybe deployed directly without factory event?'
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
