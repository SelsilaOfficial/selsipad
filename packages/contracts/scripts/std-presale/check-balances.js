const hre = require('hardhat');

async function main() {
  console.log('\n💰 CHECKING BUYER WALLET BALANCES\n');

  const signers = await hre.ethers.getSigners();

  console.log('All available wallets:');
  for (let i = 0; i < signers.length; i++) {
    const signer = signers[i];
    const balance = await hre.ethers.provider.getBalance(signer.address);
    const bnb = hre.ethers.formatEther(balance);

    let label = 'Unknown';
    if (i === 0) label = 'Deployer';
    else if (i === 1) label = 'Admin/Timelock';
    else label = `Buyer${i - 1}`;

    console.log(`${i}. ${label}: ${signer.address}`);
    console.log(`   Balance: ${bnb} BNB\n`);
  }

  console.log(`Total wallets loaded: ${signers.length}`);
}

main()
  .then(() => process.exit(0))
  .catch(console.error);
