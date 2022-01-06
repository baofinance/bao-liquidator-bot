const { expect } = require("chai");
const { ethers } = require("hardhat");

//Contract Addresses
const dbEthAddress = "0x1d2728a36dC794e92374e629cC0e7F25C7f60162";


async function main() {  
    const liquidatorFactory = await ethers.getContractFactory("LiquidationController");
    liquidatorContract = await liquidatorFactory.deploy();
    await liquidatorContract.deployTransaction.wait();
    console.log("Liquidator Deployed");
}
  
main()
  .then(() => process.exit(0))
  .catch((error) => {
      console.error(error);
      process.exit(1);
  });
  