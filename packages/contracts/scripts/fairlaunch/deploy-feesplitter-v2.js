const hre = require('hardhat');

async function main() {
  console.log('Deploying FeeSplitter V2...');

  const [deployer] = await hre.ethers.getSigners();
  console.log('Deploying with account:', deployer.address);

  // Vault addresses (from previous check)
  const treasury = '0xd7B3C25BA746627120b2386f6867df6573Db9791';
  const referralPool = '0xAa94333C8F74E8fEA5a6FdC21c0f3925E183C37A';
  const sbtStaking = '0xC57c15825eA3344E2323f6a66188cA775AEC3160';
  const admin = deployer.address;

  // Compile first to be sure
  await hre.run('compile');

  // Get factory for "contracts/std-presale/FeeSplitter.sol:FeeSplitter"
  // Note: Ensure we are deploying the ONE that has distributeFairlaunchFee
  // Based on file view earlier, "contracts/std-presale/FeeSplitter.sol" HAS the function.
  // The issue was the OLD deployment didn't.
  const FeeSplitter = await hre.ethers.getContractFactory(
    'contracts/std-presale/FeeSplitter.sol:FeeSplitter'
  );

  const feeSplitter = await FeeSplitter.deploy(treasury, referralPool, sbtStaking, admin);

  await feeSplitter.waitForDeployment();
  const address = await feeSplitter.getAddress();

  console.log('FeeSplitter V2 deployed to:', address);

  // Verification
  console.log('Verifying contract...');
  try {
    await hre.run('verify:verify', {
      address: address,
      constructorArguments: [treasury, referralPool, sbtStaking, admin],
    });
  } catch (err) {
    console.error('Verification failed:', err.message);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
