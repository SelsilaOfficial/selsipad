// Verification args for PLN Fairlaunch deployed at 0xc009b2895db5972187f1289e06cba8be22eacd9a
module.exports = [
  '0x1b56c5c186409d39f6d5be3d9d7f296c036fa7bd', // _projectToken (PLN)
  '0x0000000000000000000000000000000000000000', // _paymentToken (native BNB)
  '5000000000000000000', // _softcap (5 BNB)
  '400000000000000000000000', // _tokensForSale (400k)
  '1000000000000000000', // _minContribution (1 BNB)
  '2000000000000000000', // _maxContribution (2 BNB)
  1738544460, // _startTime
  1738683120, // _endTime
  0, // _listingPremiumBps
  '0xaC89Bf746dAf1c782Ed87e81a89fe8885CF979F5', // _feeSplitter (creator wallet)
  '0x9da91cdb79801eb8efe403bbe3be0c0ddeabcefe', // _teamVesting (vesting vault)
  '0xac89bf746daf1c782ed87e81a89fe8885cf979f5', // _projectOwner
  '0x10250daee0bab6bf0f776ad17b11e09da9db2b81', // _adminExecutor (factory)
  8000, // _liquidityPercent (80%)
  12, // _lpLockMonths
  '0x44b130da344ce78c279a725bb0862809b89743da8cdf9656b514371df49c2ef5', // _dexId (PancakeSwap V2)
];
