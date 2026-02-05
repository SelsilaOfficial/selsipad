/**
 * Debug finalize() revert with detailed error decoding
 * Tests each finalization step independently
 */

import { ethers } from 'hardhat';

async function main() {
  const FAIRLAUNCH_ADDRESS = '0xD8f2728fc23f008A89e203547e563A7F7DB0A3Dc';

  console.log('\n🔍 Finalize Debug Analysis');
  console.log('=====================================\n');

  const [deployer] = await ethers.getSigners();
  const fairlaunch = await ethers.getContractAt('Fairlaunch', FAIRLAUNCH_ADDRESS);

  // STEP 1: Check current state
  console.log('Step 1: Checking current state...');
  const status = await fairlaunch.status();
  const dynamicStatus = await fairlaunch.getStatus();
  const isFinalized = await fairlaunch.isFinalized();
  const totalRaised = await fairlaunch.totalRaised();
  const softcap = await fairlaunch.softcap();
  const lpLocker = await fairlaunch.lpLocker();
  const projectToken = await fairlaunch.projectToken();
  const dexId = await fairlaunch.dexId();

  console.log(`Status (stored): ${status}`);
  console.log(`Status (dynamic): ${dynamicStatus}`);
  console.log(`Finalized: ${isFinalized}`);
  console.log(
    `Raised/Softcap: ${ethers.formatEther(totalRaised)}/${ethers.formatEther(softcap)} BNB`
  );
  console.log(`LP Locker: ${lpLocker}`);
  console.log(`Project Token: ${projectToken}`);

  try {
    const dexIdString = ethers.decodeBytes32String(dexId);
    console.log(`DEX ID: ${dexIdString}\n`);
  } catch {
    console.log(`DEX ID: ${dexId} (raw)\n`);
  }

  // STEP 2: Check DEX Router
  console.log('Step 2: Checking DEX Router...');
  try {
    const dexRouter = await fairlaunch.dexRouter();
    console.log(`✅ DEX Router: ${dexRouter}`);

    // Verify router exists
    const routerCode = await ethers.provider.getCode(dexRouter);
    console.log(`Router exists: ${routerCode !== '0x' ? 'YES ✅' : 'NO ❌'}`);

    if (routerCode === '0x') {
      console.error('❌ DEX Router not deployed! This will cause finalize to fail.');
    }
  } catch (e: any) {
    console.error(`❌ Error getting DEX router: ${e.message}`);
  }

  // STEP 3: Check Fee Splitter
  console.log('\nStep 3: Checking Fee Splitter...');
  try {
    const feeSplitter = await fairlaunch.feeSplitter();
    console.log(`✅ Fee Splitter: ${feeSplitter}`);

    const splitterCode = await ethers.provider.getCode(feeSplitter);
    console.log(`Fee Splitter exists: ${splitterCode !== '0x' ? 'YES ✅' : 'NO ❌'}`);
  } catch (e: any) {
    console.error(`❌ Error getting fee splitter: ${e.message}`);
  }

  // STEP 4: Check Token Balance
  console.log('\nStep 4: Checking token balances...');
  const token = await ethers.getContractAt('TestToken', projectToken);
  const fairlaunchTokenBalance = await token.balanceOf(FAIRLAUNCH_ADDRESS);
  const tokensForSale = await fairlaunch.tokensForSale();
  const liquidityPercent = await fairlaunch.liquidityPercent();

  console.log(`Tokens in Fairlaunch: ${ethers.formatUnits(fairlaunchTokenBalance, 18)}`);
  console.log(`Tokens for Sale: ${ethers.formatUnits(tokensForSale, 18)}`);
  console.log(`Liquidity %: ${Number(liquidityPercent) / 100}%`);

  const liquidityTokens = (tokensForSale * liquidityPercent) / BigInt(10000);
  const totalNeeded = tokensForSale + liquidityTokens;
  console.log(`Total needed: ${ethers.formatUnits(totalNeeded, 18)}`);
  console.log(`Balance sufficient: ${fairlaunchTokenBalance >= totalNeeded ? 'YES ✅' : 'NO ❌'}`);

  // STEP 5: Try staticCall to get revert reason
  console.log('\nStep 5: Simulating finalize() with staticCall...');
  try {
    await fairlaunch.finalize.staticCall();
    console.log('✅ staticCall succeeded! finalize() should work!');
  } catch (error: any) {
    console.error('❌ staticCall failed!');
    console.error(`Message: ${error.message}`);

    // Try to decode custom error
    if (error.data) {
      console.log(`\nError Data: ${error.data}`);

      try {
        const iface = fairlaunch.interface;

        // Try to parse as custom error
        const decodedError = iface.parseError(error.data);
        if (decodedError) {
          console.log(`\n🔍 Decoded Error: ${decodedError.name}`);
          if (decodedError.args && decodedError.args.length > 0) {
            console.log(`Arguments:`, decodedError.args);
          }
        }
      } catch (decodeError) {
        console.log('Could not decode as custom error');

        // Try to decode as revert string
        try {
          if (error.data.startsWith('0x08c379a0')) {
            const reason = ethers.AbiCoder.defaultAbiCoder().decode(
              ['string'],
              '0x' + error.data.slice(10)
            )[0];
            console.log(`\n🔍 Revert Reason: "${reason}"`);
          }
        } catch {}
      }
    }

    // Check specific conditions
    console.log('\n📋 Checking finalize requirements:');
    console.log(
      `1. Status == ENDED: ${dynamicStatus === 2 ? '✅' : '❌ (current: ' + dynamicStatus + ')'}`
    );
    console.log(`2. Not finalized: ${!isFinalized ? '✅' : '❌'}`);
    console.log(`3. Softcap met: ${totalRaised >= softcap ? '✅' : '❌'}`);
    console.log(`4. LP Locker set: ${lpLocker !== ethers.ZeroAddress ? '✅' : '❌'}`);
  }

  // STEP 6: Check admin role
  console.log('\nStep 6: Checking caller permissions...');
  const ADMIN_ROLE = await fairlaunch.ADMIN_ROLE();
  const hasAdminRole = await fairlaunch.hasRole(ADMIN_ROLE, deployer.address);
  console.log(`Caller has ADMIN_ROLE: ${hasAdminRole ? 'YES ✅' : 'NO ❌'}`);
  console.log(`(Note: finalize() doesn't require admin role)`);

  console.log('\n=====================================');
  console.log('Debug complete. Check errors above ☝️');
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
