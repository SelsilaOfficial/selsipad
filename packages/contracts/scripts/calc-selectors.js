const { keccak256, toUtf8Bytes } = require('ethers');

async function main() {
  const errors = [
    'InsufficientDeploymentFee()',
    'InsufficientFee()',
    'InvalidStatus()',
    'ContractPaused()',
  ];

  console.log('Error Selectors:');
  for (const err of errors) {
    const selector = keccak256(toUtf8Bytes(err)).slice(0, 10);
    console.log(`${err}: ${selector}`);
  }
}

main();
