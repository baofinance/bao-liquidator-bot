const { expect } = require('chai')
const { ethers } = require('hardhat')

// TODO- set up deployment of BAO Markets contracts, AAVE markets, and Curve pools for full coverage testing
describe('LiquidationController Contract', () => {
  let LiquidationController, contract, address

  beforeEach(async () => {
    LiquidationController = await ethers.getContractFactory(
      'LiquidationController',
    )
    address = (await ethers.getSigners())[0].address
    contract = await LiquidationController.deploy()

    await deployMarketsContracts()
  })

  describe('Deployment', () => {
    it('Should set the correct contract owner', async () => {
      expect(await contract.owner()).to.eq(address)
    })

    // etc.
  })

  describe('Liquidations', () => {
    it('Should liquidate a single user with total debt >= total collateral', () => {
      // ...
    })

    it('Should liquidate a single user with total debt <= total collateral', () => {
      // ...
    })

    it('Should liquidate 5 users', () => {
      // ...
    })

    it('Should liquidate 10 users', () => {
      // ...
    })

    // etc.
  })
})

// Taken from https://github.com/baofinance/bao-markets-contracts/blob/master/scripts/1_DeployContracts.js
async function deployMarketsContracts() {
  let unitrollerContract
  let comptrollerContract
  let originalcomptrollerAddress
  let ERC20Contract
  let USDCERC20Contract
  let USDCMockFeedContract
  let JumpRateModelContract
  let USDCJumpRateModelContract
  let cERC20ImmunatbleContract
  let cUSDCImmunatbleContract
  let fedContract
  let oracleContract
  let mockFeedContract
  let CEtherContract
  let WhitePaperModelContract

  ////////////////////////////////////////
  // Contract Deployments
  ////////////////////////////////////////

  // Deploy Oracle
  const oracleFactory = await ethers.getContractFactory('Oracle')
  oracleContract = await oracleFactory.deploy()
  await oracleContract.deployTransaction.wait()

  // Deploy Mock Price Feed
  const mockFeedFactory = await ethers.getContractFactory('MockPriceFeed')
  // Deploy ETH Mock Price Feed
  mockFeedContract = await mockFeedFactory.deploy()
  await mockFeedContract.deployTransaction.wait()
  // Deploy USDC Mock Price Feed
  USDCMockFeedContract = await mockFeedFactory.deploy()
  await USDCMockFeedContract.deployTransaction.wait()

  // Deploy Comptroller
  const comptrollerFactory = await ethers.getContractFactory(
    'contracts/bao-markets-contracts/contracts/Comptroller.sol:Comptroller',
  )
  comptrollerContract = await comptrollerFactory.deploy()
  await comptrollerContract.deployTransaction.wait()
  originalcomptrollerAddress = comptrollerContract.address
  // Deploy Unitroller
  const unitrollerFactory = await ethers.getContractFactory(
    'contracts/bao-markets-contracts/contracts/Unitroller.sol:Unitroller',
  )
  unitrollerContract = await unitrollerFactory.deploy()
  await unitrollerContract.deployTransaction.wait()
  // Set Implementation for Unitroller
  const setPendingImplementationTx =
    await unitrollerContract._setPendingImplementation(
      comptrollerContract.address,
    )
  await setPendingImplementationTx.wait()
  const setApproveNewImplementationTx = await comptrollerContract._become(
    unitrollerContract.address,
  )
  await setApproveNewImplementationTx.wait()
  // We are addressing the Unitroller, which delegates to comptroller
  comptrollerContract = await ethers.getContractAt(
    'Comptroller',
    unitrollerContract.address,
  )

  // Deploy synth ERC20 (Underlying token)
  const ERC20Factory = await ethers.getContractFactory(
    'contracts/bao-markets-contracts/contracts/Fed.sol:ERC20',
  )
  ERC20Contract = await ERC20Factory.deploy('Bao USD', 'bUSD', '18')
  await ERC20Contract.deployTransaction.wait()
  // Deploy USDC ERC20
  USDCERC20Contract = await ERC20Factory.deploy('USD Coin', 'USDC', '6')
  await USDCERC20Contract.deployTransaction.wait()

  // Deploy InterestRateModel
  // For Synth
  const JumpRateModelFactory = await ethers.getContractFactory(
    'JumpRateModelV2',
  )
  JumpRateModelContract = await JumpRateModelFactory.deploy(
    '0', // uint baseRatePerYear
    '39999999999981600', // uint multiplierPerYear
    '1499999999998520000', // uint jumpMultiplierPerYear
    '750000000000000000', // uint kink_
    (
      await ethers.getSigners()
    )[0].address, // address owner_
  )
  await JumpRateModelContract.deployTransaction.wait()
  // For USDC
  USDCJumpRateModelContract = await JumpRateModelFactory.deploy(
    '0', // uint baseRatePerYear
    '39999999999981600', // uint multiplierPerYear
    '1499999999998520000', // uint jumpMultiplierPerYear
    '750000000000000000', // uint kink_
    (
      await ethers.getSigners()
    )[0].address, // address owner_
  )
  await USDCJumpRateModelContract.deployTransaction.wait()
  // For ETH
  const WhitePaperModelFactory = await ethers.getContractFactory(
    'WhitePaperInterestRateModel',
  )
  WhitePaperModelContract = await WhitePaperModelFactory.deploy(
    '0',
    '39999999999981600',
  )
  await WhitePaperModelContract.deployTransaction.wait()

  // Deploy bdSynth
  const cERC20ImmunatbleFactory = await ethers.getContractFactory(
    'CErc20Immutable',
  )
  cERC20ImmunatbleContract = await cERC20ImmunatbleFactory.deploy(
    ERC20Contract.address, // address underlying_
    unitrollerContract.address, // ComptrollerInterface comptroller_
    JumpRateModelContract.address, // InterestRateModel interestRateModel_
    '200000000000000000', // uint initialExchangeRateMantissa_
    'bao deposited bUSD', // string memory name_
    'bdUSD', // string memory symbol_
    '8', // uint8 decimals_
    (
      await ethers.getSigners()
    )[0].address, // address payable admin_
  )
  await cERC20ImmunatbleContract.deployTransaction.wait()
  // Deploy bdUSDC
  cUSDCImmunatbleContract = await cERC20ImmunatbleFactory.deploy(
    USDCERC20Contract.address, // address underlying_
    unitrollerContract.address, // ComptrollerInterface comptroller_
    USDCJumpRateModelContract.address, // InterestRateModel interestRateModel_
    '200000000000000000', // uint initialExchangeRateMantissa_
    'bao deposited USDC', // string memory name_
    'bdUSDC', // string memory symbol_
    '8', // uint8 decimals_
    (
      await ethers.getSigners()
    )[0].address, // address payable admin_
  )
  await cUSDCImmunatbleContract.deployTransaction.wait()
  // Deploy bdETH
  const CEtherFactory = await ethers.getContractFactory(
    'contracts/bao-markets-contracts/contracts/CEther.sol:CEther',
  )
  CEtherContract = await CEtherFactory.deploy(
    unitrollerContract.address, // ComptrollerInterface comptroller_
    WhitePaperModelContract.address, // InterestRateModel interestRateModel_
    '200000000000000000', // uint initialExchangeRateMantissa_
    'bao deposited ETH', // string memory name_
    'bdETH', // string memory symbol_
    '8', // uint8 decimals_
    (
      await ethers.getSigners()
    )[0].address, // address payable admin_
  )
  await CEtherContract.deployTransaction.wait()

  // Deploy Fed
  const fedFactory = await ethers.getContractFactory('Fed')
  fedContract = await fedFactory.deploy(
    cERC20ImmunatbleContract.address,
    (
      await ethers.getSigners()
    )[0].address,
  ) // CErc20 ctoken_, address gov_
  await fedContract.deployTransaction.wait()

  ////////////////////////////////////////
  // Configurations
  ////////////////////////////////////////

  // Set Eth Price
  let setPriceTx = await mockFeedContract.setPrice(4800 * 1e8)
  await setPriceTx.wait()
  let setDecimalesTx = await mockFeedContract.setDecimals(8)
  await setDecimalesTx.wait()
  // Set USDC Price
  setPriceTx = await USDCMockFeedContract.setPrice(1e8)
  await setPriceTx.wait()
  setDecimalesTx = await USDCMockFeedContract.setDecimals(8)
  await setDecimalesTx.wait()
  // Set USDC erc20 price feed
  const setUSDCPriceTx = await oracleContract.setFeed(
    cUSDCImmunatbleContract.address,
    USDCMockFeedContract.address,
    '6',
  )
  await setUSDCPriceTx.wait()
  // Set fixed 1USD price feed for Synth
  const setSynthPriceTx = await oracleContract.setFixedPrice(
    cERC20ImmunatbleContract.address,
    '1000000000000000000',
  )
  await setSynthPriceTx.wait()
  // Set Ethereum price feed
  const setEthPriceTx = await oracleContract.setFeed(
    CEtherContract.address,
    mockFeedContract.address,
    '18',
  )
  await setEthPriceTx.wait()

  // Set the oracle for price queries
  const setOracleTx = await comptrollerContract._setPriceOracle(
    oracleContract.address,
  )
  await setOracleTx.wait()
  // Set the close Factor
  const setCloseFactorTx = await comptrollerContract._setCloseFactor(
    '500000000000000000',
  )
  await setCloseFactorTx.wait()
  // Set Liquidation Incentive
  const setLiquidationIncentiveTx =
    await comptrollerContract._setLiquidationIncentive('1100000000000000000')
  await setLiquidationIncentiveTx.wait()
  // Create Synth Market
  const setERC20MarketTx = await comptrollerContract._supportMarket(
    cERC20ImmunatbleContract.address,
  )
  await setERC20MarketTx.wait()
  // Create ETH Market
  const setEthMarketTx = await comptrollerContract._supportMarket(
    CEtherContract.address,
  )
  await setEthMarketTx.wait()
  // Create USDC Market
  const setUSDCMarketTx = await comptrollerContract._supportMarket(
    cUSDCImmunatbleContract.address,
  )
  await setUSDCMarketTx.wait()
  // Set the CollateralFactor for Synth
  const setCollateralFactor1Tx = await comptrollerContract._setCollateralFactor(
    cERC20ImmunatbleContract.address,
    '750000000000000000',
  )
  await setCollateralFactor1Tx.wait()
  // Set the CollateralFactor for Eth
  const setCollateralFactor2Tx = await comptrollerContract._setCollateralFactor(
    CEtherContract.address,
    '750000000000000000',
  )
  await setCollateralFactor2Tx.wait()
  // Set the CollateralFactor for USDC
  const setCollateralFactor3Tx = await comptrollerContract._setCollateralFactor(
    cUSDCImmunatbleContract.address,
    '750000000000000000',
  )
  await setCollateralFactor3Tx.wait()
  // Set the IMFFactor for Synth
  const setIMFFactor1Tx = await comptrollerContract._setIMFFactor(
    cERC20ImmunatbleContract.address,
    '40000000000000000',
  )
  await setIMFFactor1Tx.wait()
  // Set the IMFFactor for ETH
  const setIMFFactor2Tx = await comptrollerContract._setIMFFactor(
    CEtherContract.address,
    '40000000000000000',
  )
  await setIMFFactor2Tx.wait()
  // Set the IMFFactor for USDC
  const setIMFFactor3Tx = await comptrollerContract._setIMFFactor(
    cUSDCImmunatbleContract.address,
    '40000000000000000',
  )
  await setIMFFactor3Tx.wait()

  // Allow Fed to mint the synths
  let addMinterTx = await ERC20Contract.addMinter(fedContract.address)
  await addMinterTx.wait()
  // ONLY FOR TESTS: allow user to mint
  addMinterTx = await ERC20Contract.addMinter(
    (
      await ethers.getSigners()
    )[0].address,
  )
  await addMinterTx.wait()
  addMinterTx = await USDCERC20Contract.addMinter(
    (
      await ethers.getSigners()
    )[0].address,
  )
  await addMinterTx.wait()

  // Fed expansion (aka minting synth tokens and depositing them into the protocol)
  const expansionTx = await fedContract.expansion(
    ethers.utils.parseEther('1000000'),
  )
  expansionTx.wait()

  // In order for the subgraph to work, we accrue interest once for every bdToken
  let accrueTx = await cERC20ImmunatbleContract.accrueInterest()
  await accrueTx.wait()
  accrueTx = await cUSDCImmunatbleContract.accrueInterest()
  await accrueTx.wait()
  accrueTx = await CEtherContract.accrueInterest()
  await accrueTx.wait()
}
