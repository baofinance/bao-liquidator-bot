const { ethers } = require("hardhat");

async function main() {    
    var unitrollerContract;
    var comptrollerContract;
    var ERC20Contract;
    var USDCERC20Contract;
    var USDCMockFeedContract;
    var JumpRateModelContract;
    var USDCJumpRateModelContract;
    var cERC20ImmunatbleContract;
    var cUSDCImmunatbleContract;
    var fedContract;
    var oracleContract;
    var mockFeedContract;
    var CEtherContract;
    var WhitePaperModelContract;

    await deployProtocol();
    await createUnderWaterPosition();
    await createCurvePool();
    await liquidate();

    async function deployProtocol(){
        ////////////////////////////////////////
        //Contract Deployments
        ////////////////////////////////////////

        //Deploy Oracle 
        const oracleFactory = await ethers.getContractFactory("Oracle");
        oracleContract = await oracleFactory.deploy();
        await oracleContract.deployTransaction.wait();
        console.log("Oracle Deployed");

        //Deploy Mock Price Feed
        var mockFeedFactory = await ethers.getContractFactory("MockPriceFeed");
        //Deploy ETH Mock Price Feed 
        mockFeedContract = await mockFeedFactory.deploy();
        await mockFeedContract.deployTransaction.wait();
        //Deploy USDC Mock Price Feed
        USDCMockFeedContract = await mockFeedFactory.deploy();
        await USDCMockFeedContract.deployTransaction.wait();
        console.log("Price Feeds Deployed");

        // Deploy Comptroller
        const comptrollerFactory = await ethers.getContractFactory("Comptroller");
        comptrollerContract = await comptrollerFactory.deploy();
        await comptrollerContract.deployTransaction.wait();
        originalcomptrollerAddress = comptrollerContract.address;
        // Deploy Unitroller
        const unitrollerFactory = await ethers.getContractFactory("contracts/Unitroller.sol:Unitroller");
        unitrollerContract = await unitrollerFactory.deploy();
        await unitrollerContract.deployTransaction.wait();
        //Set Implementation for Unitroller
        const setPendingImplementationTx = await unitrollerContract._setPendingImplementation(comptrollerContract.address);
        await setPendingImplementationTx.wait();
        const setApproveNewImplementationTx = await comptrollerContract._become(unitrollerContract.address);
        await setApproveNewImplementationTx.wait();
        //We are addressing the Unitroller, which delegates to comptroller
        comptrollerContract = await ethers.getContractAt("Comptroller", unitrollerContract.address);
        console.log("Comptroller Deployed");

        // Deploy synth ERC20 (Underlying token)
        const ERC20Factory = await ethers.getContractFactory("contracts/Fed.sol:ERC20");
        ERC20Contract = await ERC20Factory.deploy("Bao USD","bUSD","18");
        await ERC20Contract.deployTransaction.wait();
        // Deploy USDC ERC20
        USDCERC20Contract = await ERC20Factory.deploy("USD Coin","USDC","6");
        await USDCERC20Contract.deployTransaction.wait(); 
        console.log("ERC20s Deployed");

        // Deploy InterestRateModel
        //For Synth
        const JumpRateModelFactory = await ethers.getContractFactory("JumpRateModelV2");
        JumpRateModelContract = await JumpRateModelFactory.deploy(
            "0", //uint baseRatePerYear
            "39999999999981600", //uint multiplierPerYear
            "1499999999998520000", //uint jumpMultiplierPerYear
            "750000000000000000", //uint kink_
            (await ethers.getSigners())[0].address //address owner_
        );
        await JumpRateModelContract.deployTransaction.wait();
        //For USDC 
        USDCJumpRateModelContract = await JumpRateModelFactory.deploy(
            "0", //uint baseRatePerYear
            "39999999999981600", //uint multiplierPerYear
            "1499999999998520000", //uint jumpMultiplierPerYear
            "750000000000000000", //uint kink_
            (await ethers.getSigners())[0].address //address owner_
        );
        await USDCJumpRateModelContract.deployTransaction.wait(); 
        // For ETH
        const WhitePaperModelFactory = await ethers.getContractFactory("WhitePaperInterestRateModel");
        WhitePaperModelContract = await WhitePaperModelFactory.deploy("0","39999999999981600");
        await WhitePaperModelContract.deployTransaction.wait(); 
        console.log("Interest Rates Deployed");
        
        //Deploy bdSynth
        const cERC20ImmunatbleFactory = await ethers.getContractFactory("CErc20Immutable");
        cERC20ImmunatbleContract = await cERC20ImmunatbleFactory.deploy(
            ERC20Contract.address,  //address underlying_
            unitrollerContract.address, //ComptrollerInterface comptroller_
            JumpRateModelContract.address,  //InterestRateModel interestRateModel_
            "200000000000000000",   //uint initialExchangeRateMantissa_
            "bao deposited bUSD",   //string memory name_
            "bdUSD",   //string memory symbol_
            "8",   //uint8 decimals_
            (await ethers.getSigners())[0].address //address payable admin_
        );
        await cERC20ImmunatbleContract.deployTransaction.wait();     
        //Deploy bdUSDC
        cUSDCImmunatbleContract = await cERC20ImmunatbleFactory.deploy(
            USDCERC20Contract.address,  //address underlying_
            unitrollerContract.address, //ComptrollerInterface comptroller_
            USDCJumpRateModelContract.address,  //InterestRateModel interestRateModel_
            "200000000000000000",   //uint initialExchangeRateMantissa_
            "bao deposited USDC",   //string memory name_
            "bdUSDC",   //string memory symbol_
            "8",   //uint8 decimals_
            (await ethers.getSigners())[0].address //address payable admin_
        );
        await cUSDCImmunatbleContract.deployTransaction.wait();
        //Deploy bdETH
        const CEtherFactory = await ethers.getContractFactory("contracts/CEther.sol:CEther");
        CEtherContract = await CEtherFactory.deploy(
            unitrollerContract.address, //ComptrollerInterface comptroller_
            WhitePaperModelContract.address,  //InterestRateModel interestRateModel_
            "200000000000000000",   //uint initialExchangeRateMantissa_
            "bao deposited ETH",   //string memory name_
            "bdETH",   //string memory symbol_
            "8",   //uint8 decimals_
            (await ethers.getSigners())[0].address  //address payable admin_
        );
        await CEtherContract.deployTransaction.wait();
        console.log("bdTokens Deployed");

        //Deploy Fed
        const fedFactory = await ethers.getContractFactory("Fed");
        fedContract = await fedFactory.deploy(cERC20ImmunatbleContract.address, (await ethers.getSigners())[0].address); //CErc20 ctoken_, address gov_ 
        await fedContract.deployTransaction.wait();
        console.log("Fed Deployed");

        ////////////////////////////////////////
        //Configurations
        ////////////////////////////////////////

        //Set Eth Price
        var setPriceTx = await mockFeedContract.setPrice("100000000000");
        await setPriceTx.wait();
        var setDecimalesTx = await mockFeedContract.setDecimals(8);
        await setDecimalesTx.wait();
        //Set USDC Price
        setPriceTx = await USDCMockFeedContract.setPrice("100000000");
        await setPriceTx.wait();
        setDecimalesTx = await USDCMockFeedContract.setDecimals(8);
        await setDecimalesTx.wait(); 
        //Set USDC erc20 price feed
        const setUSDCPriceTx = await oracleContract.setFeed(cUSDCImmunatbleContract.address, USDCMockFeedContract.address, "6");
        await setUSDCPriceTx.wait();
        //Set fixed 1USD price feed for Synth
        setSynthPriceTx = await oracleContract.setFixedPrice(cERC20ImmunatbleContract.address, "1000000000000000000");
        await setSynthPriceTx.wait();
        //Set Ethereum price feed
        const setEthPriceTx = await oracleContract.setFeed(CEtherContract.address, mockFeedContract.address, "18");
        await setEthPriceTx.wait();
        console.log("Price Feeds configured");
    
        //Set the ReserveFactor for Synth 
        const setReserveFactor1Tx = await cERC20ImmunatbleContract._setReserveFactor("500000000000000000");
        await setReserveFactor1Tx.wait();
        //Set the ReserveFactor for ETH 
        const setReserveFactor2Tx = await CEtherContract._setReserveFactor("500000000000000000");
        await setReserveFactor2Tx.wait();
        //Set the ReserveFactor for USDC 
        const setReserveFactor3Tx = await cUSDCImmunatbleContract._setReserveFactor("500000000000000000");
        await setReserveFactor3Tx.wait();
        console.log("dbTokens configured");

        //Set the oracle for price queries
        const setOracleTx = await comptrollerContract._setPriceOracle(oracleContract.address);
        await setOracleTx.wait();
        //Set the close Factor
        const setCloseFactorTx = await comptrollerContract._setCloseFactor("500000000000000000");
        await setCloseFactorTx.wait();
        //Set Liquidation Incentive
        const setLiquidationIncentiveTx = await comptrollerContract._setLiquidationIncentive("1100000000000000000");
        await setLiquidationIncentiveTx.wait();
        //Create Synth Market
        const setERC20MarketTx = await comptrollerContract._supportMarket(cERC20ImmunatbleContract.address);
        await setERC20MarketTx.wait();
        //Create ETH Market
        const setEthMarketTx = await comptrollerContract._supportMarket(CEtherContract.address);
        await setEthMarketTx.wait();
        //Create USDC Market
        const setUSDCMarketTx = await comptrollerContract._supportMarket(cUSDCImmunatbleContract.address);
        await setUSDCMarketTx.wait();
        //Set the CollateralFactor for Synth
        const setCollateralFactor1Tx = await comptrollerContract._setCollateralFactor(cERC20ImmunatbleContract.address, "750000000000000000");
        await setCollateralFactor1Tx.wait();
        //Set the CollateralFactor for Eth
        const setCollateralFactor2Tx = await comptrollerContract._setCollateralFactor(CEtherContract.address, "750000000000000000");
        await setCollateralFactor2Tx.wait();
        //Set the CollateralFactor for USDC
        const setCollateralFactor3Tx = await comptrollerContract._setCollateralFactor(cUSDCImmunatbleContract.address, "750000000000000000");
        await setCollateralFactor3Tx.wait();
        //Set the IMFFactor for Synth
        const setIMFFactor1Tx = await comptrollerContract._setIMFFactor(cERC20ImmunatbleContract.address, "40000000000000000");
        await setIMFFactor1Tx.wait();
        //Set the IMFFactor for ETH
        const setIMFFactor2Tx = await comptrollerContract._setIMFFactor(CEtherContract.address, "40000000000000000");
        await setIMFFactor2Tx.wait();
        //Set the IMFFactor for USDC
        const setIMFFactor3Tx = await comptrollerContract._setIMFFactor(cUSDCImmunatbleContract.address, "40000000000000000");
        await setIMFFactor3Tx.wait();
        //Set the Maximum amount of borrowed synth tokens 
        const setBorrowCapTx = await comptrollerContract._setMarketBorrowCaps([cERC20ImmunatbleContract.address],["1000000000000000000000000"]);
        await setBorrowCapTx.wait();  
        //Allow borrow of synths 
        const setBorrowRestrictionTx = await comptrollerContract._setBorrowRestriction([cERC20ImmunatbleContract.address],[false]);
        await setBorrowRestrictionTx.wait();    
        
        console.log("Comptroller Configured");

        //Allow Fed to mint the synths
        var addMinterTx = await ERC20Contract.addMinter(fedContract.address);
        await addMinterTx.wait();
        //ONLY FOR TESTS: allow user to mint
        addMinterTx = await ERC20Contract.addMinter((await ethers.getSigners())[0].address);
        await addMinterTx.wait();
        addMinterTx = await USDCERC20Contract.addMinter((await ethers.getSigners())[0].address);
        await addMinterTx.wait();
        console.log("Test Minters set");

        //fed expension (aka minting synth tokens and depositing them into the protocol)
        const expansionTx = await fedContract.expansion(ethers.utils.parseEther("1000000"));
        expansionTx.wait();
        console.log("Fed Expanded");

        //In order for the subgraph to work we accrue interest once for every bdToken
        var accrueTx = await cERC20ImmunatbleContract.accrueInterest();
        await accrueTx.wait();
        var accrueTx = await cUSDCImmunatbleContract.accrueInterest();
        await accrueTx.wait();
        var accrueTx = await CEtherContract.accrueInterest();
        await accrueTx.wait();
        console.log("Interests accrued");  
    }  

    async function createUnderWaterPosition(){
        //Deposit Collateral
        const mintEthTx = await CEtherContract.mint({value: ethers.utils.parseEther("10").toString()});
        mintEthTx.wait();
        //Make Collateral Usable
        const enterMarketTx = await comptrollerContract.enterMarkets([CEtherContract.address,cERC20ImmunatbleContract.address]);
        await enterMarketTx.wait();
        console.log("User Setup Complete");  

        //Borrow bUSD
        const borrowbUSDTx = await cERC20ImmunatbleContract.borrow(ethers.utils.parseEther("7500"));
        await borrowbUSDTx.wait();

        //Reduce Eth Price
        const reducePriceTx = await mockFeedContract.setPrice("85000000000");
        await reducePriceTx.wait();

        console.log("User Opened position and is under water");
    }

    async function createCurvePool(){
        //Deploy Curve Pool contract
        const curveFactoryABI = [
            {
                "inputs": [
                    {
                        "internalType": "address",
                        "name": "",
                        "type": "address"
                    },
                    {
                        "internalType": "address",
                        "name": "",
                        "type": "address"
                    }
                ],
                "name": "find_pool_for_coins",
                "outputs": [
                    {
                        "internalType": "address",
                        "name": "",
                        "type": "address"
                    }
                ],
                "stateMutability": "view",
                "type": "function"
            },
            {
                "inputs": [
                    {
                        "internalType": "address",
                        "name": "test",
                        "type": "address"
                    },
                    {
                        "internalType": "string",
                        "name": "",
                        "type": "string"
                    },
                    {
                        "internalType": "string",
                        "name": "",
                        "type": "string"
                    },
                    {
                        "internalType": "address",
                        "name": "",
                        "type": "address"
                    },
                    {
                        "internalType": "uint256",
                        "name": "",
                        "type": "uint256"
                    },
                    {
                        "internalType": "uint256",
                        "name": "",
                        "type": "uint256"
                    }
                ],
                "name": "deploy_metapool",
                "outputs": [
                    {
                        "internalType": "address",
                        "name": "",
                        "type": "address"
                    }
                ],
                "stateMutability": "nonpayable",
                "type": "function"
            },
            {
                "inputs": [],
                "name": "pool_count",
                "outputs": [
                    {
                        "internalType": "uint256",
                        "name": "",
                        "type": "uint256"
                    }
                ],
                "stateMutability": "view",
                "type": "function"
            },
            {
                "inputs": [
                    {
                        "internalType": "uint256",
                        "name": "",
                        "type": "uint256"
                    }
                ],
                "name": "pool_list",
                "outputs": [
                    {
                        "internalType": "address",
                        "name": "",
                        "type": "address"
                    }
                ],
                "stateMutability": "view",
                "type": "function"
            }
            
        ];

        const curvePoolABI = [
            {"name":"TokenExchange","inputs":[{"type":"address","name":"buyer","indexed":true},{"type":"int128","name":"sold_id","indexed":false},{"type":"uint256","name":"tokens_sold","indexed":false},{"type":"int128","name":"bought_id","indexed":false},{"type":"uint256","name":"tokens_bought","indexed":false}],"anonymous":false,"type":"event"},{"name":"AddLiquidity","inputs":[{"type":"address","name":"provider","indexed":true},{"type":"uint256[3]","name":"token_amounts","indexed":false},{"type":"uint256[3]","name":"fees","indexed":false},{"type":"uint256","name":"invariant","indexed":false},{"type":"uint256","name":"token_supply","indexed":false}],"anonymous":false,"type":"event"},{"name":"RemoveLiquidity","inputs":[{"type":"address","name":"provider","indexed":true},{"type":"uint256[3]","name":"token_amounts","indexed":false},{"type":"uint256[3]","name":"fees","indexed":false},{"type":"uint256","name":"token_supply","indexed":false}],"anonymous":false,"type":"event"},{"name":"RemoveLiquidityOne","inputs":[{"type":"address","name":"provider","indexed":true},{"type":"uint256","name":"token_amount","indexed":false},{"type":"uint256","name":"coin_amount","indexed":false}],"anonymous":false,"type":"event"},{"name":"RemoveLiquidityImbalance","inputs":[{"type":"address","name":"provider","indexed":true},{"type":"uint256[3]","name":"token_amounts","indexed":false},{"type":"uint256[3]","name":"fees","indexed":false},{"type":"uint256","name":"invariant","indexed":false},{"type":"uint256","name":"token_supply","indexed":false}],"anonymous":false,"type":"event"},{"name":"CommitNewAdmin","inputs":[{"type":"uint256","name":"deadline","indexed":true},{"type":"address","name":"admin","indexed":true}],"anonymous":false,"type":"event"},{"name":"NewAdmin","inputs":[{"type":"address","name":"admin","indexed":true}],"anonymous":false,"type":"event"},{"name":"CommitNewFee","inputs":[{"type":"uint256","name":"deadline","indexed":true},{"type":"uint256","name":"fee","indexed":false},{"type":"uint256","name":"admin_fee","indexed":false}],"anonymous":false,"type":"event"},{"name":"NewFee","inputs":[{"type":"uint256","name":"fee","indexed":false},{"type":"uint256","name":"admin_fee","indexed":false}],"anonymous":false,"type":"event"},{"name":"RampA","inputs":[{"type":"uint256","name":"old_A","indexed":false},{"type":"uint256","name":"new_A","indexed":false},{"type":"uint256","name":"initial_time","indexed":false},{"type":"uint256","name":"future_time","indexed":false}],"anonymous":false,"type":"event"},{"name":"StopRampA","inputs":[{"type":"uint256","name":"A","indexed":false},{"type":"uint256","name":"t","indexed":false}],"anonymous":false,"type":"event"},{"outputs":[],"inputs":[{"type":"address","name":"_owner"},{"type":"address[3]","name":"_coins"},{"type":"address","name":"_pool_token"},{"type":"uint256","name":"_A"},{"type":"uint256","name":"_fee"},{"type":"uint256","name":"_admin_fee"}],"stateMutability":"nonpayable","type":"constructor"},{"name":"A","outputs":[{"type":"uint256","name":""}],"inputs":[],"stateMutability":"view","type":"function","gas":5227},{"name":"get_virtual_price","outputs":[{"type":"uint256","name":""}],"inputs":[],"stateMutability":"view","type":"function","gas":1133537},{"name":"calc_token_amount","outputs":[{"type":"uint256","name":""}],"inputs":[{"type":"uint256[3]","name":"amounts"},{"type":"bool","name":"deposit"}],"stateMutability":"view","type":"function","gas":4508776},{"name":"add_liquidity","outputs":[],"inputs":[{"type":"uint256[3]","name":"amounts"},{"type":"uint256","name":"min_mint_amount"}],"stateMutability":"nonpayable","type":"function","gas":6954858},{"name":"get_dy","outputs":[{"type":"uint256","name":""}],"inputs":[{"type":"int128","name":"i"},{"type":"int128","name":"j"},{"type":"uint256","name":"dx"}],"stateMutability":"view","type":"function","gas":2673791},{"name":"get_dy_underlying","outputs":[{"type":"uint256","name":""}],"inputs":[{"type":"int128","name":"i"},{"type":"int128","name":"j"},{"type":"uint256","name":"dx"}],"stateMutability":"view","type":"function","gas":2673474},{"name":"exchange","outputs":[],"inputs":[{"type":"int128","name":"i"},{"type":"int128","name":"j"},{"type":"uint256","name":"dx"},{"type":"uint256","name":"min_dy"}],"stateMutability":"nonpayable","type":"function","gas":2818066},{"name":"remove_liquidity","outputs":[],"inputs":[{"type":"uint256","name":"_amount"},{"type":"uint256[3]","name":"min_amounts"}],"stateMutability":"nonpayable","type":"function","gas":192846},{"name":"remove_liquidity_imbalance","outputs":[],"inputs":[{"type":"uint256[3]","name":"amounts"},{"type":"uint256","name":"max_burn_amount"}],"stateMutability":"nonpayable","type":"function","gas":6951851},{"name":"calc_withdraw_one_coin","outputs":[{"type":"uint256","name":""}],"inputs":[{"type":"uint256","name":"_token_amount"},{"type":"int128","name":"i"}],"stateMutability":"view","type":"function","gas":1102},{"name":"remove_liquidity_one_coin","outputs":[],"inputs":[{"type":"uint256","name":"_token_amount"},{"type":"int128","name":"i"},{"type":"uint256","name":"min_amount"}],"stateMutability":"nonpayable","type":"function","gas":4025523},{"name":"ramp_A","outputs":[],"inputs":[{"type":"uint256","name":"_future_A"},{"type":"uint256","name":"_future_time"}],"stateMutability":"nonpayable","type":"function","gas":151919},{"name":"stop_ramp_A","outputs":[],"inputs":[],"stateMutability":"nonpayable","type":"function","gas":148637},{"name":"commit_new_fee","outputs":[],"inputs":[{"type":"uint256","name":"new_fee"},{"type":"uint256","name":"new_admin_fee"}],"stateMutability":"nonpayable","type":"function","gas":110461},{"name":"apply_new_fee","outputs":[],"inputs":[],"stateMutability":"nonpayable","type":"function","gas":97242},{"name":"revert_new_parameters","outputs":[],"inputs":[],"stateMutability":"nonpayable","type":"function","gas":21895},{"name":"commit_transfer_ownership","outputs":[],"inputs":[{"type":"address","name":"_owner"}],"stateMutability":"nonpayable","type":"function","gas":74572},{"name":"apply_transfer_ownership","outputs":[],"inputs":[],"stateMutability":"nonpayable","type":"function","gas":60710},{"name":"revert_transfer_ownership","outputs":[],"inputs":[],"stateMutability":"nonpayable","type":"function","gas":21985},{"name":"admin_balances","outputs":[{"type":"uint256","name":""}],"inputs":[{"type":"uint256","name":"i"}],"stateMutability":"view","type":"function","gas":3481},{"name":"withdraw_admin_fees","outputs":[],"inputs":[],"stateMutability":"nonpayable","type":"function","gas":21502},{"name":"donate_admin_fees","outputs":[],"inputs":[],"stateMutability":"nonpayable","type":"function","gas":111389},{"name":"kill_me","outputs":[],"inputs":[],"stateMutability":"nonpayable","type":"function","gas":37998},{"name":"unkill_me","outputs":[],"inputs":[],"stateMutability":"nonpayable","type":"function","gas":22135},{"name":"coins","outputs":[{"type":"address","name":""}],"inputs":[{"type":"uint256","name":"arg0"}],"stateMutability":"view","type":"function","gas":2220},{"name":"balances","outputs":[{"type":"uint256","name":""}],"inputs":[{"type":"uint256","name":"arg0"}],"stateMutability":"view","type":"function","gas":2250},{"name":"fee","outputs":[{"type":"uint256","name":""}],"inputs":[],"stateMutability":"view","type":"function","gas":2171},{"name":"admin_fee","outputs":[{"type":"uint256","name":""}],"inputs":[],"stateMutability":"view","type":"function","gas":2201},{"name":"owner","outputs":[{"type":"address","name":""}],"inputs":[],"stateMutability":"view","type":"function","gas":2231},{"name":"initial_A","outputs":[{"type":"uint256","name":""}],"inputs":[],"stateMutability":"view","type":"function","gas":2261},{"name":"future_A","outputs":[{"type":"uint256","name":""}],"inputs":[],"stateMutability":"view","type":"function","gas":2291},{"name":"initial_A_time","outputs":[{"type":"uint256","name":""}],"inputs":[],"stateMutability":"view","type":"function","gas":2321},{"name":"future_A_time","outputs":[{"type":"uint256","name":""}],"inputs":[],"stateMutability":"view","type":"function","gas":2351},{"name":"admin_actions_deadline","outputs":[{"type":"uint256","name":""}],"inputs":[],"stateMutability":"view","type":"function","gas":2381},{"name":"transfer_ownership_deadline","outputs":[{"type":"uint256","name":""}],"inputs":[],"stateMutability":"view","type":"function","gas":2411},{"name":"future_fee","outputs":[{"type":"uint256","name":""}],"inputs":[],"stateMutability":"view","type":"function","gas":2441},{"name":"future_admin_fee","outputs":[{"type":"uint256","name":""}],"inputs":[],"stateMutability":"view","type":"function","gas":2471},{"name":"future_owner","outputs":[{"type":"address","name":""}],"inputs":[],"stateMutability":"view","type":"function","gas":2501}];

        const busdPoolABI =  [
            {"name":"TokenExchange","inputs":[{"type":"address","name":"buyer","indexed":true},{"type":"int128","name":"sold_id","indexed":false},{"type":"uint256","name":"tokens_sold","indexed":false},{"type":"int128","name":"bought_id","indexed":false},{"type":"uint256","name":"tokens_bought","indexed":false}],"anonymous":false,"type":"event"},{"name":"AddLiquidity","inputs":[{"type":"address","name":"provider","indexed":true},{"type":"uint256[3]","name":"token_amounts","indexed":false},{"type":"uint256[3]","name":"fees","indexed":false},{"type":"uint256","name":"invariant","indexed":false},{"type":"uint256","name":"token_supply","indexed":false}],"anonymous":false,"type":"event"},{"name":"RemoveLiquidity","inputs":[{"type":"address","name":"provider","indexed":true},{"type":"uint256[3]","name":"token_amounts","indexed":false},{"type":"uint256[3]","name":"fees","indexed":false},{"type":"uint256","name":"token_supply","indexed":false}],"anonymous":false,"type":"event"},{"name":"RemoveLiquidityOne","inputs":[{"type":"address","name":"provider","indexed":true},{"type":"uint256","name":"token_amount","indexed":false},{"type":"uint256","name":"coin_amount","indexed":false}],"anonymous":false,"type":"event"},{"name":"RemoveLiquidityImbalance","inputs":[{"type":"address","name":"provider","indexed":true},{"type":"uint256[3]","name":"token_amounts","indexed":false},{"type":"uint256[3]","name":"fees","indexed":false},{"type":"uint256","name":"invariant","indexed":false},{"type":"uint256","name":"token_supply","indexed":false}],"anonymous":false,"type":"event"},{"name":"CommitNewAdmin","inputs":[{"type":"uint256","name":"deadline","indexed":true},{"type":"address","name":"admin","indexed":true}],"anonymous":false,"type":"event"},{"name":"NewAdmin","inputs":[{"type":"address","name":"admin","indexed":true}],"anonymous":false,"type":"event"},{"name":"CommitNewFee","inputs":[{"type":"uint256","name":"deadline","indexed":true},{"type":"uint256","name":"fee","indexed":false},{"type":"uint256","name":"admin_fee","indexed":false}],"anonymous":false,"type":"event"},{"name":"NewFee","inputs":[{"type":"uint256","name":"fee","indexed":false},{"type":"uint256","name":"admin_fee","indexed":false}],"anonymous":false,"type":"event"},{"name":"RampA","inputs":[{"type":"uint256","name":"old_A","indexed":false},{"type":"uint256","name":"new_A","indexed":false},{"type":"uint256","name":"initial_time","indexed":false},{"type":"uint256","name":"future_time","indexed":false}],"anonymous":false,"type":"event"},{"name":"StopRampA","inputs":[{"type":"uint256","name":"A","indexed":false},{"type":"uint256","name":"t","indexed":false}],"anonymous":false,"type":"event"},{"outputs":[],"inputs":[{"type":"address","name":"_owner"},{"type":"address[3]","name":"_coins"},{"type":"address","name":"_pool_token"},{"type":"uint256","name":"_A"},{"type":"uint256","name":"_fee"},{"type":"uint256","name":"_admin_fee"}],"stateMutability":"nonpayable","type":"constructor"},{"name":"A","outputs":[{"type":"uint256","name":""}],"inputs":[],"stateMutability":"view","type":"function","gas":5227},{"name":"get_virtual_price","outputs":[{"type":"uint256","name":""}],"inputs":[],"stateMutability":"view","type":"function","gas":1133537},{"name":"calc_token_amount","outputs":[{"type":"uint256","name":""}],"inputs":[{"type":"uint256[3]","name":"amounts"},{"type":"bool","name":"deposit"}],"stateMutability":"view","type":"function","gas":4508776},{"name":"add_liquidity","outputs":[],"inputs":[{"type":"uint256[2]","name":"amounts"},{"type":"uint256","name":"min_mint_amount"}],"stateMutability":"nonpayable","type":"function","gas":6954858},{"name":"get_dy","outputs":[{"type":"uint256","name":""}],"inputs":[{"type":"int128","name":"i"},{"type":"int128","name":"j"},{"type":"uint256","name":"dx"}],"stateMutability":"view","type":"function","gas":2673791},{"name":"get_dy_underlying","outputs":[{"type":"uint256","name":""}],"inputs":[{"type":"int128","name":"i"},{"type":"int128","name":"j"},{"type":"uint256","name":"dx"}],"stateMutability":"view","type":"function","gas":2673474},{"name":"exchange","outputs":[],"inputs":[{"type":"int128","name":"i"},{"type":"int128","name":"j"},{"type":"uint256","name":"dx"},{"type":"uint256","name":"min_dy"}],"stateMutability":"nonpayable","type":"function","gas":2818066},{"name":"remove_liquidity","outputs":[],"inputs":[{"type":"uint256","name":"_amount"},{"type":"uint256[3]","name":"min_amounts"}],"stateMutability":"nonpayable","type":"function","gas":192846},{"name":"remove_liquidity_imbalance","outputs":[],"inputs":[{"type":"uint256[3]","name":"amounts"},{"type":"uint256","name":"max_burn_amount"}],"stateMutability":"nonpayable","type":"function","gas":6951851},{"name":"calc_withdraw_one_coin","outputs":[{"type":"uint256","name":""}],"inputs":[{"type":"uint256","name":"_token_amount"},{"type":"int128","name":"i"}],"stateMutability":"view","type":"function","gas":1102},{"name":"remove_liquidity_one_coin","outputs":[],"inputs":[{"type":"uint256","name":"_token_amount"},{"type":"int128","name":"i"},{"type":"uint256","name":"min_amount"}],"stateMutability":"nonpayable","type":"function","gas":4025523},{"name":"ramp_A","outputs":[],"inputs":[{"type":"uint256","name":"_future_A"},{"type":"uint256","name":"_future_time"}],"stateMutability":"nonpayable","type":"function","gas":151919},{"name":"stop_ramp_A","outputs":[],"inputs":[],"stateMutability":"nonpayable","type":"function","gas":148637},{"name":"commit_new_fee","outputs":[],"inputs":[{"type":"uint256","name":"new_fee"},{"type":"uint256","name":"new_admin_fee"}],"stateMutability":"nonpayable","type":"function","gas":110461},{"name":"apply_new_fee","outputs":[],"inputs":[],"stateMutability":"nonpayable","type":"function","gas":97242},{"name":"revert_new_parameters","outputs":[],"inputs":[],"stateMutability":"nonpayable","type":"function","gas":21895},{"name":"commit_transfer_ownership","outputs":[],"inputs":[{"type":"address","name":"_owner"}],"stateMutability":"nonpayable","type":"function","gas":74572},{"name":"apply_transfer_ownership","outputs":[],"inputs":[],"stateMutability":"nonpayable","type":"function","gas":60710},{"name":"revert_transfer_ownership","outputs":[],"inputs":[],"stateMutability":"nonpayable","type":"function","gas":21985},{"name":"admin_balances","outputs":[{"type":"uint256","name":""}],"inputs":[{"type":"uint256","name":"i"}],"stateMutability":"view","type":"function","gas":3481},{"name":"withdraw_admin_fees","outputs":[],"inputs":[],"stateMutability":"nonpayable","type":"function","gas":21502},{"name":"donate_admin_fees","outputs":[],"inputs":[],"stateMutability":"nonpayable","type":"function","gas":111389},{"name":"kill_me","outputs":[],"inputs":[],"stateMutability":"nonpayable","type":"function","gas":37998},{"name":"unkill_me","outputs":[],"inputs":[],"stateMutability":"nonpayable","type":"function","gas":22135},{"name":"coins","outputs":[{"type":"address","name":""}],"inputs":[{"type":"uint256","name":"arg0"}],"stateMutability":"view","type":"function","gas":2220},{"name":"balances","outputs":[{"type":"uint256","name":""}],"inputs":[{"type":"uint256","name":"arg0"}],"stateMutability":"view","type":"function","gas":2250},{"name":"fee","outputs":[{"type":"uint256","name":""}],"inputs":[],"stateMutability":"view","type":"function","gas":2171},{"name":"admin_fee","outputs":[{"type":"uint256","name":""}],"inputs":[],"stateMutability":"view","type":"function","gas":2201},{"name":"owner","outputs":[{"type":"address","name":""}],"inputs":[],"stateMutability":"view","type":"function","gas":2231},{"name":"initial_A","outputs":[{"type":"uint256","name":""}],"inputs":[],"stateMutability":"view","type":"function","gas":2261},{"name":"future_A","outputs":[{"type":"uint256","name":""}],"inputs":[],"stateMutability":"view","type":"function","gas":2291},{"name":"initial_A_time","outputs":[{"type":"uint256","name":""}],"inputs":[],"stateMutability":"view","type":"function","gas":2321},{"name":"future_A_time","outputs":[{"type":"uint256","name":""}],"inputs":[],"stateMutability":"view","type":"function","gas":2351},{"name":"admin_actions_deadline","outputs":[{"type":"uint256","name":""}],"inputs":[],"stateMutability":"view","type":"function","gas":2381},{"name":"transfer_ownership_deadline","outputs":[{"type":"uint256","name":""}],"inputs":[],"stateMutability":"view","type":"function","gas":2411},{"name":"future_fee","outputs":[{"type":"uint256","name":""}],"inputs":[],"stateMutability":"view","type":"function","gas":2441},{"name":"future_admin_fee","outputs":[{"type":"uint256","name":""}],"inputs":[],"stateMutability":"view","type":"function","gas":2471},{"name":"future_owner","outputs":[{"type":"address","name":""}],"inputs":[],"stateMutability":"view","type":"function","gas":2501}];
;
            
        const UniRouterABI = [
            {
                "inputs": [
                    {
                        "internalType": "uint256",
                        "name": "amountOut",
                        "type": "uint256"
                    },
                    {
                        "internalType": "address[]",
                        "name": "path",
                        "type": "address[]"
                    },
                    {
                        "internalType": "address",
                        "name": "to",
                        "type": "address"
                    },
                    {
                        "internalType": "uint256",
                        "name": "deadline",
                        "type": "uint256"
                    }
                ],
                "name": "swapETHForExactTokens",
                "outputs": [
                    {
                        "internalType": "uint256[]",
                        "name": "amounts",
                        "type": "uint256[]"
                    }
                ],
                "stateMutability": "payable",
                "type": "function"
            }
        ];

        const erc20ABI = [
            {
                "inputs": [
                    {
                        "internalType": "address",
                        "name": "",
                        "type": "address"
                    },
                    {
                        "internalType": "uint256",
                        "name": "",
                        "type": "uint256"
                    }
                ],
                "name": "approve",
                "outputs": [
                    {
                        "internalType": "bool",
                        "name": "",
                        "type": "bool"
                    }
                ],
                "stateMutability": "nonpayable",
                "type": "function"
            },
            {
                "inputs": [
                    {
                        "internalType": "address",
                        "name": "",
                        "type": "address"
                    }
                ],
                "name": "balanceOf",
                "outputs": [
                    {
                        "internalType": "uint256",
                        "name": "",
                        "type": "uint256"
                    }
                ],
                "stateMutability": "view",
                "type": "function"
            }
        ];

        const USDTerc20ABI = [
            {
                "inputs": [
                    {
                        "internalType": "address",
                        "name": "_spender",
                        "type": "address"
                    },
                    {
                        "internalType": "uint256",
                        "name": "_value",
                        "type": "uint256"
                    }
                ],
                "name": "approve",
                "outputs": [],
                "stateMutability": "nonpayable",
                "type": "function"
            },
            {
                "inputs": [
                    {
                        "internalType": "address",
                        "name": "",
                        "type": "address"
                    }
                ],
                "name": "balanceOf",
                "outputs": [
                    {
                        "internalType": "uint256",
                        "name": "",
                        "type": "uint256"
                    }
                ],
                "stateMutability": "view",
                "type": "function"
            }
        ];

        const curveFactory = new ethers.Contract("0x0959158b6040D32d04c301A72CBFD6b39E21c9AE",curveFactoryABI,(await ethers.getSigners())[0]);
        //const RegistryContract = new ethers.Contract("0x90E00ACe148ca3b23Ac1bC8C240C2a7Dd9c2d7f5",curveRegistryABI,(await ethers.getSigners())[0]);
        const UniRouter = new ethers.Contract("0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D",UniRouterABI,(await ethers.getSigners())[0]);
        
        const factoryDeployTx = await curveFactory.deploy_metapool(
            "0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7",
            "Bao USD",
            "bUSD",
            ERC20Contract.address,
            100,
            4000000
        );
        await factoryDeployTx.wait();
        console.log("Curve Pool created");
        const poolAddress = await curveFactory.pool_list((await curveFactory.pool_count())-1);
        console.log("Address1: ", poolAddress);
        console.log("Address2: ", (await curveFactory.find_pool_for_coins(ERC20Contract.address, "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48")));

        bUSDCurvePoolContract = new ethers.Contract(poolAddress,busdPoolABI,(await ethers.getSigners())[0]);
        ThreeCurvePoolContract = new ethers.Contract("0xbEbc44782C7dB0a1A60Cb6fe97d0b483032FF1C7",curvePoolABI,(await ethers.getSigners())[0]);
        ThreeCurveTokenContract = new ethers.Contract("0x6c3F90f043a72FA612cbac8115EE7e52BDe6E490",erc20ABI,(await ethers.getSigners())[0]);
        
        console.log("Newly created pool address: ", poolAddress);

        //Buy all tokens needed for Pool
        const buyDAItx = await UniRouter.swapETHForExactTokens(ethers.utils.parseEther("100000"), ["0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2","0x6b175474e89094c44da98b954eedeac495271d0f"], (await ethers.getSigners())[0].address, 10000000000, {value: ethers.utils.parseEther("100")});    
        await buyDAItx.wait();  
        const buyUSDTtx = await UniRouter.swapETHForExactTokens("100000000000", ["0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2","0xdAC17F958D2ee523a2206206994597C13D831ec7"], (await ethers.getSigners())[0].address, 10000000000, {value: ethers.utils.parseEther("100")});    
        await buyUSDTtx.wait();
        const buyUSDCtx = await UniRouter.swapETHForExactTokens("100000000000", ["0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2","0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"], (await ethers.getSigners())[0].address, 10000000000, {value: ethers.utils.parseEther("100")});    
        await buyUSDCtx.wait();   
        const mintbUSDtx = await ERC20Contract.mint((await ethers.getSigners())[0].address,ethers.utils.parseEther("100000"));
        await mintbUSDtx.wait();
        console.log("Needed token bought");

        //Approve token transfers to 3pool
        var DaiContract = new ethers.Contract("0x6b175474e89094c44da98b954eedeac495271d0f",erc20ABI,(await ethers.getSigners())[0]);
        var approveTx = await DaiContract.approve(ThreeCurvePoolContract.address,ethers.utils.parseEther("100000"));    
        await approveTx.wait();
        var USDTContract = new ethers.Contract("0xdAC17F958D2ee523a2206206994597C13D831ec7",USDTerc20ABI,(await ethers.getSigners())[0]);
        approveTx = await USDTContract.approve(ThreeCurvePoolContract.address,"0");   
        await approveTx.wait();
        USDTContract = new ethers.Contract("0xdAC17F958D2ee523a2206206994597C13D831ec7",USDTerc20ABI,(await ethers.getSigners())[0]);
        approveTx = await USDTContract.approve(ThreeCurvePoolContract.address,"100000000000");    
        await approveTx.wait();    
        USDCContract = new ethers.Contract("0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",erc20ABI,(await ethers.getSigners())[0]);
        approveTx = await USDCContract.approve(ThreeCurvePoolContract.address,"100000000000");    
        await approveTx.wait();
        console.log("Tokens approved");

        //Join 3Pool 
        var addLiquidityTx = await ThreeCurvePoolContract.add_liquidity([ethers.utils.parseEther("100000"),"100000000000", "100000000000"], 0);
        await addLiquidityTx.wait();
        console.log("Joined 3Pool: ");

        //Join bUSD-3Pool
        const ThreeTokenBalance = await ThreeCurveTokenContract.balanceOf((await ethers.getSigners())[0].address);
        console.log("Three Token balance: ",ThreeTokenBalance.toString());
        approveTx = await ThreeCurveTokenContract.approve(bUSDCurvePoolContract.address,ThreeTokenBalance);
        await approveTx.wait();
        approveTx = await ERC20Contract.approve(bUSDCurvePoolContract.address,ethers.utils.parseEther("100000"));    
        await approveTx.wait();
        console.log("Approved bUSD-3Pool: ");
  
        addLiquidityTx = await bUSDCurvePoolContract.add_liquidity([ethers.utils.parseEther("100000"), ThreeTokenBalance],0,{gasLimit:1000000});
        await addLiquidityTx.wait();
    }

    async function liquidate(){

        const liquidatorFactory = await ethers.getContractFactory("LiquidationController");
        const liquidatorContract = await liquidatorFactory.deploy(bUSDCurvePoolContract.address, cERC20ImmunatbleContract.address, CEtherContract.address, ERC20Contract.address, cUSDCImmunatbleContract.address, "0xE592427A0AEce92De3Edee1F18E0157C05861564");
        await liquidatorContract.deployTransaction.wait();
        console.log("Liquidator Deployed");

        //Get Debt amount
        var accountInfo = await comptrollerContract.getAccountLiquidity((await ethers.getSigners())[0].address);
        flashLoanAmount = ethers.utils.parseEther("30").mul(ethers.utils.parseEther("1.1")).div(ethers.utils.parseEther("1"));
        console.log("Debt Amount: ", accountInfo[2].toString());
        console.log("Flashloan Amount: ", flashLoanAmount.toString());

        //liquidate under water position
        const liquidationTX = await liquidatorContract.executeLiquidations([(await ethers.getSigners())[0].address],[ethers.utils.parseEther("30")],[CEtherContract.address],flashLoanAmount);
        await liquidationTX.wait();

        accountInfo = await comptrollerContract.getAccountLiquidity((await ethers.getSigners())[0].address);
        console.log("After Liquidation Debt Amount: ", accountInfo[2].toString());
    };

}
  
main()
  .then(() => process.exit(0))
  .catch((error) => {
      console.error(error);
      process.exit(1);
  });
  
