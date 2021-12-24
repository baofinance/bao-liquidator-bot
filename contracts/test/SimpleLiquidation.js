const { expect } = require("chai");
const { ethers } = require("hardhat");

//Contract References
var DAIContract;
var liquidationControllerContract;

//Contract Addresses
const dbEthAddress = "0x1d2728a36dC794e92374e629cC0e7F25C7f60162";
const liquidationControllerAddress = "0x02382e1A778541389EcEA16fFb2c765a8Ea27d16";
const DAIAddress = "0xf80A32A835F79D7787E8a8ee5721D0fEaFd78108";

var user1;
var user2;

describe("Basic Tests", async function () { 
    
    it("Load Contracts", async function () {
        //DAIContract = await ethers.getContractAt("contracts/BaoInterfaces/bdToken.sol:bdToken",DAIAddress);
        
        liquidationControllerContract = await ethers.getContractAt("LiquidationController",liquidationControllerAddress);
    });
    
    it("Simple Liquidation", async function () {
        //console.log("DAI balance before liquidation: ", (await DAIContract.balanceOf("0x02382e1A778541389EcEA16fFb2c765a8Ea27d16")).toString());
        //We know 0xC189Ca9C9168004B3c0eED5409c15A88B87a0702 is in debt
        /*
        const liquidationTx = liquidationControllerContract.executeLiquidation(["0xC189Ca9C9168004B3c0eED5409c15A88B87a0702"],[1000000],[dbEthAddress],1000000);
        await liquidationTx.wait();
        console.log("DAI balance after liquidation: ", (await DAIContract.balanceOf("0x02382e1A778541389EcEA16fFb2c765a8Ea27d16")).toString());

        expect(await DAIContract.balanceOf("0x02382e1A778541389EcEA16fFb2c765a8Ea27d16")).to.be.above(await DAIContract.balanceOf("0x02382e1A778541389EcEA16fFb2c765a8Ea27d16"));
        */
    });
    
});