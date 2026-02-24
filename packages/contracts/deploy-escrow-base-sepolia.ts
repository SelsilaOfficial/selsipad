import hre from "hardhat";

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    let currentNonce = await hre.ethers.provider.getTransactionCount(deployer.address, "latest");
    console.log("Starting nonce:", currentNonce);

    console.log("Deploying EscrowVault, nonce", currentNonce);
    const EscrowVault = await hre.ethers.getContractFactory('EscrowVault');
    const escrowVault = await EscrowVault.deploy({ nonce: currentNonce++ });
    await escrowVault.waitForDeployment();
    const address = await escrowVault.getAddress();
    console.log("✅ EscrowVault:", address);
}
main().catch(console.error);
