/**
 * Verify a Fairlaunch contract on BSCScan
 * @param contractAddress - Deployed contract address
 * @param constructorArgs - Constructor arguments array
 * @returns Verification result
 */
export async function verifyFairlaunchContract(
  contractAddress: string,
  constructorArgs: any[]
) {
  try {
    console.log('[Verify] Starting verification for:', contractAddress);
    console.log('[Verify] Constructor args:', constructorArgs);
    
    // Dynamic import to avoid TypeScript errors with Hardhat 3.x
    const { run } = await import('hardhat');
    
    await run('verify:verify', {
      address: contractAddress,
      constructorArguments: constructorArgs,
      contract: 'contracts/fairlaunch/Fairlaunch.sol:Fairlaunch',
    });
    
    console.log('[Verify] ✅ Contract verified successfully!');
    return { success: true, verified: true };
    
  } catch (error: any) {
    // Already verified is considered success
    if (error.message.includes('Already Verified')) {
      console.log('[Verify] ✅ Contract already verified');
      return { success: true, verified: true, alreadyVerified: true };
    }
    
    // Log but don't fail on verification errors
    console.error('[Verify] ❌ Verification failed:', error.message);
    return { success: false, verified: false, error: error.message };
  }
}

/**
 * Manual verification helper - useful for testing
 */
export async function manualVerify(address: string, args: any[]) {
  console.log('\n🔍 Manual Verification');
  console.log('='.repeat(50));
  console.log('Contract:', address);
  console.log('Args:', JSON.stringify(args, null, 2));
  console.log('='.repeat(50));
  
  const result = await verifyFairlaunchContract(address, args);
  
  if (result.verified) {
    console.log('\n✅ SUCCESS - Contract is verified on BSCScan!');
  } else {
    console.log('\n❌ FAILED -', result.error);
  }
  
  return result;
}
