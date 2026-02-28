import hre from "hardhat";

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    let currentNonce = await hre.ethers.provider.getTransactionCount(deployer.address, "latest");
    console.log("Deployer:", deployer.address);
    console.log("Starting nonce:", currentNonce);

    const TREASURY = deployer.address;
    const ADMIN = deployer.address;
    const fsAddr = "0x199A6AE884baF4D596DCdFa5925A196fbde8cdbF".toLowerCase();
    const DEPLOYMENT_FEE = hre.ethers.parseEther('0.005');

    // Deploy EscrowVault
    console.log("\n1. Deploying EscrowVault, nonce", currentNonce);
    const EscrowVault = await hre.ethers.getContractFactory('EscrowVault');
    const escrowVault = await EscrowVault.deploy({ nonce: currentNonce++ });
    await escrowVault.waitForDeployment();
    const escrowAddr = await escrowVault.getAddress();
    console.log("✅ EscrowVault:", escrowAddr);

    // Deploy FairlaunchFactory
    console.log("\n2. Deploying FairlaunchFactory, nonce", currentNonce);
    const FairlaunchFactory = await hre.ethers.getContractFactory('FairlaunchFactory');
    const flFactory = await FairlaunchFactory.deploy(DEPLOYMENT_FEE, fsAddr, TREASURY, ADMIN, { nonce: currentNonce++ });
    await flFactory.waitForDeployment();
    const factoryAddr = await flFactory.getAddress();
    console.log("✅ FairlaunchFactory:", factoryAddr);

    // Verify
    console.log("\n=== Verification ===");
    console.log("DEPLOYMENT_FEE:", (await flFactory.DEPLOYMENT_FEE()).toString());
    console.log("treasuryWallet:", await flFactory.treasuryWallet());
    console.log("adminExecutor:", await flFactory.adminExecutor());
}
main().catch(console.error);
