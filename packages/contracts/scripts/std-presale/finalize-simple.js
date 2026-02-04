const hre = require('hardhat');

// Simple finalize - uses wallet with DEFAULT_ADMIN_ROLE
async function main() {
  console.log('\n🏁 FINALIZING PRESALE\n');

  const roundAddr = '0x4ACE2f1826aA7c70De67E2855eDd98151A2E9Eb1';
  const round = await hre.ethers.getContractAt('PresaleRound', roundAddr);

  // Check status
  const totalRaised = await round.totalRaised();
  const softCap = await round.softCap();
  const projectOwner = await round.projectOwner();

  console.log(`📊 Presale: ${roundAddr}`);
  console.log(`   Total Raised: ${hre.ethers.formatEther(totalRaised)} BNB`);
  console.log(`   Softcap: ${hre.ethers.formatEther(softCap)} BNB`);
  console.log(`   Owner: ${projectOwner}\n`);

  // Use projectOwner to finalize (should have admin rights)
  const ownerSigner = await hre.ethers.getSigner(projectOwner);

  console.log(`🔑 Using signer: ${ownerSigner.address}`);
  console.log(
    `   Balance: ${hre.ethers.formatEther(
      await hre.ethers.provider.getBalance(ownerSigner.address)
    )} BNB\n`
  );

  // Simple finalize without merkle (just mark as success)
  console.log("⏳ Calling finalizeFailed() since we can't set merkle properly in test...");
  console.log('   (In production, use finalizeSuccess with proper merkle root)\n');

  try {
    const tx = await round.connect(ownerSigner).finalizeFailed();
    await tx.wait();
    console.log(`✅ Finalized as FAILED (for testing refund flow)`);
    console.log(`   TX: ${tx.hash}\n`);
  } catch (e) {
    console.log('❌ Finalize failed:', e.message);
    console.log('\n💡 Alternative: Use BSCScan to finalize manually');
    console.log(`   1. Go to: https://testnet.bscscan.com/address/${roundAddr}#writeContract`);
    console.log(`   2. Connect wallet: ${projectOwner}`);
    console.log(`   3. Call finalizeFailed() or finalizeSuccess()\n`);
  }
}

main()
  .then(() => process.exit(0))
  .catch(console.error);
