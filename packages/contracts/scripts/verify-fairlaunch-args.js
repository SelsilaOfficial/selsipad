// Constructor arguments for Fairlaunch contract verification
// Contract: 0x7f792b1dafc483a551c34468fb9098bff465e507
// Network: BSC Testnet (Chain ID 97)

const { parseEther } = require('ethers');

module.exports = [
  // address _projectToken - SPP Token
  '0xf112f84e36599a3B8ca56e5374A66cf1133cA8b6',
  
  // address _paymentToken - address(0) for native BNB
  '0x0000000000000000000000000000000000000000',
  
  // uint256 _softcap - 5 BNB in wei
  parseEther('5'),
  
  // uint256 _tokensForSale - 4500000 tokens (18 decimals)
 parseEther('4500000'),
  
  // uint256 _minContribution - 0.5 BNB in wei
  parseEther('0.5'),
  
  // uint256 _maxContribution - 1 BNB in wei
  parseEther('1'),
  
  // uint256 _startTime - Unix timestamp
  Math.floor(new Date('2026-01-31T04:35:00Z').getTime() / 1000),
  
  // uint256 _endTime - Unix timestamp
  Math.floor(new Date('2026-02-07T22:29:00Z').getTime() / 1000),
  
  // uint16 _listingPremiumBps - 0 (no premium)
  0,
  
  // address _feeSplitter - FeeSplitter contract on BSC Testnet
  '0x2672af17eA89bc5e46BB52385C45Cb42e5eC8C48',
  
  // address _teamVesting - Vesting vault (same as contract in this case)
  '0x7f792b1daFC483A551c34468fb9098Bff465e507',
  
  // address _projectOwner - Creator wallet address (need from database)
  '0xe677CB29436F0BE225B174D5434fB8a04231069E',  // From created_by user's wallet
  
  // address _adminExecutor - Platform admin
  '0xe677CB29436F0BE225B174D5434fB8a04231069E',  // Same as deployer for now
  
  // uint256 _liquidityPercent - 70% = 7000 BPS
  7000,
  
  // uint256 _lpLockMonths - 24 months
  24,
  
  // bytes32 _dexId - PancakeSwap identifier
  '0x50616e63616b6553776170000000000000000000000000000000000000000000', // "PancakeSwap" in bytes32
];
