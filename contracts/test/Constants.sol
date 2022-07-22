pragma solidity ^0.8.0;

import {ICToken} from "../src/interfaces/ICToken.sol";
import {IRecipe} from "../src/interfaces/IRecipe.sol";
import {ILendingRegistry} from "../src/interfaces/ILendingRegistry.sol";
import {IBasketFacet} from "../src/interfaces/IBasketFacet.sol";

contract Constants {

    /////////////////////////
    //        TOKENS       // 
    /////////////////////////

    ICToken public bdUSD = ICToken(0xc0601094C0C88264Ba285fEf0a1b00eF13e79347);
    ICToken public bdETH = ICToken(0xF635fdF9B36b557bD281aa02fdfaeBEc04CD084A);

    address public bSTBL = 0x5ee08f40b637417bcC9d2C51B62F4820ec9cF5D8;
    address public bUSD = 0x7945b0A6674b175695e5d1D08aE1e6F13744Abb0;

    address public aUSDC = 0xBcca60bB61934080951369a648Fb03DF4F96263C;
    address public aRAI = 0xc9BC48c72154ef3e5425641a3c747242112a46AF;
    address public aFEI = 0x683923dB55Fead99A79Fa01A27EeC3cB19679cC3;
    address public aDAI = 0x028171bCA77440897B824Ca71D1c56caC55b68A3;
    address public aFRAX = 0xd4937682df3C8aEF4FE912A96A74121C0829E664;

    address public USDC = 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48;
    address public RAI = 0x03ab458634910AaD20eF5f1C8ee96F1D6ac54919;
    address public FEI = 0x956F47F50A910163D8BF957Cf5846D573E7f87CA;
    address public DAI = 0x6B175474E89094C44Da98b954EedeAC495271d0F;
    address public FRAX = 0x853d955aCEf822Db058eb8505911ED77F175b99e;

    address public USDCFeed = 0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6;
    address public RAIFeed = 0x483d36F6a1d063d580c7a24F9A42B346f3a69fbb;
    address public FEIFeed = 0x31e0a88fecB6eC0a411DBe0e9E76391498296EE9;
    address public DAIFeed = 0xAed0c38402a5d19df6E4c03F4E2DceD6e29c1ee9;
    address public FRAXFeed = 0xB9E1E3A9feFf48998E45Fa90847ed4D467E8BcfD;  

    /////////////////////////
    //       Protocol      //
    /////////////////////////

    address public admin = 0xFC69e0a5823E2AfCBEb8a35d33588360F1496a00;
    address public oracle = 0xEbdC2D2a203c17895Be0daCdf539eeFC710eaFd8;
    address public unitroller = 0x0Be1fdC1E87127c4fe7C05bAE6437e3cf90Bf8d8; //Comptroller interface
    address public usdcInterestRateModel = 0x681Cf55f0276126FAD8842133C839AB4D607E729;
    address public recipe = 0xac0fE9F363c160c281c81DdC49d0AA8cE04C02Eb;
    address public fed = 0xD79046A1964F2C40B103Caac3fAe95BAa49E6624;
    ILendingRegistry public lendingRegistry = ILendingRegistry(0x08a2b7D713e388123dc6678168656659d297d397);
    address public bSTBLLendingManager = 0x5C0AfEf620f512e2FA65C765A72fa46f9A41C6BD;

    /////////////////////////
    //        Users        //
    ///////////////////////// 

    //Anvil addresses
    address public user1 = 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266;
    address public user2 = 0x70997970C51812dc3A010C7d01b50e0d17dc79C8;
    address public user3 = 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC;

    /////////////////////////
    //        Other        //
    /////////////////////////    

    address public aaveLendingPool = 0x7d2768dE32b0b80b7a3454c06BdAc94A69DDc7A9;
    address public raiCurvePool = 0x618788357D0EBd8A37e763ADab3bc575D54c2C7d;      
}
