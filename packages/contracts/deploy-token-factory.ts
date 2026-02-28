import hre from "hardhat";

async function main() {
    const [deployer] = await hre.ethers.getSigners();
    console.log("Deployer:", deployer.address);

    const TREASURY = deployer.address;
    const CREATION_FEE = hre.ethers.parseEther('0.1');

    console.log("Deploying SimpleTokenFactory with fee: 0.1 ETH");
    const STF = await hre.ethers.getContractFactory('SimpleTokenFactory');
    const stf = await STF.deploy(TREASURY, CREATION_FEE);
    await stf.waitForDeployment();
    const addr = await stf.getAddress();
    console.log("SimpleTokenFactory deployed at:", addr);
}
main().catch(console.error);
