const hre = require("hardhat");
const { ethers } = hre;

async function main() {
  const BLUECHECK_ADDRESS = "0xfFaB42EcD7Eb0a85b018516421C9aCc088aC7157";

  const signers = await ethers.getSigners();
  const deployer = signers[2]; // Use a fresh account
  const referrer = signers[1];
  console.log("Purchaser wallet:", deployer.address);
  console.log("Referrer wallet:", referrer.address);

  const abi = [
    "function purchaseBlueCheck(address _referrer) external payable",
    "function getRequiredBNB() external view returns (uint256)"
  ];

  const bluecheck = new ethers.Contract(BLUECHECK_ADDRESS, abi, deployer);

  const cost = await bluecheck.getRequiredBNB();
  console.log("Cost to buy BlueCheck:", ethers.formatEther(cost), "BNB");

  console.log("Buying BlueCheck for test...");
  const tx = await bluecheck.purchaseBlueCheck(referrer.address, { value: cost });
  await tx.wait();
  console.log("Buy successful! Tx Hash:", tx.hash);
}

main().catch(console.error);
