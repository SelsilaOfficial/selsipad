const { ethers } = require('ethers');

const errors = [
  'InsufficientDeploymentFee()',
  'InvalidSoftcap()',
  'InvalidTimeRange()',
  'InvalidContributionRange()',
  'InsufficientLPLockDuration()',
  'InsufficientLiquidityPercent()',
  'ZeroAddress()',
  'FeeTransferFailed()',
  'InsufficientTokenBalance()',
  'TokenTransferFailed()',
];

console.log('Decoding selectors...');
errors.forEach((e) => {
  const id = ethers.id(e).slice(0, 10);
  console.log(`${id} : ${e}`);
});
