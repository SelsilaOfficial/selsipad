// Script to encode constructor arguments for BSCScan verification
const { ethers } = require('ethers');

// Import constructor args
const params = require('./verify-fairlaunch-args.js');

// Define parameter types matching Fairlaunch constructor
const types = [
  'address', // _projectToken
  'address', // _paymentToken
  'uint256', // _softcap
  'uint256', // _tokensForSale
  'uint256', // _minContribution
  'uint256', // _maxContribution
  'uint256', // _startTime
  'uint256', // _endTime
  'uint16',  // _listingPremiumBps
  'address', // _feeSplitter
  'address', // _teamVesting
  'address', // _projectOwner
  'address', // _adminExecutor
  'uint256', // _liquidityPercent
  'uint256', // _lpLockMonths
  'bytes32'  // _dexId
];

// Encode arguments
const encoded = ethers.AbiCoder.defaultAbiCoder().encode(types, params);

// Remove '0x' prefix for BSCScan
const encodedWithout0x = encoded.slice(2);

console.log('=== Constructor Arguments (ABI-encoded) ===');
console.log('Copy this for BSCScan verification:\n');
console.log(encodedWithout0x);
console.log('\n=== Parameter Details ===');
params.forEach((param, i) => {
  console.log(`${i + 1}. ${types[i]}: ${param}`);
});
